import type { IModuleConfig } from '../../../../shared/models/IModuleConfig';
import type { IFormFieldConfig } from '../../../../shared/models/IFormFieldConfig';
import type { ILookupOption } from '../../../../shared/models/ILookupOption';

import {
  bcCompanies,
  getBcCompanyLabel
} from '../../../bc-extension/config/bcCompanies';

import type { IVerticalListItem } from '../../models/verticals';

export const verticalCompanyOptions: readonly ILookupOption[] =
  bcCompanies.map(company => ({
    key: company.id,
    text: getBcCompanyLabel(company),
    value: company.id
  }));

export const verticalStatusOptions: readonly ILookupOption[] = [
  { key: 'active', text: 'Active', value: 'active' },
  { key: 'inactive', text: 'Inactive', value: 'inactive' }
];

const getCompanyName = (companyId: string): string => {
  const company = bcCompanies.find(
    item => item.id === companyId
  );

  return company
    ? getBcCompanyLabel(company)
    : companyId || '-';
};

export const getVerticalFormFields = (
  selectedCompanyId?: string
): readonly IFormFieldConfig[] => {
  const companyFields: IFormFieldConfig[] =
    selectedCompanyId === undefined
      ? [
          {
            key: 'companyId',
            label: 'Company',
            type: 'dropdown',
            required: true,
            searchable: true,
            section: 'Vertical Details',
            placeholder: 'Select company',
            options: verticalCompanyOptions,
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
            key: 'companyId',
            label: 'Company ID',
            type: 'text',
            hidden: true,
            required: true,
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
      key: 'verticalName',
      label: 'Vertical Name',
      type: 'text',
      required: true,
      section: 'Vertical Details',
      placeholder: 'Enter vertical name',
      validationRules: [
        {
          type: 'custom',
          message: 'Vertical Name must not be empty.',
          validator: value =>
            typeof value === 'string' &&
            value.trim().length > 0
        },
        {
          type: 'maxLength',
          value: 150,
          message:
            'Vertical Name must be 150 characters or fewer.'
        }
      ]
    },
    {
      key: 'bcItemId',
      label: 'BC Item ID',
      type: 'text',
      required: true,
      section: 'Vertical Details',
      placeholder: 'Enter BC Item ID',
      validationRules: [
        {
          type: 'custom',
          message: 'BC Item ID is required.',
          validator: value =>
            typeof value === 'string' &&
            value.trim().length > 0
        },
        {
          type: 'maxLength',
          value: 255,
          message:
            'BC Item ID must be 255 characters or fewer.'
        }
      ]
    },
    {
      key: 'isActive',
      label: 'Status',
      type: 'dropdown',
      required: true,
      section: 'Vertical Details',
      defaultValue: 'active',
      options: verticalStatusOptions
    }
  ];
};

export const verticalsModuleConfig:
  IModuleConfig<IVerticalListItem> = {
    key: 'verticals',
    title: 'Vertical Master',
    route: 'verticals',
    icon: 'BranchMerge',
    description: 'Manage company-wise business verticals.',
    createEnabled: true,
    detailEnabled: true,
    order: 1,
    visible: true,

    tableColumns: [
      // {
      //   key: 'companyId',
      //   header: 'Company',
      //   fieldName: 'companyId',
      //   sortable: true,
      //   renderType: 'custom',
      //   minWidth: 260,
      //   customRender: item =>
      //     getCompanyName(item.companyId)
      // },
      {
        key: 'verticalName',
        header: 'Vertical Name',
        fieldName: 'verticalName',
        sortable: true,
        renderType: 'text',
        minWidth: 220
      },
      {
        key: 'bcItemId',
        header: 'BC Item ID',
        fieldName: 'bcItemId',
        sortable: true,
        renderType: 'custom',
        minWidth: 180,
        customRender: item =>
          item.bcItemId?.trim() || '-'
      },
      {
        key: 'isActive',
        header: 'Status',
        fieldName: 'isActive',
        sortable: false,
        renderType: 'custom',
        minWidth: 130,
        customRender: item =>
          item.isActive ? 'Active' : 'Inactive'
      }
    ],

    filters: [
      {
        key: 'searchText',
        label: 'Search',
        type: 'text'
      },
      {
        key: 'status',
        label: 'Status',
        type: 'dropdown',
        options: verticalStatusOptions
      }
    ],

    formFields: getVerticalFormFields()
  };