
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
}

export class CollectionVerticalReportApiService {
  public constructor(
    private readonly apiClient: ApiClient
  ) {}

  public async getBusinessReportTotals(
    request: IBusinessReportRequest
  ): Promise<readonly IBusinessReportTotal[]> {
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

    const query = [
      `companyId=${encodeURIComponent(companyId)}`,
      `month=${request.month}`,
      `year=${request.year}`,
      `targetType=${encodeURIComponent(request.targetType)}`
    ].join('&');

    const response = await this.apiClient.get<
      IBusinessReportTotal[]
    >(`/api/BusinessReport/totals?${query}`);

    if (!response.data) {
      throw new Error(
        'Business Report API did not return report data.'
      );
    }

    return response.data;
  }
}
