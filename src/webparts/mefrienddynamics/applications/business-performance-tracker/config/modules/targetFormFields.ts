import type {
  IFormFieldConfig
} from '../../../../shared/models/IFormFieldConfig';

import type {
  ILookupOption
} from '../../../../shared/models/ILookupOption';

import {
  bcCompanies
} from '../../../bc-extension/config/bcCompanies';

import {
  targetCompanyOptions,
  targetTypeOptions,
  targetStatusOptions
} from './targetsModuleConfig';

import type {
  TargetType
} from '../../models/targets';

export const targetMonthOptions: readonly ILookupOption[] = [
  { key: '1', text: 'January', value: '1' },
  { key: '2', text: 'February', value: '2' },
  { key: '3', text: 'March', value: '3' },
  { key: '4', text: 'April', value: '4' },
  { key: '5', text: 'May', value: '5' },
  { key: '6', text: 'June', value: '6' },
  { key: '7', text: 'July', value: '7' },
  { key: '8', text: 'August', value: '8' },
  { key: '9', text: 'September', value: '9' },
  { key: '10', text: 'October', value: '10' },
  { key: '11', text: 'November', value: '11' },
  { key: '12', text: 'December', value: '12' }
];

export interface ITargetFormFieldOptions {
  selectedCompanyId?: string;
  targetType?: TargetType | '';
  nameOptions?: readonly ILookupOption[];
  unitOptions?: readonly ILookupOption[];
  verticalOptions?: readonly ILookupOption[];
}

const getCompanyDisplayName = (
  companyId: string
): string => {
  const companyOption = targetCompanyOptions.find(
    option => option.value === companyId
  );

  return companyOption?.text ?? companyId;
};

const getTargetYearOptions = (
  firstYear: number
): readonly ILookupOption[] =>
  [0, 1, 2].map(offset => {
    const year = String(firstYear + offset);

    return { key: year, text: year, value: year };
  });

export const getTargetFormFields = ({
  selectedCompanyId,
  targetType = '',
  nameOptions = [],
  unitOptions = [],
  verticalOptions = []
}: ITargetFormFieldOptions = {}): readonly IFormFieldConfig[] => {

  const currentYear = new Date().getFullYear();

  // Preserve the existing Company dropdown
  // until the Company Gate supplies an active company.
  const companyFields: IFormFieldConfig[] =
    selectedCompanyId === undefined
      ? [
          {
            key: 'companyId',
            label: 'Company',
            type: 'dropdown',
            required: true,
            searchable: true,
            section: 'Target Details',
            placeholder: 'Select company',
            options: targetCompanyOptions,
            validationRules: [
              {
                type: 'custom',
                message: 'Select a valid company.',
                validator: value =>
                  typeof value === 'string' &&
                  bcCompanies.some(
                    company => company.id === value
                  )
              }
            ]
          }
        ]
      : [
          {
            key: 'companyDisplayName',
            label: 'Company',
            type: 'text',
            required: false,
            readOnly: true,
            section: 'Target Details',
            defaultValue:
              getCompanyDisplayName(selectedCompanyId)
          },
          {
            key: 'companyId',
            label: 'Company ID',
            type: 'text',
            required: true,
            hidden: true,
            section: 'Target Details',
            defaultValue: selectedCompanyId,
            validationRules: [
              {
                type: 'custom',
                message: 'Invalid active company.',
                validator: value =>
                  typeof value === 'string' &&
                  value === selectedCompanyId &&
                  bcCompanies.some(
                    company =>
                      company.id === selectedCompanyId
                  )
              }
            ]
          }
        ];

  return [
    ...companyFields,
    {
      key: 'targetType',
      label: 'Target Type',
      type: 'dropdown',
      required: true,
      section: 'Target Details',
      placeholder: 'Select target type',
      options: targetTypeOptions
    },
    {
      key: 'targetCode',
      label: 'Name',
      type: 'dropdown',
      required: true,
      searchable: true,
      section: 'Target Details',
      placeholder: 'Select name',
      options: nameOptions
    },
    {
      key: 'targetName',
      label: 'Target Name',
      type: 'text',
      required: false,
      hidden: true,
      section: 'Target Details'
    },
    {
      key: 'unitCode',
      label: 'Unit',
      type: 'dropdown',
      required: targetType === 'Salesperson',
      hidden: targetType !== 'Salesperson',
      searchable: true,
      section: 'Target Details',
      placeholder: 'Select unit',
      options: unitOptions
    },
    {
      key: 'verticalId',
      label: 'Vertical',
      type: 'dropdown',
      required: true,
      searchable: true,
      section: 'Target Details',
      placeholder: 'Select vertical',
      options: verticalOptions
    },
    {
      key: 'targetMonth',
      label: 'Month',
      type: 'dropdown',
      required: true,
      section: 'Target Details',
      placeholder: 'Select month',
      options: targetMonthOptions,
      validationRules: [
        {
          type: 'min',
          value: 1,
          message: 'Month must be at least 1.'
        },
        {
          type: 'max',
          value: 12,
          message: 'Month cannot exceed 12.'
        },
        {
          type: 'custom',
          message: 'Select a valid month.',
          validator: value =>
            typeof value === 'number' &&
            Number.isInteger(value) &&
            value >= 1 &&
            value <= 12
        }
      ]
    },
    {
      key: 'targetYear',
      label: 'Year',
      type: 'dropdown',
      required: true,
      section: 'Target Details',
      placeholder: 'Select year',
      options: getTargetYearOptions(currentYear),
      validationRules: [
        {
          type: 'min',
          value: currentYear,
          message: `Year must be ${currentYear} or later.`
        },
        {
          type: 'max',
          value: currentYear + 2,
          message: `Year cannot exceed ${currentYear + 2}.`
        },
        {
          type: 'custom',
          message: 'Select a valid year.',
          validator: value =>
            typeof value === 'number' &&
            Number.isInteger(value) &&
            value >= currentYear &&
            value <= currentYear + 2
        }
      ]
    },
    {
      key: 'targetAmount',
      label: 'Target Amount (INR)',
      type: 'amount',
      required: true,
      section: 'Target Details',
      placeholder: 'Enter target amount',
      validationRules: [
        {
          type: 'min',
          value: 0,
          message: 'Target Amount cannot be negative.'
        }
      ]
    },
    {
      key: 'isActive',
      label: 'Status',
      type: 'dropdown',
      required: true,
      section: 'Target Details',
      defaultValue: 'active',
      options: targetStatusOptions
    }
  ];
};