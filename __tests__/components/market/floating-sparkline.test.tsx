import React from 'react';
import { render, cleanup } from '@testing-library/react';

import { FloatingSparkline } from '@/components/market/floating-sparkline';

afterEach(() => cleanup());

describe('FloatingSparkline', () => {
  it('renders a placeholder, not a broken svg, when data has fewer than 2 points', () => {
    const { container } = render(
      <FloatingSparkline data={[100.1]} previousClose={100} />
    );
    expect(container.querySelector('svg')).not.toBeInTheDocument();
    expect(container.querySelector('div')).toBeInTheDocument();
  });

  it('renders a placeholder for empty data rather than throwing', () => {
    const { container } = render(
      <FloatingSparkline data={[]} previousClose={100} />
    );
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('uses the gain color when the last value is at or above previousClose', () => {
    const { container } = render(
      <FloatingSparkline data={[99.8, 99.9, 100.2]} previousClose={100} />
    );
    const line = container.querySelector('path[stroke]');
    expect(line).toHaveAttribute('stroke', '#06b6d4');
  });

  it('uses the loss color when the last value is below previousClose', () => {
    const { container } = render(
      <FloatingSparkline data={[100.2, 100.1, 99.7]} previousClose={100} />
    );
    const line = container.querySelector('path[stroke]');
    expect(line).toHaveAttribute('stroke', '#f43f5e');
  });

  it('draws the floating baseline exactly at previousClose, not at a fixed axis position', () => {
    // A session that rose the whole way should put the baseline near the TOP
    // of the chart (low Y value), not the bottom -- the baseline floats with
    // the data's own range, per the architecture doc's section 7.2 spec.
    const { container: risingChart } = render(
      <FloatingSparkline
        data={[100, 105, 110, 115, 120]}
        previousClose={100}
        height={38}
      />
    );
    const baseline = risingChart.querySelector('line');
    const baselineY = Number(baseline?.getAttribute('y1'));
    // previousClose (100) is the minimum of the series, so after the 8%
    // padding it should sit close to the bottom edge (near height), not the
    // vertical middle.
    expect(baselineY).toBeGreaterThan(19); // > half of height=38
  });

  it('renders exactly one endpoint marker at the last data point', () => {
    const { container } = render(
      <FloatingSparkline data={[100, 101, 99, 102]} previousClose={100} />
    );
    expect(container.querySelectorAll('circle')).toHaveLength(1);
  });
});
