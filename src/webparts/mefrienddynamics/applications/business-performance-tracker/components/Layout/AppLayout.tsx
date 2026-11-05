import * as React from 'react';
import { Icon } from '@fluentui/react';

import { appConfig } from '../../config/appConfig';
import type { AppRouteKey } from '../../models/common/AppRoute';
import { buildPortalHref } from '../../../../shared/routing/hashPaths';
import mefriendLogo from '../../../../shared/assets/unnamed.png';

import { AppNavigation } from '../Navigation/AppNavigation';

import styles from '../../../bc-extension/components/Layout/AppLayout.module.scss';

export interface IAppLayoutProps {
  currentCompanyLabel?: string;
  onChangeCompany?: () => void;
  allowedModuleKeys?: readonly string[];
  activeRouteKey: AppRouteKey;
  userDisplayName: string;
  onNavigate: (path: string) => void;
  onAllApplications?: () => void;
  routeTransitionKey: string;
  children: React.ReactNode;
}

const getInitials = (displayName: string): string => {
  const nameParts = displayName
    .split(' ')
    .map(part => part.trim())
    .filter(part => part.length > 0);

  if (!nameParts.length) {
    return 'MF';
  }

  if (nameParts.length === 1) {
    return nameParts[0].substring(0, 2).toUpperCase();
  }

  return `${nameParts[0].charAt(0)}${nameParts[nameParts.length - 1].charAt(0)}`.toUpperCase();
};


export const AppLayout: React.FC<IAppLayoutProps> = ({
  activeRouteKey,
  userDisplayName,
  currentCompanyLabel,
  onChangeCompany,
  allowedModuleKeys,
  onNavigate,
  onAllApplications,
  routeTransitionKey,
  children
}) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = React.useState(false);

  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const userInitials = getInitials(userDisplayName);

  const layoutClassName = isSidebarCollapsed
    ? `${styles.appLayout} ${styles.collapsed}`
    : styles.appLayout;

  const isFormRoute =
    activeRouteKey === 'verticalCreate' ||
    activeRouteKey === 'verticalEdit' ||
    activeRouteKey === 'unitCreate' ||
    activeRouteKey === 'unitEdit' ||
    activeRouteKey === 'targetCreate' ||
    activeRouteKey === 'targetEdit';

  const routeTransitionClassName = isFormRoute
    ? `${styles.routeTransition} ${styles.createRouteTransition}`
    : styles.routeTransition;

  React.useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, left: 0 });
  }, [routeTransitionKey]);

  React.useEffect(() => {
    if (!isMobileDrawerOpen) {
      return undefined;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsMobileDrawerOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileDrawerOpen]);

  const handleAllApplicationsClick = (
    event: React.MouseEvent<HTMLAnchorElement>
  ): void => {
    if (
      onAllApplications &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    ) {
      event.preventDefault();
      setIsMobileDrawerOpen(false);
      onAllApplications();
    }
  };

  const handleMobileNavigate = (path: string): void => {
    setIsMobileDrawerOpen(false);
    onNavigate(path);
  };

  return (
    <div className={layoutClassName}>
      <header className={styles.mobileHeader}>
        <button
          aria-controls="business-performance-mobile-navigation"
          aria-expanded={isMobileDrawerOpen}
          aria-label="Open navigation menu"
          className={styles.mobileMenuButton}
          onClick={() => setIsMobileDrawerOpen(true)}
          type="button"
        >
          <Icon iconName="GlobalNavButton" aria-hidden="true" />
        </button>

        <div className={styles.mobileBrand}>
          <img className={styles.mobileBrandMark} src={mefriendLogo} alt="" />
          <span>{appConfig.appName}</span>
        </div>

        <a
          className={styles.mobileAllApps}
          href={buildPortalHref('apps')}
          onClick={handleAllApplicationsClick}
          aria-label="All Applications"
          title="All Applications"
        >
          <Icon iconName="Home" aria-hidden="true" />
        </a>

        <span
          className={styles.mobileAvatar}
          aria-label={`Signed in as ${userDisplayName}`}
        >
          {userInitials}
        </span>
      </header>

      <div
        aria-hidden={!isMobileDrawerOpen}
        className={
          isMobileDrawerOpen
            ? `${styles.mobileDrawerOverlay} ${styles.mobileDrawerOverlayOpen}`
            : styles.mobileDrawerOverlay
        }
        onClick={() => setIsMobileDrawerOpen(false)}
      />

      <aside
        aria-label="Mobile navigation"
        aria-modal={isMobileDrawerOpen}
        className={
          isMobileDrawerOpen
            ? `${styles.mobileDrawer} ${styles.mobileDrawerOpen}`
            : styles.mobileDrawer
        }
        id="business-performance-mobile-navigation"
        role="dialog"
      >
        <div className={styles.mobileDrawerHeader}>
          <div className={styles.mobileBrand}>
            <img className={styles.mobileBrandMark} src={mefriendLogo} alt="" />
            <span>{appConfig.appName}</span>
          </div>

          <button
            aria-label="Close navigation menu"
            className={styles.mobileCloseButton}
            onClick={() => setIsMobileDrawerOpen(false)}
            type="button"
          >
            <Icon iconName="Cancel" aria-hidden="true" />
          </button>
        </div>

        <a
          className={styles.allApplicationsLink}
          href={buildPortalHref('apps')}
          onClick={handleAllApplicationsClick}
        >
          <Icon iconName="Back" aria-hidden="true" />
          <span>All Applications</span>
        </a>

            {currentCompanyLabel && onChangeCompany ? (
              <div
                className={`${styles.companyPanel} ${styles.mobileCompanyPanel}`}
              >
                <span className={styles.companyMeta}>
                  <span className={styles.companyCaption}>
                    Company
                  </span>

                  <strong
                    className={styles.companyName}
                    title={currentCompanyLabel}
                  >
                    {currentCompanyLabel}
                  </strong>
                </span>

                <button
                  className={styles.changeCompanyButton}
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    onChangeCompany();
                  }}
                  type="button"
                >
                  <Icon iconName="Switch" aria-hidden="true" />
                  <span>Change Company</span>
                </button>
              </div>
            ) : null}

        <AppNavigation
          activeRouteKey={activeRouteKey}
          isCollapsed={false}
          onNavigate={handleMobileNavigate}
          allowedModuleKeys={allowedModuleKeys}
        />

        <div className={styles.mobileUserPanel}>
          <span className={styles.userAvatar} aria-hidden="true">
            {userInitials}
          </span>

          <span className={styles.userMeta}>
            <span>Signed in</span>
            <strong>{userDisplayName}</strong>
          </span>
        </div>
      </aside>

      <aside className={styles.sidebar}>
        <div className={styles.sidebarPanel}>
          <button
            aria-label={
              isSidebarCollapsed
                ? 'Expand side navigation'
                : 'Collapse side navigation'
            }
            aria-pressed={isSidebarCollapsed}
            className={styles.sidebarToggle}
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            type="button"
          >
            <Icon
              iconName={
                isSidebarCollapsed
                  ? 'DoubleChevronRight12'
                  : 'DoubleChevronLeft12'
              }
              aria-hidden="true"
            />
          </button>

          <div className={styles.brand}>
            <img
              className={styles.brandMark}
              src={mefriendLogo}
              alt="MeFriend"
            />

            <div className={styles.brandText}>
              <h1>{appConfig.appName}</h1>
            </div>
          </div>

          <a
            className={styles.allApplicationsLink}
            href={buildPortalHref('apps')}
            onClick={handleAllApplicationsClick}
            title={isSidebarCollapsed ? 'All Applications' : undefined}
          >
            <Icon iconName="Back" aria-hidden="true" />
            <span>All Applications</span>
          </a>
          {currentCompanyLabel && onChangeCompany ? (
            <div className={styles.companyPanel}>
              <span className={styles.companyMeta}>
                <span className={styles.companyCaption}>
                  Company
                </span>

                <strong
                  className={styles.companyName}
                  title={currentCompanyLabel}
                >
                  {currentCompanyLabel}
                </strong>
              </span>

              <button
                className={styles.changeCompanyButton}
                onClick={onChangeCompany}
                type="button"
                title="Change Company"
              >
                <Icon iconName="Switch" aria-hidden="true" />
                <span>Change Company</span>
              </button>
            </div>
          ) : null}


          <AppNavigation
            activeRouteKey={activeRouteKey}
            isCollapsed={isSidebarCollapsed}
            onNavigate={onNavigate}
            allowedModuleKeys={allowedModuleKeys}
          />

          <div className={styles.userPanel}>
            <div className={styles.userButton}>
              <span className={styles.userAvatar} aria-hidden="true">
                {userInitials}
              </span>

              <span className={styles.userMeta}>
                <span>Signed in</span>
                <strong>{userDisplayName}</strong>
              </span>
            </div>
          </div>
        </div>
      </aside>

      <main className={styles.main}>
        <div
          className={styles.content}
          data-mefriend-content="true"
          ref={contentRef}
        >
          <div
            className={routeTransitionClassName}
            key={routeTransitionKey}
          >
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};