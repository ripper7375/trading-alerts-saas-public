'use client';

/**
 * MarketContextBadge — the top-left badge of a chart pane, and the Panel C instant prompt
 * (architecture 4.2 and 4.10, ADR-098 D10, Owner Decision "Option A", 2026-10-14).
 *
 * The badge reads `[DavinTrade logo] XAUUSD · M15 Market Context •`. With the instant prompts off it
 * is the older badge: a PRO press hands a canned prompt to the chat panel (`onPress`). With them on
 * it is the instant prompt itself, so the chart carries no second control:
 *
 *  - PRO: a press posts `INSTANT_M15_INSPECT` (upper pane) or `INSTANT_M5_INSPECT` (lower pane),
 *    through `useInstantPrompt`, which owns the request;
 *  - FREE: the same press opens the upgrade modal (the hook does that);
 *  - while a request is in flight BOTH badges are disabled and `aria-busy` (one request for the
 *    whole chart), and the badge that was pressed shows a spinner where the active dot would be;
 *  - a refusal is the server's own reply, shown BELOW the badge and announced as a status.
 *
 * The file keeps its part 10 name; the bottom-left button it used to hold is gone. `TradingChart`
 * places the node it is given in its own absolutely positioned top-left box, so the badge takes no
 * space and the split arithmetic (`mtf-split-layout.ts`, `CHROME_PER_CHART`) is untouched.
 *
 * Accessibility and layout: a real `<button>` whose name is its visible text, with the question the
 * press asks ("Explain the current M5 chart", in the interface language) as its description. The
 * refusal runs in the direction of the interface language and wraps instead of growing past the
 * pane; the badge's own text stays left to right with the chart.
 *
 * @module components/charts/ask-ai-button
 */

import { Loader2 } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLocale } from '@/lib/context/locale-context';
import { textDirection } from '@/lib/i18n/languages';
import type { InstantIntent } from '@/lib/intake/intents';
import { INSTANT_TEXT_KEY, INTAKE_TEXT } from '@/lib/intake/text';
import { cn } from '@/lib/utils';

/** The Panel C state of one badge; absent on a plain badge. */
export interface InstantBadgeState {
  kind: InstantIntent;
  /** this badge's request is in flight: the spinner shows */
  loading: boolean;
  /** a request is in flight anywhere on the chart (this badge's or the other's) */
  busy: boolean;
  /** the text of a refusal to show below the badge, or null */
  notice: string | null;
  onPress: (kind: InstantIntent) => void;
}

export interface MarketContextBadgeProps {
  symbol: string;
  /** `M15` or `M5` for the two panes of the stacked charts */
  timeframe: string;
  /** this pane is the one the trader last pressed in: the amber ring and dot */
  active: boolean;
  /** a plain badge's press (ignored when `instant` is given) */
  onPress?: () => void;
  /** Panel C: present when the instant prompts are on and this pane has one (M5, M15) */
  instant?: InstantBadgeState;
}

export function MarketContextBadge({
  symbol,
  timeframe,
  active,
  onPress,
  instant,
}: MarketContextBadgeProps): React.JSX.Element {
  const { t, language } = useLocale();
  const id = timeframe.toLowerCase();
  const busy = instant?.busy ?? false;
  const loading = instant?.loading ?? false;
  const notice = instant?.notice ?? null;
  // the name is the visible text; the logo is decoration (its fallback letters are not part of it)
  const name = `${symbol} · ${timeframe} ${t('Market Context')}`;

  // what a press asks: the fixed question of the instant prompt, in the interface language
  const title = instant
    ? t(
        INSTANT_TEXT_KEY[instant.kind],
        INTAKE_TEXT[INSTANT_TEXT_KEY[instant.kind]]
      )
    : t('charts.instant_prompt_title', 'Instant prompt to AI chat');

  return (
    <div
      data-testid={`market-context-${id}`}
      className="flex max-w-full flex-col items-start gap-1"
    >
      <button
        type="button"
        title={title}
        aria-label={name}
        aria-busy={instant ? busy : undefined}
        disabled={busy}
        onClick={() => (instant ? instant.onPress(instant.kind) : onPress?.())}
        className={cn(
          'shadow-xs backdrop-blur-xs group flex max-w-full cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 active:scale-95 disabled:cursor-wait disabled:opacity-70 disabled:active:scale-100',
          active
            ? 'border-amber-500/70 bg-amber-500/10 ring-1 ring-amber-500/30'
            : 'border-border/80 bg-background/90 hover:bg-muted/80 hover:border-amber-500/50'
        )}
      >
        <Avatar
          aria-hidden="true"
          className="h-4 w-4 shrink-0 border border-amber-400/80"
        >
          <AvatarImage src="/DavinTrade_Logo.jpg" alt="DavinTrade" />
          <AvatarFallback className="text-[9px]">DT</AvatarFallback>
        </Avatar>
        <span className="shrink-0 font-mono text-xs font-semibold text-foreground">
          {symbol} · {timeframe}
        </span>
        <span className="min-w-0 text-[11px] font-medium text-muted-foreground [overflow-wrap:anywhere] group-hover:text-foreground">
          {t('Market Context')}
        </span>
        {loading ? (
          <Loader2
            aria-hidden="true"
            data-testid={`market-context-spinner-${id}`}
            className="h-3 w-3 shrink-0 animate-spin text-amber-500"
          />
        ) : (
          active && (
            <span
              data-testid={`market-context-active-${id}`}
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
            />
          )
        )}
      </button>
      {notice !== null && (
        <p
          role="status"
          dir={textDirection(language)}
          data-testid={`market-context-notice-${id}`}
          className="shadow-xs backdrop-blur-xs bg-background/95 max-w-[22rem] rounded-md border border-amber-500/50 px-2 py-1 text-start text-[11px] leading-snug text-foreground [overflow-wrap:anywhere]"
        >
          {notice}
        </p>
      )}
    </div>
  );
}
