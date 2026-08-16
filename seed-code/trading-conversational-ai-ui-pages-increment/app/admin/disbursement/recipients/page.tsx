'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  Building,
  Landmark,
  ShieldCheck,
} from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { AdminNav } from '@/components/admin/admin-nav';
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

export default function AdminDisbursementRecipientsPage() {
  const { t } = useLocale();
  const [search, setSearch] = useState('');

  const recipients = [
    {
      id: 'wise_recp_98421098',
      partner: 'Alex Morgan',
      bankName: 'Bangkok Bank PLC',
      accountNumber: '•••• 4912',
      currency: 'USD',
      country: 'TH',
      status: 'VERIFIED',
    },
    {
      id: 'wise_recp_33190812',
      partner: 'Marcus Vance',
      bankName: 'Deutsche Bank AG',
      accountNumber: '•••• 1109',
      currency: 'EUR',
      country: 'DE',
      status: 'VERIFIED',
    },
    {
      id: 'rise_recp_77182901',
      partner: 'Elena Rostova',
      bankName: 'RiseWorks Custodial',
      accountNumber: 'rise_elena_77',
      currency: 'USDC',
      country: 'CY',
      status: 'VERIFIED',
    },
  ];

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t('Admin Disbursement: Validated Bank Recipients')}
        subtitle={t(
          'Wise Bank Account Tokens, Routing Codes & Recipient Validation Registry'
        )}
      />

      <AdminNav />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div className="relative max-w-xs">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder={t('Search recipient or partner...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 border-slate-800 bg-[#090b14] pl-9 text-xs text-slate-200"
            />
          </div>
        </div>

        <Card className="overflow-hidden border-slate-800/80 bg-[#090b14]/90 backdrop-blur-xl">
          <Table>
            <TableHeader className="bg-[#06080e]">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Recipient Token ID')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Partner Legal Name')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Bank / Institution')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Account')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Currency')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Country')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-300">
                  {t('Verification')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recipients.map((r) => (
                <TableRow
                  key={r.id}
                  className="border-slate-800/60 hover:bg-slate-800/30"
                >
                  <TableCell className="font-mono text-xs font-bold text-slate-400">
                    {r.id}
                  </TableCell>
                  <TableCell className="text-xs font-bold text-slate-200">
                    {r.partner}
                  </TableCell>
                  <TableCell className="text-xs text-slate-300">
                    {r.bankName}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-300">
                    {r.accountNumber}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-amber-400">
                    {r.currency}
                  </TableCell>
                  <TableCell className="text-xs text-slate-400">
                    {r.country}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge className="border-emerald-500/40 bg-emerald-500/20 text-[10px] text-emerald-400">
                      {r.status}
                    </Badge>
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
