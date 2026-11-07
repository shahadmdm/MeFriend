
import type { PageContext } from '@microsoft/sp-page-context';
import type { SPHttpClient } from '@microsoft/sp-http';

import {
  SharePointRestClient
} from '../../../../shared/services/sharepoint/sharePointRestClient';

export interface IUnitAccessServiceOptions {
  pageContext?: PageContext;
  spHttpClient?: SPHttpClient;
  webAbsoluteUrl?: string;
}

interface IUnitAccessItem {
  Id: number;
  AppUserId: number;
  CompanyId: string;
  UnitId: number;
  IsActive: boolean;
}

export interface ISaveUnitAssignments {
  appUserId: number;
  companyId: string;
  unitIds: readonly number[];
}

export interface ICompanyUnitAssignment {
  appUserId: number;
  unitId: number;
}

const listTitle = 'Business Performance Unit Access';

const validateUserId = (id: number): void => {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid App User ID.');
  }
};

const validateUnitId = (id: number): void => {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Invalid Unit ID.');
  }
};

const normalizeCompanyId = (companyId: string): string => {
  const value = companyId.trim().toUpperCase();

  if (!value) {
    throw new Error('Company ID is required.');
  }

  return value;
};

const getUniqueKey = (
  appUserId: number,
  companyId: string,
  unitId: number
): string =>
  `${appUserId}|${companyId}|${unitId}`;

export class BusinessPerformanceUnitAccessService {
  private readonly client: SharePointRestClient;

  public constructor(options: IUnitAccessServiceOptions) {
    this.client = new SharePointRestClient(options);
  }

  private async getUserRecords(
    appUserId: number
  ): Promise<readonly IUnitAccessItem[]> {
    validateUserId(appUserId);

    return this.client.readItems<IUnitAccessItem>(
      listTitle,
      {
        select: [
          'Id',
          'AppUserId',
          'CompanyId',
          'UnitId',
          'IsActive'
        ],
        filter: `AppUserId eq ${appUserId}`
      }
    );
  }

  public async getAssignedUnitIds(
    appUserId: number,
    companyId: string
  ): Promise<readonly number[]> {
    const normalizedCompanyId =
      normalizeCompanyId(companyId);

    const records =
      await this.getUserRecords(appUserId);

    return records
      .filter(item =>
        item.IsActive === true &&
        item.CompanyId.trim().toUpperCase() ===
          normalizedCompanyId
      )
      .map(item => item.UnitId);
  }

  // Call only from an authorized administration workflow.
  // SharePoint permissions or a trusted API must
  // enforce who can modify these assignments.
  public async saveAssignments(
    input: ISaveUnitAssignments
  ): Promise<void> {
    validateUserId(input.appUserId);

    const companyId =
      normalizeCompanyId(input.companyId);

    const selectedUnitIds = new Set<number>();

    for (const unitId of input.unitIds) {
      validateUnitId(unitId);
      selectedUnitIds.add(unitId);
    }

    const records = (
      await this.getUserRecords(input.appUserId)
    ).filter(item =>
      item.CompanyId.trim().toUpperCase() === companyId
    );

    const existingByUnit = new Map<number, IUnitAccessItem>();

    for (const record of records) {
      if (existingByUnit.has(record.UnitId)) {
        throw new Error(
          `Duplicate Unit permission for Unit ID ${record.UnitId}.`
        );
      }

      existingByUnit.set(record.UnitId, record);
    }

    // Add new assignments or reactivate existing ones.
    for (const unitId of Array.from(selectedUnitIds)) {
      const existing = existingByUnit.get(unitId);

      if (existing) {
        if (!existing.IsActive) {
          await this.client.updateItem(
            listTitle,
            existing.Id,
            { IsActive: true }
          );
        }

        continue;
      }

      await this.client.createItem(listTitle, {
        Title: `${input.appUserId}-${unitId}`,
        AppUserId: input.appUserId,
        CompanyId: companyId,
        UnitId: unitId,
        IsActive: true,
        AccessUniqueKey: getUniqueKey(
          input.appUserId,
          companyId,
          unitId
        )
      });
    }

    // Revoke assignments that are no longer selected.
    for (const record of records) {
      if (
        record.IsActive &&
        !selectedUnitIds.has(record.UnitId)
      ) {
        await this.client.updateItem(
          listTitle,
          record.Id,
          { IsActive: false }
        );
      }
    }
  }


  
  public async getCompanyAssignments(
    companyId: string
  ): Promise<readonly ICompanyUnitAssignment[]> {
    const normalizedCompanyId =
      normalizeCompanyId(companyId);

    const escapedCompanyId =
      this.client.escapeODataString(normalizedCompanyId);

    const items =
      await this.client.readItems<IUnitAccessItem>(
        listTitle,
        {
          select: [
            'Id',
            'AppUserId',
            'CompanyId',
            'UnitId',
            'IsActive'
          ],
          filter:
            `CompanyId eq '${escapedCompanyId}'`,
          orderBy: 'AppUserId asc'
        }
      );

    return items
      .filter(item =>
        item.IsActive === true &&
        item.CompanyId.trim().toUpperCase() ===
          normalizedCompanyId &&
        Number.isSafeInteger(item.AppUserId) &&
        item.AppUserId > 0 &&
        Number.isSafeInteger(item.UnitId) &&
        item.UnitId > 0
      )
      .map(item => ({
        appUserId: item.AppUserId,
        unitId: item.UnitId
      }));
  }


}
