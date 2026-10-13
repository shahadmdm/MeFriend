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

export const getPrintableLineDescription = (line: IInvoiceLineItem): string => {
  const parts = [line.itemCode, line.itemDescription]
    .map(value => (value || '').trim())
    .filter(Boolean);

  if (line.remarks && line.remarks.trim()) {
    parts.push(line.remarks);
  }

  return parts.join(' - ');
};
