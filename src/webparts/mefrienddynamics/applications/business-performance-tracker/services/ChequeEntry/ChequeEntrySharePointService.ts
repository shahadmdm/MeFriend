import { SPHttpClient } from '@microsoft/sp-http';
import type { IChequeEntryPayload, IChequeBill } from '../../components/modules/ChequeEntry/ChequeEntryForm';

/**
 * Persist a cheque and its bill allocations as ONE SharePoint list item.
 * All column names below are SharePoint INTERNAL names.
 * Do not use this class until the list columns have been provisioned.
 */
export interface IChequeEntrySharePointServiceOptions {
  spHttpClient: SPHttpClient;
  webAbsoluteUrl: string;
  listTitle: string;
}

export interface IChequeEntryListItem {
  id: number;
  companyId: string;
  branchId: string;
  entryDate: string;
  chequeNo: string;
  chequeDate: string;
  bank: string;
  amount: number;
  totalAllocated: number;
  unallocated: number;
  billCount: number;
  bills: readonly IChequeBill[];
  billsReadError: boolean;
}

export interface IChequeEntryListResult {
  entries: readonly IChequeEntryListItem[];
  hasMore: boolean;
}

interface ISharePointChequeItem {
  Id?: number;
  CompanyId?: string;
  BranchId?: string;
  EntryDate?: string;
  ChequeNo?: string;
  ChequeDate?: string;
  Bank?: string;
  Amount?: number;
  TotalAllocated?: number;
  Unallocated?: number;
  BillCount?: number;
  BillsJson?: string;
}

interface ISharePointChequePage {
  value?: ISharePointChequeItem[];
  'odata.nextLink'?: string;
  '@odata.nextLink'?: string;
  d?: { results?: ISharePointChequeItem[]; __next?: string };
}

/** Entries share the exact list/columns used by save(). */
export class ChequeEntrySharePointService {
  private readonly spHttpClient: SPHttpClient;
  private readonly webAbsoluteUrl: string;
  private readonly listTitle: string;

  constructor(options: IChequeEntrySharePointServiceOptions) {
    this.spHttpClient = options.spHttpClient;
    this.webAbsoluteUrl = options.webAbsoluteUrl.replace(/\/$/, '');
    this.listTitle = options.listTitle;

    if (!this.webAbsoluteUrl || !this.listTitle.trim()) {
      throw new Error('SharePoint web URL and cheque entry list title are required.');
    }
  }

  private static dateOnly(value: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new Error('Entry Date and Cheque Date must use YYYY-MM-DD.');
    }
    // For date-only SharePoint fields; confirm how this displays in site regional settings.
    return value + 'T12:00:00Z';
  }


  private getItemsUrl(): string {
    const escapedTitle = this.listTitle.replace(/'/g, "''");
    return this.webAbsoluteUrl +
      "/_api/web/lists/getbytitle('" + encodeURIComponent(escapedTitle) + "')/items";
  }

  /**
   * Read the newest 500 entries for ONE selected company, following SharePoint
   * server paging. The hasMore indicator is displayed if the cap is reached.
   * Index CompanyId in SharePoint for lists above the view threshold.
   */
  public async getEntriesForCompany(
    selectedCompanyId: string
  ): Promise<IChequeEntryListResult> {
    const companyId = selectedCompanyId.trim();
    if (!companyId) {
      throw new Error('Select an active company to view cheque entries.');
    }

    const select = [
      'Id', 'CompanyId', 'BranchId', 'EntryDate', 'ChequeNo',
      'ChequeDate', 'Bank', 'Amount', 'TotalAllocated',
      'Unallocated', 'BillCount', 'BillsJson'
    ].join(',');
    const escapedCompany = companyId.replace(/'/g, "''");
    const filter = encodeURIComponent("CompanyId eq '" + escapedCompany + "'");
    let url: string | undefined = this.getItemsUrl() +
      '?$select=' + select + '&$filter=' + filter +
      '&$orderby=Id%20desc&$top=100';

    const rows: IChequeEntryListItem[] = [];
    const visited = new Set<string>();
    const maximumEntries = 500;

    while (url && rows.length < maximumEntries) {
      // Never follow a nextLink outside the configured SharePoint site.
      if (url.indexOf(this.webAbsoluteUrl + '/_api/') !== 0 || visited.has(url)) {
        throw new Error('SharePoint returned an invalid cheque-entry paging link.');
      }
      visited.add(url);

      const response = await this.spHttpClient.get(
        url,
        SPHttpClient.configurations.v1,
        { headers: { Accept: 'application/json;odata=nometadata' } }
      );
      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(
          'Unable to load cheque entries (HTTP ' + response.status + '): ' +
          (responseText || response.statusText).slice(0, 800)
        );
      }

      const result = await response.json() as ISharePointChequePage;
      const items: ISharePointChequeItem[] = result.value ||
        (result.d && result.d.results) || [];

      items.forEach(item => {
        // Defence in depth: reject rows for another company even if
        // SharePoint returns an unexpectedly broad result.
        if ((item.CompanyId || '').trim().toLowerCase() !== companyId.toLowerCase()) {
          return;
        }
        let bills: readonly IChequeBill[] = [];
        let billsReadError = false;
        try {
          const decoded: unknown = JSON.parse(item.BillsJson || '[]');
          if (!Array.isArray(decoded)) {
            billsReadError = true;
          } else {
            bills = decoded.filter((bill: IChequeBill) =>
              bill && typeof bill.billNo === 'string' &&
              typeof bill.billAmount === 'number' &&
              typeof bill.balance === 'number' &&
              typeof bill.amount === 'number'
            );
            billsReadError = bills.length !== decoded.length;
          }
        } catch {
          billsReadError = true;
        }
        rows.push({
          id: Number(item.Id || 0),
          companyId: item.CompanyId || '',
          branchId: item.BranchId || '',
          entryDate: item.EntryDate || '',
          chequeNo: item.ChequeNo || '',
          chequeDate: item.ChequeDate || '',
          bank: item.Bank || '',
          amount: Number(item.Amount || 0),
          totalAllocated: Number(item.TotalAllocated || 0),
          unallocated: Number(item.Unallocated || 0),
          billCount: Number(item.BillCount || 0),
          bills,
          billsReadError
        });
      });

      url = result['odata.nextLink'] || result['@odata.nextLink'] ||
        (result.d && result.d.__next) || undefined;
    }

    return {
      entries: rows.slice(0, maximumEntries),
      hasMore: Boolean(url) || rows.length > maximumEntries
    };
  }

  public async save(
    entry: IChequeEntryPayload,
    selectedCompanyId: string
  ): Promise<number> {
    if (!selectedCompanyId || !selectedCompanyId.trim()) {
      throw new Error('Select an active company before saving a cheque.');
    }
    if (!entry.branchId || !entry.chequeNo || !entry.bank ||
        !Number.isFinite(entry.amount) || entry.amount <= 0 ||
        !entry.bills || entry.bills.length === 0) {
      throw new Error('Cheque details and at least one bill assignment are required.');
    }

    const allocated = Math.round(entry.bills.reduce((sum, bill) => {
      if (!bill.billNo || !Number.isFinite(bill.billAmount) || bill.billAmount <= 0 ||
          !Number.isFinite(bill.balance) || bill.balance < 0 ||
          !Number.isFinite(bill.amount) || bill.amount <= 0 ||
          bill.amount > bill.balance + 0.001 ||
          bill.balance > bill.billAmount + 0.001) {
        throw new Error('Invalid bill assignment. Verify amounts and balances.');
      }
      return sum + bill.amount;
    }, 0) * 100) / 100;

    if (allocated > entry.amount + 0.001) {
      throw new Error('Total assigned bill amount exceeds the cheque amount.');
    }

    const billsJson = JSON.stringify(entry.bills);
    if (billsJson.length > 60000) {
      throw new Error('Too many bill assignments for a single SharePoint list item.');
    }

    const body = {
      Title: entry.chequeNo.trim(),
      CompanyId: selectedCompanyId.trim(),
      BranchId: entry.branchId.trim(),
      EntryDate: ChequeEntrySharePointService.dateOnly(entry.entryDate),
      ChequeNo: entry.chequeNo.trim(),
      ChequeDate: ChequeEntrySharePointService.dateOnly(entry.chequeDate),
      Bank: entry.bank.trim(),
      Amount: entry.amount,
      BillsJson: billsJson,
      TotalAllocated: allocated,
      Unallocated: Math.round((entry.amount - allocated) * 100) / 100,
      BillCount: entry.bills.length
    };

    const url = this.getItemsUrl();

    const response = await this.spHttpClient.post(
      url,
      SPHttpClient.configurations.v1,
      {
        headers: {
          Accept: 'application/json;odata=nometadata',
          'Content-Type': 'application/json;odata=nometadata'
        },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(
        'SharePoint save failed (HTTP ' + response.status + '): ' +
        (responseText || response.statusText).slice(0, 800)
      );
    }

    const result: { Id?: number; ID?: number } = await response.json();
    const itemId = result.Id || result.ID;
    if (!itemId) {
      throw new Error('SharePoint returned no item ID. Check the list for the entry before retrying.');
    }
    return itemId;
  }
}
