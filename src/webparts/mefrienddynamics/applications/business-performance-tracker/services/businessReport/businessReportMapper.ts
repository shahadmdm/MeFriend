
import type { ITargetListItem } from '../../models/targets';
import type { IVerticalListItem } from '../../models/verticals';

export interface IBusinessReportTotal {
  targetType: 'Unit' | 'Salesperson';
  targetCode: string;
  itemCode: string;
  currencyCode: string;
  businessAmountExclGST: number;
}

export interface IBusinessReportCell {
  businessAmount?: number;
  achievementPercentage?: number;
  currencyCode?: string;
}

const normalizeCode = (value: string | undefined): string =>
  (value || '').trim().toUpperCase();

export const getBusinessReportCell = (
  target: ITargetListItem,
  vertical: IVerticalListItem,
  totals: readonly IBusinessReportTotal[]
): IBusinessReportCell => {
  if (
    target.companyId !== vertical.companyId ||
    target.verticalId !== vertical.id ||
    !normalizeCode(vertical.bcItemId)
  ) {
    return {};
  }

  const matching = totals.filter(item =>
    item.targetType === target.targetType &&
    normalizeCode(item.targetCode) ===
      normalizeCode(target.targetCode) &&
    normalizeCode(item.itemCode) ===
      normalizeCode(vertical.bcItemId)
  );

  if (matching.length === 0) {
    return {};
  }

  const currencies = new Set(
    matching.map(item => normalizeCode(item.currencyCode))
  );

  if (currencies.size > 1) {
    throw new Error(
      `Multiple currencies found for ${target.targetCode} / ` +
      `${vertical.verticalName}. Currency conversion is required.`
    );
  }

  const businessAmount = matching.reduce(
    (sum, item) => sum + item.businessAmountExclGST,
    0
  );

  return {
    businessAmount,
    currencyCode: normalizeCode(matching[0].currencyCode),
    achievementPercentage:
      target.targetAmount !== 0
        ? (businessAmount / target.targetAmount) * 100
        : undefined
  };
};
