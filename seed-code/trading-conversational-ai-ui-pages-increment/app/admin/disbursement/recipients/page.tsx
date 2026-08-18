'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  WiseRecipientStatusBadge,
  KycStatusBadge,
  type WiseRecipientStatus,
  type KycStatus,
} from '@/components/disbursement/status-badge';
import { useLocale } from '@/lib/context/locale-context';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SEED DATA
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface WiseRecipient {
  id: string;
  affiliateId: string;
  accountHolder: string;
  country: string;
  currency: string;
  accountTail: string;
  status: WiseRecipientStatus;
  createdAt: string;
}

const WISE_RECIPIENTS: WiseRecipient[] = [
  {
    id: 'wise_recp_98421098',
    affiliateId: 'aff-101',
    accountHolder: 'Alex Morgan',
    country: 'TH',
    currency: 'USD',
    accountTail: '4912',
    status: 'ACTIVE',
    createdAt: '2026-05-02T00:00:00Z',
  },
  {
    id: 'wise_recp_33190812',
    affiliateId: 'aff-102',
    accountHolder: 'Marcus Vance',
    country: 'DE',
    currency: 'EUR',
    accountTail: '1109',
    status: 'ACTIVE',
    createdAt: '2026-05-14T00:00:00Z',
  },
  {
    id: 'wise_recp_10029918',
    affiliateId: 'aff-104',
    accountHolder: 'Priya Nair',
    country: 'SG',
    currency: 'USD',
    accountTail: '7723',
    status: 'PENDING_DETAILS',
    createdAt: '2026-08-01T00:00:00Z',
  },
  {
    id: 'wise_recp_88213410',
    affiliateId: 'aff-105',
    accountHolder: 'Sofia Reyes',
    country: 'MX',
    currency: 'USD',
    accountTail: '2201',
    status: 'INVALID',
    createdAt: '2026-08-05T00:00:00Z',
  },
];

interface RiseWorksAccount {
  id: string;
  affiliateId: string;
  email: string;
  riseId: string;
  kycStatus: KycStatus;
  invitationAccepted: boolean;
  invitationSent: boolean;
  lastSyncAt: string | null;
  createdAt: string;
}

const RISEWORKS_ACCOUNTS: RiseWorksAccount[] = [
  {
    id: 'rise-1',
    affiliateId: 'aff-103',
    email: 'elena@quantumforex.ru',
    riseId: 'rise_elena_rostova_77182901',
    kycStatus: 'SUBMITTED',
    invitationAccepted: true,
    invitationSent: true,
    lastSyncAt: '2026-04-11T00:00:00Z',
    createdAt: '2026-03-20T00:00:00Z',
  },
  {
    id: 'rise-2',
    affiliateId: 'aff-101',
    email: 'alex.trader@gmail.com',
    riseId: 'rise_alex_morgan_101228812',
    kycStatus: 'EXPIRED',
    invitationAccepted: true,
    invitationSent: true,
    lastSyncAt: null,
    createdAt: '2026-02-05T00:00:00Z',
  },
];

const STATUS_FILTERS: Array<WiseRecipientStatus | 'ALL'> = [
  'ALL',
  'DRAFT',
  'PENDING_DETAILS',
  'ACTIVE',
  'INVALID',
  'ARCHIVED',
];

type ActiveTab = 'wise' | 'riseworks';

export default function AdminDisbursementRecipientsPage() {
  const { t, formatDate } = useLocale();
  const [tab, setTab] = useState<ActiveTab>('wise');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<WiseRecipientStatus | 'ALL'>(
    'ALL'
  );

  const query = search.trim().toLowerCase();
  const filteredWise = WISE_RECIPIENTS.filter((r) => {
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    const matchesQuery =
      !query ||
      r.accountHolder.toLowerCase().includes(query) ||
      r.id.toLowerCase().includes(query);
    return matchesStatus && matchesQuery;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 sm:text-3xl">
          {t('Disbursement Accounts')}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {t(
            'Affiliate payout accounts — active Wise recipients and historical RiseWorks records. View only, never raw bank details.'
          )}
        </p>
      </div>

      <div className="flex gap-2 border-b border-slate-800">
        <button
          type="button"
          onClick={() => setTab('wise')}
          className={`px-4 py-2 text-xs font-bold transition-colors ${
            tab === 'wise'
              ? 'border-b-2 border-amber-500 text-amber-300'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t('Wise Recipients')}
        </button>
        <button
          type="button"
          onClick={() => setTab('riseworks')}
          className={`px-4 py-2 text-xs font-bold transition-colors ${
            tab === 'riseworks'
              ? 'border-b-2 border-amber-500 text-amber-300'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t('RiseWorks (Historical)')}
        </button>
      </div>

      {tab === 'wise' ? (
        <Card className="border-slate-800/80 bg-[#090c14]">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-sm text-slate-100">
                  {t('Wise Recipients')}
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {filteredWise.length} {t('total')} —{' '}
                  {t('view only, never raw bank details')}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="absolute top-2.5 left-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder={t('Search recipient or partner...')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 w-48 border-slate-800 bg-[#06080e] pl-8 text-xs text-slate-200"
                  />
                </div>
                <Select
                  value={statusFilter}
                  onValueChange={(v) =>
                    setStatusFilter(v as WiseRecipientStatus | 'ALL')
                  }
                >
                  <SelectTrigger className="h-8 w-40 border-slate-800 bg-[#06080e] text-xs text-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_FILTERS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s === 'ALL'
                          ? t('All statuses')
                          : t(s.replace('_', ' '))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          {filteredWise.length > 0 ? (
            <Table>
              <TableHeader className="bg-[#06080e]">
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-xs font-bold text-slate-300">
                    {t('Affiliate ID')}
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-300">
                    {t('Account Holder')}
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-300">
                    {t('Country')}
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-300">
                    {t('Currency')}
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-300">
                    {t('Account')}
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-300">
                    {t('Status')}
                  </TableHead>
                  <TableHead className="text-right text-xs font-bold text-slate-300">
                    {t('Created')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWise.map((r) => (
                  <TableRow
                    key={r.id}
                    className="border-slate-800/60 hover:bg-slate-800/30"
                  >
                    <TableCell className="font-mono text-xs text-slate-400">
                      {r.affiliateId}
                    </TableCell>
                    <TableCell className="text-xs font-bold text-slate-200">
                      {r.accountHolder}
                    </TableCell>
                    <TableCell className="text-xs text-slate-300">
                      {r.country}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-bold text-amber-400">
                      {r.currency}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-300">
                      •••• {r.accountTail}
                    </TableCell>
                    <TableCell>
                      <WiseRecipientStatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-right text-xs text-slate-400">
                      {formatDate(r.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <CardContent className="py-8 text-center text-xs text-slate-400">
              {t('No Wise recipients found.')}
            </CardContent>
          )}
        </Card>
      ) : (
        <Card className="border-slate-800/80 bg-[#090c14]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-slate-100">
              {t('RiseWorks Accounts')}
              <Badge className="border-slate-600/40 bg-slate-600/15 text-[10px] text-slate-300">
                {t('Historical')}
              </Badge>
            </CardTitle>
            <CardDescription className="text-slate-400">
              {t(
                'RiseWorks is archived — this tab is a read-only historical record. No sync or create actions are available.'
              )}
            </CardDescription>
          </CardHeader>
          {RISEWORKS_ACCOUNTS.length > 0 ? (
            <Table>
              <TableHeader className="bg-[#06080e]">
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-xs font-bold text-slate-300">
                    {t('Email')}
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-300">
                    {t('Rise ID')}
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-300">
                    {t('KYC Status')}
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-300">
                    {t('Invitation')}
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-300">
                    {t('Last Sync')}
                  </TableHead>
                  <TableHead className="text-right text-xs font-bold text-slate-300">
                    {t('Created')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {RISEWORKS_ACCOUNTS.map((account) => (
                  <TableRow
                    key={account.id}
                    className="border-slate-800/60 hover:bg-slate-800/30"
                  >
                    <TableCell className="text-xs text-slate-200">
                      {account.email}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-400">
                      {account.riseId.slice(0, 10)}...
                      {account.riseId.slice(-6)}
                    </TableCell>
                    <TableCell>
                      <KycStatusBadge status={account.kycStatus} />
                    </TableCell>
                    <TableCell>
                      {account.invitationAccepted ? (
                        <Badge className="border-emerald-500/40 bg-emerald-500/15 text-[9px] text-emerald-300">
                          {t('Accepted')}
                        </Badge>
                      ) : account.invitationSent ? (
                        <Badge className="border-amber-500/40 bg-amber-500/15 text-[9px] text-amber-300">
                          {t('Sent')}
                        </Badge>
                      ) : (
                        <Badge className="border-slate-600/40 bg-slate-600/15 text-[9px] text-slate-400">
                          {t('Not Sent')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">
                      {account.lastSyncAt
                        ? formatDate(account.lastSyncAt)
                        : t('Never')}
                    </TableCell>
                    <TableCell className="text-right text-xs text-slate-400">
                      {formatDate(account.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <CardContent className="py-8 text-center text-xs text-slate-400">
              {t('No historical RiseWorks accounts found.')}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
