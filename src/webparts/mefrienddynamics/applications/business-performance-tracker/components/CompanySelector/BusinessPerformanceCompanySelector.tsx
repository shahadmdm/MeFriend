import * as React from 'react';
import { Icon } from '@fluentui/react';

import { Button } from '../../../../shared/components/buttons';
import { Dropdown } from '../../../../shared/components/dropdowns';

import type {
  ILookupOption
} from '../../../../shared/models/ILookupOption';

import {
  buildPortalHref
} from '../../../../shared/routing/hashPaths';

import {
  getBcCompanyLabel,
  type BcCompany
} from '../../../bc-extension/config/bcCompanies';

import { appConfig } from '../../config/appConfig';

import styles from '../../../bc-extension/components/CompanySelector/BcCompanySelector.module.scss';

export interface IBusinessPerformanceCompanySelectorProps {
  companies: readonly BcCompany[];
  onBack?: () => void;
  onEnter: (company: BcCompany) => void;
}

export const BusinessPerformanceCompanySelector:
  React.FC<IBusinessPerformanceCompanySelectorProps> = ({
    companies,
    onBack,
    onEnter
  }) => {
    const [companyId, setCompanyId] =
      React.useState<string | undefined>();

    const selectedCompany = companies.find(
      company => company.id === companyId
    );

    const companyOptions =
      React.useMemo<readonly ILookupOption<string>[]>(
        () =>
          companies.map(company => ({
            key: company.id,
            value: company.id,
            text: getBcCompanyLabel(company),
            detailText:
              company.displayName.trim() &&
              company.displayName.trim() !== company.name
                ? company.name
                : undefined
          })),
        [companies]
      );

    const handleBack = (
      event: React.MouseEvent<HTMLAnchorElement>
    ): void => {
      if (
        onBack &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey
      ) {
        event.preventDefault();
        onBack();
      }
    };

    return (
      <main className={styles.selector}>
        <section
          className={styles.card}
          aria-labelledby="business-performance-company-title"
        >
          <span className={styles.icon} aria-hidden="true">
            <Icon iconName="CityNext" />
          </span>

          <div className={styles.heading}>
            <span>{appConfig.appName.toUpperCase()}</span>

            <h1 id="business-performance-company-title">
              Select Company
            </h1>

            <p>
              Choose the company you want to work with
              in Business Performance Tracker.
            </p>
          </div>

          <Dropdown
            label="Company"
            options={companyOptions}
            placeholder="Select a company"
            searchable
            showOptionDetails
            showSelectedDetail
            value={companyId}
            onChange={value =>
              setCompanyId(
                typeof value === 'string'
                  ? value
                  : undefined
              )
            }
          />

          <Button
            disabled={!selectedCompany}
            label="Enter Company"
            size="large"
            onClick={() => {
              if (selectedCompany) {
                onEnter(selectedCompany);
              }
            }}
          />

          <a
            className={styles.backLink}
            href={buildPortalHref('apps')}
            onClick={handleBack}
          >
            <Icon iconName="Back" aria-hidden="true" />
            <span>Back to All Applications</span>
          </a>
        </section>
      </main>
    );
  };