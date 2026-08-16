import { redirect } from 'next/navigation';

/**
 * Terms of Service Page Redirect
 * Redirects to the canonical public Terms of Service page at /terms
 */
export default function TermsPage(): never {
  redirect('/terms');
}
