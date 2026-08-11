import { redirect } from 'next/navigation';

/**
 * Affiliate Join Redirect (B2-11)
 *
 * `/affiliate/join` has no live callers left in this codebase --
 * `register-form.tsx:617` was already repointed to `/affiliate/register`
 * directly at Session 6-2. Built anyway as a transparent redirect so any
 * bookmark, external link, or search-indexed URL still resolves cleanly,
 * matching the app/(dashboard)/admin/disbursement/accounts/page.tsx
 * redirect-over-duplicate precedent.
 */
export default function AffiliateJoinRedirectPage(): never {
  redirect('/affiliate/register');
}
