import * as React from 'react';

import { PageContainer } from '../../../../../shared/components/pageContainer/PageContainer';
import { DatePicker } from '../../../../../shared/components/datePicker/DatePicker';
import { InputField } from '../../../../../shared/components/inputs/InputField';
import { Dropdown } from '../../../../../shared/components/dropdowns/Dropdown';
import type { ILookupOption } from '../../../../../shared/models/ILookupOption';
import { Button } from '../../../../../shared/components/buttons/Button';
import { AmountDisplay } from '../../../../../shared/components/amountDisplay/AmountDisplay';
import { getUserFriendlyError } from '../../../../../shared/api/apiErrorHandler';

import { collectionOnBillsModuleConfig } from '../../../config/modules/collectionOnBillsModuleConfig';
import type {
  CollectionOnBillsApiService,
  ICollectionOnBillInvoice,
  ICollectionOnBillReceipt,
  ICollectionOnBillsRequest
} from '../../../services/collectionOnBills/collectionOnBillsApiService';

import type { UnitService } from '../../../services/units/unitService';
import type { BusinessPerformanceUnitAccessService } from '../../../services/access/businessPerformanceUnitAccessService';

import styles from './CollectionOnBillsPage.module.scss';

export interface ICollectionOnBillsPageProps {
  selectedCompanyId: string;
  appUserId?: number;
  unitService: UnitService;
  unitAccessService: BusinessPerformanceUnitAccessService;
  collectionOnBillsApiService: CollectionOnBillsApiService;
}

interface IAppliedSelection extends ICollectionOnBillsRequest {
  companyId: string;
}

const toLocalIsoDate = (date: Date): string => {
  const year = String(date.getFullYear());
  const monthNumber = date.getMonth() + 1;
  const dayNumber = date.getDate();
  const month = monthNumber < 10 ? `0${monthNumber}` : String(monthNumber);
  const day = dayNumber < 10 ? `0${dayNumber}` : String(dayNumber);
  return `${year}-${month}-${day}`;
};

const getDefaultFromDate = (): string => {
  const today = new Date();
  return toLocalIsoDate(new Date(today.getFullYear(), today.getMonth(), 1));
};

const displayDate = (isoDate: string | null): string => {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return '—';
  }

  return `${isoDate.substring(8, 10)}/${isoDate.substring(5, 7)}/${isoDate.substring(0, 4)}`;
};

const displayText = (value: string | null): string =>
  value && value.trim() ? value : '—';

export const CollectionOnBillsPage: React.FC<ICollectionOnBillsPageProps> = ({
  selectedCompanyId,
  appUserId,
  unitService,
  unitAccessService,
  collectionOnBillsApiService
}) => {
  const [fromDate, setFromDate] = React.useState<string>(getDefaultFromDate);
  const [toDate, setToDate] = React.useState<string>(() => toLocalIsoDate(new Date()));
  const [customerSearch, setCustomerSearch] = React.useState<string>('');
  const [receiptNo, setReceiptNo] = React.useState<string>('');

  const [appliedSelection, setAppliedSelection] =
    React.useState<IAppliedSelection | undefined>();
  const [receipts, setReceipts] =
    React.useState<readonly ICollectionOnBillReceipt[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | undefined>();
  const requestIdRef = React.useRef<number>(0);
  // Paginate complete receipts, keeping all invoice applications together.
  const [pageSize, setPageSize] = React.useState<number>(10);
  const [pageNumber, setPageNumber] = React.useState<number>(1);

  const [unitOptions, setUnitOptions] = React.useState<readonly ILookupOption[]>([]);
  const [selectedCodes, setSelectedCodes] = React.useState<readonly string[]>(['__ALL__']);
  const [unitsLoading, setUnitsLoading] = React.useState<boolean>(true);
  const [unitError, setUnitError] = React.useState<string | undefined>();

  React.useEffect(() => {
    let active = true;
    setSelectedCodes(['__ALL__']);
    setUnitOptions([]);
    setUnitsLoading(true);
    setUnitError(undefined);

    if (!selectedCompanyId || !appUserId || !Number.isSafeInteger(appUserId) || appUserId <= 0) {
      setUnitError('Unable to verify your Unit permissions.');
      setUnitsLoading(false);
      return () => { active = false; };
    }

    const companyId = selectedCompanyId;
    const userId = appUserId;

    const loadUnits = async (): Promise<void> => {
      try {
        const [assignedIds, units] = await Promise.all([
          unitAccessService.getAssignedUnitIds(userId, companyId),
          unitService.getUnits()
        ]);
        if (!active) return;
        const assignedSet = new Set(assignedIds);
        const unique = new Map<string, ILookupOption>();
        for (const unit of units) {
          const code = unit.unitCode.trim().toUpperCase();
          if (unit.isActive && assignedSet.has(unit.id) && code && !unique.has(code)) {
            unique.set(code, {
              key: code,
              value: code,
              text: `${unit.unitName} (${code})`
            });
          }
        }
        const options = Array.from(unique.values())
          .sort((a, b) => a.text.localeCompare(b.text));
        setUnitOptions(options);
        if (!options.length) {
          setUnitError('No active Units assigned to you for this company.');
        }
      } catch (loadError) {
        if (active) setUnitError(getUserFriendlyError(loadError));
      } finally {
        if (active) setUnitsLoading(false);
      }
    };
    loadUnits().catch(() => undefined);
    return () => { active = false; };
  }, [selectedCompanyId, appUserId, unitService, unitAccessService]);

  const selectorOptions = React.useMemo<readonly ILookupOption[]>(() => [
    { key: '__ALL__', value: '__ALL__', text: 'All permitted units' },
    ...unitOptions
  ], [unitOptions]);

  const handleUnitSelection = (value: string | readonly string[] | undefined): void => {
    const next = Array.isArray(value) ? value : [];
    if (next.indexOf('__ALL__') !== -1 && selectedCodes.indexOf('__ALL__') === -1) {
      setSelectedCodes(['__ALL__']);
      return;
    }
    const specific = next.filter(code => code !== '__ALL__');
    setSelectedCodes(specific);
  };

  // Invalidate results and requests when the user switches BC company
  // or navigates away. Never display another company's financial data.
  React.useEffect(() => {
    requestIdRef.current += 1;
    setAppliedSelection(undefined);
    setReceipts([]);
    setPageNumber(1);
    setError(undefined);
    setLoading(false);

    return () => {
      requestIdRef.current += 1;
    };
  }, [selectedCompanyId]);

  const handleSubmit = React.useCallback(async (): Promise<void> => {
    if (!selectedCompanyId.trim()) {
      setError('Select a Business Central company first.');
      return;
    }
    if (!appUserId || !Number.isSafeInteger(appUserId) || appUserId <= 0) {
      setError('Unable to verify your Unit permissions.');
      return;
    }
    if (unitsLoading || unitError || unitOptions.length === 0) {
      setError(unitError || 'No permitted Units available for this company.');
      return;
    }
    const requestId = ++requestIdRef.current;
    setPageNumber(1);
    setAppliedSelection(undefined);
    setReceipts([]);
    setError(undefined);
    setLoading(true);

    try {
      // Re-read assignments immediately before calling BC, as the other
      // BPT reports do. A stale dropdown cannot authorize extra units.
      const [assignedIds, units] = await Promise.all([
        unitAccessService.getAssignedUnitIds(appUserId, selectedCompanyId),
        unitService.getUnits()
      ]);
      if (requestId !== requestIdRef.current) return;

      const assignedSet = new Set(assignedIds);
      const allowedCodes = new Set(units
        .filter(unit => unit.isActive && assignedSet.has(unit.id))
        .map(unit => unit.unitCode.trim().toUpperCase())
        .filter(code => Boolean(code)));

      if (!allowedCodes.size) {
        throw new Error('No active Units assigned to you for this company.');
      }

      const allSelected = selectedCodes.indexOf('__ALL__') !== -1;
      const selectedBranchCodes = allSelected
        ? Array.from(allowedCodes)
        : selectedCodes.map(code => code.trim().toUpperCase());

      if (!selectedBranchCodes.length ||
          selectedBranchCodes.some(code => !allowedCodes.has(code))) {
        throw new Error('Select at least one Unit assigned to you.');
      }

      const request: IAppliedSelection = {
        companyId: selectedCompanyId,
        fromDate,
        toDate,
        customerSearch: customerSearch.trim(),
        receiptNo: receiptNo.trim(),
        branchCodes: selectedBranchCodes
      };

      setAppliedSelection(request);
      const data = await collectionOnBillsApiService.getCollectionOnBills(request);
      if (requestId === requestIdRef.current) setReceipts(data);
    } catch (loadError) {
      if (requestId === requestIdRef.current) {
        setError(getUserFriendlyError(loadError));
        setReceipts([]);
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [selectedCompanyId, appUserId, unitsLoading, unitError, unitOptions,
      collectionOnBillsApiService, unitAccessService, unitService,
      selectedCodes, fromDate, toDate, customerSearch, receiptNo]);

  const visibleSelection = appliedSelection?.companyId === selectedCompanyId
    ? appliedSelection
    : undefined;
  const visibleReceipts = visibleSelection ? receipts : [];

  // Compute headline totals from the entire filtered dataset, not one page.
  // A receipt total is counted once even when it has many invoice applications.
  const summary = React.useMemo(() => {
    let totalAmount = 0;
    let totalAppliedAmount = 0;
    let applicationCount = 0;
    const distinctInvoices = new Set<string>();

    for (const receipt of visibleReceipts) {
      totalAmount += receipt.totalAmount;
      totalAppliedAmount += receipt.totalAppliedAmount;
      applicationCount += receipt.invoices.length;
      for (const invoice of receipt.invoices) {
        // Use BC's invoice ledger entry, falling back to the invoice number.
        // If neither is present, use its application entry to keep it countable.
        const invoiceKey = invoice.invoiceEntryNo > 0
          ? `entry:${invoice.invoiceEntryNo}`
          : invoice.invoiceNo?.trim()
            ? `number:${invoice.invoiceNo.trim().toUpperCase()}`
            : `application:${invoice.applicationEntryNo}`;
        distinctInvoices.add(invoiceKey);
      }
    }

    return {
      totalAmount,
      totalAppliedAmount,
      applicationCount,
      invoiceCount: distinctInvoices.size
    };
  }, [visibleReceipts]);

  const totalPages = Math.max(1, Math.ceil(visibleReceipts.length / pageSize));
  const activePage = Math.min(pageNumber, totalPages);
  const firstReceiptIndex = (activePage - 1) * pageSize;
  const pageReceipts = visibleReceipts.slice(firstReceiptIndex, firstReceiptIndex + pageSize);
  const pageStart = Math.max(1, activePage - 2);
  const pageEnd = Math.min(totalPages, pageStart + 4);
  const pageNumbers = Array.from(
    { length: pageEnd - pageStart + 1 },
    (_, index) => pageStart + index
  );

  // Business Central returns branchCode on each invoice application.
  // Reuse the Unit Master display names already loaded for the filter.
  const unitLabels = React.useMemo(() => {
    const labels = new Map<string, string>();
    for (const option of unitOptions) {
      labels.set(option.value.trim().toUpperCase(), option.text);
    }
    return labels;
  }, [unitOptions]);

  // Use the submitted filter, not the currently edited dropdown value.
  // A single selected unit is already clear from the filters.
  const showUnitColumn = (visibleSelection?.branchCodes?.length ?? 0) > 1;

  return (
    <PageContainer
      title={collectionOnBillsModuleConfig.title}
      description={collectionOnBillsModuleConfig.description}
    >
      <section className={styles.filterPanel} aria-label="Collection on Bills filters">
        <div className={styles.panelHeading}>
          <h3>Report filters</h3>
          <p>Select permitted units, a receipt date range and optional customer or receipt filters.</p>
        </div>
        <div className={styles.filterGrid}>
          <DatePicker
            label="From Date"
            value={fromDate}
            onChange={setFromDate}
            maxDate={toDate || undefined}
            useCustomPicker
            required
          />
          <DatePicker
            label="To Date"
            value={toDate}
            onChange={setToDate}
            minDate={fromDate || undefined}
            useCustomPicker
            required
          />
          <InputField
            label="Customer (Name or Code)"
            value={customerSearch}
            onChange={setCustomerSearch}
            placeholder="Search name or customer code"
            maxLength={100}
          />
          <InputField
            label="Receipt No"
            value={receiptNo}
            onChange={setReceiptNo}
            placeholder="Optional receipt number"
            maxLength={100}
          />
          <Dropdown
            key={selectedCompanyId}
            label="Units"
            values={selectedCodes}
            options={selectorOptions}
            searchable
            multiSelect
            required
            loading={unitsLoading}
            disabled={unitsLoading || Boolean(unitError)}
            placeholder="Select permitted units"
            onChange={handleUnitSelection}
          />
          <div className={styles.submitControl}>
            <Button
              label="Submit"
              variant="primary"
              loading={loading}
              disabled={!selectedCompanyId ||
                unitsLoading || Boolean(unitError) || unitOptions.length === 0 ||
                selectedCodes.length === 0}
              onClick={() => {
                handleSubmit().catch(loadError => {
                  setError(getUserFriendlyError(loadError));
                });
              }}
            />
          </div>
        </div>
        {unitError ? (
          <p className={styles.errorMessage} role="alert">{unitError}</p>
        ) : null}
      </section>

      {visibleSelection ? (
        <section className={styles.resultsPanel} aria-label="Collection on Bills results">
          <div className={styles.resultsHeader}>
            <div>
              <h3>Receipts and Invoices</h3>
              <p>
                Receipt dates: {displayDate(visibleSelection.fromDate)} to{' '}
                {displayDate(visibleSelection.toDate)}
                {visibleSelection.customerSearch
                  ? ` | Customer: ${visibleSelection.customerSearch}`
                  : ''}
                {visibleSelection.receiptNo
                  ? ` | Receipt: ${visibleSelection.receiptNo}`
                  : ''}
                {visibleSelection.branchCodes?.length
                  ? ` | Units: ${visibleSelection.branchCodes.join(', ')}`
                  : ''}
              </p>
            </div>
          </div>

          {loading ? (
            <div className={styles.message} role="status">Loading receipt applications...</div>
          ) : error ? (
            <div className={styles.errorMessage} role="alert">{error}</div>
          ) : visibleReceipts.length === 0 ? (
            <div className={styles.message}>No receipts found for the selected filters.</div>
          ) : (
            <>
              <div className={styles.summaryGrid} aria-label="Report summary">
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>Receipts</span>
                  <strong className={styles.summaryValue}>{visibleReceipts.length}</strong>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>Invoices</span>
                  <strong className={styles.summaryValue}>{summary.invoiceCount}</strong>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>Applied Amount</span>
                  <strong className={styles.summaryValue}>
                    <AmountDisplay amount={summary.totalAppliedAmount} variant="total" />
                  </strong>
                </div>
              </div>
              <div className={styles.tableScroll} role="region" tabIndex={0} aria-label="Receipt and invoice detail table">
                <table className={styles.reportTable}>
                  <colgroup>
                    <col style={{ width: '4%' }} />
                    <col style={{ width: showUnitColumn ? '20%' : '24%' }} />
                    <col style={{ width: showUnitColumn ? '11%' : '12%' }} />
                    <col style={{ width: showUnitColumn ? '10%' : '11%' }} />
                    <col style={{ width: showUnitColumn ? '13%' : '15%' }} />
                    {showUnitColumn ? <col style={{ width: '11%' }} /> : null}
                    <col style={{ width: '12%' }} />
                    <col style={{ width: showUnitColumn ? '9%' : '10%' }} />
                    <col style={{ width: showUnitColumn ? '10%' : '12%' }} />
                  </colgroup>
                  <caption className={styles.screenReaderOnly}>
                    Receipts and invoices for the selected period
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">No.</th>
                      <th scope="col">Customer</th>
                      <th scope="col">Receipt No</th>
                      <th scope="col">Receipt Date</th>
                      <th className={styles.numeric} scope="col">Total Amount</th>
                      {showUnitColumn ? <th scope="col">Unit</th> : null}
                      <th scope="col">Invoice No</th>
                      <th scope="col">Invoice Date</th>
                      <th className={styles.numeric} scope="col">Applied Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageReceipts.map((receipt, receiptIndex) => {
                      const invoiceRows: readonly (ICollectionOnBillInvoice | undefined)[] =
                        receipt.invoices.length > 0 ? receipt.invoices : [undefined];

                      return invoiceRows.map((invoice, invoiceIndex) => (
                        <tr
                          key={`${receipt.receiptEntryNo}-${invoice?.applicationEntryNo || 'none'}-${invoiceIndex}`}
                          className={invoiceIndex === 0 ? styles.receiptStart : undefined}
                        >
                          {invoiceIndex === 0 ? (
                            <>
                              <td rowSpan={invoiceRows.length} className={styles.groupCell}>{firstReceiptIndex + receiptIndex + 1}</td>
                              <td rowSpan={invoiceRows.length} className={styles.groupCell}>
                                <strong>{displayText(receipt.customerName)}</strong>
                                <small>{displayText(receipt.customerNo)}</small>
                              </td>
                              <td rowSpan={invoiceRows.length} className={styles.groupCell}>
                                <strong>{displayText(receipt.receiptNo)}</strong>
                              </td>
                              <td rowSpan={invoiceRows.length} className={styles.groupCell}>
                                {displayDate(receipt.receiptDate)}
                              </td>
                              <td rowSpan={invoiceRows.length} className={`${styles.groupCell} ${styles.numeric}`}>
                                <AmountDisplay amount={receipt.totalAmount} />
                              </td>
                            </>
                          ) : null}
                          {showUnitColumn ? (
                            <td className={styles.unitCell}>
                              {invoice
                                ? unitLabels.get((invoice.branchCode || '').trim().toUpperCase()) ||
                                  (invoice.branchCode || 'Unassigned')
                                : '—'}
                            </td>
                          ) : null}
                          <td>{invoice ? displayText(invoice.invoiceNo) : '—'}</td>
                          <td>{invoice ? displayDate(invoice.invoiceDate) : '—'}</td>
                          <td className={styles.numeric}>
                            {invoice ? <AmountDisplay amount={invoice.appliedAmount} /> : '—'}
                          </td>
                        </tr>
                      ));
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4}>Grand Total (all {visibleReceipts.length} receipts)</td>
                      <td className={styles.numeric}>
                        <AmountDisplay amount={summary.totalAmount} variant="total" />
                      </td>
                      <td colSpan={showUnitColumn ? 3 : 2}>{summary.applicationCount} invoice applications</td>
                      <td className={styles.numeric}>
                        <AmountDisplay amount={summary.totalAppliedAmount} variant="total" />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className={styles.paginationBar}>
                <label className={styles.pageSizeLabel}>
                  Receipts per page
                  <select
                    aria-label="Receipts per page"
                    value={pageSize}
                    onChange={event => {
                      setPageSize(Number(event.currentTarget.value));
                      setPageNumber(1);
                    }}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                  </select>
                </label>
                <span className={styles.pageStatus}>
                  Showing {firstReceiptIndex + 1}–{Math.min(firstReceiptIndex + pageSize, visibleReceipts.length)} of {visibleReceipts.length} receipts
                </span>
                <nav className={styles.pageActions} aria-label="Receipt report pages">
                  <button type="button" disabled={activePage === 1}
                    onClick={() => setPageNumber(Math.max(1, activePage - 1))}>
                    Previous
                  </button>
                  {pageNumbers.map(page => (
                    <button
                      type="button"
                      key={page}
                      aria-label={`Page ${page}`}
                      aria-current={page === activePage ? 'page' : undefined}
                      className={page === activePage ? styles.activePage : undefined}
                      onClick={() => setPageNumber(page)}
                    >
                      {page}
                    </button>
                  ))}
                  <button type="button" disabled={activePage >= totalPages}
                    onClick={() => setPageNumber(Math.min(totalPages, activePage + 1))}>
                    Next
                  </button>
                </nav>
              </div>
              <p className={styles.tableNote}>
                Total Amount is the original BC receipt amount, counted once per receipt.
                Applied Amount includes only invoice applications matching the selected units.
                Grand totals and summary cards cover all filtered receipts, across every page.
              </p>
            </>
          )}
        </section>
      ) : (
        error ? <div className={styles.errorMessage} role="alert">{error}</div> :
        <div className={styles.message}>
          Select filters and click Submit to view Collection on Bills.
        </div>
      )}
    </PageContainer>
  );
};
