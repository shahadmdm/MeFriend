
import {
  unitAccessModuleConfig
} from './unitAccessModuleConfig';

export const modulePermissionsModuleConfig = {
  ...unitAccessModuleConfig,
  key: 'modulePermissions',
  title: 'Module Permissions',
  route: 'module-permissions',
  description:
    'Manage Business Performance Tracker module permissions for App Users.'
} as const;
