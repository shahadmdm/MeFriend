import * as React from 'react';
import type { IPortalApplicationProps } from '../../../../../shared/models/IPortalApplicationProps';
import { ApiClient } from '../../../../../shared/api/apiClient';
import { AuthClient } from '../../../../../shared/api/authClient';
import { appConfig as bcExtensionAppConfig } from '../../../../bc-extension/config/appConfig';
import {
  getBcCompanyRequestHeaders,
  type BcCompany
} from '../../../../bc-extension/config/bcCompanies';
import { InvoiceService } from '../../../services/invoices/invoiceService';
import { SalespersonService } from '../../../../bc-extension/services/salespersons/salespersonService';
import { BptInvoicesPage } from './BptInvoicesPage';
import { BptInvoiceDetailPage } from './BptInvoiceDetailPage';

interface IBptInvoicesRouteProps extends Pick<IPortalApplicationProps, 'aadHttpClientFactory' | 'httpClient'> {
  selectedCompany: BcCompany;
  isDetail: boolean;
  invoiceNumber?: string;
  onNavigate: (path: string) => void;
}

/**
 * Bridge to the BPT-specific invoice list and detail pages using the BPT InvoiceService.
 * All other invoice configuration, models and shared UI come from BC Extension.
 *
 * BPT currently has no `IAppUser` instance from BC Extension's access gate.
 * We therefore deliberately do not fabricate a currentUser; caller must
 * keep the BPT route admin-only until API authorization is verified.
 */
export const BptInvoicesRoute: React.FC<IBptInvoicesRouteProps> = ({
  aadHttpClientFactory,
  httpClient,
  selectedCompany,
  isDetail,
  invoiceNumber,
  onNavigate
}) => {
  // This matches the setup in BC Extension's App.tsx, including the
  // company-specific header provider that the prior BPT version omitted.
  const apiClient = React.useMemo(() => {
    const authClient = new AuthClient({
      aadHttpClientFactory,
      httpClient,
      settings: {
        baseUrl: bcExtensionAppConfig.backendApi.baseUrl || bcExtensionAppConfig.backendApiBaseUrl,
        anonymous: bcExtensionAppConfig.backendApi.anonymous,
        useAadHttpClient: bcExtensionAppConfig.backendApi.useAadHttpClient,
        aadResourceUrl: bcExtensionAppConfig.backendApi.aadResourceUrl
      }
    });
    return new ApiClient(authClient, {
      headerProvider: () => getBcCompanyRequestHeaders(selectedCompany)
    });
  }, [aadHttpClientFactory, httpClient, selectedCompany]);

  const invoiceService = React.useMemo(
    () => new InvoiceService(apiClient),
    [apiClient]
  );
  const salespersonService = React.useMemo(
    () => new SalespersonService(apiClient),
    [apiClient]
  );

  // BC Extension's invoiceReference helper may generate a detail URL
  // relative to the BC app; normalize it into BPT's own detail route.
  const handleInvoiceNavigate = React.useCallback((path: string): void => {
    const normalized = path.replace(/^\/+|\/+$/g, '');
    if (normalized === 'invoices') {
      onNavigate('invoices');
      return;
    }
    const match = normalized.match(/(?:^|\/)invoices\/(?:detail\/)?(.+)$/i);
    if (match && match[1]) {
      onNavigate(`invoices/detail/${match[1]}`);
      return;
    }
    onNavigate(path);
  }, [onNavigate]);

  if (isDetail) {
    return (
      <BptInvoiceDetailPage
        invoiceNumber={invoiceNumber || ''}
        invoiceService={invoiceService}
        onNavigate={handleInvoiceNavigate}
      />
    );
  }

  return (
    <BptInvoicesPage
      key={selectedCompany.id}
      invoiceService={invoiceService}
      salespersonService={salespersonService}
      selectedCompany={selectedCompany}
      onNavigate={handleInvoiceNavigate}
    />
  );
};
