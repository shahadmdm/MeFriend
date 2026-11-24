import type {
  BusinessPerformancePermissionModuleKey
} from '../../config/businessPerformanceAccessConfig';

/**
 * Permission record stored in the
 * Business Performance App User Permissions list.
 */
export interface IBusinessPerformanceUserPermission {
  id?: number;
  appUserId: number;
  moduleKey: BusinessPerformancePermissionModuleKey;
  canView: boolean;
  canCreate: boolean;
  canManage: boolean;
  isActive: boolean;
}

/**
 * Effective permissions for an application module.
 */
export interface IBusinessPerformanceModuleAccess {
  moduleKey: BusinessPerformancePermissionModuleKey;
  canView: boolean;
  canCreate: boolean;
  canManage: boolean;
  isActive: boolean;
}

/**
 * Access permissions indexed by module key.
 */
export type BusinessPerformanceAccessMap = Readonly<
  Partial<
    Record<
      BusinessPerformancePermissionModuleKey,
      IBusinessPerformanceModuleAccess
    >
  >
>;

/**
 * Current signed-in user's Tracker access information.
 */
export interface IBusinessPerformanceCurrentAccess {
  signedInEmail: string;
  appUserId?: number;
  isAuthorized: boolean;
  permissions: BusinessPerformanceAccessMap;
  accessError?: string;
}