import type { IModuleConfig } from '../../../../shared/models/IModuleConfig';

/**
 * Standalone Cheque Entry form module for BPT.
 * Uses the Invoice icon already recognized by the existing sidebar.
 */
export const chequeEntryModuleConfig: IModuleConfig<{ id: string }> = {
  key: 'chequeEntry',
  title: 'Cheque Entry',
  route: 'cheque-entry',
  icon: 'PaymentCard',
  description: 'Record cheque details and bill assignments.',
  createEnabled: false,
  detailEnabled: false,
  order: 80,
  visible: true,
  tableColumns: [],
  filters: []
};
