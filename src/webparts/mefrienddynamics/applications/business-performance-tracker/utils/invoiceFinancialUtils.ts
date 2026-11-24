import type { PaymentStatus } from '../models/invoices';

const isValidNumber = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const calculateOutstandingAmount = (
  totalAmount: number | undefined,
  paidAmount?: number,
  backendOutstandingAmount?: number
): number | undefined => {
  if (isValidNumber(backendOutstandingAmount)) {
    return backendOutstandingAmount;
  }

  if (!isValidNumber(totalAmount)) {
    return undefined;
  }

  return totalAmount - (isValidNumber(paidAmount) ? paidAmount : 0);
};

export const calculatePaymentStatus = (
  paidAmount?: number,
  outstandingAmount?: number,
  backendStatus?: PaymentStatus
): PaymentStatus => {
  if (backendStatus && backendStatus.trim()) {
    return backendStatus;
  }

  if (!isValidNumber(outstandingAmount)) {
    return 'Unknown';
  }

  if (outstandingAmount <= 0) {
    return 'Paid';
  }

  if (isValidNumber(paidAmount) && paidAmount > 0) {
    return 'Partially Paid';
  }

  return 'Unpaid';
};
