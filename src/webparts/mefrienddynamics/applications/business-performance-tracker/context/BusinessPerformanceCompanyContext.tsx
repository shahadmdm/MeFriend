import * as React from 'react';

import type {
  BcCompany
} from '../../bc-extension/config/bcCompanies';

export const businessPerformanceCompanyStorageKey =
  'mefriend.businessPerformanceTracker.selectedCompanyId';

export interface IBusinessPerformanceCompanyStorage {
  getItem(key: string): string | undefined;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface IBusinessPerformanceCompanyContextValue {
  selectedCompany: BcCompany | undefined;
  selectedCompanyId: string | undefined;
  selectedCompanyName: string | undefined;
  selectCompany: (company: BcCompany) => void;
  clearCompany: () => void;
}

const getSessionStorage = ():
  IBusinessPerformanceCompanyStorage | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    const storage = window.sessionStorage;

    return {
      getItem: key => storage.getItem(key) ?? undefined,
      setItem: (key, value) => storage.setItem(key, value),
      removeItem: key => storage.removeItem(key)
    };
  } catch {
    return undefined;
  }
};

export const restoreBusinessPerformanceCompany = (
  authorizedCompanies: readonly BcCompany[],
  storage: IBusinessPerformanceCompanyStorage | undefined =
    getSessionStorage()
): BcCompany | undefined => {
  if (storage) {
    try {
      const storedCompanyId = storage.getItem(
        businessPerformanceCompanyStorageKey
      );

      if (storedCompanyId) {
        const company = authorizedCompanies.find(
          item => item.id === storedCompanyId
        );

        if (company) {
          return company;
        }

        storage.removeItem(
          businessPerformanceCompanyStorageKey
        );
      }
    } catch {
      // Continue without stored company selection.
    }
  }

  // Automatically select only when exactly one
  // authorized company is available.
  return authorizedCompanies.length === 1
    ? authorizedCompanies[0]
    : undefined;
};

export const persistBusinessPerformanceCompany = (
  company: BcCompany | undefined,
  storage: IBusinessPerformanceCompanyStorage | undefined =
    getSessionStorage()
): void => {
  if (!storage) {
    return;
  }

  try {
    if (company) {
      storage.setItem(
        businessPerformanceCompanyStorageKey,
        company.id
      );
    } else {
      storage.removeItem(
        businessPerformanceCompanyStorageKey
      );
    }
  } catch {
    // In-memory company selection remains available.
  }
};

const BusinessPerformanceCompanyContext =
  React.createContext<
    IBusinessPerformanceCompanyContextValue | undefined
  >(undefined);

export interface IBusinessPerformanceCompanyProviderProps {
  authorizedCompanies: readonly BcCompany[];
  children: React.ReactNode;
}

export const BusinessPerformanceCompanyProvider:
  React.FC<IBusinessPerformanceCompanyProviderProps> = ({
    authorizedCompanies,
    children
  }) => {
    const [selectedCompanyId, setSelectedCompanyId] =
      React.useState<string | undefined>(
        () =>
          restoreBusinessPerformanceCompany(
            authorizedCompanies
          )?.id
      );

    // Always resolve the selection against authorized
    // companies, including when permissions change.
    const selectedCompany = authorizedCompanies.find(
      company => company.id === selectedCompanyId
    );

    React.useEffect(() => {
      if (
        selectedCompanyId &&
        !selectedCompany
      ) {
        persistBusinessPerformanceCompany(undefined);
        setSelectedCompanyId(undefined);
      }
    }, [selectedCompanyId, selectedCompany]);

    const selectCompany = React.useCallback(
      (company: BcCompany): void => {
        const authorizedCompany = authorizedCompanies.find(
          item => item.id === company.id
        );

        if (!authorizedCompany) {
          console.warn(
            'Rejected unauthorized Business Performance ' +
              'Tracker company selection.'
          );
          return;
        }

        persistBusinessPerformanceCompany(
          authorizedCompany
        );

        setSelectedCompanyId(authorizedCompany.id);
      },
      [authorizedCompanies]
    );

    const clearCompany = React.useCallback(
      (): void => {
        persistBusinessPerformanceCompany(undefined);
        setSelectedCompanyId(undefined);
      },
      []
    );

    const value =
      React.useMemo<
        IBusinessPerformanceCompanyContextValue
      >(
        () => ({
          selectedCompany,
          selectedCompanyId: selectedCompany?.id,
          selectedCompanyName: selectedCompany?.name,
          selectCompany,
          clearCompany
        }),
        [
          selectedCompany,
          selectCompany,
          clearCompany
        ]
      );

    return (
      <BusinessPerformanceCompanyContext.Provider
        value={value}
      >
        {children}
      </BusinessPerformanceCompanyContext.Provider>
    );
  };

export const useBusinessPerformanceCompany =
  (): IBusinessPerformanceCompanyContextValue => {
    const context = React.useContext(
      BusinessPerformanceCompanyContext
    );

    if (!context) {
      throw new Error(
        'useBusinessPerformanceCompany must be used ' +
          'inside BusinessPerformanceCompanyProvider.'
      );
    }

    return context;
  };