'use client';

import { useEffect, useState } from 'react';
import { CURRENCY_USD_RATES, type DisplayUsdRates } from '@/lib/country-config';
import {
  FX_BROWSER_REFRESH_MS,
  FX_MAX_DAILY_RATE_AGE_MS,
  FX_MAX_RETAINED_AGE_MS,
  FX_SUPPORTED_CURRENCIES,
} from './rate-contract';

function isFixedSnapshot(snapshot: DisplayUsdRates): boolean {
  return (
    snapshot.provider === 'fixed' ||
    (snapshot.provider === undefined && snapshot.source === 'fallback')
  );
}

/** Publication age and the age of our retained copy have separate bounds. */
function snapshotExpiresAt(snapshot: DisplayUsdRates): number {
  if (isFixedSnapshot(snapshot)) return Infinity;
  const fetchedAt = Date.parse(snapshot.fetchedAt);
  if (!Number.isFinite(fetchedAt)) return -Infinity;
  const retainedUntil = fetchedAt + FX_MAX_RETAINED_AGE_MS;
  if (
    snapshot.provider !== 'currencybeacon' &&
    snapshot.provider !== 'frankfurter'
  )
    return retainedUntil;
  const publishedAt =
    typeof snapshot.rateUpdatedAt === 'string'
      ? Date.parse(snapshot.rateUpdatedAt)
      : NaN;
  if (!Number.isFinite(publishedAt)) return -Infinity;
  return Math.min(
    retainedUntil,
    publishedAt +
      (snapshot.provider === 'frankfurter'
        ? FX_MAX_DAILY_RATE_AGE_MS
        : FX_MAX_RETAINED_AGE_MS)
  );
}

function expireSnapshot(
  current: DisplayUsdRates | null,
  nowMs = Date.now()
): DisplayUsdRates | null {
  if (!current || nowMs <= snapshotExpiresAt(current)) return current;
  return {
    rates: { ...CURRENCY_USD_RATES },
    source: 'fallback',
    provider: 'fixed',
    fetchedAt: new Date(nowMs).toISOString(),
    rateUpdatedAt: null,
  };
}

/** Accept a complete display snapshot, never mix partial rates into old prices. */
export function isDisplayRateSnapshot(
  value: unknown
): value is DisplayUsdRates {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<DisplayUsdRates>;
  if (snapshot.source !== 'live' && snapshot.source !== 'fallback')
    return false;
  if (
    typeof snapshot.fetchedAt !== 'string' ||
    !Number.isFinite(Date.parse(snapshot.fetchedAt))
  )
    return false;
  if (!snapshot.rates || typeof snapshot.rates !== 'object') return false;
  if (
    !FX_SUPPORTED_CURRENCIES.every((currency) => {
      const rate = snapshot.rates?.[currency];
      return typeof rate === 'number' && Number.isFinite(rate) && rate > 0;
    }) ||
    snapshot.rates['USD'] !== 1
  )
    return false;
  if (
    snapshot.provider !== undefined &&
    !['currencybeacon', 'frankfurter', 'fixed'].includes(snapshot.provider)
  )
    return false;
  const validPublicationTime =
    snapshot.rateUpdatedAt === undefined ||
    snapshot.rateUpdatedAt === null ||
    (typeof snapshot.rateUpdatedAt === 'string' &&
      Number.isFinite(Date.parse(snapshot.rateUpdatedAt)));
  return (
    validPublicationTime &&
    Date.now() <= snapshotExpiresAt(snapshot as DisplayUsdRates)
  );
}

function newerSnapshot(
  current: DisplayUsdRates | null,
  next: DisplayUsdRates
): DisplayUsdRates {
  if (
    current &&
    !isFixedSnapshot(current) &&
    Date.parse(next.fetchedAt) < Date.parse(current.fetchedAt)
  )
    return current;
  if (
    current &&
    current.fetchedAt === next.fetchedAt &&
    current.source === next.source &&
    current.provider === next.provider &&
    current.rateUpdatedAt === next.rateUpdatedAt &&
    FX_SUPPORTED_CURRENCIES.every(
      (currency) => current.rates[currency] === next.rates[currency]
    )
  )
    return current;
  return next;
}

/** Hydrate from the server, then refresh one public snapshot for every price consumer. */
export function useDisplayUsdRates(
  initialRates?: DisplayUsdRates | null
): DisplayUsdRates | null {
  const [rates, setRates] = useState<DisplayUsdRates | null>(
    initialRates ?? null
  );
  const enabled = Boolean(initialRates);

  useEffect(() => {
    setRates((current) => {
      const retained = expireSnapshot(current);
      return initialRates && isDisplayRateSnapshot(initialRates)
        ? newerSnapshot(retained, initialRates)
        : retained;
    });
  }, [initialRates]);

  useEffect(() => {
    if (!rates) return;
    const expiresAt = snapshotExpiresAt(rates);
    if (!Number.isFinite(expiresAt)) return;
    const expiryTimer = setTimeout(
      () => setRates((current) => expireSnapshot(current)),
      Math.max(0, expiresAt - Date.now() + 1)
    );
    return () => clearTimeout(expiryTimer);
  }, [rates]);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let activeRequest: AbortController | null = null;
    let activeTimeout: ReturnType<typeof setTimeout> | undefined;

    const refresh = async (): Promise<void> => {
      if (stopped) return;
      // Expire before waiting for a request, including while offline or hidden.
      setRates((current) => expireSnapshot(current));
      if (activeRequest || document.visibilityState === 'hidden') return;
      const request = new AbortController();
      activeRequest = request;
      const timeout = setTimeout(() => request.abort(), 10_000);
      activeTimeout = timeout;
      try {
        const response = await fetch('/api/fx/rates', {
          cache: 'no-store',
          signal: request.signal,
        });
        if (!response.ok || stopped || request.signal.aborted) return;
        const snapshot: unknown = await response.json();
        if (
          !stopped &&
          !request.signal.aborted &&
          isDisplayRateSnapshot(snapshot)
        ) {
          setRates((current) =>
            newerSnapshot(expireSnapshot(current), snapshot)
          );
        }
      } catch {
        // Retain a still-valid snapshot; expiry remains independent of network success.
      } finally {
        clearTimeout(timeout);
        if (activeRequest === request) {
          activeRequest = null;
          activeTimeout = undefined;
        }
      }
    };

    const resume = (): void => {
      void refresh();
    };
    const timer = setInterval(resume, FX_BROWSER_REFRESH_MS);
    window.addEventListener('focus', resume);
    window.addEventListener('online', resume);
    document.addEventListener('visibilitychange', resume);
    // Hydration already used the server snapshot; check without extending its age.
    void refresh();
    return () => {
      stopped = true;
      clearInterval(timer);
      activeRequest?.abort();
      clearTimeout(activeTimeout);
      window.removeEventListener('focus', resume);
      window.removeEventListener('online', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [enabled]);

  return rates;
}
