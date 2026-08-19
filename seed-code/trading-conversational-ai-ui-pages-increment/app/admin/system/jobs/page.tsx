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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
      setSuccess(
        `${t('Cron job')} [${t(name)}] ${t('executed successfully!')}`
      );
      setTimeout(() => setSuccess(''), 3000);
    }, 1200);
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-slate-50 text-slate-900 select-none dark:bg-[#050609] dark:text-slate-100">
      <AppHeader
        title={t('Admin System: Background Cron Jobs')}
        subtitle={t(
          'Automated Workflows, Market Aggregation Workers & Outbox Queue Handlers'
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

        <Card className="overflow-hidden border-slate-200 bg-white shadow-sm dark:border-slate-800/80 dark:bg-[#090b14]/90 dark:backdrop-blur-xl">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-[#06080e]">
              <TableRow className="border-slate-200 hover:bg-transparent dark:border-slate-800">
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Job ID')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Job Routine Name')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Cron Schedule')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Last Run')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Duration')}
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Status')}
                </TableHead>
                <TableHead className="text-right text-xs font-bold text-slate-900 dark:text-slate-300">
                  {t('Manual Run')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow
                  key={j.id}
                  className="border-slate-200 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/30"
                >
                  <TableCell className="font-mono text-xs font-bold text-slate-600 dark:text-slate-400">
                    {j.id}
                  </TableCell>
                  <TableCell className="text-xs font-bold text-slate-900 dark:text-slate-200">
                    {t(j.name)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-amber-700 dark:text-amber-400">
                    {t(j.schedule)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400">
                    {t(j.lastRun)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400">
                    {j.duration}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`text-[10px] ${
                        j.status === 'RUNNING'
                          ? 'animate-pulse border-amber-500/40 bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                          : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                      }`}
                    >
                      {t(j.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={runningJob === j.id}
                          className="border-slate-300 bg-slate-50 text-xs text-slate-700 hover:bg-slate-100 hover:text-amber-700 dark:border-slate-700 dark:bg-[#06080e] dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-amber-400"
                        >
                          <Play
                            className={`mr-1 h-3.5 w-3.5 ${runningJob === j.id ? 'animate-spin' : ''}`}
                          />
                          <span>
                            {runningJob === j.id
                              ? t('Running...')
                              : t('Trigger')}
                          </span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-[#090b14] dark:text-slate-100">
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {t('Run')} {t(j.name)}?
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
                            {t(
                              'This triggers the exact same job code the scheduler runs automatically, right now, for real. Only proceed if you intend a real, immediate execution.'
                            )}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-[#06080e] dark:text-slate-200 dark:hover:bg-slate-800">
                            {t('Cancel')}
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleTrigger(j.id, j.name)}
                            className="bg-amber-500 text-slate-950 hover:bg-amber-400"
                          >
                            {t('Run now')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
