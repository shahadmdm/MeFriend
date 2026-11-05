import * as React from 'react';

import {
  getUnitFormFields,
  unitsModuleConfig
} from '../../../config/modules/unitsModuleConfig';

import type {
  IUnitInput
} from '../../../models/units';

import type {
  UnitService
} from '../../../services/units/unitService';

import {
  EntityForm
} from '../../../../../shared/components/forms/EntityForm';

import {
  PageContainer
} from '../../../../../shared/components/pageContainer/PageContainer';

import {
  AppLoader
} from '../../../../../shared/components/loaders/AppLoader';

import {
  ErrorState
} from '../../../../../shared/components/errorState/ErrorState';

import {
  useToast
} from '../../../../../shared/components/toast/useToast';

import {
  getUserFriendlyError
} from '../../../../../shared/api/apiErrorHandler';

import type {
  EntityFormValues
} from '../../../../../shared/utilities/validationUtils';

export interface IUnitFormPageProps {
  unitService: UnitService;
  unitId?: number;
  onNavigate: (path: string) => void;
}

const getStringValue = (
  values: EntityFormValues,
  key: string
): string => {
  const value = values[key];
  return typeof value === 'string' ? value : '';
};

export const UnitFormPage: React.FC<IUnitFormPageProps> = ({
  unitService,
  unitId,
  onNavigate
}) => {
  const toast = useToast();
  const isEdit = unitId !== undefined;

  const [initialValues, setInitialValues] =
    React.useState<EntityFormValues>({
      unitName: '',
      unitCode: '',
      isActive: 'active'
    });

  const [loading, setLoading] = React.useState<boolean>(isEdit);
  const [saving, setSaving] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | undefined>();

  const fields = React.useMemo(
    () => getUnitFormFields(),
    []
  );

  React.useEffect(() => {
    if (unitId === undefined) {
      setInitialValues({
        unitName: '',
        unitCode: '',
        isActive: 'active'
      });
      setLoading(false);
      setError(undefined);
      return;
    }

    let isMounted = true;

    const loadUnit = async (): Promise<void> => {
      setLoading(true);
      setError(undefined);

      try {
        const item = await unitService.getUnitById(unitId);

        if (!item) {
          throw new Error('Unit record not found.');
        }

        if (isMounted) {
          setInitialValues({
            unitName: item.unitName,
            unitCode: item.unitCode,
            isActive: item.isActive ? 'active' : 'inactive'
          });
        }
      } catch (loadError) {
        if (isMounted) {
          setError(getUserFriendlyError(loadError));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadUnit().catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [unitId, unitService]);

  const handleSubmit = React.useCallback(async (
    values: EntityFormValues
  ): Promise<void> => {
    if (saving) {
      return;
    }

    const input: IUnitInput = {
      unitName: getStringValue(values, 'unitName'),
      unitCode: getStringValue(values, 'unitCode'),
      isActive: getStringValue(values, 'isActive') === 'active'
    };

    setSaving(true);

    try {
      await unitService.saveUnit(input, unitId);

      toast.success(
        isEdit
          ? 'Unit updated successfully.'
          : 'Unit created successfully.',
        { title: 'Unit Master' }
      );

      onNavigate(unitsModuleConfig.route);
    } catch (saveError) {
      toast.error(getUserFriendlyError(saveError), {
        title: isEdit
          ? 'Unable to update unit'
          : 'Unable to create unit'
      });
    } finally {
      setSaving(false);
    }
  }, [isEdit, onNavigate, saving, toast, unitId, unitService]);

  if (loading) {
    return <AppLoader label="Loading unit details" />;
  }

  if (error) {
    return (
      <ErrorState
        title="Unable to load unit"
        message={error}
      />
    );
  }

  return (
    <PageContainer
      title={isEdit ? 'Edit Unit' : 'Add Unit'}
      description={
        isEdit
          ? 'Update the selected business unit.'
          : 'Create a new business unit with a unique name and code.'
      }
    >
      <EntityForm
        fields={fields}
        initialValues={initialValues}
        submitLabel={isEdit ? 'Update Unit' : 'Save Unit'}
        cancelLabel="Cancel"
        loading={saving}
        onSubmit={values => {
          handleSubmit(values).catch(() => undefined);
        }}
        onCancel={() => onNavigate(unitsModuleConfig.route)}
      />
    </PageContainer>
  );
};