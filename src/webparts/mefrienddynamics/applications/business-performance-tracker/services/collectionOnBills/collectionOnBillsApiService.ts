import type { ApiClient } from '../../../../shared/api/apiClient';
import { apiRoutes } from '../../config/apiConfig';

export interface ICollectionOnBillInvoice {
  applicationEntryNo: number;
  invoiceEntryNo: number;
  invoiceNo: string | null;
  invoiceDate: string | null;
  appliedAmount: number;
  branchCode: string | null;
  salespersonCode: string | null;
}

export interface ICollectionOnBillReceipt {
  receiptEntryNo: number;
  receiptNo: string | null;
  receiptDate: string | null;
  customerNo: string | null;
  customerName: string | null;
  totalAmount: number;
  totalAppliedAmount: number;
  invoices: readonly ICollectionOnBillInvoice[];
}

export interface ICollectionOnBillsRequest {
  companyId: string;
  fromDate: string;
  toDate: string;
  customerNo?: string; // Retained for existing callers.
  customerSearch?: string;
  branchCodes?: readonly string[];
  receiptNo?: string;
}

const isValidDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const year = Number(value.substring(0, 4));
  const month = Number(value.substring(5, 7));
  const day = Number(value.substring(8, 10));

  if (year < 1 || year > 9999 || month < 1 || month > 12) {
    return false;
  }

  const daysInMonth = new Date(
    Date.UTC(year, month, 0)
  ).getUTCDate();

  return day >= 1 && day <= daysInMonth;
};

export class CollectionOnBillsApiService {
  public constructor(
    private readonly apiClient: ApiClient
  ) {}

  public async getCollectionOnBills(
    request: ICollectionOnBillsRequest
  ): Promise<readonly ICollectionOnBillReceipt[]> {
    const companyId = request.companyId.trim();
    const fromDate = request.fromDate.trim();
    const toDate = request.toDate.trim();
    const customerNo = request.customerNo?.trim() || '';
    const customerSearch = request.customerSearch?.trim() || '';
    const receiptNo = request.receiptNo?.trim() || '';

    const branchCodes = request.branchCodes;
    if (
      !branchCodes ||
      !Array.isArray(branchCodes) ||
      branchCodes.length === 0 ||
      branchCodes.length > 100 ||
      branchCodes.some(code => typeof code !== 'string' ||
        !code.trim() || code.trim().length > 100)
    ) {
      throw new Error('Select at least one permitted unit.');
    }

    const selectedBranches = Array.from(new Set(
      branchCodes.map(code => code.trim().toUpperCase())
    ));

    if (!companyId) {
      throw new Error('Company ID is required.');
    }

    if (!isValidDate(fromDate) || !isValidDate(toDate)) {
      throw new Error('Select valid From Date and To Date.');
    }

    if (toDate < fromDate) {
      throw new Error(
        'To Date cannot be earlier than From Date.'
      );
    }

    if (customerNo.length > 100 || customerSearch.length > 100 || receiptNo.length > 100) {
      throw new Error(
        'Customer No and Receipt No must not exceed 100 characters.'
      );
    }

    const query = [
      `companyId=${encodeURIComponent(companyId)}`,
      `fromDate=${encodeURIComponent(fromDate)}`,
      `toDate=${encodeURIComponent(toDate)}`
    ];

    if (customerNo) {
      query.push(`customerNo=${encodeURIComponent(customerNo)}`);
    }

    if (customerSearch) {
      query.push(`customerSearch=${encodeURIComponent(customerSearch)}`);
    }

    if (receiptNo) {
      query.push(`receiptNo=${encodeURIComponent(receiptNo)}`);
    }

    for (const code of selectedBranches) {
      query.push(`branchCode=${encodeURIComponent(code)}`);
    }

    const url = `${apiRoutes.collectionOnBills}?${query.join('&')}`;

    const response = await this.apiClient.get<
      ICollectionOnBillReceipt[]
    >(url);

    if (!Array.isArray(response.data)) {
      throw new Error(
        'Collection on Bills API did not return an array.'
      );
    }

    for (const receipt of response.data) {
      if (
        !Number.isSafeInteger(receipt.receiptEntryNo) ||
        typeof receipt.totalAmount !== 'number' ||
        !Number.isFinite(receipt.totalAmount) ||
        typeof receipt.totalAppliedAmount !== 'number' ||
        !Number.isFinite(receipt.totalAppliedAmount) ||
        !Array.isArray(receipt.invoices)
      ) {
        throw new Error(
          'Collection on Bills API returned invalid receipt data.'
        );
      }

      for (const invoice of receipt.invoices) {
        if (
          !Number.isSafeInteger(invoice.applicationEntryNo) ||
          typeof invoice.appliedAmount !== 'number' ||
          !Number.isFinite(invoice.appliedAmount)
        ) {
          throw new Error(
            'Collection on Bills API returned invalid invoice data.'
          );
        }
      }
    }

    return response.data;
  }
}
