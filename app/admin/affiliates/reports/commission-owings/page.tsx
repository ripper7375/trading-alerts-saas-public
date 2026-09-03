'use client';

/**
 * Admin Commission Owings Report Page
 *
 * View affiliates with pending commissions ready for payout
 *
 * @module app/admin/affiliates/reports/commission-owings/page
 */

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocale } from '@/lib/context/locale-context';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface AffiliateOwing {
  id: string;
  fullName: string;
  email: string;
  country: string;
  paymentMethod: string;
  paymentDetails: Record<string, unknown>;
  balance: {
    pending: number;
    paid: number;
    total: number;
  };
  pendingCount: number;
  oldestPendingDate: string | null;
  readyForPayout: boolean;
}

interface CommissionOwingsReport {
  summary: {
    totalAffiliatesOwed: number;
    affiliatesReadyForPayout: number;
    totalOwed: number;
    minimumPayoutThreshold: number;
  };
  affiliates: AffiliateOwing[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function CommissionOwingsReportPage(): React.ReactElement {
  const { t } = useLocale();
  const [report, setReport] = useState<CommissionOwingsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [payTarget, setPayTarget] = useState<AffiliateOwing | null>(null);
  const [payMethod, setPayMethod] = useState('');
  const [payReference, setPayReference] = useState('');
  const [payError, setPayError] = useState<string | null>(null);

  const fetchReport = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/affiliates/reports/commission-owings?page=${page}`
      );

      if (!response.ok) {
        throw new Error(
          t(
            'admin.affiliates.error_fetch_owings',
            'Failed to fetch commission owings report'
          )
        );
      }

      const data = await response.json();
      setReport(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('admin.affiliates.error_occurred', 'An error occurred')
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handlePayCommissions = async (): Promise<void> => {
    if (!payTarget || !payMethod.trim() || !payReference.trim()) {
      setPayError(
        t(
          'admin.affiliates.error_method_reference_required',
          'Payment method and reference are both required'
        )
      );
      return;
    }

    setActionLoading(payTarget.id);
    setPayError(null);
    try {
      const response = await fetch('/api/admin/commissions/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affiliateId: payTarget.id,
          paymentMethod: payMethod,
          paymentReference: payReference,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error ||
            t(
              'admin.affiliates.error_process_payment',
              'Failed to process payment'
            )
        );
      }

      setPayTarget(null);
      setPayMethod('');
      setPayReference('');
      await fetchReport();
    } catch (err) {
      setPayError(
        err instanceof Error
          ? err.message
          : t(
              'admin.affiliates.error_process_payment',
              'Failed to process payment'
            )
      );
    } finally {
      setActionLoading(null);
    }
  };

  const formatCurrency = (amount: number): string => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date: string | null): string => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/admin/affiliates"
          className="text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          &larr;{' '}
          {t('admin.affiliates.back_to_affiliates_short', 'Back to Affiliates')}
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-foreground sm:text-3xl">
          {t('admin.affiliates.owings_title', 'Commission Owings Report')}
        </h1>
        <p className="text-muted-foreground">
          {t(
            'admin.affiliates.owings_subtitle',
            'Affiliates with pending commissions ready for payout'
          )}
        </p>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-500">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : report ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('admin.affiliates.total_owed', 'Total Owed')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                  {formatCurrency(report.summary.totalOwed)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('admin.affiliates.affiliates_owed', 'Affiliates Owed')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-foreground">
                  {report.summary.totalAffiliatesOwed}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('admin.affiliates.ready_for_payout', 'Ready for Payout')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                  {report.summary.affiliatesReadyForPayout}
                </p>
                <p className="text-sm text-muted-foreground">
                  ≥ {formatCurrency(report.summary.minimumPayoutThreshold)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t(
                    'admin.affiliates.min_payout_threshold',
                    'Min Payout Threshold'
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-blue-500">
                  {formatCurrency(report.summary.minimumPayoutThreshold)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Affiliates Table */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-foreground">
                {t(
                  'admin.affiliates.affiliates_with_pending',
                  'Affiliates with Pending Commissions'
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        {t('admin.affiliates.affiliate', 'Affiliate')}
                      </th>
                      <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">
                        {t('admin.affiliates.country', 'Country')}
                      </th>
                      <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">
                        {t('billing.payment_method', 'Payment Method')}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        {t(
                          'admin.affiliates.pending_balance',
                          'Pending Balance'
                        )}
                      </th>
                      <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">
                        {t('admin.affiliates.oldest_pending', 'Oldest Pending')}
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                        {t('admin.users.status', 'Status')}
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        {t('admin.users.actions', 'Actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.affiliates.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-12 text-center text-muted-foreground"
                        >
                          {t(
                            'admin.affiliates.no_pending_above_threshold',
                            'No affiliates with pending commissions above threshold'
                          )}
                        </td>
                      </tr>
                    ) : (
                      report.affiliates.map((affiliate) => (
                        <tr
                          key={affiliate.id}
                          className="border-border/50 hover:bg-accent/30 border-b transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-foreground">
                              {affiliate.fullName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {affiliate.email}
                            </div>
                          </td>
                          <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                            {affiliate.country}
                          </td>
                          <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                            {affiliate.paymentMethod}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-lg font-semibold text-amber-600 dark:text-amber-400">
                              {formatCurrency(affiliate.balance.pending)}
                            </span>
                          </td>
                          <td className="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell">
                            {formatDate(affiliate.oldestPendingDate)}
                          </td>
                          <td className="px-4 py-3">
                            {affiliate.readyForPayout ? (
                              <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/10">
                                {t('admin.affiliates.ready', 'Ready')}
                              </Badge>
                            ) : (
                              <Badge className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/10">
                                {t('admin.affiliates.below_min', 'Below Min')}
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-3">
                              <Link
                                href={`/admin/affiliates/${affiliate.id}`}
                                className="text-sm text-primary hover:underline"
                              >
                                {t('admin.affiliates.view', 'View')}
                              </Link>
                              {affiliate.readyForPayout && (
                                <AlertDialog
                                  open={payTarget?.id === affiliate.id}
                                  onOpenChange={(open) => {
                                    if (!open) {
                                      setPayTarget(null);
                                      setPayError(null);
                                    }
                                  }}
                                >
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={actionLoading === affiliate.id}
                                      onClick={() => {
                                        setPayTarget(affiliate);
                                        setPayMethod('');
                                        setPayReference('');
                                      }}
                                    >
                                      {actionLoading === affiliate.id
                                        ? t(
                                            'admin.affiliates.processing',
                                            'Processing...'
                                          )
                                        : t('admin.affiliates.pay', 'Pay')}
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>
                                        {t(
                                          'admin.affiliates.record_payment_q',
                                          'Record Payment to {name}?'
                                        ).replace('{name}', affiliate.fullName)}
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        {t(
                                          'admin.affiliates.record_payment_desc',
                                          'Marks {amount} in pending commissions as paid. Record the method and reference for the payment already sent outside this system.'
                                        ).replace(
                                          '{amount}',
                                          formatCurrency(
                                            affiliate.balance.pending
                                          )
                                        )}
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <div className="space-y-4">
                                      <div className="space-y-2">
                                        <Label htmlFor="pay-method">
                                          {t(
                                            'billing.payment_method',
                                            'Payment Method'
                                          )}
                                        </Label>
                                        <Input
                                          id="pay-method"
                                          value={payMethod}
                                          onChange={(e) =>
                                            setPayMethod(e.target.value)
                                          }
                                          placeholder={t(
                                            'admin.affiliates.pay_method_placeholder',
                                            'e.g., PayPal, Wise, Bank Transfer'
                                          )}
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor="pay-reference">
                                          {t(
                                            'admin.affiliates.payment_reference',
                                            'Payment Reference'
                                          )}
                                        </Label>
                                        <Input
                                          id="pay-reference"
                                          value={payReference}
                                          onChange={(e) =>
                                            setPayReference(e.target.value)
                                          }
                                          placeholder={t(
                                            'admin.affiliates.transaction_id',
                                            'Transaction ID'
                                          )}
                                        />
                                      </div>
                                      {payError && (
                                        <p className="text-sm text-red-500">
                                          {payError}
                                        </p>
                                      )}
                                    </div>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>
                                        {t('Cancel')}
                                      </AlertDialogCancel>
                                      <AlertDialogAction
                                        disabled={
                                          !payMethod.trim() ||
                                          !payReference.trim() ||
                                          actionLoading === affiliate.id
                                        }
                                        onClick={() =>
                                          void handlePayCommissions()
                                        }
                                      >
                                        {actionLoading === affiliate.id
                                          ? t(
                                              'admin.affiliates.processing',
                                              'Processing...'
                                            )
                                          : t(
                                              'admin.affiliates.confirm_payment',
                                              'Confirm Payment'
                                            )}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {report.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                  <div className="text-sm text-muted-foreground">
                    {t(
                      'admin.affiliates.page_of_total_with_count',
                      'Page {page} of {totalPages} ({total} total)'
                    )
                      .replace('{page}', String(report.pagination.page))
                      .replace(
                        '{totalPages}',
                        String(report.pagination.totalPages)
                      )
                      .replace('{total}', String(report.pagination.total))}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                    >
                      {t('admin.users.previous', 'Previous')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage(
                          Math.min(report.pagination.totalPages, page + 1)
                        )
                      }
                      disabled={page === report.pagination.totalPages}
                    >
                      {t('admin.users.next', 'Next')}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
