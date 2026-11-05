
import * as React from 'react';
import { Icon } from '@fluentui/react';

import {
  moduleDefinitions,
  routeDefinitions
} from '../../config/moduleConfig';

import type {
  AppRouteKey
} from '../../models/common/AppRoute';

import {
  buildHashHref
} from '../../utils/routeUtils';

import styles from '../../../bc-extension/components/Navigation/AppNavigation.module.scss';

export interface IAppNavigationProps {
  activeRouteKey: AppRouteKey;
  isCollapsed?: boolean;
  onNavigate: (path: string) => void;

  /**
   * Module keys that the signed-in user
   * is permitted to view.
   *
   * Undefined preserves existing behavior
   * until AppLayout and App are connected.
   *
   * An empty array hides all modules.
   */
  allowedModuleKeys?: readonly string[];
}

const moduleIconNames: Readonly<Record<string, string>> = {
  verticals: 'BranchMerge',
  units: 'CityNext',
  targets: 'Bullseye'
};

export const AppNavigation: React.FC<IAppNavigationProps> = ({
  activeRouteKey,
  isCollapsed = false,
  onNavigate,
  allowedModuleKeys
}) => {
  const navigationModules = moduleDefinitions
    .filter(moduleItem => {
      if (!moduleItem.visible) {
        return false;
      }

      // Preserve existing navigation behavior
      // until permissions are supplied.
      if (allowedModuleKeys === undefined) {
        return true;
      }

      // Display only modules explicitly allowed.
      // indexOf is compatible with this project's
      // TypeScript library configuration.
      return (
        allowedModuleKeys.indexOf(moduleItem.key) !== -1
      );
    })
    .slice()
    .sort(
      (firstModule, secondModule) =>
        firstModule.order - secondModule.order
    );

  const activeRoute = routeDefinitions.find(
    route => route.key === activeRouteKey
  );

  return (
    <nav
      className={
        isCollapsed
          ? `${styles.navigation} ${styles.collapsed}`
          : styles.navigation
      }
      aria-label="Business Performance Tracker modules"
    >
      {navigationModules.map(moduleItem => {
        const isActive = activeRoute
          ? moduleItem.key === activeRoute.moduleKey
          : false;

        return (
          <a
            key={moduleItem.key}
            className={
              isActive
                ? `${styles.navItem} ${styles.active}`
                : styles.navItem
            }
            href={buildHashHref(moduleItem.route)}
            aria-current={
              isActive ? 'page' : undefined
            }
            title={
              isCollapsed
                ? moduleItem.title
                : undefined
            }
            onClick={event => {
              event.preventDefault();
              onNavigate(moduleItem.route);
            }}
          >
            <Icon
              className={styles.navIcon}
              iconName={
                moduleIconNames[moduleItem.key] ||
                moduleItem.icon
              }
              aria-hidden="true"
            />

            <span className={styles.navLabel}>
              {moduleItem.title}
            </span>
          </a>
        );
      })}
    </nav>
  );
};