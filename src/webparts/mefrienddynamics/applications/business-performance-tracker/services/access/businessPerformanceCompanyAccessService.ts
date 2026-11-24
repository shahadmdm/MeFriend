import type { PageContext } from '@microsoft/sp-page-context';
import type { SPHttpClient } from '@microsoft/sp-http';

import {
  SharePointRestClient
} from '../../../../shared/services/sharepoint/sharePointRestClient';

import {
  mefriendFields,
  mefriendListTitles,
  normalizeEmail
} from '../../../bc-extension/config/sharePointConfig';

import {
  filterAuthorizedBcCompanies
} from '../../../bc-extension/config/companyAccess';

import type {
  IAuthorizedBcCompanyResult
} from '../../../bc-extension/config/companyAccess';

import {
  bcCompanies
} from '../../../bc-extension/config/bcCompanies';

interface IAppUserListItem {
  Email?: string;
  Role?: string;
  Company?: readonly string[] | {
    results?: readonly string[];
  };
  IsActive?: boolean;
  IsSalesperson?: boolean;
  SalespersonCode?: string | number;
}

export interface IBusinessPerformanceCompanyAccessOptions {
  pageContext?: PageContext;
  spHttpClient?: SPHttpClient;
  webAbsoluteUrl?: string;
}

export interface IBusinessPerformanceUserAssignments {
  signedInEmail: string;
  role: string;
  isSalesperson: boolean;
  salespersonCode: string;
  companyAccess: IAuthorizedBcCompanyResult;
}

export class BusinessPerformanceCompanyAccessService {
  private readonly pageContext?: PageContext;
  private readonly restClient: SharePointRestClient;

  public constructor(
    options: IBusinessPerformanceCompanyAccessOptions
  ) {
    this.pageContext = options.pageContext;
    this.restClient = new SharePointRestClient(options);
  }

  public async getCurrentUserAssignments():
    Promise<IBusinessPerformanceUserAssignments> {
    const signedInEmail = normalizeEmail(
      this.pageContext?.user?.email || ''
    );

    if (!signedInEmail) {
      throw new Error(
        'Unable to identify the signed-in SharePoint user.'
      );
    }

    const escapedEmail =
      this.restClient.escapeODataString(signedInEmail);

    const items =
      await this.restClient.readItems<IAppUserListItem>(
        mefriendListTitles.appUsers,
        {
          select: [
            'Email',
            'Role',
            mefriendFields.appUsers.company,
            'IsActive',
            'IsSalesperson',
            'SalespersonCode'
          ],
          filter: `Email eq '${escapedEmail}'`,
          top: 10
        }
      );

    const user = items.find(
      item => normalizeEmail(item.Email) === signedInEmail
    );

    if (!user || user.IsActive !== true) {
      throw new Error(
        'No active App Users record exists for ' +
        signedInEmail +
        '. Please contact the administrator.'
      );
    }

    const companyField = user.Company;

    const assignedCompanyNames: readonly string[] =
      Array.isArray(companyField)
        ? companyField as readonly string[]
        : (
            companyField as {
              results?: readonly string[];
            } | undefined
          )?.results || [];

    const companyAccess = filterAuthorizedBcCompanies(
      assignedCompanyNames,
      bcCompanies
    );

    return {
      signedInEmail,
      role: user.Role || '',
      isSalesperson: user.IsSalesperson === true,
      salespersonCode: String(
        user.SalespersonCode || ''
      ).trim().toUpperCase(),
      companyAccess
    };
  }
}