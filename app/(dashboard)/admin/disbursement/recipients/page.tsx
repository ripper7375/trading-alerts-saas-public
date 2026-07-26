'use client';

import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import type {
  WiseRecipientStatus,
  WiseRecipientsAdminList,
} from '@/lib/money-service/wise-types';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PAGE_SIZE = 25;

const STATUS_FILTERS: Array<WiseRecipientStatus | 'ALL'> = [
  'ALL',
  'DRAFT',
  'PENDING_DETAILS',
  'ACTIVE',
  'INVALID',
  'ARCHIVED',
];

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getStatusBadge(status: WiseRecipientStatus): React.ReactElement {
  const config: Record<WiseRecipientStatus, string> = {
    DRAFT: 'bg-gray-600',
    PENDING_DETAILS: 'bg-yellow-600',
    ACTIVE: 'bg-green-600',
    INVALID: 'bg-red-600',
    ARCHIVED: 'bg-gray-700',
  };

  return (
    <Badge className={`${config[status]} text-xs text-white`}>{status}</Badge>
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN WISE RECIPIENTS PAGE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Admin Wise Recipients Page — Client Component (Session 4A-W3b, File 3/5)
 *
 * Read-only per F39 (affiliate self-service) — no create/edit/deactivate
 * action here, only `accountTail` (never raw bank details). Revalidate
 * lives on the affiliate's own payout settings page instead — the live
 * backend endpoint is AffiliateGuard-scoped self-service (confirmed with
 * Davin live while building File 1).
 *
 * Data fetching: GET /api/wise/recipients (admin, paginated).
 */
export default function AdminWiseRecipientsPage(): React.ReactElement {
  const [data, setData] = useState<WiseRecipientsAdminList | null>(null);
  const [status, setStatus] = useState<WiseRecipientStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecipients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (status !== 'ALL') params.set('status', status);

      const res = await fetch(`/api/wise/recipients?${params}`);
      if (!res.ok) {
        throw new Error('Failed to load recipients');
      }
      const body: WiseRecipientsAdminList = await res.json();
      setData(body);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load recipients'
      );
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    void fetchRecipients();
  }, [fetchRecipients]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            Wise Recipients
          </h1>
          <p className="mt-1 text-gray-400">
            Affiliate payout bank details — view only, never raw details
          </p>
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as WiseRecipientStatus | 'ALL');
            setPage(1);
          }}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s === 'ALL' ? 'All statuses' : s}
            </option>
          ))}
        </select>
      </div>

      <Card className="border-gray-700 bg-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Recipients</CardTitle>
          <CardDescription className="text-gray-400">
            {data ? `${data.total} total` : '—'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-green-500" />
            </div>
          )}

          {!loading && error && <p className="py-8 text-red-400">{error}</p>}

          {!loading && !error && data && data.items.length === 0 && (
            <p className="py-8 text-center text-gray-400">
              No Wise recipients yet.
            </p>
          )}

          {!loading && !error && data && data.items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-left text-gray-400">
                    <th className="pb-2 pr-4 font-medium">Affiliate ID</th>
                    <th className="pb-2 pr-4 font-medium">Account Holder</th>
                    <th className="pb-2 pr-4 font-medium">Country</th>
                    <th className="pb-2 pr-4 font-medium">Currency</th>
                    <th className="pb-2 pr-4 font-medium">Account</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-gray-700/50 text-gray-200"
                    >
                      <td className="py-3 pr-4 font-mono text-xs text-gray-400">
                        {r.affiliateProfileId.slice(0, 8)}…
                      </td>
                      <td className="py-3 pr-4">{r.accountHolderName}</td>
                      <td className="py-3 pr-4">{r.recipientCountry}</td>
                      <td className="py-3 pr-4">{r.targetCurrency}</td>
                      <td className="py-3 pr-4 font-mono text-xs">
                        {r.accountTail ? `•••• ${r.accountTail}` : 'N/A'}
                      </td>
                      <td className="py-3 pr-4">{getStatusBadge(r.status)}</td>
                      <td className="py-3 text-gray-400">
                        {formatDate(r.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !error && data && data.total > 0 && (
            <div className="mt-4 flex items-center justify-between border-t border-gray-700 pt-4">
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="border-gray-700 text-gray-300 hover:bg-gray-700"
              >
                Previous
              </Button>
              <span className="text-sm text-gray-400">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="border-gray-700 text-gray-300 hover:bg-gray-700"
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
