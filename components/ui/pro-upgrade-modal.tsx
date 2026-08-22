'use client';

import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Zap, Sparkles } from 'lucide-react';
import { PRO_MONTHLY_PRICE } from '@/lib/tier-config';
import { useLocale } from '@/lib/context/locale-context';

interface ProUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
}

/**
 * PRO upgrade nudge modal.
 *
 * `seed-code`'s own version fakes a successful upgrade in-place
 * (`onUpgradeSuccess()` flips local tier state on click, no real Stripe
 * checkout, no real subscription change) -- a real user clicking "Upgrade"
 * would see themselves marked PRO while their account is still FREE server-
 * side. The real upgrade path is `/pricing` (ported Session 9-2, real Stripe
 * price data via `useAffiliateConfig()`), owned end-to-end by Session 9-6 --
 * this modal's CTA navigates there instead of simulating success.
 */
export function ProUpgradeModal({
  isOpen,
  onClose,
  featureName = 'this feature',
}: ProUpgradeModalProps): React.JSX.Element {
  const { t, formatCurrency } = useLocale();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card/95 border-amber-500/30 backdrop-blur-xl sm:max-w-[480px]">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <Badge
                variant="outline"
                className="border-amber-500/40 bg-amber-500/10 font-mono text-[10px] uppercase text-amber-700 dark:text-amber-400"
              >
                {t('PRO Subscriber Feature')}
              </Badge>
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                {t('Unlock')} {t(featureName, featureName)}
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
            {t(
              'Upgrade your account to unlock multi-timeframe channel overlays, 100 active price alerts, and priority updates for XAUUSD.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="border-border/50 bg-muted/30 my-2 space-y-2.5 rounded-xl border p-3.5 text-xs">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>
              <strong>{t('M5-on-M15 Channel Overlay')}</strong>:{' '}
              {t('Overlays equal-distance channels onto the M15 chart.')}
            </span>
          </div>
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>
              {t('100 Active Price Alerts & drawing-tool line alerts.')}
            </span>
          </div>
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{t('Priority real-time market data updates.')}</span>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:space-x-0">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">
              {t('7-Day Free Trial')}
            </span>
            <span className="text-lg font-extrabold text-amber-700 dark:text-amber-400">
              {formatCurrency(PRO_MONTHLY_PRICE)}{' '}
              <span className="text-xs font-normal text-muted-foreground">
                / {t('month')}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-xs"
            >
              {t('Cancel')}
            </Button>
            <Button
              asChild
              size="sm"
              className="bg-gradient-to-r from-amber-500 to-amber-600 font-semibold text-slate-950 shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500"
            >
              <Link href="/pricing">
                <Sparkles className="mr-1.5 h-3.5 w-3.5 fill-black" />
                {t('Upgrade to PRO')}
              </Link>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
