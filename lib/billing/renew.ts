/**
 * The "renew now" marker a dLocal subscriber carries from /settings/billing
 * through /checkout and back (Manage Subscription S4, workflow W6).
 *
 * The marker only asks for the renewal flow. Nothing trusts it: the checkout
 * pages confirm `renew_now` in `GET /api/subscription` before they open for a
 * PRO user, and the create-payment routes decide again on the server.
 *
 * @module lib/billing/renew
 */

/** Query parameter on /checkout that asks for the renewal flow. */
export const RENEW_PARAM = 'renew';

/** sessionStorage key holding the dLocal payment id of a renewal in flight. */
export const RENEW_PENDING_STORAGE_KEY = 'davintrade.dlocal.renewal';

/**
 * Where "Renew now" goes: the existing /checkout with the current period
 * preselected (a 3-day plan can only be bought once, so it renews as monthly),
 * the subscriber's country, and the renew marker.
 */
export function renewCheckoutHref(
  planType: string | null | undefined,
  country: string | null | undefined
): string {
  const yearly = planType === 'YEARLY';
  const params = new URLSearchParams({
    plan: yearly ? 'YEARLY' : 'MONTHLY',
    [RENEW_PARAM]: '1',
  });
  if (yearly) params.set('billing', 'yearly');
  if (country) params.set('country', country);
  return `/checkout?${params.toString()}`;
}

/** True when the URL asks for the renewal flow. */
export function wantsRenewal(searchParams: {
  get(name: string): string | null;
}): boolean {
  return searchParams.get(RENEW_PARAM) === '1';
}

/**
 * Remember that this browser tab started a renewal, so the return page can
 * offer "Back to billing". Best effort: storage can be blocked.
 */
export function rememberRenewalPayment(paymentId: string): void {
  try {
    window.sessionStorage.setItem(RENEW_PENDING_STORAGE_KEY, paymentId);
  } catch {
    // The return page then offers only its usual buttons.
  }
}

/** The payment id remembered by `rememberRenewalPayment`, else null. */
export function readRenewalPayment(): string | null {
  try {
    return window.sessionStorage.getItem(RENEW_PENDING_STORAGE_KEY);
  } catch {
    return null;
  }
}
