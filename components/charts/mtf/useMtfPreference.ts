'use client';

/**
 * useMtfPreference — persisted state for the PRO M5-on-M15 overlay toggle.
 *
 * The toggle used to be plain component state, which meant it was lost on
 * reload and, more importantly, unreadable server-side — so the rendered-PNG
 * download had no way to match what the trader was looking at. It now lives in
 * `UserPreferences.m5OnM15`, which `/api/chart/download` reads to pick a
 * variant.
 *
 * Inert unless `active`, mirroring `useMtfOverlay`'s own discipline: the M5
 * chart in a stacked pair never shows the toggle, so it must not spend a
 * request loading a preference it will not use. Only the M15 instance fetches.
 *
 * Writes are optimistic. The toggle should feel instant, and a failed save
 * degrades to "the overlay is on for this session but the download may not
 * agree" — worth surfacing, not worth blocking the UI over.
 *
 * @module components/charts/mtf/useMtfPreference
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseMtfPreferenceResult {
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  /** True while the stored value is being loaded, or a save is in flight. */
  isSaving: boolean;
}

export function useMtfPreference(active: boolean): UseMtfPreferenceResult {
  const [enabled, setEnabledState] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Guards against a slow GET landing after the user has already toggled and
  // clobbering their choice with the stale stored value.
  const touchedRef = useRef(false);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;

    void (async (): Promise<void> => {
      try {
        const res = await fetch('/api/user/preferences');
        if (!res.ok) return;

        const body = await res.json();
        const stored = body?.preferences?.m5OnM15;

        if (cancelled || touchedRef.current) return;
        if (typeof stored === 'boolean') setEnabledState(stored);
      } catch {
        // A preferences read failure just means the toggle starts off.
      }
    })();

    return (): void => {
      cancelled = true;
    };
  }, [active]);

  const setEnabled = useCallback((next: boolean): void => {
    touchedRef.current = true;
    setEnabledState(next);
    setIsSaving(true);

    void (async (): Promise<void> => {
      try {
        await fetch('/api/user/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ m5OnM15: next }),
        });
      } catch (error) {
        console.error('[mtf] failed to persist overlay preference:', error);
      } finally {
        setIsSaving(false);
      }
    })();
  }, []);

  return { enabled, setEnabled, isSaving };
}
