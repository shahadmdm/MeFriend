
import type { IModuleConfig } from '../../../../shared/models/IModuleConfig';

export const collectionReportModuleConfig: IModuleConfig = {
  key: 'collectionReport',
  title: 'Business Report',
  route: 'collection-report',
  icon: 'BarChartVertical',
  description: 'View salesperson-wise and unit-wise business performance against targets.',
  createEnabled: false,
  detailEnabled: false,
  order: 4,
  visible: true
};
