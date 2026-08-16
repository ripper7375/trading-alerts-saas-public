'use client';

import React from 'react';
import Link from 'next/link';
import {
  Share2,
  ArrowLeft,
  Layers,
  TrendingUp,
  Download,
  Calendar,
  Activity,
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

export default function AdminReportCodeFlowsPage() {
  const { t } = useLocale();

  const flows = [
    {
      code: 'GOLDPRO20',
      partner: 'Alex Morgan',
      generatedDate: '2026-06-01',
      firstRedeemed: '2026-06-02',
      velocity: '1.4 redemptions/day',
      totalUsed: 42,
      activeUsers: 42,
    },
    {
      code: 'DAVINVIP10',
      partner: 'Marcus Vance',
      generatedDate: '2026-07-15',
      firstRedeemed: '2026-07-16',
      velocity: '0.9 redemptions/day',
      totalUsed: 28,
      activeUsers: 28,
    },
    {
      code: 'SUMMERTRADER',
      partner: 'Elena Rostova',
      generatedDate: '2026-05-10',
      firstRedeemed: '2026-05-12',
      velocity: '0.2 redemptions/day',
      totalUsed: 8,
      activeUsers: 0,
    },
  ];

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t(
          'Admin Report: Promotional Code Flows',
          'รายงาน: การไหลและการใช้รหัสโปรโมชัน'
        )}
        subtitle={t(
          'Redemption Velocity, Conversion Lag & Attribution Flow Analytics',
          'ความเร็วในการใช้รหัส อัตราการเปลี่ยนเป็นสมาชิก และการวิเคราะห์การไหลของข้อมูล'
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
            onClick={() => alert('Exporting Code Flows CSV...')}
            className="border-slate-800 bg-[#090b14] text-xs text-slate-300 hover:bg-slate-800"
          >
            <Download className="mr-1.5 h-3.5 w-3.5 text-amber-400" />
            {t('Export CSV Report', 'ส่งออกรายงาน CSV')}
          </Button>
        </div>

        <Card className="overflow-hidden border-slate-800/80 bg-[#090b14]/90 backdrop-blur-xl">
          <Table>
            <TableHeader className="bg-[#06080e]">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Promo Code', 'รหัสโปรโมชัน')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Assigned Partner', 'พันธมิตร')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Issued Date', 'วันที่สร้าง')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('First Redeemed', 'ใช้ครั้งแรก')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Redemption Velocity', 'อัตราการใช้ต่อวัน')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Total Redemptions', 'ยอดใช้รวม')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-300">
                  {t('Active Retention', 'สมาชิกคงอยู่')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flows.map((f) => (
                <TableRow
                  key={f.code}
                  className="border-slate-800/60 hover:bg-slate-800/30"
                >
                  <TableCell className="font-mono text-xs font-bold text-amber-400">
                    {f.code}
                  </TableCell>
                  <TableCell className="text-xs font-bold text-slate-200">
                    {f.partner}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-400">
                    {f.generatedDate}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-400">
                    {f.firstRedeemed}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-cyan-400">
                    {f.velocity}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-slate-200">
                    {f.totalUsed}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge className="border-emerald-500/40 bg-emerald-500/20 text-[10px] text-emerald-400">
                      {f.activeUsers} Active
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
