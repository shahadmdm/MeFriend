import * as React from 'react';

import {
  getVerticalFormFields,
  verticalCompanyOptions,
  verticalsModuleConfig
} from '../../../config/modules/verticalsModuleConfig';

import type {
  IVerticalInput
} from '../../../models/verticals';

import type {
  VerticalService
} from '../../../services/verticals/verticalService';

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

export interface IVerticalFormPageProps {
  verticalService: VerticalService;
  verticalId?: number;
  selectedCompanyId?: string;
  onNavigate: (path: string) => void;
}

const getStringValue = (
  values: EntityFormValues,
  key: string
): string => {
  const value = values[key];

  return typeof value === 'string' ? value : '';
};

const getCompanyDisplayName = (
  companyId: string
): string => {
  const companyOption = verticalCompanyOptions.find(
    option => option.value === companyId
  );

  return companyOption?.text ?? companyId;
};

const getCreateInitialValues = (
  selectedCompanyId?: string
): EntityFormValues => ({
  companyId: selectedCompanyId ?? '',
  ...(selectedCompanyId !== undefined
    ? {
        companyDisplayName:
          getCompanyDisplayName(selectedCompanyId)
      }
    : {}),
  verticalName: '',
  bcItemId: '',
  isActive: 'active'
});

export const VerticalFormPage:
  React.FC<IVerticalFormPageProps> = ({
    verticalService,
    verticalId,
    selectedCompanyId,
    onNavigate
  }) => {
    const toast = useToast();

    const isEdit = verticalId !== undefined;

    const [initialValues, setInitialValues] =
      React.useState<EntityFormValues>(
        () => getCreateInitialValues(selectedCompanyId)
      );

    const [loading, setLoading] =
      React.useState<boolean>(isEdit);

    const [saving, setSaving] =
      React.useState<boolean>(false);

    const [error, setError] =
      React.useState<string | undefined>();

    const fields = React.useMemo(
      () => getVerticalFormFields(selectedCompanyId),
      [selectedCompanyId]
    );

    React.useEffect(() => {
      if (verticalId === undefined) {
        setInitialValues(
          getCreateInitialValues(selectedCompanyId)
        );

        setLoading(false);
        setError(undefined);

        return;
      }

      let isMounted = true;

      const loadVertical = async (): Promise<void> => {
        setLoading(true);
        setError(undefined);

        try {
          const item =
            selectedCompanyId === undefined
              ? await verticalService.getVerticalById(
                  verticalId
                )
              : await verticalService.getVerticalByIdForCompany(
                  verticalId,
                  selectedCompanyId
                );

          if (!item) {
            throw new Error(
              selectedCompanyId === undefined
                ? 'Vertical record not found.'
                : 'Vertical record not found for the selected company.'
            );
          }

          if (isMounted) {
            setInitialValues({
              companyId: item.companyId,
              ...(selectedCompanyId !== undefined
                ? {
                    companyDisplayName:
                      getCompanyDisplayName(item.companyId)
                  }
                : {}),
              verticalName: item.verticalName,
              bcItemId: item.bcItemId ?? '',
              isActive: item.isActive
                ? 'active'
                : 'inactive'
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

      loadVertical().catch(() => undefined);

      return () => {
        isMounted = false;
      };
    }, [
      verticalId,
      verticalService,
      selectedCompanyId
    ]);

    const handleSubmit = React.useCallback(
      async (
        values: EntityFormValues
      ): Promise<void> => {
        if (saving) {
          return;
        }

        const formCompanyId = getStringValue(
          values,
          'companyId'
        ).trim();

        if (selectedCompanyId !== undefined) {
          const activeCompanyId =
            selectedCompanyId.trim();

          if (!activeCompanyId) {
            toast.error(
              'Please select a company before saving.',
              {
                title: 'Vertical Master'
              }
            );

            return;
          }

          if (formCompanyId !== activeCompanyId) {
            toast.error(
              'The Vertical Company must match the currently selected company.',
              {
                title: 'Company Mismatch'
              }
            );

            return;
          }
        }

        const input: IVerticalInput = {
          companyId:
            selectedCompanyId !== undefined
              ? selectedCompanyId.trim()
              : formCompanyId,

          verticalName: getStringValue(
            values,
            'verticalName'
          ),

          bcItemId: getStringValue(
            values,
            'bcItemId'
          ),

          isActive:
            getStringValue(
              values,
              'isActive'
            ) === 'active'
        };

        setSaving(true);

        try {
          // Step 295:
          // Use company-restricted saving when
          // an active company is supplied.
          if (selectedCompanyId !== undefined) {
            await verticalService.saveVerticalForCompany(
              input,
              selectedCompanyId,
              verticalId
            );
          } else {
            // Preserve existing behavior until
            // Company Gate integration.
            await verticalService.saveVertical(
              input,
              verticalId
            );
          }

          toast.success(
            isEdit
              ? 'Vertical updated successfully.'
              : 'Vertical created successfully.',
            {
              title: 'Vertical Master'
            }
          );

          onNavigate(verticalsModuleConfig.route);
        } catch (saveError) {
          toast.error(
            getUserFriendlyError(saveError),
            {
              title: isEdit
                ? 'Unable to update vertical'
                : 'Unable to create vertical'
            }
          );
        } finally {
          setSaving(false);
        }
      },
      [
        isEdit,
        onNavigate,
        saving,
        selectedCompanyId,
        toast,
        verticalId,
        verticalService
      ]
    );

    if (loading) {
      return (
        <AppLoader
          label="Loading vertical details"
        />
      );
    }

    if (error) {
      return (
        <ErrorState
          title="Unable to load vertical"
          message={error}
        />
      );
    }

    return (
      <PageContainer
        title={
          isEdit
            ? 'Edit Vertical'
            : 'Add Vertical'
        }
        description={
          isEdit
            ? 'Update the selected business vertical.'
            : 'Create a new company-wise business vertical.'
        }
      >
        <EntityForm
          fields={fields}
          initialValues={initialValues}
          submitLabel={
            isEdit
              ? 'Update Vertical'
              : 'Save Vertical'
          }
          cancelLabel="Cancel"
          loading={saving}
          onSubmit={values => {
            handleSubmit(values).catch(
              () => undefined
            );
          }}
          onCancel={() =>
            onNavigate(verticalsModuleConfig.route)
          }
        />
      </PageContainer>
    );
  };