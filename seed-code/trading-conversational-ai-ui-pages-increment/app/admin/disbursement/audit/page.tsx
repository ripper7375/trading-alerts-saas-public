'use client';

import React from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  ArrowLeft,
  Download,
  Calendar,
  Search,
  CheckCircle2,
  FileCheck,
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

export default function AdminDisbursementAuditPage() {
  const { t } = useLocale();

  const auditEvents = [
    {
      id: 'AUD-991',
      timestamp: '2026-08-16 14:22:10 UTC',
      actor: 'admin_sys',
      action: 'BATCH_APPROVAL',
      details: 'Approved August Wise payout batch $1,029.00',
      ip: '171.96.120.45',
    },
    {
      id: 'AUD-990',
      timestamp: '2026-08-15 09:11:04 UTC',
      actor: 'system_cron',
      action: 'COMMISSION_ACCRUAL',
      details: 'Accrued $14.70 to Alex Morgan for renewal usr_892',
      ip: '127.0.0.1',
    },
    {
      id: 'AUD-989',
      timestamp: '2026-08-01 00:05:00 UTC',
      actor: 'wise_webhook',
      action: 'PAYOUT_SETTLED',
      details: 'Settled July Batch $960.40 via Wise Business',
      ip: '34.240.112.5',
    },
  ];

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t(
          'Admin Disbursement: Security & Audit Trail',
          'การจ่ายเงิน: บันทึกความปลอดภัยและการตรวจสอบ'
        )}
        subtitle={t(
          'Immutable Event Logs, Approval Signoffs & Automated Ledger Audits',
          'บันทึกเหตุการณ์ที่ไม่สามารถแก้ไขได้ การลงนามอนุมัติ และการตรวจสอบบัญชีอัตโนมัติ'
        )}
      />

      <AdminNav />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <Link
            href="/admin/disbursement/batches"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-amber-400"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>
              {t('Back to Disbursement Batches', 'กลับสู่รอบการโอนเงิน')}
            </span>
          </Link>
        </div>

        <Card className="overflow-hidden border-slate-800/80 bg-[#090b14]/90 backdrop-blur-xl">
          <Table>
            <TableHeader className="bg-[#06080e]">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Audit ID', 'รหัสการตรวจสอบ')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Timestamp', 'เวลา')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Actor / Trigger', 'ผู้ดำเนินการ')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Action Event', 'ประเภทการกระทำ')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Details', 'รายละเอียด')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-300">
                  {t('IP Source', 'ไอพีต้นทาง')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditEvents.map((ev) => (
                <TableRow
                  key={ev.id}
                  className="border-slate-800/60 hover:bg-slate-800/30"
                >
                  <TableCell className="font-mono text-xs text-slate-400">
                    {ev.id}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-400">
                    {ev.timestamp}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-amber-400">
                    {ev.actor}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-slate-200">
                    {ev.action}
                  </TableCell>
                  <TableCell className="text-xs text-slate-300">
                    {ev.details}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-slate-500">
                    {ev.ip}
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
