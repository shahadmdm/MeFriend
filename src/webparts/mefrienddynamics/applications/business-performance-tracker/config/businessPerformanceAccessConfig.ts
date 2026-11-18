export const businessPerformancePermissionListTitle =
  'Business Performance App User Permissions';

export const businessPerformancePermissionFields = {
  id: 'Id',
  title: 'Title',
  appUser: 'AppUser',
  appUserId: 'AppUserId',
  moduleKey: 'ModuleKey',
  canView: 'CanView',
  canCreate: 'CanCreate',
  canManage: 'CanManage',
  isActive: 'IsActive'
} as const;

export const businessPerformancePermissionModuleKeys = [
  'bpt.app',
  'bpt.verticals',
  'bpt.units',
  'bpt.targets',
  'bpt.collectionReport',
  'bpt.collectionVerticalReport',
  'bpt.collectionOnBills',
  'bpt.invoices',
  'bpt.unitAccess'
] as const;

export type BusinessPerformancePermissionModuleKey =
  typeof businessPerformancePermissionModuleKeys[number];

export const businessPerformancePermissionModuleLabels:
  Readonly<
    Record<BusinessPerformancePermissionModuleKey, string>
  > = {
    'bpt.app': 'Business Performance Tracker',
    'bpt.verticals': 'Vertical Master',
    'bpt.units': 'Unit Master',
    'bpt.targets': 'Target Master',
    'bpt.collectionReport': 'Collection Report',
    'bpt.collectionVerticalReport': 'Collection Vertical Report',
    'bpt.collectionOnBills': 'Collection on Bills',
    'bpt.invoices': 'Invoices Report',
    'bpt.unitAccess': 'Unit Access'
  };

export const isBusinessPerformancePermissionModuleKey = (
  value: string
): value is BusinessPerformancePermissionModuleKey =>
  businessPerformancePermissionModuleKeys.some(
    moduleKey => moduleKey === value
  );
