import * as React from 'react';
import * as ReactDOM from 'react-dom';

// BPT's invoice listing uses the original BC Extension EntityDashboard layout.
// Only the InvoiceService class is owned by BPT; all invoice UI helpers/models remain shared.

import { invoicesModuleConfig } from '../../../config/modules/invoicesModuleConfig';

import type { ISortState, SortDirection } from '../../../../../shared/models/ISortState';
import type { IServerPagedResult } from '../../../../../shared/models/IServerPagination';

import { useCursorPagination } from '../../../../../shared/hooks/useCursorPagination';

import type { IInvoiceDetail, IInvoiceFilters, IInvoiceListItem } from '../../../../bc-extension/models/invoices';

import type { IAppUser } from '../../../../bc-extension/models/settings/IAppAccessModels';

import type { BcCompany } from '../../../../bc-extension/config/bcCompanies';

import { getUserFriendlyError, normalizeError } from '../../../../../shared/api/apiErrorHandler';

import type { IOutstandingInvoiceReport, InvoiceService } from '../../../services/invoices/invoiceService';

import type { SalespersonService } from '../../../../bc-extension/services/salespersons/salespersonService';

import { useSalespersonFilter } from '../../../../bc-extension/hooks/useSalespersonFilter';

import { buildInvoiceDetailPath, requireInvoiceNumber } from '../../../../bc-extension/utils/invoiceReference';

import { EntityDashboard } from '../../../../../shared/components/dashboard/EntityDashboard';

import type { EntityFilterValues, FilterValue } from '../../../../../shared/components/filters/EntityFilters';

import { useToast } from '../../../../../shared/components/toast/useToast';

import { exportBptOutstandingToExcel } from './bptOutstandingExcelExport';

// Use the same filter conversion and active-filter detection as BC Extension InvoicePage.
import { hasUserInvoiceFilters, toInvoiceFilters } from './invoiceFilterUtils';

import {

  downloadInvoicePdf,

  openInvoicePrintPreviewWindow,

  printInvoice,

  writeInvoicePrintError,

  writeInvoicePrintPreview

} from '../../../../bc-extension/components/modules/invoices/invoicePrintTemplate';

export interface IBptInvoicesPageProps {

  currentUser?: IAppUser;

  invoiceService: InvoiceService;

  salespersonService: SalespersonService;

  onNavigate: (path: string) => void;

  selectedCompany: BcCompany;

}

interface IInvoiceDocumentAction {

  type: 'download' | 'print';

}

interface IOutstandingReportState {
  report?: IOutstandingInvoiceReport;
  loading: boolean;
  error?: string;
}

const currencyFormatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });


/** A display-only invoice row used as the last row of the BPT table. */
const GRAND_TOTAL_ROW_ID = '__BPT_ALL_FILTERED_INVOICE_TOTAL__';
const isGrandTotalRow = (invoice: IInvoiceListItem): boolean =>
  invoice.id === GRAND_TOTAL_ROW_ID && invoice.invoiceNumber === GRAND_TOTAL_ROW_ID;

interface IInvoiceGrandTotals {
  invoiceCount: number;
  invoiceAmount: number;
  outstandingAmount: number;
}

interface IInvoiceGrandTotalsState {
  loading: boolean;
  totals?: IInvoiceGrandTotals;
  error?: string;
  scannedCount?: number;
}

/**
 * Fetch all matching invoices from the EXISTING /api/SalesInvoices listing.
 * No totals endpoint is called. Cursor pagination is required for an exact sum.
 * When any user-selected filter is applied, the same traversal also collects
 * the matching records for Excel export (no second scan).
 */
interface IGrandTotalsReadResult {
  totals: IInvoiceGrandTotals;
  outstandingReport?: IOutstandingInvoiceReport;
}

const getGrandTotalsAcrossAllPages = async (
  invoiceService: InvoiceService,
  filters: IInvoiceFilters,
  currentUser?: IAppUser,
  collectOutstandingInvoices: boolean = false,
  onProgress?: (count: number) => void
): Promise<IGrandTotalsReadResult> => {
  const totals: IInvoiceGrandTotals = {
    invoiceCount: 0,
    invoiceAmount: 0,
    outstandingAmount: 0
  };
  const outstandingInvoices: IInvoiceListItem[] = [];
  const visitedTokens = new Set<string>();
  let continuationToken: string | undefined;
  // Try larger batches; fall back to 100 if the API rejects the request size.
  let pageSize = 250;

  do {
    let page: IServerPagedResult<IInvoiceListItem> | undefined;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        page = await invoiceService.getInvoices(
          filters,
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
        break;
      } catch (pageError) {
        const status = normalizeError(pageError).status;
        if (pageSize > 100 && !continuationToken &&
          (status === 400 || status === 413 || status === 422)) {
          pageSize = 100;
          continue;
        }
        if (attempt < 2 && (status === 429 || status === 500 || status === 502 ||
          status === 503 || status === 504)) {
          await new Promise<void>(resolve => setTimeout(resolve, 300 * (attempt + 1)));
          continue;
        }
        throw pageError;
      }
    }

    if (!page) {
      throw new Error('Unable to load the next invoice page to complete totals.');
    }

    page.items.forEach((invoice: IInvoiceListItem): void => {
      totals.invoiceCount += 1;
      if (typeof invoice.totalAmount === 'number' && Number.isFinite(invoice.totalAmount)) {
        totals.invoiceAmount += invoice.totalAmount;
      }
      if (typeof invoice.outstandingAmount === 'number' && Number.isFinite(invoice.outstandingAmount)) {
        totals.outstandingAmount += invoice.outstandingAmount;
      }
      if (collectOutstandingInvoices) {
        outstandingInvoices.push(invoice);
      }
    });
    if (onProgress) {
      onProgress(totals.invoiceCount);
    }

    if (page.hasNext && !page.nextToken) {
      throw new Error('Invoice API says more pages exist but does not provide a nextToken.');
    }
    const nextToken = page.hasNext ? page.nextToken : undefined;
    if (nextToken && visitedTokens.has(nextToken)) {
      throw new Error('Invoice API repeated a continuation token; totals cannot be verified.');
    }
    if (nextToken) {
      visitedTokens.add(nextToken);
    }
    pageSize = page.pageSize || pageSize;
    continuationToken = nextToken;
  } while (continuationToken);

  return {
    totals,
    outstandingReport: collectOutstandingInvoices
      ? { invoices: outstandingInvoices, totalOutstandingAmount: totals.outstandingAmount }
      : undefined
  };
};

// Preserve the working BPT API contract; the shared BC converter unpacks date ranges.
// Some shared EntityDashboard controls emit the text 'true' for a boolean selection.
const toBptInvoiceFilters = (values: EntityFilterValues): IInvoiceFilters => ({
  ...toInvoiceFilters(values),
  outstandingOnly: values.outstandingOnly === true || values.outstandingOnly === 'true'
});

const getListErrorMessage = (error: unknown): string => {

  const normalizedError = normalizeError(error);

  if (normalizedError.status === 404 || normalizedError.status === 405 || normalizedError.status === 501) {

    return 'Invoice listing API is not configured yet.';

  }

  return getUserFriendlyError(normalizedError);

};

const normalizeInvoiceDescriptions = (invoice: IInvoiceDetail): IInvoiceDetail => ({

  ...invoice,

  lines: invoice.lines.map(line => ({

    ...line,

    description: line.description || line.itemCode || ''

  }))

});

export const BptInvoicesPage: React.FC<IBptInvoicesPageProps> = ({ currentUser, invoiceService, salespersonService, onNavigate, selectedCompany }) => {

  const toast = useToast();

  const pageContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [filterActionRow, setFilterActionRow] = React.useState<HTMLElement | null>(null);

  // Do not insert or move DOM nodes ahead of the React-managed Apply/Clear
  // footer. That can break React reconciliation and make the buttons disappear.
  // Instead, use the existing footer itself as the portal target. The report
  // appears in the footer's first flex row, with Apply/Clear underneath it.
  React.useEffect(() => {
    const container = pageContainerRef.current;
    if (!container) {
      return;
    }

    const changedRows = new Map<HTMLElement, string | null>();

    const findFilterActionRow = (): void => {
      const buttons = Array.from(container.querySelectorAll('button'));
      const applyButton = buttons.find(button =>
        (button.textContent || '').trim().toLowerCase() === 'apply'
      );
      const clearButton = buttons.find(button =>
        (button.textContent || '').trim().toLowerCase() === 'clear'
      );

      if (!applyButton || !clearButton) {
        setFilterActionRow(current => current === null ? current : null);
        return;
      }

      let actionRow: HTMLElement | null = applyButton.parentElement;
      while (actionRow && !actionRow.contains(clearButton)) {
        actionRow = actionRow.parentElement;
      }

      // Never restyle the full filter form (which owns inputs and dropdowns).
      // If the shared component's structure changes, fall back to showing the
      // report above the dashboard instead of risking the filter controls.
      if (!actionRow || actionRow === container ||
          actionRow.querySelector('input, select, textarea')) {
        setFilterActionRow(current => current === null ? current : null);
        return;
      }

      if (!changedRows.has(actionRow)) {
        changedRows.set(actionRow, actionRow.getAttribute('style'));
        actionRow.style.display = 'flex';
        actionRow.style.flexWrap = 'wrap';
        actionRow.style.justifyContent = 'flex-end';
        actionRow.style.alignItems = 'center';
      }

      setFilterActionRow(current => current === actionRow ? current : actionRow);
    };

    findFilterActionRow();
    // Observe *only* to rediscover a replaced React footer: do not move it.
    const observer = new MutationObserver(findFilterActionRow);
    observer.observe(container, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      changedRows.forEach((originalStyle, row) => {
        if (originalStyle === null) {
          row.removeAttribute('style');
        } else {
          row.setAttribute('style', originalStyle);
        }
      });
    };
  }, []);


  const { filters, restrictedSalespersonCode } = useSalespersonFilter(

    invoicesModuleConfig.filters || [],

    salespersonService,

    currentUser

  );

  // Display the 5 reference-config controls; dateRange conversion uses the BC helper.
  // useSalespersonFilter retains the existing salesperson restriction.

  const initialFilterValues = restrictedSalespersonCode ? { salespersonCode: restrictedSalespersonCode } : {};

  const [items, setItems] = React.useState<readonly IInvoiceListItem[]>([]);

  const [filterValues, setFilterValues] = React.useState<EntityFilterValues>(initialFilterValues);

  const [appliedFilterValues, setAppliedFilterValues] = React.useState<EntityFilterValues>(initialFilterValues);

  const appliedInvoiceFilters = React.useMemo(
    () => toBptInvoiceFilters(appliedFilterValues),
    [appliedFilterValues]
  );

  const { pagination, applyResult, changePage, reset } = useCursorPagination();

  const [sorting, setSorting] = React.useState<ISortState | undefined>();

  const [loading, setLoading] = React.useState<boolean>(false);

  const [error, setError] = React.useState<string | undefined>();

  const [documentAction, setDocumentAction] = React.useState<IInvoiceDocumentAction | undefined>();

  const documentActionsInProgress = React.useRef<Set<string>>(new Set());

  const [outstandingReport, setOutstandingReport] = React.useState<IOutstandingReportState>({ loading: false });
  const [exportingOutstandingReport, setExportingOutstandingReport] = React.useState(false);

  const [grandTotals, setGrandTotals] = React.useState<IInvoiceGrandTotalsState>({ loading: true });
  const grandTotalsRequestIdRef = React.useRef(0);


  // Applying the same filters again must still trigger a new request.
  const [filterRequestVersion, setFilterRequestVersion] = React.useState(0);

  // Out-of-order API responses must not replace the latest filtered result.
  const activeRequestId = React.useRef(0);

  const loadInvoices = React.useCallback(async (): Promise<void> => {
    const requestId = ++activeRequestId.current;
    setLoading(true);
    setError(undefined);

    try {
      const requestedFilters = appliedInvoiceFilters;
      const result = await invoiceService.getInvoices(
        requestedFilters,
        pagination,
        sorting,
        currentUser
      );
      if (activeRequestId.current !== requestId) {
        return;
      }
      setItems(result.items);
      applyResult(result);
    } catch (loadError) {
      if (activeRequestId.current !== requestId) {
        return;
      }
      setItems([]);
      setError(getListErrorMessage(loadError));
    } finally {
      if (activeRequestId.current === requestId) {
        setLoading(false);
      }
    }
  }, [
    appliedInvoiceFilters,
    applyResult,
    currentUser,
    invoiceService,
    pagination.currentToken,
    pagination.pageNumber,
    pagination.pageSize,
    sorting,
    filterRequestVersion
  ]);

  React.useEffect(() => {
    void loadInvoices();
    return () => {
      activeRequestId.current += 1;
    };
  }, [loadInvoices]);

  React.useEffect(() => {

    if (!restrictedSalespersonCode) {

      return;

    }

    setFilterValues(current => ({ ...current, salespersonCode: restrictedSalespersonCode }));

    setAppliedFilterValues(current => ({ ...current, salespersonCode: restrictedSalespersonCode }));

  }, [restrictedSalespersonCode]);

  // Only applied user filters (not unsaved draft inputs or mandatory access
  // restrictions alone) enable the Excel report.
  const hasUserFilters = hasUserInvoiceFilters(appliedFilterValues, restrictedSalespersonCode);

  // Totals remain independent of the table page. If a user filter is applied,
  // the same scan also collects all matching invoices for the three-sheet Excel.
  const outstandingOnlyActive = appliedInvoiceFilters.outstandingOnly === true;
  React.useEffect(() => {
    const requestId = ++grandTotalsRequestIdRef.current;
    setGrandTotals({ loading: true });
    setOutstandingReport({ loading: hasUserFilters });

    void getGrandTotalsAcrossAllPages(
      invoiceService,
      appliedInvoiceFilters,
      currentUser,
      hasUserFilters,
      (count: number): void => {
        if (requestId === grandTotalsRequestIdRef.current) {
          setGrandTotals({ loading: true, scannedCount: count });
        }
      }
    ).then(result => {
      if (requestId !== grandTotalsRequestIdRef.current) {
        return;
      }
      setGrandTotals({ loading: false, totals: result.totals });
      if (hasUserFilters && result.outstandingReport) {
        setOutstandingReport({ loading: false, report: result.outstandingReport });
      } else {
        setOutstandingReport({ loading: false });
      }
    }).catch(totalsError => {
      if (requestId !== grandTotalsRequestIdRef.current) {
        return;
      }
      const errorMessage = getUserFriendlyError(normalizeError(totalsError));
      setGrandTotals({ loading: false, error: errorMessage });
      if (hasUserFilters) {
        setOutstandingReport({ loading: false, error: errorMessage });
      }
    });

    return () => {
      if (requestId === grandTotalsRequestIdRef.current) {
        grandTotalsRequestIdRef.current += 1;
      }
    };
  }, [appliedInvoiceFilters, currentUser, filterRequestVersion, invoiceService,
    selectedCompany.name, hasUserFilters]);

  const handleFilterChange = React.useCallback((key: string, value: FilterValue): void => {

    if (key === 'salespersonCode' && currentUser?.isSalesperson === true) {

      return;

    }

    setFilterValues(current => ({

      ...current,

      [key]: value

    }));

  }, [currentUser?.isSalesperson]);

  const handleFilterApply = React.useCallback((): void => {
    // Snapshot the draft values rather than reusing the same object reference.
    // Keep any mandatory salesperson restriction in place.
    const nextValues: EntityFilterValues = restrictedSalespersonCode
      ? { ...filterValues, salespersonCode: restrictedSalespersonCode }
      : { ...filterValues };

    reset(); // Always go back to page one for a new filter selection.
    // Never offer an export from the previous filter selection.
    setOutstandingReport({ loading: true });
    setAppliedFilterValues(nextValues);
    setFilterRequestVersion(version => version + 1);
  }, [filterValues, reset, restrictedSalespersonCode]);

  const handleFilterClear = React.useCallback((): void => {
    const clearedValues: EntityFilterValues = restrictedSalespersonCode
      ? { salespersonCode: restrictedSalespersonCode }
      : {};

    setFilterValues({ ...clearedValues });
    reset();
    // Clearing filters immediately removes the Excel report.
    setOutstandingReport({ loading: false });
    setAppliedFilterValues({ ...clearedValues });
    setFilterRequestVersion(version => version + 1);
  }, [reset, restrictedSalespersonCode]);

  const handleSort = React.useCallback((fieldName: string, direction?: SortDirection): void => {

    setSorting(direction ? {

      fieldName,

      direction

    } : undefined);

    reset();

  }, [reset]);

  const handlePrint = React.useCallback(async (item: IInvoiceListItem): Promise<void> => {

    let invoiceNumber: string;

    let preview: Window | undefined;

    if (documentActionsInProgress.current.size) {

      return;

    }

    try {

      invoiceNumber = requireInvoiceNumber(item.invoiceNumber);

    } catch (referenceError) {

      toast.error(getUserFriendlyError(normalizeError(referenceError)), { title: 'Unable to print invoice' });

      return;

    }

    documentActionsInProgress.current.add(invoiceNumber);

    setDocumentAction({ type: 'print' });

    try {

      preview = openInvoicePrintPreviewWindow();

      const printableInvoice = normalizeInvoiceDescriptions(

        await invoiceService.getInvoiceByNumber(invoiceNumber, currentUser)

      );

      await writeInvoicePrintPreview(preview, printableInvoice);

      await printInvoice(printableInvoice, preview);

    } catch (printError) {

      const message = getUserFriendlyError(normalizeError(printError));

      toast.error(message, { title: 'Unable to print invoice' });

      if (preview) {

        writeInvoicePrintError(preview, message);

      }

    } finally {

      documentActionsInProgress.current.delete(invoiceNumber);

      setDocumentAction(undefined);

    }

  }, [currentUser, invoiceService, toast]);

  const handleDownload = React.useCallback(async (item: IInvoiceListItem): Promise<void> => {

    let invoiceNumber: string;

    if (documentActionsInProgress.current.size) {

      return;

    }

    try {

      invoiceNumber = requireInvoiceNumber(item.invoiceNumber);

    } catch (referenceError) {

      toast.error(getUserFriendlyError(normalizeError(referenceError)), { title: 'Unable to download invoice' });

      return;

    }

    documentActionsInProgress.current.add(invoiceNumber);

    setDocumentAction({ type: 'download' });

    try {

      const invoice = await invoiceService.getInvoiceByNumber(invoiceNumber, currentUser);

      const downloadableInvoice = normalizeInvoiceDescriptions(invoice);

      await downloadInvoicePdf(downloadableInvoice);

      toast.success('Invoice PDF download started.', { title: invoice.invoiceNumber || 'Invoice' });

    } catch (downloadError) {

      toast.error(getUserFriendlyError(normalizeError(downloadError)), { title: 'Unable to download invoice' });

    } finally {

      documentActionsInProgress.current.delete(invoiceNumber);

      setDocumentAction(undefined);

    }

  }, [currentUser, invoiceService, toast]);

  const handleRowClick = React.useCallback((item: IInvoiceListItem): void => {

    if (isGrandTotalRow(item)) {
      return;
    }

    try {

      onNavigate(buildInvoiceDetailPath(item.invoiceNumber));

    } catch (referenceError) {

      toast.error(getUserFriendlyError(normalizeError(referenceError)), { title: 'Unable to open invoice' });

    }

  }, [onNavigate, toast]);

  // A fixed final table row, separate from real data and from cursor pagination.
  // Display it even when there are zero invoices, while totals are loading,
  // or when the all-pages API request fails (never silently show an incorrect 0).
  const grandTotalRow = React.useMemo<IInvoiceListItem>(() => ({
    ...(items[0] || {}),
    id: GRAND_TOTAL_ROW_ID,
    invoiceNumber: GRAND_TOTAL_ROW_ID,
    totalAmount: grandTotals.totals?.invoiceAmount,
    outstandingAmount: grandTotals.totals?.outstandingAmount
  } as IInvoiceListItem), [items, grandTotals.totals]);

  const tableItems = React.useMemo<readonly IInvoiceListItem[]>(
    () => [...items, grandTotalRow],
    [items, grandTotalRow]
  );

  const tableColumns = React.useMemo(() =>
    (invoicesModuleConfig.tableColumns || []).map(column => ({
      ...column,
      customRender: (invoice: IInvoiceListItem): React.ReactNode => {
        if (!isGrandTotalRow(invoice)) {
          if (column.customRender) {
            return column.customRender(invoice);
          }
          const fallback = (invoice as unknown as Record<string, unknown>)[column.fieldName || column.key];
          return fallback === undefined || fallback === null ? '' : String(fallback);
        }

        let content: React.ReactNode = '\u00a0';
        let monetary = false;
        if (column.key === 'invoiceNumber') {
          content = grandTotals.loading
            ? `GRAND TOTAL (Scanning${grandTotals.scannedCount ? `: ${grandTotals.scannedCount} records` : '...'})`
            : grandTotals.error
              ? 'GRAND TOTAL (Unavailable)'
              : `GRAND TOTAL (${grandTotals.totals?.invoiceCount || 0} invoices)`;
        } else if (column.key === 'totalAmountIncludingTax' || column.key === 'totalAmount') {
          monetary = true;
          content = grandTotals.loading ? 'Calculating...'
            : grandTotals.error ? 'Unavailable'
              : currencyFormatter.format(grandTotals.totals?.invoiceAmount || 0);
        } else if (column.key === 'remainingAmount' || column.key === 'outstandingAmount') {
          monetary = true;
          content = grandTotals.loading ? 'Calculating...'
            : grandTotals.error ? 'Unavailable'
              : currencyFormatter.format(grandTotals.totals?.outstandingAmount || 0);
        }

        return (
          <span style={{
            display: 'block', boxSizing: 'border-box', width: '100%',
            minHeight: 34, padding: '8px 4px',
            background: '#eef3fb', borderTop: '2px solid #9fafd2',
            color: monetary ? '#9f1530' : '#233453', fontWeight: 700,
            textAlign: monetary ? 'right' : 'left', whiteSpace: 'nowrap'
          }} title={grandTotals.error || undefined}>{content}</span>
        );
      }
    })), [grandTotals]);

  const reportInvoices = outstandingReport.report?.invoices || [];
  const salespersonCodes = new Set(reportInvoices
    .map(invoice => (invoice.salespersonCode || '').trim().toUpperCase())
    .filter(Boolean));
  const salespersonCount = salespersonCodes.size;
  const hasSelectedSalesperson = Boolean(
    (appliedInvoiceFilters.salespersonCode || restrictedSalespersonCode || '').trim()
  );
  const outstandingScopeLabel = hasSelectedSalesperson ? 'Salesperson Outstanding' : 'Business Outstanding';
  const reportScopeLabel = outstandingOnlyActive ? outstandingScopeLabel : 'Filtered Invoice Report';

  const handleOutstandingReportExport = async (): Promise<void> => {
    if (!hasUserFilters || !outstandingReport.report || outstandingReport.loading ||
      grandTotals.loading || exportingOutstandingReport) {
      return;
    }
    setExportingOutstandingReport(true);
    try {
      // Resolve salesperson names for the report, even when the BC invoice
      // list response contains only salesperson codes.
      const lookup = await salespersonService.getSalespersonLookup().catch(() => ({ items: [] }));
      const salespersonNames = new Map<string, string>();
      lookup.items.forEach(item => {
        if (item.code && item.name) {
          salespersonNames.set(item.code.trim().toUpperCase(), item.name.trim());
        }
      });

      exportBptOutstandingToExcel({
        filters: appliedInvoiceFilters,
        invoices: outstandingReport.report.invoices,
        totalOutstandingAmount: outstandingReport.report.totalOutstandingAmount,
        salespersonCount,
        scopeLabel: reportScopeLabel,
        salespersonNames
      });
      toast.success('Filtered invoice Excel download started.', { title: 'Excel export' });
    } catch (exportError) {
      toast.error(getUserFriendlyError(normalizeError(exportError)), { title: 'Unable to export report' });
    } finally {
      setExportingOutstandingReport(false);
    }
  };

  const outstandingReportSummary = hasUserFilters ? (
    <div role="status" style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, padding: '14px 16px', borderRadius: 8,
      border: '1px solid #ddd5f5', background: '#f5f1ff', color: '#28136c'
    }}>
      {outstandingReport.loading ? (
        <span>Preparing filtered invoice report across all pages...</span>
      ) : outstandingReport.error ? (
        <span role="alert">Unable to prepare filtered report: {outstandingReport.error}</span>
      ) : (
        <>
          <div style={{ minWidth: 195 }}>
            <div style={{ marginBottom: 4, fontSize: 14 }}>{reportScopeLabel}</div>
            {outstandingOnlyActive && (
              <strong style={{ display: 'block', color: '#bf162c', fontSize: 17 }}>
                {outstandingReport.report
                  ? currencyFormatter.format(outstandingReport.report.totalOutstandingAmount)
                  : '—'}
              </strong>
            )}
          </div>
          <div style={{ flex: '1 1 225px', fontSize: 14 }}>
            {outstandingReport.report ? reportInvoices.length : '—'}{' '}
            {outstandingOnlyActive ? 'outstanding invoice(s)' : 'matching invoice(s)'} across{' '}
            {outstandingReport.report ? salespersonCount : '—'} salesperson(s)
          </div>
          <button
            type="button"
            onClick={handleOutstandingReportExport}
            disabled={!outstandingReport.report || outstandingReport.loading ||
              grandTotals.loading || exportingOutstandingReport}
            style={{
              background: '#ffffff', border: '1px solid #d9cfee', borderRadius: 6,
              color: '#29116f', cursor: outstandingReport.report && !grandTotals.loading ? 'pointer' : 'not-allowed',
              fontWeight: 600, padding: '9px 14px', whiteSpace: 'nowrap'
            }}
          >
            {exportingOutstandingReport ? 'Preparing Excel...' : 'Export Excel'}
          </button>
        </>
      )}
    </div>
  ) : undefined;

  return (
    <div ref={pageContainerRef}>
      <EntityDashboard<IInvoiceListItem>

      title={invoicesModuleConfig.title}

      subtitle={invoicesModuleConfig.description}

      columns={tableColumns}

      filters={filters}

      filterValues={filterValues}

      items={tableItems}

      loading={loading}

      error={error}

      onRowClick={

        invoicesModuleConfig.detailEnabled

          ? handleRowClick

          : undefined

      }

      rowActions={selectedCompany.name === 'Ideal Publications Trust'

        ? []

        : [

            {

              key: 'print',

              label: documentAction?.type === 'print' ? 'Preparing print...' : 'Print',

              icon: 'print',

              disabled: (item: IInvoiceListItem) => Boolean(documentAction) || isGrandTotalRow(item),

              onClick: item => {

                if (!isGrandTotalRow(item)) {
                  handlePrint(item).catch(() => undefined);
                }

              }

            },

            {

              key: 'download',

              label: documentAction?.type === 'download' ? 'Downloading...' : 'Download',

              icon: 'download',

              disabled: (item: IInvoiceListItem) => Boolean(documentAction) || isGrandTotalRow(item),

              onClick: item => {

                if (!isGrandTotalRow(item)) {
                  handleDownload(item).catch(() => undefined);
                }

              }

            }

          ]}

      onFilterChange={handleFilterChange}

      onFilterApply={handleFilterApply}

      onFilterClear={handleFilterClear}

      cursorPagination={pagination}

      onPageChange={changePage}

      sorting={sorting}

      onSort={handleSort}

      getRowKey={(item, index) => isGrandTotalRow(item) ? GRAND_TOTAL_ROW_ID : item.id || item.invoiceNumber || String(index)}

      emptyTitle={hasUserFilters ? 'No matching invoices' : 'No invoices available'}

      emptyMessage={hasUserFilters
        ? 'No invoices match the selected filters.'
        : 'No invoices exist for the selected company.'}

      />
      {filterActionRow && outstandingReportSummary
        ? ReactDOM.createPortal(
            <div style={{ order: -1, flex: '0 0 100%', width: '100%',
                          boxSizing: 'border-box', marginBottom: 12,
                          paddingBottom: 14, borderBottom: '1px solid #ebe5f6' }}>
              {outstandingReportSummary}
            </div>,
            filterActionRow
          )
        : !filterActionRow && outstandingReportSummary
          ? <div style={{ marginTop: 12, marginBottom: 16 }}>{outstandingReportSummary}</div>
          : null}
    </div>
  );

};
