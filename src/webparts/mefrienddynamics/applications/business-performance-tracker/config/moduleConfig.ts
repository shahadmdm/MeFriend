import type { IAppRouteDefinition } from '../models/common/AppRoute';

import { verticalsModuleConfig } from './modules/verticalsModuleConfig';
import { unitsModuleConfig } from './modules/unitsModuleConfig';
import { targetsModuleConfig } from './modules/targetsModuleConfig';
import { collectionReportModuleConfig } from './modules/collectionReportModuleConfig';

export const moduleDefinitions = [
  verticalsModuleConfig,
  unitsModuleConfig,
  targetsModuleConfig,
  collectionReportModuleConfig
] as const;

export const routeDefinitions: readonly IAppRouteDefinition[] = [
  {
    key: 'verticals',
    path: verticalsModuleConfig.route,
    title: verticalsModuleConfig.title,
    moduleKey: verticalsModuleConfig.key,
    showInNavigation: true
  },
  {
    key: 'verticalCreate',
    path: `${verticalsModuleConfig.route}/create`,
    title: 'Add Vertical',
    moduleKey: verticalsModuleConfig.key,
    showInNavigation: false
  },
  {
    key: 'verticalEdit',
    path: `${verticalsModuleConfig.route}/edit/:id`,
    title: 'Edit Vertical',
    moduleKey: verticalsModuleConfig.key,
    showInNavigation: false
  },
  {
    key: 'units',
    path: unitsModuleConfig.route,
    title: unitsModuleConfig.title,
    moduleKey: unitsModuleConfig.key,
    showInNavigation: true
  },
  {
    key: 'unitCreate',
    path: `${unitsModuleConfig.route}/create`,
    title: 'Add Unit',
    moduleKey: unitsModuleConfig.key,
    showInNavigation: false
  },
  {
    key: 'unitEdit',
    path: `${unitsModuleConfig.route}/edit/:id`,
    title: 'Edit Unit',
    moduleKey: unitsModuleConfig.key,
    showInNavigation: false
  },
  {
    key: 'targets',
    path: targetsModuleConfig.route,
    title: targetsModuleConfig.title,
    moduleKey: targetsModuleConfig.key,
    showInNavigation: true
  },
  {
    key: 'targetCreate',
    path: `${targetsModuleConfig.route}/create`,
    title: 'Add Target',
    moduleKey: targetsModuleConfig.key,
    showInNavigation: false
  },
  {
    key: 'targetEdit',
    path: `${targetsModuleConfig.route}/edit/:id`,
    title: 'Edit Target',
    moduleKey: targetsModuleConfig.key,
    showInNavigation: false
  },
  {
    key: 'collectionReport',
    path: collectionReportModuleConfig.route,
    title: collectionReportModuleConfig.title,
    moduleKey: collectionReportModuleConfig.key,
    showInNavigation: true
  }
];

export {
  verticalsModuleConfig,
  unitsModuleConfig,
  targetsModuleConfig,
  collectionReportModuleConfig
};