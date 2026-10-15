'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Globe2, RefreshCw } from 'lucide-react';
import { useLocale } from '@/lib/context/locale-context';
import { worldGoldText } from '@/lib/i18n/world-gold-text';
import {
  formatDateTimeInZone,
  formatTimeInZone,
} from '@/lib/i18n/format-datetime';
import {
  formatLocalGoldAmount,
  formatLocalGoldPercent,
} from '@/lib/i18n/format-local-amount';
import { MARKETS } from '@/lib/world-gold/catalog';
import { MarketFlag } from '@/components/market/market-flag';

// Explicit wire shape keeps the browser independent of server-only provider/store imports.
interface MarketQuote {
  id: string;
  status: 'open' | 'closed';
  units: {
    id: string;
    price: number | null;
    previousClose: number | null;
    change: number | null;
    changePercent: number | null;
  }[];
  updatedAt: string | null;
  previousCloseAt: string | null;
}
interface WorldGoldResponse {
  generatedAt: string;
  gold: { price: number; updatedAt: string; stale: boolean } | null;
  fx: { provider: 'currencybeacon'; updatedAt: string; stale: boolean } | null;
  historyAvailable: boolean;
  markets: MarketQuote[];
}

export function WorldGoldMarket(): React.JSX.Element {
  const { language, dateFormat, timeFormat } = useLocale();
  const t = (key: string) => worldGoldText(language, key);
  const [data, setData] = useState<WorldGoldResponse | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const pending = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 20_000);
    try {
      const response = await fetch('/api/world-gold', {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('Unavailable');
      const next: unknown = await response.json();
      if (
        !next ||
        typeof next !== 'object' ||
        !Array.isArray((next as WorldGoldResponse).markets)
      )
        throw new Error('Invalid response');
      if (!controller.signal.aborted) {
        setData(next as WorldGoldResponse);
        setError(false);
      }
    } catch {
      if (timedOut || !controller.signal.aborted) setError(true);
    } finally {
      clearTimeout(timer);
      if (timedOut || !controller.signal.aborted) setLoading(false);
      if (pending.current === controller) pending.current = null;
    }
  }, []);
  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 60_000);
    return () => {
      clearInterval(interval);
      pending.current?.abort();
      pending.current = null;
    };
  }, [refresh]);

  const localClock = (hours: number, minutes: number) =>
    formatTimeInZone(new Date(Date.UTC(2000, 0, 1, hours, minutes)), {
      timezone: 'UTC',
      timeFormat,
    });
  const localHours = (text: string) =>
    text.replace(/(\d{2}):(\d{2})/g, (_match, hours: string, minutes: string) =>
      localClock(Number(hours), Number(minutes))
    );
  // Translate human-readable formula labels while retaining tickers and arithmetic.
  const localFormula = (line: string) =>
    line
      .replace(/\bPrice\b/g, t('worldGold.price'))
      .replace(/\bBase\b/g, t('worldGold.unit.baseGram'))
      .replace(/\bRetail\b/g, t('worldGold.unit.retailGram'))
      .replace(/\bSovereign\b/g, t('worldGold.unit.sovereign'))
      .replace(/\bbaht\b/g, t('worldGold.unit.baht'))
      .replace(/\btola\b/g, t('worldGold.unit.tola'))
      .replace(/\btael\b/g, t('worldGold.unit.tael'))
      .replace(/\boz\b/g, t('worldGold.unit.oz'))
      .replace(/\bkg\b/g, t('worldGold.unit.kg'))
      .replace(/\bg\b/g, t('worldGold.unit.gram'))
      .replace(/Çeyrek/g, t('worldGold.unit.ceyrek'));
  const delayed = data?.gold?.stale || data?.fx?.stale;
  const grid =
    'lg:grid lg:grid-cols-[1.4fr_1.7fr_1.5fr_1fr_0.85fr_2rem] lg:gap-5';
  const unavailable = <span className="text-muted-foreground">—</span>;
  return (
    <div className="container mx-auto max-w-screen-2xl space-y-6 px-4 py-8 md:px-6 md:py-12">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
            <Globe2 className="h-3.5 w-3.5" />
            {t('worldGold.indicative')}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            {t('worldGold.title')}
          </h1>
          <p className="text-lg text-muted-foreground">
            {t('worldGold.subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50 sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {t('worldGold.retry')}
        </button>
      </div>
      <p className="max-w-4xl text-sm leading-relaxed text-muted-foreground">
        {t('worldGold.explanation')}
      </p>
      <div aria-live="polite" className="space-y-2 text-sm">
        {loading && !data && (
          <p className="text-muted-foreground">{t('worldGold.loading')}</p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-rose-700 dark:text-rose-300"
          >
            {t('worldGold.error')}
          </p>
        )}
        {delayed && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300">
            {t('worldGold.stale')}
          </p>
        )}
        {data && (!data.gold || !data.fx) && (
          <p className="bg-muted/40 rounded-lg border border-border p-3 text-muted-foreground">
            {t('worldGold.sourceMissing')}
          </p>
        )}
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div
          className={`${grid} bg-muted/40 hidden border-b border-border px-6 py-4 text-xs font-semibold text-muted-foreground lg:grid`}
        >
          <span>{t('worldGold.country')}</span>
          <span>{t('worldGold.price')}</span>
          <span>{t('worldGold.change')}</span>
          <span>{t('worldGold.percent')}</span>
          <span>{t('worldGold.status')}</span>
          <span />
        </div>
        {MARKETS.map((market) => {
          const quote = data?.markets.find((row) => row.id === market.id);
          const open = expanded.has(market.id);
          const prefs = { timezone: market.timeZone, dateFormat, timeFormat };
          const localDate = (value: string) =>
            formatDateTimeInZone(value, prefs);
          return (
            <section
              key={market.id}
              aria-labelledby={`market-${market.id}`}
              className="border-b border-border last:border-b-0"
            >
              <div
                className={`${grid} space-y-4 px-4 py-5 lg:space-y-0 lg:px-6`}
              >
                <div className="flex items-start gap-3">
                  <MarketFlag code={market.countryCode} />
                  <div>
                    <h2
                      id={`market-${market.id}`}
                      className="text-sm font-bold"
                    >
                      {t(market.countryKey)}
                    </h2>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">
                      {market.currency}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {market.units.map((unit) => {
                    const value = quote?.units.find(
                      (row) => row.id === unit.id
                    );
                    return (
                      <div
                        key={unit.id}
                        className="flex flex-wrap items-baseline gap-x-2"
                      >
                        <span
                          className="font-mono text-base font-semibold tabular-nums"
                          dir="ltr"
                        >
                          {value?.price !== null && value?.price !== undefined
                            ? formatLocalGoldAmount(
                                value.price,
                                market.currency,
                                language
                              )
                            : unavailable}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          / {t(unit.labelKey)}
                        </span>
                      </div>
                    );
                  })}
                  <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {t('worldGold.updated')}:{' '}
                    {quote?.updatedAt ? localDate(quote.updatedAt) : '—'}
                    <br />
                    {market.timeZone}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground lg:hidden">
                    {t('worldGold.change')}
                  </p>
                  {market.units.map((unit) => {
                    const value = quote?.units.find(
                      (row) => row.id === unit.id
                    );
                    return (
                      <div
                        key={unit.id}
                        className={`min-h-6 font-mono text-sm tabular-nums ${value?.change !== null && value?.change !== undefined && value.change > 0 ? 'text-emerald-700 dark:text-emerald-400' : value?.change !== null && value?.change !== undefined && value.change < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-muted-foreground'}`}
                      >
                        <span dir="ltr">
                          {value?.change !== null && value?.change !== undefined
                            ? formatLocalGoldAmount(
                                value.change,
                                market.currency,
                                language,
                                true
                              )
                            : '—'}
                        </span>
                        <span className="ms-2 font-sans text-xs lg:hidden">
                          / {t(unit.labelKey)}
                        </span>
                      </div>
                    );
                  })}
                  {!quote?.previousCloseAt && (
                    <p className="text-[11px] text-muted-foreground">
                      {t('worldGold.noClose')}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground lg:hidden">
                    {t('worldGold.percent')}
                  </p>
                  {market.units.map((unit) => {
                    const value = quote?.units.find(
                      (row) => row.id === unit.id
                    );
                    return (
                      <div
                        key={unit.id}
                        className={`min-h-6 font-mono text-sm tabular-nums ${value?.changePercent !== null && value?.changePercent !== undefined && value.changePercent > 0 ? 'text-emerald-700 dark:text-emerald-400' : value?.changePercent !== null && value?.changePercent !== undefined && value.changePercent < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-muted-foreground'}`}
                      >
                        <span dir="ltr">
                          {value?.changePercent !== null &&
                          value?.changePercent !== undefined
                            ? formatLocalGoldPercent(
                                value.changePercent,
                                language
                              )
                            : '—'}
                        </span>
                        <span className="ms-2 font-sans text-xs lg:hidden">
                          / {t(unit.labelKey)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${quote?.status === 'open' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'border-border bg-muted text-muted-foreground'}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${quote?.status === 'open' ? 'bg-emerald-500' : 'bg-muted-foreground'}`}
                    />
                    {quote
                      ? t(
                          quote.status === 'open'
                            ? 'worldGold.open'
                            : 'worldGold.closed'
                        )
                      : '—'}
                  </span>
                </div>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`detail-${market.id}`}
                  aria-label={`${t(open ? 'worldGold.collapse' : 'worldGold.expand')} — ${t(market.countryKey)}`}
                  onClick={() =>
                    setExpanded((previous) => {
                      const next = new Set(previous);
                      if (next.has(market.id)) next.delete(market.id);
                      else next.add(market.id);
                      return next;
                    })
                  }
                  className="flex items-center gap-2 rounded-md p-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500"
                >
                  <span className="lg:hidden">{t('worldGold.details')}</span>
                  <ChevronDown
                    className={`h-5 w-5 transition-transform ${open ? 'rotate-180' : ''}`}
                  />
                </button>
              </div>
              {open && (
                <div
                  id={`detail-${market.id}`}
                  className="bg-muted/20 grid gap-6 border-t border-dashed border-border px-4 py-5 text-sm md:grid-cols-2 lg:px-6"
                >
                  <dl className="space-y-3">
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        {t('worldGold.centre')}
                      </dt>
                      <dd className="mt-1 font-medium">{market.centre}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        {t('worldGold.hours')} · {market.timeZone}
                      </dt>
                      <dd className="mt-1">{localHours(t(market.hoursKey))}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        {t('worldGold.benchmark')}
                      </dt>
                      <dd className="mt-1 font-mono" dir="ltr">
                        {formatTimeInZone(
                          new Date(
                            Date.UTC(
                              2000,
                              0,
                              1,
                              Math.floor(market.closeMinutes / 60),
                              market.closeMinutes % 60
                            )
                          ),
                          { timezone: 'UTC', timeFormat }
                        )}{' '}
                        · {market.timeZone}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        {t('worldGold.assumptions')}
                      </dt>
                      <dd className="mt-1 leading-relaxed">
                        {t(market.notesKey)}
                      </dd>
                    </div>
                  </dl>
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xs text-muted-foreground">
                        {t('worldGold.formula')}
                      </h3>
                      <div
                        className="mt-2 space-y-1 overflow-x-auto rounded-lg border border-border bg-background p-3"
                        dir="ltr"
                      >
                        {market.formula.map((line) => (
                          <p
                            key={localFormula(line)}
                            className="whitespace-nowrap font-mono text-xs leading-6"
                          >
                            {localFormula(line)}
                          </p>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {t('worldGold.previousClose')}:{' '}
                        {quote?.previousCloseAt
                          ? localDate(quote.previousCloseAt)
                          : t('worldGold.noClose')}
                      </p>
                      {quote?.previousCloseAt && (
                        <ul className="mt-2 space-y-1">
                          {market.units.map((unit) => {
                            const value = quote.units.find(
                              (row) => row.id === unit.id
                            );
                            return (
                              <li
                                key={unit.id}
                                className="flex flex-wrap gap-2 text-xs"
                              >
                                <span>{t(unit.labelKey)}</span>
                                <span className="font-mono" dir="ltr">
                                  {value?.previousClose !== null &&
                                  value?.previousClose !== undefined
                                    ? formatLocalGoldAmount(
                                        value.previousClose,
                                        market.currency,
                                        language
                                      )
                                    : '—'}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
      <div className="bg-muted/30 space-y-3 rounded-xl border border-border p-4 text-xs leading-relaxed text-muted-foreground">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <p className="font-semibold text-foreground">
              {t('worldGold.goldSource')}: XAUUSD · PostgreSQL / MT5
            </p>
            <p>
              {t('worldGold.sourceUpdated')}:{' '}
              {data?.gold?.updatedAt
                ? formatDateTimeInZone(data.gold.updatedAt, {
                    timezone: 'UTC',
                    dateFormat,
                    timeFormat,
                  })
                : '—'}{' '}
              UTC
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground">
              {t('worldGold.fxSource')}:{' '}
              <a
                href="https://currencybeacon.com"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                CurrencyBeacon
              </a>
            </p>
            <p>
              {t('worldGold.sourceUpdated')}:{' '}
              {data?.fx?.updatedAt
                ? formatDateTimeInZone(data.fx.updatedAt, {
                    timezone: 'UTC',
                    dateFormat,
                    timeFormat,
                  })
                : '—'}{' '}
              UTC
            </p>
          </div>
        </div>
        <p>{t('worldGold.sourceCadence')}</p>
        <p>{t('worldGold.scheduled')}</p>
        {data && !data.historyAvailable && (
          <p className="text-amber-700 dark:text-amber-300">
            {t('worldGold.historyUnavailable')}
          </p>
        )}
      </div>
    </div>
  );
}
