import { redirect } from 'next/navigation';

/**
 * Terms of Service Page Redirect (Row 82)
 * Redirects to the canonical public Terms of Service page at /terms.
 */
export default function TermsPage(): never {
  redirect('/terms');
}
