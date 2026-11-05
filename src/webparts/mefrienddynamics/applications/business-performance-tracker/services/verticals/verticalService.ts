import type { PageContext } from '@microsoft/sp-page-context';
import type { SPHttpClient } from '@microsoft/sp-http';

import { SharePointRestClient } from '../../../../shared/services/sharepoint/sharePointRestClient';

import {
  businessPerformanceFields,
  businessPerformanceListTitles
} from '../../config/sharePointConfig';

import type {
  ISharePointVerticalItem,
  IVerticalInput,
  IVerticalListItem
} from '../../models/verticals';

export interface IVerticalServiceOptions {
  pageContext?: PageContext;
  spHttpClient?: SPHttpClient;
  webAbsoluteUrl?: string;
}

const listTitle = businessPerformanceListTitles.verticals;
const fields = businessPerformanceFields.verticals;

const normalizeVerticalName = (value: string): string =>
  value.trim().replace(/\s+/g, ' ');

const createUniqueKey = (
  companyId: string,
  verticalName: string
): string =>
  `${companyId.trim().toUpperCase()}|${normalizeVerticalName(verticalName).toUpperCase()}`;

const mapVertical = (
  item: ISharePointVerticalItem
): IVerticalListItem => ({
  id: item.Id,
  companyId: item.CompanyId || '',
  verticalName: item.VerticalName || '',
  bcItemId: item.BcItemId || '',
  isActive: item.IsActive === true,
  verticalUniqueKey: item.VerticalUniqueKey || ''
});

export class VerticalService {
  private readonly client: SharePointRestClient;

  public constructor(options: IVerticalServiceOptions) {
    this.client = new SharePointRestClient(options);
  }

  public async getVerticals(): Promise<readonly IVerticalListItem[]> {
    const items = await this.client.readItems<ISharePointVerticalItem>(
      listTitle,
      {
        select: [
          fields.id,
          fields.companyId,
          fields.verticalName,
          fields.bcItemId,
          fields.isActive,
          fields.uniqueKey
        ],
        orderBy: `${fields.verticalName} asc`
      }
    );

    return items.map(mapVertical);
  }

  public async getVerticalsByCompany(
    companyId: string
  ): Promise<readonly IVerticalListItem[]> {
    const selectedCompanyId = companyId.trim();

    if (!selectedCompanyId) {
      throw new Error(
        'Select a company before loading verticals.'
      );
    }

    const items =
      await this.client.readItems<ISharePointVerticalItem>(
        listTitle,
        {
          select: [
            fields.id,
            fields.companyId,
            fields.verticalName,
            fields.bcItemId,
            fields.isActive,
            fields.uniqueKey
          ],
          filter:
            `${fields.companyId} eq '${this.client.escapeODataString(selectedCompanyId)}'`,
          orderBy: `${fields.verticalName} asc`
        }
      );

    return items.map(mapVertical);
  }

  public async getVerticalById(
    id: number
  ): Promise<IVerticalListItem | undefined> {
    const items = await this.client.readItems<ISharePointVerticalItem>(
      listTitle,
      {
        select: [
          fields.id,
          fields.companyId,
          fields.verticalName,
          fields.bcItemId,
          fields.isActive,
          fields.uniqueKey
        ],
        filter: `${fields.id} eq ${id}`,
        top: 1
      }
    );

    return items.length ? mapVertical(items[0]) : undefined;
  }

  public async getVerticalByIdForCompany(
    id: number,
    companyId: string
  ): Promise<IVerticalListItem | undefined> {
    const selectedCompanyId = companyId.trim();

    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new Error('Invalid Vertical ID.');
    }

    if (!selectedCompanyId) {
      throw new Error(
        'Select a company before loading a vertical.'
      );
    }

    const escapedCompanyId =
      this.client.escapeODataString(selectedCompanyId);

    const items =
      await this.client.readItems<ISharePointVerticalItem>(
        listTitle,
        {
          select: [
            fields.id,
            fields.companyId,
            fields.verticalName,
            fields.bcItemId,
            fields.isActive,
            fields.uniqueKey
          ],
          filter:
            `${fields.id} eq ${id} and ` +
            `${fields.companyId} eq '${escapedCompanyId}'`,
          top: 1
        }
      );

    return items.length
      ? mapVertical(items[0])
      : undefined;
  }

  /**
   * Save a vertical using the active company.
   *
   * Checks that the form company matches the
   * selected company and that an existing record
   * belongs to that company before updating it.
   */
  public async saveVerticalForCompany(
    input: IVerticalInput,
    selectedCompanyId: string,
    id?: number
  ): Promise<void> {
    const activeCompanyId = selectedCompanyId.trim();

    if (!activeCompanyId) {
      throw new Error(
        'Select a company before saving a vertical.'
      );
    }

    if (input.companyId.trim() !== activeCompanyId) {
      throw new Error(
        'The Vertical Company must match the selected company.'
      );
    }

    if (id !== undefined) {
      const existingVertical =
        await this.getVerticalByIdForCompany(
          id,
          activeCompanyId
        );

      if (!existingVertical) {
        throw new Error(
          'Vertical record not found for the selected company.'
        );
      }
    }

    await this.saveVertical(
      {
        ...input,
        companyId: activeCompanyId
      },
      id
    );
  }

  public async saveVertical(
    input: IVerticalInput,
    id?: number
  ): Promise<void> {
    const companyId = input.companyId.trim();
    const verticalName = normalizeVerticalName(input.verticalName);
    const bcItemId = input.bcItemId?.trim() ?? '';

    if (!companyId || !verticalName) {
      throw new Error('Company and Vertical Name are required.');
    }

    // BC Item ID is mandatory for all new and updated verticals.
    if (!bcItemId) {
      throw new Error('BC Item ID is required.');
    }

    const uniqueKey = createUniqueKey(companyId, verticalName);

    if (uniqueKey.length > 255) {
      throw new Error('Company and Vertical Name are too long.');
    }

    if (bcItemId.length > 255) {
      throw new Error('BC Item ID cannot exceed 255 characters.');
    }

    const existing = await this.client.readItems<ISharePointVerticalItem>(
      listTitle,
      {
        select: [fields.id],
        filter:
          `${fields.uniqueKey} eq '${this.client.escapeODataString(uniqueKey)}'`,
        top: 2
      }
    );

    if (existing.some(item => item.Id !== id)) {
      throw new Error(
        'This Vertical Name already exists for the selected company.'
      );
    }

    const payload = {
      Title: verticalName,
      CompanyId: companyId,
      VerticalName: verticalName,
      BcItemId: bcItemId,
      IsActive: input.isActive,
      VerticalUniqueKey: uniqueKey
    };

    if (id !== undefined) {
      await this.client.updateItem(listTitle, id, payload);
      return;
    }

    await this.client.createItem(listTitle, payload);
  }
}