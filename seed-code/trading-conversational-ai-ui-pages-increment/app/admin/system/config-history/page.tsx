'use client';

import React from 'react';
import Link from 'next/link';
import {
  History,
  ArrowLeft,
  Search,
  Code,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import AppHeader from '@/components/layout/app-header';
import { AdminNav } from '@/components/admin/admin-nav';
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

export default function AdminSystemConfigHistoryPage() {
  const { t } = useLocale();

  const historyLogs = [
    {
      id: 'CFG-102',
      timestamp: '2026-08-16 12:00 UTC',
      admin: 'admin_sys',
      key: 'AFFILIATE_DEFAULT_COMMISSION',
      oldValue: '25%',
      newValue: '30%',
    },
    {
      id: 'CFG-101',
      timestamp: '2026-08-10 08:30 UTC',
      admin: 'admin_sys',
      key: 'WISE_AUTO_EXECUTION_CRON',
      oldValue: 'false',
      newValue: 'true',
    },
    {
      id: 'CFG-100',
      timestamp: '2026-08-01 00:00 UTC',
      admin: 'system_bootstrap',
      key: 'TIMESCALEDB_RETENTION_DAYS',
      oldValue: '30',
      newValue: '90',
    },
  ];

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t(
          'Admin System: Configuration Audit History',
          'ระบบ: ประวัติการแก้ไขการตั้งค่า'
        )}
        subtitle={t(
          'Version Controlled System Flag Modifications, Dynamic Config Deltas & Operator Audit',
          'ประวัติการแก้ไขค่าคอนฟิกของระบบ การเปลี่ยนแปลงค่าตัวแปร และการตรวจสอบผู้ดำเนินการ'
        )}
      />

      <AdminNav />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        <Card className="overflow-hidden border-slate-800/80 bg-[#090b14]/90 backdrop-blur-xl">
          <Table>
            <TableHeader className="bg-[#06080e]">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Version ID', 'รหัสเวอร์ชัน')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Timestamp', 'เวลา')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Admin Operator', 'ผู้แก้ไข')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Config Key', 'ตัวแปรที่แก้ไข')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Old Value', 'ค่าเดิม')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-300">
                  {t('New Value', 'ค่าใหม่')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyLogs.map((h) => (
                <TableRow
                  key={h.id}
                  className="border-slate-800/60 hover:bg-slate-800/30"
                >
                  <TableCell className="font-mono text-xs text-slate-400">
                    {h.id}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-400">
                    {h.timestamp}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-amber-400">
                    {h.admin}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-200">
                    {h.key}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-rose-400 line-through">
                    {h.oldValue}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-bold text-emerald-400">
                    {h.newValue}
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
