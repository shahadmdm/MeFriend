import type { ApiClient } from '../../../../shared/api/apiClient';

import { apiRoutes } from '../../config/apiConfig';

export type BusinessReportCriteria = 'Unit' | 'Salesperson';

/** Collection totals returned by the CollectionVerticalReport backend. */
export interface ICollectionReportTotal {
  targetType: BusinessReportCriteria;
  targetCode: string;
  branchCode: string;
  receiptCollection: number;
  paymentCollection: number;
  entryCount: number;
}

/** Request contract kept compatible with existing page/service callers. */
export interface IBusinessReportRequest {
  companyId: string;
  month: number;
  year: number;
  targetType: BusinessReportCriteria;
  periodicity?: number;
  /** Optional filters; multiple codes are sent as repeated query parameters. */
  salespersonCodes?: readonly string[];
  branchCodes?: readonly string[];
}

export class CollectionVerticalReportApiService {
  public constructor(
    private readonly apiClient: ApiClient
  ) {}

  public async getCollectionReportTotals(
    request: IBusinessReportRequest
  ): Promise<readonly ICollectionReportTotal[]> {
    const companyId = request.companyId.trim();

    if (!companyId) {
      throw new Error('Company ID is required.');
    }

    if (
      !Number.isInteger(request.month) ||
      request.month < 1 ||
      request.month > 12
    ) {
      throw new Error('Invalid report month.');
    }

    if (
      !Number.isInteger(request.year) ||
      request.year < 1 ||
      request.year > 9999 ||
      (request.year === 9999 && request.month === 12)
    ) {
      throw new Error('Invalid report year.');
    }

    if (
      request.targetType !== 'Unit' &&
      request.targetType !== 'Salesperson'
    ) {
      throw new Error('Invalid report criteria.');
    }

    const periodicity = request.periodicity ?? 1;
    const availableMonths = (request.year - 1) * 12 + request.month;

    if (
      !Number.isSafeInteger(periodicity) ||
      periodicity < 1 ||
      periodicity > availableMonths
    ) {
      throw new Error('Invalid report periodicity.');
    }

    const query = [
      `companyId=${encodeURIComponent(companyId)}`,
      `month=${request.month}`,
      `year=${request.year}`,
      `targetType=${encodeURIComponent(request.targetType)}`,
      `periodicity=${periodicity}`
    ].join('&');

    const filters: string[] = [];

    const appendCodeFilters = (
      fieldName: string,
      values: readonly string[] | undefined
    ): void => {
      if (values === undefined) {
        return;
      }

      if (!Array.isArray(values) || values.length === 0) {
        throw new Error(`Invalid ${fieldName} filters.`);
      }

      const normalized = values.map(code =>
        typeof code === 'string' ? code.trim().toUpperCase() : ''
      );

      if (normalized.some(code => !code || code.length > 100)) {
        throw new Error(`Invalid ${fieldName} filter code.`);
      }

      Array.from(new Set<string>(normalized)).forEach(code => {
        filters.push(`${fieldName}=${encodeURIComponent(code)}`);
      });
    };

    appendCodeFilters('salespersonCode', request.salespersonCodes);
    appendCodeFilters('branchCode', request.branchCodes);

    const fullQuery = [query, ...filters].join('&');

    const response = await this.apiClient.get<
      ICollectionReportTotal[]
    >(`${apiRoutes.collectionReportTotals}?${fullQuery}`);

    if (!Array.isArray(response.data)) {
      throw new Error('Collection Report API did not return an array.');
    }

    // Fail rather than silently showing zeros for an unexpected DTO.
    for (const row of response.data) {
      if (
        (row.targetType !== 'Unit' && row.targetType !== 'Salesperson') ||
        typeof row.targetCode !== 'string' ||
        typeof row.branchCode !== 'string' ||
        typeof row.receiptCollection !== 'number' ||
        !Number.isFinite(row.receiptCollection) ||
        typeof row.paymentCollection !== 'number' ||
        !Number.isFinite(row.paymentCollection) ||
        typeof row.entryCount !== 'number' ||
        !Number.isSafeInteger(row.entryCount) ||
        row.entryCount < 0
      ) {
        throw new Error('Collection Report API returned invalid totals.');
      }
    }

    return response.data;
  }

  /** Preserve the existing method name during frontend migration. */
  public getBusinessReportTotals(
    request: IBusinessReportRequest
  ): Promise<readonly ICollectionReportTotal[]> {
    return this.getCollectionReportTotals(request);
  }
}
