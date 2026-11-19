import type { IModuleConfig } from '../../../../shared/models/IModuleConfig';
import type { IInvoiceListItem } from '../../../bc-extension/models/invoices';
import { formatCurrency, formatDate } from '../../../../shared/utilities/formatUtils';

/**
 * BPT invoice module. Its filter UI follows BC Extension's current 5-control
 * invoice configuration, but columns read BPT's existing invoice UI model.
 * BC Extension source files are not modified.
 */
const displayText = (value?: string | null): string =>
  value === undefined || value === null || value === '' ? 'N/A' : value;
const displayDate = (value?: string): string => formatDate(value, 'N/A');
const displayAmount = (value?: number): string => formatCurrency(value, undefined, 'N/A');

type IInvoiceWithCurrentBcFields = IInvoiceListItem & {
  releaseOrderNumber?: string;
  releaseOrderDate?: string;
  salespersonName?: string;
};

export const invoicesModuleConfig: IModuleConfig<IInvoiceListItem> = {
  key: 'invoices',
  title: 'Sales Invoices',
  route: 'invoices',
  icon: 'Invoice',
  description: 'Invoice listing and details from Business Central.',
  createEnabled: false,
  detailEnabled: true,
  order: 4,
  visible: true,
  tableColumns: [
    {
      key: 'invoiceNumber', header: 'Invoice Number', fieldName: 'invoiceNumber',
      sortable: true, renderType: 'text',
      customRender: item => displayText(item.invoiceNumber)
    },
    {
      key: 'invoiceDate', header: 'Invoice Date', fieldName: 'invoiceDate',
      sortable: true, renderType: 'date',
      customRender: item => displayDate(item.invoiceDate)
    },
    {
      key: 'customerName', header: 'Customer Name', fieldName: 'customerName',
      sortable: true, renderType: 'text', minWidth: 180,
      customRender: item => displayText(item.customerName)
    },
    {
      key: 'releaseOrderNumber', header: 'Release Order Number', fieldName: 'releaseOrderNumber',
      sortable: false, renderType: 'text',
      customRender: item => displayText((item as IInvoiceWithCurrentBcFields).releaseOrderNumber)
    },
    {
      key: 'releaseOrderDate', header: 'Release Order Date', fieldName: 'releaseOrderDate',
      sortable: false, renderType: 'date',
      customRender: item => displayDate((item as IInvoiceWithCurrentBcFields).releaseOrderDate)
    },
    {
      key: 'salespersonName', header: 'Salesperson Name', fieldName: 'salespersonName',
      sortable: false, renderType: 'text', minWidth: 180,
      customRender: item => displayText(
        (item as IInvoiceWithCurrentBcFields).salespersonName || item.salesPerson || item.salespersonCode
      )
    },
    {
      key: 'totalAmountIncludingTax', header: 'Total Amount', fieldName: 'totalAmountIncludingTax',
      sortable: true, renderType: 'amount', align: 'right',
      customRender: item => displayAmount(item.totalAmount)
    },
    {
      key: 'remainingAmount', header: 'Outstanding Amount', fieldName: 'remainingAmount',
      sortable: true, renderType: 'amount', align: 'right',
      customRender: item => displayAmount(item.outstandingAmount)
    },
    {
      key: 'paymentStatus', header: 'Payment Status', fieldName: 'paymentStatus',
      sortable: false, renderType: 'text',
      customRender: item => displayText(item.paymentStatus)
    }
  ],
  filters: [
    { key: 'searchText', label: 'Search by invoice number', type: 'text' },
    { key: 'invoiceDate', label: 'Invoice Date', type: 'dateRange' },
    { key: 'customerSearch', label: 'Customer', type: 'text', placeholder: 'Customer name or code' },
    { key: 'salespersonCode', label: 'Salesperson', type: 'dropdown', searchable: true },
    { key: 'outstandingOnly', label: 'Outstanding Only', type: 'outstandingOnly' }
  ]
};
