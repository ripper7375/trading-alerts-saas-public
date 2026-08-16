'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  QrCode,
  Plus,
  Copy,
  Check,
  ExternalLink,
  Percent,
  Layers,
  Sparkles,
  ArrowRight,
  Search,
} from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { AffiliateNav } from '@/components/affiliate/affiliate-nav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
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

interface PromoCode {
  id: string;
  code: string;
  discount: number; // percentage
  clicks: number;
  signups: number;
  conversions: number;
  earnings: number;
  status: 'ACTIVE' | 'EXPIRED' | 'PAUSED';
  created: string;
}

export default function AffiliateCodesPage() {
  const { t } = useLocale();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [newCodeName, setNewCodeName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [codes, setCodes] = useState<PromoCode[]>([
    {
      id: 'code-1',
      code: 'GOLDPRO20',
      discount: 20,
      clicks: 1420,
      signups: 168,
      conversions: 42,
      earnings: 617.4,
      status: 'ACTIVE',
      created: '2026-06-01',
    },
    {
      id: 'code-2',
      code: 'DAVINVIP10',
      discount: 10,
      clicks: 890,
      signups: 94,
      conversions: 28,
      earnings: 411.6,
      status: 'ACTIVE',
      created: '2026-07-15',
    },
    {
      id: 'code-3',
      code: 'SUMMERTRADER',
      discount: 15,
      clicks: 340,
      signups: 22,
      conversions: 8,
      earnings: 117.6,
      status: 'EXPIRED',
      created: '2026-05-10',
    },
  ]);

  const handleCopy = (code: string) => {
    const link = `${window.location.origin}/checkout?ref=${code}`;
    navigator.clipboard.writeText(link);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCreateCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCodeName.trim()) return;

    const newCode: PromoCode = {
      id: `code-${Date.now()}`,
      code: newCodeName.toUpperCase().trim(),
      discount: 10,
      clicks: 0,
      signups: 0,
      conversions: 0,
      earnings: 0,
      status: 'ACTIVE',
      created: new Date().toISOString().split('T')[0],
    };

    setCodes([newCode, ...codes]);
    setNewCodeName('');
    setIsCreating(false);
  };

  const filtered = codes.filter((c) =>
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#06070a] text-slate-100 select-none">
      <AppHeader
        title={t('Affiliate Promo Codes')}
        subtitle={t(
          'Manage Referral Discount Coupons, Tracking Links & Conversion Telemetry'
        )}
      />

      <AffiliateNav />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        {/* Top Action Bar */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="relative max-w-xs">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder={t('Search promo code...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 border-slate-800 bg-[#090b14] pl-9 text-xs text-slate-200"
            />
          </div>

          <Button
            onClick={() => setIsCreating(true)}
            className="self-start bg-amber-500 font-bold text-slate-950 hover:bg-amber-400 sm:self-auto"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {t('Create New Promo Code')}
          </Button>
        </div>

        {isCreating && (
          <Card className="space-y-4 border-amber-500/40 bg-[#090c18] p-5">
            <h3 className="text-sm font-bold text-slate-100">
              {t('New Promo Code Generator')}
            </h3>
            <form
              onSubmit={handleCreateCode}
              className="flex flex-col gap-3 sm:flex-row"
            >
              <Input
                placeholder="e.g. TRADERGOLD10"
                value={newCodeName}
                onChange={(e) => setNewCodeName(e.target.value)}
                className="border-slate-700 bg-[#05060a] font-mono text-xs text-slate-100 uppercase"
                required
              />
              <div className="flex gap-2">
                <Button
                  type="submit"
                  className="bg-amber-500 font-bold text-slate-950 hover:bg-amber-400"
                >
                  {t('Generate')}
                </Button>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-slate-400"
                >
                  {t('Cancel')}
                </Button>
              </div>
            </form>
          </Card>
        )}

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
                  {t('Clicks')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Signups')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Conversions')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Total Earnings')}
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
              {filtered.map((c) => (
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
                      {c.discount}% OFF
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-300">
                    {c.clicks}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-300">
                    {c.signups}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-400 text-slate-300">
                    {c.conversions}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-400">
                    ${c.earnings.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`text-[10px] ${
                        c.status === 'ACTIVE'
                          ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-400'
                          : 'border-slate-700 bg-slate-800 text-slate-400'
                      }`}
                    >
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(c.code)}
                      className="border-slate-700 bg-[#06080e] text-xs text-slate-300 hover:bg-slate-800 hover:text-amber-400"
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
              ))}
            </TableBody>
          </Table>
        </Card>
      </main>
    </div>
  );
}
