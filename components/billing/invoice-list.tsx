'use client';

/**
 * Invoice List Component
 *
 * Displays invoice history with:
 * - Date, description, amount columns
 * - Payment status badges (Paid/Open/Failed)
 * - PDF download links (Stripe's own PDF, or our generated dLocal receipt)
 *
 * Amounts (2026-09-24): the bold figure is EXACTLY what was charged, in
 * the currency it was charged in -- the same figure as the PDF. When that
 * currency differs from the viewer's display currency, an "≈" line gives
 * an indicative conversion, and a notice above the table explains why the
 * two (and the bank statement) can differ. Previously the only figure was
 * the converted one, which silently disagreed with the PDF.
 *
 * @module components/billing/invoice-list
 */

import { Download, ExternalLink, FileText, Info, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatChargedAmount } from '@/lib/billing/invoice-amounts';
import { useLocale } from '@/lib/context/locale-context';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface Invoice {
  id: string;
  date: string;
  /** Exactly what was charged, in `currency` (matches the PDF). */
  amount: number;
  /** ISO code of the charge. */
  currency: string;
  /** USD value of the charge, for the indicative conversion; null if unknown. */
  amountUsd: number | null;
  provider: 'STRIPE' | 'DLOCAL';
  status: 'paid' | 'open' | 'failed';
  description: string;
  invoicePdfUrl: string | null;
  /**
   * davintrade-vat-stack: multi-jurisdiction tax breakdown. `amount` above
   * is always the tax-inclusive total actually charged -- `taxAmount` is
   * how much of that total is tax (in `currency`), not an amount added on
   * top of it.
   */
  hostedInvoiceUrl: string | null;
  taxAmount: number;
  taxRate: number;
  taxCountry: string | null;
  reverseCharge: boolean;
}

interface InvoiceListProps {
  /** List of invoices to display */
  invoices: Invoice[];
  /** Whether invoices are loading */
  isLoading?: boolean;
  /** Whether there are more invoices to load */
  hasMore?: boolean;
  /** Callback to load more invoices */
  onLoadMore?: () => void;
  /** Callback to show the whole history at once */
  onShowAll?: () => void;
  /** Size of the whole history, for the "Showing X of Y" line */
  totalCount?: number;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const STATUS_CONFIG = {
  paid: {
    labelKey: 'billing.status.paid',
    label: 'Paid',
    className: 'bg-green-100 text-green-800',
  },
  open: {
    labelKey: 'billing.status.open',
    label: 'Open',
    className: 'bg-yellow-100 text-yellow-800',
  },
  failed: {
    labelKey: 'billing.status.failed',
    label: 'Failed',
    className: 'bg-red-100 text-red-800',
  },
} as const;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DISCREPANCY NOTICE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function AmountDifferenceNotice({
  displayCurrency,
  hasCardCharges,
  hasLocalCharges,
}: {
  displayCurrency: string;
  hasCardCharges: boolean;
  hasLocalCharges: boolean;
}): React.ReactElement {
  const { t } = useLocale();

  return (
    <div
      role="note"
      aria-label={t('billing.amounts_notice_title', 'Why amounts may differ')}
      className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-100"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="space-y-1.5">
        <p className="font-semibold">
          {t('billing.amounts_notice_title', 'Why amounts may differ')}
        </p>
        <ul className="list-disc space-y-1 pl-4">
          <li>
            {t(
              'billing.amounts_notice_exact',
              'The amount in bold is exactly what you were charged, in the currency you paid in. It matches your invoice or receipt PDF.'
            )}
          </li>
          <li>
            {t(
              'billing.amounts_notice_indicative',
              'The ≈ figure converts it into {currency}, your display currency, at an indicative exchange rate. It is for reference only and is not what you were charged.'
            ).replace('{currency}', displayCurrency)}
          </li>
          {hasCardCharges && (
            <li>
              {t(
                'billing.amounts_notice_card',
                'Card payments are charged in USD. If your card is in another currency, your bank converts the charge at its own rate and may add a foreign transaction fee, so your statement can show a different amount.'
              )}
            </li>
          )}
          {hasLocalCharges && (
            <li>
              {t(
                'billing.amounts_notice_local',
                'Local payments (via dLocal) are priced in USD and converted into your local currency by dLocal at the moment you pay. The rate used is printed on each receipt.'
              )}
            </li>
          )}
          <li>
            {t(
              'billing.amounts_notice_rounding',
              'Exchange rates change daily and amounts are rounded, so small differences are normal.'
            )}
          </li>
        </ul>
      </div>
    </div>
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Invoice List Component
 *
 * @example
 * <InvoiceList
 *   invoices={visibleInvoices}
 *   totalCount={allInvoices.length}
 *   hasMore={visibleInvoices.length < allInvoices.length}
 *   onLoadMore={() => setVisible((n) => n + 12)}
 *   onShowAll={() => setVisible(allInvoices.length)}
 * />
 */
export function InvoiceList({
  invoices,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  onShowAll,
  totalCount,
}: InvoiceListProps): React.ReactElement {
  const { t, formatDate, formatCurrency, language, currency } = useLocale();
  const displayCurrency = (currency || 'GBP').toUpperCase();

  const charged = (amount: number, code: string): string =>
    formatChargedAmount(amount, code, language);

  const formatVatLine = (
    invoice: Pick<Invoice, 'taxAmount' | 'taxRate' | 'taxCountry' | 'currency'>
  ): string => {
    const ratePercent = Math.round(invoice.taxRate * 100);
    const countrySuffix =
      invoice.taxCountry && invoice.taxCountry !== 'UNKNOWN'
        ? `, ${invoice.taxCountry}`
        : '';
    return t('billing.vat_included', 'incl. {amount} VAT ({rate}%{country})')
      .replace('{amount}', charged(invoice.taxAmount, invoice.currency))
      .replace('{rate}', String(ratePercent))
      .replace('{country}', countrySuffix);
  };

  /** A second, indicative figure is only useful when the currencies differ. */
  const showsIndicative = (invoice: Invoice): boolean =>
    invoice.amountUsd !== null &&
    invoice.currency.toUpperCase() !== displayCurrency;

  // Loading state
  if (isLoading && invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="mt-4 text-muted-foreground">
          {t('billing.loading_invoices', 'Loading invoices...')}
        </p>
      </div>
    );
  }

  // Empty state
  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="mb-2 text-lg font-medium">
          {t('billing.no_invoices', 'No invoices yet')}
        </h3>
        <p className="max-w-sm text-muted-foreground">
          {t(
            'billing.no_invoices_subtitle',
            'Your billing history will appear here after your first payment.'
          )}
        </p>
      </div>
    );
  }

  const anyIndicative = invoices.some(showsIndicative);
  const hasCardCharges = invoices.some(
    (invoice) =>
      invoice.provider === 'STRIPE' &&
      invoice.currency.toUpperCase() !== displayCurrency
  );
  const hasLocalCharges = invoices.some(
    (invoice) => invoice.provider === 'DLOCAL'
  );

  return (
    <div className="space-y-4 p-4">
      {anyIndicative && (
        <AmountDifferenceNotice
          displayCurrency={displayCurrency}
          hasCardCharges={hasCardCharges}
          hasLocalCharges={hasLocalCharges}
        />
      )}

      {/* Invoice Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="px-4 py-3 text-left text-sm font-semibold">
                {t('Date')}
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold">
                {t('Description')}
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold">
                {t('Amount')}
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold">
                {t('Status')}
              </th>
              <th className="px-4 py-3 text-right text-sm font-semibold">
                {t('billing.invoice_col', 'Invoice')}
              </th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice, index) => {
              const statusConfig = STATUS_CONFIG[invoice.status];
              const isEven = index % 2 === 0;

              return (
                <tr
                  key={invoice.id}
                  className={`hover:bg-muted/50 border-b transition-colors last:border-b-0 ${
                    isEven ? '' : 'bg-muted/30'
                  }`}
                >
                  {/* Date */}
                  <td className="px-4 py-3 text-sm">
                    {formatDate(invoice.date)}
                  </td>

                  {/* Description */}
                  <td className="px-4 py-3 text-sm">{invoice.description}</td>

                  {/* Amount */}
                  <td className="px-4 py-3 text-sm">
                    <div className="font-semibold">
                      {charged(invoice.amount, invoice.currency)}
                    </div>
                    {showsIndicative(invoice) && invoice.amountUsd !== null && (
                      <div
                        className="mt-0.5 text-xs text-muted-foreground"
                        title={t(
                          'billing.indicative_tooltip',
                          'Indicative conversion into your display currency, not the amount charged'
                        )}
                      >
                        ≈ {formatCurrency(invoice.amountUsd)}
                      </div>
                    )}
                    {invoice.reverseCharge ? (
                      <Badge
                        variant="outline"
                        className="mt-1 text-xs font-normal"
                      >
                        {t('billing.reverse_charge', 'Reverse charge — 0% VAT')}
                      </Badge>
                    ) : invoice.taxAmount > 0 ? (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {formatVatLine(invoice)}
                      </div>
                    ) : null}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <Badge className={statusConfig.className}>
                      {t(statusConfig.labelKey, statusConfig.label)}
                    </Badge>
                  </td>

                  {/* Download */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {invoice.hostedInvoiceUrl && (
                        <Button variant="ghost" size="sm" asChild>
                          <a
                            href={invoice.hostedInvoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1"
                          >
                            <ExternalLink className="h-4 w-4" />
                            <span className="sr-only sm:not-sr-only">
                              {t('View')}
                            </span>
                          </a>
                        </Button>
                      )}
                      {invoice.invoicePdfUrl ? (
                        <Button variant="ghost" size="sm" asChild>
                          <a
                            href={invoice.invoicePdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1"
                            aria-label={
                              invoice.provider === 'DLOCAL'
                                ? t(
                                    'billing.download_receipt',
                                    'Download receipt (PDF)'
                                  )
                                : t(
                                    'billing.download_invoice',
                                    'Download invoice (PDF)'
                                  )
                            }
                          >
                            <Download className="h-4 w-4" />
                            <span className="sr-only sm:not-sr-only">PDF</span>
                          </a>
                        </Button>
                      ) : !invoice.hostedInvoiceUrl ? (
                        <span className="text-sm text-muted-foreground">-</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* History size + paging */}
      {totalCount !== undefined && totalCount > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {t('billing.showing_count', 'Showing {shown} of {total} invoices')
            .replace('{shown}', String(invoices.length))
            .replace('{total}', String(totalCount))}
        </p>
      )}
      {hasMore && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={onLoadMore} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('Loading...')}
              </>
            ) : (
              t('Load More')
            )}
          </Button>
          {onShowAll && (
            <Button variant="ghost" onClick={onShowAll} disabled={isLoading}>
              {t('billing.show_all', 'Show all')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
