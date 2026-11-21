import * as React from 'react';

import type { ILookupOption } from '../../../../../shared/models/ILookupOption';
import { Dropdown } from '../../../../../shared/components/dropdowns/Dropdown';
import { InputField } from '../../../../../shared/components/inputs/InputField';
import { Button } from '../../../../../shared/components/buttons/Button';
import { PageContainer } from '../../../../../shared/components/pageContainer/PageContainer';
import type {
  IChequeEntryListItem
} from '../../../services/ChequeEntry/ChequeEntrySharePointService';
import type { IBranchOption } from './ChequeEntryForm';
import styles from './ChequeEntryList.module.scss';

export interface IChequeEntryListProps {
  entries: readonly IChequeEntryListItem[];
  branches: readonly IBranchOption[];
  loading: boolean;
  error: string;
  hasMore: boolean;
  canAdd: boolean;
  /** Edit permission is independent of Create. */
  canEdit: boolean;
  branchWarning?: string;
  onRefresh: () => void;
  onAdd: () => void;
  /** Full read-only details for selected SharePoint cheque. */
  onView: (entry: IChequeEntryListItem) => void;
  /** Open prefilled form, updating the existing list item on save. */
  onEdit: (entry: IChequeEntryListItem) => void;
}

// Pencil artwork matched to the Unit Master edit button in the supplied
// reference image. Transparent icon only; existing button border/styles remain.
const unitMasterEditIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAA1ElEQVR42tXTMUuCURTG8Z/aFC0N1fASgpNgcyChSQSBtLi4iODQx0gcxaa+S0PRYkEOLdGXaMrBwc0GlzvcwVdeEQLPeu//ec5zz7m56nXbNpW3Zf2LwBkWeFh1WDgtVdbBCZ5xhItg+Ja1gwTv+MMJfnCP8ywCCSYBrqOPA7zgKb64twIuBuc5Ghigh0t8hTipAsXgPEMNI3RwFWD4TYsQw/UIvsFn2kPFHTxiH3cYoosmPtaNKRYo4zCMbYFbjDdZpFrI940WXrNsYtzBFMe795mWwrEjhyk52/QAAAAASUVORK5CYII=';

interface IChequeListFilters {
  searchText: string;
  branchFilter: string;
  fromDate: string;
  toDate: string;
}

const defaultFilters: IChequeListFilters = {
  searchText: '',
  branchFilter: '__ALL__',
  fromDate: '',
  toDate: ''
};

const pageSize = 20;
const dateOnly = (value: string): string => value ? value.substring(0, 10) : '';
const formatDate = (value: string): string => {
  const date = dateOnly(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '—';
  const pieces = date.split('-');
  return pieces[2] + '/' + pieces[1] + '/' + pieces[0];
};
const money = (value: number): string =>
  '₹' + value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

export const ChequeEntryList: React.FC<IChequeEntryListProps> = ({
  entries,
  branches,
  loading,
  error,
  hasMore,
  canAdd,
  canEdit,
  branchWarning,
  onRefresh,
  onAdd,
  onView,
  onEdit
}) => {
  // Draft values only change the fields. The table uses appliedFilters.
  const [draftFilters, setDraftFilters] = React.useState<IChequeListFilters>(
    () => ({ ...defaultFilters })
  );
  const [appliedFilters, setAppliedFilters] = React.useState<IChequeListFilters>(
    () => ({ ...defaultFilters })
  );
  const [filterError, setFilterError] = React.useState<string | undefined>();
  const [pageIndex, setPageIndex] = React.useState(0);

  const handleApplyFilters = React.useCallback((): void => {
    if (draftFilters.fromDate && draftFilters.toDate &&
        draftFilters.fromDate > draftFilters.toDate) {
      setFilterError('Entry Date From must be on or before Entry Date To.');
      return;
    }

    setFilterError(undefined);
    setAppliedFilters({ ...draftFilters });
    setPageIndex(0);
  }, [draftFilters]);

  const handleClearFilters = React.useCallback((): void => {
    setDraftFilters({ ...defaultFilters });
    setAppliedFilters({ ...defaultFilters });
    setFilterError(undefined);
    setPageIndex(0);
  }, []);

  const branchOptions = React.useMemo<readonly ILookupOption[]>(() => [
    { key: '__ALL__', value: '__ALL__', text: 'All branches' },
    ...branches.map(branch => ({
      key: branch.id,
      value: branch.id,
      text: branch.name
    }))
  ], [branches]);

  const branchNameByCode = React.useMemo(() => {
    const names = new Map<string, string>();
    branches.forEach(branch => names.set(branch.id.trim().toUpperCase(), branch.name));
    return names;
  }, [branches]);

  const branchName = (code: string): string =>
    branchNameByCode.get(code.trim().toUpperCase()) || code || '—';

  const filtered = React.useMemo(() => {
    const query = appliedFilters.searchText.trim().toLowerCase();
    return entries.filter(item => {
      const date = dateOnly(item.entryDate);
      const branchMatches = appliedFilters.branchFilter === '__ALL__' ||
        item.branchId.trim().toUpperCase() ===
        appliedFilters.branchFilter.trim().toUpperCase();
      const datesMatch = (!appliedFilters.fromDate || date >= appliedFilters.fromDate) &&
        (!appliedFilters.toDate || date <= appliedFilters.toDate);
      const textMatches = !query || [
        item.chequeNo, item.bank, item.branchId,
        branchNameByCode.get(item.branchId.trim().toUpperCase()) || ''
      ].some(value => value.toLowerCase().indexOf(query) !== -1);
      return branchMatches && datesMatch && textMatches;
    });
  }, [entries, appliedFilters, branchNameByCode]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePageIndex = Math.min(pageIndex, pages - 1);
  const visible = filtered.slice(safePageIndex * pageSize, (safePageIndex + 1) * pageSize);
  const totalAmount = filtered.reduce((sum, entry) => sum + entry.amount, 0);
  const totalAssigned = filtered.reduce((sum, entry) => sum + entry.totalAllocated, 0);
  const totalUnallocated = filtered.reduce((sum, entry) => sum + entry.unallocated, 0);

  return (
    <PageContainer
      title="Cheque Entry"
      description="Saved cheque entries for the selected company. Click a cheque number to view full details."
    >
      <div className={styles.layout}>
        <section className={styles.filterPanel} aria-label="Cheque entry filters">
          <div className={styles.toolbar}>
            <div>
              <h3>Cheque entries</h3>
              <p>Search and review cheques recorded in SharePoint.</p>
            </div>
            <div className={styles.actions}>
              <Button
                label="Refresh"
                onClick={onRefresh}
                disabled={loading}
              />
              <Button
                label="+ Add Cheque"
                variant="primary"
                onClick={onAdd}
                disabled={!canAdd}
              />
            </div>
          </div>

          <div className={styles.filters}>
            <InputField
              label="Search"
              value={draftFilters.searchText}
              placeholder="Cheque number, bank or branch"
              onChange={value => {
                setDraftFilters(current => ({ ...current, searchText: value }));
              }}
            />
            <Dropdown
              label="Branch"
              options={branchOptions}
              value={draftFilters.branchFilter}
              searchable
              onChange={value => {
                setDraftFilters(current => ({
                  ...current,
                  branchFilter: typeof value === 'string' ? value : '__ALL__'
                }));
              }}
            />
            <div className={styles.dateFilter}>
              <label htmlFor="cheque-list-from-date" className={styles.dateFilterLabel}>
                Entry Date From
              </label>
              <input
                id="cheque-list-from-date"
                className={styles.dateFilterInput}
                type="date"
                value={draftFilters.fromDate}
                onChange={event => {
                  const value = event.currentTarget.value;
                  setDraftFilters(current => ({ ...current, fromDate: value }));
                }}
              />
            </div>
            <div className={styles.dateFilter}>
              <label htmlFor="cheque-list-to-date" className={styles.dateFilterLabel}>
                Entry Date To
              </label>
              <input
                id="cheque-list-to-date"
                className={styles.dateFilterInput}
                type="date"
                value={draftFilters.toDate}
                onChange={event => {
                  const value = event.currentTarget.value;
                  setDraftFilters(current => ({ ...current, toDate: value }));
                }}
              />
            </div>
          </div>
          <div
            className={styles.actions}
            style={{ justifyContent: 'flex-end', marginTop: 16 }}
          >
            <Button
              label="Clear"
              onClick={handleClearFilters}
            />
            <Button
              label="Apply"
              variant="primary"
              onClick={handleApplyFilters}
              disabled={loading}
            />
          </div>
          {filterError ? (
            <p className={styles.warning} role="alert">{filterError}</p>
          ) : null}
          {branchWarning ? (
            <p className={styles.warning} role="alert">{branchWarning}</p>
          ) : null}
          {hasMore ? (
            <p className={styles.warning} role="note">
              Showing the latest 500 entries only. Search and totals apply to these loaded entries.
            </p>
          ) : null}
        </section>

        {error ? (
          <div className={styles.error} role="alert">
            Could not load cheque entries: {error}. Select Refresh to retry.
          </div>
        ) : null}

        {!error && !loading ? (
          <div className={styles.summaryGrid} aria-label="Cheque entry overview">
            <div className={styles.summaryItem}>
              <span>Entries</span><strong>{filtered.length}</strong>
            </div>
            <div className={styles.summaryItem}>
              <span>Total Cheque Amount</span><strong>{money(totalAmount)}</strong>
            </div>
            <div className={styles.summaryItem}>
              <span>Allocated to Bills</span><strong>{money(totalAssigned)}</strong>
            </div>
            <div className={styles.summaryItem}>
              <span>Unallocated</span><strong>{money(totalUnallocated)}</strong>
            </div>
          </div>
        ) : null}

        <section className={styles.tableShell} aria-label="Saved cheque entries">
          <div className={styles.tableHeader}>
            <strong>Saved cheques <span className={styles.count}>{filtered.length} rows</span></strong>
            <span className={styles.hint}>Scroll horizontally for more columns</span>
          </div>

          {loading ? (
            <div className={styles.state} role="status">Loading cheque entries...</div>
          ) : error ? (
            <div className={styles.state}>The list could not be loaded.</div>
          ) : filtered.length === 0 ? (
            <div className={styles.state}>No cheque entries found for these filters.</div>
          ) : (
            <>
              <div className={styles.tableScroll} role="region" tabIndex={0} aria-label="Cheque entry table">
                <table className={styles.table}>
                  <caption className={styles.srOnly}>Saved cheques for the selected company</caption>
                  <thead>
                    <tr>
                      <th className={styles.stickyNumber} scope="col">No.</th>
                      <th className={styles.stickyIdentity} scope="col">Cheque No</th>
                      <th scope="col">Entry Date</th>
                      <th scope="col">Branch</th>
                      <th scope="col">Cheque Date</th>
                      <th scope="col">Bank</th>
                      <th className={styles.numeric} scope="col">Amount</th>
                      <th className={styles.numeric} scope="col">Allocated</th>
                      <th className={styles.numeric} scope="col">Unallocated</th>
                      <th className={styles.numeric} scope="col">Bills</th>
                      <th className={styles.actionsHeading} scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((item, index) => (
                      <tr key={item.id}>
                        <td className={styles.stickyNumber}>{safePageIndex * pageSize + index + 1}</td>
                        <td className={styles.stickyIdentity}>
                          <button
                            type="button"
                            className={styles.chequeLink}
                            onClick={() => onView(item)}
                            aria-label={'View details for cheque ' + item.chequeNo}
                          >{item.chequeNo || '—'}</button>
                        </td>
                        <td>{formatDate(item.entryDate)}</td>
                        <td>{branchName(item.branchId)}</td>
                        <td>{formatDate(item.chequeDate)}</td>
                        <td>{item.bank || '—'}</td>
                        <td className={styles.numeric}>{money(item.amount)}</td>
                        <td className={styles.numeric}>{money(item.totalAllocated)}</td>
                        <td className={styles.numeric}>{money(item.unallocated)}</td>
                        <td className={styles.numeric}>{item.billCount}</td>
                        <td className={styles.actionCell}>
                          <div className={styles.actionButtons}>
                          <button
                            type="button"
                            className={styles.rowAction}
                            onClick={() => onView(item)}
                            aria-label={'View details for cheque ' + item.chequeNo}
                            title="View Details"
                          >
                            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"
                              stroke="currentColor" strokeWidth="1.8"
                              strokeLinecap="round" strokeLinejoin="round">
                              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className={styles.rowAction}
                            disabled={!canEdit || item.billsReadError ||
                              !branches.some(branch => branch.id === item.branchId)}
                            onClick={() => onEdit(item)}
                            aria-label={'Edit cheque ' + item.chequeNo}
                            title="Edit Cheque"
                          >
                            <img
                              src={unitMasterEditIcon}
                              alt=""
                              aria-hidden="true"
                              width={16}
                              height={16}
                              draggable={false}
                              style={{ display: 'block', width: 16, height: 16, pointerEvents: 'none' }}
                            />
                          </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.pagination}>
                <span>Showing {safePageIndex * pageSize + 1}–{Math.min((safePageIndex + 1) * pageSize, filtered.length)} of {filtered.length}</span>
                <div>
                  <button type="button" disabled={safePageIndex === 0}
                    onClick={() => setPageIndex(current => Math.max(0, current - 1))}>Previous</button>
                  <span> Page {safePageIndex + 1} of {pages} </span>
                  <button type="button" disabled={safePageIndex >= pages - 1}
                    onClick={() => setPageIndex(current => Math.min(pages - 1, current + 1))}>Next</button>
                </div>
              </div>
            </>
          )}
        </section>

      </div>
    </PageContainer>
  );
};
