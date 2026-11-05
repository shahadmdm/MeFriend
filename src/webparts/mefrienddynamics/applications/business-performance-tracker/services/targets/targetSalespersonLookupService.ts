import { ApiClient } from '../../../../shared/api/apiClient';

import {
  AuthClient,
  type IAuthClientDependencies
} from '../../../../shared/api/authClient';

import {
  appConfig as bcAppConfig
} from '../../../bc-extension/config/appConfig';

import {
  bcCompanies,
  getBcCompanyRequestHeaders
} from '../../../bc-extension/config/bcCompanies';

import type {
  ISalespersonLookupItem
} from '../../../bc-extension/services/salespersons/salespersonService';

export type ITargetSalespersonLookupOptions = Pick<
  IAuthClientDependencies,
  'aadHttpClientFactory' | 'httpClient'
>;

interface ISalespersonLookupResponse {
  items?: readonly ISalespersonLookupItem[];
  pageSize?: number;
  hasNext?: boolean;
  nextToken?: string | null;
}

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

const normalizeValue = (value: string): string =>
  value.trim().replace(/\s+/g, ' ').toUpperCase();

export class TargetSalespersonLookupService {
  private readonly options: ITargetSalespersonLookupOptions;

  private readonly companyCache = new Map<
    string,
    Promise<readonly ISalespersonLookupItem[]>
  >();

  public constructor(options: ITargetSalespersonLookupOptions) {
    this.options = options;
  }

  private createApiClient(companyId: string): ApiClient {
    const company = bcCompanies.find(
      item => item.id === companyId.trim()
    );

    if (!company) {
      throw new Error(
        'Select a valid Business Central company.'
      );
    }

    const authClient = new AuthClient({
      aadHttpClientFactory:
        this.options.aadHttpClientFactory,
      httpClient: this.options.httpClient,
      settings: {
        baseUrl:
          bcAppConfig.backendApi.baseUrl ||
          bcAppConfig.backendApiBaseUrl,
        anonymous: bcAppConfig.backendApi.anonymous,
        useAadHttpClient:
          bcAppConfig.backendApi.useAadHttpClient,
        aadResourceUrl:
          bcAppConfig.backendApi.aadResourceUrl
      }
    });

    return new ApiClient(authClient, {
      headerProvider: () =>
        getBcCompanyRequestHeaders(company)
    });
  }

  private async fetchAllSalespersons(
    companyId: string
  ): Promise<readonly ISalespersonLookupItem[]> {
    const apiClient = this.createApiClient(companyId);

    const records: ISalespersonLookupItem[] = [];
    const usedTokens = new Set<string>();

    let continuationToken: string | undefined;
    let completed = false;

    for (let page = 0; page < MAX_PAGES; page++) {
      const response =
        await apiClient.get<ISalespersonLookupResponse>(
          '/api/Salespersons/lookup',
          {
            pageSize: PAGE_SIZE,
            continuationToken
          }
        );

      const result = response.data;

      if (!result || !Array.isArray(result.items)) {
        throw new Error(
          'Invalid Salesperson lookup API response.'
        );
      }

      records.push(
        ...result.items.filter(
          item =>
            typeof item.code === 'string' &&
            item.code.trim().length > 0
        )
      );

      if (!result.hasNext) {
        completed = true;
        break;
      }

      const nextToken =
        typeof result.nextToken === 'string'
          ? result.nextToken.trim()
          : '';

      if (!nextToken) {
        throw new Error(
          'The Salesperson API indicates more records, ' +
          'but no continuation token was returned.'
        );
      }

      if (usedTokens.has(nextToken)) {
        throw new Error(
          'Salesperson pagination did not advance. ' +
          'The API may not support continuationToken.'
        );
      }

      usedTokens.add(nextToken);
      continuationToken = nextToken;
    }

    if (!completed) {
      throw new Error(
        'Salesperson records exceed the safe pagination ' +
        'limit. Complete results cannot be guaranteed.'
      );
    }

    const uniqueRecords =
      new Map<string, ISalespersonLookupItem>();

    records.forEach(item => {
      const code = item.code.trim();
      const name = (item.name || '').trim();

      if (!code) {
        return;
      }

      uniqueRecords.set(normalizeValue(code), {
        code,
        name
      });
    });

    return Array.from(uniqueRecords.values());
  }

  private getCompanySalespersons(
    companyId: string
  ): Promise<readonly ISalespersonLookupItem[]> {
    const key = companyId.trim();

    const cached = this.companyCache.get(key);

    if (cached) {
      return cached;
    }

    const pending = this.fetchAllSalespersons(key)
      .catch((error: unknown) => {
        this.companyCache.delete(key);
        throw error;
      });

    this.companyCache.set(key, pending);

    return pending;
  }

  public async getSalespersons(
    companyId: string,
    searchText: string = ''
  ): Promise<readonly ISalespersonLookupItem[]> {
    const records =
      await this.getCompanySalespersons(companyId);

    const query = normalizeValue(searchText);

    if (!query) {
      return records;
    }

    return records.filter(item =>
      normalizeValue(item.code).includes(query) ||
      normalizeValue(item.name).includes(query)
    );
  }

  public async validateSalesperson(
    companyId: string,
    code: string,
    name: string
  ): Promise<boolean> {
    if (!code.trim() || !name.trim()) {
      return false;
    }

    const records =
      await this.getCompanySalespersons(companyId);

    return records.some(item =>
      normalizeValue(item.code) ===
        normalizeValue(code) &&
      normalizeValue(item.name) ===
        normalizeValue(name)
    );
  }
}