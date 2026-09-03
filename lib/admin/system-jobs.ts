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
  labelKey: string;
  description: string;
  descriptionKey: string;
}

export const SYSTEM_CRON_JOBS: SystemCronJob[] = [
  {
    id: 'daily-maintenance',
    label: 'Daily Maintenance',
    labelKey: 'admin.system.job_daily_maintenance',
    description:
      'Expires past-due affiliate codes, flags expiring dLocal subscriptions, and downgrades expired ones in one pass.',
    descriptionKey: 'admin.system.job_daily_maintenance_desc',
  },
  {
    id: 'check-expiring-subscriptions',
    label: 'Check Expiring Subscriptions',
    labelKey: 'admin.system.job_check_expiring_subscriptions',
    description:
      'Marks dLocal subscriptions within their reminder window for a 3-day expiry notice.',
    descriptionKey: 'admin.system.job_check_expiring_subscriptions_desc',
  },
  {
    id: 'downgrade-expired-subscriptions',
    label: 'Downgrade Expired Subscriptions',
    labelKey: 'admin.system.job_downgrade_expired_subscriptions',
    description:
      'Downgrades PRO accounts whose dLocal subscription has fully expired back to FREE.',
    descriptionKey: 'admin.system.job_downgrade_expired_subscriptions_desc',
  },
  {
    id: 'expire-codes',
    label: 'Expire Affiliate Codes',
    labelKey: 'admin.system.job_expire_codes',
    description: 'Marks affiliate codes past their expiresAt date as EXPIRED.',
    descriptionKey: 'admin.system.job_expire_codes_desc',
  },
  {
    id: 'distribute-codes',
    label: 'Distribute Monthly Codes',
    labelKey: 'admin.system.job_distribute_codes',
    description:
      'Issues the monthly affiliate code allotment to every active affiliate.',
    descriptionKey: 'admin.system.job_distribute_codes_desc',
  },
  {
    id: 'process-pending-disbursements',
    label: 'Process Pending Disbursements',
    labelKey: 'admin.system.job_process_pending_disbursements',
    description:
      'Batches and executes payable affiliate commissions through the active disbursement provider.',
    descriptionKey: 'admin.system.job_process_pending_disbursements_desc',
  },
  {
    id: 'send-monthly-reports',
    label: 'Send Monthly Reports',
    labelKey: 'admin.system.job_send_monthly_reports',
    description: 'Emails each affiliate their monthly code/commission summary.',
    descriptionKey: 'admin.system.job_send_monthly_reports_desc',
  },
  {
    id: 'sync-riseworks-accounts',
    label: 'Sync RiseWorks Accounts',
    labelKey: 'admin.system.job_sync_riseworks_accounts',
    description:
      'Reconciles RiseWorks payee records. RiseWorks is archived (F42) -- this job is dormant infrastructure, kept for parity.',
    descriptionKey: 'admin.system.job_sync_riseworks_accounts_desc',
  },
];

export const SYSTEM_CRON_JOB_IDS = new Set(
  SYSTEM_CRON_JOBS.map((job) => job.id)
);
