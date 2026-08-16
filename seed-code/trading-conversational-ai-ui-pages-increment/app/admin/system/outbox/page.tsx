'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Send,
  Mail,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
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

export default function AdminSystemOutboxPage() {
  const { t } = useLocale();
  const [search, setSearch] = useState('');

  const outboxMessages = [
    {
      id: 'OUT-9982',
      recipient: 'sarah.j@trademail.com',
      channel: 'EMAIL_SES',
      subject: 'DavinTrade PRO Subscription Activated',
      attempts: 1,
      lastAttempt: '10m ago',
      status: 'SENT',
    },
    {
      id: 'OUT-9981',
      recipient: 'alex.trader@gmail.com',
      channel: 'EMAIL_SES',
      subject: 'Affiliate Payout Notification ($438.50)',
      attempts: 1,
      lastAttempt: '2h ago',
      status: 'SENT',
    },
    {
      id: 'OUT-9980',
      recipient: 'https://webhook.site/test',
      channel: 'WEBHOOK',
      subject: 'XAUUSD Bullish Fractal Trigger Payload',
      attempts: 1,
      lastAttempt: '5h ago',
      status: 'SENT',
    },
  ];

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t(
          'Admin System: Transactional Outbox Queue',
          'ระบบ: คิวการส่งข้อความและอีเมล (Outbox)'
        )}
        subtitle={t(
          'Transactional Email Deliveries, Telegram Bot Payloads & Retry Telemetry',
          'การส่งอีเมลแจ้งเตือน บันทึกการส่งข้อความ Telegram และสถิติการลองส่งใหม่'
        )}
      />

      <AdminNav />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div className="relative max-w-xs">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder={t(
                'Search outbox queue...',
                'ค้นหาคิวการส่งข้อความ...'
              )}
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
                  {t('Outbox ID', 'รหัสข้อความ')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Channel', 'ช่องทาง')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Recipient Target', 'ผู้รับ')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Subject / Event', 'หัวข้อ / เหตุการณ์')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Attempts', 'จำนวนครั้ง')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Last Attempt', 'ส่งล่าสุด')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-300">
                  {t('Status', 'สถานะ')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {outboxMessages.map((m) => (
                <TableRow
                  key={m.id}
                  className="border-slate-800/60 hover:bg-slate-800/30"
                >
                  <TableCell className="font-mono text-xs text-slate-400">
                    {m.id}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="border-cyan-500/30 bg-cyan-500/10 font-mono text-[10px] text-cyan-400"
                    >
                      {m.channel}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-200">
                    {m.recipient}
                  </TableCell>
                  <TableCell className="text-xs text-slate-300">
                    {m.subject}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-400">
                    {m.attempts}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">
                    {m.lastAttempt}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge className="border-emerald-500/40 bg-emerald-500/20 text-[10px] text-emerald-400">
                      {m.status}
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
