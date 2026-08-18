'use client';

import React, { useState } from 'react';
import { Copy, Check, Info, Search } from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { AffiliateNav } from '@/components/affiliate/affiliate-nav';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useLocale } from '@/lib/context/locale-context';

// Mirrors the backend `AffiliateCode` model (prisma/non-market-data/schema.prisma).
// Codes are single-use discount codes, auto-generated (8-char random) and
// distributed to the affiliate -- never authored or named by the affiliate.
// Distribution happens 3 ways, all outside the affiliate's control:
//   INITIAL     -- one-time welcome batch when the affiliate is approved
//   MONTHLY     -- recurring monthly batch (cron)
//   ADMIN_BONUS -- ad-hoc batch an admin allocates manually
type CodeStatus = 'ACTIVE' | 'USED' | 'EXPIRED' | 'CANCELLED';
type DistributionReason = 'INITIAL' | 'MONTHLY' | 'ADMIN_BONUS';

interface AffiliateCode {
  id: string;
  code: string;
  discountPercent: number;
  status: CodeStatus;
  distributionReason: DistributionReason;
  distributedAt: string;
  expiresAt: string;
  usedAt: string | null;
}

type StatusFilter = 'ALL' | CodeStatus;

const REASON_LABEL: Record<DistributionReason, string> = {
  INITIAL: 'Welcome Batch',
  MONTHLY: 'Monthly Allocation',
  ADMIN_BONUS: 'Admin Bonus',
};

const STATUS_BADGE_CLASS: Record<CodeStatus, string> = {
  ACTIVE: 'border-emerald-500/40 bg-emerald-500/20 text-emerald-400',
  USED: 'border-blue-500/40 bg-blue-500/20 text-blue-400',
  EXPIRED: 'border-slate-700 bg-slate-800 text-slate-400',
  CANCELLED: 'border-rose-500/40 bg-rose-500/20 text-rose-400',
};

// Seed data shaped exactly like a GET /api/affiliate/dashboard/codes response --
// codes are random-looking (crypto-generated), not vanity/brand names, since
// the affiliate never chooses the text.
const MOCK_CODES: AffiliateCode[] = [
  {
    id: 'code-1',
    code: '7F3A9B2C',
    discountPercent: 20,
    status: 'ACTIVE',
    distributionReason: 'MONTHLY',
    distributedAt: '2026-08-01',
    expiresAt: '2026-08-31',
    usedAt: null,
  },
  {
    id: 'code-2',
    code: 'D91C4E08',
    discountPercent: 20,
    status: 'ACTIVE',
    distributionReason: 'MONTHLY',
    distributedAt: '2026-08-01',
    expiresAt: '2026-08-31',
    usedAt: null,
  },
  {
    id: 'code-3',
    code: 'A2E77F14',
    discountPercent: 20,
    status: 'USED',
    distributionReason: 'ADMIN_BONUS',
    distributedAt: '2026-07-12',
    expiresAt: '2026-07-31',
    usedAt: '2026-07-18',
  },
  {
    id: 'code-4',
    code: '5B0D3A6C',
    discountPercent: 20,
    status: 'EXPIRED',
    distributionReason: 'INITIAL',
    distributedAt: '2026-06-01',
    expiresAt: '2026-06-30',
    usedAt: null,
  },
  {
    id: 'code-5',
    code: 'C4F821D9',
    discountPercent: 20,
    status: 'CANCELLED',
    distributionReason: 'MONTHLY',
    distributedAt: '2026-06-01',
    expiresAt: '2026-06-30',
    usedAt: null,
  },
];

const formatDate = (date: string | null): string => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export default function AffiliateCodesPage() {
  const { t } = useLocale();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const codes = MOCK_CODES;

  // Matches app/checkout/page.tsx's real `?ref=` deep-link handling, which
  // pre-fills the discount code field on load -- this is a genuine backend
  // mechanism, not a fabricated tracking link.
  const handleCopy = (code: string) => {
    const link = `${window.location.origin}/checkout?ref=${code}`;
    navigator.clipboard.writeText(link);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filtered = codes
    .filter((c) => c.code.toLowerCase().includes(search.toLowerCase()))
    .filter((c) => statusFilter === 'ALL' || c.status === statusFilter);

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#06070a] text-slate-100 select-none">
      <AppHeader
        title={t('My Promo Codes')}
        subtitle={t(
          'View and share the discount codes DavinTrade has issued to you'
        )}
      />

      <AffiliateNav />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        {/* Top Action Bar */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative max-w-xs">
              <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder={t('Search promo code...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 border-slate-800 bg-[#090b14] pl-9 text-xs text-slate-200"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="h-9 rounded-md border border-slate-800 bg-[#090b14] px-3 text-xs text-slate-200"
            >
              <option value="ALL">{t('All Codes')}</option>
              <option value="ACTIVE">{t('Active')}</option>
              <option value="USED">{t('Used')}</option>
              <option value="EXPIRED">{t('Expired')}</option>
              <option value="CANCELLED">{t('Cancelled')}</option>
            </select>
            <span className="text-xs text-slate-500">
              {t('Showing')} {filtered.length} {t('of')} {codes.length}{' '}
              {t('codes')}
            </span>
          </div>
        </div>

        {/* Issuance Notice -- codes are never self-created by the affiliate */}
        <div className="flex items-start gap-2.5 rounded-xl border border-slate-800 bg-[#090b14]/80 px-4 py-3 text-xs text-slate-400">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <span>
            {t(
              'Codes are issued automatically (welcome batch, monthly allocation) or allocated manually by the DavinTrade team -- affiliates cannot create or name their own codes. Share the code or its checkout link with your audience to earn commission.'
            )}
          </span>
        </div>

        {/* Table */}
        <Card className="overflow-hidden border-slate-800/80 bg-[#090b14]/90 backdrop-blur-xl">
          <Table>
            <TableHeader className="bg-[#06080e]">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Code')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Discount')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Reason')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Distributed')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Expires')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Used')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Status')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-300">
                  {t('Action')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow className="border-slate-800/60 hover:bg-transparent">
                  <TableCell
                    colSpan={8}
                    className="py-8 text-center text-xs text-slate-500"
                  >
                    {t('No codes available')}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow
                    key={c.id}
                    className="border-slate-800/60 hover:bg-slate-800/30"
                  >
                    <TableCell className="font-mono text-xs font-bold text-amber-400">
                      {c.code}
                    </TableCell>
                    <TableCell className="text-xs text-slate-300">
                      <Badge
                        variant="outline"
                        className="border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-400"
                      >
                        {c.discountPercent}% OFF
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">
                      {t(REASON_LABEL[c.distributionReason])}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-300">
                      {formatDate(c.distributedAt)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-300">
                      {formatDate(c.expiresAt)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-300">
                      {formatDate(c.usedAt)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-[10px] ${STATUS_BADGE_CLASS[c.status]}`}
                      >
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={c.status !== 'ACTIVE'}
                        onClick={() => handleCopy(c.code)}
                        className="border-slate-700 bg-[#06080e] text-xs text-slate-300 hover:bg-slate-800 hover:text-amber-400 disabled:opacity-40"
                      >
                        {copiedCode === c.code ? (
                          <>
                            <Check className="mr-1 h-3.5 w-3.5 text-emerald-400" />
                            <span>{t('Copied Link')}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="mr-1 h-3.5 w-3.5" />
                            <span>{t('Copy Link')}</span>
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Code Status Guide */}
        <Card className="border-slate-800/80 bg-[#090b14]/90 p-6">
          <h3 className="mb-3 text-sm font-bold text-slate-100">
            {t('Code Status Guide')}
          </h3>
          <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-2">
              <Badge className="border-emerald-500/40 bg-emerald-500/20 text-[10px] text-emerald-400">
                ACTIVE
              </Badge>
              <span className="text-slate-400">
                {t('Ready to share and earn')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="border-blue-500/40 bg-blue-500/20 text-[10px] text-blue-400">
                USED
              </Badge>
              <span className="text-slate-400">
                {t('Successfully redeemed')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="border-slate-700 bg-slate-800 text-[10px] text-slate-400">
                EXPIRED
              </Badge>
              <span className="text-slate-400">
                {t('Past its expiration date')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="border-rose-500/40 bg-rose-500/20 text-[10px] text-rose-400">
                CANCELLED
              </Badge>
              <span className="text-slate-400">
                {t('Manually cancelled by DavinTrade')}
              </span>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
