/**
 * Invoice List (mobile reference)
 *
 * Mobile card-list version of the monolith's
 * components/billing/invoice-list.tsx -- a table doesn't fit mobile width,
 * so each invoice renders as its own card. Reflects the VAT/tax-invoicing
 * stack: a taxed invoice shows a muted "incl. $X VAT (rate%, country)"
 * line under its total (never additive -- the total is always what was
 * actually charged); a validated B2B invoice shows a "Reverse charge -- 0%
 * VAT" badge instead; untaxed invoices (US, dLocal flat-rate markets, or
 * any $0-tax record) render with no line and no badge at all.
 */

import { Download, ExternalLink, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'open' | 'failed';
  description: string;
  invoicePdfUrl: string | null;
  hostedInvoiceUrl: string | null;
  taxAmount: number;
  taxRate: number;
  taxCountry: string | null;
  reverseCharge: boolean;
}

const STATUS_CONFIG = {
  paid: {
    label: 'Paid',
    className: 'bg-green-500/15 text-green-700 dark:text-green-400',
  },
  open: {
    label: 'Open',
    className: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-500/15 text-red-700 dark:text-red-400',
  },
} as const;

/** Same one-string construction as the web component, for the same reason:
 *  avoid JSX whitespace-collapsing inserting stray spaces around the
 *  parenthesis/comma. */
function formatVatLine(
  invoice: Pick<Invoice, 'taxAmount' | 'taxRate' | 'taxCountry'>
): string {
  const ratePercent = Math.round(invoice.taxRate * 100);
  const countrySuffix =
    invoice.taxCountry && invoice.taxCountry !== 'UNKNOWN'
      ? `, ${invoice.taxCountry}`
      : '';
  return `incl. $${invoice.taxAmount.toFixed(2)} VAT (${ratePercent}%${countrySuffix})`;
}

export function InvoiceList({ invoices }: { invoices: Invoice[] }) {
  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm font-medium">No invoices yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Your billing history will appear here after your first payment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {invoices.map((invoice) => {
        const statusConfig = STATUS_CONFIG[invoice.status];

        return (
          <Card key={invoice.id}>
            <CardContent className="space-y-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {invoice.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(invoice.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <Badge className={statusConfig.className}>
                  {statusConfig.label}
                </Badge>
              </div>

              <div>
                <p className="text-lg font-semibold">
                  ${invoice.amount.toFixed(2)}
                </p>
                {invoice.reverseCharge ? (
                  <Badge variant="outline" className="mt-1 text-xs font-normal">
                    Reverse charge — 0% VAT
                  </Badge>
                ) : invoice.taxAmount > 0 ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatVatLine(invoice)}
                  </p>
                ) : null}
              </div>

              {(invoice.hostedInvoiceUrl || invoice.invoicePdfUrl) && (
                <div className="flex items-center gap-2 pt-1">
                  {invoice.hostedInvoiceUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="h-8 flex-1"
                    >
                      <a
                        href={invoice.hostedInvoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        View
                      </a>
                    </Button>
                  )}
                  {invoice.invoicePdfUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="h-8 flex-1"
                    >
                      <a
                        href={invoice.invoicePdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1"
                      >
                        <Download className="h-3.5 w-3.5" />
                        PDF
                      </a>
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
