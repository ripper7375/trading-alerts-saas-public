'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { AdminNav } from '@/components/admin/admin-nav';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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

const INVENTORY = [
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

export default function AdminReportCodeInventoryPage() {
  const { t, language } = useLocale();
  const inventory = INVENTORY;

  const totalMinted = inventory.reduce((sum, p) => sum + p.totalIssued, 0);
  const totalAssigned = inventory.reduce((sum, p) => sum + p.assigned, 0);
  const totalAvailable = inventory.reduce((sum, p) => sum + p.available, 0);
  const assignmentRate =
    totalMinted > 0 ? ((totalAssigned / totalMinted) * 100).toFixed(1) : '0.0';

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t('Admin Report: Global Promo Code Inventory')}
        subtitle={t(
          'Master Pool Allocations, Stock Availability & Discount Quotas'
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
            <span>{t('Back to Affiliates Directory')}</span>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={() => alert(t('Exporting Code Inventory CSV...'))}
            className="border-slate-800 bg-[#090b14] text-xs text-slate-300 hover:bg-slate-800"
          >
            <Download className="mr-1.5 h-3.5 w-3.5 text-amber-400" />
            {t('Export CSV Report')}
          </Button>
        </div>

        {/* All-Time Statistics */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card className="border-slate-800/80 bg-[#090b14]/90 p-4">
            <div className="text-xs font-medium text-slate-400">
              {t('Total Minted')}
            </div>
            <div className="mt-1 font-mono text-2xl font-extrabold text-slate-200">
              {totalMinted.toLocaleString(language)}
            </div>
          </Card>
          <Card className="border-slate-800/80 bg-[#090b14]/90 p-4">
            <div className="text-xs font-medium text-slate-400">
              {t('Assigned to Partners')}
            </div>
            <div className="mt-1 font-mono text-2xl font-extrabold text-cyan-400">
              {totalAssigned.toLocaleString(language)}
            </div>
          </Card>
          <Card className="border-slate-800/80 bg-[#090b14]/90 p-4">
            <div className="text-xs font-medium text-slate-400">
              {t('Available Stock')}
            </div>
            <div className="mt-1 font-mono text-2xl font-extrabold text-emerald-400">
              {totalAvailable.toLocaleString(language)}
            </div>
          </Card>
          <Card className="border-slate-800/80 bg-[#090b14]/90 p-4">
            <div className="text-xs font-medium text-slate-400">
              {t('Assignment Rate')}
            </div>
            <div className="mt-1 font-mono text-2xl font-extrabold text-purple-400">
              {assignmentRate}%
            </div>
          </Card>
        </div>

        <Card className="overflow-hidden border-slate-800/80 bg-[#090b14]/90 backdrop-blur-xl">
          <Table>
            <TableHeader className="bg-[#06080e]">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Pool Name')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Discount Rate')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Total Minted')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Assigned to Partners')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-300">
                  {t('Available Stock')}
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
                    {t(inv.poolName)}
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
