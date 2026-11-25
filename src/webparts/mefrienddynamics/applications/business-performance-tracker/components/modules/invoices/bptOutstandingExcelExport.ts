import * as XLSX from 'xlsx';
import type { IInvoiceFilters, IInvoiceListItem } from '../../../../bc-extension/models/invoices';
import { normalizeBusinessDate } from '../../../../../shared/utilities/formatUtils';

export interface IOutstandingSalespersonSummary {
  salespersonCode: string;
  salespersonName?: string;
  outstandingAmount: number;
  outstandingInvoiceCount: number;
}

export interface IOutstandingReportExportData {
  filters: IInvoiceFilters;
  invoices: readonly IInvoiceListItem[];
  salespersonSummaries: readonly IOutstandingSalespersonSummary[];
  totalOutstandingAmount: number;
}

export interface IBptOutstandingExportOptions {
  invoices: readonly IInvoiceListItem[];
  totalOutstandingAmount: number;
  salespersonCount?: number;
  scopeLabel?: string;
  filters?: IInvoiceFilters;
  salespersonNames?: ReadonlyMap<string, string>;
}

const moneyFormat = '#,##0.00';

const safeAmount = (value?: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const toSafeSpreadsheetText = (value?: string): string => {
  const text = (value || '').trim();
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
};

const toExcelDate = (value?: string): Date | undefined => {
  const normalizedDate = normalizeBusinessDate(value);
  if (!normalizedDate) {
    return undefined;
  }
  const [year, month, day] = normalizedDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 &&
    date.getDate() === day ? date : undefined;
};

const getReportDateLabel = (value?: string): string =>
  normalizeBusinessDate(value) || 'All dates';

const sanitizeFileName = (value: string): string => value
  .replace(/[^a-zA-Z0-9._-]+/g, '-')
  .replace(/^-+|-+$/g, '');

const getReportFileName = (filters: IInvoiceFilters): string => {
  const fromDate = getReportDateLabel(filters.invoiceDateFrom).replace('All dates', 'all-dates');
  const toDate = getReportDateLabel(filters.invoiceDateTo).replace('All dates', 'all-dates');
  const salesperson = filters.salespersonCode?.trim() || 'business';
  return sanitizeFileName(`Filtered_Invoices_${salesperson}_${fromDate}_to_${toDate}`) + '.xlsx';
};

const setColumnWidths = (sheet: XLSX.WorkSheet, widths: readonly number[]): void => {
  sheet['!cols'] = widths.map((width: number) => ({ wch: width }));
};

const setNumberFormat = (sheet: XLSX.WorkSheet, cells: readonly string[], format: string): void => {
  cells.forEach((cellAddress: string) => {
    const cell = sheet[cellAddress];
    if (cell) {
      cell.z = format;
    }
  });
};

export const buildOutstandingSalespersonSummaries = (
  invoices: readonly IInvoiceListItem[],
  salespersonNames: ReadonlyMap<string, string> = new Map<string, string>()
): readonly IOutstandingSalespersonSummary[] => {
  const summaries = new Map<string, IOutstandingSalespersonSummary>();
  invoices.forEach((invoice: IInvoiceListItem) => {
    const salespersonCode = (invoice.salesperson || '').trim() || 'Unassigned';
    const normalizedCode = salespersonCode.toUpperCase();
    const name = salespersonNames.get(normalizedCode) || invoice.salespersonName;
    const existing = summaries.get(normalizedCode) || {
      salespersonCode,
      salespersonName: name,
      outstandingAmount: 0,
      outstandingInvoiceCount: 0
    };
    if (!existing.salespersonName && name) {
      existing.salespersonName = name;
    }
    existing.outstandingInvoiceCount += 1;
    existing.outstandingAmount += safeAmount(invoice.remainingAmount);
    summaries.set(normalizedCode, existing);
  });
  return Array.from(summaries.values()).sort((left, right) =>
    right.outstandingAmount - left.outstandingAmount || left.salespersonCode.localeCompare(right.salespersonCode)
  );
};

export const exportOutstandingReportToExcel = (data: IOutstandingReportExportData): void => {
  const workbook = XLSX.utils.book_new();
  const names = new Map<string, string>();
  data.salespersonSummaries.forEach((summary: IOutstandingSalespersonSummary) => {
    if (summary.salespersonName) {
      names.set(summary.salespersonCode.trim().toUpperCase(), summary.salespersonName);
    }
  });

  const invoiceRows: (string | number | Date | undefined)[][] = [
    ['Invoice Number', 'Invoice Date', 'Customer', 'Customer Code', 'Salesperson Code',
      'Salesperson Name', 'Invoice Amount', 'Outstanding Amount', 'Payment Status'],
    ...data.invoices.map((invoice: IInvoiceListItem) => {
      const code = (invoice.salesperson || '').trim();
      return [
        toSafeSpreadsheetText(invoice.number),
        toExcelDate(invoice.invoiceDate),
        toSafeSpreadsheetText(invoice.customerName),
        toSafeSpreadsheetText(invoice.customerNumber),
        toSafeSpreadsheetText(code),
        toSafeSpreadsheetText(names.get(code.toUpperCase()) || invoice.salespersonName || code),
        invoice.totalAmountIncludingTax,
        invoice.remainingAmount,
        toSafeSpreadsheetText(invoice.paymentStatus)
      ];
    })
  ];

  const invoiceAmountTotal = data.invoices.reduce((sum: number, invoice: IInvoiceListItem) =>
    sum + Math.round(safeAmount(invoice.totalAmountIncludingTax) * 100), 0) / 100;
  const outstandingAmountTotal = data.invoices.reduce((sum: number, invoice: IInvoiceListItem) =>
    sum + Math.round(safeAmount(invoice.remainingAmount) * 100), 0) / 100;

  invoiceRows.push([
    `GRAND TOTAL (${data.invoices.length} invoices)`, '', '', '', '', '',
    invoiceAmountTotal, outstandingAmountTotal, ''
  ]);

  const invoicesSheet = XLSX.utils.aoa_to_sheet(invoiceRows);
  setColumnWidths(invoicesSheet, [21, 16, 36, 20, 23, 34, 21, 25, 20]);
  data.invoices.forEach((_invoice: IInvoiceListItem, index: number) => {
    const rowNumber = index + 2;
    setNumberFormat(invoicesSheet, [`B${rowNumber}`], 'dd/mm/yyyy');
    setNumberFormat(invoicesSheet, [`G${rowNumber}`, `H${rowNumber}`], moneyFormat);
  });
  const totalRow = invoiceRows.length;
  setNumberFormat(invoicesSheet, [`G${totalRow}`, `H${totalRow}`], moneyFormat);
  invoicesSheet['!autofilter'] = { ref: `A1:I${totalRow - 1}` };
  XLSX.utils.book_append_sheet(workbook, invoicesSheet, 'Filtered Invoices');

  XLSX.writeFile(workbook, getReportFileName(data.filters), {
    bookType: 'xlsx',
    compression: true
  });
};

/** Stable API used by BptInvoicesPage. */
export const exportBptOutstandingToExcel = (options: IBptOutstandingExportOptions): void => {
  exportOutstandingReportToExcel({
    filters: options.filters || {},
    invoices: options.invoices,
    salespersonSummaries: buildOutstandingSalespersonSummaries(options.invoices, options.salespersonNames),
    totalOutstandingAmount: options.totalOutstandingAmount
  });
};
