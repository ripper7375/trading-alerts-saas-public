'use client';

import React from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  ArrowLeft,
  DollarSign,
  Download,
  Calendar,
  Layers,
  Percent,
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

export default function AdminReportProfitLossPage() {
  const { t } = useLocale();

  const pnlMonthly = [
    {
      month: 'August 2026 (MTD)',
      gross: 18420.0,
      gatewayFees: 534.18,
      affiliateCommissions: 2840.0,
      serverCosts: 320.0,
      netProfit: 14725.82,
      margin: '79.9%',
    },
    {
      month: 'July 2026',
      gross: 24890.0,
      gatewayFees: 721.81,
      affiliateCommissions: 4120.0,
      serverCosts: 320.0,
      netProfit: 19728.19,
      margin: '79.3%',
    },
    {
      month: 'June 2026',
      gross: 21540.0,
      gatewayFees: 624.66,
      affiliateCommissions: 3650.0,
      serverCosts: 320.0,
      netProfit: 16945.34,
      margin: '78.7%',
    },
    {
      month: 'May 2026',
      gross: 17200.0,
      gatewayFees: 498.8,
      affiliateCommissions: 2890.0,
      serverCosts: 320.0,
      netProfit: 13491.2,
      margin: '78.4%',
    },
  ];

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t(
          'Admin Report: SaaS Profit & Loss Breakdown',
          'รายงาน: สรุปผลกำไร-ขาดทุน (P&L)'
        )}
        subtitle={t(
          'Gross Revenue, Gateway Costs, Affiliate Commission Expense & Net SaaS Margin',
          'รายได้รวม ค่าธรรมเนียมเกตเวย์ ค่าใช้จ่ายคอมมิชชัน และกำไรสุทธิ'
        )}
      />

      <AdminNav />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <Link
            href="/admin/affiliates"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-400"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>
              {t('Back to Affiliates Directory', 'กลับสู่รายชื่อพันธมิตร')}
            </span>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={() => alert('Downloading PnL CSV Report...')}
            className="border-slate-800 bg-[#090b14] text-xs text-slate-300 hover:bg-slate-800"
          >
            <Download className="mr-1.5 h-3.5 w-3.5 text-amber-400" />
            {t('Export CSV Report', 'ส่งออกรายงาน CSV')}
          </Button>
        </div>

        {/* 4 Summary Cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card className="border-slate-800/80 bg-[#090b14]/90 p-4">
            <div className="text-xs font-medium text-slate-400">
              {t('Gross Revenue (90d)', 'รายได้รวม (90 วัน)')}
            </div>
            <div className="mt-1 font-mono text-2xl font-extrabold text-emerald-400">
              $64,850.00
            </div>
          </Card>
          <Card className="border-slate-800/80 bg-[#090b14]/90 p-4">
            <div className="text-xs font-medium text-slate-400">
              {t('Affiliate Expense', 'ค่าคอมมิชชันพันธมิตร')}
            </div>
            <div className="mt-1 font-mono text-2xl font-extrabold text-amber-400">
              $10,610.00
            </div>
          </Card>
          <Card className="border-slate-800/80 bg-[#090b14]/90 p-4">
            <div className="text-xs font-medium text-slate-400">
              {t('Net Operating Profit', 'กำไรสุทธิจากการดำเนินงาน')}
            </div>
            <div className="mt-1 font-mono text-2xl font-extrabold text-cyan-400">
              $51,399.35
            </div>
          </Card>
          <Card className="border-slate-800/80 bg-[#090b14]/90 p-4">
            <div className="text-xs font-medium text-slate-400">
              {t('Average Net Margin', 'อัตรากำไรสุทธิเฉลี่ย')}
            </div>
            <div className="mt-1 font-mono text-2xl font-extrabold text-purple-400">
              79.2%
            </div>
          </Card>
        </div>

        {/* Table */}
        <Card className="overflow-hidden border-slate-800/80 bg-[#090b14]/90 backdrop-blur-xl">
          <Table>
            <TableHeader className="bg-[#06080e]">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Month Period', 'รอบเดือน')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Gross Revenue', 'รายได้รวม')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Payment Gateway Fees (2.9%)', 'ค่าธรรมเนียมเกตเวย์')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Affiliate Commissions (30%)', 'ค่าคอมมิชชัน')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Infrastructure Cost', 'ค่าเซิร์ฟเวอร์')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Net Profit', 'กำไรสุทธิ')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-300">
                  {t('Net Margin', 'อัตรากำไร')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pnlMonthly.map((p, idx) => (
                <TableRow
                  key={idx}
                  className="border-slate-800/60 hover:bg-slate-800/30"
                >
                  <TableCell className="text-xs font-bold text-slate-200">
                    {p.month}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-400">
                    ${p.gross.toFixed(2)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-400">
                    ${p.gatewayFees.toFixed(2)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-amber-400">
                    ${p.affiliateCommissions.toFixed(2)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">
                    ${p.serverCosts.toFixed(2)}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-cyan-300">
                    ${p.netProfit.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge className="border-purple-500/40 bg-purple-500/20 font-mono text-[10px] text-purple-300">
                      {p.margin}
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
