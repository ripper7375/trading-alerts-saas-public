import { redirect } from 'next/navigation';

/**
 * Retired -- superseded by `app/terminal/page.tsx` (PRO) and
 * `app/free/page.tsx` (FREE), Session 9-4. Permanent redirect rather than
 * deletion so any stale bookmark/external link still lands somewhere real.
 * The symbol/timeframe params are dropped -- V8 is single-symbol (XAUUSD)
 * and both new workspace pages default to XAUUSD/M5 with an in-page
 * timeframe switcher, so there is no equivalent per-combination URL to
 * preserve.
 *
 * @deprecated Use /terminal or /free.
 */
export default function ChartPageRedirect(): never {
  redirect('/terminal');
}
