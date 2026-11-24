import * as React from 'react';
import { createPortal } from 'react-dom';

import { appConfig } from '../../config/appConfig';
import type { AppRouteKey } from '../../models/common/AppRoute';
import { buildHashHref } from '../../utils/routeUtils';
import { buildPortalHref } from '../../../../shared/routing/hashPaths';
import mefriendLogo from '../../../../shared/assets/unnamed.png';
import { AppNavigation } from '../Navigation/AppNavigation';

// Keep the existing layout styles and DOM structure intact.
import styles from '../../../bc-extension/components/Layout/AppLayout.module.scss';
// Only popup/trigger styles live here; no Fluent UI menu components.
import menuStyles from './UserMenu.module.scss';

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

type LayoutIconName =
  | 'menu'
  | 'home'
  | 'close'
  | 'back'
  | 'switch'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-up'
  | 'chevron-down'
  | 'settings';

// Native SVG icons avoid adding another UI framework to AppLayout.
const LayoutIcon: React.FC<{
  name: LayoutIconName;
  className?: string;
}> = ({ name, className }) => {
  let paths: React.ReactNode = null;
  switch (name) {
    case 'menu':
      paths = <><path d="M4 7h16M4 12h16M4 17h16" /></>;
      break;
    case 'home':
      paths = <><path d="m3 11 9-8 9 8" /><path d="M5 10v11h14V10M9 21v-7h6v7" /></>;
      break;
    case 'close':
      paths = <path d="M5 5l14 14M19 5 5 19" />;
      break;
    case 'back':
      paths = <><path d="m11 5-7 7 7 7" /><path d="M4 12h16" /></>;
      break;
    case 'switch':
      paths = <><path d="M4 7h15m-4-4 4 4-4 4" /><path d="M20 17H5m4-4-4 4 4 4" /></>;
      break;
    case 'chevron-left':
      paths = <path d="m15 5-7 7 7 7" />;
      break;
    case 'chevron-right':
      paths = <path d="m9 5 7 7-7 7" />;
      break;
    case 'chevron-up':
      paths = <path d="m5 15 7-7 7 7" />;
      break;
    case 'chevron-down':
      paths = <path d="m5 9 7 7 7-7" />;
      break;
    case 'settings':
      paths = <><circle cx="12" cy="12" r="3" /><path d="M10 2h4l.6 2.3 1.7.7 2.1-1.2 2.8 2.8L20 8.7l.7 1.7L23 11v3l-2.3.6-.7 1.7 1.2 2.1-2.8 2.8-2.1-1.2-1.7.7L14 23h-4l-.6-2.3-1.7-.7-2.1 1.2-2.8-2.8L4 16.3l-.7-1.7L1 14v-3l2.3-.6L4 8.7 2.8 6.6l2.8-2.8L7.7 5l1.7-.7L10 2Z" transform="translate(1 1) scale(.9)" /></>;
      break;
  }
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
};

const getInitials = (displayName: string): string => {
  const nameParts = displayName
    .split(' ')
    .map(part => part.trim())
    .filter(part => part.length > 0);

  if (nameParts.length === 0) {
    return 'MF';
  }
  if (nameParts.length === 1) {
    return nameParts[0].substring(0, 2).toUpperCase();
  }
  return `${nameParts[0].charAt(0)}${nameParts[nameParts.length - 1].charAt(0)}`.toUpperCase();
};

type UserPanelName = 'desktop' | 'mobile';
interface IMenuPosition {
  left: number;
  top: number;
  width: number;
}

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
  const [openUserPanel, setOpenUserPanel] = React.useState<UserPanelName | null>(null);
  const [menuPosition, setMenuPosition] = React.useState<IMenuPosition>({
    left: 8,
    top: 8,
    width: 240
  });

  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const desktopUserButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const mobileUserButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const userMenuRef = React.useRef<HTMLDivElement | null>(null);

  const userInitials = getInitials(userDisplayName);
  const canOpenSettings = allowedModuleKeys !== undefined &&
    allowedModuleKeys.indexOf('settings') !== -1;
  const isSettingsActive = activeRouteKey === 'settings' ||
    activeRouteKey === 'modulePermissions';

  // Settings and its Module Permissions child belong to the account menu,
  // not to the primary sidebar. Do not alter the underlying route guards.
  const sidebarModuleKeys = allowedModuleKeys === undefined
    ? undefined
    : allowedModuleKeys.filter(key =>
        key !== 'settings' && key !== 'modulePermissions'
      );

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

  const updateMenuPosition = React.useCallback((which: UserPanelName): void => {
    const anchor = which === 'desktop'
      ? desktopUserButtonRef.current
      : mobileUserButtonRef.current;
    if (!anchor) {
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const width = Math.max(1, Math.min(246, window.innerWidth - 16));
    const height = userMenuRef.current?.offsetHeight || 112;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const above = rect.top - height - 8;
    const below = rect.bottom + 8;
    const top = above >= 8
      ? above
      : Math.max(8, Math.min(below, window.innerHeight - height - 8));

    setMenuPosition({ left, top, width });
  }, []);

  const toggleUserMenu = (which: UserPanelName): void => {
    if (openUserPanel === which) {
      setOpenUserPanel(null);
      return;
    }
    // Place the menu above the clicked user panel before rendering it.
    updateMenuPosition(which);
    setOpenUserPanel(which);
  };

  React.useLayoutEffect(() => {
    if (openUserPanel) {
      updateMenuPosition(openUserPanel);
    }
  }, [openUserPanel, updateMenuPosition]);

  React.useEffect(() => {
    if (!openUserPanel) {
      return undefined;
    }

    const handleOutsideMouse = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      const activeButton = openUserPanel === 'desktop'
        ? desktopUserButtonRef.current
        : mobileUserButtonRef.current;
      if (activeButton?.contains(target) || userMenuRef.current?.contains(target)) {
        return;
      }
      setOpenUserPanel(null);
    };
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpenUserPanel(null);
        const activeButton = openUserPanel === 'desktop'
          ? desktopUserButtonRef.current
          : mobileUserButtonRef.current;
        activeButton?.focus();
      }
    };
    const handleReposition = (): void => {
      updateMenuPosition(openUserPanel);
    };

    document.addEventListener('mousedown', handleOutsideMouse);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', handleReposition);
    // Capturing scroll catches inner sidebar scroll containers as well.
    document.addEventListener('scroll', handleReposition, true);

    return () => {
      document.removeEventListener('mousedown', handleOutsideMouse);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', handleReposition);
      document.removeEventListener('scroll', handleReposition, true);
    };
  }, [openUserPanel, updateMenuPosition]);

  React.useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, left: 0 });
    setOpenUserPanel(null);
  }, [routeTransitionKey]);

  React.useEffect(() => {
    if (!isMobileDrawerOpen) {
      return undefined;
    }
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpenUserPanel(null);
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
      setOpenUserPanel(null);
      setIsMobileDrawerOpen(false);
      onAllApplications();
    }
  };

  const handleMobileNavigate = (path: string): void => {
    setOpenUserPanel(null);
    setIsMobileDrawerOpen(false);
    onNavigate(path);
  };

  const handleSettingsClick = (event: React.MouseEvent<HTMLAnchorElement>): void => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    setOpenUserPanel(null);
    setIsMobileDrawerOpen(false);
    onNavigate('settings');
  };

  const handleMobileDrawerClose = (): void => {
    setOpenUserPanel(null);
    setIsMobileDrawerOpen(false);
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
          <LayoutIcon name="menu" />
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
          <LayoutIcon name="home" />
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
        onClick={handleMobileDrawerClose}
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
            onClick={handleMobileDrawerClose}
            type="button"
          >
            <LayoutIcon name="close" />
          </button>
        </div>

        <a
          className={styles.allApplicationsLink}
          href={buildPortalHref('apps')}
          onClick={handleAllApplicationsClick}
        >
          <LayoutIcon name="back" />
          <span>All Applications</span>
        </a>

        {currentCompanyLabel && onChangeCompany ? (
          <div className={`${styles.companyPanel} ${styles.mobileCompanyPanel}`}>
            <span className={styles.companyMeta}>
              <span className={styles.companyCaption}>Company</span>
              <strong className={styles.companyName} title={currentCompanyLabel}>
                {currentCompanyLabel}
              </strong>
            </span>
            <button
              className={styles.changeCompanyButton}
              onClick={() => {
                handleMobileDrawerClose();
                onChangeCompany();
              }}
              type="button"
            >
              <LayoutIcon name="switch" />
              <span>Change Company</span>
            </button>
          </div>
        ) : null}

        <AppNavigation
          activeRouteKey={activeRouteKey}
          isCollapsed={false}
          onNavigate={handleMobileNavigate}
          allowedModuleKeys={sidebarModuleKeys}
        />

        <button
          ref={mobileUserButtonRef}
          className={`${styles.mobileUserPanel} ${menuStyles.userTrigger}`}
          type="button"
          aria-label={`Account options for ${userDisplayName}`}
          aria-haspopup="menu"
          aria-expanded={openUserPanel === 'mobile'}
          onClick={() => toggleUserMenu('mobile')}
        >
          <span className={styles.userAvatar} aria-hidden="true">
            {userInitials}
          </span>
          <span className={styles.userMeta}>
            <span>Signed in</span>
            <strong>{userDisplayName}</strong>
          </span>
          <LayoutIcon
            name={openUserPanel === 'mobile' ? 'chevron-up' : 'chevron-down'}
            className={menuStyles.userChevron}
          />
        </button>
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
            onClick={() => {
              setOpenUserPanel(null);
              setIsSidebarCollapsed(!isSidebarCollapsed);
            }}
            type="button"
          >
            <LayoutIcon name={isSidebarCollapsed ? 'chevron-right' : 'chevron-left'} />
          </button>

          <div className={styles.brand}>
            <img className={styles.brandMark} src={mefriendLogo} alt="MeFriend" />
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
            <LayoutIcon name="back" />
            <span>All Applications</span>
          </a>

          {currentCompanyLabel && onChangeCompany ? (
            <div className={styles.companyPanel}>
              <span className={styles.companyMeta}>
                <span className={styles.companyCaption}>Company</span>
                <strong className={styles.companyName} title={currentCompanyLabel}>
                  {currentCompanyLabel}
                </strong>
              </span>
              <button
                className={styles.changeCompanyButton}
                onClick={() => {
                  setOpenUserPanel(null);
                  onChangeCompany();
                }}
                type="button"
                title="Change Company"
              >
                <LayoutIcon name="switch" />
                <span>Change Company</span>
              </button>
            </div>
          ) : null}

          <AppNavigation
            activeRouteKey={activeRouteKey}
            isCollapsed={isSidebarCollapsed}
            onNavigate={onNavigate}
            allowedModuleKeys={sidebarModuleKeys}
          />

          <div className={styles.userPanel}>
            <button
              ref={desktopUserButtonRef}
              className={`${styles.userButton} ${menuStyles.userTrigger}`}
              type="button"
              aria-label={`Account options for ${userDisplayName}`}
              aria-haspopup="menu"
              aria-expanded={openUserPanel === 'desktop'}
              onClick={() => toggleUserMenu('desktop')}
              title={isSidebarCollapsed ? userDisplayName : undefined}
            >
              <span className={styles.userAvatar} aria-hidden="true">
                {userInitials}
              </span>
              <span className={styles.userMeta}>
                <span>Signed in</span>
                <strong>{userDisplayName}</strong>
              </span>
              <LayoutIcon
                name={openUserPanel === 'desktop' ? 'chevron-up' : 'chevron-down'}
                className={menuStyles.userChevron}
              />
            </button>
          </div>
        </div>
      </aside>

      <main className={styles.main}>
        <div
          className={styles.content}
          data-mefriend-content="true"
          ref={contentRef}
        >
          <div className={routeTransitionClassName} key={routeTransitionKey}>
            {children}
          </div>
        </div>
      </main>

      {openUserPanel && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={userMenuRef}
              className={menuStyles.userMenu}
              role="menu"
              aria-label="User settings"
              style={{
                left: menuPosition.left,
                top: menuPosition.top,
                width: menuPosition.width
              }}
            >
              <div className={menuStyles.menuHeader}>
                Signed in as <strong>{userDisplayName}</strong>
              </div>
              {canOpenSettings ? (
                <a
                  role="menuitem"
                  className={isSettingsActive
                    ? `${menuStyles.menuItem} ${menuStyles.menuItemActive}`
                    : menuStyles.menuItem}
                  href={buildHashHref('settings')}
                  onClick={handleSettingsClick}
                  aria-current={isSettingsActive ? 'page' : undefined}
                >
                  <LayoutIcon name="settings" />
                  <span>Settings</span>
                </a>
              ) : (
                <div className={menuStyles.emptyState}>No account actions available.</div>
              )}
            </div>,
            document.body
          )
        : null}
    </div>
  );
};
