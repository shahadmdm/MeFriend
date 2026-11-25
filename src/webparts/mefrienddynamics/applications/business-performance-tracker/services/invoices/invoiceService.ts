import type { ApiClient } from '../../../../shared/api/apiClient';
import type { IInvoiceDetail, IInvoiceFilters, IInvoiceLineItem, IInvoiceListItem } from '../../../bc-extension/models/invoices';
import type { IBcPagedResult, ICursorPaginationState } from '../../../../shared/models/IServerPagination';
import type { ISortState } from '../../../../shared/models/ISortState';
import type { PaymentStatus } from '../../../bc-extension/models/invoices';
import type { IAppUser } from '../../../bc-extension/models/settings/IAppAccessModels';
import { normalizeBusinessDate } from '../../../../shared/utilities/formatUtils';
import { getCurrentSalespersonCode, normalizeSalespersonCode } from '../../../bc-extension/utils/salespersonDataScope';
import { buildBcPageQuery } from '../../../../shared/utilities/serverPagination';
import { requireInvoiceNumber } from '../../../bc-extension/utils/invoiceReference';
interface IInvoiceLineItemApiModel {
  '@odata.etag': string;
  documentNo: string;
  lineNo: number;
  itemNo: string;
  quantity: number;
  HSNCode: string;
  GSTRate: string;
  Amount: number;
  description?: string;
  itemDescription?: string;
}
interface IInvoiceApiModel {
  '@odata.etag'?: string;
  id: string;
  number: string;
  invoiceDate?: string;
  postingDate?: string;
  documentDate?: string;
  dueDate?: string;
  externalDocumentNumber?: string;
  orderNumber?: string;
  yourReference?: string;
  customerNumber: string;
  customerName: string;
  releaseOrderNumber?: string;
  releaseOrderDate?: string;
  salesperson: string;
  salespersonName?: string;
  totalAmountIncludingTax?: number;
  remainingAmount?: number;
  paymentStatus?: string;
  documentStatus?: string;
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
  // The list endpoint may omit expanded lines.
  salesInvoiceLines?: readonly IInvoiceLineItemApiModel[];
}
type InvoiceListApiResponse = IBcPagedResult<IInvoiceApiModel>;
export interface IOutstandingInvoiceReport {
  invoices: readonly IInvoiceListItem[];
  totalOutstandingAmount: number;
}
export class InvoiceService {
  public constructor(private readonly apiClient: ApiClient) {}
  public async getOutstandingAmountTotal(
    filters: IInvoiceFilters,
    currentUser?: IAppUser
  ): Promise<number> {
    const report = await this.getOutstandingInvoiceReport(filters, currentUser);
    return report.totalOutstandingAmount;
  }
  public async getOutstandingInvoiceReport(
    filters: IInvoiceFilters,
    currentUser?: IAppUser
  ): Promise<IOutstandingInvoiceReport> {
    const visitedTokens = new Set<string>();
    let total = 0;
    let pageSize = 100;
    let continuationToken: string | undefined;
    const invoices: IInvoiceListItem[] = [];
    do {
      const result = await this.getInvoices(
        { ...filters, outstandingOnly: true },
        {
          pageNumber: 1,
          pageSize,
          currentToken: continuationToken,
          nextToken: undefined,
          hasNext: false,
          pageTokens: { 1: continuationToken }
        },
        undefined,
        currentUser
      );
      result.items.forEach((invoice: IInvoiceListItem) => {
        invoices.push(invoice);
        if (typeof invoice.remainingAmount === 'number' && Number.isFinite(invoice.remainingAmount)) {
          total += invoice.remainingAmount;
        }
      });
      if (result.hasNext && !result.nextToken) {
        throw new Error('Invoice API returned a paged result without a continuation token.');
      }
      pageSize = result.pageSize || pageSize;
      continuationToken = result.hasNext ? result.nextToken : undefined;
      if (continuationToken) {
        if (visitedTokens.has(continuationToken)) {
          throw new Error('Invoice API returned a repeated continuation token.');
        }
        visitedTokens.add(continuationToken);
      }
    } while (continuationToken);
    return {
      invoices,
      totalOutstandingAmount: total
    };
  }
  public async getInvoices(
    filters: IInvoiceFilters = {},
    pagination: ICursorPaginationState,
    sorting?: ISortState,
    currentUser?: IAppUser
  ): Promise<IBcPagedResult<IInvoiceListItem>> {
    const mandatorySalespersonCode = getCurrentSalespersonCode(currentUser);
    const selectedSalespersonCode = normalizeSalespersonCode(filters.salespersonCode) || undefined;
    const salespersonCode = mandatorySalespersonCode || selectedSalespersonCode;
    const response = await this.apiClient.get<InvoiceListApiResponse>('/api/SalesInvoices', buildBcPageQuery({
      search: filters.searchText,
      parameters: {
        customerSearch: filters.customerSearch,
        outstandingOnly: filters.outstandingOnly === true ? true : undefined
      },
      filters: {
        customerCode: filters.customerCode,
        salespersonCode,
        invoiceDateFrom: normalizeBusinessDate(filters.invoiceDateFrom),
        invoiceDateTo: normalizeBusinessDate(filters.invoiceDateTo)
      }
    }, pagination, sorting));
    const result = response.data;
    if (!response.success || !result || !Array.isArray(result.items)) {
      const responseError = new Error(response.message || 'Invoice API returned an invalid list response.') as Error & {
        errors?: readonly string[];
        correlationId?: string;
      };
      responseError.errors = response.errors;
      responseError.correlationId = response.correlationId;
      throw responseError;
    }
    return {
      items: result.items.map((item: IInvoiceApiModel) => this.mapInvoiceApiToUiModel(item)),
      pageSize: result.pageSize || pagination.pageSize,
      hasNext: Boolean(result.hasNext),
      nextToken: result.nextToken
    };
  }
  public async getInvoiceByNumber(invoiceNumber: string, currentUser?: IAppUser): Promise<IInvoiceDetail> {
    const invoiceReference = requireInvoiceNumber(invoiceNumber);
    const salespersonCode = getCurrentSalespersonCode(currentUser);
    const response = await this.apiClient.get<IInvoiceApiModel>(
      `/api/SalesInvoices/${encodeURIComponent(invoiceReference)}`,
      { salespersonCode }
    );
    if (!response.success || !response.data || (salespersonCode && normalizeSalespersonCode(response.data.salesperson) !== salespersonCode)) {
      const notFoundError = new Error(`Invoice ${invoiceReference} was not found.`) as Error & { status?: number };
      notFoundError.status = 404;
      throw notFoundError;
    }
    return this.mapInvoiceApiToUiModel(response.data);
  }
  public async getOutstandingInvoices(
    filters: IInvoiceFilters = {},
    pagination: ICursorPaginationState,
    sorting?: ISortState,
    currentUser?: IAppUser
  ): Promise<IBcPagedResult<IInvoiceListItem>> {
    return this.getInvoices({ ...filters, outstandingOnly: true }, pagination, sorting, currentUser);
  }

  // Scan the existing listing endpoint; no new totals endpoint is required.
  private async scanInvoices(
    filters: IInvoiceFilters,
    currentUser: IAppUser | undefined,
    visit: (invoice: IInvoiceListItem) => void
  ): Promise<void> {
    let pageSize = 100;
    let token: string | undefined;
    const seen = new Set<string>();
    do {
      const page = await this.getInvoices(filters, {
        pageNumber: 1, pageSize, currentToken: token,
        nextToken: undefined, hasNext: false, pageTokens: { 1: token }
      }, undefined, currentUser);
      page.items.forEach(visit);
      if (page.hasNext && !page.nextToken) {
        throw new Error('Invoice API returned a paged result without a continuation token.');
      }
      token = page.hasNext ? page.nextToken : undefined;
      if (token) {
        if (seen.has(token)) { throw new Error('Invoice API returned a repeated continuation token.'); }
        seen.add(token);
      }
      pageSize = page.pageSize || pageSize;
    } while (token);
  }

  public async getInvoiceTotals(
    filters: IInvoiceFilters = {}, currentUser?: IAppUser
  ): Promise<{ invoiceCount: number; totalAmount: number; outstandingAmount: number }> {
    const totals = { invoiceCount: 0, totalAmount: 0, outstandingAmount: 0 };
    await this.scanInvoices(filters, currentUser, (invoice: IInvoiceListItem) => {
      totals.invoiceCount += 1;
      if (typeof invoice.totalAmountIncludingTax === 'number' && Number.isFinite(invoice.totalAmountIncludingTax)) {
        totals.totalAmount += invoice.totalAmountIncludingTax;
      }
      if (typeof invoice.remainingAmount === 'number' && Number.isFinite(invoice.remainingAmount)) {
        totals.outstandingAmount += invoice.remainingAmount;
      }
    });
    return totals;
  }

  public async getInvoicesBySalesOrderId(
    salesOrderId: string, currentUser?: IAppUser
  ): Promise<IBcPagedResult<IInvoiceListItem>> {
    const requestedOrder = (salesOrderId || '').trim().toUpperCase();
    if (!requestedOrder) { throw new Error('Sales order number is required.'); }
    const matches: IInvoiceListItem[] = [];
    await this.scanInvoices({}, currentUser, (invoice: IInvoiceListItem) => {
      // List items are mapped to detail objects by getInvoices.
      const orderNumber = (invoice as IInvoiceDetail).orderNumber;
      if ((orderNumber || '').trim().toUpperCase() === requestedOrder) {
        matches.push(invoice);
      }
    });
    return { items: matches, pageSize: matches.length || 100, hasNext: false, nextToken: undefined };
  }

  public mapInvoiceApiToUiModel(api: IInvoiceApiModel): IInvoiceDetail {
    return {
      id: api.id,
      number: api.number,
      invoiceDate: api.invoiceDate,
      postingDate: api.postingDate,
      documentDate: api.documentDate,
      dueDate: api.dueDate,
      externalDocumentNumber: api.externalDocumentNumber,
      orderNumber: api.orderNumber,
      yourReference: api.yourReference,
      customerNumber: api.customerNumber,
      customerName: api.customerName,
      releaseOrderNumber: api.releaseOrderNumber,
      releaseOrderDate: api.releaseOrderDate,
      salesperson: api.salesperson,
      salespersonName: api.salespersonName,
      totalAmountIncludingTax: api.totalAmountIncludingTax,
      remainingAmount: api.remainingAmount,
      paymentStatus: api.paymentStatus,
      documentStatus: api.documentStatus,
      sellToCustomerNumber: api.sellToCustomerNumber,
      sellToCustomerName: api.sellToCustomerName,
      billToCustomerNumber: api.billToCustomerNumber,
      billToCustomerName: api.billToCustomerName,
      billToAddressLine1: api.billToAddressLine1,
      billToAddressLine2: api.billToAddressLine2,
      billToCity: api.billToCity,
      billToState: api.billToState,
      billToPostCode: api.billToPostCode,
      billToCountryCode: api.billToCountryCode,
      shipToName: api.shipToName,
      shipToAddressLine1: api.shipToAddressLine1,
      shipToAddressLine2: api.shipToAddressLine2,
      shipToCity: api.shipToCity,
      shipToState: api.shipToState,
      shipToPostCode: api.shipToPostCode,
      shipToCountryCode: api.shipToCountryCode,
      customerGSTRegistrationNumber: api.customerGSTRegistrationNumber,
      placeOfSupply: api.placeOfSupply,
      gstCustomerType: api.gstCustomerType,
      gstInvoice: api.gstInvoice,
      hasGSTEntries: api.hasGSTEntries,
      responsibilityCenter: api.responsibilityCenter,
      locationCode: api.locationCode,
      currencyCode: api.currencyCode,
      currencyFactor: api.currencyFactor,
      paymentTermsCode: api.paymentTermsCode,
      shipmentMethodCode: api.shipmentMethodCode,
      pricesIncludeTax: api.pricesIncludeTax,
      subtotal: api.subtotal,
      discountAmount: api.discountAmount,
      totalAmountExcludingTax: api.totalAmountExcludingTax,
      sgstAmount: api.sgstAmount,
      cgstAmount: api.cgstAmount,
      igstAmount: api.igstAmount,
      utgstAmount: api.utgstAmount,
      cessAmount: api.cessAmount,
      otherGSTAmount: api.otherGSTAmount,
      totalTaxAmount: api.totalTaxAmount,
      hasCustomerLedgerEntry: api.hasCustomerLedgerEntry,
      customerLedgerEntryNumber: api.customerLedgerEntryNumber,
      originalAmount: api.originalAmount,
      settledAmount: api.settledAmount,
      originalAmountLCY: api.originalAmountLCY,
      remainingAmountLCY: api.remainingAmountLCY,
      customerLedgerDueDate: api.customerLedgerDueDate,
      closedAtDate: api.closedAtDate,
      isOpen: api.isOpen,
      isPaid: api.isPaid,
      isPartiallyPaid: api.isPartiallyPaid,
      isOverdue: api.isOverdue,
      daysOverdue: api.daysOverdue,
      postingDescription: api.postingDescription,
      shortcutDimension1Code: api.shortcutDimension1Code,
      shortcutDimension2Code: api.shortcutDimension2Code,
      dimensionSetId: api.dimensionSetId,
      customerPostingGroup: api.customerPostingGroup,
      paymentMethodCode: api.paymentMethodCode,
      companyBankAccountCode: api.companyBankAccountCode,
      sourceCode: api.sourceCode,
      lastModifiedDateTime: api.lastModifiedDateTime,
      lines: (api.salesInvoiceLines || []).map((line: IInvoiceLineItemApiModel) => this.mapInvoiceLineApiToUiModel(line))
    };
  }
  public calculateOutstandingAmount(
    totalAmount: number,
    paidAmount: number | undefined,
    backendOutstanding?: number
  ): number | undefined {
    if (backendOutstanding !== undefined) {
      return backendOutstanding;
    }

    if (paidAmount === undefined) {
      return undefined;
    }

    return Math.max(0, totalAmount - paidAmount);
  }

  public calculatePaymentStatus(
    _totalAmount: number,
    paidAmount: number | undefined,
    outstandingAmount: number | undefined,
    backendStatus?: PaymentStatus
  ): PaymentStatus {
    if (backendStatus) {
      return backendStatus;
    }

    if (outstandingAmount === undefined) {
      return 'Unknown';
    }

    if (outstandingAmount <= 0) {
      return 'Paid';
    }

    if (paidAmount === undefined) {
      return 'Unknown';
    }

    return paidAmount > 0 ? 'Partially Paid' : 'Unpaid';
  }

  private mapInvoiceLineApiToUiModel(api: IInvoiceLineItemApiModel): IInvoiceLineItem {
    const amount = Number.isFinite(api.Amount) ? api.Amount : 0;
    const quantity = Number.isFinite(api.quantity) ? api.quantity : 0;
    return {
      lineNumber: String(api.lineNo),
      documentNumber: api.documentNo,
      itemCode: api.itemNo,
      hsnCode: api.HSNCode,
      gstRate: api.GSTRate,
      description: api.description || api.itemDescription || '',
      itemDescription: api.itemDescription,
      quantity,
      unitPrice: quantity === 0 ? 0 : amount / quantity,
      lineAmount: amount
    };
  }
}
