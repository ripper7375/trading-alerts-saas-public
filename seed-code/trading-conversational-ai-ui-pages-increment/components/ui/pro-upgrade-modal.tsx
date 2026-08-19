'use client';

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
import { Check, Zap, Sparkles, Lock, ShieldAlert } from 'lucide-react';
import { PRO_MONTHLY_PRICE } from '@/lib/tier-config';
import { useLocale } from '@/lib/context/locale-context';

interface ProUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
  onUpgradeSuccess?: () => void;
}

export function ProUpgradeModal({
  isOpen,
  onClose,
  featureName = 'Part 24 Engine 2: MTF Overlay (M5 on M15)',
  onUpgradeSuccess,
}: ProUpgradeModalProps) {
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
                className="border-amber-500/40 bg-amber-500/10 font-mono text-[10px] text-amber-700 uppercase dark:text-amber-400"
              >
                {t('PRO Subscriber Feature')}
              </Badge>
              <DialogTitle className="text-foreground text-xl font-bold tracking-tight">
                {t('Unlock')} {t(featureName, featureName)}
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
            {t(
              'Upgrade your account to unlock advanced multi-timeframe analytics, AI Analyst vision, real-time market comment feeds, and empirical wave channel overlays for XAUUSD.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="border-border/50 bg-muted/30 my-2 space-y-2.5 rounded-xl border p-3.5 text-xs">
          <div className="text-foreground flex items-center gap-2 font-medium">
            <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>
              <strong>{t('Part 24 Engine 2 MTF Overlay')}</strong>:{' '}
              {t('Overlays M5 EDT equal-distance channels onto M15 chart.')}
            </span>
          </div>
          <div className="text-foreground flex items-center gap-2 font-medium">
            <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>
              <strong>{t('Stack D Multimodal AI Analyst')}</strong>:{' '}
              {t('Real-time Gemini 3.6 & Claude 5 chart vision analysis.')}
            </span>
          </div>
          <div className="text-foreground flex items-center gap-2 font-medium">
            <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>
              <strong>{t('Stack E Live Market Comments')}</strong>:{' '}
              {t(
                'Real-time XAUUSD signal alerts & 4 progress quality metrics.'
              )}
            </span>
          </div>
          <div className="text-foreground flex items-center gap-2 font-medium">
            <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>
              {t('100 Active Price Alerts & 300 requests/hour API rate limit.')}
            </span>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between sm:space-x-0">
          <div className="flex flex-col">
            <span className="text-muted-foreground text-xs">
              {t('7-Day Free Trial')}
            </span>
            <span className="text-lg font-extrabold text-amber-700 dark:text-amber-400">
              {formatCurrency(PRO_MONTHLY_PRICE)}{' '}
              <span className="text-muted-foreground text-xs font-normal">
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
              size="sm"
              className="bg-gradient-to-r from-amber-500 to-amber-600 font-semibold text-black shadow-md shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500"
              onClick={() => {
                if (onUpgradeSuccess) onUpgradeSuccess();
                onClose();
              }}
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5 fill-black" />
              {t('Upgrade to PRO')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
