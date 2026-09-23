/**
 * useAffiliateConfig() exposes minimumPayoutUsd (DECISION-LOG F83, §8A.2)
 */

import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { SWRConfig } from 'swr';

import { useAffiliateConfig } from '@/lib/hooks/useAffiliateConfig';

function wrapper({ children }: { children: React.ReactNode }) {
  // fresh cache per test so one test's response never leaks into another
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  );
}

describe('useAffiliateConfig — minimumPayoutUsd', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('defaults to 50 while loading or when the endpoint fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useAffiliateConfig(), { wrapper });

    expect(result.current.minimumPayoutUsd).toBe(50);
    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(result.current.minimumPayoutUsd).toBe(50);
  });

  it('returns the value served by /api/config/affiliate', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        discountPercent: 20,
        commissionPercent: 20,
        codesPerMonth: 15,
        regularPrice: 29,
        threeDayPrice: 1.99,
        minimumPayoutUsd: 75,
        lastUpdated: '2026-09-23T00:00:00.000Z',
      }),
    }) as unknown as typeof fetch;

    const { result } = renderHook(() => useAffiliateConfig(), { wrapper });

    await waitFor(() => expect(result.current.minimumPayoutUsd).toBe(75));
    expect(global.fetch).toHaveBeenCalledWith('/api/config/affiliate');
  });
});
