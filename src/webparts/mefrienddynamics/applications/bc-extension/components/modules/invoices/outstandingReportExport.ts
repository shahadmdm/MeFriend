import * as XLSX from 'xlsx';
import type { IInvoiceFilters, IInvoiceListItem } from '../../../models/invoices';
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

const moneyFormat = '#,##0.00';

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
  return new Date(year, month - 1, day);
};

const getReportDateLabel = (value?: string): string => normalizeBusinessDate(value) || 'All dates';

const sanitizeFileName = (value: string): string => value
  .replace(/[^a-zA-Z0-9._-]+/g, '-')
  .replace(/^-+|-+$/g, '');

const getReportFileName = (filters: IInvoiceFilters): string => {
  const fromDate = getReportDateLabel(filters.invoiceDateFrom).replace('All dates', 'all-dates');
  const toDate = getReportDateLabel(filters.invoiceDateTo).replace('All dates', 'all-dates');
  const salesperson = filters.salespersonCode?.trim() || 'business';

  return sanitizeFileName(`Outstanding_Report_${salesperson}_${fromDate}_to_${toDate}`) + '.xlsx';
};

const setColumnWidths = (sheet: XLSX.WorkSheet, widths: readonly number[]): void => {
  sheet['!cols'] = widths.map(width => ({ wch: width }));
};

const setNumberFormat = (sheet: XLSX.WorkSheet, cells: readonly string[], format: string): void => {
  cells.forEach(cellAddress => {
    const cell = sheet[cellAddress];
    if (cell) {
      cell.z = format;
    }
  });
};

export const buildOutstandingSalespersonSummaries = (
  invoices: readonly IInvoiceListItem[],
  salespersonNames: ReadonlyMap<string, string>
): readonly IOutstandingSalespersonSummary[] => {
  const summaries = new Map<string, IOutstandingSalespersonSummary>();

  invoices.forEach(invoice => {
    const salespersonCode = (invoice.salesperson || '').trim() || 'Unassigned';
    const normalizedCode = salespersonCode.toUpperCase();
    const existing = summaries.get(normalizedCode) || {
      salespersonCode,
      salespersonName: salespersonNames.get(normalizedCode),
      outstandingAmount: 0,
      outstandingInvoiceCount: 0
    };

    existing.outstandingInvoiceCount += 1;
    if (typeof invoice.remainingAmount === 'number' && Number.isFinite(invoice.remainingAmount)) {
      existing.outstandingAmount += invoice.remainingAmount;
    }

    summaries.set(normalizedCode, existing);
  });

  return Array.from(summaries.values()).sort((left, right) =>
    right.outstandingAmount - left.outstandingAmount || left.salespersonCode.localeCompare(right.salespersonCode)
  );
};

export const exportOutstandingReportToExcel = (data: IOutstandingReportExportData): void => {
  const workbook = XLSX.utils.book_new();
  const summaryRows: (string | number | Date)[][] = [
    ['Outstanding Report'],
    ['Generated On', new Date()],
    ['Invoice Date From', getReportDateLabel(data.filters.invoiceDateFrom)],
    ['Invoice Date To', getReportDateLabel(data.filters.invoiceDateTo)],
    ['Salesperson Filter', toSafeSpreadsheetText(data.filters.salespersonCode) || 'All salespersons'],
    ['Outstanding Invoice Count', data.invoices.length],
    ['Business Outstanding Total', data.totalOutstandingAmount]
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  setColumnWidths(summarySheet, [28, 24]);
  setNumberFormat(summarySheet, ['B2'], 'dd/mm/yyyy hh:mm');
  setNumberFormat(summarySheet, ['B7'], moneyFormat);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  const salespersonRows: (string | number)[][] = [
    ['Salesperson Code', 'Salesperson Name', 'Outstanding Invoice Count', 'Outstanding Amount'],
    ...data.salespersonSummaries.map(summary => [
      toSafeSpreadsheetText(summary.salespersonCode),
      toSafeSpreadsheetText(summary.salespersonName),
      summary.outstandingInvoiceCount,
      summary.outstandingAmount
    ])
  ];
  const salespersonSheet = XLSX.utils.aoa_to_sheet(salespersonRows);
  setColumnWidths(salespersonSheet, [20, 32, 27, 22]);
  data.salespersonSummaries.forEach((_, index) => {
    setNumberFormat(salespersonSheet, [`D${index + 2}`], moneyFormat);
  });
  XLSX.utils.book_append_sheet(workbook, salespersonSheet, 'Salesperson Summary');

  const invoiceRows: (string | number | Date | undefined)[][] = [
    ['Invoice Number', 'Invoice Date', 'Customer', 'Customer Code', 'Salesperson Code', 'Salesperson Name', 'Invoice Amount', 'Outstanding Amount', 'Payment Status'],
    ...data.invoices.map(invoice => [
      toSafeSpreadsheetText(invoice.number),
      toExcelDate(invoice.invoiceDate),
      toSafeSpreadsheetText(invoice.customerName),
      toSafeSpreadsheetText(invoice.customerNumber),
      toSafeSpreadsheetText(invoice.salesperson),
      toSafeSpreadsheetText(invoice.salespersonName),
      invoice.totalAmountIncludingTax,
      invoice.remainingAmount,
      toSafeSpreadsheetText(invoice.paymentStatus)
    ])
  ];
  const invoicesSheet = XLSX.utils.aoa_to_sheet(invoiceRows);
  setColumnWidths(invoicesSheet, [20, 14, 32, 18, 20, 32, 20, 22, 20]);
  data.invoices.forEach((_, index) => {
    const rowNumber = index + 2;
    setNumberFormat(invoicesSheet, [`B${rowNumber}`], 'dd/mm/yyyy');
    setNumberFormat(invoicesSheet, [`G${rowNumber}`, `H${rowNumber}`], moneyFormat);
  });
  XLSX.utils.book_append_sheet(workbook, invoicesSheet, 'Outstanding Invoices');

  XLSX.writeFile(workbook, getReportFileName(data.filters), {
    bookType: 'xlsx',
    compression: true
  });
};
