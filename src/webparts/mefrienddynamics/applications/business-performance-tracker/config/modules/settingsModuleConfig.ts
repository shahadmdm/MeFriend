import {
  unitAccessModuleConfig
} from './unitAccessModuleConfig';

/**
 * A sidebar entry for settings. Reuse the existing module config shape;
 * its route is the parent of the separately protected Module Permissions page.
 */
export const settingsModuleConfig = {
  ...unitAccessModuleConfig,
  key: 'settings',
  title: 'Settings',
  route: 'settings',
  description: 'Manage Business Performance Tracker settings.',
  icon: 'Settings',
  visible: true,
  order: 9000
} as const;
