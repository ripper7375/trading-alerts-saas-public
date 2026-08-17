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

interface AffiliateCodeDetail {
  code: string;
  status: 'ACTIVE' | 'USED' | 'EXPIRED';
  reason: string;
  distributedAt: string;
  expiresAt: string;
  usedAt: string | null;
}

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

const INITIAL_CODE_DETAILS: AffiliateCodeDetail[] = [
  {
    code: 'GOLDPRO20',
    status: 'ACTIVE',
    reason: 'Initial partner onboarding',
    distributedAt: '2025-11-05',
    expiresAt: '2026-11-05',
    usedAt: null,
  },
  {
    code: 'DAVINVIP10',
    status: 'ACTIVE',
    reason: 'Q1 growth bonus',
    distributedAt: '2026-01-10',
    expiresAt: '2027-01-10',
    usedAt: null,
  },
  {
    code: 'WELCOME5',
    status: 'USED',
    reason: 'Initial partner onboarding',
    distributedAt: '2025-11-05',
    expiresAt: '2026-05-05',
    usedAt: '2025-12-01',
  },
  {
    code: 'SPRINGPROMO',
    status: 'EXPIRED',
    reason: 'Seasonal campaign',
    distributedAt: '2025-06-01',
    expiresAt: '2025-09-01',
    usedAt: null,
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

const formatDate = (date: string | null): string => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

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
    case 'EXPIRED':
    default:
      return 'border-slate-500/40 bg-slate-500/20 text-slate-400';
  }
};

export default function AdminAffiliateDetailPage({
  params,
}: AdminAffiliateDetailPageProps) {
  const resolvedParams = use(params);
  const affiliateId = resolvedParams.id;
  const { t } = useLocale();

  const [status, setStatus] = useState<'ACTIVE' | 'SUSPENDED'>('ACTIVE');
  const [suspensionReason, setSuspensionReason] = useState('');
  const [codeDetails, setCodeDetails] =
    useState<AffiliateCodeDetail[]>(INITIAL_CODE_DETAILS);
  const [newCode, setNewCode] = useState('');
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

  const handleAddCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) return;
    const today = new Date();
    const expiry = new Date(today);
    expiry.setFullYear(expiry.getFullYear() + 1);
    setCodeDetails([
      ...codeDetails,
      {
        code: newCode.toUpperCase().trim(),
        status: 'ACTIVE',
        reason: 'Manual allocation',
        distributedAt: toLocalDateString(today),
        expiresAt: toLocalDateString(expiry),
        usedAt: null,
      },
    ]);
    setNewCode('');
    setIsDistributing(false);
    setSuccess(t('Promo code allocated to partner!'));
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
                    {status}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400">
                  alex.trader@gmail.com • ID: {affiliateId}
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-slate-400">
                {t('Accrued Unpaid Commissions')}
              </div>
              <div className="font-mono text-2xl font-extrabold text-emerald-400">
                ${PENDING_COMMISSIONS.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-[#06080e] p-4">
              <div className="text-xs text-slate-400">
                {t('Total Referrals')}
              </div>
              <div className="mt-1 font-mono text-xl font-bold text-slate-200">
                168 Signups
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#06080e] p-4">
              <div className="text-xs text-slate-400">
                {t('Active PRO Subscribers')}
              </div>
              <div className="mt-1 font-mono text-xl font-bold text-emerald-400">
                42 Traders
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#06080e] p-4">
              <div className="text-xs text-slate-400">
                {t('Lifetime Volume')}
              </div>
              <div className="mt-1 font-mono text-xl font-bold text-cyan-400">
                $8,232.00
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
                  {PROFILE.country}
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
                  ${totalEarnings.toFixed(2)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-400">{t('Pending Commissions')}</dt>
                <dd className="font-mono font-bold text-amber-400">
                  ${PENDING_COMMISSIONS.toFixed(2)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-400">{t('Paid Commissions')}</dt>
                <dd className="font-mono font-bold text-emerald-400">
                  ${PAID_COMMISSIONS.toFixed(2)}
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
              {t('Allocate Promo Code')}
            </Button>
          </div>

          {isDistributing && (
            <form
              onSubmit={handleAddCode}
              className="flex gap-2 border-b border-slate-800 bg-[#06080e] p-3"
            >
              <Input
                placeholder="NEWCODE10"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                className="border-slate-700 bg-[#090b14] font-mono text-xs uppercase"
                required
              />
              <Button
                type="submit"
                size="sm"
                className="bg-amber-500 font-bold text-slate-950 hover:bg-amber-400"
              >
                {t('Add')}
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
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-slate-400">
                    {c.reason}
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
                    ${c.amount.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`text-[10px] ${
                        c.status === 'PAID'
                          ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-400'
                          : 'border-amber-500/40 bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {c.status}
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
