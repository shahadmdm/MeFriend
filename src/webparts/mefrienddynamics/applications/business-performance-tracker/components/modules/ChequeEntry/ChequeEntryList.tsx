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
  branchWarning?: string;
  onRefresh: () => void;
  onAdd: () => void;
}

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
  branchWarning,
  onRefresh,
  onAdd
}) => {
  const [searchText, setSearchText] = React.useState('');
  const [branchFilter, setBranchFilter] = React.useState('__ALL__');
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');
  const [pageIndex, setPageIndex] = React.useState(0);
  const [selectedEntryId, setSelectedEntryId] = React.useState<number | undefined>();

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
    const query = searchText.trim().toLowerCase();
    return entries.filter(item => {
      const date = dateOnly(item.entryDate);
      const branchMatches = branchFilter === '__ALL__' ||
        item.branchId.trim().toUpperCase() === branchFilter.trim().toUpperCase();
      const datesMatch = (!fromDate || date >= fromDate) &&
        (!toDate || date <= toDate);
      const textMatches = !query || [
        item.chequeNo, item.bank, item.branchId,
        branchNameByCode.get(item.branchId.trim().toUpperCase()) || ''
      ].some(value => value.toLowerCase().indexOf(query) !== -1);
      return branchMatches && datesMatch && textMatches;
    });
  }, [entries, searchText, branchFilter, fromDate, toDate, branchNameByCode]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePageIndex = Math.min(pageIndex, pages - 1);
  const visible = filtered.slice(safePageIndex * pageSize, (safePageIndex + 1) * pageSize);
  const selected = entries.find(entry => entry.id === selectedEntryId);
  const totalAmount = filtered.reduce((sum, entry) => sum + entry.amount, 0);
  const totalAssigned = filtered.reduce((sum, entry) => sum + entry.totalAllocated, 0);
  const totalUnallocated = filtered.reduce((sum, entry) => sum + entry.unallocated, 0);

  return (
    <PageContainer
      title="Cheque Entry"
      description="Saved cheque entries for the selected company. Click a cheque number to view bill assignments."
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
              value={searchText}
              placeholder="Cheque number, bank or branch"
              onChange={value => {
                setSearchText(value);
                setPageIndex(0);
              }}
            />
            <Dropdown
              label="Branch"
              options={branchOptions}
              value={branchFilter}
              searchable
              onChange={value => {
                setBranchFilter(typeof value === 'string' ? value : '__ALL__');
                setPageIndex(0);
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
                value={fromDate}
                onChange={event => {
                  setFromDate(event.currentTarget.value);
                  setPageIndex(0);
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
                value={toDate}
                onChange={event => {
                  setToDate(event.currentTarget.value);
                  setPageIndex(0);
                }}
              />
            </div>
          </div>
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
                            onClick={() => setSelectedEntryId(item.id)}
                            aria-label={'View bill assignments for cheque ' + item.chequeNo}
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

        {selected ? (
          <section className={styles.detailPanel} aria-label="Bill assignment details">
            <div className={styles.detailHeader}>
              <div>
                <h3>Bill Assign — {selected.chequeNo}</h3>
                <p>{branchName(selected.branchId)} · {formatDate(selected.entryDate)} · {money(selected.amount)}</p>
              </div>
              <button type="button" onClick={() => setSelectedEntryId(undefined)}>Close</button>
            </div>
            {selected.billsReadError ? (
              <div className={styles.error} role="alert">Some saved bill details could not be read. Please inspect the SharePoint record.</div>
            ) : null}
            {selected.bills.length ? (
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead><tr>
                    <th scope="col">No.</th><th scope="col">Bill</th>
                    <th scope="col">Bill Amount</th><th scope="col">Balance at Entry</th>
                    <th scope="col">Assigned</th>
                  </tr></thead>
                  <tbody>
                    {selected.bills.map((bill, index) => (
                      <tr key={String(selected.id) + ':' + String(index)}>
                        <td>{index + 1}</td><td>{bill.billNo}</td>
                        <td>{money(bill.billAmount)}</td><td>{money(bill.balance)}</td>
                        <td>{money(bill.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className={styles.state}>No readable bill assignments.</div>}
          </section>
        ) : null}
      </div>
    </PageContainer>
  );
};
