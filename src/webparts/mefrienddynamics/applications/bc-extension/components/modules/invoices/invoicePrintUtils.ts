import type { IInvoiceLineItem } from '../../../models/invoices';
import {
  enrichLinesWithRequestRemarks,
  type IRequestLineRemarks
} from '../../../utils/requestLineRemarks';

export type IRequestLineRemarksSource = IRequestLineRemarks;

export interface IItemMasterDescriptionSource {
  number?: string;
  description?: string;
}

const normalizeItemCode = (value?: string): string => (value || '').trim().toLowerCase();

const findItemDescription = (
  itemMasters: readonly IItemMasterDescriptionSource[],
  itemCode?: string
): string | undefined => {
  const normalizedCode = normalizeItemCode(itemCode);
  if (!normalizedCode) {
    return undefined;
  }

  return itemMasters.find(item => normalizeItemCode(item.number) === normalizedCode)?.description?.trim() || undefined;
};

export const enrichInvoiceLinesWithRequestRemarks = (
  invoiceLines: readonly IInvoiceLineItem[],
  requestLines: readonly IRequestLineRemarksSource[]
): readonly IInvoiceLineItem[] => enrichLinesWithRequestRemarks(invoiceLines, requestLines);

export const enrichInvoiceLinesForPrint = (
  invoiceLines: readonly IInvoiceLineItem[],
  requestLines: readonly IRequestLineRemarksSource[],
  itemMasters: readonly IItemMasterDescriptionSource[]
): readonly IInvoiceLineItem[] => enrichInvoiceLinesWithRequestRemarks(invoiceLines, requestLines).map(line => ({
  ...line,
  itemDescription: findItemDescription(itemMasters, line.itemCode)
}));

/**
 * Business Central exposes invoice round-off adjustments as G/L Account lines.
 * The invoice endpoint does not include the line type, but these lines are
 * identifiable by their all-numeric account number and absent HSN/GST values.
 *
 * Do not use the amount as part of this check: an adjustment may be either a
 * debit or a credit. The adjustment is intentionally omitted only from the
 * printed item rows; invoice summary values must remain the values supplied by
 * Business Central.
 */
export const isInvoiceAdjustmentLine = (line: IInvoiceLineItem): boolean => {
  const itemCode = (line.itemCode || '').trim();
  const hsnCode = (line.hsnCode || '').trim();
  const gstRate = (line.gstRate || '').trim();

  return /^\d+$/.test(itemCode) && !hsnCode && !gstRate;
};

export const getPrintableInvoiceLines = (
  invoiceLines: readonly IInvoiceLineItem[]
): readonly IInvoiceLineItem[] => invoiceLines.filter(line => !isInvoiceAdjustmentLine(line));

export const getPrintableLineDescription = (line: IInvoiceLineItem): string => {
  const parts = [line.itemCode, line.itemDescription]
    .map(value => (value || '').trim())
    .filter(Boolean);

  if (line.remarks && line.remarks.trim()) {
    parts.push(line.remarks);
  }

  return parts.join(' - ');
};
