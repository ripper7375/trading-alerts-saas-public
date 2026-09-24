/**
 * Admin — View as Affiliate (read-only)
 *
 * Search every affiliate by name, email or promo code, then open that
 * affiliate's own dashboard exactly as they see it, read-only. Starting a
 * view sets a two-hour cookie via POST /api/admin/affiliates/view-as; the
 * affiliate dashboard then shows a banner with Switch / Exit.
 *
 * Admin-gated by app/admin/layout.tsx; the API re-checks the role itself.
 *
 * @module app/admin/affiliates/view-as/page
 */

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Eye, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useLocale } from '@/lib/context/locale-context';

interface ViewAsCandidate {
  profileId: string;
  fullName: string;
  email: string | null;
  country: string;
  status: string;
  createdAt: string;
  totalEarnings: number;
  pendingCommissions: number;
  totalCodesUsed: number;
  activeCode: string | null;
}

interface SearchResponse {
  affiliates: ViewAsCandidate[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const STATUS_OPTIONS = [
  { value: '', labelKey: 'admin.view_as.status_all', fallback: 'All statuses' },
  {
    value: 'ACTIVE',
    labelKey: 'admin.view_as.status_active',
    fallback: 'Active',
  },
  {
    value: 'PENDING_VERIFICATION',
    labelKey: 'admin.view_as.status_pending',
    fallback: 'Pending verification',
  },
  {
    value: 'SUSPENDED',
    labelKey: 'admin.view_as.status_suspended',
    fallback: 'Suspended',
  },
  {
    value: 'INACTIVE',
    labelKey: 'admin.view_as.status_inactive',
    fallback: 'Inactive',
  },
] as const;

const STATUS_STYLES: Record<string, string> = {
  ACTIVE:
    'border-green-500/30 bg-green-500/15 text-green-700 dark:text-green-400',
  PENDING_VERIFICATION:
    'border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300',
  SUSPENDED: 'border-red-500/30 bg-red-500/15 text-red-700 dark:text-red-400',
  INACTIVE: 'border-border bg-muted text-muted-foreground',
};

const PAGE_SIZE = 20;

export default function AdminViewAsAffiliatePage(): React.ReactElement {
  const { t, formatCurrency, formatDate } = useLocale();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openingId, setOpeningId] = useState<string | null>(null);

  // Debounce typing so every keystroke is not a request.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchAffiliates = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (search) params.set('search', search);
      if (status) params.set('status', status);

      const response = await fetch(
        `/api/admin/affiliates/view-as?${params.toString()}`,
        { cache: 'no-store' }
      );
      if (!response.ok) {
        throw new Error(
          t('admin.view_as.error_load', 'Failed to load affiliates')
        );
      }
      setData((await response.json()) as SearchResponse);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('admin.view_as.error_load', 'Failed to load affiliates')
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, status]);

  useEffect(() => {
    void fetchAffiliates();
  }, [fetchAffiliates]);

  const openDashboard = async (profileId: string): Promise<void> => {
    setOpeningId(profileId);
    setError('');
    try {
      const response = await fetch('/api/admin/affiliates/view-as', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId }),
      });
      const body = (await response.json().catch(() => null)) as {
        redirectTo?: string;
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(
          body?.error ||
            t('admin.view_as.error_open', 'Could not open this dashboard')
        );
      }
      // Full navigation so the dashboard layout reads the new cookie.
      window.location.assign(body?.redirectTo ?? '/affiliate/dashboard');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('admin.view_as.error_open', 'Could not open this dashboard')
      );
      setOpeningId(null);
    }
  };

  const affiliates = data?.affiliates ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          {t('admin.view_as.title', 'View as Affiliate')}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {t(
            'admin.view_as.subtitle',
            "Open any affiliate's dashboard exactly as they see it. Read-only: nothing can be changed, and payout settings are not shown."
          )}
        </p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">
            {t('admin.view_as.find_title', 'Find an affiliate')}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {t(
              'admin.view_as.find_desc',
              'Search by name, email or promo code.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t(
                'admin.view_as.search_placeholder',
                'Name, email or code'
              )}
              aria-label={t(
                'admin.view_as.search_placeholder',
                'Name, email or code'
              )}
              className="pl-9"
            />
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            aria-label={t('admin.view_as.status_filter', 'Status')}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey, option.fallback)}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex min-h-32 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-amber-500" />
        </div>
      ) : affiliates.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="py-10 text-center text-muted-foreground">
            {t('admin.view_as.no_results', 'No affiliates match this search.')}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3" aria-busy={loading}>
          {affiliates.map((affiliate) => (
            <li key={affiliate.profileId}>
              <Card className="border-border bg-card">
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold text-foreground">
                        {affiliate.fullName}
                      </span>
                      <Badge
                        className={`border text-[10px] ${
                          STATUS_STYLES[affiliate.status] ??
                          STATUS_STYLES['INACTIVE']
                        }`}
                      >
                        {t(
                          STATUS_OPTIONS.find(
                            (o) => o.value === affiliate.status
                          )?.labelKey ?? '',
                          affiliate.status
                        )}
                      </Badge>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {affiliate.email ??
                        t('admin.view_as.no_email', 'No email on record')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[
                        affiliate.activeCode
                          ? `${t('admin.view_as.code', 'Code')}: ${affiliate.activeCode}`
                          : null,
                        affiliate.country,
                        `${t('admin.view_as.earned', 'Earned')}: ${formatCurrency(
                          affiliate.totalEarnings
                        )}`,
                        `${t('admin.view_as.codes_used', 'Codes used')}: ${affiliate.totalCodesUsed}`,
                        `${t('admin.view_as.joined', 'Joined')}: ${formatDate(
                          affiliate.createdAt
                        )}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <Button
                    onClick={() => void openDashboard(affiliate.profileId)}
                    disabled={openingId !== null}
                    className="shrink-0"
                  >
                    <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
                    {openingId === affiliate.profileId
                      ? t('admin.view_as.opening', 'Opening...')
                      : t('admin.view_as.view_dashboard', 'View dashboard')}
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {t('admin.view_as.page_of', 'Page {page} of {total}')
              .replace('{page}', String(pagination.page))
              .replace('{total}', String(pagination.totalPages))}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t('Previous', 'Previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('Next', 'Next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
