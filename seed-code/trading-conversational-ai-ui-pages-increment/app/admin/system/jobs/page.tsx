'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Clock,
  Play,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Server,
  Zap,
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

export default function AdminSystemJobsPage() {
  const { t } = useLocale();
  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [success, setSuccess] = useState('');

  const [jobs, setJobs] = useState([
    {
      id: 'job-1',
      name: 'Timescale Candlestick Rollup (M5/M15)',
      schedule: 'Every 1 minute',
      lastRun: '45s ago',
      duration: '180ms',
      status: 'IDLE',
    },
    {
      id: 'job-2',
      name: 'Fractal Peak/Trough Calculation Engine',
      schedule: 'Continuous Event Driven',
      lastRun: '2s ago',
      duration: '12ms',
      status: 'RUNNING',
    },
    {
      id: 'job-3',
      name: 'Affiliate Commission Settlement Accrual',
      schedule: 'Hourly (00:00 UTC)',
      lastRun: '14m ago',
      duration: '840ms',
      status: 'IDLE',
    },
    {
      id: 'job-4',
      name: 'Outbox Email & Telegram Webhook Dispatcher',
      schedule: 'Every 10 seconds',
      lastRun: '3s ago',
      duration: '45ms',
      status: 'IDLE',
    },
    {
      id: 'job-5',
      name: 'Expired Session & Redis Token Purge',
      schedule: 'Daily at midnight',
      lastRun: '14h ago',
      duration: '1.2s',
      status: 'IDLE',
    },
  ]);

  const handleTrigger = (id: string, name: string) => {
    setRunningJob(id);
    setTimeout(() => {
      setRunningJob(null);
      setSuccess(t(`Cron job [${name}] executed successfully!`));
      setTimeout(() => setSuccess(''), 3000);
    }, 1200);
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-[#050609] text-slate-100 select-none">
      <AppHeader
        title={t('Admin System: Background Cron Jobs')}
        subtitle={t(
          'Automated Workflows, Market Aggregation Workers & Outbox Queue Handlers'
        )}
      />

      <AdminNav />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-6">
        {success && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3.5 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <Card className="overflow-hidden border-slate-800/80 bg-[#090b14]/90 backdrop-blur-xl">
          <Table>
            <TableHeader className="bg-[#06080e]">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Job ID')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Job Routine Name')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Cron Schedule')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Last Run')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Duration')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-300">
                  {t('Status')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-300">
                  {t('Manual Run')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow
                  key={j.id}
                  className="border-slate-800/60 hover:bg-slate-800/30"
                >
                  <TableCell className="font-mono text-xs font-bold text-slate-400">
                    {j.id}
                  </TableCell>
                  <TableCell className="text-xs font-bold text-slate-200">
                    {j.name}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-amber-400">
                    {j.schedule}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-400">
                    {j.lastRun}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-400">
                    {j.duration}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`text-[10px] ${
                        j.status === 'RUNNING'
                          ? 'animate-pulse border-amber-500/40 bg-amber-500/20 text-amber-400'
                          : 'border-emerald-500/40 bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {j.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTrigger(j.id, j.name)}
                      disabled={runningJob === j.id}
                      className="border-slate-700 bg-[#06080e] text-xs text-slate-300 hover:bg-slate-800 hover:text-amber-400"
                    >
                      <Play
                        className={`mr-1 h-3.5 w-3.5 ${runningJob === j.id ? 'animate-spin' : ''}`}
                      />
                      <span>
                        {runningJob === j.id ? t('Running...') : t('Trigger')}
                      </span>
                    </Button>
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
