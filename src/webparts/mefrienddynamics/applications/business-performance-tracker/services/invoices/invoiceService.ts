import type { ApiClient } from '../../../../shared/api/apiClient';
import type {
  IInvoiceDetail,
  IInvoiceFilters,
  IInvoiceLineItem,
  IInvoiceListItem,
  IInvoicePaymentRecord,
  PaymentStatus
} from '../../models/invoices';
import type { ICursorPaginationState, IServerPagedResult } from '../../../../shared/models/IServerPagination';
import type { ISortState } from '../../../../shared/models/ISortState';
import type { IAppUser } from '../../../bc-extension/models/settings/IAppAccessModels';
import { calculateOutstandingAmount, calculatePaymentStatus } from '../../utils/invoiceFinancialUtils';
import { normalizeBusinessDate } from '../../../../shared/utilities/formatUtils';
import { getCurrentSalespersonCode, normalizeSalespersonCode } from '../../../bc-extension/utils/salespersonDataScope';
import { buildServerPageQuery } from '../../../../shared/utilities/serverPagination';
import { requireInvoiceNumber } from '../../../bc-extension/utils/invoiceReference';

/**
 * BPT adapts the current BC SalesInvoices contract to the older invoice models
 * used by its existing EntityDashboard, detail page and print/PDF template.
 * Do NOT replace this with the BC Extension service class: its public model is different.
 */
interface IInvoiceLineItemApiModel {
  '@odata.etag'?: string;
  documentNo?: string;
  lineNo?: number;
  itemNo?: string;
  no?: string;
  type?: string;
  HSNCode?: string;
  hsnCode?: string;
  hsnSac?: string;
  hsnsac?: string;
  GSTRate?: string;
  gstRate?: string;
  gstPercent?: number | string;
  Amount?: number;
  lineNumber?: string;
  itemCode?: string;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  lineDiscountPercentage?: number;
  lineDiscountPercent?: number;
  lineDiscountPct?: number;
  lineAmount?: number;
  amountIncludingVAT?: number;
  currencyCode?: string;
}

interface IInvoicePaymentRecordApiModel {
  id?: string;
  paymentDate?: string;
  referenceNumber?: string;
  paymentMode?: string;
  amount?: number;
  currencyCode?: string;
}

interface IInvoiceApiModel {
  '@odata.etag'?: string;
  id?: string;
  number?: string; // Current BC API: invoice number
  invoiceNumber?: string; // Legacy aliases supported for existing endpoints
  invoiceNo?: string;
  no?: string;
  invoiceDate?: string;
  postingDate?: string;
  documentDate?: string;
  dueDate?: string;
  externalDocumentNumber?: string;
  orderNumber?: string;
  salesOrderNumber?: string;
  salesOrderNo?: string;
  salesOrderReference?: string;
  bookingOrderNumber?: string;
  bookingOrderNo?: string;
  bookingOrderDate?: string;
  salesOrderDate?: string;
  yourReference?: string;
  customerNumber?: string;
  customerCode?: string;
  sellToCustomerNo?: string;
  sellToCustomerName?: string;
  customerName?: string;
  customerAddress?: string;
  customerGSTNo?: string;
  customerGstin?: string;
  customerGSTIN?: string;
  customerGSTRegistrationNumber?: string;
  customerGSTState?: string;
  customerGstState?: string;
  customerState?: string;
  clientCode?: string;
  clientName?: string;
  clientAddress?: string;
  clientGSTNo?: string;
  clientGstin?: string;
  clientGSTIN?: string;
  clientGSTState?: string;
  clientGstState?: string;
  clientState?: string;
  salesperson?: string | number;
  salesPerson?: string | number;
  salespersonCode?: string | number;
  salesPersonCode?: string | number;
  SalespersonCode?: string | number;
  salespersonName?: string;
  salesPersonName?: string;
  releaseOrderNumber?: string;
  releaseOrderDate?: string;
  totalAmountIncludingTax?: number;
  totalAmountExcludingTax?: number;
  totalAmount?: number;
  netAmount?: number;
  subtotal?: number;
  tradeDiscount?: number;
  discountAmount?: number;
  invoiceDiscountAmountExclVat?: number;
  invoiceDiscountAmountExclVAT?: number;
  invoiceDiscountAmount?: number;
  invoiceDiscountPercent?: number;
  invoiceDiscountPercentage?: number;
  sgst?: number;
  cgst?: number;
  igst?: number;
  sgstAmount?: number;
  cgstAmount?: number;
  igstAmount?: number;
  roundOffAmount?: number;
  roundOff?: number;
  paidAmount?: number;
  remainingAmount?: number; // Current BC API: outstanding invoice balance
  outstandingAmount?: number;
  paymentStatus?: string;
  documentStatus?: string;
  invoiceStatus?: string;
  status?: string;
  amountInWords?: string;
  amountInWordsText?: string;
  irn?: string;
  IRN?: string;
  acknowledgementNumber?: string;
  ackNo?: string;
  AckNo?: string;
  acknowledgementDate?: string;
  ackDate?: string;
  AckDate?: string;
  qrCodeData?: string;
  qrCode?: string;
  qrCodeUrl?: string;
  signedQRCode?: string;
  currencyCode?: string;
  sellToCustomerNumber?: string;
  billToCustomerNumber?: string;
  billToCustomerName?: string;
  billToAddressLine1?: string;
  billToAddressLine2?: string;
  billToState?: string;
  shipToAddressLine1?: string;
  shipToAddressLine2?: string;
  shipToName?: string;
  salesInvoiceLines?: readonly IInvoiceLineItemApiModel[];
  SalesInvoiceLines?: readonly IInvoiceLineItemApiModel[];
  lines?: readonly IInvoiceLineItemApiModel[];
  payments?: readonly IInvoicePaymentRecordApiModel[];
}

type InvoiceListApiResponse = IServerPagedResult<IInvoiceApiModel>;

/** Same report structure as the current BC Extension InvoiceService. */
export interface IOutstandingInvoiceReport {
  invoices: readonly IInvoiceListItem[];
  totalOutstandingAmount: number;
}

/** BC Extension service structure, adapted to BPT's existing public models. */
export class InvoiceService {
  public constructor(private readonly apiClient: ApiClient) {}

  /** Fetches every matching outstanding invoice, not merely the visible page. */
  public async getOutstandingAmountTotal(
    filters: IInvoiceFilters,
    currentUser?: IAppUser
  ): Promise<number> {
    const report = await this.getOutstandingInvoiceReport(filters, currentUser);
    return report.totalOutstandingAmount;
  }

  /**
   * Follows the server continuation tokens to build an accurate full report.
   * Can be expensive for companies with very large invoice histories.
   */
  public async getOutstandingInvoiceReport(
    filters: IInvoiceFilters,
    currentUser?: IAppUser
  ): Promise<IOutstandingInvoiceReport> {
    const invoices: IInvoiceListItem[] = [];
    const visitedTokens = new Set<string>();
    let totalOutstandingAmount = 0;
    let pageSize = 100;
    let continuationToken: string | undefined;

    do {
      const page = await this.getInvoices(
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

      page.items.forEach((invoice: IInvoiceListItem): void => {
        invoices.push(invoice);
        const amount = invoice.outstandingAmount;
        if (typeof amount === 'number' && Number.isFinite(amount)) {
          totalOutstandingAmount += amount;
        }
      });

      if (page.hasNext && !page.nextToken) {
        throw new Error('Invoice API returned hasNext=true without a continuation token.');
      }

      pageSize = page.pageSize || pageSize;
      continuationToken = page.hasNext ? page.nextToken : undefined;
      if (continuationToken) {
        if (visitedTokens.has(continuationToken)) {
          throw new Error('Invoice API returned a repeated continuation token.');
        }
        visitedTokens.add(continuationToken);
      }
    } while (continuationToken);

    return { invoices, totalOutstandingAmount };
  }

  /**
   * Fast grand totals (optional API route; requires backend implementation).
   * Expected response.data:
   * { invoiceCount: number, totalAmount: number, outstandingAmount: number }
   * Totals must be computed over ALL matching invoices, not a paginated page.
   */
  public async getInvoiceTotals(
    filters: IInvoiceFilters = {},
    currentUser?: IAppUser
  ): Promise<{ invoiceCount: number; totalAmount: number; outstandingAmount: number }> {
    const mandatorySalespersonCode = getCurrentSalespersonCode(currentUser);
    const selectedSalespersonCode = normalizeSalespersonCode(filters.salespersonCode) || undefined;
    const salespersonCode = mandatorySalespersonCode || selectedSalespersonCode;
    const params = new URLSearchParams();
    const setText = (name: string, value?: string): void => {
      const normalized = value && value.trim();
      if (normalized) {
        params.set(name, normalized);
      }
    };
    setText('Search', filters.searchText);
    const customerSearch = (filters as IInvoiceFilters & { customerSearch?: string }).customerSearch;
    setText('CustomerSearch', customerSearch);
    setText('Filters[customerCode]', filters.customerCode);
    setText('Filters[salespersonCode]', salespersonCode);
    setText('Filters[invoiceDateFrom]', normalizeBusinessDate(filters.invoiceDateFrom));
    setText('Filters[invoiceDateTo]', normalizeBusinessDate(filters.invoiceDateTo));
    if (filters.outstandingOnly === true) {
      params.set('OutstandingOnly', 'true');
    }
    const query = params.toString();
    const url = query ? `/api/SalesInvoices/totals?${query}` : '/api/SalesInvoices/totals';
    const response = await this.apiClient.get<{
      invoiceCount: number;
      totalAmount: number;
      outstandingAmount: number;
    }>(url);
    const data = response.data;
    if (!data || !Number.isFinite(data.invoiceCount) ||
      !Number.isFinite(data.totalAmount) || !Number.isFinite(data.outstandingAmount)) {
      throw new Error('SalesInvoices totals API returned invalid totals.');
    }
    return data;
  }

  /**
   * Retains the known-working BPT query mapping. buildServerPageQuery is used
   * for paging/sorting only; filter keys are written explicitly to the URL.
   * The BC API's PagedRequest expects Search, CustomerSearch, OutstandingOnly
   * and Filters[fieldName], not the old flat searchText/salesPerson keys.
   */
  public async getInvoices(
    filters: IInvoiceFilters = {},
    pagination: ICursorPaginationState,
    sorting?: ISortState,
    currentUser?: IAppUser
  ): Promise<IServerPagedResult<IInvoiceListItem>> {
    const mandatorySalespersonCode = getCurrentSalespersonCode(currentUser);
    const selectedSalespersonCode = normalizeSalespersonCode(filters.salespersonCode) || undefined;
    const salespersonCode = mandatorySalespersonCode || selectedSalespersonCode;

    const baseQuery = buildServerPageQuery({}, pagination, sorting);
    const params = new URLSearchParams();
    Object.keys(baseQuery).forEach((name: string): void => {
      const value = baseQuery[name as keyof typeof baseQuery];
      if (value !== undefined && value !== null && String(value) !== '') {
        params.set(name, String(value));
      }
    });

    const setText = (name: string, value?: string): void => {
      const normalized = value && value.trim();
      if (normalized) {
        params.set(name, normalized);
      }
    };

    setText('Search', filters.searchText);
    // Some BC page versions include customerSearch, which is supported by the API.
    const customerSearch = (filters as IInvoiceFilters & { customerSearch?: string }).customerSearch;
    setText('CustomerSearch', customerSearch);
    setText('Filters[customerCode]', filters.customerCode);
    setText('Filters[salespersonCode]', salespersonCode);
    setText('Filters[invoiceDateFrom]', normalizeBusinessDate(filters.invoiceDateFrom));
    setText('Filters[invoiceDateTo]', normalizeBusinessDate(filters.invoiceDateTo));

    if (filters.outstandingOnly === true) {
      params.set('OutstandingOnly', 'true');
    }

    const query = params.toString();
    const url = query ? `/api/SalesInvoices?${query}` : '/api/SalesInvoices';
    const response = await this.apiClient.get<InvoiceListApiResponse>(url);

    if (!response.data || !Array.isArray(response.data.items)) {
      throw new Error(response.message || 'Invoice API returned an invalid paged response.');
    }

    return this.mapPagedResult(response.data, pagination.pageSize);
  }

  /** The detail endpoint binds salespersonCode rather than salesPerson. */
  public async getInvoiceByNumber(invoiceNumber: string, currentUser?: IAppUser): Promise<IInvoiceDetail> {
    const invoiceReference = requireInvoiceNumber(invoiceNumber);
    const mandatorySalespersonCode = getCurrentSalespersonCode(currentUser);
    const response = await this.apiClient.get<IInvoiceApiModel>(
      `/api/SalesInvoices/${encodeURIComponent(invoiceReference)}`,
      { salespersonCode: mandatorySalespersonCode }
    );

    const mappedInvoice = response.data ? this.mapInvoiceApiToUiModel(response.data) : undefined;
    if (!mappedInvoice ||
      (mandatorySalespersonCode &&
        normalizeSalespersonCode(mappedInvoice.salespersonCode) !== mandatorySalespersonCode)) {
      const error = new Error(`Invoice ${invoiceReference} was not found.`) as Error & { status?: number };
      error.status = 404;
      throw error;
    }
    return mappedInvoice;
  }

  public async getOutstandingInvoices(
    filters: IInvoiceFilters = {},
    pagination: ICursorPaginationState,
    sorting?: ISortState,
    currentUser?: IAppUser
  ): Promise<IServerPagedResult<IInvoiceListItem>> {
    return this.getInvoices({ ...filters, outstandingOnly: true }, pagination, sorting, currentUser);
  }

  /**
   * Compatibility method for existing BPT callers. The current backend does
   * not expose a server-side salesOrderNumber filter, so we scan the company's
   * invoices with cursor pagination and match the order number locally.
   * For large company histories this can be expensive; prefer a server-side
   * sales order filter when the API is extended.
   */
  public async getInvoicesBySalesOrderId(
    salesOrderId: string,
    currentUser?: IAppUser
  ): Promise<IServerPagedResult<IInvoiceListItem>> {
    const requestedOrder = (salesOrderId || '').trim().toUpperCase();
    if (!requestedOrder) {
      throw new Error('Sales order number is required.');
    }

    const matches: IInvoiceListItem[] = [];
    const visitedTokens = new Set<string>();
    let continuationToken: string | undefined;
    let pageSize = 100;
    do {
      const page = await this.getInvoices(
        {},
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
      page.items.forEach((invoice: IInvoiceListItem): void => {
        if ((invoice.salesOrderNumber || '').trim().toUpperCase() === requestedOrder) {
          matches.push(invoice);
        }
      });
      if (page.hasNext && !page.nextToken) {
        throw new Error('Invoice API returned hasNext=true without a continuation token.');
      }
      pageSize = page.pageSize || pageSize;
      continuationToken = page.hasNext ? page.nextToken : undefined;
      if (continuationToken) {
        if (visitedTokens.has(continuationToken)) {
          throw new Error('Invoice API returned a repeated continuation token.');
        }
        visitedTokens.add(continuationToken);
      }
    } while (continuationToken);

    return {
      items: matches,
      pageSize: matches.length || pageSize,
      hasNext: false,
      nextToken: undefined
    };
  }

  /**
   * Current BC API fields -> legacy BPT invoice model fields. Both newer
   * number/customerNumber/remainingAmount and older aliases are recognized.
   */
  public mapInvoiceApiToUiModel(api?: IInvoiceApiModel): IInvoiceDetail {
    const invoiceNumber = api?.number || api?.invoiceNumber || api?.invoiceNo || api?.no || '';
    const customerCode = api?.customerNumber || api?.customerCode || api?.sellToCustomerNo || '';
    const rawSalespersonCode = api?.salesperson ?? api?.salespersonCode ?? api?.salesPersonCode ??
      api?.SalespersonCode ?? api?.salesPerson;
    const salespersonCode = rawSalespersonCode === null || rawSalespersonCode === undefined
      ? '' : String(rawSalespersonCode).trim();

    const netAmount = this.toOptionalAmount(api?.netAmount, api?.totalAmountExcludingTax);
    const tradeDiscount = this.toOptionalAmount(api?.tradeDiscount, api?.discountAmount);
    const invoiceDiscountAmountExclVat = this.toOptionalAmount(
      api?.invoiceDiscountAmountExclVat,
      this.toOptionalAmount(api?.invoiceDiscountAmountExclVAT, api?.invoiceDiscountAmount)
    );
    const invoiceDiscountPercent = this.toOptionalAmount(api?.invoiceDiscountPercent, api?.invoiceDiscountPercentage);
    const sgst = this.toOptionalAmount(api?.sgst, api?.sgstAmount);
    const cgst = this.toOptionalAmount(api?.cgst, api?.cgstAmount);
    const igst = this.toOptionalAmount(api?.igst, api?.igstAmount);
    const computedAmount = this.calculateInvoiceTotal(netAmount, tradeDiscount, sgst, cgst, igst);
    const totalAmount = this.toAmount(
      api?.totalAmount,
      this.toAmount(api?.totalAmountIncludingTax, this.toAmount(computedAmount, 0))
    );
    const backendBalance = this.toOptionalAmount(api?.remainingAmount, api?.outstandingAmount);
    const paidAmount = this.toOptionalAmount(
      api?.paidAmount,
      backendBalance === undefined ? 0 : Math.max(0, totalAmount - backendBalance)
    );
    const outstandingAmount = backendBalance !== undefined
      ? backendBalance
      : calculateOutstandingAmount(totalAmount, paidAmount, api?.outstandingAmount);
    const paymentStatus = calculatePaymentStatus(
      paidAmount,
      outstandingAmount,
      api?.paymentStatus as PaymentStatus | undefined
    );
    const lines = api?.salesInvoiceLines || api?.SalesInvoiceLines || api?.lines || [];
    const customerAddress = api?.customerAddress ||
      [api?.billToAddressLine1, api?.billToAddressLine2].filter(Boolean).join(', ');

    return {
      id: api?.id || invoiceNumber,
      invoiceNumber,
      customerCode,
      customerName: api?.customerName || api?.sellToCustomerName || '',
      customerAddress,
      customerGSTNo: api?.customerGSTRegistrationNumber || api?.customerGSTNo || api?.customerGstin || api?.customerGSTIN || '',
      customerGSTState: api?.customerGSTState || api?.customerGstState || api?.customerState || api?.billToState || '',
      clientCode: api?.clientCode || api?.billToCustomerNumber || '',
      clientName: api?.clientName || api?.billToCustomerName || '',
      clientAddress: api?.clientAddress || '',
      clientGSTNo: api?.clientGSTNo || api?.clientGstin || api?.clientGSTIN || '',
      clientGSTState: api?.clientGSTState || api?.clientGstState || api?.clientState || '',
      salespersonCode,
      salesPerson: api?.salesPersonName || api?.salespersonName || salespersonCode,
      salesOrderNumber: api?.orderNumber || api?.bookingOrderNumber || api?.bookingOrderNo ||
        api?.salesOrderNumber || api?.salesOrderNo || api?.salesOrderReference || '',
      salesOrderDate: normalizeBusinessDate(api?.bookingOrderDate || api?.salesOrderDate),
      invoiceDate: normalizeBusinessDate(api?.invoiceDate || api?.postingDate),
      dueDate: normalizeBusinessDate(api?.dueDate),
      totalAmount,
      netAmount,
      tradeDiscount,
      invoiceDiscountAmountExclVat,
      invoiceDiscountPercent,
      sgst,
      cgst,
      igst,
      roundOffAmount: this.toOptionalAmount(api?.roundOffAmount, api?.roundOff),
      amountInWords: api?.amountInWords || api?.amountInWordsText || '',
      irn: api?.irn || api?.IRN || '',
      acknowledgementNumber: api?.acknowledgementNumber || api?.ackNo || api?.AckNo || '',
      acknowledgementDate: normalizeBusinessDate(api?.acknowledgementDate || api?.ackDate || api?.AckDate),
      qrCodeData: api?.qrCodeData || api?.qrCode || api?.qrCodeUrl || api?.signedQRCode || '',
      paidAmount,
      outstandingAmount,
      paymentStatus,
      invoiceStatus: api?.invoiceStatus || api?.documentStatus || api?.status || '',
      currencyCode: api?.currencyCode || '',
      lines: lines.map(line => this.mapInvoiceLineApiToUiModel(line, api?.currencyCode)),
      payments: (api?.payments || []).map(payment => this.mapInvoicePaymentApiToUiModel(payment, api?.currencyCode))
    };
  }

  public calculateOutstandingAmount(
    totalAmount: number,
    paidAmount: number | undefined,
    backendOutstanding?: number
  ): number | undefined {
    return calculateOutstandingAmount(totalAmount, paidAmount, backendOutstanding);
  }

  public calculatePaymentStatus(
    _totalAmount: number,
    paidAmount: number | undefined,
    outstandingAmount: number | undefined,
    backendStatus?: PaymentStatus
  ): PaymentStatus {
    return calculatePaymentStatus(paidAmount, outstandingAmount, backendStatus);
  }

  private mapPagedResult(
    api: InvoiceListApiResponse | undefined,
    requestedPageSize: number
  ): IServerPagedResult<IInvoiceListItem> {
    return {
      items: (api?.items || []).map(item => this.mapInvoiceApiToUiModel(item)),
      pageSize: api?.pageSize || requestedPageSize,
      hasNext: Boolean(api?.hasNext),
      nextToken: api?.nextToken
    };
  }

  private mapInvoiceLineApiToUiModel(api: IInvoiceLineItemApiModel, currencyCode?: string): IInvoiceLineItem {
    const quantity = this.toAmount(api.quantity, 0);
    const lineAmount = this.toAmount(api.lineAmount, this.toAmount(api.Amount, 0));
    const lineNumber = api.lineNumber || (typeof api.lineNo === 'number' ? String(api.lineNo) : '');
    return {
      lineNumber,
      lineType: api.type || undefined,
      documentNumber: api.documentNo || undefined,
      itemCode: api.itemCode || api.no || api.itemNo || '',
      hsnCode: api.HSNCode || api.hsnCode || api.hsnSac || api.hsnsac || undefined,
      gstRate: this.toGstRate(api.GSTRate || api.gstRate || api.gstPercent),
      description: api.description || '',
      quantity,
      unitPrice: this.toAmount(api.unitPrice, quantity > 0 ? lineAmount / quantity : 0),
      lineDiscountPercentage: this.toOptionalAmount(
        api.lineDiscountPercentage,
        this.toOptionalAmount(api.lineDiscountPercent, api.lineDiscountPct)
      ),
      lineAmount,
      amountIncludingVAT: this.toOptionalAmount(api.amountIncludingVAT),
      currencyCode: api.currencyCode || currencyCode || ''
    };
  }

  private mapInvoicePaymentApiToUiModel(api: IInvoicePaymentRecordApiModel, currencyCode?: string): IInvoicePaymentRecord {
    return {
      id: api.id || api.referenceNumber || '',
      paymentDate: api.paymentDate,
      referenceNumber: api.referenceNumber || '',
      paymentMode: api.paymentMode || '',
      amount: this.toOptionalAmount(api.amount),
      currencyCode: api.currencyCode || currencyCode || ''
    };
  }

  private toAmount(value: number | undefined, fallback: number): number {
    return this.isValidNumber(value) ? value : fallback;
  }

  private toOptionalAmount(value: number | undefined, fallback?: number): number | undefined {
    return this.isValidNumber(value) ? value : this.isValidNumber(fallback) ? fallback : undefined;
  }

  private isValidNumber(value: number | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }

  private toGstRate(value: string | number | undefined): string | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return `${value}%`;
    }
    return typeof value === 'string' && value ? value : undefined;
  }

  private calculateInvoiceTotal(
    netAmount: number | undefined,
    tradeDiscount: number | undefined,
    sgst: number | undefined,
    cgst: number | undefined,
    igst: number | undefined
  ): number | undefined {
    if (netAmount === undefined && tradeDiscount === undefined && sgst === undefined &&
      cgst === undefined && igst === undefined) {
      return undefined;
    }
    return this.toAmount(netAmount, 0) - this.toAmount(tradeDiscount, 0) +
      this.toAmount(sgst, 0) + this.toAmount(cgst, 0) + this.toAmount(igst, 0);
  }
}
