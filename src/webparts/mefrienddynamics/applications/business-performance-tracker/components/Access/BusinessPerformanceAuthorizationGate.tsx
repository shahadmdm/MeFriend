import * as React from 'react';

import {
  AppLoader
} from '../../../../shared/components/loaders/AppLoader';

import {
  AccessDenied
} from '../../../../shared/components/errorState/AccessDenied';

import {
  useBusinessPerformanceAccess
} from '../../hooks/useBusinessPerformanceAccess';

import type {
  IUseBusinessPerformanceAccessResult
} from '../../hooks/useBusinessPerformanceAccess';

import type {
  BusinessPerformancePermissionService
} from '../../services/access/businessPerformancePermissionService';

export interface IBusinessPerformanceAuthorizationGateProps {
  permissionService: BusinessPerformancePermissionService;

  children: (
    access: IUseBusinessPerformanceAccessResult
  ) => React.ReactNode;
}

export const BusinessPerformanceAuthorizationGate:
  React.FC<IBusinessPerformanceAuthorizationGateProps> = ({
    permissionService,
    children
  }) => {
    const access =
      useBusinessPerformanceAccess(permissionService);

    if (access.loading) {
      return (
        <AppLoader
          label="Verifying Business Performance Tracker access"
        />
      );
    }

    if (!access.isAuthorized) {
      return (
        <AccessDenied
          title="Access Denied"
          message={
            access.accessError ||
            'You do not have permission to access ' +
              'Business Performance Tracker. ' +
              'Please contact the administrator.'
          }
        />
      );
    }

    return <>{children(access)}</>;
  };