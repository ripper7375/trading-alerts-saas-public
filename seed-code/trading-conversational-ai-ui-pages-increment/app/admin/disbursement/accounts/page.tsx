'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Landmark,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  CreditCard,
  Building,
  ShieldCheck,
} from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { AdminNav } from '@/components/admin/admin-nav';
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
  const { t } = useLocale();

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
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t(
          'Admin Disbursement: Treasury & Payout Accounts',
          'การจ่ายเงิน: บัญชีคลังและการโอน'
        )}
        subtitle={t(
          'Wise Business Floating Balances, RiseWorks Custodial Wallets & Banking Gateways',
          'ยอดเงินคงเหลือในบัญชี Wise Business, กระเป๋าเงิน RiseWorks และเกตเวย์ธนาคาร'
        )}
      />

      <AdminNav />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Badge className="border-emerald-500/40 bg-emerald-500/20 text-xs text-emerald-400">
              {t(
                'All Treasury Channels Connected',
                'เชื่อมต่อบัญชีคลังทั้งหมดแล้ว'
              )}
            </Badge>
          </div>

          <Button
            onClick={() => alert('Connect new corporate treasury account')}
            className="self-start bg-amber-500 font-bold text-slate-950 hover:bg-amber-400 sm:self-auto"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {t('Add Treasury Account', 'เพิ่มบัญชีคลัง')}
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
                      {acc.provider}
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      {acc.accountNumber}
                    </p>
                  </div>
                </div>
                <Badge className="border-emerald-500/40 bg-emerald-500/20 text-[10px] text-emerald-400">
                  {acc.status}
                </Badge>
              </div>

              <div>
                <div className="text-[10px] tracking-wider text-slate-400 uppercase">
                  {t('Available Floating Balance', 'ยอดคงเหลือพร้อมโอน')}
                </div>
                <div className="mt-0.5 font-mono text-2xl font-extrabold text-slate-100">
                  {acc.currency === 'EUR' ? '€' : '$'}
                  {acc.balance.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                  })}
                </div>
              </div>

              <div className="border-t border-slate-800 pt-2 text-[11px] text-slate-500">
                {acc.type}
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
