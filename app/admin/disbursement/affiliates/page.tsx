'use client';

import { useEffect, useState, useCallback } from 'react';
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useLocale } from '@/lib/context/locale-context';
import type {
  PayableAffiliate,
  RiseWorksKycStatus,
} from '@/types/disbursement';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface PayableSummary {
  totalAffiliates: number;
  totalPendingAmount: number;
  readyForPayout: number;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getKycStatusBadge(
  status: RiseWorksKycStatus | 'none',
  t: (keyOrText: string, fallback?: string) => string
): React.ReactElement {
  const defaultConfig = {
    className: 'bg-muted text-muted-foreground',
    labelKey: 'admin.disbursement.kyc_no_account',
    label: 'No Account',
  };
  const statusConfig: Record<
    string,
    { className: string; labelKey: string; label: string }
  > = {
    APPROVED: {
      className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      labelKey: 'admin.disbursement.kyc_approved',
      label: 'Approved',
    },
    PENDING: {
      className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      labelKey: 'admin.disbursement.kyc_pending',
      label: 'Pending',
    },
    SUBMITTED: {
      className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      labelKey: 'admin.disbursement.kyc_submitted',
      label: 'Submitted',
    },
    REJECTED: {
      className: 'bg-red-500/10 text-red-600 dark:text-red-400',
      labelKey: 'admin.disbursement.kyc_rejected',
      label: 'Rejected',
    },
    EXPIRED: {
      className: 'bg-muted text-muted-foreground',
      labelKey: 'admin.disbursement.kyc_expired',
      label: 'Expired',
    },
    none: defaultConfig,
  };

  const config = statusConfig[status] ?? defaultConfig;

  return (
    <Badge className={`${config.className} text-xs`}>
      {t(config.labelKey, config.label)}
    </Badge>
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PAYABLE AFFILIATES PAGE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Payable Affiliates Page - Client Component
 *
 * Features:
 * - List of affiliates with pending commissions
 * - RiseWorks account status display
 * - Quick pay action for individual affiliates
 * - Batch creation for multiple affiliates
 * - Summary statistics
 *
 * Data fetching:
 * - Fetches from /api/disbursement/affiliates/payable
 */
export default function PayableAffiliatesPage(): React.ReactElement {
  const { t, formatCurrency, formatDate } = useLocale();
  const [affiliates, setAffiliates] = useState<PayableAffiliate[]>([]);
  const [summary, setSummary] = useState<PayableSummary | null>(null);
  const [selectedAffiliates, setSelectedAffiliates] = useState<Set<string>>(
    new Set()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchAffiliates = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/disbursement/affiliates/payable');

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error ||
            t(
              'admin.disbursement.error_fetch_affiliates',
              'Failed to fetch affiliates'
            )
        );
      }

      const data = await response.json();
      setAffiliates(data.affiliates || []);
      setSummary(data.summary || null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('admin.dashboard.unknown_error', 'Unknown error')
      );
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetchAffiliates();
  }, [fetchAffiliates]);

  const handleSelectAffiliate = (id: string): void => {
    const newSelected = new Set(selectedAffiliates);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedAffiliates(newSelected);
  };

  const handleSelectAll = (): void => {
    if (
      selectedAffiliates.size ===
      affiliates.filter((a) => a.readyForPayout).length
    ) {
      setSelectedAffiliates(new Set());
    } else {
      const readyIds = affiliates
        .filter((a) => a.readyForPayout)
        .map((a) => a.id);
      setSelectedAffiliates(new Set(readyIds));
    }
  };

  const handleQuickPay = async (affiliateId: string): Promise<void> => {
    try {
      setIsProcessing(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch('/api/disbursement/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliateId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error ||
            t('admin.disbursement.error_payment_failed', 'Payment failed')
        );
      }

      const data = await response.json();
      setSuccessMessage(
        t(
          'admin.disbursement.payment_successful',
          'Payment successful! Batch ID: {id}'
        ).replace('{id}', data.result.batchId)
      );
      void fetchAffiliates();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('admin.disbursement.error_payment_failed', 'Payment failed')
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateBatch = async (): Promise<void> => {
    if (selectedAffiliates.size === 0) return;

    try {
      setIsProcessing(true);
      setError(null);
      setSuccessMessage(null);

      const response = await fetch('/api/disbursement/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affiliateIds: Array.from(selectedAffiliates),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error ||
            t('admin.disbursement.error_create_batch', 'Failed to create batch')
        );
      }

      const data = await response.json();
      setSuccessMessage(
        t(
          'admin.disbursement.batch_created',
          'Batch created! ID: {id}'
        ).replace('{id}', data.batch.id)
      );
      setSelectedAffiliates(new Set());
      void fetchAffiliates();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('admin.disbursement.error_create_batch', 'Failed to create batch')
      );
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-green-500" />
      </div>
    );
  }

  const readyAffiliates = affiliates.filter((a) => a.readyForPayout);
  const notReadyAffiliates = affiliates.filter((a) => !a.readyForPayout);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            {t('admin.disbursement.payable_affiliates', 'Payable Affiliates')}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t(
              'admin.disbursement.payable_affiliates_subtitle',
              'Affiliates with pending commission payouts'
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => void fetchAffiliates()}
            variant="outline"
            disabled={isLoading}
          >
            {t('Refresh', 'Refresh')}
          </Button>
          {selectedAffiliates.size > 0 && (
            <Button
              onClick={() => void handleCreateBatch()}
              disabled={isProcessing}
            >
              {isProcessing
                ? t('admin.disbursement.creating', 'Creating...')
                : t(
                    'admin.disbursement.create_batch_count',
                    'Create Batch ({count})'
                  ).replace('{count}', String(selectedAffiliates.size))}
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <Card className="border-red-600 bg-red-500/10">
          <CardContent className="py-4">
            <p className="text-red-500">{error}</p>
          </CardContent>
        </Card>
      )}

      {successMessage && (
        <Card className="border-green-600 bg-emerald-500/10">
          <CardContent className="py-4">
            <p className="text-emerald-500">{successMessage}</p>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardDescription className="text-muted-foreground">
                {t('admin.disbursement.total_affiliates', 'Total Affiliates')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">
                {summary.totalAffiliates}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardDescription className="text-muted-foreground">
                {t('admin.disbursement.ready_for_payout', 'Ready for Payout')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-400">
                {summary.readyForPayout}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardDescription className="text-muted-foreground">
                {t('admin.disbursement.total_pending', 'Total Pending')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-400">
                {formatCurrency(summary.totalPendingAmount)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Ready for Payout Table */}
      {readyAffiliates.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  {t('admin.disbursement.ready_for_payout', 'Ready for Payout')}
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    {readyAffiliates.length}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  {t(
                    'admin.disbursement.ready_for_payout_desc',
                    'Affiliates with approved RiseWorks accounts (historical KYC record — payouts run through Wise)'
                  )}
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                {selectedAffiliates.size === readyAffiliates.length
                  ? t('admin.disbursement.deselect_all', 'Deselect All')
                  : t('admin.disbursement.select_all', 'Select All')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={
                          selectedAffiliates.size === readyAffiliates.length
                        }
                        onChange={handleSelectAll}
                        className="rounded"
                        aria-label={t(
                          'admin.disbursement.select_all_affiliates_aria',
                          'Select all affiliates'
                        )}
                      />
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {t('admin.disbursement.affiliate', 'Affiliate')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {t('admin.affiliates.country', 'Country')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {t('admin.disbursement.pending', 'Pending')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {t('admin.disbursement.commissions', 'Commissions')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {t('admin.disbursement.oldest', 'Oldest')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {t('admin.disbursement.kyc_status', 'KYC Status')}
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      {t('admin.disbursement.actions', 'Actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {readyAffiliates.map((affiliate) => (
                    <tr
                      key={affiliate.id}
                      className="border-border/50 hover:bg-accent/30 border-b"
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedAffiliates.has(affiliate.id)}
                          onChange={() => handleSelectAffiliate(affiliate.id)}
                          className="rounded"
                          aria-label={t(
                            'admin.disbursement.select_affiliate_aria',
                            'Select {name}'
                          ).replace('{name}', affiliate.fullName)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">
                            {affiliate.fullName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {affiliate.email}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {affiliate.country}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-green-400">
                          {formatCurrency(affiliate.pendingAmount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {affiliate.pendingCommissionCount}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {affiliate.oldestPendingDate
                          ? formatDate(affiliate.oldestPendingDate)
                          : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {getKycStatusBadge(affiliate.riseAccount.kycStatus, t)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/admin/disbursement/affiliates/${affiliate.id}`}
                            className="hover:text-primary/80 text-sm text-primary transition-colors"
                          >
                            {t('View', 'View')}
                          </Link>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" disabled={isProcessing}>
                                {t('admin.disbursement.pay_now', 'Pay Now')}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {t(
                                    'admin.disbursement.confirm_quick_payment',
                                    'Confirm quick payment'
                                  )}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('admin.disbursement.pay_prefix', 'Pay')}{' '}
                                  <strong>
                                    {formatCurrency(affiliate.pendingAmount)}
                                  </strong>{' '}
                                  {t('admin.disbursement.pay_to', 'to')}{' '}
                                  <strong>{affiliate.fullName}</strong> (
                                  {affiliate.pendingCommissionCount}{' '}
                                  {affiliate.pendingCommissionCount === 1
                                    ? t(
                                        'admin.disbursement.commission_singular',
                                        'commission'
                                      )
                                    : t(
                                        'admin.disbursement.commission_plural',
                                        'commissions'
                                      )}
                                  ){' '}
                                  {t(
                                    'admin.disbursement.quick_pay_warning',
                                    'now? This creates a single-affiliate batch and executes it immediately — it cannot be undone.'
                                  )}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>
                                  {t('Cancel', 'Cancel')}
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    void handleQuickPay(affiliate.id)
                                  }
                                >
                                  {t('admin.disbursement.pay_now', 'Pay Now')}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Not Ready Table */}
      {notReadyAffiliates.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              {t(
                'admin.disbursement.not_ready_for_payout',
                'Not Ready for Payout'
              )}
              <Badge className="bg-muted text-muted-foreground">
                {notReadyAffiliates.length}
              </Badge>
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {t(
                'admin.disbursement.not_ready_for_payout_desc',
                'Affiliates pending KYC approval or missing RiseWorks account'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {t('admin.disbursement.affiliate', 'Affiliate')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {t('admin.affiliates.country', 'Country')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {t('admin.disbursement.pending', 'Pending')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {t('admin.disbursement.commissions', 'Commissions')}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {t(
                        'admin.disbursement.riseworks_status',
                        'RiseWorks Status'
                      )}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {t('admin.disbursement.reason', 'Reason')}
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      {t('admin.disbursement.actions', 'Actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {notReadyAffiliates.map((affiliate) => (
                    <tr
                      key={affiliate.id}
                      className="border-border/50 hover:bg-accent/30 border-b"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">
                            {affiliate.fullName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {affiliate.email}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {affiliate.country}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-yellow-400">
                          {formatCurrency(affiliate.pendingAmount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {affiliate.pendingCommissionCount}
                      </td>
                      <td className="px-4 py-3">
                        {getKycStatusBadge(affiliate.riseAccount.kycStatus, t)}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {!affiliate.riseAccount.hasAccount
                          ? t(
                              'admin.disbursement.no_riseworks_account',
                              'No RiseWorks account'
                            )
                          : affiliate.riseAccount.kycStatus !== 'APPROVED'
                            ? t(
                                'admin.disbursement.kyc_not_approved',
                                'KYC not approved'
                              )
                            : t('admin.disbursement.unknown', 'Unknown')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/disbursement/affiliates/${affiliate.id}`}
                          className="hover:text-primary/80 text-sm text-primary transition-colors"
                        >
                          {t('View', 'View')}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {affiliates.length === 0 && (
        <Card className="border-border bg-card">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {t(
                'admin.disbursement.no_pending_payouts',
                'No affiliates with pending payouts found.'
              )}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
