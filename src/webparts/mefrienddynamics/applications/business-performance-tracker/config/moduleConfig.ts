import type { IAppRouteDefinition } from '../models/common/AppRoute';

import { verticalsModuleConfig } from './modules/verticalsModuleConfig';
import { unitsModuleConfig } from './modules/unitsModuleConfig';
import { targetsModuleConfig } from './modules/targetsModuleConfig';
import { collectionReportModuleConfig } from './modules/collectionReportModuleConfig';
import { collectionVerticalReportModuleConfig } from './modules/collectionVerticalReportModuleConfig';
import { collectionOnBillsModuleConfig } from './modules/collectionOnBillsModuleConfig';

// Reuse the existing BC Extension invoice module configuration.
import { invoicesModuleConfig } from '../../bc-extension/config/modules/invoicesModuleConfig';

import { unitAccessModuleConfig } from './modules/unitAccessModuleConfig';
import { modulePermissionsModuleConfig } from './modules/modulePermissionsModuleConfig';
import { settingsModuleConfig } from './modules/settingsModuleConfig';

// Position Invoices after Collection on Bills in the BPT sidebar.
const bptInvoicesModuleConfig = {
  ...invoicesModuleConfig,
  order: collectionOnBillsModuleConfig.order + 1
};

// Main sidebar modules only.
// Settings is accessed through the signed-in user popup.

export const moduleDefinitions = [
  verticalsModuleConfig,
  unitsModuleConfig,
  targetsModuleConfig,
  collectionReportModuleConfig,
  collectionVerticalReportModuleConfig,
  collectionOnBillsModuleConfig,
  bptInvoicesModuleConfig
] as const;

export const routeDefinitions: readonly IAppRouteDefinition[] = [
  {
    key: 'verticals', path: verticalsModuleConfig.route,
    title: verticalsModuleConfig.title, moduleKey: verticalsModuleConfig.key,
    showInNavigation: true
  },
  {
    key: 'verticalCreate', path: `${verticalsModuleConfig.route}/create`,
    title: 'Add Vertical', moduleKey: verticalsModuleConfig.key,
    showInNavigation: false
  },
  {
    key: 'verticalEdit', path: `${verticalsModuleConfig.route}/edit/:id`,
    title: 'Edit Vertical', moduleKey: verticalsModuleConfig.key,
    showInNavigation: false
  },
  {
    key: 'units', path: unitsModuleConfig.route,
    title: unitsModuleConfig.title, moduleKey: unitsModuleConfig.key,
    showInNavigation: true
  },
  {
    key: 'unitCreate', path: `${unitsModuleConfig.route}/create`,
    title: 'Add Unit', moduleKey: unitsModuleConfig.key,
    showInNavigation: false
  },
  {
    key: 'unitEdit', path: `${unitsModuleConfig.route}/edit/:id`,
    title: 'Edit Unit', moduleKey: unitsModuleConfig.key,
    showInNavigation: false
  },
  {
    key: 'targets', path: targetsModuleConfig.route,
    title: targetsModuleConfig.title, moduleKey: targetsModuleConfig.key,
    showInNavigation: true
  },
  {
    key: 'targetCreate', path: `${targetsModuleConfig.route}/create`,
    title: 'Add Target', moduleKey: targetsModuleConfig.key,
    showInNavigation: false
  },
  {
    key: 'targetEdit', path: `${targetsModuleConfig.route}/edit/:id`,
    title: 'Edit Target', moduleKey: targetsModuleConfig.key,
    showInNavigation: false
  },
  {
    key: 'collectionReport', path: collectionReportModuleConfig.route,
    title: collectionReportModuleConfig.title,
    moduleKey: collectionReportModuleConfig.key,
    showInNavigation: true
  },
  {
    key: 'collectionVerticalReport', path: collectionVerticalReportModuleConfig.route,
    title: collectionVerticalReportModuleConfig.title,
    moduleKey: collectionVerticalReportModuleConfig.key,
    showInNavigation: true
  },

  {
    key: 'collectionOnBills',
    path: collectionOnBillsModuleConfig.route,
    title: collectionOnBillsModuleConfig.title,
    moduleKey: collectionOnBillsModuleConfig.key,
    showInNavigation: true
  },
  {
    key: 'invoices',
    path: bptInvoicesModuleConfig.route,
    title: bptInvoicesModuleConfig.title,
    moduleKey: bptInvoicesModuleConfig.key,
    showInNavigation: true
  },
  {
    key: 'invoiceDetail',
    path: `${bptInvoicesModuleConfig.route}/detail/:id`,
    title: 'Invoice Details',
    moduleKey: bptInvoicesModuleConfig.key,
    showInNavigation: false
  },
  {
    key: 'unitAccess',
    path: unitAccessModuleConfig.route,
    title: unitAccessModuleConfig.title,
    moduleKey: unitAccessModuleConfig.key,
    showInNavigation: false
  },
  {
    key: 'modulePermissions', path: modulePermissionsModuleConfig.route,
    title: modulePermissionsModuleConfig.title,
    moduleKey: modulePermissionsModuleConfig.key,
    showInNavigation: false
  },
  {
    key: 'settings', path: settingsModuleConfig.route,
    title: settingsModuleConfig.title,
    moduleKey: settingsModuleConfig.key,
    showInNavigation: false
  }
];

export {
  verticalsModuleConfig,
  unitsModuleConfig,
  targetsModuleConfig,
  collectionReportModuleConfig,
  collectionVerticalReportModuleConfig,
  collectionOnBillsModuleConfig,
  bptInvoicesModuleConfig,
  unitAccessModuleConfig,
  modulePermissionsModuleConfig,
  settingsModuleConfig
};
