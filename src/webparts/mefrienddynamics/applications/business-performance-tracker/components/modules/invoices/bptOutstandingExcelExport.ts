import type { IInvoiceFilters, IInvoiceListItem } from '../../../../bc-extension/models/invoices';
import { normalizeBusinessDate } from '../../../../../shared/utilities/formatUtils';

/**
 * BPT Excel export: ONE worksheet (Filtered Invoices) only.
 * Retains the existing API used by BptInvoicesPage and does not require xlsx.
 */
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

type CellValue = string | number | Date | undefined;
interface ISheetDefinition {
  name: string;
  rows: readonly (readonly CellValue[])[];
  widths: readonly number[];
  headerRow?: number;
  moneyColumns?: readonly number[];
  dateColumns?: readonly number[];
  dateTimeColumns?: readonly number[];
  moneyRows?: readonly number[];
  totalRow?: number;
  filter?: boolean;
}
interface IZipEntry { name: string; contents: string; }

const safeAmount = (value?: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const escapeXml = (text: string): string => text
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

// XML 1.0 supports tab, newline and CR, but disallows most other control chars.
const cleanXml = (text: string): string => Array.from(text).filter(char => {
  const code = char.charCodeAt(0);
  return code === 9 || code === 10 || code === 13 || code >= 32;
}).join('');

const xmlText = (text: string): string => escapeXml(cleanXml(text));

const columnName = (index: number): string => {
  let result = '';
  let number = index + 1;
  while (number > 0) {
    number -= 1;
    result = String.fromCharCode(65 + (number % 26)) + result;
    number = Math.floor(number / 26);
  }
  return result;
};

const dateSerial = (value: Date): number =>
  (Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) -
    Date.UTC(1899, 11, 30)) / 86400000 +
  (value.getHours() * 3600 + value.getMinutes() * 60 + value.getSeconds()) / 86400;

const safeExcelDate = (value?: string): Date | undefined => {
  const normalized = normalizeBusinessDate(value);
  if (!normalized) {
    return undefined;
  }
  const parts = normalized.split('-').map(Number);
  if (parts.length !== 3 || parts.some(part => !Number.isInteger(part))) {
    return undefined;
  }
  const [year, month, day] = parts;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return undefined;
  }
  return d;
};

const cellXml = (value: CellValue, reference: string, style: number): string => {
  if (value === undefined || value === null) {
    return '';
  }
  if (value instanceof Date) {
    return Number.isFinite(value.getTime())
      ? `<c r="${reference}" s="${style}"><v>${dateSerial(value)}</v></c>` : '';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? `<c r="${reference}" s="${style}"><v>${value}</v></c>` : '';
  }
  // Explicit inlineStr: even strings beginning with =, +, - or @ cannot be formulas.
  return `<c r="${reference}" t="inlineStr" s="${style}">` +
    `<is><t xml:space="preserve">${xmlText(value)}</t></is></c>`;
};

const sheetXml = (sheet: ISheetDefinition): string => {
  const lastColumn = sheet.rows.reduce((largest, row) => Math.max(largest, row.length),
    Math.max(1, sheet.widths.length));
  const lastRow = Math.max(1, sheet.rows.length);
  const headerRow = sheet.headerRow;
  const rows: string[] = sheet.rows.map((cells, index) => {
    const rowNumber = index + 1;
    const values = cells.map((value, column) => {
      let style = headerRow === rowNumber ? 1 : rowNumber === sheet.totalRow ? 5 : 0;
      if (value instanceof Date) {
        style = (sheet.dateTimeColumns || []).indexOf(column) !== -1 ? 4 : 3;
      } else if (typeof value === 'number' &&
          ((sheet.moneyColumns || []).indexOf(column) !== -1 ||
           ((sheet.moneyRows || []).indexOf(rowNumber) !== -1 && column === 1))) {
        style = rowNumber === sheet.totalRow ? 6 : 2;
      }
      return cellXml(value, `${columnName(column)}${rowNumber}`, style);
    }).join('');
    // Give the purple column header enough height for Excel's filter arrows and long labels.
    // Also emphasize the final GRAND TOTAL row without changing row positions.
    const height = rowNumber === headerRow ? ' ht="34" customHeight="1"'
      : rowNumber === sheet.totalRow ? ' ht="28" customHeight="1"' : '';
    return `<row r="${rowNumber}"${height}>${values}</row>`;
  });
  const widths = sheet.widths.map((width, index) =>
    `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`
  ).join('');
  const filter = sheet.filter && headerRow
    ? `<autoFilter ref="A${headerRow}:${columnName(lastColumn - 1)}${Math.max(headerRow, sheet.totalRow ? sheet.totalRow - 1 : lastRow)}"/>`
    : '';
  const freeze = headerRow
    ? `<pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<dimension ref="A1:${columnName(lastColumn - 1)}${lastRow}"/>` +
    `<sheetViews><sheetView workbookViewId="0">${freeze}</sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="20"/>` +
    `<cols>${widths}</cols><sheetData>${rows.join('')}</sheetData>${filter}` +
    // A clear printed page header; this doesn't shift table cells or create extra sheets.
    `<headerFooter><oddHeader>&amp;C&amp;BFiltered Invoice Report</oddHeader>` +
    `<oddFooter>&amp;CPage &amp;P of &amp;N</oddFooter></headerFooter></worksheet>`;
};

// Excel requires the two built-in fills first: none (fillId=0) and gray125
// (fillId=1). Without gray125, Excel can display the intended solid purple
// header as a dotted/patterned fill, hiding its white heading text.
// Custom purple and lavender fills are therefore fillId=2 and fillId=3.
const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<numFmts count="3">` +
  `<numFmt numFmtId="164" formatCode="#,##0.00"/>` +
  `<numFmt numFmtId="165" formatCode="dd/mm/yyyy"/>` +
  `<numFmt numFmtId="166" formatCode="dd/mm/yyyy hh:mm"/>` +
  `</numFmts>` +
  `<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="11"/><color rgb="FF2B1B56"/><name val="Calibri"/></font></fonts>` +
  `<fills count="4"><fill><patternFill patternType="none"/></fill>` +
  `<fill><patternFill patternType="gray125"/></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FF3E1988"/>` +
  `<bgColor indexed="64"/></patternFill></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFEDE6FF"/>` +
  `<bgColor indexed="64"/></patternFill></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="7">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" ` +
  `applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" ` +
  `wrapText="1"/></xf>` +
  `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>` +
  `<xf numFmtId="164" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1"/>` +
  `</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);
const crcTable: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let i = 0; i < 8; i++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table.push(c >>> 0);
  }
  return table;
})();

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
};
const concatBytes = (parts: readonly Uint8Array[]): Uint8Array => {
  const totalSize = parts.reduce((total, part) => total + part.length, 0);
  const merged = new Uint8Array(totalSize);
  let offset = 0;
  parts.forEach(part => { merged.set(part, offset); offset += part.length; });
  return merged;
};

// ZIP stored mode (no compression). Excel supports this and no npm dependency is needed.
const storedZip = (entries: readonly IZipEntry[]): Uint8Array => {
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let localOffset = 0;
  entries.forEach(entry => {
    const name = utf8(entry.name);
    const data = utf8(entry.contents);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034B50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    locals.push(local, data);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014B50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, localOffset, true);
    central.set(name, 46);
    centrals.push(central);
    localOffset += local.length + data.length;
  });
  const size = centrals.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054B50, true);
  view.setUint16(8, entries.length, true);
  view.setUint16(10, entries.length, true);
  view.setUint32(12, size, true);
  view.setUint32(16, localOffset, true);
  return concatBytes([...locals, ...centrals, end]);
};

export const buildOutstandingSalespersonSummaries = (
  invoices: readonly IInvoiceListItem[],
  salespersonNames: ReadonlyMap<string, string> = new Map<string, string>()
): readonly IOutstandingSalespersonSummary[] => {
  const summaries = new Map<string, IOutstandingSalespersonSummary>();
  invoices.forEach(invoice => {
    const salespersonCode = (invoice.salespersonCode || '').trim() || 'Unassigned';
    const key = salespersonCode.toUpperCase();
    const rowName = (invoice.salesPerson || '').trim();
    const name = salespersonNames.get(key) ||
      (rowName && rowName.toUpperCase() !== key ? rowName : undefined);
    const existing = summaries.get(key) || {
      salespersonCode,
      salespersonName: name,
      outstandingAmount: 0,
      outstandingInvoiceCount: 0
    };
    if (!existing.salespersonName && name) {
      existing.salespersonName = name;
    }
    existing.outstandingInvoiceCount += 1;
    existing.outstandingAmount += safeAmount(invoice.outstandingAmount);
    summaries.set(key, existing);
  });
  return Array.from(summaries.values()).sort((a, b) =>
    b.outstandingAmount - a.outstandingAmount || a.salespersonCode.localeCompare(b.salespersonCode)
  );
};

const reportFileName = (filters: IInvoiceFilters): string => {
  const from = normalizeBusinessDate(filters.invoiceDateFrom) || 'all-dates';
  const to = normalizeBusinessDate(filters.invoiceDateTo) || 'all-dates';
  const salesperson = filters.salespersonCode || 'business';
  const fileName = `Filtered_Invoices_${salesperson}_${from}_to_${to}`;
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') + '.xlsx';
};

const sheetDefinitions = (data: IOutstandingReportExportData): readonly ISheetDefinition[] => {
  const names = new Map<string, string>();
  data.salespersonSummaries.forEach(summary => {
    if (summary.salespersonName) {
      names.set(summary.salespersonCode.trim().toUpperCase(), summary.salespersonName);
    }
  });
  const invoiceRows: CellValue[][] = [
    ['Invoice Number', 'Invoice Date', 'Customer', 'Customer Code', 'Salesperson Code',
      'Salesperson Name', 'Invoice Amount', 'Outstanding Amount', 'Payment Status'],
    ...data.invoices.map(invoice => {
      const code = (invoice.salespersonCode || '').trim();
      return [
        invoice.invoiceNumber || '',
        safeExcelDate(invoice.invoiceDate),
        invoice.customerName || '',
        invoice.customerCode || '',
        code,
        names.get(code.toUpperCase()) || invoice.salesPerson || code,
        invoice.totalAmount,
        invoice.outstandingAmount,
        invoice.paymentStatus || ''
      ];
    })
  ];
  // Sum every exported filtered invoice, not just the current table page.
  // Accumulating in paise avoids floating-point rounding artefacts.
  const invoiceAmountTotal = data.invoices.reduce((sum, invoice) =>
    sum + Math.round(safeAmount(invoice.totalAmount) * 100), 0) / 100;
  const outstandingAmountTotal = data.invoices.reduce((sum, invoice) =>
    sum + Math.round(safeAmount(invoice.outstandingAmount) * 100), 0) / 100;

  invoiceRows.push([
    `GRAND TOTAL (${data.invoices.length} invoices)`, '', '', '', '', '',
    invoiceAmountTotal, outstandingAmountTotal, ''
  ]);

  return [
    {
      name: 'Filtered Invoices',
      rows: invoiceRows,
      widths: [21, 16, 36, 20, 23, 34, 21, 25, 20],
      headerRow: 1,
      dateColumns: [1],
      moneyColumns: [6, 7],
      totalRow: invoiceRows.length,
      filter: true
    }
  ];
};

export const exportOutstandingReportToExcel = (data: IOutstandingReportExportData): void => {
  const sheets = sheetDefinitions(data);
  const types = sheets.map((_, index) =>
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ` +
    `ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join('');
  const sheetRefs = sheets.map((sheet, index) =>
    `<sheet name="${xmlText(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
  ).join('');
  const relationships = sheets.map((_, index) =>
    `<Relationship Id="rId${index + 1}" ` +
    `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" ` +
    `Target="worksheets/sheet${index + 1}.xml"/>`
  ).join('');
  const files: IZipEntry[] = [
    {
      name: '[Content_Types].xml',
      contents: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        types + `</Types>`
    },
    {
      name: '_rels/.rels',
      contents: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`
    },
    {
      name: 'xl/workbook.xml',
      contents: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
        `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<sheets>${sheetRefs}</sheets></workbook>`
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      contents: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        relationships +
        `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        `</Relationships>`
    },
    { name: 'xl/styles.xml', contents: stylesXml },
    ...sheets.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, contents: sheetXml(sheet) }))
  ];
  const bytes = storedZip(files);
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = reportFileName(data.filters);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
};

/** Stable API used by BptInvoicesPage, including salesperson lookup names. */
export const exportBptOutstandingToExcel = (options: IBptOutstandingExportOptions): void => {
  exportOutstandingReportToExcel({
    filters: options.filters || {},
    invoices: options.invoices,
    salespersonSummaries: buildOutstandingSalespersonSummaries(options.invoices, options.salespersonNames),
    totalOutstandingAmount: options.totalOutstandingAmount
  });
};
