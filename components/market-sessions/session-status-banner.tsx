'use client';

import { useEffect, useState } from 'react';
import { Clock, Moon } from 'lucide-react';

import { useLocale } from '@/lib/context/locale-context';
import {
  MARKET_SESSIONS,
  getMarketSessionState,
  getSessionDefinition,
  formatCountdown,
  type MarketSessionState,
} from '@/lib/market-sessions/sessions';
import { useUpcomingEvent } from './useUpcomingEvent';

/**
 * Market Session banner -- the D4 slot from `seed-code`'s market-comments
 * panel, rendered from the real clock.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 * ----------------------------------
 * The seed's version of this banner pairs the session label with an
 * "UPCOMING HIGH IMPACT NEWS/EVENT COUNTDOWN" seeded from a hardcoded
 * `5 * 3600 + 19 * 60 + 36` that simply ticks down -- a number with no
 * source behind it. That half is NOT reproduced here. There is no economic
 * event data in this repo yet, and inventing a countdown to an unnamed
 * event is exactly the fabrication `market-comments-panel.tsx` already
 * refuses to do (Session 9-4 Decision 2, "zero mock data").
 *
 * The countdown shown below is real: it is this session's own close, the
 * next session's open, or the weekend reopen -- all computed from the
 * clock. When the news lane lands, its countdown becomes a second row here.
 */
export function SessionStatusBanner() {
  const { t } = useLocale();
  const [state, setState] = useState<MarketSessionState | null>(null);
  const upcomingEvent = useUpcomingEvent();

  useEffect(() => {
    // Computed only after mount: session state depends on the current
    // instant, so rendering it during SSR guarantees a hydration mismatch.
    const tick = () => setState(getMarketSessionState(new Date()));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!state) {
    return (
      <div className="shrink-0 px-3">
        <div
          className="bg-muted/40 h-[74px] animate-pulse rounded-xl border border-border"
          aria-hidden="true"
        />
      </div>
    );
  }

  const primary = state.primarySessionId
    ? getSessionDefinition(state.primarySessionId)
    : undefined;

  // The next session to open, used only when the market trades but no
  // centre is currently in its hours.
  const nextToOpen = state.sessions
    .filter((s) => s.opensInSeconds !== null)
    .sort((a, b) => (a.opensInSeconds ?? 0) - (b.opensInSeconds ?? 0))[0];

  const primaryStatus = state.sessions.find((s) => s.id === primary?.id);

  let headline: string;
  let countdownLabel: string;
  let countdownSeconds: number | null;

  if (!state.isMarketOpen) {
    headline = t('Market Closed');
    countdownLabel = t('MARKET REOPENS IN');
    countdownSeconds = state.marketReopensInSeconds;
  } else if (primary && primaryStatus?.closesInSeconds !== null) {
    headline = `${primary.countryCode} ${t(primary.name)} ${t('Session')}`;
    countdownLabel = t('SESSION CLOSES IN');
    countdownSeconds = primaryStatus?.closesInSeconds ?? null;
  } else {
    const next = nextToOpen ? getSessionDefinition(nextToOpen.id) : undefined;
    headline = next ? `${t('Next')}: ${t(next.name)}` : t('Between Sessions');
    countdownLabel = t('NEXT SESSION OPENS IN');
    countdownSeconds = nextToOpen?.opensInSeconds ?? null;
  }

  const isOpen = state.isMarketOpen;

  return (
    <div className="shrink-0 px-3">
      <div
        className={
          isOpen
            ? 'relative overflow-hidden rounded-xl border border-amber-500/60 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 p-3.5 text-slate-950 shadow-xl shadow-amber-500/15'
            : 'bg-muted/60 relative overflow-hidden rounded-xl border border-border p-3.5 text-foreground'
        }
      >
        <div className="mb-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-sm font-black">
            {isOpen && primary ? (
              <span className="text-base" aria-hidden="true">
                {primary.flag}
              </span>
            ) : (
              <Moon className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{headline}</span>
          </div>

          <div
            className="flex items-center gap-1 text-[11px] font-bold"
            title={t('Sydney, Tokyo, London and New York trading sessions')}
          >
            {MARKET_SESSIONS.map((session) => {
              const status = state.sessions.find((s) => s.id === session.id);
              const active = status?.isOpen ?? false;
              return (
                <span
                  key={session.id}
                  className={
                    active
                      ? 'opacity-100'
                      : 'opacity-35 grayscale transition-opacity'
                  }
                  title={`${t(session.name)}${active ? ` — ${t('Open')}` : ` — ${t('Closed')}`}`}
                  aria-label={`${t(session.name)}: ${active ? t('Open') : t('Closed')}`}
                >
                  {session.flag}
                </span>
              );
            })}
            <Clock
              className={
                isOpen
                  ? 'ml-1 inline h-3.5 w-3.5 text-slate-900'
                  : 'ml-1 inline h-3.5 w-3.5 text-muted-foreground'
              }
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span
            className={
              isOpen
                ? 'text-[10px] font-bold uppercase tracking-tight opacity-90'
                : 'text-[10px] font-bold uppercase tracking-tight text-muted-foreground'
            }
          >
            {countdownLabel}
          </span>
          <span
            className={
              isOpen
                ? 'shadow-xs rounded-md bg-amber-400/90 px-2.5 py-0.5 font-mono text-base font-black tracking-widest text-slate-950'
                : 'rounded-md border border-border bg-background px-2.5 py-0.5 font-mono text-base font-black tracking-widest text-foreground'
            }
          >
            {countdownSeconds === null
              ? '--:--:--'
              : formatCountdown(countdownSeconds)}
          </span>
        </div>

        {/*
          The news row. Rendered ONLY when there is a real event: while the
          calendar lane is undeployed, the table empty, or the request refused,
          this disappears entirely rather than showing a placeholder countdown
          to an event that does not exist. seed-code's version ticked down from
          a hardcoded 5*3600+19*60+36 with nothing behind it; that is exactly
          what this must never do.

          Safe to compute against Date.now() in render: the session clock above
          re-renders this component every second anyway.
        */}
        {upcomingEvent && (
          <div
            className={
              isOpen
                ? 'mt-2 border-t border-amber-700/25 pt-1.5'
                : 'mt-2 border-t border-border pt-1.5'
            }
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={
                  isOpen
                    ? 'truncate text-[10px] font-bold uppercase tracking-tight opacity-90'
                    : 'truncate text-[10px] font-bold uppercase tracking-tight text-muted-foreground'
                }
                title={upcomingEvent.eventName}
              >
                {t('UPCOMING HIGH IMPACT')} · {upcomingEvent.currency}
              </span>
              <span
                className={
                  isOpen
                    ? 'shadow-xs shrink-0 rounded-md bg-amber-400/90 px-2.5 py-0.5 font-mono text-sm font-black tracking-widest text-slate-950'
                    : 'shrink-0 rounded-md border border-border bg-background px-2.5 py-0.5 font-mono text-sm font-black tracking-widest text-foreground'
                }
              >
                {/*
                  A non-zero time_mode means upstream only knows the day, or is
                  estimating. Prefixing "~" stops a second-resolution readout
                  implying precision the source does not have.
                */}
                {upcomingEvent.timeMode ? '~' : ''}
                {formatCountdown(
                  upcomingEvent.eventTime - Math.floor(Date.now() / 1000)
                )}
              </span>
            </div>
            <div
              className={
                isOpen
                  ? 'truncate text-[11px] font-semibold opacity-80'
                  : 'truncate text-[11px] font-semibold text-muted-foreground'
              }
            >
              {upcomingEvent.eventName}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
