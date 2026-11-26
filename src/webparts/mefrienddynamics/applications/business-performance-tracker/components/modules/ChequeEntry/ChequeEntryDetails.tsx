import * as React from 'react';
import { PageContainer } from '../../../../../shared/components/pageContainer/PageContainer';
import { FormSection } from '../../../../../shared/components/forms/FormSection';
import { Button } from '../../../../../shared/components/buttons/Button';
import type { IChequeEntryListItem } from '../../../services/ChequeEntry/ChequeEntrySharePointService';
import type { IBranchOption } from './ChequeEntryForm';
import styles from './ChequeEntryDetails.module.scss';

export interface IChequeEntryDetailsProps {
  entry: IChequeEntryListItem;
  branches: readonly IBranchOption[];
  onBack: () => void;
  onEdit?: () => void;
}

const money = (amount: number): string =>
  '₹' + amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const prettyDate = (value: string): string => {
  const date = (value || '').substring(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '—';
  return date.substring(8, 10) + '/' + date.substring(5, 7) + '/' + date.substring(0, 4);
};

export const ChequeEntryDetails: React.FC<IChequeEntryDetailsProps> = ({
  entry, branches, onBack, onEdit
}) => {
  const branch = branches.find(item =>
    item.id.trim().toLowerCase() === entry.branchId.trim().toLowerCase()
  );
  const details = [
    { label: 'Branch', value: branch ? branch.name : entry.branchId },
    { label: 'Entry Date', value: prettyDate(entry.entryDate) },
    { label: 'Cheque No', value: entry.chequeNo },
    { label: 'Cheque Date', value: prettyDate(entry.chequeDate) },
    { label: 'Bank', value: entry.bank },
    { label: 'Amount (INR)', value: money(entry.amount) }
  ];

  return (
    <PageContainer title="Cheque Details" description={'Saved entry: ' + entry.chequeNo}>
      <div className={styles.actions}>
        <Button label="Back to Cheque Entries" onClick={onBack} />
        {onEdit ? <Button label="Edit Cheque" variant="primary" onClick={onEdit} /> : null}
      </div>
      <FormSection title="Cheque Details">
        <div className={styles.detailsGrid}>
          {details.map(item => (
            <div key={item.label} className={styles.detail}>
              <span>{item.label}</span>
              <strong>{item.value || '—'}</strong>
            </div>
          ))}
        </div>
      </FormSection>
      <FormSection title="Bill Assign">
        <div className={styles.bills}>
          <div className={styles.totals}>
            <span>Cheque: <strong>{money(entry.amount)}</strong></span>
            <span>Allocated: <strong>{money(entry.totalAllocated)}</strong></span>
            <span>Remaining: <strong>{money(entry.unallocated)}</strong></span>
          </div>
          {entry.billsReadError ? (
            <p role="alert" className={styles.warning}>
              Some saved bill values are unreadable. Editing is disabled.
            </p>
          ) : null}
          {entry.bills.length > 0 ? (
            <div className={styles.tableScroll}>
              <table className={styles.billTable}>
                <thead><tr>
                  <th scope="col">No.</th><th scope="col">Bill No</th>
                  <th scope="col">Bill Amount</th><th scope="col">Balance at Entry</th>
                  <th scope="col">Assigned Amount</th>
                </tr></thead>
                <tbody>
                  {entry.bills.map((bill, index) => (
                    <tr key={entry.id + ':' + index}>
                      <td>{index + 1}</td>
                      <td>{bill.billNo}</td>
                      <td>{money(bill.billAmount)}</td>
                      <td>{money(bill.balance)}</td>
                      <td>{money(bill.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p>No readable bill assignments.</p>}
        </div>
      </FormSection>
    </PageContainer>
  );
};
