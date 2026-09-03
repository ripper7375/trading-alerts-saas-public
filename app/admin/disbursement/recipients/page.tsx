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
import type { RiseWorksKycStatus } from '@/types/disbursement';
import { useLocale } from '@/lib/context/locale-context';

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

type ActiveTab = 'wise' | 'riseworks';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES (historical RiseWorks tab)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface RiseWorksAccount {
  id: string;
  affiliateProfileId: string;
  riseId: string;
  email: string;
  kycStatus: RiseWorksKycStatus;
  invitationSentAt: string | null;
  invitationAcceptedAt: string | null;
  lastSyncAt: string | null;
  createdAt: string;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getStatusBadge(status: WiseRecipientStatus): React.ReactElement {
  const config: Record<WiseRecipientStatus, string> = {
    DRAFT: 'bg-muted text-muted-foreground',
    PENDING_DETAILS: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    ACTIVE: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    INVALID: 'bg-red-500/10 text-red-600 dark:text-red-400',
    ARCHIVED: 'bg-muted text-muted-foreground',
  };

  return <Badge className={`${config[status]} text-xs`}>{status}</Badge>;
}

function getKycStatusBadge(status: RiseWorksKycStatus): React.ReactElement {
  const config: Record<RiseWorksKycStatus, string> = {
    APPROVED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    PENDING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    SUBMITTED: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    REJECTED: 'bg-red-500/10 text-red-600 dark:text-red-400',
    EXPIRED: 'bg-muted text-muted-foreground',
  };

  return <Badge className={`${config[status]} text-xs`}>{status}</Badge>;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WISE RECIPIENTS TAB
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function WiseRecipientsTab(): React.ReactElement {
  const { t } = useLocale();
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
        throw new Error(
          t(
            'admin.disbursement.error_load_recipients',
            'Failed to load recipients'
          )
        );
      }
      const body: WiseRecipientsAdminList = await res.json();
      setData(body);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t(
              'admin.disbursement.error_load_recipients',
              'Failed to load recipients'
            )
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  useEffect(() => {
    void fetchRecipients();
  }, [fetchRecipients]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-foreground">
              {t('admin.disbursement.wise_recipients', 'Wise Recipients')}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {data
                ? t('admin.disbursement.n_total', '{n} total').replace(
                    '{n}',
                    String(data.total)
                  )
                : '—'}{' '}
              —{' '}
              {t(
                'admin.disbursement.view_only_never_raw',
                'view only, never raw bank details'
              )}
            </CardDescription>
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as WiseRecipientStatus | 'ALL');
              setPage(1);
            }}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s === 'ALL'
                  ? t('admin.disbursement.all_statuses_lower', 'All statuses')
                  : s}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-green-500" />
          </div>
        )}

        {!loading && error && <p className="py-8 text-red-400">{error}</p>}

        {!loading && !error && data && data.items.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">
            {t(
              'admin.disbursement.no_wise_recipients',
              'No Wise recipients yet.'
            )}
          </p>
        )}

        {!loading && !error && data && data.items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">
                    {t('admin.disbursement.affiliate_id', 'Affiliate ID')}
                  </th>
                  <th className="pb-2 pr-4 font-medium">
                    {t('admin.disbursement.account_holder', 'Account Holder')}
                  </th>
                  <th className="pb-2 pr-4 font-medium">
                    {t('admin.affiliates.country', 'Country')}
                  </th>
                  <th className="pb-2 pr-4 font-medium">
                    {t('admin.disbursement.currency', 'Currency')}
                  </th>
                  <th className="pb-2 pr-4 font-medium">
                    {t('admin.disbursement.account', 'Account')}
                  </th>
                  <th className="pb-2 pr-4 font-medium">
                    {t('admin.users.status', 'Status')}
                  </th>
                  <th className="pb-2 font-medium">
                    {t('admin.users.created', 'Created')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr
                    key={r.id}
                    className="border-border/50 border-b text-foreground"
                  >
                    <td className="py-3 pr-4 font-mono text-xs text-muted-foreground">
                      {r.affiliateProfileId.slice(0, 8)}…
                    </td>
                    <td className="py-3 pr-4">{r.accountHolderName}</td>
                    <td className="py-3 pr-4">{r.recipientCountry}</td>
                    <td className="py-3 pr-4">{r.targetCurrency}</td>
                    <td className="py-3 pr-4 font-mono text-xs">
                      {r.accountTail
                        ? `•••• ${r.accountTail}`
                        : t('admin.errors.not_available', 'N/A')}
                    </td>
                    <td className="py-3 pr-4">{getStatusBadge(r.status)}</td>
                    <td className="py-3 text-muted-foreground">
                      {formatDate(r.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && data && data.total > 0 && (
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <Button
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="border-border text-foreground hover:bg-accent"
            >
              {t('admin.users.previous', 'Previous')}
            </Button>
            <span className="text-sm text-muted-foreground">
              {t('admin.users.page_of_total', 'Page {page} of {totalPages}')
                .replace('{page}', String(page))
                .replace('{totalPages}', String(totalPages))}
            </span>
            <Button
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="border-border text-foreground hover:bg-accent"
            >
              {t('admin.users.next', 'Next')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RISEWORKS HISTORICAL TAB (read-only, archived per F42)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function RiseWorksHistoricalTab(): React.ReactElement {
  const { t } = useLocale();
  const [accounts, setAccounts] = useState<RiseWorksAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/disbursement/riseworks/accounts');
        if (!res.ok) {
          const body = await res.json();
          throw new Error(
            body.error ||
              t(
                'admin.disbursement.error_load_riseworks',
                'Failed to load RiseWorks accounts'
              )
          );
        }
        const body = await res.json();
        if (!cancelled) setAccounts(body.accounts || []);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : t(
                  'admin.disbursement.error_load_accounts',
                  'Failed to load accounts'
                )
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          {t('admin.disbursement.riseworks_accounts', 'RiseWorks Accounts')}
          <Badge className="bg-muted text-xs text-muted-foreground">
            {t('admin.disbursement.historical', 'Historical')}
          </Badge>
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          {t(
            'admin.disbursement.riseworks_archived_notice',
            'RiseWorks is archived (F42) — this tab is a read-only historical record. No sync or create actions are available; the RiseWorks backend routes stay archived.'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-green-500" />
          </div>
        )}

        {!loading && error && <p className="px-6 py-8 text-red-400">{error}</p>}

        {!loading && !error && accounts.length === 0 && (
          <p className="px-6 py-8 text-center text-muted-foreground">
            {t(
              'admin.disbursement.no_historical_riseworks',
              'No historical RiseWorks accounts found.'
            )}
          </p>
        )}

        {!loading && !error && accounts.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t('admin.disbursement.email', 'Email')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t('admin.disbursement.rise_id', 'Rise ID')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t('admin.disbursement.kyc_status', 'KYC Status')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t('admin.disbursement.invitation', 'Invitation')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t('admin.disbursement.last_sync', 'Last Sync')}
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t('admin.users.created', 'Created')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr
                    key={account.id}
                    className="border-border/50 hover:bg-accent/30 border-b"
                  >
                    <td className="px-4 py-3">
                      <span className="text-foreground">{account.email}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-muted-foreground">
                        {account.riseId.slice(0, 10)}...
                        {account.riseId.slice(-6)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {getKycStatusBadge(account.kycStatus)}
                    </td>
                    <td className="px-4 py-3">
                      {account.invitationAcceptedAt ? (
                        <Badge className="bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400">
                          {t('admin.disbursement.accepted', 'Accepted')}
                        </Badge>
                      ) : account.invitationSentAt ? (
                        <Badge className="bg-amber-500/10 text-xs text-amber-600 dark:text-amber-400">
                          {t('admin.disbursement.sent', 'Sent')}
                        </Badge>
                      ) : (
                        <Badge className="bg-muted text-xs text-muted-foreground">
                          {t('admin.disbursement.not_sent', 'Not Sent')}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {account.lastSyncAt
                        ? formatDate(account.lastSyncAt)
                        : t('admin.users.never', 'Never')}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(account.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN DISBURSEMENT ACCOUNTS PAGE (Wise + RiseWorks historical)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Admin Disbursement Accounts Page — Client Component
 * (Session 4A-W3b, File 3/5; rebuilt Session 6-6, A1-6)
 *
 * Two tabs: live Wise recipients (`GET /api/wise/recipients`, admin
 * read-only per F39) and a read-only historical RiseWorks tab (`GET
 * /api/disbursement/riseworks/accounts`) — RiseWorks stays archived (F42),
 * this tab has no create/sync actions, matching the old
 * `/admin/disbursement/accounts` page's data with its write actions removed.
 * `/admin/disbursement/accounts` now redirects here.
 */
export default function AdminDisbursementAccountsPage(): React.ReactElement {
  const { t } = useLocale();
  const [tab, setTab] = useState<ActiveTab>('wise');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          {t('admin.disbursement.accounts_title', 'Disbursement Accounts')}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {t(
            'admin.disbursement.accounts_subtitle',
            'Affiliate payout accounts — active Wise recipients and historical RiseWorks records'
          )}
        </p>
      </div>

      <div className="flex gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setTab('wise')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'wise'
              ? 'border-b-2 border-green-500 text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('admin.disbursement.tab_wise_recipients', '🏦 Wise Recipients')}
        </button>
        <button
          type="button"
          onClick={() => setTab('riseworks')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'riseworks'
              ? 'border-b-2 border-green-500 text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t(
            'admin.disbursement.tab_riseworks_historical',
            '🔗 RiseWorks (Historical)'
          )}
        </button>
      </div>

      {tab === 'wise' ? <WiseRecipientsTab /> : <RiseWorksHistoricalTab />}
    </div>
  );
}
