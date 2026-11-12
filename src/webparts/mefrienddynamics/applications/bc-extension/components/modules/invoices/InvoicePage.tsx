import * as React from 'react';
import { invoicesModuleConfig } from '../../../config/modules/invoicesModuleConfig';
import type { ISortState, SortDirection } from '../../../../../shared/models/ISortState';
import { useCursorPagination } from '../../../../../shared/hooks/useCursorPagination';
import type { IInvoiceDetail, IInvoiceListItem } from '../../../models/invoices';
import type { IAppUser } from '../../../models/settings/IAppAccessModels';
import { isMefriendBusinessSolutionsCompany, type BcCompany } from '../../../config/bcCompanies';
import { getUserFriendlyError, normalizeError } from '../../../../../shared/api/apiErrorHandler';
import type { InvoiceService } from '../../../services/invoices/invoiceService';
import type { IItemMasterLookupItem, ItemMasterService } from '../../../services/itemMasters';
import type { CustomerService } from '../../../services/customers/customerService';
import type { SalespersonService } from '../../../services/salespersons/salespersonService';
import type { SalesOrderRequestService } from '../../../services/sharepoint/salesOrderRequestService';
import { useSalespersonFilter } from '../../../hooks/useSalespersonFilter';
import { buildInvoiceDetailPath, requireInvoiceNumber } from '../../../utils/invoiceReference';
import { EntityDashboard } from '../../../../../shared/components/dashboard/EntityDashboard';
import type { EntityFilterValues, FilterValue } from '../../../../../shared/components/filters/EntityFilters';
import { AmountDisplay } from '../../../../../shared/components/amountDisplay/AmountDisplay';
import { useToast } from '../../../../../shared/components/toast/useToast';
import {
  downloadInvoicePdf,
  openInvoicePrintPreviewWindow,
  printInvoice,
  writeInvoicePrintError,
  writeInvoicePrintPreview
} from './invoicePrintTemplate';
import { enrichInvoiceLinesForPrint } from './invoicePrintUtils';
import { hasUserInvoiceFilters, toInvoiceFilters } from './invoiceFilterUtils';

export interface IInvoicePageProps {
  currentUser?: IAppUser;
  customerService: CustomerService;
  itemMasterService: ItemMasterService;
  invoiceService: InvoiceService;
  salesOrderRequestService: SalesOrderRequestService;
  selectedCompany?: BcCompany;
  salespersonService: SalespersonService;
  onNavigate: (path: string) => void;
}

interface IInvoiceDocumentAction {
  type: 'download' | 'print';
}

interface IOutstandingTotalState {
  amount?: number;
  error?: string;
  loading: boolean;
}

const getListErrorMessage = (error: unknown): string => {
  const normalizedError = normalizeError(error);

  if (normalizedError.status === 404 || normalizedError.status === 405 || normalizedError.status === 501) {
    return 'Invoice listing API is not configured yet.';
  }

  return getUserFriendlyError(normalizedError);
};

export const InvoicePage: React.FC<IInvoicePageProps> = ({
  currentUser,
  customerService,
  itemMasterService,
  invoiceService,
  salesOrderRequestService,
  selectedCompany,
  salespersonService,
  onNavigate
}) => {
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
  const [outstandingTotal, setOutstandingTotal] = React.useState<IOutstandingTotalState>({ loading: false });
  const invoiceRequestIdRef = React.useRef<number>(0);
  const outstandingTotalRequestIdRef = React.useRef<number>(0);
  const documentActionsInProgress = React.useRef<Set<string>>(new Set());
  const itemMasterLookupPromiseRef = React.useRef<Promise<readonly IItemMasterLookupItem[]> | undefined>();

  const getItemMasterLookup = React.useCallback((): Promise<readonly IItemMasterLookupItem[]> => {
    if (!itemMasterLookupPromiseRef.current) {
      itemMasterLookupPromiseRef.current = itemMasterService.getItemMasterLookup().then(result => result.items);
    }

    return itemMasterLookupPromiseRef.current;
  }, [itemMasterService]);

  const loadInvoices = React.useCallback(async (): Promise<void> => {
    const requestId = ++invoiceRequestIdRef.current;
    setLoading(true);
    setError(undefined);

    try {
      const filters = toInvoiceFilters(appliedFilterValues);
      const result = await invoiceService.getInvoices(filters, pagination, sorting, currentUser);
      const salespersonNames = await Promise.all(result.items.map(item =>
        salespersonService.getSalespersonName(item.salesperson).catch(() => undefined)
      ));

      if (requestId !== invoiceRequestIdRef.current) {
        return;
      }

      setItems(result.items.map((item, index) => ({
        ...item,
        salespersonName: salespersonNames[index]
      })));
      applyResult(result);
    } catch (loadError) {
      if (requestId !== invoiceRequestIdRef.current) {
        return;
      }

      setItems([]);
      setError(getListErrorMessage(loadError));
    } finally {
      if (requestId === invoiceRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [appliedFilterValues, applyResult, currentUser, invoiceService, pagination.currentToken, pagination.pageNumber, pagination.pageSize, salespersonService, sorting]);

  React.useEffect(() => {
    loadInvoices().catch(() => undefined);

    return () => {
      invoiceRequestIdRef.current += 1;
    };
  }, [loadInvoices]);

  React.useEffect(() => {
    if (!restrictedSalespersonCode) {
      return;
    }

    setFilterValues(current => ({ ...current, salespersonCode: restrictedSalespersonCode }));
    setAppliedFilterValues(current => ({ ...current, salespersonCode: restrictedSalespersonCode }));
  }, [restrictedSalespersonCode]);

  const appliedInvoiceFilters = React.useMemo(
    () => toInvoiceFilters(appliedFilterValues),
    [appliedFilterValues]
  );
  const shouldShowOutstandingTotal = Boolean(
    appliedInvoiceFilters.salespersonCode?.trim() && appliedInvoiceFilters.outstandingOnly === true
  );

  React.useEffect(() => {
    const requestId = ++outstandingTotalRequestIdRef.current;

    if (!shouldShowOutstandingTotal) {
      setOutstandingTotal({ loading: false });
      return;
    }

    setOutstandingTotal({ loading: true });
    invoiceService.getOutstandingAmountTotal(appliedInvoiceFilters, currentUser)
      .then(amount => {
        if (requestId === outstandingTotalRequestIdRef.current) {
          setOutstandingTotal({ amount, loading: false });
        }
      })
      .catch(totalError => {
        if (requestId === outstandingTotalRequestIdRef.current) {
          setOutstandingTotal({
            error: getUserFriendlyError(normalizeError(totalError)),
            loading: false
          });
        }
      });

    return () => {
      if (requestId === outstandingTotalRequestIdRef.current) {
        outstandingTotalRequestIdRef.current += 1;
      }
    };
  }, [appliedInvoiceFilters, currentUser, invoiceService, shouldShowOutstandingTotal]);

  const loadPrintableInvoice = React.useCallback(async (invoiceNumber: string): Promise<IInvoiceDetail> => {
    const invoice = await invoiceService.getInvoiceByNumber(invoiceNumber, currentUser);
    const orderNumber = (invoice.orderNumber || '').trim();
    const billToCustomerNumber = (invoice.billToCustomerNumber || '').trim();
    // The invoice contract identifies the Ship To customer with its Sell-to customer number.
    const shipToCustomerNumber = (invoice.sellToCustomerNumber || '').trim();
    const billToGstinPromise = customerService.getCustomerGstRegistrationNumber(billToCustomerNumber);
    const shipToGstinPromise = billToCustomerNumber.toUpperCase() === shipToCustomerNumber.toUpperCase()
      ? billToGstinPromise
      : customerService.getCustomerGstRegistrationNumber(shipToCustomerNumber);
    const [itemMasters, salespersonName, requestLines, billToGstin, shipToGstin] = await Promise.all([
      getItemMasterLookup().catch(() => []),
      salespersonService.getSalespersonName(invoice.salesperson).catch(() => undefined),
      orderNumber
        ? salesOrderRequestService.getRequestLinesByBcSalesOrderNumber(orderNumber).catch(lookupError => {
          console.warn(`Unable to load SharePoint remarks for sales order '${orderNumber}'.`, lookupError);
          return [];
        })
        : Promise.resolve([]),
      billToGstinPromise,
      shipToGstinPromise
    ]);

    return {
      ...invoice,
      salespersonName,
      billToCustomerGSTRegistrationNumber: billToGstin,
      shipToCustomerGSTRegistrationNumber: shipToGstin,
      lines: enrichInvoiceLinesForPrint(invoice.lines, requestLines, itemMasters)
    };
  }, [currentUser, customerService, getItemMasterLookup, invoiceService, salespersonService, salesOrderRequestService]);

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
    reset();
    setAppliedFilterValues(restrictedSalespersonCode
      ? { ...filterValues, salespersonCode: restrictedSalespersonCode }
      : filterValues);
  }, [filterValues, reset, restrictedSalespersonCode]);

  const handleFilterClear = React.useCallback((): void => {
    const clearedValues = restrictedSalespersonCode ? { salespersonCode: restrictedSalespersonCode } : {};
    setFilterValues(clearedValues);
    setAppliedFilterValues(clearedValues);
    reset();
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
      invoiceNumber = requireInvoiceNumber(item.number);
    } catch (referenceError) {
      toast.error(getUserFriendlyError(normalizeError(referenceError)), { title: 'Unable to print invoice' });
      return;
    }

    documentActionsInProgress.current.add(invoiceNumber);
    setDocumentAction({ type: 'print' });

    try {
      preview = openInvoicePrintPreviewWindow();
      const printableInvoice = await loadPrintableInvoice(invoiceNumber);

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
  }, [loadPrintableInvoice, toast]);

  const handleDownload = React.useCallback(async (item: IInvoiceListItem): Promise<void> => {
    let invoiceNumber: string;

    if (documentActionsInProgress.current.size) {
      return;
    }

    try {
      invoiceNumber = requireInvoiceNumber(item.number);
    } catch (referenceError) {
      toast.error(getUserFriendlyError(normalizeError(referenceError)), { title: 'Unable to download invoice' });
      return;
    }

    documentActionsInProgress.current.add(invoiceNumber);
    setDocumentAction({ type: 'download' });

    try {
      const downloadableInvoice = await loadPrintableInvoice(invoiceNumber);

      await downloadInvoicePdf(downloadableInvoice);
      toast.success('Invoice PDF download started.', { title: downloadableInvoice.number || 'Invoice' });
    } catch (downloadError) {
      toast.error(getUserFriendlyError(normalizeError(downloadError)), { title: 'Unable to download invoice' });
    } finally {
      documentActionsInProgress.current.delete(invoiceNumber);
      setDocumentAction(undefined);
    }
  }, [loadPrintableInvoice, toast]);

  const handleRowClick = React.useCallback((item: IInvoiceListItem): void => {
    try {
      onNavigate(buildInvoiceDetailPath(item.number));
    } catch (referenceError) {
      toast.error(getUserFriendlyError(normalizeError(referenceError)), { title: 'Unable to open invoice' });
    }
  }, [onNavigate, toast]);

  const isMefriendBusinessCompany = isMefriendBusinessSolutionsCompany(selectedCompany);
  const invoiceColumns = (invoicesModuleConfig.tableColumns || []).filter(column =>
    !isMefriendBusinessCompany || (column.key !== 'releaseOrderNumber' && column.key !== 'releaseOrderDate')
  );
  const showDocumentActions = isMefriendBusinessCompany;
  const hasUserFilters = hasUserInvoiceFilters(appliedFilterValues, restrictedSalespersonCode);
  const outstandingTotalSummary = shouldShowOutstandingTotal ? (
    outstandingTotal.loading ? (
      <span>Calculating total outstanding...</span>
    ) : outstandingTotal.error ? (
      <span role="alert">Unable to calculate total outstanding: {outstandingTotal.error}</span>
    ) : (
      <>
        <span>Total Outstanding</span>
        <strong><AmountDisplay amount={outstandingTotal.amount || 0} variant="outstanding" /></strong>
      </>
    )
  ) : undefined;

  return (
    <EntityDashboard<IInvoiceListItem>
      title={invoicesModuleConfig.title}
      subtitle={invoicesModuleConfig.description}
      columns={invoiceColumns}
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
      rowActions={showDocumentActions ? [
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
      ] : undefined}
      onFilterChange={handleFilterChange}
      onFilterApply={handleFilterApply}
      onFilterClear={handleFilterClear}
      filterSummary={outstandingTotalSummary}
      cursorPagination={pagination}
      onPageChange={changePage}
      sorting={sorting}
      onSort={handleSort}
      getRowKey={item => item.id}
      emptyTitle={hasUserFilters ? 'No matching invoices' : 'No invoices available'}
      emptyMessage={hasUserFilters
        ? 'No invoices match the selected filters.'
        : 'No invoices exist for the selected company.'}
    />
  );
};
