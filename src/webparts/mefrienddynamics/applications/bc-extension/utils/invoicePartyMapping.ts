export interface IInvoiceApiPartyFields {
  customerCode?: string;
  customerName?: string;
  customerAddress?: string;
  customerGSTNo?: string;
  clientCode?: string;
  clientName?: string;
  clientAddress?: string;
  clientGSTNo?: string;
}

export interface IInvoicePartyFields {
  sellToCustomerCode: string;
  sellToCustomerName: string;
  sellToCustomerAddress: string;
  sellToCustomerGSTNo: string;
  billToCustomerCode: string;
  billToCustomerName: string;
  billToCustomerAddress: string;
  billToCustomerGSTNo: string;
}

/**
 * The Business Central SalesInvoiceHeaders contract exposes Sell-to as customer*
 * and Bill-to as client*. Convert those ambiguous API names once at the boundary.
 */
export const mapInvoicePartyFields = (api: IInvoiceApiPartyFields): IInvoicePartyFields => ({
  sellToCustomerCode: api.customerCode || '',
  sellToCustomerName: api.customerName || '',
  sellToCustomerAddress: api.customerAddress || '',
  sellToCustomerGSTNo: api.customerGSTNo || '',
  billToCustomerCode: api.clientCode || '',
  billToCustomerName: api.clientName || '',
  billToCustomerAddress: api.clientAddress || '',
  billToCustomerGSTNo: api.clientGSTNo || ''
});
