import type { IModuleConfig } from '../../../../shared/models/IModuleConfig';
import type { IInvoiceListItem } from '../../models/invoices/IInvoiceModels';
import { formatCurrency, formatDate } from '../../../../shared/utilities/formatUtils';

const displayText = (value?: string): string => value === undefined || value === null || value === '' ? 'N/A' : value;
const displayDate = (value?: string): string => formatDate(value, 'N/A');
const displayAmount = (value?: number): string => formatCurrency(value, undefined, 'N/A');

export const invoicesModuleConfig: IModuleConfig<IInvoiceListItem> = {
  key: 'invoices',
  title: 'Invoices',
  route: 'invoices',
  icon: 'Invoice',
  description: 'Invoice listing and details from Business Central.',
  createEnabled: false,
  detailEnabled: true,
  order: 4,
  visible: true,
  tableColumns: [
    { key: 'number', header: 'Invoice Number', fieldName: 'number', sortable: true, renderType: 'text', customRender: item => displayText(item.number) },
    { key: 'invoiceDate', header: 'Invoice Date', fieldName: 'invoiceDate', sortable: true, renderType: 'date', customRender: item => displayDate(item.invoiceDate) },
    { key: 'customerName', header: 'Customer Name', fieldName: 'customerName', sortable: true, renderType: 'text', minWidth: 180, customRender: item => displayText(item.customerName) },
    { key: 'releaseOrderNumber', header: 'Release Order Number', fieldName: 'releaseOrderNumber', sortable: true, renderType: 'text', customRender: item => displayText(item.releaseOrderNumber) },
    { key: 'releaseOrderDate', header: 'Release Order Date', fieldName: 'releaseOrderDate', sortable: true, renderType: 'date', customRender: item => displayDate(item.releaseOrderDate) },
    { key: 'salespersonName', header: 'Salesperson Name', fieldName: 'salespersonName', sortable: false, renderType: 'text', minWidth: 180, customRender: item => displayText(item.salespersonName) },
    { key: 'totalAmountIncludingTax', header: 'Total Amount', fieldName: 'totalAmountIncludingTax', sortable: true, renderType: 'amount', align: 'right', customRender: item => displayAmount(item.totalAmountIncludingTax) },
    { key: 'remainingAmount', header: 'Outstanding Amount', fieldName: 'remainingAmount', sortable: true, renderType: 'amount', align: 'right', customRender: item => displayAmount(item.remainingAmount) },
    { key: 'paymentStatus', header: 'Payment Status', fieldName: 'paymentStatus', sortable: true, renderType: 'text', customRender: item => displayText(item.paymentStatus) }
  ],
  filters: [
    { key: 'searchText', label: 'Search by invoice number', type: 'text' },
    { key: 'invoiceDate', label: 'Invoice Date', type: 'dateRange' },
    { key: 'customerSearch', label: 'Customer', type: 'text', placeholder: 'Customer name or code' },
    { key: 'salespersonCode', label: 'Salesperson', type: 'dropdown', searchable: true },
    { key: 'outstandingOnly', label: 'Outstanding Only', type: 'outstandingOnly' }
  ]
};
