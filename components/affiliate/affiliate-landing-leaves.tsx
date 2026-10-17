'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

import { Slider } from '@/components/ui/slider';
import { useLocale } from '@/lib/context/locale-context';
import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';

/**
 * The three pieces of the public /affiliate page that need the browser: which
 * of three pages to show for the signed-in user, the sentence that quotes the
 * price and commission, and the earnings calculator. The page itself is a
 * Server Component that builds every page (admin, existing affiliate, visitor)
 * on the server; the gate only chooses among them.
 *
 * @module components/affiliate/affiliate-landing-leaves
 */

/**
 * Shows the admin page for an admin (and sends them to /admin), the
 * existing-affiliate page for an affiliate, and the visitor page for everyone
 * else -- including while the session is still loading, as before.
 */
export function AffiliateSessionGate({
  adminView,
  affiliateView,
  children,
}: {
  adminView: React.ReactNode;
  affiliateView: React.ReactNode;
  /** The visitor page. */
  children: React.ReactNode;
}): React.ReactElement {
  const router = useRouter();
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.user?.role === 'ADMIN') {
      router.push('/admin');
    }
  }, [session, router]);

  if (session?.user?.role === 'ADMIN') return <>{adminView}</>;
  if (session?.user?.isAffiliate) return <>{affiliateView}</>;
  return <>{children}</>;
}

/** "Based on active PRO subscriptions at {price}/mo with {percent}% commission." */
export function AffiliateCalculatorBasisText({
  template,
}: {
  /** The translated sentence, with `{price}` and `{percent}` in it. */
  template: string;
}): React.ReactElement {
  const { formatCurrency } = useLocale();
  const { commissionPercent, regularPrice } = useAffiliateConfig();
  return (
    <>
      {template
        .replace('{price}', formatCurrency(regularPrice))
        .replace('{percent}', String(commissionPercent))}
    </>
  );
}

export interface AffiliateCalculatorLabels {
  activeReferredTraders: string;
  traders: string;
  monthlyRecurring: string;
  perMonth: string;
  annualPotential: string;
  perYear: string;
}

export function AffiliateEarningsCalculator({
  labels,
}: {
  labels: AffiliateCalculatorLabels;
}): React.ReactElement {
  const { formatCurrency } = useLocale();
  const { commissionPercent, regularPrice } = useAffiliateConfig();
  const [referralsCount, setReferralsCount] = useState(50);

  const monthlyEarnings = Math.round(
    referralsCount * regularPrice * (commissionPercent / 100)
  );
  const annualEarnings = monthlyEarnings * 12;

  return (
    <>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {labels.activeReferredTraders}:
          </span>
          <span className="font-mono text-lg font-bold text-amber-700 dark:text-amber-400">
            {referralsCount} {labels.traders}
          </span>
        </div>
        <Slider
          value={[referralsCount]}
          min={5}
          max={500}
          step={5}
          onValueChange={(val) => setReferralsCount(val[0] ?? 5)}
          className="py-4"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-[#06080e]">
        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {labels.monthlyRecurring}
          </div>
          <div className="font-mono text-3xl font-extrabold text-emerald-700 dark:text-emerald-400 md:text-4xl">
            {formatCurrency(monthlyEarnings)}
          </div>
          <div className="text-[11px] text-slate-500">{labels.perMonth}</div>
        </div>
        <div className="space-y-1 border-l border-slate-200 dark:border-slate-800">
          <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {labels.annualPotential}
          </div>
          <div className="font-mono text-3xl font-extrabold text-amber-700 dark:text-amber-400 md:text-4xl">
            {formatCurrency(annualEarnings)}
          </div>
          <div className="text-[11px] text-slate-500">{labels.perYear}</div>
        </div>
      </div>
    </>
  );
}
