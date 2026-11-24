
import type { ITargetListItem } from '../../models/targets';
import type { IVerticalListItem } from '../../models/verticals';

export interface IBusinessReportTotal {
  targetType: 'Unit' | 'Salesperson';
  targetCode: string;
  branchCode?: string;
  itemCode: string;
  currencyCode: string;

  // Final Business = Original Business + signed Credit Memo.
  // Keep this existing API property for backward compatibility.
  businessAmountExclGST: number;

  originalBusinessAmountExclGST: number;
  creditMemoAmountExclGST: number;
}

export interface IBusinessReportCell {
  // Existing property: Final Business amount.
  businessAmount?: number;

  // Additional amounts for the breakdown modal.
  originalBusinessAmount?: number;
  creditMemoAmount?: number;

  // Existing achievement and currency behavior.
  achievementPercentage?: number;
  currencyCode?: string;
}

const normalizeCode = (value: string | undefined): string =>
  (value || '').trim().toUpperCase();

export const getBusinessReportCell = (
  target: ITargetListItem,
  vertical: IVerticalListItem,
  totals: readonly IBusinessReportTotal[],
  allowedBranchCodes?: readonly string[]
): IBusinessReportCell => {
  if (
    target.companyId !== vertical.companyId ||
    target.verticalId !== vertical.id ||
    !normalizeCode(vertical.bcItemId)
  ) {
    return {};
  }

  // Optional Branch filtering for Unit Access reporting.
  // Undefined preserves the existing legacy calculation.
  // An empty permitted list must not expose any Business.
  const allowedBranches = allowedBranchCodes === undefined
    ? undefined
    : new Set(
        allowedBranchCodes
          .map(normalizeCode)
          .filter(code => code.length > 0)
      );

  const matching = totals.filter(item =>
    item.targetType === target.targetType &&
    normalizeCode(item.targetCode) ===
      normalizeCode(target.targetCode) &&
    normalizeCode(item.itemCode) ===
      normalizeCode(vertical.bcItemId) &&
    (
      allowedBranches === undefined ||
      allowedBranches.has(normalizeCode(item.branchCode))
    )
  );

  if (matching.length === 0) {
    return {};
  }

  // Preserve the existing mixed-currency protection.
  // Amounts from different currencies must never be combined.
  const currencies = new Set(
    matching.map(item => normalizeCode(item.currencyCode))
  );

  if (currencies.size > 1) {
    throw new Error(
      `Multiple currencies found for ${target.targetCode} / ` +
      `${vertical.verticalName}. Currency conversion is required.`
    );
  }

  // Existing Final Business calculation remains unchanged.
  const businessAmount = matching.reduce(
    (sum, item) => sum + item.businessAmountExclGST,
    0
  );

  // New breakdown amounts.
  const originalBusinessAmount = matching.reduce(
    (sum, item) => sum + item.originalBusinessAmountExclGST,
    0
  );

  const creditMemoAmount = matching.reduce(
    (sum, item) => sum + item.creditMemoAmountExclGST,
    0
  );

  return {
    businessAmount,
    originalBusinessAmount,
    creditMemoAmount,
    currencyCode: normalizeCode(matching[0].currencyCode),

    // Achievement is based on Final Business, not Original Business.
    achievementPercentage:
      target.targetAmount !== 0
        ? (businessAmount / target.targetAmount) * 100
        : undefined
  };
};