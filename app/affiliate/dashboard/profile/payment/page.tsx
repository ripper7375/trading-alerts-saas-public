/**
 * Affiliate Payment Settings Page — retired (Session 6-7, A1-16)
 *
 * Superseded by `/affiliate/settings/payout`, the canonical Wise-based
 * payout configuration surface (Session 4A-W3b). Transparent redirect only
 * — no UI, no client bundle, matching the `/admin/login` → `/login`
 * precedent from Session 6-2.
 *
 * @module app/affiliate/dashboard/profile/payment/page
 */

import { redirect } from 'next/navigation';

export default function AffiliatePaymentPageRedirect(): never {
  redirect('/affiliate/settings/payout');
}
