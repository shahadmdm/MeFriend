import * as React from 'react';

import type {
  BusinessPerformancePermissionModuleKey
} from '../config/businessPerformanceAccessConfig';

import type {
  IBusinessPerformanceCurrentAccess
} from '../models/access/IBusinessPerformanceAccessModels';

import type {
  BusinessPerformancePermissionService
} from '../services/access/businessPerformancePermissionService';

export interface IUseBusinessPerformanceAccessResult {
  loading: boolean;
  accessError?: string;
  signedInEmail: string;
  isAuthorized: boolean;
  appUserId?: number;

  canView: (
    moduleKey: BusinessPerformancePermissionModuleKey
  ) => boolean;

  canCreate: (
    moduleKey: BusinessPerformancePermissionModuleKey
  ) => boolean;

  canManage: (
    moduleKey: BusinessPerformancePermissionModuleKey
  ) => boolean;

  refreshAccess: () => Promise<void>;
}

const emptyAccess = ():
  IBusinessPerformanceCurrentAccess => ({
    signedInEmail: '',
    isAuthorized: false,
    permissions: {}
  });

export const useBusinessPerformanceAccess = (
  permissionService: BusinessPerformancePermissionService
): IUseBusinessPerformanceAccessResult => {

  const [loading, setLoading] =
    React.useState<boolean>(true);

  const [access, setAccess] =
    React.useState<IBusinessPerformanceCurrentAccess>(
      emptyAccess
    );

  const requestIdRef = React.useRef<number>(0);

  const refreshAccess = React.useCallback(
    async (): Promise<void> => {
      const requestId = ++requestIdRef.current;

      setLoading(true);

      // Deny access while permissions are refreshed.
      setAccess(emptyAccess());

      try {
        const currentAccess =
          await permissionService.getCurrentAccess();

        if (requestId === requestIdRef.current) {
          setAccess(currentAccess);
        }
      } catch (error) {
        if (requestId === requestIdRef.current) {
          setAccess({
            ...emptyAccess(),
            accessError:
              error instanceof Error
                ? error.message
                : 'Unable to verify Business Performance Tracker access.'
          });
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [permissionService]
  );

  React.useEffect(() => {
    refreshAccess().catch(() => undefined);

    return () => {
      // Ignore responses from outdated requests.
      requestIdRef.current += 1;
    };
  }, [refreshAccess]);

  const canView = React.useCallback(
    (
      moduleKey: BusinessPerformancePermissionModuleKey
    ): boolean =>
      !loading &&
      access.isAuthorized &&
      access.permissions[moduleKey]?.canView === true,
    [access, loading]
  );

  const canCreate = React.useCallback(
    (
      moduleKey: BusinessPerformancePermissionModuleKey
    ): boolean =>
      canView(moduleKey) &&
      access.permissions[moduleKey]?.canCreate === true,
    [access, canView]
  );

  const canManage = React.useCallback(
    (
      moduleKey: BusinessPerformancePermissionModuleKey
    ): boolean =>
      canView(moduleKey) &&
      access.permissions[moduleKey]?.canManage === true,
    [access, canView]
  );

  return {
    loading,
    accessError: access.accessError,
    signedInEmail: access.signedInEmail,
    appUserId: access.appUserId,
    isAuthorized: !loading && access.isAuthorized,
    canView,
    canCreate,
    canManage,
    refreshAccess
  };
};