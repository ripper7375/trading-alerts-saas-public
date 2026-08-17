'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  KycStatusBadge,
  type KycStatus,
} from '@/components/disbursement/status-badge';
import { useLocale } from '@/lib/context/locale-context';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SEED DATA
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface PayableAffiliate {
  id: string;
  name: string;
  email: string;
  country: string;
  pendingAmount: number;
  commissionCount: number;
  oldestPendingDate: string;
  kycStatus: KycStatus;
  readyForPayout: boolean;
  notReadyReason?: string;
}

const AFFILIATES: PayableAffiliate[] = [
  {
    id: 'aff-101',
    name: 'Alex Morgan',
    email: 'alex.trader@gmail.com',
    country: 'TH',
    pendingAmount: 617.4,
    commissionCount: 6,
    oldestPendingDate: '2026-07-18',
    kycStatus: 'APPROVED',
    readyForPayout: true,
  },
  {
    id: 'aff-102',
    name: 'Marcus Vance',
    email: 'marcus.fx@capital.io',
    country: 'DE',
    pendingAmount: 411.6,
    commissionCount: 4,
    oldestPendingDate: '2026-07-22',
    kycStatus: 'APPROVED',
    readyForPayout: true,
  },
  {
    id: 'aff-104',
    name: 'Priya Nair',
    email: 'priya.nair@fxmail.com',
    country: 'SG',
    pendingAmount: 88.2,
    commissionCount: 2,
    oldestPendingDate: '2026-08-02',
    kycStatus: 'APPROVED',
    readyForPayout: true,
  },
  {
    id: 'aff-103',
    name: 'Elena Rostova',
    email: 'elena@quantumforex.ru',
    country: 'CY',
    pendingAmount: 117.6,
    commissionCount: 3,
    oldestPendingDate: '2026-07-29',
    kycStatus: 'SUBMITTED',
    readyForPayout: false,
    notReadyReason: 'KYC not approved',
  },
  {
    id: 'aff-105',
    name: 'Sofia Reyes',
    email: 'sofia.reyes@tradehub.co',
    country: 'MX',
    pendingAmount: 64.0,
    commissionCount: 1,
    oldestPendingDate: '2026-08-05',
    kycStatus: 'NONE',
    readyForPayout: false,
    notReadyReason: 'No Wise recipient on file',
  },
];

export default function PayableAffiliatesPage() {
  const { t, formatCurrency, formatDate } = useLocale();

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [payingId, setPayingId] = useState<string | null>(null);
  const [paidIds, setPaidIds] = useState<Set<string>>(new Set());
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const query = search.trim().toLowerCase();
  const matches = (a: PayableAffiliate): boolean =>
    !query ||
    a.name.toLowerCase().includes(query) ||
    a.email.toLowerCase().includes(query);

  const readyAffiliates = useMemo(
    () => AFFILIATES.filter((a) => a.readyForPayout && matches(a)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query]
  );
  const notReadyAffiliates = useMemo(
    () => AFFILIATES.filter((a) => !a.readyForPayout && matches(a)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query]
  );

  const totalPending = AFFILIATES.reduce((sum, a) => sum + a.pendingAmount, 0);

  const toggleSelected = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allReadySelected =
    readyAffiliates.length > 0 && selected.size === readyAffiliates.length;

  const handleSelectAll = (): void => {
    setSelected(
      allReadySelected ? new Set() : new Set(readyAffiliates.map((a) => a.id))
    );
  };

  const handleQuickPay = (id: string): void => {
    setPayingId(id);
    setTimeout(() => {
      setPaidIds((prev) => new Set(prev).add(id));
      setPayingId(null);
      setSuccessMessage(t('Payment successful!'));
      setTimeout(() => setSuccessMessage(null), 4000);
    }, 900);
  };

  const handleCreateBatch = (): void => {
    if (selected.size === 0) return;
    setIsCreatingBatch(true);
    setTimeout(() => {
      setIsCreatingBatch(false);
      setSuccessMessage(
        `Batch created for ${selected.size} affiliate${selected.size === 1 ? '' : 's'}!`
      );
      setSelected(new Set());
      setTimeout(() => setSuccessMessage(null), 4000);
    }, 900);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 sm:text-3xl">
            {t('Payable Affiliates')}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {t('Affiliates with pending commission payouts')}
          </p>
        </div>
        {selected.size > 0 && (
          <Button
            disabled={isCreatingBatch}
            onClick={handleCreateBatch}
            className="bg-amber-500 font-bold text-slate-950 hover:bg-amber-400"
          >
            {isCreatingBatch
              ? t('Creating...')
              : `${t('Create Batch')} (${selected.size})`}
          </Button>
        )}
      </div>

      {successMessage && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 text-xs text-emerald-300">
          {successMessage}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-slate-800/80 bg-[#090c14]">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400">
              {t('Total Affiliates')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-100">
              {AFFILIATES.length}
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-800/80 bg-[#090c14]">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400">
              {t('Ready for Payout')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">
              {AFFILIATES.filter((a) => a.readyForPayout).length}
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-800/80 bg-[#090c14]">
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-400">
              {t('Total Pending')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-bold text-amber-400">
              {formatCurrency(totalPending)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
        <Input
          placeholder={t('Search affiliate...')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 border-slate-800 bg-[#090b14] pl-9 text-xs text-slate-200"
        />
      </div>

      {/* Ready for Payout */}
      {readyAffiliates.length > 0 && (
        <Card className="border-slate-800/80 bg-[#090c14]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm text-slate-100">
                  {t('Ready for Payout')}
                  <Badge className="border-emerald-500/40 bg-emerald-500/15 text-[10px] text-emerald-300">
                    {readyAffiliates.length}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {t('Affiliates with approved Wise recipients')}
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSelectAll}
                className="border-slate-800 bg-transparent text-xs text-slate-300 hover:bg-slate-800"
              >
                {allReadySelected ? t('Deselect All') : t('Select All')}
              </Button>
            </div>
          </CardHeader>
          <Table>
            <TableHeader className="bg-[#06080e]">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox
                    checked={allReadySelected}
                    onCheckedChange={handleSelectAll}
                    aria-label={t('Select all affiliates')}
                  />
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Affiliate')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Country')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Pending')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Commissions')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Oldest')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('KYC Status')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-300">
                  {t('Actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {readyAffiliates.map((affiliate) => (
                <TableRow
                  key={affiliate.id}
                  className="border-slate-800/60 hover:bg-slate-800/30"
                >
                  <TableCell>
                    <Checkbox
                      checked={selected.has(affiliate.id)}
                      onCheckedChange={() => toggleSelected(affiliate.id)}
                      aria-label={`Select ${affiliate.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-bold text-slate-200">
                      {affiliate.name}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {affiliate.email}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-slate-300">
                    {affiliate.country}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-400">
                    {formatCurrency(affiliate.pendingAmount)}
                  </TableCell>
                  <TableCell className="text-xs text-slate-300">
                    {affiliate.commissionCount}
                  </TableCell>
                  <TableCell className="text-xs text-slate-400">
                    {formatDate(affiliate.oldestPendingDate)}
                  </TableCell>
                  <TableCell>
                    <KycStatusBadge status={affiliate.kycStatus} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/disbursement/affiliates/${affiliate.id}`}
                        className="text-xs font-semibold text-amber-400 hover:text-amber-300"
                      >
                        {t('View')}
                      </Link>
                      <Button
                        size="sm"
                        disabled={
                          payingId === affiliate.id || paidIds.has(affiliate.id)
                        }
                        onClick={() => handleQuickPay(affiliate.id)}
                        className="h-7 bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-500"
                      >
                        {paidIds.has(affiliate.id)
                          ? t('Paid')
                          : payingId === affiliate.id
                            ? t('Paying...')
                            : t('Pay Now')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Not Ready */}
      {notReadyAffiliates.length > 0 && (
        <Card className="border-slate-800/80 bg-[#090c14]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-slate-100">
              {t('Not Ready for Payout')}
              <Badge className="border-slate-600/40 bg-slate-600/15 text-[10px] text-slate-300">
                {notReadyAffiliates.length}
              </Badge>
            </CardTitle>
            <CardDescription className="text-slate-400">
              {t('Affiliates pending KYC approval or missing a Wise recipient')}
            </CardDescription>
          </CardHeader>
          <Table>
            <TableHeader className="bg-[#06080e]">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Affiliate')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Country')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Pending')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('KYC Status')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Reason')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-300">
                  {t('Actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notReadyAffiliates.map((affiliate) => (
                <TableRow
                  key={affiliate.id}
                  className="border-slate-800/60 hover:bg-slate-800/30"
                >
                  <TableCell>
                    <div className="text-xs font-bold text-slate-200">
                      {affiliate.name}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {affiliate.email}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-slate-300">
                    {affiliate.country}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-amber-400">
                    {formatCurrency(affiliate.pendingAmount)}
                  </TableCell>
                  <TableCell>
                    <KycStatusBadge status={affiliate.kycStatus} />
                  </TableCell>
                  <TableCell className="text-xs text-slate-400">
                    {affiliate.notReadyReason}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/admin/disbursement/affiliates/${affiliate.id}`}
                      className="text-xs font-semibold text-amber-400 hover:text-amber-300"
                    >
                      {t('View')}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {readyAffiliates.length === 0 && notReadyAffiliates.length === 0 && (
        <Card className="border-slate-800/80 bg-[#090c14]">
          <CardContent className="py-12 text-center text-sm text-slate-400">
            {t('No affiliates with pending payouts found.')}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
