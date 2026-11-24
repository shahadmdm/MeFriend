import type { PageContext } from '@microsoft/sp-page-context';
import type { SPHttpClient } from '@microsoft/sp-http';

import {
  SharePointRestClient
} from '../../../../shared/services/sharepoint/sharePointRestClient';
import {
  mefriendListTitles
} from '../../../bc-extension/config/sharePointConfig';
import {
  businessPerformancePermissionListTitle,
  businessPerformancePermissionFields,
  isBusinessPerformancePermissionModuleKey
} from '../../config/businessPerformanceAccessConfig';
import {
  BusinessPerformancePermissionService
} from './businessPerformancePermissionService';

interface IAppUserListItem {
  Id?: number;
  ID?: number;
  Title?: string;
  Email?: string;
  IsActive?: boolean;
}

interface IPermissionListItem {
  Id?: number;
  ID?: number;
  AppUserId?: number;
  ModuleKey?: string;
  CanView?: boolean;
  CanCreate?: boolean;
  CanManage?: boolean;
  IsActive?: boolean;
}

export interface IModulePermissionsUser {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
}

export interface IModulePermissionAssignment {
  moduleKey: string;
  isActive: boolean;
  canView: boolean;
  canCreate: boolean;
  canManage: boolean;
}

export interface IModulePermissionsAdminOptions {
  pageContext?: PageContext;
  spHttpClient?: SPHttpClient;
  webAbsoluteUrl?: string;
}

/**
 * Administration-only operations for Business Performance App User Permissions.
 * SharePoint list permissions MUST independently restrict writes to trusted admins.
 */
export class BusinessPerformancePermissionAdminService {
  private readonly client: SharePointRestClient;
  private readonly permissionService: BusinessPerformancePermissionService;

  public constructor(options: IModulePermissionsAdminOptions) {
    this.client = new SharePointRestClient(options);
    this.permissionService = new BusinessPerformancePermissionService(options);
  }

  public async getCurrentAdministratorUserId(): Promise<number> {
    const access = await this.permissionService.getCurrentAccess();
    if (
      !access.isAuthorized ||
      access.permissions['bpt.app']?.canManage !== true ||
      !access.appUserId
    ) {
      throw new Error(
        'You need Manage permission for Business Performance Tracker to administer module permissions.'
      );
    }
    return access.appUserId;
  }

  public async getAppUsers(): Promise<readonly IModulePermissionsUser[]> {
    await this.getCurrentAdministratorUserId();
    const items = await this.client.readItems<IAppUserListItem>(
      mefriendListTitles.appUsers,
      {
        select: ['Id', 'Title', 'Email', 'IsActive'],
        orderBy: 'Title asc'
      }
    );
    return items
      .map(item => {
        const id = item.Id || item.ID || 0;
        return {
          id,
          name: item.Title || item.Email || `App User ${id}`,
          email: item.Email || '',
          isActive: item.IsActive === true
        };
      })
      .filter(user => Number.isSafeInteger(user.id) && user.id > 0);
  }

  private async readAssignments(
    appUserId: number
  ): Promise<readonly IPermissionListItem[]> {
    if (!Number.isSafeInteger(appUserId) || appUserId <= 0) {
      throw new Error('Select a valid App User.');
    }
    const fields = businessPerformancePermissionFields;
    const items = await this.client.readItems<IPermissionListItem>(
      businessPerformancePermissionListTitle,
      {
        select: [
          fields.id,
          fields.appUserId,
          fields.moduleKey,
          fields.canView,
          fields.canCreate,
          fields.canManage,
          fields.isActive
        ],
        filter: `${fields.appUserId} eq ${appUserId}`,
        orderBy: `${fields.moduleKey} asc`
      }
    );

    // Match the existing permission reader's fail-closed duplicate policy.
    const seen = new Set<string>();
    for (const item of items) {
      const key = item.ModuleKey || '';
      if (!isBusinessPerformancePermissionModuleKey(key)) {
        continue;
      }
      if (seen.has(key)) {
        throw new Error(
          `Duplicate permission records exist for ${key}. Resolve the duplicates in SharePoint before editing.`
        );
      }
      seen.add(key);
    }
    return items;
  }

  public async getUserPermissions(
    appUserId: number
  ): Promise<readonly IModulePermissionAssignment[]> {
    await this.getCurrentAdministratorUserId();
    const items = await this.readAssignments(appUserId);
    return items
      .filter(item => isBusinessPerformancePermissionModuleKey(item.ModuleKey || ''))
      .map(item => ({
        moduleKey: item.ModuleKey || '',
        isActive: item.IsActive === true,
        canView: item.CanView === true,
        canCreate: item.CanCreate === true,
        canManage: item.CanManage === true
      }));
  }

  public async saveUserPermissions(
    appUserId: number,
    changes: readonly IModulePermissionAssignment[]
  ): Promise<void> {
    const administratorId = await this.getCurrentAdministratorUserId();
    const currentItems = await this.readAssignments(appUserId);
    const byModule = new Map<string, IPermissionListItem>();
    currentItems.forEach(item => {
      if (item.ModuleKey && isBusinessPerformancePermissionModuleKey(item.ModuleKey)) {
        byModule.set(item.ModuleKey, item);
      }
    });

    // Validate the complete batch before any SharePoint write.
    const processed = new Set<string>();
    for (const change of changes) {
      if (!isBusinessPerformancePermissionModuleKey(change.moduleKey)) {
        throw new Error(`Unknown permission module: ${change.moduleKey}`);
      }
      if (processed.has(change.moduleKey)) {
        throw new Error(`Duplicate submitted module: ${change.moduleKey}`);
      }
      processed.add(change.moduleKey);
      if (appUserId === administratorId && change.moduleKey === 'bpt.app') {
        throw new Error('You cannot edit your own Tracker application permission here.');
      }
      if ((change.canCreate || change.canManage) && !change.canView) {
        throw new Error(
          `View permission is required before Create or Manage for ${change.moduleKey}.`
        );
      }
    }

    for (const change of changes) {
      const isActive = change.isActive;
      const payload = {
        Title: change.moduleKey,
        AppUserId: appUserId,
        ModuleKey: change.moduleKey,
        IsActive: isActive,
        CanView: isActive && change.canView,
        CanCreate: isActive && change.canView && change.canCreate,
        CanManage: isActive && change.canView && change.canManage
      };
      const existing = byModule.get(change.moduleKey);
      if (existing) {
        const id = existing.Id || existing.ID || 0;
        if (!Number.isSafeInteger(id) || id <= 0) {
          throw new Error(`Invalid SharePoint record ID for ${change.moduleKey}.`);
        }
        await this.client.updateItem(
          businessPerformancePermissionListTitle,
          id,
          payload
        );
      } else if (payload.IsActive) {
        // Do not create needless deny-all records for untouched modules.
        await this.client.createItem(
          businessPerformancePermissionListTitle,
          payload
        );
      }
    }
  }
}
