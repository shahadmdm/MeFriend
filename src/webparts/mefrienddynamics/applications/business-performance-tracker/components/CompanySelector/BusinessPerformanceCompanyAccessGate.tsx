import * as React from 'react';

import {
  AppLoader
} from '../../../../shared/components/loaders/AppLoader';

import {
  AccessDenied
} from '../../../../shared/components/errorState/AccessDenied';

import {
  getUserFriendlyError
} from '../../../../shared/api/apiErrorHandler';

import type {
  BcCompany
} from '../../../bc-extension/config/bcCompanies';

import type {
  BusinessPerformanceCompanyAccessService,
  IBusinessPerformanceUserAssignments
} from '../../services/access/businessPerformanceCompanyAccessService';

import {
  BusinessPerformanceCompanyGate
} from './BusinessPerformanceCompanyGate';

export interface IBusinessPerformanceCompanyAccessGateProps {
  companyAccessService: BusinessPerformanceCompanyAccessService;
  expectedSignedInEmail: string;
  onBack?: () => void;

  children: (
    selectedCompany: BcCompany,
    onChangeCompany: () => void,
    assignments: IBusinessPerformanceUserAssignments
  ) => React.ReactNode;
}

interface ICompanyAccessState {
  loading: boolean;
  assignments?: IBusinessPerformanceUserAssignments;
  error?: string;
}

export const BusinessPerformanceCompanyAccessGate:
  React.FC<IBusinessPerformanceCompanyAccessGateProps> = ({
    companyAccessService,
    expectedSignedInEmail,
    onBack,
    children
  }) => {
    const [state, setState] =
      React.useState<ICompanyAccessState>({
        loading: true
      });

    React.useEffect(() => {
      let cancelled = false;

      setState({
        loading: true
      });

      companyAccessService
        .getCurrentUserAssignments()
        .then(assignments => {
          if (cancelled) {
            return;
          }

          const expectedEmail =
            expectedSignedInEmail.trim().toLowerCase();

          if (
            !expectedEmail ||
            assignments.signedInEmail !== expectedEmail
          ) {
            setState({
              loading: false,
              error:
                'The signed-in user could not be verified ' +
                'against the company assignments.'
            });

            return;
          }

          setState({
            loading: false,
            assignments
          });
        })
        .catch(error => {
          if (cancelled) {
            return;
          }

          setState({
            loading: false,
            error: getUserFriendlyError(error)
          });
        });

      return () => {
        cancelled = true;
      };
    }, [
      companyAccessService,
      expectedSignedInEmail
    ]);

    if (state.loading) {
      return (
        <AppLoader
          label="Loading authorized companies"
        />
      );
    }

    if (state.error) {
      return (
        <AccessDenied
          title="Company Access Verification Failed"
          message={state.error}
        />
      );
    }

    const assignments = state.assignments;

    if (!assignments) {
      return (
        <AccessDenied
          title="Company Access Unavailable"
          message="Unable to retrieve company assignments."
        />
      );
    }

    const authorizedCompanies =
      assignments.companyAccess.companies;

    if (!authorizedCompanies.length) {
      const mappingError =
        assignments.companyAccess
          .unmappedSharePointCompanies.length > 0 ||
        assignments.companyAccess
          .unavailableBcCompanyNames.length > 0;

      return (
        <AccessDenied
          title="Company Access Unavailable"
          message={
            mappingError
              ? 'Your assigned companies could not be ' +
                'matched with Business Central companies. ' +
                'Please contact the administrator.'
              : 'No company access has been assigned ' +
                'to your account. Please contact ' +
                'the administrator.'
          }
        />
      );
    }

    return (
      <BusinessPerformanceCompanyGate
        authorizedCompanies={authorizedCompanies}
        onBack={onBack}
      >
        {(selectedCompany, onChangeCompany) =>
          children(
            selectedCompany,
            onChangeCompany,
            assignments
          )
        }
      </BusinessPerformanceCompanyGate>
    );
  };