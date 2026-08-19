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
  const [isRetrying, setIsRetrying] = useState(false);
  const [success, setSuccess] = useState('');

  const [outboxMessages, setOutboxMessages] = useState([
    {
      id: 'OUT-9982',
      recipient: 'sarah.j@trademail.com',
      channel: 'EMAIL_SES',
      subject: 'DavinTrade PRO Subscription Activated',
      attempts: 1,
      lastAttempt: '10m ago',
      status: 'SENT',
      lastError: null as string | null,
    },
    {
      id: 'OUT-9981',
      recipient: 'alex.trader@gmail.com',
      channel: 'EMAIL_SES',
      subject: 'Affiliate Payout Notification ($438.50)',
      attempts: 1,
      lastAttempt: '2h ago',
      status: 'SENT',
      lastError: null as string | null,
    },
    {
      id: 'OUT-9980',
      recipient: 'https://webhook.site/test',
      channel: 'WEBHOOK',
      subject: 'XAUUSD Bullish Fractal Trigger Payload',
      attempts: 1,
      lastAttempt: '5h ago',
      status: 'SENT',
      lastError: null as string | null,
    },
    {
      id: 'OUT-9979',
      recipient: 'trader.mike@protonmail.com',
      channel: 'EMAIL_SES',
      subject: 'Password Reset Requested',
      attempts: 3,
      lastAttempt: '22m ago',
      status: 'FAILED',
      lastError: 'SES throttling: Maximum sending rate exceeded',
    },
  ]);

  const filteredMessages = outboxMessages.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.id.toLowerCase().includes(q) ||
      m.recipient.toLowerCase().includes(q) ||
      m.subject.toLowerCase().includes(q)
    );
  });

  const statusCounts = {
    SENT: outboxMessages.filter((m) => m.status === 'SENT').length,
    PENDING: outboxMessages.filter((m) => m.status === 'PENDING').length,
    FAILED: outboxMessages.filter((m) => m.status === 'FAILED').length,
  };

  const handleRetryFailed = () => {
    setIsRetrying(true);
    setTimeout(() => {
      setOutboxMessages((prev) =>
        prev.map((m) =>
          m.status === 'FAILED'
            ? {
                ...m,
                status: 'SENT',
                lastAttempt: t('Just now'),
                lastError: null,
              }
            : m
        )
      );
      setIsRetrying(false);
      setSuccess(t('Failed outbox events re-queued and delivered.'));
      setTimeout(() => setSuccess(''), 3000);
    }, 900);
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-slate-50 text-slate-900 select-none dark:bg-[#050609] dark:text-slate-100">
      <AppHeader
        title={t('Admin System: Transactional Outbox Queue')}
        subtitle={t(
          'Transactional Email Deliveries, Telegram Bot Payloads & Retry Telemetry'
        )}
      />

      <AdminNav />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="relative max-w-xs">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder={t('Search outbox queue...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 border-slate-200 bg-white pl-9 text-xs text-slate-900 dark:border-slate-800 dark:bg-[#090b14] dark:text-slate-200"
            />
          </div>

          <Button
            size="sm"
            disabled={statusCounts.FAILED === 0 || isRetrying}
            onClick={handleRetryFailed}
            className="border-rose-500/30 bg-rose-50 text-xs text-rose-700 hover:bg-rose-100 disabled:opacity-40 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
            variant="outline"
          >
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${isRetrying ? 'animate-spin' : ''}`}
            />
            {isRetrying ? t('Retrying...') : t('Retry Failed Events')}
            {statusCounts.FAILED > 0 && (
              <Badge className="ml-1.5 border-rose-500/40 bg-rose-500/15 text-[10px] text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                {statusCounts.FAILED}
              </Badge>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-[#090b14]/90">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {t('SENT')}
            </div>
            <div className="mt-1 font-mono text-2xl font-extrabold text-emerald-700 dark:text-emerald-400">
              {statusCounts.SENT}
            </div>
          </Card>
          <Card className="border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-[#090b14]/90">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {t('PENDING')}
            </div>
            <div className="mt-1 font-mono text-2xl font-extrabold text-cyan-700 dark:text-cyan-400">
              {statusCounts.PENDING}
            </div>
          </Card>
          <Card className="border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-[#090b14]/90">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {t('FAILED')}
            </div>
            <div className="mt-1 font-mono text-2xl font-extrabold text-rose-700 dark:text-rose-400">
              {statusCounts.FAILED}
            </div>
          </Card>
        </div>

        <Card className="overflow-hidden border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-[#090b14]/90 dark:backdrop-blur-xl">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-[#06080e]">
              <TableRow className="border-slate-200 hover:bg-transparent dark:border-slate-800">
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Outbox ID')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Channel')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Recipient Target')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Subject / Event')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Attempts')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Last Attempt')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Last Error')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Status')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMessages.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-8 text-center text-xs text-slate-500"
                  >
                    {t('No outbox events match your search.')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredMessages.map((m) => (
                  <TableRow
                    key={m.id}
                    className="border-slate-200 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/30"
                  >
                    <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400">
                      {m.id}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="border-cyan-500/30 bg-cyan-50 font-mono text-[10px] text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400"
                      >
                        {t(m.channel)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-900 dark:text-slate-200">
                      {m.recipient}
                    </TableCell>
                    <TableCell className="text-xs text-slate-800 dark:text-slate-300">
                      {t(m.subject)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400">
                      {m.attempts}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">
                      {t(m.lastAttempt)}
                    </TableCell>
                    <TableCell className="max-w-xs truncate font-mono text-[11px] text-rose-600 dark:text-rose-400">
                      {m.lastError ? t(m.lastError) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        className={
                          m.status === 'FAILED'
                            ? 'border-rose-500/40 bg-rose-500/15 text-[10px] text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'
                            : m.status === 'PENDING'
                              ? 'border-cyan-500/40 bg-cyan-500/15 text-[10px] text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400'
                              : 'border-emerald-500/40 bg-emerald-500/15 text-[10px] text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                        }
                      >
                        {t(m.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </main>
    </div>
  );
}
