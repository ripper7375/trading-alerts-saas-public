'use client';

import React from 'react';
import { Landmark, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

export default function AdminDisbursementAccountsPage() {
  const { t, formatCurrency } = useLocale();

  const accounts = [
    {
      id: 'acc-wise-usd',
      provider: 'Wise Business',
      currency: 'USD',
      balance: 24500.0,
      status: 'CONNECTED',
      accountNumber: '•••• 8821',
      type: 'Primary Disbursement Account',
    },
    {
      id: 'acc-wise-eur',
      provider: 'Wise Business',
      currency: 'EUR',
      balance: 12800.0,
      status: 'CONNECTED',
      accountNumber: '•••• 3190',
      type: 'European Treasury Pool',
    },
    {
      id: 'acc-riseworks',
      provider: 'RiseWorks Global',
      currency: 'USD / USDC',
      balance: 8400.0,
      status: 'CONNECTED',
      accountNumber: 'rise_davintrade_prod',
      type: 'Crypto & Contractor Gateway',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 sm:text-3xl">
          {t('Treasury & Payout Accounts')}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {t(
            'Wise Business floating balances, RiseWorks custodial wallets & banking gateways'
          )}
        </p>
      </div>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <Badge className="border-emerald-500/40 bg-emerald-500/20 text-xs text-emerald-400">
            {t('All Treasury Channels Connected')}
          </Badge>
        </div>

        <Button
          onClick={() => alert(t('Connect new corporate treasury account'))}
          className="self-start bg-amber-500 font-bold text-slate-950 hover:bg-amber-400 sm:self-auto"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {t('Add Treasury Account')}
        </Button>
      </div>

      {/* Account Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {accounts.map((acc) => (
          <Card
            key={acc.id}
            className="space-y-4 border-slate-800/80 bg-[#090b14]/90 p-5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 font-bold text-amber-400">
                  <Landmark className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">
                    {t(acc.provider)}
                  </h4>
                  <p className="text-[10px] text-slate-400">
                    {acc.accountNumber}
                  </p>
                </div>
              </div>
              <Badge className="border-emerald-500/40 bg-emerald-500/20 text-[10px] text-emerald-400">
                {t(acc.status)}
              </Badge>
            </div>

            <div>
              <div className="text-[10px] tracking-wider text-slate-400 uppercase">
                {t('Available Floating Balance')}
              </div>
              <div className="mt-0.5 font-mono text-2xl font-extrabold text-slate-100">
                {formatCurrency(acc.balance)}
              </div>
            </div>

            <div className="border-t border-slate-800 pt-2 text-[11px] text-slate-500">
              {t(acc.type)}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
