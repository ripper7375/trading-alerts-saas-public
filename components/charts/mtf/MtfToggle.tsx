'use client';

/**
 * MtfToggle — PRO-gated switch for multi-timeframe visualization (V8).
 *
 * PRO: toggles the M5 channel overlay on the current chart.
 * FREE: shows a locked control that routes to /pricing.
 *
 * @module components/charts/mtf/MtfToggle
 */

import { Layers, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { JSX } from 'react';

import { useLocale } from '@/lib/context/locale-context';

import { cn } from '@/lib/utils';

interface MtfToggleProps {
  isPro: boolean;
  enabled: boolean;
  isLoading?: boolean;
  className?: string;
  onToggle: (enabled: boolean) => void;
}

export function MtfToggle({
  isPro,
  enabled,
  isLoading = false,
  className,
  onToggle,
}: MtfToggleProps): JSX.Element {
  const router = useRouter();
  const { t } = useLocale();

  if (!isPro) {
    return (
      <button
        type="button"
        onClick={() => router.push('/pricing')}
        title={t(
          'charts.mtf_pro_hint',
          'Multi-timeframe visualization is a PRO feature — upgrade to unlock'
        )}
        className={cn(
          'border-border/80 bg-background/90 flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs text-muted-foreground transition-all hover:border-amber-500/40 hover:text-amber-400',
          className
        )}
      >
        <Lock className="h-3.5 w-3.5 text-amber-500" />
        <span>{t('charts.m5_overlay', 'M5 Overlay')}</span>
        <span className="rounded bg-amber-500/20 px-1 text-[9px] font-bold text-amber-400">
          PRO
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onToggle(!enabled)}
      disabled={isLoading}
      title={
        enabled
          ? t('charts.mtf_hide', 'Hide the M5 equal-distance channel overlay')
          : t(
              'charts.mtf_show',
              'Overlay the M5 equal-distance channel on this chart'
            )
      }
      className={cn(
        'shadow-xs flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-all',
        enabled
          ? 'border-cyan-500/60 bg-cyan-500/15 font-semibold text-cyan-400 shadow-sm shadow-cyan-500/20'
          : 'border-border/80 bg-background/90 text-muted-foreground hover:border-border hover:text-foreground',
        isLoading && 'opacity-60',
        className
      )}
    >
      <Layers className="h-3.5 w-3.5" />
      <span>{t('charts.m5_overlay', 'M5 Overlay')}</span>
      {isLoading && <span className="text-xs">…</span>}
    </button>
  );
}
