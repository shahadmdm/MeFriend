import type { PageContext } from '@microsoft/sp-page-context';
import type { SPHttpClient } from '@microsoft/sp-http';

import {
  SharePointRestClient
} from '../../../../shared/services/sharepoint/sharePointRestClient';

import {
  mefriendListTitles,
  normalizeEmail
} from '../../../bc-extension/config/sharePointConfig';

import {
  businessPerformancePermissionListTitle,
  businessPerformancePermissionFields,
  isBusinessPerformancePermissionModuleKey
} from '../../config/businessPerformanceAccessConfig';

import type {
  BusinessPerformancePermissionModuleKey
} from '../../config/businessPerformanceAccessConfig';

import type {
  BusinessPerformanceAccessMap,
  IBusinessPerformanceCurrentAccess,
  IBusinessPerformanceModuleAccess
} from '../../models/access/IBusinessPerformanceAccessModels';

interface IAppUserListItem {
  Id?: number;
  ID?: number;
  Email?: string;
  IsActive?: boolean;
}

interface IPermissionListItem {
  Id?: number;
  AppUserId?: number;
  ModuleKey?: string;
  CanView?: boolean;
  CanCreate?: boolean;
  CanManage?: boolean;
  IsActive?: boolean;
}

export interface IBusinessPerformancePermissionServiceOptions {
  pageContext?: PageContext;
  spHttpClient?: SPHttpClient;
  webAbsoluteUrl?: string;
}

export class BusinessPerformancePermissionService {
  private readonly pageContext?: PageContext;
  private readonly restClient: SharePointRestClient;

  public constructor(
    options: IBusinessPerformancePermissionServiceOptions
  ) {
    this.pageContext = options.pageContext;
    this.restClient = new SharePointRestClient(options);
  }

  public async getCurrentAccess():
    Promise<IBusinessPerformanceCurrentAccess> {

    const signedInEmail = normalizeEmail(
      this.pageContext?.user?.email || ''
    );

    if (!signedInEmail) {
      return this.denyAccess(
        '',
        'Unable to identify the signed-in SharePoint user.'
      );
    }

    const escapedEmail =
      this.restClient.escapeODataString(signedInEmail);

    // Reuse the existing MeFriend App Users list.
    // Do not rely on BC Extension's CanAccessApp field.
    const users =
      await this.restClient.readItems<IAppUserListItem>(
        mefriendListTitles.appUsers,
        {
          select: [
            'Id',
            'Email',
            'IsActive'
          ],
          filter: `Email eq '${escapedEmail}'`,
          top: 10
        }
      );

    const matchingUsers = users.filter(
      user =>
        normalizeEmail(user.Email) === signedInEmail &&
        user.IsActive === true
    );

    if (matchingUsers.length !== 1) {
      return this.denyAccess(
        signedInEmail,
        matchingUsers.length > 1
          ? 'Multiple active App Users records exist for this account.'
          : 'No active App Users record exists for this account.'
      );
    }

    const appUserId =
      matchingUsers[0].Id || matchingUsers[0].ID;

    if (
      !appUserId ||
      !Number.isSafeInteger(appUserId) ||
      appUserId <= 0
    ) {
      return this.denyAccess(
        signedInEmail,
        'Unable to resolve the current App User ID.'
      );
    }

    // Read only permission records belonging to this user.
    const items =
      await this.restClient.readItems<IPermissionListItem>(
        businessPerformancePermissionListTitle,
        {
          select: [
            businessPerformancePermissionFields.id,
            businessPerformancePermissionFields.appUserId,
            businessPerformancePermissionFields.moduleKey,
            businessPerformancePermissionFields.canView,
            businessPerformancePermissionFields.canCreate,
            businessPerformancePermissionFields.canManage,
            businessPerformancePermissionFields.isActive
          ],
          filter:
            `${businessPerformancePermissionFields.appUserId}` +
            ` eq ${appUserId}`,
          orderBy: 'ModuleKey asc'
        }
      );

    const permissions: Partial<
      Record<
        BusinessPerformancePermissionModuleKey,
        IBusinessPerformanceModuleAccess
      >
    > = {};

    for (const item of items) {
      const moduleKey = item.ModuleKey || '';

      if (!isBusinessPerformancePermissionModuleKey(moduleKey)) {
        continue;
      }

      // Duplicate records are configuration errors.
      // Do not choose a potentially more permissive record.
      if (permissions[moduleKey]) {
        return this.denyAccess(
          signedInEmail,
          `Duplicate permissions found for ${moduleKey}.`,
          appUserId
        );
      }

      const isActive = item.IsActive === true;
      const canView =
        isActive && item.CanView === true;

      permissions[moduleKey] = {
        moduleKey,
        isActive,
        canView,
        canCreate:
          canView && item.CanCreate === true,
        canManage:
          canView && item.CanManage === true
      };
    }

    const accessMap: BusinessPerformanceAccessMap =
      permissions;

    // Explicit Tracker access is mandatory for everyone,
    // including users with an Administrator role.
    const isAuthorized =
      accessMap['bpt.app']?.canView === true;

    return {
      signedInEmail,
      appUserId,
      isAuthorized,
      permissions: accessMap,
      accessError: isAuthorized
        ? undefined
        : 'You do not have permission to access Business Performance Tracker.'
    };
  }

  private denyAccess(
    signedInEmail: string,
    accessError: string,
    appUserId?: number
  ): IBusinessPerformanceCurrentAccess {
    return {
      signedInEmail,
      appUserId,
      isAuthorized: false,
      permissions: {},
      accessError
    };
  }
}