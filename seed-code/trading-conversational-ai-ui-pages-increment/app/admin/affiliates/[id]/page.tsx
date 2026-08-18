'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ShieldCheck,
  Ban,
  Landmark,
  Percent,
  DollarSign,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Plus,
} from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { AdminNav } from '@/components/admin/admin-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

interface AdminAffiliateDetailPageProps {
  params: Promise<{ id: string }>;
}

// Mirrors the backend `AffiliateCode` model + POST
// /api/admin/affiliates/[id]/distribute-codes (lib/admin/code-distribution.ts,
// lib/affiliate/code-generator.ts). Admin-distributed codes are ALWAYS
// tagged distributionReason='ADMIN_BONUS' server-side -- the free-text
// "reason" the admin types in the modal is an audit note for the request,
// not a value stored on the code record itself.
type DistributionReason = 'INITIAL' | 'MONTHLY' | 'ADMIN_BONUS';

interface AffiliateCodeDetail {
  code: string;
  status: 'ACTIVE' | 'USED' | 'EXPIRED' | 'CANCELLED';
  distributionReason: DistributionReason;
  distributedAt: string;
  expiresAt: string;
  usedAt: string | null;
  cancelledAt: string | null;
}

const REASON_LABEL: Record<DistributionReason, string> = {
  INITIAL: 'Initial partner onboarding',
  MONTHLY: 'Monthly allocation',
  ADMIN_BONUS: 'Admin bonus',
};

interface CommissionEntry {
  id: string;
  amount: number;
  status: 'PAID' | 'PENDING';
  earnedAt: string;
  paidAt: string | null;
}

const PROFILE = {
  country: 'United States',
  paymentMethod: 'Wise (USD)',
  verifiedAt: '2025-11-10',
  joinedAt: '2025-11-02',
};

const PENDING_COMMISSIONS = 617.4;
const PAID_COMMISSIONS = 460.0;

// Codes always expire at 23:59:59 on the last day of the month they were
// distributed in (lib/affiliate/code-generator.ts's calculateEndOfMonth()) --
// never a fixed 6/12-month window, and the code text is random, not a
// vanity name the affiliate or admin chose.
const INITIAL_CODE_DETAILS: AffiliateCodeDetail[] = [
  {
    code: '7F3A9B2C',
    status: 'ACTIVE',
    distributionReason: 'MONTHLY',
    distributedAt: '2026-08-01',
    expiresAt: '2026-08-31',
    usedAt: null,
    cancelledAt: null,
  },
  {
    code: 'D91C4E08',
    status: 'ACTIVE',
    distributionReason: 'ADMIN_BONUS',
    distributedAt: '2026-08-05',
    expiresAt: '2026-08-31',
    usedAt: null,
    cancelledAt: null,
  },
  {
    code: 'A2E77F14',
    status: 'USED',
    distributionReason: 'INITIAL',
    distributedAt: '2025-11-05',
    expiresAt: '2025-11-30',
    usedAt: '2025-11-18',
    cancelledAt: null,
  },
  {
    code: '5B0D3A6C',
    status: 'EXPIRED',
    distributionReason: 'MONTHLY',
    distributedAt: '2026-06-01',
    expiresAt: '2026-06-30',
    usedAt: null,
    cancelledAt: null,
  },
  {
    code: 'C4F821D9',
    status: 'CANCELLED',
    distributionReason: 'MONTHLY',
    distributedAt: '2026-07-01',
    expiresAt: '2026-07-31',
    usedAt: null,
    cancelledAt: '2026-07-15',
  },
];

const COMMISSIONS: CommissionEntry[] = [
  {
    id: 'c-1',
    amount: 120.0,
    status: 'PAID',
    earnedAt: '2026-07-01',
    paidAt: '2026-07-05',
  },
  {
    id: 'c-2',
    amount: 340.0,
    status: 'PAID',
    earnedAt: '2026-07-15',
    paidAt: '2026-07-20',
  },
  {
    id: 'c-3',
    amount: PENDING_COMMISSIONS,
    status: 'PENDING',
    earnedAt: '2026-08-01',
    paidAt: null,
  },
];

const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getCodeStatusBadgeClass = (
  status: AffiliateCodeDetail['status']
): string => {
  switch (status) {
    case 'ACTIVE':
      return 'border-emerald-500/40 bg-emerald-500/20 text-emerald-400';
    case 'USED':
      return 'border-blue-500/40 bg-blue-500/20 text-blue-400';
    case 'CANCELLED':
      return 'border-rose-500/40 bg-rose-500/20 text-rose-400';
    case 'EXPIRED':
    default:
      return 'border-slate-500/40 bg-slate-500/20 text-slate-400';
  }
};

/** 8-char uppercase hex, matching generateUniqueCode()'s crypto.randomBytes(6) output. */
const generateMockCode = (): string =>
  Array.from({ length: 6 }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, '0')
  )
    .join('')
    .toUpperCase()
    .slice(0, 8);

const calculateEndOfMonth = (): Date => {
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  endOfMonth.setHours(23, 59, 59, 999);
  return endOfMonth;
};

export default function AdminAffiliateDetailPage({
  params,
}: AdminAffiliateDetailPageProps) {
  const resolvedParams = use(params);
  const affiliateId = resolvedParams.id;
  const { t, formatCurrency, formatDate: formatDateLocale } = useLocale();

  const formatDate = (date: string | null): string => {
    if (!date) return '-';
    return formatDateLocale(date);
  };

  const [status, setStatus] = useState<'ACTIVE' | 'SUSPENDED'>('ACTIVE');
  const [suspensionReason, setSuspensionReason] = useState('');
  const [codeDetails, setCodeDetails] =
    useState<AffiliateCodeDetail[]>(INITIAL_CODE_DETAILS);
  // Matches POST /api/admin/affiliates/[id]/distribute-codes's real body
  // shape: { count: 1-50, reason: non-empty string } -- the backend
  // generates `count` random codes, it never accepts admin-chosen code text.
  const [distributeCount, setDistributeCount] = useState(15);
  const [distributeReason, setDistributeReason] = useState('');
  const [isDistributing, setIsDistributing] = useState(false);
  const [success, setSuccess] = useState('');

  const totalEarnings = PENDING_COMMISSIONS + PAID_COMMISSIONS;
  const codesUsed = codeDetails.filter((c) => c.status === 'USED').length;
  const conversionRate =
    codeDetails.length > 0
      ? ((codesUsed / codeDetails.length) * 100).toFixed(1)
      : '0.0';

  const handleToggleStatus = () => {
    if (status === 'ACTIVE') {
      const reason = window.prompt(t('Enter suspension reason:'));
      if (!reason) return;
      setSuspensionReason(reason);
      setStatus('SUSPENDED');
      setSuccess(t('Partner status updated to SUSPENDED'));
    } else {
      setSuspensionReason('');
      setStatus('ACTIVE');
      setSuccess(t('Partner status updated to ACTIVE'));
    }
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleDistributeCodes = (e: React.FormEvent) => {
    e.preventDefault();
    if (distributeCount < 1 || distributeCount > 50) return;
    if (!distributeReason.trim()) return;

    const today = new Date();
    const expiry = calculateEndOfMonth();
    const newCodes: AffiliateCodeDetail[] = Array.from(
      { length: distributeCount },
      () => ({
        code: generateMockCode(),
        status: 'ACTIVE',
        distributionReason: 'ADMIN_BONUS',
        distributedAt: toLocalDateString(today),
        expiresAt: toLocalDateString(expiry),
        usedAt: null,
        cancelledAt: null,
      })
    );

    setCodeDetails([...newCodes, ...codeDetails]);
    setDistributeCount(15);
    setDistributeReason('');
    setIsDistributing(false);
    setSuccess(
      t(
        `${distributeCount} promo code${distributeCount === 1 ? '' : 's'} distributed to partner!`
      )
    );
    setTimeout(() => setSuccess(''), 3000);
  };

  // Matches POST /api/admin/codes/[code]/cancel -- admin-only, and the
  // backend only allows cancelling a code that is still ACTIVE (a USED or
  // already-CANCELLED code is rejected with 400).
  const handleCancelCode = (code: string) => {
    const target = codeDetails.find((c) => c.code === code);
    if (!target || target.status !== 'ACTIVE') return;

    const confirmed = window.confirm(
      t(
        `Cancel code ${code}? It will no longer be redeemable at checkout. This cannot be undone.`
      )
    );
    if (!confirmed) return;

    setCodeDetails((prev) =>
      prev.map((c) =>
        c.code === code
          ? {
              ...c,
              status: 'CANCELLED',
              cancelledAt: toLocalDateString(new Date()),
            }
          : c
      )
    );
    setSuccess(t(`Code ${code} cancelled.`));
    setTimeout(() => setSuccess(''), 3000);
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t('Admin Partner Deep Dive')}
        subtitle={t(`Managing Partner ID: ${affiliateId}`)}
      />

      <AdminNav />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <Link
            href="/admin/affiliates"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-400"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t('Back to Affiliates Directory')}</span>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleStatus}
            className={`text-xs ${
              status === 'ACTIVE'
                ? 'border-rose-500/40 text-rose-300 hover:bg-rose-950/40'
                : 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/40'
            }`}
          >
            {status === 'ACTIVE' ? (
              <>
                <Ban className="mr-1.5 h-3.5 w-3.5" />
                {t('Suspend Partner')}
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                {t('Reactivate Partner')}
              </>
            )}
          </Button>
        </div>

        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Overview Header */}
        <Card className="space-y-6 border-slate-800/80 bg-[#090b14]/90 p-6">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-lg font-bold text-amber-400">
                AM
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-100">
                    Alex Morgan
                  </h3>
                  <Badge
                    className={
                      status === 'ACTIVE'
                        ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-400'
                        : 'border-rose-500/40 bg-rose-500/20 text-rose-400'
                    }
                  >
                    {t(status)}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400">
                  alex.trader@gmail.com • {t('ID:')} {affiliateId}
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-slate-400">
                {t('Accrued Unpaid Commissions')}
              </div>
              <div className="font-mono text-2xl font-extrabold text-emerald-400">
                {formatCurrency(PENDING_COMMISSIONS)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-[#06080e] p-4">
              <div className="text-xs text-slate-400">
                {t('Total Referrals')}
              </div>
              <div className="mt-1 font-mono text-xl font-bold text-slate-200">
                168 {t('Signups')}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#06080e] p-4">
              <div className="text-xs text-slate-400">
                {t('Active PRO Subscribers')}
              </div>
              <div className="mt-1 font-mono text-xl font-bold text-emerald-400">
                42 {t('Traders')}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#06080e] p-4">
              <div className="text-xs text-slate-400">
                {t('Lifetime Volume')}
              </div>
              <div className="mt-1 font-mono text-xl font-bold text-cyan-400">
                {formatCurrency(8232)}
              </div>
            </div>
          </div>
        </Card>

        {/* Profile & Earnings */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card className="border-slate-800/80 bg-[#090b14]/90 p-5">
            <h4 className="mb-4 flex items-center gap-2 text-xs font-bold tracking-wider text-slate-300 uppercase">
              <ShieldCheck className="h-4 w-4 text-amber-400" />
              {t('Profile Information')}
            </h4>
            <dl className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-slate-400">{t('Country')}</dt>
                <dd className="font-semibold text-slate-200">
                  {t(PROFILE.country)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-slate-400">
                  <Landmark className="h-3.5 w-3.5" />
                  {t('Payment Method')}
                </dt>
                <dd className="font-semibold text-slate-200">
                  {PROFILE.paymentMethod}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-400">{t('Verified At')}</dt>
                <dd className="font-semibold text-slate-200">
                  {formatDate(PROFILE.verifiedAt)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-400">{t('Joined')}</dt>
                <dd className="font-semibold text-slate-200">
                  {formatDate(PROFILE.joinedAt)}
                </dd>
              </div>
            </dl>

            {status === 'SUSPENDED' && suspensionReason && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                  <div className="font-semibold tracking-wide text-rose-400 uppercase">
                    {t('Suspension Reason')}
                  </div>
                  <div>{suspensionReason}</div>
                </div>
              </div>
            )}
          </Card>

          <Card className="border-slate-800/80 bg-[#090b14]/90 p-5">
            <h4 className="mb-4 flex items-center gap-2 text-xs font-bold tracking-wider text-slate-300 uppercase">
              <DollarSign className="h-4 w-4 text-amber-400" />
              {t('Earnings Summary')}
            </h4>
            <dl className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-slate-400">{t('Total Earnings')}</dt>
                <dd className="font-mono font-bold text-slate-200">
                  {formatCurrency(totalEarnings)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-400">{t('Pending Commissions')}</dt>
                <dd className="font-mono font-bold text-amber-400">
                  {formatCurrency(PENDING_COMMISSIONS)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-400">{t('Paid Commissions')}</dt>
                <dd className="font-mono font-bold text-emerald-400">
                  {formatCurrency(PAID_COMMISSIONS)}
                </dd>
              </div>
              <div className="flex items-center justify-between border-t border-slate-800 pt-3">
                <dt className="text-slate-400">{t('Codes Distributed')}</dt>
                <dd className="font-semibold text-slate-200">
                  {codeDetails.length}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-400">{t('Codes Used')}</dt>
                <dd className="font-semibold text-slate-200">{codesUsed}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-slate-400">
                  <Percent className="h-3.5 w-3.5" />
                  {t('Conversion Rate')}
                </dt>
                <dd className="font-semibold text-slate-200">
                  {conversionRate}%
                </dd>
              </div>
            </dl>
          </Card>
        </div>

        {/* Affiliate Codes */}
        <Card className="overflow-hidden border-slate-800/80 bg-[#090b14]/90">
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
            <h4 className="text-xs font-bold tracking-wider text-slate-300 uppercase">
              {t('Affiliate Codes')} ({codeDetails.length})
            </h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDistributing(true)}
              className="border-slate-700 bg-[#06080e] text-xs text-amber-400 hover:bg-slate-800"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t('Distribute Codes')}
            </Button>
          </div>

          {isDistributing && (
            <form
              onSubmit={handleDistributeCodes}
              className="flex flex-col gap-2 border-b border-slate-800 bg-[#06080e] p-3 sm:flex-row"
            >
              <Input
                type="number"
                min={1}
                max={50}
                placeholder={t('Count (1-50)')}
                value={distributeCount}
                onChange={(e) => setDistributeCount(Number(e.target.value))}
                className="border-slate-700 bg-[#090b14] text-xs sm:w-28"
                required
              />
              <Input
                placeholder={t('Reason (e.g. Q3 growth bonus)')}
                value={distributeReason}
                onChange={(e) => setDistributeReason(e.target.value)}
                className="border-slate-700 bg-[#090b14] text-xs"
                required
              />
              <div className="flex gap-2">
                <Button
                  type="submit"
                  size="sm"
                  className="bg-amber-500 font-bold text-slate-950 hover:bg-amber-400"
                >
                  {t('Distribute')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setIsDistributing(false)}
                  className="text-slate-400"
                >
                  {t('Cancel')}
                </Button>
              </div>
            </form>
          )}

          <Table>
            <TableHeader className="bg-[#06080e]">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Code')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Status')}
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
                  {t('Cancelled')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-300">
                  {t('Action')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codeDetails.map((c) => (
                <TableRow
                  key={c.code}
                  className="border-slate-800/60 hover:bg-slate-800/30"
                >
                  <TableCell className="flex items-center gap-1.5 font-mono text-xs font-bold text-amber-400">
                    <QrCode className="h-3.5 w-3.5" />
                    {c.code}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`text-[10px] ${getCodeStatusBadgeClass(c.status)}`}
                    >
                      {t(c.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-slate-400">
                    {t(REASON_LABEL[c.distributionReason])}
                  </TableCell>
                  <TableCell className="text-xs text-slate-300">
                    {formatDate(c.distributedAt)}
                  </TableCell>
                  <TableCell className="text-xs text-slate-300">
                    {formatDate(c.expiresAt)}
                  </TableCell>
                  <TableCell className="text-xs text-slate-300">
                    {formatDate(c.usedAt)}
                  </TableCell>
                  <TableCell className="text-xs text-slate-300">
                    {formatDate(c.cancelledAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {c.status === 'ACTIVE' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelCode(c.code)}
                        className="border-rose-500/30 bg-[#06080e] text-xs text-rose-400 hover:bg-rose-950/40"
                      >
                        <Ban className="mr-1 h-3.5 w-3.5" />
                        {t('Cancel')}
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-600">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Recent Commissions */}
        <Card className="overflow-hidden border-slate-800/80 bg-[#090b14]/90">
          <div className="flex items-center gap-2 border-b border-slate-800 px-5 py-4">
            <Landmark className="h-4 w-4 text-amber-400" />
            <h4 className="text-xs font-bold tracking-wider text-slate-300 uppercase">
              {t('Recent Commissions')}
            </h4>
          </div>
          <Table>
            <TableHeader className="bg-[#06080e]">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Amount')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Status')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Earned')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Paid')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {COMMISSIONS.map((c) => (
                <TableRow
                  key={c.id}
                  className="border-slate-800/60 hover:bg-slate-800/30"
                >
                  <TableCell className="font-mono text-xs font-bold text-slate-200">
                    {formatCurrency(c.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`text-[10px] ${
                        c.status === 'PAID'
                          ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-400'
                          : 'border-amber-500/40 bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {t(c.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-slate-300">
                    {formatDate(c.earnedAt)}
                  </TableCell>
                  <TableCell className="text-xs text-slate-300">
                    {formatDate(c.paidAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </main>
    </div>
  );
}
