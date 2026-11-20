import * as React from 'react';

import type { ILookupOption } from '../../../../../shared/models/ILookupOption';
import { Dropdown } from '../../../../../shared/components/dropdowns/Dropdown';
import { InputField } from '../../../../../shared/components/inputs/InputField';
import { Button } from '../../../../../shared/components/buttons/Button';
import { FormSection } from '../../../../../shared/components/forms/FormSection';
import { FormFooter } from '../../../../../shared/components/forms/FormFooter';
import { PageContainer } from '../../../../../shared/components/pageContainer/PageContainer';
import { useToast } from '../../../../../shared/components/toast/useToast';
import { getUserFriendlyError } from '../../../../../shared/api/apiErrorHandler';
import formStyles from '../../../../../shared/components/forms/Forms.module.scss';

import styles from './ChequeEntryForm.module.scss';

// Keep these public interfaces unchanged: ChequeEntryPage and the existing
// SharePoint save service use this payload and these option properties.
export interface IBranchOption {
  id: string; // Unit Code from global Unit Master
  name: string;
}

export interface IChequeBill {
  billNo: string;
  billAmount: number;
  balance: number;
  amount: number;
}

export interface IChequeEntryPayload {
  branchId: string;
  entryDate: string; // YYYY-MM-DD
  chequeNo: string;
  chequeDate: string; // YYYY-MM-DD
  bank: string;
  amount: number;
  bills: IChequeBill[];
}

export interface IChequeEntryFormProps {
  branches: IBranchOption[];
  onSave: (entry: IChequeEntryPayload) => Promise<void> | void;
  /** Called after SharePoint confirms the save and the success toast is shown. */
  onSaved?: () => void;
  /** Return to the saved Cheque Entries table. */
  onBack?: () => void;
}

interface IBillRow {
  id: number;
  billNo: string;
  billAmount: string;
  balance: string;
  amount: string;
}

type BillField = 'billNo' | 'billAmount' | 'balance' | 'amount';

const createBillRow = (id: number): IBillRow => ({
  id,
  billNo: '',
  billAmount: '',
  balance: '',
  amount: ''
});

const localToday = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = ('0' + (today.getMonth() + 1)).slice(-2);
  const day = ('0' + today.getDate()).slice(-2);
  return `${year}-${month}-${day}`;
};

const numericValue = (value: string): number =>
  value.trim() === '' ? NaN : Number(value);

const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const formatMoney = (value: number): string =>
  value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const isValidMoney = (value: string, allowZero: boolean = false): boolean => {
  const number = numericValue(value);
  return Number.isFinite(number) &&
    (allowZero ? number >= 0 : number > 0) &&
    /^\d+(?:\.\d{1,2})?$/.test(value.trim());
};

export const ChequeEntryForm: React.FC<IChequeEntryFormProps> = ({
  branches,
  onSave,
  onSaved,
  onBack
}) => {
  const toast = useToast();
  const [branchId, setBranchId] = React.useState<string>('');
  const [entryDate, setEntryDate] = React.useState<string>(localToday());
  const [chequeNo, setChequeNo] = React.useState<string>('');
  const [chequeDate, setChequeDate] = React.useState<string>('');
  const [bank, setBank] = React.useState<string>('');
  const [amount, setAmount] = React.useState<string>('');
  const [bills, setBills] = React.useState<IBillRow[]>([createBillRow(1)]);
  const nextBillId = React.useRef<number>(2);
  const savingRef = React.useRef<boolean>(false);
  const [saving, setSaving] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string>('');
  const [success, setSuccess] = React.useState<string>('');

  const branchOptions = React.useMemo<readonly ILookupOption[]>(
    () => branches.map(branch => ({
      key: branch.id,
      text: branch.name,
      value: branch.id
    })),
    [branches]
  );

  const totalAllocated = React.useMemo(() =>
    roundMoney(bills.reduce((total, bill) => {
      const value = numericValue(bill.amount);
      return total + (Number.isFinite(value) ? value : 0);
    }, 0)),
    [bills]
  );

  const chequeAmount = isValidMoney(amount) ? numericValue(amount) : 0;
  const unallocated = roundMoney(chequeAmount - totalAllocated);

  const clearFeedback = (): void => {
    setError('');
    setSuccess('');
  };

  const updateBill = (id: number, field: BillField, value: string): void => {
    setBills(previous => previous.map(bill =>
      bill.id === id ? { ...bill, [field]: value } : bill
    ));
    clearFeedback();
  };

  const addBill = (): void => {
    const id = nextBillId.current;
    nextBillId.current += 1;
    setBills(previous => [...previous, createBillRow(id)]);
    clearFeedback();
  };

  const deleteBill = (id: number): void => {
    setBills(previous => previous.length > 1
      ? previous.filter(bill => bill.id !== id)
      : [createBillRow(id)]);
    clearFeedback();
  };

  const resetForm = (): void => {
    setBranchId('');
    setEntryDate(localToday());
    setChequeNo('');
    setChequeDate('');
    setBank('');
    setAmount('');
    setBills([createBillRow(1)]);
    nextBillId.current = 2;
  };

  const fail = (message: string): void => {
    setError(message);
    toast.error(message, { title: 'Cheque Entry' });
  };

  const finishSaving = (): void => {
    savingRef.current = false;
    setSaving(false);
  };

  const submit = async (): Promise<void> => {
    if (savingRef.current) return;
    setError('');
    setSuccess('');

    if (!branchId || !branches.some(branch => branch.id === branchId)) {
      fail('Select a branch from Unit Master.');
      return;
    }
    if (!entryDate || !chequeNo.trim() || !chequeDate || !bank.trim()) {
      fail('Complete Entry Date, Cheque No, Cheque Date and Bank.');
      return;
    }
    if (!isValidMoney(amount)) {
      fail('Enter a valid cheque amount greater than zero (maximum 2 decimal places).');
      return;
    }

    for (let index = 0; index < bills.length; index++) {
      const bill = bills[index];
      if (!bill.billNo.trim() || !isValidMoney(bill.billAmount) ||
          !isValidMoney(bill.balance, true) || !isValidMoney(bill.amount)) {
        fail(`Complete all fields in Bill ${index + 1} with valid amounts.`);
        return;
      }
      if (roundMoney(numericValue(bill.balance)) >
          roundMoney(numericValue(bill.billAmount))) {
        fail(`Bill ${index + 1}: Balance cannot exceed Bill Amount.`);
        return;
      }
      if (roundMoney(numericValue(bill.amount)) >
          roundMoney(numericValue(bill.balance))) {
        fail(`Bill ${index + 1}: Assigned Amount cannot exceed the bill's Balance.`);
        return;
      }
    }
    if (totalAllocated > chequeAmount + 0.001) {
      fail('Total bill assignment cannot exceed the cheque amount.');
      return;
    }

    const payload: IChequeEntryPayload = {
      branchId,
      entryDate,
      chequeNo: chequeNo.trim(),
      chequeDate,
      bank: bank.trim(),
      amount: roundMoney(chequeAmount),
      bills: bills.map(bill => ({
        billNo: bill.billNo.trim(),
        billAmount: roundMoney(numericValue(bill.billAmount)),
        balance: roundMoney(numericValue(bill.balance)),
        amount: roundMoney(numericValue(bill.amount))
      }))
    };

    savingRef.current = true;
    setSaving(true);
    try {
      await onSave(payload);
      resetForm();
      setSuccess('Cheque entry saved successfully.');
      toast.success('Cheque entry saved successfully.', { title: 'Cheque Entry' });
      if (onSaved) {
        onSaved();
      }
    } catch (saveError) {
      fail(getUserFriendlyError(saveError));
    } finally {
      finishSaving();
    }
  };

  return (
    <PageContainer
      title="Cheque Entry"
      description="Enter cheque details and assign the amount to bills."
    >
      {onBack ? (
        <div className={styles.pageActions}>
          <Button
            label="Back to Cheque Entries"
            onClick={onBack}
            disabled={saving}
          />
        </div>
      ) : null}
      <form
        className={formStyles.entityForm}
        noValidate
        onSubmit={event => {
          event.preventDefault();
          submit().catch(() => undefined);
        }}
      >
        <div className={formStyles.formBody}>
          <FormSection title="Cheque Details">
            <Dropdown
              label="Branch"
              value={branchId}
              options={branchOptions}
              required
              searchable
              placeholder="Select branch from Unit Master"
              onChange={value => {
                setBranchId(typeof value === 'string' ? value : '');
                clearFeedback();
              }}
            />
            <div className={styles.dateControl}>
              <label className={styles.dateLabel} htmlFor="cheque-entry-date">
                Entry Date <span aria-hidden="true">*</span>
              </label>
              <input
                id="cheque-entry-date"
                className={styles.dateInput}
                type="date"
                required
                value={entryDate}
                onChange={event => {
                  setEntryDate(event.currentTarget.value);
                  clearFeedback();
                }}
              />
            </div>
            <InputField
              label="Cheque No"
              required
              value={chequeNo}
              placeholder="Enter cheque number"
              onChange={value => {
                setChequeNo(value);
                clearFeedback();
              }}
            />
            <div className={styles.dateControl}>
              <label className={styles.dateLabel} htmlFor="cheque-date">
                Cheque Date <span aria-hidden="true">*</span>
              </label>
              <input
                id="cheque-date"
                className={styles.dateInput}
                type="date"
                required
                value={chequeDate}
                onChange={event => {
                  setChequeDate(event.currentTarget.value);
                  clearFeedback();
                }}
              />
            </div>
            <InputField
              label="Bank"
              required
              value={bank}
              placeholder="Enter bank name"
              onChange={value => {
                setBank(value);
                clearFeedback();
              }}
            />
            <InputField
              label="Amount (INR)"
              type="number"
              min={0}
              required
              value={amount}
              placeholder="Enter cheque amount"
              onChange={value => {
                setAmount(value);
                clearFeedback();
              }}
            />
          </FormSection>

          <FormSection title="Bill Assign">
            {/* FormSection lays out direct children in a grid.
                Keep the complete bill editor in one full-width grid item. */}
            <div className={styles.billArea}>
              <div className={styles.billSummary}>
                <span>Cheque: <strong>₹{formatMoney(chequeAmount)}</strong></span>
                <span>Allocated: <strong>₹{formatMoney(totalAllocated)}</strong></span>
                <span>Remaining: <strong className={unallocated < 0 ? styles.negative : ''}>₹{formatMoney(unallocated)}</strong></span>
              </div>

              <div className={styles.tableScroll}>
                <table className={styles.billTable}>
                  <thead>
                    <tr>
                      <th scope="col">Bill No</th>
                      <th scope="col">Bill Amount (₹)</th>
                      <th scope="col">Balance (₹)</th>
                      <th scope="col">Assign Amount (₹)</th>
                      <th scope="col">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map((bill, index) => (
                      <tr key={bill.id}>
                        <td>
                          <input
                            type="text"
                            value={bill.billNo}
                            aria-label={`Bill ${index + 1} number`}
                            onChange={event => updateBill(bill.id, 'billNo', event.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number" min="0.01" step="0.01"
                            value={bill.billAmount}
                            aria-label={`Bill ${index + 1} amount`}
                            onChange={event => updateBill(bill.id, 'billAmount', event.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number" min="0" step="0.01"
                            value={bill.balance}
                            aria-label={`Bill ${index + 1} balance`}
                            onChange={event => updateBill(bill.id, 'balance', event.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number" min="0.01" step="0.01"
                            value={bill.amount}
                            aria-label={`Bill ${index + 1} assigned amount`}
                            onChange={event => updateBill(bill.id, 'amount', event.target.value)}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className={styles.deleteButton}
                            disabled={saving}
                            onClick={() => deleteBill(bill.id)}
                            aria-label={`Delete Bill ${index + 1}`}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={styles.billActions}>
                <Button
                  label="+ Next Bill"
                  onClick={addBill}
                  disabled={saving}
                />
              </div>
            </div>
          </FormSection>

          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          {success ? <p className={styles.success} role="status">{success}</p> : null}
        </div>

        <FormFooter
          submitLabel="Save Cheque"
          cancelLabel="Clear"
          loading={saving}
          disabled={saving}
          onCancel={() => {
            if (!savingRef.current) {
              resetForm();
              clearFeedback();
            }
          }}
          onSubmit={() => { submit().catch(() => undefined); }}
        />
      </form>
    </PageContainer>
  );
};

export default ChequeEntryForm;
