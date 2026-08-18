import { redirect } from 'next/navigation';

/**
 * Affiliate Payout Settings Page — retired from affiliate responsibility.
 * Payout configuration and disbursement accounts are under Admin responsibility
 * in /admin/disbursement/config and /admin/disbursement/accounts.
 */
export default function AffiliatePayoutSettingsRedirect(): never {
  redirect('/affiliate/dashboard/payouts');
}
