import * as React from 'react';

import { AccessDenied } from
  '../../../../shared/components/errorState/AccessDenied';

import type {
  BcCompany
} from '../../../bc-extension/config/bcCompanies';

import {
  BusinessPerformanceCompanyProvider,
  useBusinessPerformanceCompany
} from '../../context/BusinessPerformanceCompanyContext';

import {
  BusinessPerformanceCompanySelector
} from './BusinessPerformanceCompanySelector';

export interface IBusinessPerformanceCompanyGateProps {
  authorizedCompanies: readonly BcCompany[];
  onBack?: () => void;
  children: (
    selectedCompany: BcCompany,
    onChangeCompany: () => void
  ) => React.ReactNode;
}

const BusinessPerformanceCompanyGateContent:
  React.FC<IBusinessPerformanceCompanyGateProps> = ({
    authorizedCompanies,
    onBack,
    children
  }) => {
    const {
      selectedCompany,
      selectCompany,
      clearCompany
    } = useBusinessPerformanceCompany();

    if (!selectedCompany) {
      return (
        <BusinessPerformanceCompanySelector
          companies={authorizedCompanies}
          onBack={onBack}
          onEnter={selectCompany}
        />
      );
    }

    return (
      <React.Fragment key={selectedCompany.id}>
        {children(selectedCompany, clearCompany)}
      </React.Fragment>
    );
  };

export const BusinessPerformanceCompanyGate:
  React.FC<IBusinessPerformanceCompanyGateProps> = props => {
    if (!props.authorizedCompanies.length) {
      return (
        <AccessDenied
          title="Company access unavailable"
          message={
            'No company access has been assigned to ' +
            'your account. Please contact the administrator.'
          }
        />
      );
    }

    return (
      <BusinessPerformanceCompanyProvider
        authorizedCompanies={props.authorizedCompanies}
      >
        <BusinessPerformanceCompanyGateContent
          {...props}
        />
      </BusinessPerformanceCompanyProvider>
    );
  };