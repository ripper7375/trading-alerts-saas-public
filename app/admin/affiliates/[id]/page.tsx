'use client';

/**
 * Admin Affiliate Detail Page
 *
 * View and manage individual affiliate details
 *
 * @module app/admin/affiliates/[id]/page
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
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
import { Textarea } from '@/components/ui/textarea';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface AffiliateCode {
  id: string;
  code: string;
  status: string;
  distributedAt: string;
  expiresAt: string;
  usedAt: string | null;
  distributionReason: string;
}

interface Commission {
  id: string;
  commissionAmount: number;
  status: string;
  earnedAt: string;
  paidAt: string | null;
}

interface AffiliateDetails {
  id: string;
  fullName: string;
  country: string;
  status: string;
  paymentMethod: string;
  paymentDetails: Record<string, unknown>;
  totalCodesDistributed: number;
  totalCodesUsed: number;
  totalEarnings: number;
  pendingCommissions: number;
  paidCommissions: number;
  verifiedAt: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  createdAt: string;
  user: {
    email: string;
    name: string | null;
  };
  affiliateCodes: AffiliateCode[];
  commissions: Commission[];
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function AdminAffiliateDetailPage(): React.ReactElement {
  const params = useParams();
  const affiliateId = params['id'] as string;

  const [affiliate, setAffiliate] = useState<AffiliateDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [distributeCount, setDistributeCount] = useState(10);
  const [distributeReason, setDistributeReason] = useState('');

  const fetchAffiliate = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/affiliates/${affiliateId}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Affiliate not found');
        }
        throw new Error('Failed to fetch affiliate');
      }

      const data = await response.json();
      setAffiliate(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [affiliateId]);

  useEffect(() => {
    if (affiliateId) {
      fetchAffiliate();
    }
  }, [affiliateId, fetchAffiliate]);

  const handleSuspend = async (): Promise<void> => {
    setActionLoading(true);
    setActionError(null);
    try {
      const response = await fetch(
        `/api/admin/affiliates/${affiliateId}/suspend`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: suspendReason }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to suspend affiliate');
      }

      setSuspendReason('');
      await fetchAffiliate();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to suspend');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async (): Promise<void> => {
    setActionLoading(true);
    setActionError(null);
    try {
      const response = await fetch(
        `/api/admin/affiliates/${affiliateId}/reactivate`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to reactivate affiliate');
      }

      await fetchAffiliate();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to reactivate'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleDistributeCodes = async (): Promise<void> => {
    if (!distributeReason) {
      setActionError('Please enter a reason');
      return;
    }

    setActionLoading(true);
    setActionError(null);
    try {
      const response = await fetch(
        `/api/admin/affiliates/${affiliateId}/distribute-codes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            count: distributeCount,
            reason: distributeReason,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to distribute codes');
      }

      setDistributeCount(10);
      setDistributeReason('');
      await fetchAffiliate();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to distribute codes'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (
    amount: number | { toNumber?: () => number }
  ): string => {
    const value =
      typeof amount === 'object' && amount.toNumber
        ? amount.toNumber()
        : Number(amount);
    return `$${value.toFixed(2)}`;
  };

  const formatDate = (date: string | null): string => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'ACTIVE':
      case 'PAID':
        return 'bg-green-500/10 text-green-500 hover:bg-green-500/10';
      case 'PENDING_VERIFICATION':
      case 'PENDING':
        return 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/10';
      case 'SUSPENDED':
        return 'bg-red-500/10 text-red-500 hover:bg-red-500/10';
      case 'USED':
        return 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/10';
      default:
        return 'bg-muted text-muted-foreground hover:bg-muted';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (error || !affiliate) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-500">
          {error || 'Affiliate not found'}
        </div>
        <Link
          href="/admin/affiliates"
          className="inline-block text-sm text-primary hover:underline"
        >
          &larr; Back to Affiliates
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/admin/affiliates"
          className="text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          &larr; Back to Affiliates
        </Link>
        <div className="mt-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
              {affiliate.fullName}
            </h1>
            <p className="text-muted-foreground">{affiliate.user.email}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {affiliate.status === 'ACTIVE' && (
              <>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={actionLoading}>Distribute Codes</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Distribute Bonus Codes
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Generate new affiliate codes for {affiliate.fullName}.
                        This action is logged and cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="distribute-count">
                          Number of Codes
                        </Label>
                        <Input
                          id="distribute-count"
                          type="number"
                          min={1}
                          max={50}
                          value={distributeCount}
                          onChange={(e) =>
                            setDistributeCount(Number(e.target.value))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="distribute-reason">Reason</Label>
                        <Textarea
                          id="distribute-reason"
                          value={distributeReason}
                          onChange={(e) => setDistributeReason(e.target.value)}
                          placeholder="e.g., Performance bonus"
                        />
                      </div>
                      {actionError && (
                        <p className="text-sm text-red-500">{actionError}</p>
                      )}
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setActionError(null)}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        disabled={!distributeReason.trim() || actionLoading}
                        onClick={() => void handleDistributeCodes()}
                      >
                        {actionLoading ? 'Distributing...' : 'Distribute'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={actionLoading}>
                      Suspend
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Suspend Affiliate?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {affiliate.fullName} will lose active affiliate status
                        and their codes will stop earning commissions. This can
                        be reversed via Reactivate.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2">
                      <Label htmlFor="suspend-reason">Suspension Reason</Label>
                      <Textarea
                        id="suspend-reason"
                        value={suspendReason}
                        onChange={(e) => setSuspendReason(e.target.value)}
                        placeholder="e.g., Suspected fraudulent code usage"
                      />
                      {actionError && (
                        <p className="text-sm text-red-500">{actionError}</p>
                      )}
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setActionError(null)}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        disabled={!suspendReason.trim() || actionLoading}
                        onClick={() => void handleSuspend()}
                        className="hover:bg-destructive/90 bg-destructive text-white"
                      >
                        {actionLoading ? 'Suspending...' : 'Suspend'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
            {affiliate.status === 'SUSPENDED' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={actionLoading}>Reactivate</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reactivate Affiliate?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {affiliate.fullName} will regain active affiliate status
                      and their codes will resume earning commissions.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  {actionError && (
                    <p className="text-sm text-red-500">{actionError}</p>
                  )}
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setActionError(null)}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      disabled={actionLoading}
                      onClick={() => void handleReactivate()}
                    >
                      {actionLoading ? 'Reactivating...' : 'Reactivate'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>

      {/* Profile Info */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <Badge className={getStatusBadgeClass(affiliate.status)}>
                    {affiliate.status.replace('_', ' ')}
                  </Badge>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Country</dt>
                <dd className="font-medium text-foreground">
                  {affiliate.country}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Payment Method</dt>
                <dd className="font-medium text-foreground">
                  {affiliate.paymentMethod}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Verified At</dt>
                <dd className="font-medium text-foreground">
                  {formatDate(affiliate.verifiedAt)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Joined</dt>
                <dd className="font-medium text-foreground">
                  {formatDate(affiliate.createdAt)}
                </dd>
              </div>
              {affiliate.suspensionReason && (
                <div className="border-t border-border pt-3">
                  <dt className="text-sm text-red-500">Suspension Reason:</dt>
                  <dd className="font-medium text-red-500">
                    {affiliate.suspensionReason}
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Earnings Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total Earnings</dt>
                <dd className="text-lg font-medium text-foreground">
                  {formatCurrency(affiliate.totalEarnings)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Pending Commissions</dt>
                <dd className="font-medium text-amber-600 dark:text-amber-400">
                  {formatCurrency(affiliate.pendingCommissions)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Paid Commissions</dt>
                <dd className="font-medium text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(affiliate.paidCommissions)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-border pt-3">
                <dt className="text-muted-foreground">Codes Distributed</dt>
                <dd className="font-medium text-foreground">
                  {affiliate.totalCodesDistributed}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Codes Used</dt>
                <dd className="font-medium text-foreground">
                  {affiliate.totalCodesUsed}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Conversion Rate</dt>
                <dd className="font-medium text-foreground">
                  {affiliate.totalCodesDistributed > 0
                    ? (
                        (affiliate.totalCodesUsed /
                          affiliate.totalCodesDistributed) *
                        100
                      ).toFixed(1)
                    : 0}
                  %
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Affiliate Codes */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">
            Affiliate Codes ({affiliate.affiliateCodes.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Code
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground md:table-cell">
                    Reason
                  </th>
                  <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">
                    Distributed
                  </th>
                  <th className="hidden px-4 py-3 text-left font-medium text-muted-foreground lg:table-cell">
                    Expires
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Used
                  </th>
                </tr>
              </thead>
              <tbody>
                {affiliate.affiliateCodes.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No codes distributed yet
                    </td>
                  </tr>
                ) : (
                  affiliate.affiliateCodes.slice(0, 20).map((code) => (
                    <tr
                      key={code.id}
                      className="border-border/50 hover:bg-accent/30 border-b transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-sm text-foreground">
                        {code.code}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={getStatusBadgeClass(code.status)}>
                          {code.status}
                        </Badge>
                      </td>
                      <td className="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">
                        {code.distributionReason}
                      </td>
                      <td className="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell">
                        {formatDate(code.distributedAt)}
                      </td>
                      <td className="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell">
                        {formatDate(code.expiresAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDate(code.usedAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Commissions */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Recent Commissions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Earned
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Paid
                  </th>
                </tr>
              </thead>
              <tbody>
                {affiliate.commissions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      No commissions yet
                    </td>
                  </tr>
                ) : (
                  affiliate.commissions.map((commission) => (
                    <tr
                      key={commission.id}
                      className="border-border/50 hover:bg-accent/30 border-b transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        {formatCurrency(commission.commissionAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={getStatusBadgeClass(commission.status)}
                        >
                          {commission.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDate(commission.earnedAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDate(commission.paidAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
