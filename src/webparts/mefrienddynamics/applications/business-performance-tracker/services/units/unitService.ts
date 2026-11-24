
import type { PageContext } from '@microsoft/sp-page-context';
import type { SPHttpClient } from '@microsoft/sp-http';

import { SharePointRestClient } from '../../../../shared/services/sharepoint/sharePointRestClient';

import {
  businessPerformanceFields,
  businessPerformanceListTitles
} from '../../config/sharePointConfig';

import type {
  ISharePointUnitItem,
  IUnitInput,
  IUnitListItem
} from '../../models/units';

export interface IUnitServiceOptions {
  pageContext?: PageContext;
  spHttpClient?: SPHttpClient;
  webAbsoluteUrl?: string;
}

const listTitle = businessPerformanceListTitles.units;
const fields = businessPerformanceFields.units;

const normalizeUnitName = (value: string): string =>
  value.trim().replace(/\s+/g, ' ');

const normalizeUnitCode = (value: string): string =>
  value.trim();

const mapUnit = (
  item: ISharePointUnitItem
): IUnitListItem => ({
  id: item.Id,
  unitName: item.UnitName || '',
  unitCode: item.UnitCode || '',
  isActive: item.IsActive === true
});

export class UnitService {
  private readonly client: SharePointRestClient;

  public constructor(options: IUnitServiceOptions) {
    this.client = new SharePointRestClient(options);
  }

  public async getUnits(): Promise<readonly IUnitListItem[]> {
    const items = await this.client.readItems<ISharePointUnitItem>(
      listTitle,
      {
        select: [
          fields.id,
          fields.unitName,
          fields.unitCode,
          fields.isActive
        ],
        orderBy: `${fields.unitName} asc`
      }
    );

    return items.map(mapUnit);
  }

  public async getUnitById(
    id: number
  ): Promise<IUnitListItem | undefined> {
    const items = await this.client.readItems<ISharePointUnitItem>(
      listTitle,
      {
        select: [
          fields.id,
          fields.unitName,
          fields.unitCode,
          fields.isActive
        ],
        filter: `${fields.id} eq ${id}`,
        top: 1
      }
    );

    return items.length ? mapUnit(items[0]) : undefined;
  }

  public async saveUnit(
    input: IUnitInput,
    id?: number
  ): Promise<void> {
    const unitName = normalizeUnitName(input.unitName);
    const unitCode = normalizeUnitCode(input.unitCode);

    if (!unitName || !unitCode) {
      throw new Error('Unit Name and Unit Code are required.');
    }

    if (unitName.length > 255 || unitCode.length > 255) {
      throw new Error(
        'Unit Name and Unit Code cannot exceed 255 characters.'
      );
    }

    if (
      id !== undefined &&
      (!Number.isSafeInteger(id) || id <= 0)
    ) {
      throw new Error('Invalid Unit ID.');
    }

    const existingName =
      await this.client.readItems<ISharePointUnitItem>(
        listTitle,
        {
          select: [fields.id],
          filter:
            `${fields.unitName} eq '${this.client.escapeODataString(unitName)}'`,
          top: 2
        }
      );

    if (existingName.some(item => item.Id !== id)) {
      throw new Error('This Unit Name already exists.');
    }

    const existingCode =
      await this.client.readItems<ISharePointUnitItem>(
        listTitle,
        {
          select: [fields.id],
          filter:
            `${fields.unitCode} eq '${this.client.escapeODataString(unitCode)}'`,
          top: 2
        }
      );

    if (existingCode.some(item => item.Id !== id)) {
      throw new Error('This Unit Code already exists.');
    }

    const payload = {
      Title: unitName,
      UnitName: unitName,
      UnitCode: unitCode,
      IsActive: input.isActive
    };

    if (id !== undefined) {
      await this.client.updateItem(listTitle, id, payload);
      return;
    }

    await this.client.createItem(listTitle, payload);
  }
}
