import type { PageContext } from '@microsoft/sp-page-context';
import type { SPHttpClient } from '@microsoft/sp-http';

import {
  SharePointRestClient
} from '../../../../shared/services/sharepoint/sharePointRestClient';

import {
  bcCompanies
} from '../../../bc-extension/config/bcCompanies';

import {
  businessPerformanceFields,
  businessPerformanceListTitles
} from '../../config/sharePointConfig';

import type {
  ISharePointTargetItem,
  ITargetInput,
  ITargetListItem,
  TargetType
} from '../../models/targets';

import { VerticalService } from '../verticals/verticalService';
import { UnitService } from '../units/unitService';

export interface ITargetServiceOptions {
  pageContext?: PageContext;
  spHttpClient?: SPHttpClient;
  webAbsoluteUrl?: string;
  validateSalesperson?: (
    companyId: string,
    code: string,
    name: string
  ) => Promise<boolean>;
}

const listTitle = businessPerformanceListTitles.targets;
const fields = businessPerformanceFields.targets;

const selectFields: readonly string[] = [
  fields.id,
  fields.companyId,
  fields.targetType,
  fields.targetCode,
  fields.targetName,
  fields.verticalId,
  fields.targetMonth,
  fields.targetYear,
  fields.targetAmount,
  fields.isActive,
  fields.unitCode,
  fields.uniqueKey
];

const normalizeText = (value: string): string =>
  value.trim().replace(/\s+/g, ' ');

const normalizeCode = (value: string): string =>
  value.trim();

const normalizeForComparison = (value: string): string =>
  normalizeText(value).toUpperCase();

const isTargetType = (value: string): value is TargetType =>
  value === 'Unit' || value === 'Salesperson';

const createUniqueKey = (
  companyId: string,
  targetType: TargetType,
  targetCode: string,
  verticalId: number,
  month: number,
  year: number
): string => [
  companyId.toUpperCase(),
  targetType.toUpperCase(),
  normalizeForComparison(targetCode),
  String(verticalId),
  String(month),
  String(year)
].join('|');

const mapTarget = (
  item: ISharePointTargetItem
): ITargetListItem => {
  const targetType = item.TargetType || '';

  if (!isTargetType(targetType)) {
    throw new Error(
      `Invalid Target Type in SharePoint item ${item.Id}.`
    );
  }

  return {
    id: item.Id,
    companyId: item.CompanyId || '',
    targetType,
    targetCode: item.TargetCode || '',
    targetName: item.TargetName || '',
    verticalId: item.VerticalId ?? 0,
    targetMonth: item.TargetMonth ?? 0,
    targetYear: item.TargetYear ?? 0,
    targetAmount: item.TargetAmount ?? 0,
    isActive: item.IsActive === true,
    unitCode: item.UnitCode || '',
    targetUniqueKey: item.TargetUniqueKey || ''
  };
};

export class TargetService {
  private readonly client: SharePointRestClient;
  private readonly verticalService: VerticalService;
  private readonly unitService: UnitService;

  private readonly validateSalesperson?: (
    companyId: string,
    code: string,
    name: string
  ) => Promise<boolean>;

  public constructor(options: ITargetServiceOptions) {
    this.client = new SharePointRestClient(options);
    this.verticalService = new VerticalService(options);
    this.unitService = new UnitService(options);
    this.validateSalesperson = options.validateSalesperson;
  }

  public async getTargets(): Promise<readonly ITargetListItem[]> {
    const items = await this.client.readItems<ISharePointTargetItem>(
      listTitle,
      {
        select: selectFields,
        orderBy: `${fields.targetYear} desc,${fields.targetMonth} desc`
      }
    );

    return items.map(mapTarget);
  }

  /**
   * Retrieve targets belonging to the selected company.
   */
  public async getTargetsByCompany(
    companyId: string
  ): Promise<readonly ITargetListItem[]> {
    const selectedCompanyId = companyId.trim();

    if (!selectedCompanyId) {
      throw new Error(
        'Select a company before loading targets.'
      );
    }

    const escapedCompanyId =
      this.client.escapeODataString(selectedCompanyId);

    const items = await this.client.readItems<ISharePointTargetItem>(
      listTitle,
      {
        select: selectFields,
        filter: `${fields.companyId} eq '${escapedCompanyId}'`,
        orderBy: `${fields.targetYear} desc,${fields.targetMonth} desc`
      }
    );

    return items.map(mapTarget);
  }

  public async getTargetById(
    id: number
  ): Promise<ITargetListItem | undefined> {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new Error('Invalid Target ID.');
    }

    const items = await this.client.readItems<ISharePointTargetItem>(
      listTitle,
      {
        select: selectFields,
        filter: `${fields.id} eq ${id}`,
        top: 1
      }
    );

    return items.length ? mapTarget(items[0]) : undefined;
  }

  /**
   * Retrieve a target by ID only if it belongs
   * to the selected company.
   */
  public async getTargetByIdForCompany(
    id: number,
    companyId: string
  ): Promise<ITargetListItem | undefined> {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new Error('Invalid Target ID.');
    }

    const selectedCompanyId = companyId.trim();

    if (!selectedCompanyId) {
      throw new Error(
        'Select a company before loading a target.'
      );
    }

    const escapedCompanyId =
      this.client.escapeODataString(selectedCompanyId);

    const items = await this.client.readItems<ISharePointTargetItem>(
      listTitle,
      {
        select: selectFields,
        filter:
          `${fields.id} eq ${id} and ` +
          `${fields.companyId} eq '${escapedCompanyId}'`,
        top: 1
      }
    );

    return items.length ? mapTarget(items[0]) : undefined;
  }

  /**
   * Save a target for the active company.
   *
   * Validates the selected company and checks
   * ownership of an existing record before
   * passing control to the existing save logic.
   */
  public async saveTargetForCompany(
    input: ITargetInput,
    selectedCompanyId: string,
    id?: number
  ): Promise<void> {
    const activeCompanyId = selectedCompanyId.trim();

    if (!activeCompanyId) {
      throw new Error(
        'Select a company before saving a target.'
      );
    }

    const company = bcCompanies.find(
      item => item.id === activeCompanyId
    );

    if (!company) {
      throw new Error('Invalid selected Company.');
    }

    if (input.companyId?.trim() !== activeCompanyId) {
      throw new Error(
        'The Target Company must match the selected company.'
      );
    }

    if (id !== undefined) {
      const existingTarget =
        await this.getTargetByIdForCompany(
          id,
          activeCompanyId
        );

      if (!existingTarget) {
        throw new Error(
          'Target record not found for the selected company.'
        );
      }
    }

    await this.saveTarget(
      {
        ...input,
        companyId: activeCompanyId
      },
      id
    );
  }

  public async saveTarget(
    input: ITargetInput,
    id?: number
  ): Promise<void> {
    if (
      id !== undefined &&
      (!Number.isSafeInteger(id) || id <= 0)
    ) {
      throw new Error('Invalid Target ID.');
    }

    const company = bcCompanies.find(
      item => item.id === input.companyId?.trim()
    );

    if (!company) {
      throw new Error('Select a valid Company.');
    }

    if (!isTargetType(input.targetType)) {
      throw new Error('Select a valid Target Type.');
    }

    const companyId = company.id;
    const targetType = input.targetType;
    const targetName = normalizeText(input.targetName || '');
    const targetCode = normalizeCode(input.targetCode || '');

    const unitCode = targetType === 'Salesperson'
      ? normalizeCode(input.unitCode || '')
      : '';

    if (!targetName || !targetCode) {
      throw new Error('Target Name and Code are required.');
    }

    if (targetName.length > 255 || targetCode.length > 255) {
      throw new Error(
        'Target Name and Code must be 255 characters or fewer.'
      );
    }

    if (
      !Number.isSafeInteger(input.verticalId) ||
      input.verticalId <= 0
    ) {
      throw new Error('Select a valid Vertical.');
    }

    if (
      !Number.isInteger(input.targetMonth) ||
      input.targetMonth < 1 ||
      input.targetMonth > 12
    ) {
      throw new Error('Month must be between 1 and 12.');
    }

    if (
      !Number.isInteger(input.targetYear) ||
      input.targetYear < 2000 ||
      input.targetYear > 2100
    ) {
      throw new Error('Year must be between 2000 and 2100.');
    }

    if (
      !Number.isFinite(input.targetAmount) ||
      input.targetAmount < 0
    ) {
      throw new Error('Target Amount must be zero or greater.');
    }

    if (typeof input.isActive !== 'boolean') {
      throw new Error('Select a valid Status.');
    }

    const vertical = await this.verticalService.getVerticalById(
      input.verticalId
    );

    if (
      !vertical ||
      vertical.companyId !== companyId ||
      !vertical.isActive
    ) {
      throw new Error(
        'Select an active Vertical belonging to the selected Company.'
      );
    }

    const units = await this.unitService.getUnits();

    if (targetType === 'Unit') {
      const unit = units.find(
        item =>
          normalizeForComparison(item.unitCode) ===
          normalizeForComparison(targetCode)
      );

      if (
        !unit ||
        !unit.isActive ||
        normalizeForComparison(unit.unitName) !==
        normalizeForComparison(targetName)
      ) {
        throw new Error(
          'Select a valid active Unit from Unit Master.'
        );
      }
    } else {
      if (!unitCode) {
        throw new Error(
          'Unit is required for Salesperson targets.'
        );
      }

      const unit = units.find(
        item =>
          normalizeForComparison(item.unitCode) ===
          normalizeForComparison(unitCode)
      );

      if (!unit || !unit.isActive) {
        throw new Error(
          'Select a valid active Unit for the Salesperson.'
        );
      }

      if (!this.validateSalesperson) {
        throw new Error(
          'Salesperson validation is not configured.'
        );
      }

      const salespersonIsValid =
        await this.validateSalesperson(
          companyId,
          targetCode,
          targetName
        );

      if (!salespersonIsValid) {
        throw new Error(
          'Select a valid Salesperson for the selected Company.'
        );
      }
    }

    const uniqueKey = createUniqueKey(
      companyId,
      targetType,
      targetCode,
      input.verticalId,
      input.targetMonth,
      input.targetYear
    );

    if (uniqueKey.length > 255) {
      throw new Error(
        'Target Code is too long for the unique target identifier.'
      );
    }

    const existing = await this.client.readItems<ISharePointTargetItem>(
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
        'A target already exists for this Company, Type, Code, Vertical, Month and Year.'
      );
    }

    const payload = {
      Title: targetName,
      CompanyId: companyId,
      TargetType: targetType,
      TargetCode: targetCode,
      TargetName: targetName,
      VerticalId: input.verticalId,
      TargetMonth: input.targetMonth,
      TargetYear: input.targetYear,
      TargetAmount: input.targetAmount,
      IsActive: input.isActive,
      UnitCode: unitCode,
      TargetUniqueKey: uniqueKey
    };

    if (id !== undefined) {
      await this.client.updateItem(listTitle, id, payload);
      return;
    }

    await this.client.createItem(listTitle, payload);
  }
}