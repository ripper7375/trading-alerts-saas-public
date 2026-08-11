'use client';

/**
 * Invoice List Component
 *
 * Displays invoice history with:
 * - Date, description, amount columns
 * - Payment status badges (Paid/Open/Failed)
 * - PDF download links
 *
 * @module components/billing/invoice-list
 */

import { Download, FileText, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'open' | 'failed';
  description: string;
  invoicePdfUrl: string | null;
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
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const STATUS_CONFIG = {
  paid: {
    label: 'Paid',
    className: 'bg-green-100 text-green-800',
  },
  open: {
    label: 'Open',
    className: 'bg-yellow-100 text-yellow-800',
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-100 text-red-800',
  },
} as const;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Invoice List Component
 *
 * @param props - Component props
 * @returns React element
 *
 * @example
 * <InvoiceList
 *   invoices={invoices}
 *   isLoading={false}
 *   hasMore={true}
 *   onLoadMore={() => fetchMoreInvoices()}
 * />
 */
export function InvoiceList({
  invoices,
  isLoading = false,
  hasMore = false,
  onLoadMore,
}: InvoiceListProps): React.ReactElement {
  // Loading state
  if (isLoading && invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="mt-4 text-muted-foreground">Loading invoices...</p>
      </div>
    );
  }

  // Empty state
  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="mb-2 text-lg font-medium">No invoices yet</h3>
        <p className="max-w-sm text-muted-foreground">
          Your billing history will appear here after your first payment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Invoice Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="px-4 py-3 text-left text-sm font-semibold">
                Date
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold">
                Description
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold">
                Amount
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold">
                Status
              </th>
              <th className="px-4 py-3 text-right text-sm font-semibold">
                Invoice
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
                    {new Date(invoice.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>

                  {/* Description */}
                  <td className="px-4 py-3 text-sm">{invoice.description}</td>

                  {/* Amount */}
                  <td className="px-4 py-3 text-sm font-semibold">
                    ${invoice.amount.toFixed(2)}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <Badge className={statusConfig.className}>
                      {statusConfig.label}
                    </Badge>
                  </td>

                  {/* Download */}
                  <td className="px-4 py-3 text-right">
                    {invoice.invoicePdfUrl ? (
                      <Button variant="ghost" size="sm" asChild>
                        <a
                          href={invoice.invoicePdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1"
                        >
                          <Download className="h-4 w-4" />
                          <span className="sr-only sm:not-sr-only">PDF</span>
                        </a>
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={onLoadMore} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
