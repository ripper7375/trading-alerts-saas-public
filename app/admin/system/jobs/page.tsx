'use client';

import { useState } from 'react';

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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { SYSTEM_CRON_JOBS } from '@/lib/admin/system-jobs';
import { useLocale } from '@/lib/context/locale-context';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface JobRunState {
  status: 'idle' | 'running' | 'success' | 'error';
  message?: string;
  result?: unknown;
  triggeredAt?: string;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// JOBS PAGE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Scheduled Jobs & Cron Manager - Client Component (Session 6-11, B2-15)
 *
 * Lists the 8 jobs money-service's `CronsScheduler` actually runs on
 * schedule today (the monolith's own `/api/cron/*` routes stopped being
 * scheduled at Session 4A-3 -- `vercel.json`'s `crons` array is empty).
 * Deliberately shows no "last run" timeline: neither service persists cron
 * run history anywhere, so a timestamp here would be fabricated. Each
 * "Run Now" forwards to money-service's real `CronTriggerController` and
 * shows the real, ephemeral result of that one call.
 */
export default function AdminSystemJobsPage(): React.ReactElement {
  const { t } = useLocale();
  const [runStates, setRunStates] = useState<Record<string, JobRunState>>({});

  const triggerJob = async (jobId: string): Promise<void> => {
    setRunStates((prev) => ({ ...prev, [jobId]: { status: 'running' } }));

    try {
      const response = await fetch(`/api/admin/system/jobs/${jobId}/trigger`, {
        method: 'POST',
      });
      const body = await response.json();

      if (!response.ok) {
        setRunStates((prev) => ({
          ...prev,
          [jobId]: {
            status: 'error',
            message:
              body.error ??
              t(
                'admin.system.request_failed',
                'Request failed ({status})'
              ).replace('{status}', String(response.status)),
          },
        }));
        return;
      }

      setRunStates((prev) => ({
        ...prev,
        [jobId]: {
          status: 'success',
          result: body.result,
          triggeredAt: body.triggeredAt,
        },
      }));
    } catch {
      setRunStates((prev) => ({
        ...prev,
        [jobId]: {
          status: 'error',
          message: t('admin.system.network_error', 'Network error'),
        },
      }));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t('admin.system.jobs_title', 'Scheduled Jobs & Cron Manager')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            'admin.system.jobs_subtitle_prefix',
            "These 8 jobs run on money-service's own real-time scheduler. The monolith's legacy"
          )}{' '}
          <code>/api/cron/*</code>{' '}
          {t(
            'admin.system.jobs_subtitle_suffix',
            'routes are no longer scheduled by anything. No run-history timeline is shown below since neither service persists one yet.'
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {SYSTEM_CRON_JOBS.map((job) => {
          const runState = runStates[job.id] ?? { status: 'idle' };
          return (
            <Card key={job.id} className="border-border bg-card">
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-foreground">
                    {t(job.labelKey, job.label)}
                  </CardTitle>
                  <CardDescription className="mt-1 text-muted-foreground">
                    {t(job.descriptionKey, job.description)}
                  </CardDescription>
                </div>
                <Badge className="bg-primary text-primary-foreground hover:bg-primary">
                  {t(
                    'admin.system.managed_by_money_service',
                    'Managed by Money-Service Scheduler'
                  )}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={runState.status === 'running'}
                      >
                        {runState.status === 'running'
                          ? t('admin.system.running', 'Running…')
                          : t('admin.system.run_now', 'Run Now')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {t(
                            'admin.system.run_job_confirm',
                            'Run {job}?'
                          ).replace('{job}', t(job.labelKey, job.label))}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {t(
                            'admin.system.run_job_warning',
                            'This triggers the exact same code money-service runs on its own schedule, right now, for real. Only proceed if you intend a real, immediate execution.'
                          )}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>
                          {t('Cancel', 'Cancel')}
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={() => triggerJob(job.id)}>
                          {t('admin.system.run_now_lower', 'Run now')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  {runState.status === 'success' && (
                    <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                      {t(
                        'admin.system.last_triggered_prefix',
                        'Last triggered'
                      )}{' '}
                      {runState.triggeredAt
                        ? new Date(runState.triggeredAt).toLocaleTimeString()
                        : ''}{' '}
                      {t('admin.system.last_triggered_suffix', 'this session')}
                    </Badge>
                  )}
                  {runState.status === 'error' && (
                    <Badge className="bg-red-600 text-white hover:bg-red-600">
                      {runState.message}
                    </Badge>
                  )}
                </div>

                {runState.status === 'success' &&
                  runState.result !== undefined && (
                    <pre className="overflow-x-auto rounded-md bg-accent p-3 text-xs text-muted-foreground">
                      {JSON.stringify(runState.result, null, 2)}
                    </pre>
                  )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
