/**
 * useHiddenCurrencyLines -- which currency lines are hidden on the
 * /pro/currency-index chart, and how that survives a reload.
 */
import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import {
  HIDDEN_LINES_STORAGE_KEY,
  parseHiddenCurrencies,
  useHiddenCurrencyLines,
} from '@/components/currency-index-pro/hooks/use-hidden-currency-lines';

const stored = (): unknown =>
  JSON.parse(localStorage.getItem(HIDDEN_LINES_STORAGE_KEY) ?? 'null');

describe('parseHiddenCurrencies', () => {
  it('returns an empty set for missing, malformed or non-array values', () => {
    expect(parseHiddenCurrencies(null).size).toBe(0);
    expect(parseHiddenCurrencies('').size).toBe(0);
    expect(parseHiddenCurrencies('{not json').size).toBe(0);
    expect(parseHiddenCurrencies('{"USD":true}').size).toBe(0);
    expect(parseHiddenCurrencies('"USD"').size).toBe(0);
  });

  it('keeps only known currency codes, once each', () => {
    const hidden = parseHiddenCurrencies(
      JSON.stringify(['JPY', 'XAU', 'usd', 'JPY', 42, 'EUR'])
    );
    expect([...hidden]).toEqual(['EUR', 'JPY']);
  });
});

describe('useHiddenCurrencyLines', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => jest.restoreAllMocks());

  it('starts with every line shown', () => {
    const { result } = renderHook(() => useHiddenCurrencyLines());
    expect(result.current.hidden.size).toBe(0);
  });

  it('restores the hidden lines saved by an earlier visit', () => {
    localStorage.setItem(
      HIDDEN_LINES_STORAGE_KEY,
      JSON.stringify(['CAD', 'NZD'])
    );
    const { result } = renderHook(() => useHiddenCurrencyLines());
    expect([...result.current.hidden]).toEqual(['CAD', 'NZD']);
  });

  it('toggles a line off and back on, saving each change', () => {
    const { result } = renderHook(() => useHiddenCurrencyLines());

    act(() => result.current.toggle('GBP'));
    expect(result.current.hidden.has('GBP')).toBe(true);
    expect(stored()).toEqual(['GBP']);

    act(() => result.current.toggle('USD'));
    // Saved in the fixed currency order, not click order.
    expect(stored()).toEqual(['USD', 'GBP']);

    act(() => result.current.toggle('GBP'));
    expect(result.current.hidden.has('GBP')).toBe(false);
    expect(stored()).toEqual(['USD']);
  });

  it('hides all 8 lines and shows them all again', () => {
    const { result } = renderHook(() => useHiddenCurrencyLines());

    act(() => result.current.hideAll());
    expect(result.current.hidden.size).toBe(8);
    expect(stored()).toEqual([
      'USD',
      'EUR',
      'GBP',
      'JPY',
      'AUD',
      'CAD',
      'CHF',
      'NZD',
    ]);

    act(() => result.current.showAll());
    expect(result.current.hidden.size).toBe(0);
    expect(stored()).toEqual([]);
  });

  it('keeps working when storage is unavailable', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    const { result } = renderHook(() => useHiddenCurrencyLines());
    expect(result.current.hidden.size).toBe(0);

    act(() => result.current.toggle('AUD'));
    expect(result.current.hidden.has('AUD')).toBe(true);
  });
});
