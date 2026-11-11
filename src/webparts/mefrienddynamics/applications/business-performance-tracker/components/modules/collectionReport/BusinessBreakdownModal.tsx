
import * as React from 'react';

import { EntityModal } from '../../../../../shared/components/forms/EntityModal';
import { AmountDisplay } from '../../../../../shared/components/amountDisplay/AmountDisplay';

import type { IBusinessReportCell } from '../../../services/businessReport/businessReportMapper';

import styles from './BusinessBreakdownModal.module.scss';

export interface IBusinessBreakdownModalProps {
  isOpen: boolean;
  name: string;
  code: string;
  verticalName: string;
  cell?: IBusinessReportCell;
  onDismiss: () => void;
}

export const BusinessBreakdownModal: React.FC<IBusinessBreakdownModalProps> = ({
  isOpen,
  name,
  code,
  verticalName,
  cell,
  onDismiss
}) => {
  const currencyCode = cell?.currencyCode || undefined;

  return (
    <EntityModal
      isOpen={isOpen}
      title="Business Breakdown"
      subtitle={`${name} (${code}) · ${verticalName}`}
      size="small"
      onDismiss={onDismiss}
    >
      <div className={styles.breakdown}>
        <div className={styles.amountRow}>
          <div className={styles.amountDetails}>
            <span className={styles.amountLabel}>
              Original Business
            </span>
            <span className={styles.amountDescription}>
              Posted sales invoices
            </span>
          </div>

          <div className={styles.amountValue}>
            <AmountDisplay
              amount={cell?.originalBusinessAmount}
              currencyCode={currencyCode}
            />
          </div>
        </div>

        <div className={styles.amountRow}>
          <div className={styles.amountDetails}>
            <span className={styles.amountLabel}>
              Credit Memo
            </span>
            <span className={styles.amountDescription}>
              Signed credit memo adjustment
            </span>
          </div>

          <div className={`${styles.amountValue} ${styles.creditAmount}`}>
            <AmountDisplay
              amount={cell?.creditMemoAmount}
              currencyCode={currencyCode}
            />
          </div>
        </div>

        <div className={`${styles.amountRow} ${styles.finalRow}`}>
          <div className={styles.amountDetails}>
            <span className={styles.finalLabel}>
              Final Business
            </span>
            <span className={styles.amountDescription}>
              Original Business + Credit Memo
            </span>
          </div>

          <div className={styles.finalAmount}>
            <AmountDisplay
              amount={cell?.businessAmount}
              currencyCode={currencyCode}
              variant="total"
            />
          </div>
        </div>
      </div>
    </EntityModal>
  );
};
