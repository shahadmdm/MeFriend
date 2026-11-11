import type { ApiClient } from '../../../../shared/api/apiClient';

import type {
  IBusinessReportTotal
} from './businessReportMapper';

export type BusinessReportCriteria = 'Unit' | 'Salesperson';

export interface IBusinessReportRequest {
  companyId: string;
  month: number;
  year: number;
  targetType: BusinessReportCriteria;
  periodicity?: number;
  groupByBranch?: boolean;
}

export class BusinessReportApiService {
  public constructor(
    private readonly apiClient: ApiClient
  ) {}

  public async getBusinessReportTotals(
    request: IBusinessReportRequest
  ): Promise<readonly IBusinessReportTotal[]> {
    const companyId = request.companyId.trim();
    const periodicity = request.periodicity ?? 1;

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

    if (
      !Number.isSafeInteger(periodicity) ||
      periodicity < 1
    ) {
      throw new Error(
        'Periodicity must be a positive whole number.'
      );
    }

    const selectedMonthIndex =
      (request.year - 1) * 12 + request.month - 1;

    if (periodicity - 1 > selectedMonthIndex) {
      throw new Error(
        'The selected reporting period starts before year 1.'
      );
    }

    const response = await this.apiClient.get<
      IBusinessReportTotal[]
    >('/api/BusinessReport/totals', {
      companyId,
      month: request.month,
      year: request.year,
      targetType: request.targetType,
      periodicity,
      groupByBranch: request.groupByBranch === true
    });

    if (!response.data) {
      throw new Error(
        'Business Report API did not return report data.'
      );
    }

    return response.data;
  }
}