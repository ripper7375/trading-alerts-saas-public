import { redirect } from 'next/navigation';

/**
 * Retired -- superseded by `app/terminal/page.tsx` (PRO) and
 * `app/free/page.tsx` (FREE), Session 9-4. Permanent redirect rather than
 * deletion so any stale bookmark/external link still lands somewhere real.
 *
 * @deprecated Use /terminal or /free.
 */
export default function ChartsPageRedirect(): never {
  redirect('/terminal');
}
