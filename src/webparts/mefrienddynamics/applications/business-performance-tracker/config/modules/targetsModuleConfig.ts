import type { IModuleConfig } from '../../../../shared/models/IModuleConfig';
import type { ILookupOption } from '../../../../shared/models/ILookupOption';

import {
  bcCompanies,
  getBcCompanyLabel
} from '../../../bc-extension/config/bcCompanies';

import type {
  ITargetListItem
} from '../../models/targets';

export const targetCompanyOptions: readonly ILookupOption[] =
  bcCompanies.map(company => ({
    key: company.id,
    text: getBcCompanyLabel(company),
    value: company.id
  }));

export const targetTypeOptions: readonly ILookupOption[] = [
  { key: 'Unit', text: 'Unit', value: 'Unit' },
  {
    key: 'Salesperson',
    text: 'Salesperson',
    value: 'Salesperson'
  }
];

export const targetStatusOptions: readonly ILookupOption[] = [
  { key: 'active', text: 'Active', value: 'active' },
  { key: 'inactive', text: 'Inactive', value: 'inactive' }
];

const targetMonthNames: readonly string[] = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

const formatTargetAmount = (amount: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);

export const targetsModuleConfig: IModuleConfig<ITargetListItem> = {
  key: 'targets',
  title: 'Target Master',
  route: 'targets',
  icon: 'Bullseye',
  description: 'Manage company-wise unit and salesperson performance targets.',
  createEnabled: true,
  detailEnabled: true,
  order: 3,
  visible: true,

  tableColumns: [
    {
      key: 'targetType',
      header: 'Type',
      fieldName: 'targetType',
      sortable: true,
      renderType: 'text',
      minWidth: 130
    },
    {
      key: 'targetName',
      header: 'Name',
      fieldName: 'targetName',
      sortable: true,
      renderType: 'text',
      minWidth: 200
    },
    {
      key: 'targetCode',
      header: 'Code',
      fieldName: 'targetCode',
      sortable: true,
      renderType: 'text',
      minWidth: 130
    },
    {
      key: 'targetMonth',
      header: 'Month',
      fieldName: 'targetMonth',
      sortable: true,
      renderType: 'custom',
      minWidth: 120,
      customRender: item =>
        targetMonthNames[item.targetMonth - 1] ?? '-'
    },
    {
      key: 'targetYear',
      header: 'Year',
      fieldName: 'targetYear',
      sortable: true,
      renderType: 'text',
      minWidth: 90
    },
    {
      key: 'targetAmount',
      header: 'Target Amount',
      fieldName: 'targetAmount',
      sortable: true,
      renderType: 'custom',
      minWidth: 170,
      customRender: item =>
        formatTargetAmount(item.targetAmount)
    },
    {
      key: 'isActive',
      header: 'Status',
      fieldName: 'isActive',
      sortable: false,
      renderType: 'custom',
      minWidth: 120,
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
      key: 'companyId',
      label: 'Company',
      type: 'dropdown',
      searchable: true,
      options: targetCompanyOptions
    },
    {
      key: 'targetType',
      label: 'Type',
      type: 'dropdown',
      options: targetTypeOptions
    },
    {
      key: 'status',
      label: 'Status',
      type: 'dropdown',
      options: targetStatusOptions
    }
  ]
};