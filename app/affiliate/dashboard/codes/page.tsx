/**
 * Affiliate Codes Page
 *
 * Displays all affiliate codes with filtering and pagination.
 * Shows code status, distribution, and usage information.
 *
 * @module app/affiliate/dashboard/codes/page
 */

'use client';

import React, { useEffect, useState } from 'react';

import { CodeTable } from '@/components/affiliate/code-table';
import { useLocale } from '@/lib/context/locale-context';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPE DEFINITIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type CodeStatus = 'ACTIVE' | 'USED' | 'EXPIRED' | 'CANCELLED';

interface AffiliateCode {
  id: string;
  code: string;
  status: CodeStatus;
  distributedAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
}

interface CodesResponse {
  codes: AffiliateCode[];
  total: number;
  page: number;
  limit: number;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Affiliate Codes Page
 * Lists all affiliate codes with filtering
 */
export default function AffiliateCodesPage(): React.ReactElement {
  const { t } = useLocale();
  const [codes, setCodes] = useState<AffiliateCode[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<CodeStatus | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const limit = 20;

  useEffect(() => {
    const fetchCodes = async (): Promise<void> => {
      setLoading(true);
      setError('');

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });

        if (statusFilter !== 'ALL') {
          params.set('status', statusFilter);
        }

        const response = await fetch(
          `/api/affiliate/dashboard/codes?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error(
            t('affiliate.codes.error_load_codes', 'Failed to load codes')
          );
        }

        const data: CodesResponse = await response.json();
        setCodes(data.codes);
        setTotal(data.total);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t('affiliate.codes.error_load_codes', 'Failed to load codes')
        );
      } finally {
        setLoading(false);
      }
    };

    fetchCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t('affiliate.codes.my_codes', 'My Codes')}
          </h1>
          <p className="text-muted-foreground">
            {t(
              'affiliate.codes.manage_codes_subtitle',
              'Manage your affiliate codes'
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label
              htmlFor="statusFilter"
              className="mb-1 block text-sm font-medium text-foreground"
            >
              {t('affiliate.codes.status', 'Status')}
            </label>
            <select
              id="statusFilter"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as CodeStatus | 'ALL');
                setPage(1);
              }}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="ALL">
                {t('affiliate.codes.all_codes', 'All Codes')}
              </option>
              <option value="ACTIVE">
                {t('affiliate.codes.status_active', 'Active')}
              </option>
              <option value="USED">
                {t('affiliate.codes.status_used', 'Used')}
              </option>
              <option value="EXPIRED">
                {t('affiliate.codes.status_expired', 'Expired')}
              </option>
              <option value="CANCELLED">
                {t('affiliate.codes.status_cancelled', 'Cancelled')}
              </option>
            </select>
          </div>

          <div className="ml-auto text-sm text-muted-foreground">
            {t(
              'affiliate.codes.showing_x_of_y_codes',
              'Showing {shown} of {total} codes'
            )
              .replace('{shown}', String(codes.length))
              .replace('{total}', String(total))}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Codes Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-amber-500" />
          </div>
        ) : (
          <CodeTable codes={codes} />
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('admin.users.previous', 'Previous')}
          </button>

          <span className="text-sm text-muted-foreground">
            {t('affiliate.codes.page_x_of_y', 'Page {page} of {totalPages}')
              .replace('{page}', String(page))
              .replace('{totalPages}', String(totalPages))}
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('admin.users.next', 'Next')}
          </button>
        </div>
      )}

      {/* Info Section */}
      <div className="bg-muted/40 rounded-lg border border-border p-6">
        <h3 className="mb-3 font-semibold text-foreground">
          {t('affiliate.codes.status_guide', 'Code Status Guide')}
        </h3>
        <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-2">
            <span className="rounded border border-green-500/30 bg-green-500/15 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-400">
              {t('affiliate.codes.status_active', 'Active').toUpperCase()}
            </span>
            <span className="text-muted-foreground">
              {t('affiliate.codes.guide_active', 'Ready to share')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded border border-amber-500/30 bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
              {t('affiliate.codes.status_used', 'Used').toUpperCase()}
            </span>
            <span className="text-muted-foreground">
              {t('affiliate.codes.guide_used', 'Successfully redeemed')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded border border-border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
              {t('affiliate.codes.status_expired', 'Expired').toUpperCase()}
            </span>
            <span className="text-muted-foreground">
              {t('affiliate.codes.guide_expired', 'Past expiration date')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded border border-red-500/30 bg-red-500/15 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-400">
              {t('affiliate.codes.status_cancelled', 'Cancelled').toUpperCase()}
            </span>
            <span className="text-muted-foreground">
              {t('affiliate.codes.guide_cancelled', 'Manually cancelled')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
