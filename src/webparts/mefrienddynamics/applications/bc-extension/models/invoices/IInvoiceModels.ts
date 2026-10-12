export type PaymentStatus = 'Paid' | 'Partially Paid' | 'Unpaid' | 'Overdue' | 'Unknown' | string;

export interface IInvoiceLineItem {
  lineNumber: string;
  documentNumber: string;
  itemCode: string;
  hsnCode: string;
  gstRate: string;
  description: string;
  itemDescription?: string;
  remarks?: string;
  quantity: number;
  unitPrice: number;
  lineAmount: number;
}

export interface IInvoiceListItem {
  id: string;
  invoiceNumber: string;
  invoiceDate?: string;
  customerCode: string;
  customerName: string;
  customerAddress: string;
  customerGSTNo: string;
  clientCode: string;
  clientName: string;
  clientAddress: string;
  clientGSTNo: string;
  sellToCustomerCode: string;
  sellToCustomerName: string;
  sellToCustomerAddress: string;
  sellToCustomerGSTNo: string;
  billToCustomerCode: string;
  billToCustomerName: string;
  billToCustomerAddress: string;
  billToCustomerGSTNo: string;
  salespersonCode: string;
  salespersonName?: string;
  tradeDiscount?: number;
  sgst?: number;
  cgst?: number;
  igst?: number;
  netAmount?: number;
}

export interface IInvoiceDetail extends IInvoiceListItem {
  lines: readonly IInvoiceLineItem[];
}

export interface IInvoiceFilters {
  searchText?: string;
  customerSearch?: string;
  /** Exact-code filter retained for API consumers that require it. */
  customerCode?: string;
  salespersonCode?: string;
  invoiceDateFrom?: string;
  invoiceDateTo?: string;
}
