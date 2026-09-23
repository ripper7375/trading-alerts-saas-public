import { redirect } from 'next/navigation';

/**
 * Disbursement Configuration Page — retired (disbursement payout settings
 * stack, 2026-09-23)
 *
 * Superseded by `/admin/disbursement/settings`, which is DB-backed per
 * DECISION-LOG F83 (payout settings are `SystemConfig` rows, audited, applied
 * on the next payout run without a redeploy). This page was a Session 9-9
 * placeholder over hardcoded/env config whose `PATCH /api/disbursement/config`
 * persisted nothing; that placeholder API has been deleted. The payment
 * provider stays env-only (`DISBURSEMENT_PROVIDER`) and is shown read-only on
 * the new page.
 */
export default function DisbursementConfigRedirectPage(): never {
  redirect('/admin/disbursement/settings');
}
