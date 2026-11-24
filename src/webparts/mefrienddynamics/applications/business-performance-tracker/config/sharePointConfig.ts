export const businessPerformanceListTitles = {
  verticals: 'Business Performance Vertical Master',
  units: 'Business Performance Unit Master',
  targets: 'Business Performance Target Master'
} as const;

export const businessPerformanceFields = {
  verticals: {
    id: 'Id',
    title: 'Title',
    companyId: 'CompanyId',
    verticalName: 'VerticalName',
    bcItemId: 'BcItemId',
    isActive: 'IsActive',
    uniqueKey: 'VerticalUniqueKey'
  },
  units: {
    id: 'Id',
    title: 'Title',
    unitName: 'UnitName',
    unitCode: 'UnitCode',
    isActive: 'IsActive'
  },
  targets: {
    id: 'Id',
    title: 'Title',
    companyId: 'CompanyId',
    targetType: 'TargetType',
    targetCode: 'TargetCode',
    targetName: 'TargetName',
    verticalId: 'VerticalId',
    targetMonth: 'TargetMonth',
    targetYear: 'TargetYear',
    targetAmount: 'TargetAmount',
    isActive: 'IsActive',
    unitCode: 'UnitCode',
    uniqueKey: 'TargetUniqueKey'
  }
} as const;