import * as React from 'react';
import { invoicesModuleConfig } from '../../../config/modules/invoicesModuleConfig';
import type { IFormFieldConfig } from '../../../../../shared/models/IFormFieldConfig';
import type { ITableColumn } from '../../../../../shared/models/ITableColumn';
import type { IInvoiceDetail, IInvoiceLineItem } from '../../../models/invoices';
import type { IAppUser } from '../../../models/settings/IAppAccessModels';
import { getUserFriendlyError, normalizeError } from '../../../../../shared/api/apiErrorHandler';
import type { InvoiceService } from '../../../services/invoices/invoiceService';
import type { SalespersonService } from '../../../services/salespersons/salespersonService';
import type { EntityFormValues } from '../../../../../shared/utilities/validationUtils';
import { EntityDetailPage, EntityDetailSection } from '../../../../../shared/components/detailPage/EntityDetailPage';
import { FinancialSummaryCards } from '../../../../../shared/components/financialSummary/FinancialSummaryCards';
import { ReadOnlyEntityForm } from '../../../../../shared/components/forms/ReadOnlyEntityForm';
import { RelatedRecordsSection } from '../../../../../shared/components/relatedRecords/RelatedRecordsSection';

export interface IInvoiceDetailPageProps {
  currentUser?: IAppUser;
  invoiceNumber: string;
  invoiceService: InvoiceService;
  salespersonService: SalespersonService;
  onNavigate: (path: string) => void;
}

const lineColumns: readonly ITableColumn<IInvoiceLineItem>[] = [
  { key: 'lineNumber', header: 'Line', fieldName: 'lineNumber', sortable: false, renderType: 'text' },
  { key: 'itemCode', header: 'Item Code', fieldName: 'itemCode', sortable: false, renderType: 'text', minWidth: 140 },
  {
    key: 'description',
    header: 'Item Description',
    fieldName: 'description',
    sortable: false,
    renderType: 'text',
    minWidth: 220,
    customRender: item => item.description || item.itemDescription || 'N/A'
  },
  { key: 'hsnCode', header: 'HSN Code', fieldName: 'hsnCode', sortable: false, renderType: 'text' },
  { key: 'gstRate', header: 'GST Rate', fieldName: 'gstRate', sortable: false, renderType: 'text' },
  { key: 'quantity', header: 'Quantity', fieldName: 'quantity', sortable: false, renderType: 'text' },
  { key: 'unitPrice', header: 'Unit Price', fieldName: 'unitPrice', sortable: false, renderType: 'amount' },
  { key: 'lineAmount', header: 'Line Amount', fieldName: 'lineAmount', sortable: false, renderType: 'amount' }
];

const field = (
  key: string,
  label: string,
  section: string,
  type: IFormFieldConfig['type'] = 'text'
): IFormFieldConfig => ({ key, label, section, type, required: false });

const invoiceInformationFields: readonly IFormFieldConfig[] = [
  field('number', 'Invoice Number', 'Invoice Information'),
  field('invoiceDate', 'Invoice Date', 'Invoice Information', 'date'),
  field('postingDate', 'Posting Date', 'Invoice Information', 'date'),
  field('documentDate', 'Document Date', 'Invoice Information', 'date'),
  field('dueDate', 'Due Date', 'Invoice Information', 'date'),
  field('externalDocumentNumber', 'External Document No.', 'Invoice Information'),
  field('orderNumber', 'Order Number', 'Invoice Information'),
  field('yourReference', 'Your Reference', 'Invoice Information'),
  field('releaseOrderNumber', 'Release Order Number', 'Invoice Information'),
  field('releaseOrderDate', 'Release Order Date', 'Invoice Information', 'date'),
  field('documentStatus', 'Document Status', 'Invoice Information'),
  field('paymentStatus', 'Payment Status', 'Invoice Information')
];

const customerInformationFields: readonly IFormFieldConfig[] = [
  field('customerNumber', 'Customer Number', 'Customer'),
  field('customerName', 'Customer Name', 'Customer'),
  field('sellToCustomerNumber', 'Sell-to Customer Number', 'Sell-to Customer'),
  field('sellToCustomerName', 'Sell-to Customer Name', 'Sell-to Customer'),
  field('billToCustomerNumber', 'Bill-to Customer Number', 'Bill-to Customer'),
  field('billToCustomerName', 'Bill-to Customer Name', 'Bill-to Customer'),
  field('billToAddressLine1', 'Bill-to Address 1', 'Bill-to Customer'),
  field('billToAddressLine2', 'Bill-to Address 2', 'Bill-to Customer'),
  field('billToCity', 'Bill-to City', 'Bill-to Customer'),
  field('billToState', 'Bill-to State', 'Bill-to Customer'),
  field('billToPostCode', 'Bill-to Post Code', 'Bill-to Customer'),
  field('billToCountryCode', 'Bill-to Country', 'Bill-to Customer'),
  field('shipToName', 'Ship-to Name', 'Ship-to Customer'),
  field('shipToAddressLine1', 'Ship-to Address 1', 'Ship-to Customer'),
  field('shipToAddressLine2', 'Ship-to Address 2', 'Ship-to Customer'),
  field('shipToCity', 'Ship-to City', 'Ship-to Customer'),
  field('shipToState', 'Ship-to State', 'Ship-to Customer'),
  field('shipToPostCode', 'Ship-to Post Code', 'Ship-to Customer'),
  field('shipToCountryCode', 'Ship-to Country', 'Ship-to Customer'),
  field('customerGSTRegistrationNumber', 'Customer GST Number', 'GST Information'),
  field('placeOfSupply', 'Place of Supply', 'GST Information'),
  field('gstCustomerType', 'GST Customer Type', 'GST Information'),
  field('gstInvoice', 'GST Invoice', 'GST Information'),
  field('hasGSTEntries', 'Has GST Entries', 'GST Information')
];

const salesInformationFields: readonly IFormFieldConfig[] = [
  field('salespersonName', 'Salesperson Name', 'Sales Information'),
  field('salesperson', 'Salesperson Code', 'Sales Information'),
  field('responsibilityCenter', 'Responsibility Center', 'Sales Information'),
  field('locationCode', 'Location Code', 'Sales Information'),
  field('currencyCode', 'Currency Code', 'Sales Information'),
  field('currencyFactor', 'Currency Factor', 'Sales Information', 'number'),
  field('paymentTermsCode', 'Payment Terms', 'Sales Information'),
  field('shipmentMethodCode', 'Shipment Method', 'Sales Information'),
  field('pricesIncludeTax', 'Prices Include Tax', 'Sales Information')
];

const paymentInformationFields: readonly IFormFieldConfig[] = [
  field('originalAmount', 'Original Amount', 'Payment & Outstanding', 'amount'),
  field('remainingAmount', 'Outstanding Amount', 'Payment & Outstanding', 'amount'),
  field('settledAmount', 'Settled Amount', 'Payment & Outstanding', 'amount'),
  field('originalAmountLCY', 'Original Amount LCY', 'Payment & Outstanding', 'amount'),
  field('remainingAmountLCY', 'Remaining Amount LCY', 'Payment & Outstanding', 'amount'),
  field('paymentStatus', 'Payment Status', 'Payment & Outstanding'),
  field('isOpen', 'Open Status', 'Payment & Outstanding'),
  field('isPaid', 'Paid', 'Payment & Outstanding'),
  field('isPartiallyPaid', 'Partially Paid', 'Payment & Outstanding'),
  field('isOverdue', 'Overdue', 'Payment & Outstanding'),
  field('daysOverdue', 'Days Overdue', 'Payment & Outstanding', 'number'),
  field('hasCustomerLedgerEntry', 'Has Customer Ledger Entry', 'Customer Ledger'),
  field('customerLedgerEntryNumber', 'Customer Ledger Entry', 'Customer Ledger', 'number'),
  field('customerLedgerDueDate', 'Customer Ledger Due Date', 'Customer Ledger', 'date'),
  field('closedAtDate', 'Closed Date', 'Customer Ledger', 'date')
];

const accountingFields: readonly IFormFieldConfig[] = [
  field('shortcutDimension1Code', 'Dimension 1', 'Accounting & Dimensions'),
  field('shortcutDimension2Code', 'Dimension 2', 'Accounting & Dimensions'),
  field('dimensionSetId', 'Dimension Set ID', 'Accounting & Dimensions', 'number'),
  field('customerPostingGroup', 'Customer Posting Group', 'Accounting & Dimensions'),
  field('paymentMethodCode', 'Payment Method', 'Accounting & Dimensions'),
  field('companyBankAccountCode', 'Company Bank Account', 'Accounting & Dimensions'),
  field('sourceCode', 'Source Code', 'Accounting & Dimensions'),
  field('postingDescription', 'Posting Description', 'Accounting & Dimensions'),
  field('lastModifiedDateTime', 'Last Modified', 'Accounting & Dimensions')
];

const booleanLabel = (value?: boolean): string | undefined => value === undefined ? undefined : value ? 'Yes' : 'No';
const openStatusLabel = (value?: boolean): string | undefined => value === undefined ? undefined : value ? 'Open' : 'Closed';
const formatDateTime = (value?: string): string | undefined => {
  if (!value || value.indexOf('0001-01-01') === 0) {
    return undefined;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return undefined;
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    year: 'numeric'
  }).format(parsedDate);
};

const getDetailErrorMessage = (error: unknown): string => {
  const normalizedError = normalizeError(error);

  if (normalizedError.status === 404 || normalizedError.status === 405 || normalizedError.status === 501) {
    return 'Invoice detail API is not configured yet.';
  }

  return getUserFriendlyError(normalizedError);
};

export const InvoiceDetailPage: React.FC<IInvoiceDetailPageProps> = ({ currentUser, invoiceNumber, invoiceService, salespersonService, onNavigate }) => {
  const [invoice, setInvoice] = React.useState<IInvoiceDetail | undefined>();
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | undefined>();
  const handleBack = React.useCallback((): void => {
    onNavigate(invoicesModuleConfig.route);
  }, [onNavigate]);

  React.useEffect(() => {
    const loadInvoice = async (): Promise<void> => {
      setLoading(true);
      setError(undefined);

      try {
        const detail = await invoiceService.getInvoiceByNumber(invoiceNumber, currentUser);
        const salespersonName = await salespersonService.getSalespersonName(detail.salesperson)
          .catch(() => undefined);
        setInvoice({ ...detail, salespersonName });
      } catch (loadError) {
        setInvoice(undefined);
        setError(getDetailErrorMessage(loadError));
      } finally {
        setLoading(false);
      }
    };

    loadInvoice().catch(() => undefined);
  }, [currentUser, invoiceNumber, invoiceService, salespersonService]);

  const invoiceInformationValues = React.useMemo<EntityFormValues>(() => ({
    number: invoice?.number,
    invoiceDate: invoice?.invoiceDate,
    postingDate: invoice?.postingDate,
    documentDate: invoice?.documentDate,
    dueDate: invoice?.dueDate,
    externalDocumentNumber: invoice?.externalDocumentNumber,
    orderNumber: invoice?.orderNumber,
    yourReference: invoice?.yourReference,
    releaseOrderNumber: invoice?.releaseOrderNumber,
    releaseOrderDate: invoice?.releaseOrderDate,
    documentStatus: invoice?.documentStatus,
    paymentStatus: invoice?.paymentStatus
  }), [invoice]);

  const customerInformationValues = React.useMemo<EntityFormValues>(() => ({
    customerNumber: invoice?.customerNumber,
    customerName: invoice?.customerName,
    sellToCustomerNumber: invoice?.sellToCustomerNumber,
    sellToCustomerName: invoice?.sellToCustomerName,
    billToCustomerNumber: invoice?.billToCustomerNumber,
    billToCustomerName: invoice?.billToCustomerName,
    billToAddressLine1: invoice?.billToAddressLine1,
    billToAddressLine2: invoice?.billToAddressLine2,
    billToCity: invoice?.billToCity,
    billToState: invoice?.billToState,
    billToPostCode: invoice?.billToPostCode,
    billToCountryCode: invoice?.billToCountryCode,
    shipToName: invoice?.shipToName,
    shipToAddressLine1: invoice?.shipToAddressLine1,
    shipToAddressLine2: invoice?.shipToAddressLine2,
    shipToCity: invoice?.shipToCity,
    shipToState: invoice?.shipToState,
    shipToPostCode: invoice?.shipToPostCode,
    shipToCountryCode: invoice?.shipToCountryCode,
    customerGSTRegistrationNumber: invoice?.customerGSTRegistrationNumber,
    placeOfSupply: invoice?.placeOfSupply,
    gstCustomerType: invoice?.gstCustomerType,
    gstInvoice: booleanLabel(invoice?.gstInvoice),
    hasGSTEntries: booleanLabel(invoice?.hasGSTEntries)
  }), [invoice]);

  const salesInformationValues = React.useMemo<EntityFormValues>(() => ({
    salespersonName: invoice?.salespersonName,
    salesperson: invoice?.salesperson,
    responsibilityCenter: invoice?.responsibilityCenter,
    locationCode: invoice?.locationCode,
    currencyCode: invoice?.currencyCode,
    currencyFactor: invoice?.currencyFactor,
    paymentTermsCode: invoice?.paymentTermsCode,
    shipmentMethodCode: invoice?.shipmentMethodCode,
    pricesIncludeTax: booleanLabel(invoice?.pricesIncludeTax)
  }), [invoice]);

  const paymentInformationValues = React.useMemo<EntityFormValues>(() => ({
    originalAmount: invoice?.originalAmount,
    remainingAmount: invoice?.remainingAmount,
    settledAmount: invoice?.settledAmount,
    originalAmountLCY: invoice?.originalAmountLCY,
    remainingAmountLCY: invoice?.remainingAmountLCY,
    paymentStatus: invoice?.paymentStatus,
    isOpen: openStatusLabel(invoice?.isOpen),
    isPaid: booleanLabel(invoice?.isPaid),
    isPartiallyPaid: booleanLabel(invoice?.isPartiallyPaid),
    isOverdue: booleanLabel(invoice?.isOverdue),
    daysOverdue: invoice?.daysOverdue,
    hasCustomerLedgerEntry: booleanLabel(invoice?.hasCustomerLedgerEntry),
    customerLedgerEntryNumber: invoice?.customerLedgerEntryNumber,
    customerLedgerDueDate: invoice?.customerLedgerDueDate,
    closedAtDate: invoice?.closedAtDate
  }), [invoice]);

  const accountingValues = React.useMemo<EntityFormValues>(() => ({
    shortcutDimension1Code: invoice?.shortcutDimension1Code,
    shortcutDimension2Code: invoice?.shortcutDimension2Code,
    dimensionSetId: invoice?.dimensionSetId,
    customerPostingGroup: invoice?.customerPostingGroup,
    paymentMethodCode: invoice?.paymentMethodCode,
    companyBankAccountCode: invoice?.companyBankAccountCode,
    sourceCode: invoice?.sourceCode,
    postingDescription: invoice?.postingDescription,
    lastModifiedDateTime: formatDateTime(invoice?.lastModifiedDateTime)
  }), [invoice]);

  const currencyCode = invoice?.currencyCode || undefined;

  return (
    <EntityDetailPage
      title={invoice ? `Invoice ${invoice.number}` : 'Invoice Detail'}
      description={invoice
        ? `Payment status: ${invoice.paymentStatus || 'N/A'} · Salesperson: ${invoice.salespersonName || invoice.salesperson || 'N/A'}`
        : invoiceNumber ? `Invoice reference: ${invoiceNumber}` : undefined}
      backLabel="Back to Invoices"
      onBack={handleBack}
      loading={loading}
      error={error}
    >
      <EntityDetailSection ariaLabel="Financial summary" title="Financial Summary">
        <FinancialSummaryCards
          fallback="N/A"
          cards={[
            { key: 'subtotal', label: 'Subtotal', amount: invoice?.subtotal, currencyCode },
            { key: 'discountAmount', label: 'Discount Amount', amount: invoice?.discountAmount, currencyCode },
            { key: 'totalAmountExcludingTax', label: 'Total Excluding Tax', amount: invoice?.totalAmountExcludingTax, currencyCode, type: 'total' },
            { key: 'sgstAmount', label: 'SGST', amount: invoice?.sgstAmount, currencyCode },
            { key: 'cgstAmount', label: 'CGST', amount: invoice?.cgstAmount, currencyCode },
            { key: 'igstAmount', label: 'IGST', amount: invoice?.igstAmount, currencyCode },
            { key: 'utgstAmount', label: 'UTGST', amount: invoice?.utgstAmount, currencyCode },
            { key: 'cessAmount', label: 'CESS', amount: invoice?.cessAmount, currencyCode },
            { key: 'otherGSTAmount', label: 'Other GST', amount: invoice?.otherGSTAmount, currencyCode },
            { key: 'totalTaxAmount', label: 'Total Tax', amount: invoice?.totalTaxAmount, currencyCode, type: 'total' },
            { key: 'totalAmountIncludingTax', label: 'Total Including Tax', amount: invoice?.totalAmountIncludingTax, currencyCode, type: 'total' }
          ]}
        />
      </EntityDetailSection>
      <ReadOnlyEntityForm fields={paymentInformationFields} values={paymentInformationValues} emptyValue="N/A" />
      <ReadOnlyEntityForm fields={invoiceInformationFields} values={invoiceInformationValues} emptyValue="N/A" />
      <ReadOnlyEntityForm fields={customerInformationFields} values={customerInformationValues} emptyValue="N/A" />
      <ReadOnlyEntityForm fields={salesInformationFields} values={salesInformationValues} emptyValue="N/A" />
      <ReadOnlyEntityForm fields={accountingFields} values={accountingValues} emptyValue="N/A" />
      <EntityDetailSection>
        <RelatedRecordsSection<IInvoiceLineItem>
          title="Invoice Line Items"
          items={invoice?.lines || []}
          columns={lineColumns}
          emptyTitle="No invoice lines found"
          emptyMessage="No invoice line items are available for this invoice."
          getRowKey={(item, index) => item.lineNumber || String(index)}
        />
      </EntityDetailSection>
    </EntityDetailPage>
  );
};
