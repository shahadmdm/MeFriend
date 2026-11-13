import * as React from 'react';

// BPT's invoice listing uses the original BC Extension EntityDashboard layout.
// Only the InvoiceService class is owned by BPT; all invoice UI helpers/models remain shared.

import { invoicesModuleConfig } from '../../../../bc-extension/config/modules/invoicesModuleConfig';

import type { ISortState, SortDirection } from '../../../../../shared/models/ISortState';

import { useCursorPagination } from '../../../../../shared/hooks/useCursorPagination';

import type { IInvoiceDetail, IInvoiceFilters, IInvoiceListItem, PaymentStatus } from '../../../../bc-extension/models/invoices';

import type { IAppUser } from '../../../../bc-extension/models/settings/IAppAccessModels';

import type { BcCompany } from '../../../../bc-extension/config/bcCompanies';

import { getUserFriendlyError, normalizeError } from '../../../../../shared/api/apiErrorHandler';

import type { InvoiceService } from '../../../services/invoices/invoiceService';

import type { SalespersonService } from '../../../../bc-extension/services/salespersons/salespersonService';

import { useSalespersonFilter } from '../../../../bc-extension/hooks/useSalespersonFilter';

import { buildInvoiceDetailPath, requireInvoiceNumber } from '../../../../bc-extension/utils/invoiceReference';

import { EntityDashboard } from '../../../../../shared/components/dashboard/EntityDashboard';

import type { EntityFilterValues, FilterValue } from '../../../../../shared/components/filters/EntityFilters';

import { useToast } from '../../../../../shared/components/toast/useToast';

import {

  downloadInvoicePdf,

  openInvoicePrintPreviewWindow,

  printInvoice,

  writeInvoicePrintError,

  writeInvoicePrintPreview

} from '../../../../bc-extension/components/modules/invoices/invoicePrintTemplate';

export interface IBptInvoicesPageProps {

  currentUser?: IAppUser;

  invoiceService: InvoiceService;

  salespersonService: SalespersonService;

  onNavigate: (path: string) => void;

  selectedCompany: BcCompany;

}

interface IInvoiceDocumentAction {

  type: 'download' | 'print';

}

// Convert EntityDashboard's form values into the exact shape expected by
// BPT's InvoiceService. Empty or whitespace-only values should not be sent.
const optionalText = (value: FilterValue | undefined): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed && trimmed.toLowerCase() !== 'all' ? trimmed : undefined;
};

const toInvoiceFilters = (values: EntityFilterValues): IInvoiceFilters => ({
  searchText: optionalText(values.searchText),
  customerCode: optionalText(values.customerCode),
  salespersonCode: optionalText(values.salespersonCode),
  salesOrderNumber: optionalText(values.salesOrderNumber),
  invoiceStatus: optionalText(values.invoiceStatus),
  paymentStatus: optionalText(values.paymentStatus) as PaymentStatus | undefined,
  invoiceDateFrom: optionalText(values.invoiceDateFrom),
  invoiceDateTo: optionalText(values.invoiceDateTo),
  dueDateFrom: optionalText(values.dueDateFrom),
  dueDateTo: optionalText(values.dueDateTo),
  outstandingOnly: values.outstandingOnly === true || values.outstandingOnly === 'true'
});

const getListErrorMessage = (error: unknown): string => {

  const normalizedError = normalizeError(error);

  if (normalizedError.status === 404 || normalizedError.status === 405 || normalizedError.status === 501) {

    return 'Invoice listing API is not configured yet.';

  }

  return getUserFriendlyError(normalizedError);

};

const normalizeInvoiceDescriptions = (invoice: IInvoiceDetail): IInvoiceDetail => ({

  ...invoice,

  lines: invoice.lines.map(line => ({

    ...line,

    description: line.description || line.itemCode || ''

  }))

});

export const BptInvoicesPage: React.FC<IBptInvoicesPageProps> = ({ currentUser, invoiceService, salespersonService, onNavigate, selectedCompany }) => {

  const toast = useToast();

  const { filters, restrictedSalespersonCode } = useSalespersonFilter(

    invoicesModuleConfig.filters || [],

    salespersonService,

    currentUser

  );

  const initialFilterValues = restrictedSalespersonCode ? { salespersonCode: restrictedSalespersonCode } : {};

  const [items, setItems] = React.useState<readonly IInvoiceListItem[]>([]);

  const [filterValues, setFilterValues] = React.useState<EntityFilterValues>(initialFilterValues);

  const [appliedFilterValues, setAppliedFilterValues] = React.useState<EntityFilterValues>(initialFilterValues);

  const { pagination, applyResult, changePage, reset } = useCursorPagination();

  const [sorting, setSorting] = React.useState<ISortState | undefined>();

  const [loading, setLoading] = React.useState<boolean>(false);

  const [error, setError] = React.useState<string | undefined>();

  const [documentAction, setDocumentAction] = React.useState<IInvoiceDocumentAction | undefined>();

  const documentActionsInProgress = React.useRef<Set<string>>(new Set());

  // Applying the same filters again must still trigger a new request.
  const [filterRequestVersion, setFilterRequestVersion] = React.useState(0);

  // Out-of-order API responses must not replace the latest filtered result.
  const activeRequestId = React.useRef(0);

  const loadInvoices = React.useCallback(async (): Promise<void> => {
    const requestId = ++activeRequestId.current;
    setLoading(true);
    setError(undefined);

    try {
      const requestedFilters = toInvoiceFilters(appliedFilterValues);
      const result = await invoiceService.getInvoices(
        requestedFilters,
        pagination,
        sorting,
        currentUser
      );
      if (activeRequestId.current !== requestId) {
        return;
      }
      setItems(result.items);
      applyResult(result);
    } catch (loadError) {
      if (activeRequestId.current !== requestId) {
        return;
      }
      setItems([]);
      setError(getListErrorMessage(loadError));
    } finally {
      if (activeRequestId.current === requestId) {
        setLoading(false);
      }
    }
  }, [
    appliedFilterValues,
    applyResult,
    currentUser,
    invoiceService,
    pagination.currentToken,
    pagination.pageNumber,
    pagination.pageSize,
    sorting,
    filterRequestVersion
  ]);

  React.useEffect(() => {
    void loadInvoices();
    return () => {
      activeRequestId.current += 1;
    };
  }, [loadInvoices]);

  React.useEffect(() => {

    if (!restrictedSalespersonCode) {

      return;

    }

    setFilterValues(current => ({ ...current, salespersonCode: restrictedSalespersonCode }));

    setAppliedFilterValues(current => ({ ...current, salespersonCode: restrictedSalespersonCode }));

  }, [restrictedSalespersonCode]);

  const handleFilterChange = React.useCallback((key: string, value: FilterValue): void => {

    if (key === 'salespersonCode' && currentUser?.isSalesperson === true) {

      return;

    }

    setFilterValues(current => ({

      ...current,

      [key]: value

    }));

  }, [currentUser?.isSalesperson]);

  const handleFilterApply = React.useCallback((): void => {
    // Snapshot the draft values rather than reusing the same object reference.
    // Keep any mandatory salesperson restriction in place.
    const nextValues: EntityFilterValues = restrictedSalespersonCode
      ? { ...filterValues, salespersonCode: restrictedSalespersonCode }
      : { ...filterValues };

    reset(); // Always go back to page one for a new filter selection.
    setAppliedFilterValues(nextValues);
    setFilterRequestVersion(version => version + 1);
  }, [filterValues, reset, restrictedSalespersonCode]);

  const handleFilterClear = React.useCallback((): void => {
    const clearedValues: EntityFilterValues = restrictedSalespersonCode
      ? { salespersonCode: restrictedSalespersonCode }
      : {};

    setFilterValues({ ...clearedValues });
    reset();
    setAppliedFilterValues({ ...clearedValues });
    setFilterRequestVersion(version => version + 1);
  }, [reset, restrictedSalespersonCode]);

  const handleSort = React.useCallback((fieldName: string, direction?: SortDirection): void => {

    setSorting(direction ? {

      fieldName,

      direction

    } : undefined);

    reset();

  }, [reset]);

  const handlePrint = React.useCallback(async (item: IInvoiceListItem): Promise<void> => {

    let invoiceNumber: string;

    let preview: Window | undefined;

    if (documentActionsInProgress.current.size) {

      return;

    }

    try {

      invoiceNumber = requireInvoiceNumber(item.invoiceNumber);

    } catch (referenceError) {

      toast.error(getUserFriendlyError(normalizeError(referenceError)), { title: 'Unable to print invoice' });

      return;

    }

    documentActionsInProgress.current.add(invoiceNumber);

    setDocumentAction({ type: 'print' });

    try {

      preview = openInvoicePrintPreviewWindow();

      const printableInvoice = normalizeInvoiceDescriptions(

        await invoiceService.getInvoiceByNumber(invoiceNumber, currentUser)

      );

      await writeInvoicePrintPreview(preview, printableInvoice);

      await printInvoice(printableInvoice, preview);

    } catch (printError) {

      const message = getUserFriendlyError(normalizeError(printError));

      toast.error(message, { title: 'Unable to print invoice' });

      if (preview) {

        writeInvoicePrintError(preview, message);

      }

    } finally {

      documentActionsInProgress.current.delete(invoiceNumber);

      setDocumentAction(undefined);

    }

  }, [currentUser, invoiceService, toast]);

  const handleDownload = React.useCallback(async (item: IInvoiceListItem): Promise<void> => {

    let invoiceNumber: string;

    if (documentActionsInProgress.current.size) {

      return;

    }

    try {

      invoiceNumber = requireInvoiceNumber(item.invoiceNumber);

    } catch (referenceError) {

      toast.error(getUserFriendlyError(normalizeError(referenceError)), { title: 'Unable to download invoice' });

      return;

    }

    documentActionsInProgress.current.add(invoiceNumber);

    setDocumentAction({ type: 'download' });

    try {

      const invoice = await invoiceService.getInvoiceByNumber(invoiceNumber, currentUser);

      const downloadableInvoice = normalizeInvoiceDescriptions(invoice);

      await downloadInvoicePdf(downloadableInvoice);

      toast.success('Invoice PDF download started.', { title: invoice.invoiceNumber || 'Invoice' });

    } catch (downloadError) {

      toast.error(getUserFriendlyError(normalizeError(downloadError)), { title: 'Unable to download invoice' });

    } finally {

      documentActionsInProgress.current.delete(invoiceNumber);

      setDocumentAction(undefined);

    }

  }, [currentUser, invoiceService, toast]);

  const handleRowClick = React.useCallback((item: IInvoiceListItem): void => {

    try {

      onNavigate(buildInvoiceDetailPath(item.invoiceNumber));

    } catch (referenceError) {

      toast.error(getUserFriendlyError(normalizeError(referenceError)), { title: 'Unable to open invoice' });

    }

  }, [onNavigate, toast]);

  const outstandingOnlyActive = appliedFilterValues.outstandingOnly === true || appliedFilterValues.outstandingOnly === 'true';

  const appliedInvoiceFilters = toInvoiceFilters(appliedFilterValues);
  const appliedFilterCount = [
    appliedInvoiceFilters.searchText,
    appliedInvoiceFilters.customerCode,
    appliedInvoiceFilters.salespersonCode,
    appliedInvoiceFilters.salesOrderNumber,
    appliedInvoiceFilters.invoiceStatus,
    appliedInvoiceFilters.paymentStatus,
    appliedInvoiceFilters.invoiceDateFrom,
    appliedInvoiceFilters.invoiceDateTo,
    appliedInvoiceFilters.dueDateFrom,
    appliedInvoiceFilters.dueDateTo
  ].filter(Boolean).length + (appliedInvoiceFilters.outstandingOnly ? 1 : 0);

  return (

    <EntityDashboard<IInvoiceListItem>

      title={invoicesModuleConfig.title}

      subtitle={`${invoicesModuleConfig.description}${appliedFilterCount > 0 ? ` · ${appliedFilterCount} filter(s) active` : ''}`}

      columns={invoicesModuleConfig.tableColumns || []}

      filters={filters}

      filterValues={filterValues}

      items={items}

      loading={loading}

      error={error}

      onRowClick={

        invoicesModuleConfig.detailEnabled

          ? handleRowClick

          : undefined

      }

      rowActions={selectedCompany.name === 'Ideal Publications Trust'

        ? []

        : [

            {

              key: 'print',

              label: documentAction?.type === 'print' ? 'Preparing print...' : 'Print',

              icon: 'print',

              disabled: () => Boolean(documentAction),

              onClick: item => {

                handlePrint(item).catch(() => undefined);

              }

            },

            {

              key: 'download',

              label: documentAction?.type === 'download' ? 'Downloading...' : 'Download',

              icon: 'download',

              disabled: () => Boolean(documentAction),

              onClick: item => {

                handleDownload(item).catch(() => undefined);

              }

            }

          ]}

      onFilterChange={handleFilterChange}

      onFilterApply={handleFilterApply}

      onFilterClear={handleFilterClear}

      cursorPagination={pagination}

      onPageChange={changePage}

      sorting={sorting}

      onSort={handleSort}

      getRowKey={(item, index) => item.id || item.invoiceNumber || String(index)}

      emptyTitle={outstandingOnlyActive ? 'No outstanding invoices found.' : 'No invoices found'}

      emptyMessage={

        outstandingOnlyActive

          ? 'No outstanding invoices found.'

          : 'No invoice records are available from the configured service.'

      }

    />

  );

};
