'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Share2,
  Search,
  Filter,
  ArrowRight,
  Landmark,
  DollarSign,
  Percent,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Download,
  Users,
  Eye,
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

interface AdminAffiliate {
  id: string;
  name: string;
  email: string;
  code: string;
  referrals: number;
  activeSubscribers: number;
  totalVolume: number;
  unpaidCommission: number;
  payoutMethod: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
}

export default function AdminAffiliatesDirectoryPage() {
  const { t } = useLocale();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'ACTIVE' | 'SUSPENDED'
  >('ALL');

  const affiliates: AdminAffiliate[] = [
    {
      id: 'aff-101',
      name: 'Alex Morgan',
      email: 'alex.trader@gmail.com',
      code: 'GOLDPRO20',
      referrals: 168,
      activeSubscribers: 42,
      totalVolume: 8232.0,
      unpaidCommission: 617.4,
      payoutMethod: 'Wise (USD)',
      status: 'ACTIVE',
    },
    {
      id: 'aff-102',
      name: 'Marcus Vance',
      email: 'marcus.fx@capital.io',
      code: 'DAVINVIP10',
      referrals: 94,
      activeSubscribers: 28,
      totalVolume: 4116.0,
      unpaidCommission: 411.6,
      payoutMethod: 'Wise (EUR)',
      status: 'ACTIVE',
    },
    {
      id: 'aff-103',
      name: 'Elena Rostova',
      email: 'elena@quantumforex.ru',
      code: 'SUMMERTRADER',
      referrals: 22,
      activeSubscribers: 8,
      totalVolume: 1176.0,
      unpaidCommission: 117.6,
      payoutMethod: 'RiseWorks',
      status: 'SUSPENDED',
    },
  ];

  const filtered = affiliates.filter((a) => {
    const matchesSearch =
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase()) ||
      a.code.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const reportsNav = [
    {
      href: '/admin/affiliates/reports/code-flows',
      label: t('Code Flows', 'การไหลของรหัส'),
    },
    {
      href: '/admin/affiliates/reports/code-inventory',
      label: t('Code Inventory', 'คลังรหัส'),
    },
    {
      href: '/admin/affiliates/reports/commission-owings',
      label: t('Commission Owings', 'ยอดค้างจ่าย'),
    },
    {
      href: '/admin/affiliates/reports/profit-loss',
      label: t('P&L Breakdown', 'กำไร-ขาดทุน'),
    },
    {
      href: '/admin/affiliates/reports/sales-performance',
      label: t('Sales Performance', 'ประสิทธิภาพยอดขาย'),
    },
  ];

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t(
          'Admin Affiliates Directory & Reports',
          'รายชื่อพันธมิตรและรายงาน'
        )}
        subtitle={t(
          'Master Partner Accounts, Commission Ledgers & Promotional Telemetry',
          'จัดการบัญชีพันธมิตร บัญชีแยกประเภทค่าคอมมิชชัน และสถิติโปรโมชัน'
        )}
      />

      <AdminNav />

      {/* Reports Sub-Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-800 bg-[#06080e] px-4 py-2 text-xs md:px-6">
        <span className="mr-2 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
          {t('Reports', 'รายงาน')}:
        </span>
        {reportsNav.map((rep) => (
          <Link
            key={rep.href}
            href={rep.href}
            className="rounded-lg px-2.5 py-1 whitespace-nowrap text-slate-400 transition-colors hover:bg-slate-800 hover:text-amber-400"
          >
            {rep.label}
          </Link>
        ))}
      </div>

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card className="border-slate-800/80 bg-[#090b14]/90 p-4">
            <div className="text-xs font-medium text-slate-400">
              {t('Total Partners', 'พันธมิตรทั้งหมด')}
            </div>
            <div className="mt-1 font-mono text-2xl font-extrabold text-amber-400">
              {affiliates.length}
            </div>
          </Card>
          <Card className="border-slate-800/80 bg-[#090b14]/90 p-4">
            <div className="text-xs font-medium text-slate-400">
              {t('Referred Subscriptions', 'สมาชิกที่แนะนำ')}
            </div>
            <div className="mt-1 font-mono text-2xl font-extrabold text-emerald-400">
              78
            </div>
          </Card>
          <Card className="border-slate-800/80 bg-[#090b14]/90 p-4">
            <div className="text-xs font-medium text-slate-400">
              {t('Gross Partner Volume', 'ยอดขายจากพันธมิตร')}
            </div>
            <div className="mt-1 font-mono text-2xl font-extrabold text-cyan-400">
              $13,524.00
            </div>
          </Card>
          <Card className="border-slate-800/80 bg-[#090b14]/90 p-4">
            <div className="text-xs font-medium text-slate-400">
              {t('Total Unpaid Owings', 'ค่าคอมมิชชันค้างจ่าย')}
            </div>
            <div className="mt-1 font-mono text-2xl font-extrabold text-rose-400">
              $1,146.60
            </div>
          </Card>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="relative max-w-xs">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder={t(
                'Search partner, code, email...',
                'ค้นหาพันธมิตร, รหัส, อีเมล...'
              )}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 border-slate-800 bg-[#090b14] pl-9 text-xs text-slate-200"
            />
          </div>

          <div className="flex items-center gap-2">
            {(['ALL', 'ACTIVE', 'SUSPENDED'] as const).map((s) => (
              <Button
                key={s}
                variant="outline"
                size="sm"
                onClick={() => setStatusFilter(s)}
                className={`text-xs ${
                  statusFilter === s
                    ? 'border-amber-500 bg-amber-500/15 text-amber-400'
                    : 'border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                {s}
              </Button>
            ))}
          </div>
        </div>

        {/* Table */}
        <Card className="overflow-hidden border-slate-800/80 bg-[#090b14]/90 backdrop-blur-xl">
          <Table>
            <TableHeader className="bg-[#06080e]">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Partner ID', 'รหัสพันธมิตร')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Name & Email', 'ชื่อและอีเมล')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Code', 'รหัสโปรโมชัน')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Active Traders', 'สมาชิกที่ใช้งาน')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Gross Volume', 'ยอดขายสะสม')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Unpaid Owings', 'ยอดค้างจ่าย')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Payout Method', 'ช่องทางรับเงิน')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Status', 'สถานะ')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-300">
                  {t('Action', 'จัดการ')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((aff) => (
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
                  <TableCell className="font-mono text-xs font-bold text-amber-400">
                    {aff.code}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-400">
                    {aff.activeSubscribers}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-300">
                    ${aff.totalVolume.toFixed(2)}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-rose-400">
                    ${aff.unpaidCommission.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-xs text-slate-300">
                    {aff.payoutMethod}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`text-[10px] ${
                        aff.status === 'ACTIVE'
                          ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-400'
                          : 'border-rose-500/40 bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {aff.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admin/affiliates/${aff.id}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-amber-400 hover:bg-amber-500/10"
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        <span>{t('Inspect', 'ตรวจสอบ')}</span>
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
