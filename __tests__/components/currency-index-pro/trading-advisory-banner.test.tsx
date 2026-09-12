/**
 * Phase 5 V7 verification: "Disclaimer is permanently visible above the
 * screener." `TradingAdvisoryBanner` is a static component with no
 * props/state/gating condition -- this pins that it always renders the
 * spec's own required disclaimer text, so a future edit can't
 * accidentally make it conditional.
 */
import React from 'react';
import { render, cleanup, screen } from '@testing-library/react';

import { TradingAdvisoryBanner } from '@/components/currency-index-pro/tables/trading-advisory-banner';

afterEach(() => cleanup());

describe('TradingAdvisoryBanner', () => {
  it('always renders the required risk disclaimer text, unconditionally', () => {
    render(<TradingAdvisoryBanner />);
    expect(
      screen.getByText(/Professional Trading Advisory & Risk Protocol/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/traders MUST inspect the live candlestick chart/i)
    ).toBeInTheDocument();
  });
});
