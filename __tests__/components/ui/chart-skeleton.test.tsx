/**
 * ChartSkeleton -- the placeholder shown while a chart's code loads: the
 * chart's own card around a block of the chart's own height.
 */
import { render, screen } from '@testing-library/react';

import { ChartSkeleton } from '@/components/ui/chart-skeleton';

describe('ChartSkeleton', () => {
  it('reserves exactly the height it is given', () => {
    const { container } = render(<ChartSkeleton height={480} />);
    const block = container.querySelector('[data-slot="skeleton"]');
    expect(block).toHaveStyle({ height: '480px' });
  });

  it('wears the card the charts wear, so the page does not shift when one lands', () => {
    const { container } = render(<ChartSkeleton height={520} />);
    const card = container.querySelector('[data-slot="chart-skeleton"]');
    expect(card).toHaveClass(
      'w-full',
      'rounded-lg',
      'border',
      'border-border',
      'bg-card',
      'p-4'
    );
  });

  it('says it is busy to assistive technology', () => {
    render(<ChartSkeleton height={100} />);
    expect(
      document.querySelector('[data-slot="chart-skeleton"]')
    ).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByRole('img')).toBeNull();
  });
});
