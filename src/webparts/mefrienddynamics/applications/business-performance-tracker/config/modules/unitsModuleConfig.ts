
import type { IModuleConfig } from '../../../../shared/models/IModuleConfig';
import type { IFormFieldConfig } from '../../../../shared/models/IFormFieldConfig';
import type { ILookupOption } from '../../../../shared/models/ILookupOption';

import type { IUnitListItem } from '../../models/units';

export const unitStatusOptions: readonly ILookupOption[] = [
  { key: 'active', text: 'Active', value: 'active' },
  { key: 'inactive', text: 'Inactive', value: 'inactive' }
];

export const getUnitFormFields = (): readonly IFormFieldConfig[] => [
  {
    key: 'unitName',
    label: 'Unit Name',
    type: 'text',
    required: true,
    section: 'Unit Details',
    placeholder: 'Enter unit name',
    validationRules: [
      {
        type: 'custom',
        message: 'Unit Name must not be empty.',
        validator: value =>
          typeof value === 'string' && value.trim().length > 0
      },
      {
        type: 'maxLength',
        value: 255,
        message: 'Unit Name must be 255 characters or fewer.'
      }
    ]
  },
  {
    key: 'unitCode',
    label: 'Unit Code',
    type: 'text',
    required: true,
    section: 'Unit Details',
    placeholder: 'Enter unit code',
    validationRules: [
      {
        type: 'custom',
        message: 'Unit Code must not be empty.',
        validator: value =>
          typeof value === 'string' && value.trim().length > 0
      },
      {
        type: 'maxLength',
        value: 255,
        message: 'Unit Code must be 255 characters or fewer.'
      }
    ]
  },
  {
    key: 'isActive',
    label: 'Status',
    type: 'dropdown',
    required: true,
    section: 'Unit Details',
    defaultValue: 'active',
    options: unitStatusOptions
  }
];

export const unitsModuleConfig: IModuleConfig<IUnitListItem> = {
  key: 'units',
  title: 'Unit Master',
  route: 'units',
  icon: 'Building',
  description: 'Manage business units and their unique codes.',
  createEnabled: true,
  detailEnabled: true,
  order: 2,
  visible: true,
  tableColumns: [
    {
      key: 'unitName',
      header: 'Unit Name',
      fieldName: 'unitName',
      sortable: true,
      renderType: 'text',
      minWidth: 220
    },
    {
      key: 'unitCode',
      header: 'Unit Code',
      fieldName: 'unitCode',
      sortable: true,
      renderType: 'text',
      minWidth: 180
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
      options: unitStatusOptions
    }
  ],
  formFields: getUnitFormFields()
};
