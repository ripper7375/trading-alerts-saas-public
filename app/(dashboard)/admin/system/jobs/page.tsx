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
            message: body.error ?? `Request failed (${response.status})`,
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
        [jobId]: { status: 'error', message: 'Network error' },
      }));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Scheduled Jobs &amp; Cron Manager
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          These 8 jobs run on money-service&apos;s own real-time scheduler. The
          monolith&apos;s legacy <code>/api/cron/*</code> routes are no longer
          scheduled by anything. No run-history timeline is shown below since
          neither service persists one yet.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {SYSTEM_CRON_JOBS.map((job) => {
          const runState = runStates[job.id] ?? { status: 'idle' };
          return (
            <Card key={job.id} className="border-gray-700 bg-gray-800">
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-white">{job.label}</CardTitle>
                  <CardDescription className="mt-1 text-gray-400">
                    {job.description}
                  </CardDescription>
                </div>
                <Badge className="bg-blue-700 text-white">
                  Managed by Money-Service Scheduler
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
                        className="border-gray-600 text-gray-200 hover:bg-gray-700"
                      >
                        {runState.status === 'running' ? 'Running…' : 'Run Now'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Run {job.label}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This triggers the exact same code money-service runs
                          on its own schedule, right now, for real. Only proceed
                          if you intend a real, immediate execution.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => triggerJob(job.id)}>
                          Run now
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  {runState.status === 'success' && (
                    <Badge className="bg-green-600 text-white">
                      Last triggered{' '}
                      {runState.triggeredAt
                        ? new Date(runState.triggeredAt).toLocaleTimeString()
                        : ''}{' '}
                      this session
                    </Badge>
                  )}
                  {runState.status === 'error' && (
                    <Badge className="bg-red-600 text-white">
                      {runState.message}
                    </Badge>
                  )}
                </div>

                {runState.status === 'success' &&
                  runState.result !== undefined && (
                    <pre className="overflow-x-auto rounded-md bg-gray-900 p-3 text-xs text-gray-300">
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
