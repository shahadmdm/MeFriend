import type { IInvoiceFilters } from '../../../models/invoices';
import type { EntityFilterValues } from '../../../../../shared/components/filters/EntityFilters';

export const toInvoiceFilters = (values: EntityFilterValues): IInvoiceFilters => ({
  searchText: typeof values.searchText === 'string' ? values.searchText : undefined,
  customerSearch: typeof values.customerSearch === 'string' ? values.customerSearch : undefined,
  salespersonCode: typeof values.salespersonCode === 'string' ? values.salespersonCode : undefined,
  invoiceDateFrom: typeof values.invoiceDateFrom === 'string' ? values.invoiceDateFrom : undefined,
  invoiceDateTo: typeof values.invoiceDateTo === 'string' ? values.invoiceDateTo : undefined
});

export const hasUserInvoiceFilters = (
  values: EntityFilterValues,
  restrictedSalespersonCode?: string
): boolean => {
  const filters = toInvoiceFilters(values);

  return Boolean(
    filters.searchText?.trim() ||
    filters.customerSearch?.trim() ||
    filters.invoiceDateFrom ||
    filters.invoiceDateTo ||
    (!restrictedSalespersonCode && filters.salespersonCode)
  );
};
