/**
 * System Cron Job Registry (Session 6-11, B2-15)
 *
 * The canonical list of the 8 jobs money-service's `CronsScheduler` actually
 * runs on a schedule (Session 4A-2/3, Slice 1 CUT-OVER) -- ported verbatim
 * from the monolith's own `app/api/cron/<job>/route.ts` handlers, which are
 * no longer scheduled by anything (`vercel.json`'s `crons` array is empty)
 * but still exist as manual/legacy endpoints. Job ids here match
 * money-service's `CronTriggerController` route segments
 * (`POST /v1/cron-trigger/<id>`) exactly -- do not rename without checking
 * both sides.
 *
 * @module lib/admin/system-jobs
 */

export interface SystemCronJob {
  id: string;
  label: string;
  description: string;
}

export const SYSTEM_CRON_JOBS: SystemCronJob[] = [
  {
    id: 'daily-maintenance',
    label: 'Daily Maintenance',
    description:
      'Expires past-due affiliate codes, flags expiring dLocal subscriptions, and downgrades expired ones in one pass.',
  },
  {
    id: 'check-expiring-subscriptions',
    label: 'Check Expiring Subscriptions',
    description:
      'Marks dLocal subscriptions within their reminder window for a 3-day expiry notice.',
  },
  {
    id: 'downgrade-expired-subscriptions',
    label: 'Downgrade Expired Subscriptions',
    description:
      'Downgrades PRO accounts whose dLocal subscription has fully expired back to FREE.',
  },
  {
    id: 'expire-codes',
    label: 'Expire Affiliate Codes',
    description: 'Marks affiliate codes past their expiresAt date as EXPIRED.',
  },
  {
    id: 'distribute-codes',
    label: 'Distribute Monthly Codes',
    description:
      'Issues the monthly affiliate code allotment to every active affiliate.',
  },
  {
    id: 'process-pending-disbursements',
    label: 'Process Pending Disbursements',
    description:
      'Batches and executes payable affiliate commissions through the active disbursement provider.',
  },
  {
    id: 'send-monthly-reports',
    label: 'Send Monthly Reports',
    description: 'Emails each affiliate their monthly code/commission summary.',
  },
  {
    id: 'sync-riseworks-accounts',
    label: 'Sync RiseWorks Accounts',
    description:
      'Reconciles RiseWorks payee records. RiseWorks is archived (F42) -- this job is dormant infrastructure, kept for parity.',
  },
];

export const SYSTEM_CRON_JOB_IDS = new Set(
  SYSTEM_CRON_JOBS.map((job) => job.id)
);
