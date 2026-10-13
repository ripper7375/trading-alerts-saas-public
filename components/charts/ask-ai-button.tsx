'use client';

/**
 * AskAiButton — a Panel C instant prompt (architecture 4.2 and 4.10, plan decision D10).
 *
 * One button per chart pane: "Explain the current M5 chart" on the M5 pane, the same for M15. The
 * visible text is the dictionary text of the fixed question (`intake.instant.m5` and `.m15`, which
 * part 3 translated into all 19 languages); the tooltip is the older label "Ask AI about M5
 * Chart". The button knows nothing about the network: `useInstantPrompt` owns the request and the
 * stacked charts hand its state down, so the two buttons share one request in flight.
 *
 * The button is for keyboard and screen-reader users too: it is a real `<button>`, its accessible
 * name is its visible text, it is `aria-busy` while its request runs, and a refusal is announced
 * (`role="status"`) next to it. While a request is in flight the button is disabled, so a double
 * click posts once.
 *
 * Layout: the text may be long (German) or wide (Thai) and runs right to left in Arabic and Urdu,
 * so the label wraps onto a second line instead of growing past the pane, and `dir` follows the
 * interface language. The chart itself stays left to right.
 *
 * @module components/charts/ask-ai-button
 */

import { Loader2, Sparkles } from 'lucide-react';

import { useLocale } from '@/lib/context/locale-context';
import { textDirection } from '@/lib/i18n/languages';
import type { InstantIntent } from '@/lib/intake/intents';
import { INSTANT_TEXT_KEY, INTAKE_TEXT } from '@/lib/intake/text';
import { cn } from '@/lib/utils';

export interface AskAiButtonProps {
  kind: InstantIntent;
  /** this button's request is in flight: the spinner shows */
  loading: boolean;
  /** a request is in flight anywhere on the chart (this button's or the other's) */
  disabled?: boolean;
  /** the text of a refusal to show beside the button, or null */
  notice?: string | null;
  onPress: (kind: InstantIntent) => void;
  className?: string;
}

export function AskAiButton({
  kind,
  loading,
  disabled = false,
  notice = null,
  onPress,
  className,
}: AskAiButtonProps): React.JSX.Element {
  const { t, language } = useLocale();
  const key = INSTANT_TEXT_KEY[kind];
  const label = t(key, INTAKE_TEXT[key]);
  const tooltip =
    kind === 'INSTANT_M5_INSPECT'
      ? t('Ask AI about M5 Chart')
      : t('Ask AI about M15 Chart');
  const timeframe = kind === 'INSTANT_M5_INSPECT' ? 'm5' : 'm15';

  return (
    <div
      dir={textDirection(language)}
      data-testid={`ask-ai-${timeframe}`}
      className={cn('flex max-w-full flex-col items-start gap-1', className)}
    >
      {notice !== null && (
        <p
          role="status"
          data-testid={`ask-ai-notice-${timeframe}`}
          className="shadow-xs backdrop-blur-xs bg-background/95 max-w-full rounded-md border border-amber-500/50 px-2 py-1 text-start text-[11px] leading-snug text-foreground [overflow-wrap:anywhere]"
        >
          {notice}
        </p>
      )}
      <button
        type="button"
        aria-label={label}
        aria-busy={loading}
        title={tooltip}
        disabled={disabled || loading}
        onClick={() => onPress(kind)}
        className="shadow-xs backdrop-blur-xs bg-background/90 group flex max-w-full cursor-pointer items-center gap-1.5 rounded-md border border-amber-500/60 px-2 py-1 text-start transition-all hover:border-amber-500 hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 active:scale-95 disabled:cursor-wait disabled:opacity-70 disabled:active:scale-100"
      >
        {loading ? (
          <Loader2
            aria-hidden="true"
            data-testid={`ask-ai-spinner-${timeframe}`}
            className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-500"
          />
        ) : (
          <Sparkles
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0 text-amber-500"
          />
        )}
        <span className="min-w-0 text-[11px] font-medium leading-tight text-foreground [overflow-wrap:anywhere]">
          {label}
        </span>
      </button>
    </div>
  );
}

/**
 * Where the button sits in a chart pane: bottom left, above the time axis, over the canvas. It is
 * absolutely positioned inside the pane's own `relative` box, so it takes no space and the split
 * arithmetic (`mtf-split-layout.ts`, `CHROME_PER_CHART`) and `TradingChart`'s own strip are
 * untouched.
 */
export function AskAiOverlay(props: AskAiButtonProps): React.JSX.Element {
  return (
    <div
      data-testid="ask-ai-overlay"
      className="pointer-events-auto absolute bottom-9 left-2.5 z-20 max-w-[calc(100%-1.25rem)]"
    >
      <AskAiButton {...props} />
    </div>
  );
}
