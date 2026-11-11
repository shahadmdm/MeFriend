import * as React from 'react';
import type { PageContext } from '@microsoft/sp-page-context';
import type { SPHttpClient } from '@microsoft/sp-http';

import { PageContainer } from '../../../../../shared/components/pageContainer/PageContainer';
import type { UnitService } from '../../../services/units/unitService';
import type { BusinessPerformanceUnitAccessService } from '../../../services/access/businessPerformanceUnitAccessService';
import { BusinessPerformanceModulePermissionsPage } from '../modulePermissions/BusinessPerformanceModulePermissionsPage';
import { BusinessPerformanceUnitAccessManager } from '../unitAccess/BusinessPerformanceUnitAccessManager';
import styles from './SettingsPage.module.scss';

type SettingsSectionKey = 'modulePermissions' | 'unitAccess';

interface ISettingsSection {
  key: SettingsSectionKey;
  title: string;
  description: string;
}

export interface ISettingsPageProps {
  pageContext?: PageContext;
  spHttpClient?: SPHttpClient;
  webAbsoluteUrl: string;
  selectedCompanyId: string;
  unitService: UnitService;
  unitAccessService: BusinessPerformanceUnitAccessService;
  canManageModulePermissions: boolean;
  canManageUnitAccess: boolean;
  // Retained as optional for compatibility with existing SettingsPage callers.
  onNavigate?: (path: string) => void;
}

// Native SVG only; no Fluent UI menu or icon dependency.
const AccessIcon: React.FC<{ section: SettingsSectionKey }> = ({ section }) => (
  <svg
    width="19"
    height="19"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {section === 'modulePermissions' ? (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ) : (
      <>
        <rect x="3" y="4" width="7" height="7" rx="1.5" />
        <rect x="14" y="4" width="7" height="7" rx="1.5" />
        <rect x="8.5" y="15" width="7" height="7" rx="1.5" />
        <path d="M6.5 11v2h12v-2M12 13v2" />
      </>
    )}
  </svg>
);

export const SettingsPage: React.FC<ISettingsPageProps> = ({
  pageContext,
  spHttpClient,
  webAbsoluteUrl,
  selectedCompanyId,
  unitService,
  unitAccessService,
  canManageModulePermissions,
  canManageUnitAccess
}) => {
  const [requestedSection, setRequestedSection] =
    React.useState<SettingsSectionKey>('modulePermissions');

  const sections = React.useMemo<readonly ISettingsSection[]>(() => {
    const visible: ISettingsSection[] = [];

    if (canManageModulePermissions) {
      visible.push({
        key: 'modulePermissions',
        title: 'Module Permissions',
        description: 'Manage which modules App Users may view, create and manage.'
      });
    }

    if (canManageUnitAccess) {
      visible.push({
        key: 'unitAccess',
        title: 'Unit Access',
        description: 'Assign permitted units to App Users for the selected company.'
      });
    }

    return visible;
  }, [canManageModulePermissions, canManageUnitAccess]);

  // If a section becomes unavailable, select the first permitted one.
  const activeSection = sections.find(item => item.key === requestedSection) || sections[0];

  return (
    <PageContainer
      title="Settings"
      description="Manage Business Performance Tracker access and permissions."
    >
      {activeSection ? (
        <div className={styles.settingsShell}>
          <aside className={styles.sideNav} aria-label="Settings sections">
            <div className={styles.navGroup}>
              <span className={styles.navGroupTitle}>ACCESS</span>
              {sections.map(section => (
                <button
                  key={section.key}
                  type="button"
                  className={
                    section.key === activeSection.key
                      ? `${styles.navItem} ${styles.navItemActive}`
                      : styles.navItem
                  }
                  aria-current={section.key === activeSection.key ? 'page' : undefined}
                  onClick={() => setRequestedSection(section.key)}
                >
                  <AccessIcon section={section.key} />
                  <span>{section.title}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className={styles.contentColumn} aria-label={activeSection.title}>
            <header className={styles.summaryCard}>
              <span className={styles.summaryIcon}>
                <AccessIcon section={activeSection.key} />
              </span>
              <div className={styles.summaryCopy}>
                <h2>{activeSection.title}</h2>
                <p>{activeSection.description}</p>
              </div>
            </header>

            <div className={styles.managerArea}>
              {activeSection.key === 'modulePermissions' ? (
                <BusinessPerformanceModulePermissionsPage
                  embedded
                  pageContext={pageContext}
                  spHttpClient={spHttpClient}
                  webAbsoluteUrl={webAbsoluteUrl}
                />
              ) : (
                <BusinessPerformanceUnitAccessManager
                  pageContext={pageContext}
                  spHttpClient={spHttpClient}
                  webAbsoluteUrl={webAbsoluteUrl}
                  selectedCompanyId={selectedCompanyId}
                  unitService={unitService}
                  unitAccessService={unitAccessService}
                />
              )}
            </div>
          </section>
        </div>
      ) : (
        <p className={styles.noAccess} role="alert">
          You do not have permission to manage module permissions or unit access.
        </p>
      )}
    </PageContainer>
  );
};
