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
  number: string;
  invoiceDate?: string;
  customerNumber: string;
  customerName: string;
  releaseOrderNumber?: string;
  releaseOrderDate?: string;
  salesperson: string;
  salespersonName?: string;
  totalAmountIncludingTax?: number;
  remainingAmount?: number;
  paymentStatus?: PaymentStatus;
  documentStatus?: string;
}

export interface IInvoiceDetail extends IInvoiceListItem {
  postingDate?: string;
  documentDate?: string;
  dueDate?: string;
  externalDocumentNumber?: string;
  orderNumber?: string;
  yourReference?: string;
  sellToCustomerNumber?: string;
  sellToCustomerName?: string;
  billToCustomerNumber?: string;
  billToCustomerName?: string;
  billToAddressLine1?: string;
  billToAddressLine2?: string;
  billToCity?: string;
  billToState?: string;
  billToPostCode?: string;
  billToCountryCode?: string;
  shipToName?: string;
  shipToAddressLine1?: string;
  shipToAddressLine2?: string;
  shipToCity?: string;
  shipToState?: string;
  shipToPostCode?: string;
  shipToCountryCode?: string;
  customerGSTRegistrationNumber?: string;
  billToCustomerGSTRegistrationNumber?: string;
  shipToCustomerGSTRegistrationNumber?: string;
  placeOfSupply?: string;
  gstCustomerType?: string;
  gstInvoice?: boolean;
  hasGSTEntries?: boolean;
  responsibilityCenter?: string;
  locationCode?: string;
  currencyCode?: string;
  currencyFactor?: number;
  paymentTermsCode?: string;
  shipmentMethodCode?: string;
  pricesIncludeTax?: boolean;
  subtotal?: number;
  discountAmount?: number;
  totalAmountExcludingTax?: number;
  sgstAmount?: number;
  cgstAmount?: number;
  igstAmount?: number;
  utgstAmount?: number;
  cessAmount?: number;
  otherGSTAmount?: number;
  totalTaxAmount?: number;
  hasCustomerLedgerEntry?: boolean;
  customerLedgerEntryNumber?: number;
  originalAmount?: number;
  settledAmount?: number;
  originalAmountLCY?: number;
  remainingAmountLCY?: number;
  customerLedgerDueDate?: string;
  closedAtDate?: string;
  isOpen?: boolean;
  isPaid?: boolean;
  isPartiallyPaid?: boolean;
  isOverdue?: boolean;
  daysOverdue?: number;
  postingDescription?: string;
  shortcutDimension1Code?: string;
  shortcutDimension2Code?: string;
  dimensionSetId?: number;
  customerPostingGroup?: string;
  paymentMethodCode?: string;
  companyBankAccountCode?: string;
  sourceCode?: string;
  lastModifiedDateTime?: string;
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
  outstandingOnly?: boolean;
}
