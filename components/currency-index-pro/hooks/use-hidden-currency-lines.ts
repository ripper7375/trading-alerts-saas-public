'use client';

/**
 * useHiddenCurrencyLines — which of the 8 currency lines the viewer has
 * hidden on the `/pro/currency-index` relative-strength chart.
 *
 * Remembered per browser in localStorage rather than in
 * `UserCurrencyIndexPreference`: it is a viewing convenience, not a setting
 * anything else reads, and storing it server-side would need a schema change
 * and a migration for no functional gain. Storage can be unavailable or throw
 * (private windows, blocked site data), so every access is guarded and the
 * chart simply starts with all 8 lines shown.
 *
 * The stored value is read after mount, not in the state initializer, so the
 * server render and the first client render agree (all shown) and the toggle
 * buttons' `aria-pressed` never mismatches during hydration.
 *
 * @module components/currency-index-pro/hooks/use-hidden-currency-lines
 */

import { useCallback, useEffect, useState } from 'react';

import {
  ALL_CURRENCIES,
  type CurrencyCode,
} from '@/lib/currency-index-pro/pairs';

export const HIDDEN_LINES_STORAGE_KEY =
  'davintrade:currency-index-pro:hidden-lines';

const NONE_HIDDEN: ReadonlySet<CurrencyCode> = new Set();

/**
 * Parses a stored value into a valid hidden set. Anything unrecognised (bad
 * JSON, a non-array, unknown or duplicate codes) is dropped rather than
 * trusted, so a stale or hand-edited entry can never hide a line the viewer
 * cannot see a toggle for.
 */
export function parseHiddenCurrencies(
  raw: string | null
): ReadonlySet<CurrencyCode> {
  if (!raw) return NONE_HIDDEN;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return NONE_HIDDEN;
    return new Set(
      ALL_CURRENCIES.filter((currency) => parsed.includes(currency))
    );
  } catch {
    return NONE_HIDDEN;
  }
}

function persist(hidden: ReadonlySet<CurrencyCode>): void {
  try {
    // Stored in ALL_CURRENCIES order so the value is stable across toggles.
    localStorage.setItem(
      HIDDEN_LINES_STORAGE_KEY,
      JSON.stringify(ALL_CURRENCIES.filter((c) => hidden.has(c)))
    );
  } catch {
    // Not remembered next visit; the current view still applies.
  }
}

interface UseHiddenCurrencyLinesResult {
  hidden: ReadonlySet<CurrencyCode>;
  toggle: (currency: CurrencyCode) => void;
  showAll: () => void;
  hideAll: () => void;
}

export function useHiddenCurrencyLines(): UseHiddenCurrencyLinesResult {
  const [hidden, setHidden] = useState<ReadonlySet<CurrencyCode>>(NONE_HIDDEN);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(HIDDEN_LINES_STORAGE_KEY);
    } catch {
      return;
    }
    const restored = parseHiddenCurrencies(stored);
    if (restored.size > 0) setHidden(restored);
  }, []);

  const update = useCallback(
    (next: (prev: ReadonlySet<CurrencyCode>) => ReadonlySet<CurrencyCode>) =>
      setHidden((prev) => {
        const result = next(prev);
        persist(result);
        return result;
      }),
    []
  );

  const toggle = useCallback(
    (currency: CurrencyCode) =>
      update((prev) => {
        const result = new Set(prev);
        if (result.has(currency)) result.delete(currency);
        else result.add(currency);
        return result;
      }),
    [update]
  );

  const showAll = useCallback(() => update(() => NONE_HIDDEN), [update]);

  const hideAll = useCallback(
    () => update(() => new Set(ALL_CURRENCIES)),
    [update]
  );

  return { hidden, toggle, showAll, hideAll };
}
