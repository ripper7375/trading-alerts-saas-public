'use client';

/**
 * CurrencyIndexProUpgradeCard -- the "Upgrade to PRO" entry point on the public
 * /xaux-vs-usdx page, leading to the PRO comparison page.
 *
 * One button, three outcomes depending on who clicks:
 *
 * - Signed out  -> /login?callbackUrl=/pro/currency-index/compare. The login
 *                  form (and its 2FA step and social sign-in) returns there
 *                  after sign-in, via lib/auth/safe-callback-url.ts. A FREE
 *                  user then meets the page's own PRO gate (-> /pricing).
 * - FREE        -> the ProUpgradeModal gate, whose CTA goes to /pricing -- the
 *                  same gate app/free uses for every other PRO feature.
 * - PRO         -> straight to /pro/currency-index/compare. The label reads
 *                  "Open PRO Chart" rather than "Upgrade to PRO" for a user who
 *                  already has PRO.
 *
 * The tier read here is the session JWT's, which can lag a just-completed
 * upgrade. That only affects which door opens -- the destination page and its
 * API route both re-check the tier in the database, so no one is let in
 * wrongly and a just-upgraded user who lands on the modal can still reach
 * the page directly.
 */

import { Lock, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ProUpgradeModal } from '@/components/ui/pro-upgrade-modal';
import { useLocale } from '@/lib/context/locale-context';
import { CURRENCY_INDEX_COMPARE_PATH } from '@/lib/currency-index-comparison/series';

export function CurrencyIndexProUpgradeCard(): React.JSX.Element {
  const { t } = useLocale();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [modalOpen, setModalOpen] = useState(false);

  const isPro = session?.user?.tier === 'PRO';

  const handleClick = (): void => {
    if (status === 'loading') return;
    if (!session?.user) {
      router.push(
        `/login?callbackUrl=${encodeURIComponent(CURRENCY_INDEX_COMPARE_PATH)}`
      );
      return;
    }
    if (isPro) {
      router.push(CURRENCY_INDEX_COMPARE_PATH);
      return;
    }
    setModalOpen(true);
  };

  return (
    <>
      <div className="bg-card/80 flex max-w-md items-center gap-3 rounded-xl border border-amber-500/40 p-3 shadow-md">
        <Lock
          aria-hidden="true"
          className="h-6 w-6 shrink-0 text-amber-600 dark:text-amber-400"
        />
        <p className="text-xs font-semibold leading-snug text-foreground">
          {t(
            'Access 8 Currency Indexes + XAUX (Gold Index) with all Functions in the FREE Plan Plus OHLC Candle, Heiken Ashi Candle, HRMA, SMMA and Removal of Watermark'
          )}
        </p>
        <Button
          type="button"
          size="sm"
          onClick={handleClick}
          disabled={status === 'loading'}
          className="shrink-0 bg-amber-500 font-bold text-black hover:bg-amber-400"
        >
          <Sparkles className="mr-1 h-4 w-4" />
          {isPro ? t('Open PRO Chart') : t('Upgrade to PRO')}
        </Button>
      </div>
      <ProUpgradeModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        featureName="Currency Index PRO"
      />
    </>
  );
}
