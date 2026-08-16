'use client';

import React from 'react';
import Link from 'next/link';
import {
  Layers,
  ArrowLeft,
  Download,
  Plus,
  QrCode,
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

export default function AdminReportCodeInventoryPage() {
  const { t } = useLocale();

  const inventory = [
    {
      poolName: 'Tier 1 Creator Pool (20% Off)',
      totalIssued: 500,
      assigned: 350,
      available: 150,
      discount: '20%',
    },
    {
      poolName: 'Standard Partner Pool (10% Off)',
      totalIssued: 1500,
      assigned: 890,
      available: 610,
      discount: '10%',
    },
    {
      poolName: 'Institutional / VIP Pool (30% Off)',
      totalIssued: 100,
      assigned: 45,
      available: 55,
      discount: '30%',
    },
  ];

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t(
          'Admin Report: Global Promo Code Inventory',
          'รายงาน: คลังรหัสโปรโมชันส่วนกลาง'
        )}
        subtitle={t(
          'Master Pool Allocations, Stock Availability & Discount Quotas',
          'การจัดสรรคลังรหัสหลัก จำนวนคงเหลือ และโควตาส่วนลด'
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
        </div>

        <Card className="overflow-hidden border-slate-800/80 bg-[#090b14]/90 backdrop-blur-xl">
          <Table>
            <TableHeader className="bg-[#06080e]">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Pool Name', 'ชื่อกลุ่มคลังรหัส')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Discount Rate', 'ส่วนลด')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Total Minted', 'จำนวนสร้างทั้งหมด')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Assigned to Partners', 'จัดสรรให้พันธมิตรแล้ว')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-300">
                  {t('Available Stock', 'คงเหลือพร้อมจัดสรร')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventory.map((inv, idx) => (
                <TableRow
                  key={idx}
                  className="border-slate-800/60 hover:bg-slate-800/30"
                >
                  <TableCell className="text-xs font-bold text-slate-200">
                    {inv.poolName}
                  </TableCell>
                  <TableCell className="text-xs">
                    <Badge
                      variant="outline"
                      className="border-amber-500/30 bg-amber-500/10 font-mono text-[10px] text-amber-400"
                    >
                      {inv.discount}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-300">
                    {inv.totalIssued}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-cyan-400">
                    {inv.assigned}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-bold text-emerald-400">
                    {inv.available}
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
