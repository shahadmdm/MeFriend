import type { IModuleConfig } from '../../../../shared/models/IModuleConfig';

export const collectionOnBillsModuleConfig: IModuleConfig = {
  key: 'collectionOnBills',
  title: 'Collection on Bills',
  route: 'collection-on-bills',
  icon: 'PageList',
  description: 'View customer receipts and their invoice-wise collection applications.',
  createEnabled: false,
  detailEnabled: false,
  order: 7,
  visible: true
};
