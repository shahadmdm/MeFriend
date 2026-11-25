import * as React from 'react';
import type {
  IPortalApplicationProps
} from '../../../../shared/models/IPortalApplicationProps';
import {
  ErrorBoundary
} from '../../../../shared/components/errorState/ErrorBoundary';
import {
  AccessDenied
} from '../../../../shared/components/errorState/AccessDenied';
import {
  ToastProvider
} from '../../../../shared/components/toast/ToastProvider';
import {
  BusinessPerformanceAuthorizationGate
} from '../Access/BusinessPerformanceAuthorizationGate';
import {
  BusinessPerformanceCompanyAccessGate
} from '../CompanySelector/BusinessPerformanceCompanyAccessGate';
import {
  BusinessPerformancePermissionService
} from '../../services/access/businessPerformancePermissionService';
import {
  BusinessPerformanceCompanyAccessService
} from '../../services/access/businessPerformanceCompanyAccessService';
import type {
  IUseBusinessPerformanceAccessResult
} from '../../hooks/useBusinessPerformanceAccess';
import type {
  BusinessPerformancePermissionModuleKey
} from '../../config/businessPerformanceAccessConfig';
import type {
  AppRouteKey
} from '../../models/common/AppRoute';
import {
  getBcCompanyLabel,
  type BcCompany
} from '../../../bc-extension/config/bcCompanies';
import {
  VerticalPage,
  VerticalFormPage
} from '../modules/verticals';
import {
  UnitPage,
  UnitFormPage
} from '../modules/units';
import {
  TargetPage,
  TargetFormPage
} from '../modules/targets';
import {
  CollectionReportPage,
} from '../modules/collectionReport';
import {
  CollectionVerticalReportPage,
} from '../modules/collectionVerticalReport';
import {
  CollectionOnBillsPage
} from '../modules/collectionOnBills';
import { ApiClient } from '../../../../shared/api/apiClient';
import { AuthClient } from '../../../../shared/api/authClient';
import { appConfig } from '../../config/appConfig';
import {
  BusinessReportApiService
} from '../../services/businessReport/businessReportApiService';
import {
  CollectionVerticalReportApiService
} from '../../services/businessReport/collectionVerticalReportApiService';
import {
  CollectionOnBillsApiService
} from '../../services/collectionOnBills/collectionOnBillsApiService';
import {
  AppLayout
} from '../Layout/AppLayout';
import {
  VerticalService
} from '../../services/verticals/verticalService';
import {
  UnitService
} from '../../services/units/unitService';
import {
  BusinessPerformanceUnitAccessService
} from '../../services/access/businessPerformanceUnitAccessService';
import {
  TargetService
} from '../../services/targets/targetService';
import {
  TargetSalespersonLookupService
} from '../../services/targets/targetSalespersonLookupService';
import {
  BusinessPerformanceUnitAccessManager
} from '../modules/unitAccess/BusinessPerformanceUnitAccessManager';
import {
  BusinessPerformanceModulePermissionsPage
} from '../modules/modulePermissions/BusinessPerformanceModulePermissionsPage';
import { SettingsPage } from '../modules/settings/SettingsPage';
import { BptInvoicesRoute } from '../modules/invoices/BptInvoicesRoute';
import { ChequeEntryPage } from '../modules/ChequeEntry';
import {
  resolveRoute,
  buildHashHref
} from '../../utils/routeUtils';
import styles from '../../../bc-extension/components/App/App.module.scss';
const sharePointWebAbsoluteUrl =
  appConfig.sharePointSettings.masterDataWebUrl;
const chequeEntryListTitle = 'Business Performance Cheque Entries';
type RouteAction = 'view' | 'create' | 'manage';
interface IRouteAccessRequirement {
  moduleKey: BusinessPerformancePermissionModuleKey;
  action: RouteAction;
}
const routeAccessRequirements:
  Partial<Record<AppRouteKey, IRouteAccessRequirement>> = {
    verticals: {
      moduleKey: 'bpt.verticals',
      action: 'view'
    },
    verticalCreate: {
      moduleKey: 'bpt.verticals',
      action: 'create'
    },
    verticalEdit: {
      moduleKey: 'bpt.verticals',
      action: 'manage'
    },
    units: {
      moduleKey: 'bpt.units',
      action: 'view'
    },
    unitCreate: {
      moduleKey: 'bpt.units',
      action: 'create'
    },
    unitEdit: {
      moduleKey: 'bpt.units',
      action: 'manage'
    },
    targets: {
      moduleKey: 'bpt.targets',
      action: 'view'
    },
    targetCreate: {
      moduleKey: 'bpt.targets',
      action: 'create'
    },
    targetEdit: {
      moduleKey: 'bpt.targets',
      action: 'manage'
    },
    collectionReport: {
      moduleKey: 'bpt.collectionReport',
      action: 'view'
    },
    collectionVerticalReport: {
      moduleKey: 'bpt.collectionVerticalReport',
      action: 'view'
    },
    collectionOnBills: {
      moduleKey: 'bpt.collectionOnBills',
      action: 'view'
    },
    // Independent Invoice module permission; protect list and detail routes.
    invoices: {
      moduleKey: 'bpt.invoices',
      action: 'view'
    },
    invoiceDetail: {
      moduleKey: 'bpt.invoices',
      action: 'view'
    },
    unitAccess: {
      moduleKey: 'bpt.unitAccess',
      action: 'manage'
    },
    modulePermissions: {
      moduleKey: 'bpt.app',
      action: 'manage'
    },
    // Temporary admin-only access until bpt.chequeEntry is configured.
    chequeEntry: {
      moduleKey: 'bpt.chequeEntry',
      action: 'view'
    }
  };
const hasRoutePermission = (
  access: IUseBusinessPerformanceAccessResult,
  requirement: IRouteAccessRequirement
): boolean => {
  if (requirement.action === 'create') {
    return access.canCreate(requirement.moduleKey);
  }
  if (requirement.action === 'manage') {
    return access.canManage(requirement.moduleKey);
  }
  return access.canView(requirement.moduleKey);
};
const getAuthorizedLandingRoute = (
  access: IUseBusinessPerformanceAccessResult
): string | undefined => {
  if (access.canView('bpt.verticals')) {
    return 'verticals';
  }
  if (access.canView('bpt.units')) {
    return 'units';
  }
  if (access.canView('bpt.targets')) {
    return 'targets';
  }
  if (access.canView('bpt.collectionReport')) {
    return 'collectionReport';
  }
  if (access.canView('bpt.collectionVerticalReport')) {
    return 'collectionVerticalReport';
  }
  if (access.canView('bpt.collectionOnBills')) {
    return 'collectionOnBills';
  }
  if (access.canView('bpt.invoices')) {
    return 'invoices';
  }
  if (access.canView('bpt.chequeEntry')) {
    return 'chequeEntry';
  }
  if (
    access.canManage('bpt.app') ||
    access.canManage('bpt.unitAccess')
  ) {
    return 'settings';
  }
  return undefined;
};
  /**
   * Build the permitted sidebar module list from verified permissions.
   * Route-level permission checks remain independent.
   */
const getAllowedModuleKeys = (
  access: IUseBusinessPerformanceAccessResult
): readonly string[] => {
  const allowedModuleKeys: string[] = [];
  if (access.canView('bpt.verticals')) {
    allowedModuleKeys.push('verticals');
  }
  if (access.canView('bpt.units')) {
    allowedModuleKeys.push('units');
  }
  if (access.canView('bpt.targets')) {
    allowedModuleKeys.push('targets');
  }
  if (access.canView('bpt.collectionReport')) {
    allowedModuleKeys.push('collectionReport');
  }
  if (access.canView('bpt.collectionVerticalReport')) {
    allowedModuleKeys.push('collectionVerticalReport');
  }
  if (access.canView('bpt.collectionOnBills')) {
    allowedModuleKeys.push('collectionOnBills');
  }
  if (access.canView('bpt.invoices')) {
    allowedModuleKeys.push('invoices');
  }
  if (access.canView('bpt.chequeEntry')) {
    allowedModuleKeys.push('chequeEntry');
  }
  // Settings is opened from the signed-in user popup.
  // Unit Access and Module Permissions are sections inside Settings.
  if (
    access.canManage('bpt.app') ||
    access.canManage('bpt.unitAccess')
  ) {
    allowedModuleKeys.push('settings');
  }
  return allowedModuleKeys;
};
export const App: React.FC<IPortalApplicationProps> = ({
  aadHttpClientFactory,
  httpClient,
  pageContext,
  spHttpClient,
  routePath,
  userDisplayName,
  onPortalNavigate,
  onPortalReady
}) => {
  const permissionService = React.useMemo(
    () =>
      new BusinessPerformancePermissionService({
        pageContext,
        spHttpClient,
        webAbsoluteUrl: sharePointWebAbsoluteUrl
      }),
    [pageContext, spHttpClient]
  );
  const companyAccessService = React.useMemo(
    () =>
      new BusinessPerformanceCompanyAccessService({
        pageContext,
        spHttpClient,
        webAbsoluteUrl: sharePointWebAbsoluteUrl
      }),
    [pageContext, spHttpClient]
  );
  const verticalService = React.useMemo(
    () =>
      new VerticalService({
        pageContext,
        spHttpClient,
        webAbsoluteUrl: sharePointWebAbsoluteUrl
      }),
    [pageContext, spHttpClient]
  );
  const unitService = React.useMemo(
    () =>
      new UnitService({
        pageContext,
        spHttpClient,
        webAbsoluteUrl: sharePointWebAbsoluteUrl
      }),
    [pageContext, spHttpClient]
  );
  const unitAccessService = React.useMemo(
    () =>
      new BusinessPerformanceUnitAccessService({
        pageContext,
        spHttpClient,
        webAbsoluteUrl: sharePointWebAbsoluteUrl
      }),
    [pageContext, spHttpClient]
  );
  const targetSalespersonLookupService = React.useMemo(
    () =>
      new TargetSalespersonLookupService({
        aadHttpClientFactory,
        httpClient
      }),
    [aadHttpClientFactory, httpClient]
  );
  // Explicitly opt in to the temporary localhost Business Report demo.
  // Normal SharePoint users do not attempt calls to their own localhost.
  const businessReportApiService = React.useMemo(() => {
  const debugManifest = new URLSearchParams(
    window.location.search
  ).get('debugManifestsFile') || '';
  if (!debugManifest.startsWith('https://localhost:4321/')) {
    return undefined;
  }
    const authClient = new AuthClient({
      aadHttpClientFactory,
      httpClient,
      settings: {
        ...appConfig.backendApi
      }
    });
    return new BusinessReportApiService(new ApiClient(authClient));
  }, [aadHttpClientFactory, httpClient]);
  const collectionVerticalReportApiService = React.useMemo(() => {
  const debugManifest = new URLSearchParams(
    window.location.search
  ).get('debugManifestsFile') || '';
  if (!debugManifest.startsWith('https://localhost:4321/')) {
    return undefined;
  }
    const authClient = new AuthClient({
      aadHttpClientFactory,
      httpClient,
      settings: {
        ...appConfig.backendApi
      }
    });
    return new CollectionVerticalReportApiService(new ApiClient(authClient));
  }, [aadHttpClientFactory, httpClient]);
  const collectionOnBillsApiService = React.useMemo(() => {
    const authClient = new AuthClient({
      aadHttpClientFactory,
      httpClient,
      settings: {
        ...appConfig.backendApi
      }
    });
    return new CollectionOnBillsApiService(new ApiClient(authClient));
  }, [aadHttpClientFactory, httpClient]);
  const targetService = React.useMemo(
    () =>
      new TargetService({
        pageContext,
        spHttpClient,
        webAbsoluteUrl: sharePointWebAbsoluteUrl,
        validateSalesperson: (
          companyId,
          code,
          name
        ) =>
          targetSalespersonLookupService.validateSalesperson(
            companyId,
            code,
            name
          )
      }),
    [
      pageContext,
      spHttpClient,
      targetSalespersonLookupService
    ]
  );
  const loadTargetSalespersons = React.useCallback(
    (companyId: string, searchText?: string) =>
      targetSalespersonLookupService.getSalespersons(
        companyId,
        searchText
      ),
    [targetSalespersonLookupService]
  );
  const route = resolveRoute(routePath);
  const handleNavigate = React.useCallback(
    (path: string): void => {
      const href = buildHashHref(path);
      if (window.location.hash !== href) {
        window.location.hash = href;
      }
    },
    []
  );
  React.useEffect(() => {
    onPortalReady?.();
  }, [onPortalReady]);
  const renderRoute = (
    selectedCompanyId: string,
    access: IUseBusinessPerformanceAccessResult,
    selectedCompany: BcCompany
  ): React.ReactNode => {
    // Settings requires at least one of its section permissions.
    // Individual pages continue enforcing their own access rules.
    if (
      route.key === 'settings' &&
      !access.canManage('bpt.app') &&
      !access.canManage('bpt.unitAccess')
    ) {
      return (
        <AccessDenied
          title="Module Access Denied"
          message="You do not have permission to access settings."
        />
      );
    }
    const requirement = routeAccessRequirements[route.key];
    if (
      requirement &&
      !hasRoutePermission(access, requirement)
    ) {
      return (
        <AccessDenied
          title="Module Access Denied"
          message={
            'You do not have permission to access ' +
            'this Business Performance Tracker page. ' +
            'Please contact the administrator.'
          }
        />
      );
    }
    // Vertical Master
    if (route.key === 'verticals') {
      return (
        <VerticalPage
          verticalService={verticalService}
          selectedCompanyId={selectedCompanyId}
          onNavigate={handleNavigate}
          canCreate={access.canCreate('bpt.verticals')}
          canManage={access.canManage('bpt.verticals')}
        />
      );
    }
    if (route.key === 'verticalCreate') {
      return (
        <VerticalFormPage
          verticalService={verticalService}
          selectedCompanyId={selectedCompanyId}
          onNavigate={handleNavigate}
        />
      );
    }
    if (route.key === 'verticalEdit') {
      const verticalId = Number(route.params.id);
      if (
        !Number.isSafeInteger(verticalId) ||
        verticalId <= 0
      ) {
        return <div>Invalid Vertical ID.</div>;
      }
      return (
        <VerticalFormPage
          verticalService={verticalService}
          verticalId={verticalId}
          selectedCompanyId={selectedCompanyId}
          onNavigate={handleNavigate}
        />
      );
    }
    // Unit Master
    // Unit Master is global, not company-specific.
    if (route.key === 'units') {
      return (
        <UnitPage
          unitService={unitService}
          onNavigate={handleNavigate}
        />
      );
    }
    if (route.key === 'unitAccess') {
      return (
        <BusinessPerformanceUnitAccessManager
          pageContext={pageContext}
          spHttpClient={spHttpClient}
          webAbsoluteUrl={sharePointWebAbsoluteUrl}
          selectedCompanyId={selectedCompanyId}
          unitService={unitService}
          unitAccessService={unitAccessService}
        />
      );
    }
    if (route.key === 'unitCreate') {
      return (
        <UnitFormPage
          unitService={unitService}
          onNavigate={handleNavigate}
        />
      );
    }
    if (route.key === 'unitEdit') {
      const unitId = Number(route.params.id);
      if (
        !Number.isSafeInteger(unitId) ||
        unitId <= 0
      ) {
        return <div>Invalid Unit ID.</div>;
      }
      return (
        <UnitFormPage
          unitService={unitService}
          unitId={unitId}
          onNavigate={handleNavigate}
        />
      );
    }
    // Target Master
    if (route.key === 'targets') {
      return (
        <TargetPage
          targetService={targetService}
          selectedCompanyId={selectedCompanyId}
          onNavigate={handleNavigate}
        />
      );
    }
    if (route.key === 'targetCreate') {
      return (
        <TargetFormPage
          targetService={targetService}
          verticalService={verticalService}
          unitService={unitService}
          loadSalespersons={loadTargetSalespersons}
          selectedCompanyId={selectedCompanyId}
          onNavigate={handleNavigate}
        />
      );
    }
    if (route.key === 'targetEdit') {
      const targetId = Number(route.params.id);
      if (
        !Number.isSafeInteger(targetId) ||
        targetId <= 0
      ) {
        return <div>Invalid Target ID.</div>;
      }
      return (
        <TargetFormPage
          targetService={targetService}
          verticalService={verticalService}
          unitService={unitService}
          loadSalespersons={loadTargetSalespersons}
          targetId={targetId}
          selectedCompanyId={selectedCompanyId}
          onNavigate={handleNavigate}
        />
      );
    }
    // Collection Report
    if (route.key === 'collectionReport') {
      return (
      <CollectionReportPage
        targetService={targetService}
        verticalService={verticalService}
        unitService={unitService}
        unitAccessService={unitAccessService}
        appUserId={access.appUserId}
        loadSalespersons={loadTargetSalespersons}
        businessReportApiService={businessReportApiService}
        selectedCompanyId={selectedCompanyId}
      />
      );
    }
    // Collection Vertical Report
    if (route.key === 'collectionVerticalReport') {
      return (
        <CollectionVerticalReportPage
          targetService={targetService}
          verticalService={verticalService}
          unitService={unitService}
          unitAccessService={unitAccessService}
          appUserId={access.appUserId}
          loadSalespersons={loadTargetSalespersons}
          collectionVerticalReportApiService={collectionVerticalReportApiService}
          selectedCompanyId={selectedCompanyId}
        />
      );
    }
    // Collection on Bills: receipt-level invoice applications.
    if (route.key === 'collectionOnBills') {
      return (
        <CollectionOnBillsPage
          selectedCompanyId={selectedCompanyId}
          appUserId={access.appUserId}
          unitService={unitService}
          unitAccessService={unitAccessService}
          collectionOnBillsApiService={collectionOnBillsApiService}
        />
      );
    }
    // Invoice and Outstanding Report routes.
    if (route.key === 'invoices' || route.key === 'invoiceDetail') {
      return (
        <BptInvoicesRoute
          key={selectedCompany.id}
          aadHttpClientFactory={aadHttpClientFactory}
          httpClient={httpClient}
          selectedCompany={selectedCompany}
          isDetail={route.key === 'invoiceDetail'}
          invoiceNumber={route.key === 'invoiceDetail' ? route.params.id || '' : undefined}
          onNavigate={handleNavigate}
        />
      );
    }
    // Cheque Entry: saved through SPHttpClient to the configured SharePoint list.
    if (route.key === 'chequeEntry') {
      // spHttpClient is optional in IPortalApplicationProps. Do not render
      // the save form unless SharePoint HTTP access is available.
      if (!spHttpClient) {
        return (
          <div role="alert">
            Cheque Entry cannot load because the SharePoint HTTP client is unavailable.
          </div>
        );
      }
      return (
        <ChequeEntryPage
          spHttpClient={spHttpClient}
          webAbsoluteUrl={sharePointWebAbsoluteUrl}
          selectedCompanyId={selectedCompanyId}
          unitService={unitService}
          unitAccessService={unitAccessService}
          appUserId={access.appUserId}
          canCreate={access.canCreate('bpt.chequeEntry')}
          canManage={access.canManage('bpt.chequeEntry')}
          listTitle={chequeEntryListTitle}
        />
      );
    }
    if (route.key === 'modulePermissions') {
      return (
        <BusinessPerformanceModulePermissionsPage
          pageContext={pageContext}
          spHttpClient={spHttpClient}
          webAbsoluteUrl={sharePointWebAbsoluteUrl}
        />
      );
    }
    if (route.key === 'settings') {
      return (
        <SettingsPage
          pageContext={pageContext}
          spHttpClient={spHttpClient}
          webAbsoluteUrl={sharePointWebAbsoluteUrl}
          selectedCompanyId={selectedCompanyId}
          unitService={unitService}
          unitAccessService={unitAccessService}
          canManageModulePermissions={access.canManage('bpt.app')}
          canManageUnitAccess={access.canManage('bpt.unitAccess')}
        />
      );
    }
    return (
      <div>
        This module is under development.
      </div>
    );
  };
  return (
    <ErrorBoundary>
      <ToastProvider>
        <BusinessPerformanceAuthorizationGate
          permissionService={permissionService}
        >
          {access => (
            <BusinessPerformanceCompanyAccessGate
              companyAccessService={companyAccessService}
              expectedSignedInEmail={access.signedInEmail}
              onBack={
                onPortalNavigate
                  ? () => onPortalNavigate('apps')
                  : undefined
              }
            >
              {(selectedCompany, clearCompany) => (
                <div className={styles.app}>
                  <AppLayout
                    activeRouteKey={route.key === 'invoiceDetail' ? 'invoices' : route.key}
                    allowedModuleKeys={getAllowedModuleKeys(access)}
                    userDisplayName={userDisplayName}
                    onNavigate={handleNavigate}
                    onAllApplications={
                      onPortalNavigate
                        ? () => onPortalNavigate('apps')
                        : undefined
                    }
                    currentCompanyLabel={
                      getBcCompanyLabel(selectedCompany)
                    }
                    onChangeCompany={() => {
                      const landingRoute =
                        getAuthorizedLandingRoute(access);
                      if (landingRoute) {
                        handleNavigate(landingRoute);
                      }
                      clearCompany();
                    }}
                    routeTransitionKey={
                      `${selectedCompany.id}:${route.key}:${routePath}`
                    }
                  >
                    {renderRoute(
                      selectedCompany.id,
                      access,
                      selectedCompany
                    )}
                  </AppLayout>
                </div>
              )}
            </BusinessPerformanceCompanyAccessGate>
          )}
        </BusinessPerformanceAuthorizationGate>
      </ToastProvider>
    </ErrorBoundary>
  );
};
