/**
 * Affiliate Payment Settings Page — retired
 *
 * Superseded by `/affiliate/settings/payout`, the canonical Wise-based
 * payout configuration surface (which already renders the same
 * `WiseRecipientForm`). Transparent redirect only — matches Codebase 1's
 * retirement of this same route (Session 6-7, A1-16). No internal nav link
 * in Codebase 2 points here (the Partner Profile page's "Manage Payout
 * Settings" action already links directly to `/affiliate/settings/payout`),
 * so this only serves stale bookmarks/external links.
 *
 * @module app/affiliate/dashboard/profile/payment/page
 */

import { redirect } from 'next/navigation';

export default function AffiliatePaymentPageRedirect(): never {
  redirect('/affiliate/dashboard/payouts');
}
