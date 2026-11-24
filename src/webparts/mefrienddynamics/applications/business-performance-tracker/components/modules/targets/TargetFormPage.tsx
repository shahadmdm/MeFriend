import * as React from 'react';

import type { ILookupOption } from '../../../../../shared/models/ILookupOption';
import type { EntityFormValues } from '../../../../../shared/utilities/validationUtils';

import { useEntityForm } from '../../../../../shared/hooks/useEntityForm';

import { Dropdown } from '../../../../../shared/components/dropdowns/Dropdown';
import { InputField } from '../../../../../shared/components/inputs/InputField';
import { FormSection } from '../../../../../shared/components/forms/FormSection';
import { FormFooter } from '../../../../../shared/components/forms/FormFooter';
import { PageContainer } from '../../../../../shared/components/pageContainer/PageContainer';
import { AppLoader } from '../../../../../shared/components/loaders/AppLoader';
import { ErrorState } from '../../../../../shared/components/errorState/ErrorState';
import { useToast } from '../../../../../shared/components/toast/useToast';
import { getUserFriendlyError } from '../../../../../shared/api/apiErrorHandler';

import formStyles from '../../../../../shared/components/forms/Forms.module.scss';

import {
  targetCompanyOptions,
  targetTypeOptions,
  targetStatusOptions,
  targetsModuleConfig
} from '../../../config/modules/targetsModuleConfig';

import {
  getTargetFormFields,
  targetMonthOptions
} from '../../../config/modules/targetFormFields';

import type {
  ITargetInput,
  TargetType
} from '../../../models/targets';

import type { TargetService } from '../../../services/targets/targetService';
import type { VerticalService } from '../../../services/verticals/verticalService';
import type { UnitService } from '../../../services/units/unitService';

import type { IVerticalListItem } from '../../../models/verticals';
import type { IUnitListItem } from '../../../models/units';

import type {
  ISalespersonLookupItem
} from '../../../../bc-extension/services/salespersons/salespersonService';

export interface ITargetFormPageProps {
  targetService: TargetService;
  verticalService: VerticalService;
  unitService: UnitService;
  loadSalespersons: (
    companyId: string,
    searchText?: string
  ) => Promise<readonly ISalespersonLookupItem[]>;
  targetId?: number;
  selectedCompanyId?: string;
  onNavigate: (path: string) => void;
}

const emptyValues: EntityFormValues = {
  companyId: '',
  targetType: '',
  targetCode: '',
  targetName: '',
  unitCode: '',
  verticalId: '',
  targetMonth: undefined,
  targetYear: undefined,
  targetAmount: undefined,
  isActive: 'active'
};

const getCompanyDisplayName = (companyId: string): string => {
  const option = targetCompanyOptions.find(
    item => item.value === companyId
  );

  return option?.text ?? companyId;
};

const getInitialValues = (
  selectedCompanyId?: string
): EntityFormValues => ({
  ...emptyValues,
  companyId: selectedCompanyId ?? '',
  ...(selectedCompanyId !== undefined
    ? {
        companyDisplayName: getCompanyDisplayName(selectedCompanyId)
      }
    : {})
});

const getString = (
  values: EntityFormValues,
  key: string
): string => {
  const value = values[key];
  return typeof value === 'string' ? value : '';
};

const getNumber = (
  values: EntityFormValues,
  key: string
): number => {
  const value = values[key];
  return typeof value === 'number' ? value : NaN;
};

const parseNumber = (value: string): number | undefined => {
  if (!value.trim()) {
    return undefined;
  }

  const result = Number(value);
  return Number.isFinite(result) ? result : undefined;
};

const getOption = (
  key: string,
  name: string,
  code: string
): ILookupOption => ({
  key,
  text: `${name} (${code})`,
  value: code
});

export const TargetFormPage: React.FC<ITargetFormPageProps> = ({
  targetService,
  verticalService,
  unitService,
  loadSalespersons,
  targetId,
  selectedCompanyId,
  onNavigate
}) => {
  const toast = useToast();
  const isEdit = targetId !== undefined;

  const [initialValues, setInitialValues] =
    React.useState<EntityFormValues>(
      () => getInitialValues(selectedCompanyId)
    );

  const [companyId, setCompanyId] = React.useState(
    selectedCompanyId ?? ''
  );
  const activeCompanyId = selectedCompanyId ?? companyId;
  const [targetType, setTargetType] =
    React.useState<TargetType | ''>('');

  const [verticals, setVerticals] =
    React.useState<readonly IVerticalListItem[]>([]);

  const [units, setUnits] =
    React.useState<readonly IUnitListItem[]>([]);

  const [salespersons, setSalespersons] =
    React.useState<readonly ISalespersonLookupItem[]>([]);

  const [selectedSalesperson, setSelectedSalesperson] =
    React.useState<ISalespersonLookupItem | undefined>();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [salespersonLoading, setSalespersonLoading] =
    React.useState(false);

  const [error, setError] =
    React.useState<string | undefined>();

  const [salespersonError, setSalespersonError] =
    React.useState<string | undefined>();

  const salespersonRequestId = React.useRef(0);

  React.useEffect(() => {
    let active = true;

    const loadForm = async (): Promise<void> => {
      setLoading(true);
      setError(undefined);

      try {
        const [verticalRecords, unitRecords, existingTarget] =
          await Promise.all([
            selectedCompanyId === undefined
              ? verticalService.getVerticals()
              : verticalService.getVerticalsByCompany(
                  selectedCompanyId
                ),
            unitService.getUnits(),
            targetId !== undefined
              ? selectedCompanyId === undefined
                ? targetService.getTargetById(targetId)
                : targetService.getTargetByIdForCompany(
                    targetId,
                    selectedCompanyId
                  )
              : Promise.resolve(undefined)
          ]);

        if (!active) {
          return;
        }

        if (targetId !== undefined && !existingTarget) {
          throw new Error(
            selectedCompanyId === undefined
              ? 'Target record not found.'
              : 'Target record not found for the selected company.'
          );
        }

        setVerticals(verticalRecords);
        setUnits(unitRecords);

        if (existingTarget) {
          setCompanyId(existingTarget.companyId);
          setTargetType(existingTarget.targetType);

          setInitialValues({
            companyId: existingTarget.companyId,
            ...(selectedCompanyId !== undefined
              ? {
                  companyDisplayName: getCompanyDisplayName(
                    existingTarget.companyId
                  )
                }
              : {}),
            targetType: existingTarget.targetType,
            targetCode: existingTarget.targetCode,
            targetName: existingTarget.targetName,
            unitCode: existingTarget.unitCode,
            verticalId: String(existingTarget.verticalId),
            targetMonth: existingTarget.targetMonth,
            targetYear: existingTarget.targetYear,
            targetAmount: existingTarget.targetAmount,
            isActive: existingTarget.isActive
              ? 'active'
              : 'inactive'
          });

          setSelectedSalesperson(
            existingTarget.targetType === 'Salesperson'
              ? {
                  code: existingTarget.targetCode,
                  name: existingTarget.targetName
                }
              : undefined
          );
        } else {
          setCompanyId(selectedCompanyId ?? '');
          setTargetType('');
          setSelectedSalesperson(undefined);
          setInitialValues(getInitialValues(selectedCompanyId));
        }
      } catch (loadError) {
        if (active) {
          setError(getUserFriendlyError(loadError));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadForm().catch(() => undefined);

    return () => {
      active = false;
      salespersonRequestId.current += 1;
    };
  }, [
    targetId,
    targetService,
    verticalService,
    unitService,
    selectedCompanyId
  ]);

  const unitOptions = React.useMemo<readonly ILookupOption[]>(
    () =>
      units
        .filter(item => item.isActive)
        .map(item =>
          getOption(
            String(item.id),
            item.unitName,
            item.unitCode
          )
        ),
    [units]
  );

  const verticalOptions = React.useMemo<readonly ILookupOption[]>(
    () =>
      verticals
        .filter(item =>
          item.isActive && item.companyId === activeCompanyId
        )
        .map(item => ({
          key: String(item.id),
          text: item.verticalName,
          value: String(item.id)
        })),
    [verticals, activeCompanyId]
  );

  const salespersonOptions = React.useMemo<
    readonly ILookupOption[]
  >(() => {
    const records = selectedSalesperson
      ? [
          selectedSalesperson,
          ...salespersons.filter(
            item => item.code !== selectedSalesperson.code
          )
        ]
      : salespersons;

    return records.map(item =>
      getOption(item.code, item.name, item.code)
    );
  }, [salespersons, selectedSalesperson]);

  const nameOptions = targetType === 'Unit'
    ? unitOptions
    : targetType === 'Salesperson'
      ? salespersonOptions
      : [];

  const fields = React.useMemo(
    () => getTargetFormFields({
      selectedCompanyId,
      targetType,
      nameOptions,
      unitOptions,
      verticalOptions
    }),
    [
      selectedCompanyId,
      targetType,
      nameOptions,
      unitOptions,
      verticalOptions
    ]
  );

  const saveTarget = React.useCallback(async (
    values: EntityFormValues
  ): Promise<void> => {
    if (saving) {
      return;
    }

    const formCompanyId = getString(values, 'companyId').trim();

    if (selectedCompanyId !== undefined) {
      if (!selectedCompanyId.trim()) {
        toast.error('Select a company before saving.', {
          title: 'Target Master'
        });
        return;
      }

      if (formCompanyId !== selectedCompanyId.trim()) {
        toast.error(
          'The Target Company must match the selected company.',
          { title: 'Company Mismatch' }
        );
        return;
      }
    }

    const input: ITargetInput = {
      companyId: selectedCompanyId !== undefined
        ? selectedCompanyId.trim()
        : formCompanyId,
      targetType: getString(values, 'targetType') as TargetType,
      targetCode: getString(values, 'targetCode'),
      targetName: getString(values, 'targetName'),
      unitCode: getString(values, 'unitCode'),
      verticalId: Number(getString(values, 'verticalId')),
      targetMonth: getNumber(values, 'targetMonth'),
      targetYear: getNumber(values, 'targetYear'),
      targetAmount: getNumber(values, 'targetAmount'),
      isActive: getString(values, 'isActive') === 'active'
    };

    if (input.targetType === 'Unit') {
      input.unitCode = '';
    }

    setSaving(true);

    try {
      if (selectedCompanyId !== undefined) {
        await targetService.saveTargetForCompany(
          input,
          selectedCompanyId,
          targetId
        );
      } else {
        await targetService.saveTarget(input, targetId);
      }

      toast.success(
        isEdit
          ? 'Target updated successfully.'
          : 'Target created successfully.',
        { title: 'Target Master' }
      );

      onNavigate(targetsModuleConfig.route);
    } catch (saveError) {
      toast.error(getUserFriendlyError(saveError), {
        title: isEdit
          ? 'Unable to update target'
          : 'Unable to create target'
      });
    } finally {
      setSaving(false);
    }
  }, [
    saving,
    targetService,
    targetId,
    selectedCompanyId,
    toast,
    onNavigate,
    isEdit
  ]);

  const form = useEntityForm({
    fields,
    initialValues,
    onSubmit: values => {
      saveTarget(values).catch(() => undefined);
    }
  });

  const refreshSalespersons = React.useCallback(async (
    searchText: string = ''
  ): Promise<void> => {
    if (!activeCompanyId || targetType !== 'Salesperson') {
      return;
    }

    const requestId = ++salespersonRequestId.current;

    setSalespersonLoading(true);
    setSalespersonError(undefined);

    try {
      const records = await loadSalespersons(
        activeCompanyId,
        searchText
      );

      if (requestId !== salespersonRequestId.current) {
        return;
      }

      setSalespersons(
        records.filter(item => item.code.trim().length > 0)
      );
    } catch (lookupError) {
      if (requestId === salespersonRequestId.current) {
        setSalespersonError(getUserFriendlyError(lookupError));
        setSalespersons([]);
      }
    } finally {
      if (requestId === salespersonRequestId.current) {
        setSalespersonLoading(false);
      }
    }
  }, [activeCompanyId, targetType, loadSalespersons]);

  React.useEffect(() => {
    if (!activeCompanyId || targetType !== 'Salesperson') {
      salespersonRequestId.current += 1;
      setSalespersons([]);
      setSalespersonLoading(false);
      setSalespersonError(undefined);
      return;
    }

    refreshSalespersons().catch(() => undefined);

    return () => {
      salespersonRequestId.current += 1;
    };
  }, [activeCompanyId, targetType, refreshSalespersons]);


  const handleCompanyChange = (
    nextValue: string | readonly string[] | undefined
  ): void => {
    // The active company can only be changed in the app sidebar.
    if (selectedCompanyId !== undefined) {
      return;
    }

    const nextCompany =
        typeof nextValue === 'string' ? nextValue : '';

    if (nextCompany === companyId) {
      return;
    }

    salespersonRequestId.current += 1;

    setCompanyId(nextCompany);
    setSalespersons([]);
    setSelectedSalesperson(undefined);

    form.setValues({
      companyId: nextCompany,
      targetCode: '',
      targetName: '',
      verticalId: '',
      unitCode: ''
    });
  };


  const handleTypeChange = (
    nextValue: string | readonly string[] | undefined
  ): void => {

    const nextType: TargetType | '' =
      nextValue === 'Unit' || nextValue === 'Salesperson'
        ? nextValue
        : '';

    if (nextType === targetType) {
      return;
    }

    salespersonRequestId.current += 1;

    setTargetType(nextType);
    setSalespersons([]);
    setSelectedSalesperson(undefined);

    form.setValues({
      targetType: nextType,
      targetCode: '',
      targetName: '',
      unitCode: ''
    });
  };


  const handleNameChange = (
    nextValue: string | readonly string[] | undefined
  ): void => {
    const code =
        typeof nextValue === 'string' ? nextValue : '';


    if (!code) {
      form.setValues({
        targetCode: '',
        targetName: ''
      });
      setSelectedSalesperson(undefined);
      return;
    }

    const selectedOption = nameOptions.find(
      option => option.value === code
    );

    if (!selectedOption) {
      return;
    }

    const selectedName = targetType === 'Unit'
      ? units.find(item => item.unitCode === code)?.unitName
      : salespersons.find(item => item.code === code)?.name ||
        (selectedSalesperson?.code === code
          ? selectedSalesperson.name
          : undefined);

    if (!selectedName) {
      return;
    }

    form.setValues({
      targetCode: code,
      targetName: selectedName
    });

    setSelectedSalesperson(
      targetType === 'Salesperson'
        ? { code, name: selectedName }
        : undefined
    );
  };

  const fieldError = (key: string): string | undefined =>
    form.touched[key] ? form.errors[key] : undefined;

  if (loading) {
    return <AppLoader label="Loading target details" />;
  }

  if (error) {
    return (
      <ErrorState
        title="Unable to load target"
        message={error}
      />
    );
  }

  return (
    <PageContainer
      title={isEdit ? 'Edit Target' : 'Add Target'}
      description={
        isEdit
          ? 'Update the selected performance target.'
          : 'Create a new unit or salesperson performance target.'
      }
    >
      <form
        className={formStyles.entityForm}
        onSubmit={event => {
          event.preventDefault();
          form.handleSubmit();
        }}
      >
        <div className={formStyles.formBody}>
          <FormSection title="Target Details">
            {selectedCompanyId === undefined ? (
              <Dropdown
                label="Company"
                value={getString(form.values, 'companyId')}
                options={targetCompanyOptions}
                required
                searchable
                placeholder="Select company"
                errorMessage={fieldError('companyId')}
                onChange={handleCompanyChange}
              />
            ) : null}
            <Dropdown
              label="Target Type"
              value={getString(form.values, 'targetType')}
              options={targetTypeOptions}
              required
              placeholder="Select target type"
              errorMessage={fieldError('targetType')}
              onChange={handleTypeChange}
            />

            <Dropdown
              key={`${activeCompanyId}:${targetType}`}
              label="Name"
              value={getString(form.values, 'targetCode')}
              options={nameOptions}
              required
              searchable
              remoteSearch={targetType === 'Salesperson'}
              loading={salespersonLoading}
              disabled={!activeCompanyId || !targetType}
              placeholder="Select name"
              errorMessage={fieldError('targetCode')}
              onSearch={query => {
                refreshSalespersons(query).catch(() => undefined);
              }}
              onChange={handleNameChange}
            />

            <InputField
              label="Code"
              value={getString(form.values, 'targetCode')}
              readOnly
              placeholder="Automatically populated"
            />

            {targetType === 'Salesperson' ? (
              <Dropdown
                label="Unit"
                value={getString(form.values, 'unitCode')}
                options={unitOptions}
                required
                searchable
                placeholder="Select unit"
                errorMessage={fieldError('unitCode')}
                onChange={value =>
                  form.setValue('unitCode', value || '')
                }
              />
            ) : null}

            <Dropdown
              label="Vertical"
              value={getString(form.values, 'verticalId')}
              options={verticalOptions}
              required
              searchable
              disabled={!activeCompanyId}
              placeholder="Select vertical"
              errorMessage={fieldError('verticalId')}
              onChange={value =>
                form.setValue('verticalId', value || '')
              }
            />

            <Dropdown
              label="Month"
              value={
                typeof form.values.targetMonth === 'number'
                  ? String(form.values.targetMonth)
                  : ''
              }
              options={targetMonthOptions}
              required
              placeholder="Select month"
              errorMessage={fieldError('targetMonth')}
              onChange={value =>
                form.setValue(
                  'targetMonth',
                  typeof value === 'string' && value !== ''
                    ? Number(value)
                    : undefined
                )
              }
            />

            <Dropdown
              label="Year"
              value={
                typeof form.values.targetYear === 'number'
                  ? String(form.values.targetYear)
                  : ''
              }
              options={fields.find(field => field.key === 'targetYear')?.options ?? []}
              required
              placeholder="Select year"
              errorMessage={fieldError('targetYear')}
              onChange={value =>
                form.setValue(
                  'targetYear',
                  typeof value === 'string' && value !== ''
                    ? Number(value)
                    : undefined
                )
              }
            />

            <InputField
              label="Target Amount (INR)"
              type="number"
              required
              min={0}
              value={
                typeof form.values.targetAmount === 'number'
                  ? form.values.targetAmount
                  : ''
              }
              placeholder="Enter target amount"
              errorMessage={fieldError('targetAmount')}
              onChange={value =>
                form.setValue('targetAmount', parseNumber(value))
              }
              onBlur={() => form.validateField('targetAmount')}
            />

            <Dropdown
              label="Status"
              value={getString(form.values, 'isActive')}
              options={targetStatusOptions}
              required
              errorMessage={fieldError('isActive')}
              onChange={value =>
                form.setValue('isActive', value || '')
              }
            />
          </FormSection>

          {salespersonError && targetType === 'Salesperson' ? (
            <p role="alert" style={{ color: '#b91c1c' }}>
              Unable to load Salespersons: {salespersonError}
            </p>
          ) : null}
        </div>

        <FormFooter
          submitLabel={isEdit ? 'Update Target' : 'Save Target'}
          cancelLabel="Cancel"
          loading={saving}
          disabled={loading}
          onCancel={() =>
            onNavigate(targetsModuleConfig.route)
          }
          onSubmit={() => {
            form.handleSubmit();
          }}
        />
      </form>
    </PageContainer>
  );
};