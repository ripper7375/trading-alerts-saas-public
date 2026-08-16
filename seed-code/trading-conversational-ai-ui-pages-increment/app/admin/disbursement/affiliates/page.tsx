'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Share2,
  Landmark,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Eye,
  Send,
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

export default function AdminDisbursementAffiliatesPage() {
  const { t } = useLocale();
  const [search, setSearch] = useState('');

  const affiliates = [
    {
      id: 'aff-101',
      name: 'Alex Morgan',
      email: 'alex.trader@gmail.com',
      pendingAmount: 617.4,
      lifetimePaid: 2469.6,
      method: 'Wise (USD)',
      status: 'ELIGIBLE',
    },
    {
      id: 'aff-102',
      name: 'Marcus Vance',
      email: 'marcus.fx@capital.io',
      pendingAmount: 411.6,
      lifetimePaid: 1234.8,
      method: 'Wise (EUR)',
      status: 'ELIGIBLE',
    },
    {
      id: 'aff-103',
      name: 'Elena Rostova',
      email: 'elena@quantumforex.ru',
      pendingAmount: 117.6,
      lifetimePaid: 352.8,
      method: 'RiseWorks',
      status: 'ON_HOLD',
    },
  ];

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t(
          'Admin Disbursement: Affiliates Roster',
          'การจ่ายเงิน: บัญชีพันธมิตรและสถานะการโอน'
        )}
        subtitle={t(
          'Individual Affiliate Payout Readiness, Accumulated Accruals & Payment Details',
          'ความพร้อมในการรับเงินของแต่ละพันธมิตร ยอดสะสม และรายละเอียดการชำระเงิน'
        )}
      />

      <AdminNav />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div className="relative max-w-xs">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder={t('Search affiliate...', 'ค้นหาพันธมิตร...')}
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
                  {t('Affiliate ID', 'รหัสพันธมิตร')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Partner', 'ชื่อพันธมิตร')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Pending Payout', 'ยอดรอโอน')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Lifetime Paid', 'ยอดโอนแล้วทั้งหมด')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Disbursement Method', 'ช่องทางการโอน')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Readiness', 'ความพร้อม')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-300">
                  {t('Action', 'จัดการ')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {affiliates.map((aff) => (
                <TableRow
                  key={aff.id}
                  className="border-slate-800/60 hover:bg-slate-800/30"
                >
                  <TableCell className="font-mono text-xs font-bold text-slate-400">
                    {aff.id}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs font-bold text-slate-200">
                      {aff.name}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {aff.email}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-400">
                    ${aff.pendingAmount.toFixed(2)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-300">
                    ${aff.lifetimePaid.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-xs text-slate-300">
                    {aff.method}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`text-[10px] ${
                        aff.status === 'ELIGIBLE'
                          ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-400'
                          : 'border-amber-500/40 bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {aff.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admin/disbursement/affiliates/${aff.id}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-amber-400 hover:bg-amber-500/10"
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        <span>{t('Manage', 'จัดการ')}</span>
                      </Button>
                    </Link>
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
