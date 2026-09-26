/**
 * PlanSelector Component Tests
 *
 * Tests the plan selection functionality:
 * - Renders monthly plan option
 * - Renders 3-day plan when eligible
 * - Disables 3-day plan when not eligible
 * - Handles plan selection callbacks
 *
 * @module __tests__/components/payments/PlanSelector.test
 */

import React from 'react';
import {
  render as rtlRender,
  screen,
  fireEvent,
  type RenderOptions,
} from '@testing-library/react';

import { PlanSelector } from '@/components/payments/PlanSelector';
import { LocaleProvider } from '@/lib/context/locale-context';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';

// PlanSelector (batch-6 locale wiring) now calls useLocale() -- needs a
// LocaleProvider ancestor. Shadow `render` once (LESSONS-LEARNED.md L40) --
// RTL's own rerender() reuses whatever wrapper the original render() call
// used, so this fixes every call site in this file without touching each
// one individually.
function render(ui: React.ReactElement, options?: RenderOptions) {
  return rtlRender(ui, { wrapper: LocaleProvider, ...options });
}

// LocaleProvider calls usePathname() directly (L40's own stub).
jest.mock('next/navigation', () => ({
  usePathname: () => '/checkout',
}));

beforeEach(() => {
  localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(defaultPreferences));
});

// Mock useAffiliateConfig to prevent SWR async state updates (act() warnings)
jest.mock('@/lib/hooks/useAffiliateConfig', () => ({
  useAffiliateConfig: () => ({
    config: undefined,
    discountPercent: 20,
    commissionPercent: 20,
    codesPerMonth: 15,
    regularPrice: 29.0,
    threeDayPrice: 1.99,
    // SystemConfig annual price; 240 < 12 x 29, so the plan shows a saving
    annualPrice: 240,
    annualSavingsPercent: 31,
    calculateDiscountedPrice: (price: number) => price * 0.8,
    calculateCommissionAmount: (price: number) => price * 0.8 * 0.2,
    calculateDiscountAmount: (price: number) => price * 0.2,
    isLoading: false,
    error: undefined,
  }),
}));

describe('PlanSelector', () => {
  const defaultProps = {
    value: 'MONTHLY' as const,
    onChange: jest.fn(),
    canUseThreeDayPlan: true,
    showThreeDayPlan: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render monthly plan option', () => {
      render(<PlanSelector {...defaultProps} showThreeDayPlan={false} />);

      expect(screen.getByText('Monthly')).toBeInTheDocument();
      // formatCurrency() converts the USD price into the seeded locale's own
      // currency (GBP, rate 0.78) rather than showing the raw USD figure --
      // 29.00 * 0.78 = 22.62, matching landing-pricing.tsx's identical
      // treatment of the same useAffiliateConfig() price.
      expect(screen.getByText(/£22\.62/)).toBeInTheDocument();
    });

    it('should render 3-day plan when showThreeDayPlan is true', () => {
      render(<PlanSelector {...defaultProps} />);

      expect(screen.getByText('3-Day Trial')).toBeInTheDocument();
      // 1.99 * 0.78 = 1.5522, rounded to 2 decimals by Intl.NumberFormat.
      expect(screen.getByText(/£1\.55/)).toBeInTheDocument();
    });

    // Davin's /checkout screenshot: Thailand selected with English (UK) as the
    // language showed £ plan cards over a ฿ total.
    it('shows prices in the charged currency when one is given', () => {
      render(<PlanSelector {...defaultProps} currency="THB" />);

      // Fixed THB rate 35: 29 -> 1,015 (>= 1000, no decimals), 240 -> 8,400.
      expect(screen.getByText(/THB\s1,015/)).toBeInTheDocument();
      expect(screen.getByText(/THB\s8,400/)).toBeInTheDocument();
      expect(screen.queryByText(/£/)).not.toBeInTheDocument();
    });

    it('should not render 3-day plan when showThreeDayPlan is false', () => {
      render(<PlanSelector {...defaultProps} showThreeDayPlan={false} />);

      expect(screen.queryByText('3-Day Trial')).not.toBeInTheDocument();
    });

    it('should show one-time offer badge for 3-day plan', () => {
      render(<PlanSelector {...defaultProps} />);

      expect(screen.getByText('One-time offer')).toBeInTheDocument();
    });

    it('should show best value badge for monthly plan', () => {
      render(<PlanSelector {...defaultProps} />);

      expect(screen.getByText('Best Value')).toBeInTheDocument();
    });
  });

  describe('selection state', () => {
    it('should highlight selected monthly plan', () => {
      render(<PlanSelector {...defaultProps} value="MONTHLY" />);

      const monthlyButton = screen.getByRole('radio', { name: /monthly/i });
      expect(monthlyButton).toHaveAttribute('aria-checked', 'true');
    });

    it('should highlight selected 3-day plan', () => {
      render(<PlanSelector {...defaultProps} value="THREE_DAY" />);

      const threeDayButton = screen.getByRole('radio', {
        name: /3-day trial/i,
      });
      expect(threeDayButton).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('eligibility', () => {
    it('should disable 3-day plan when not eligible', () => {
      render(<PlanSelector {...defaultProps} canUseThreeDayPlan={false} />);

      const threeDayButton = screen.getByRole('radio', {
        name: /3-day trial/i,
      });
      expect(threeDayButton).toBeDisabled();
      expect(threeDayButton).toHaveAttribute('aria-disabled', 'true');
    });

    it('should show eligibility message when not eligible', () => {
      render(<PlanSelector {...defaultProps} canUseThreeDayPlan={false} />);

      expect(
        screen.getByText(/already used this offer|not eligible/i)
      ).toBeInTheDocument();
    });

    it('should enable 3-day plan when eligible', () => {
      render(<PlanSelector {...defaultProps} canUseThreeDayPlan={true} />);

      const threeDayButton = screen.getByRole('radio', {
        name: /3-day trial/i,
      });
      expect(threeDayButton).not.toBeDisabled();
    });
  });

  describe('interactions', () => {
    it('should call onChange when monthly plan is selected', () => {
      const onChange = jest.fn();
      render(
        <PlanSelector {...defaultProps} value="THREE_DAY" onChange={onChange} />
      );

      const monthlyButton = screen.getByRole('radio', { name: /monthly/i });
      fireEvent.click(monthlyButton);

      expect(onChange).toHaveBeenCalledWith('MONTHLY');
    });

    it('should call onChange when 3-day plan is selected', () => {
      const onChange = jest.fn();
      render(
        <PlanSelector {...defaultProps} value="MONTHLY" onChange={onChange} />
      );

      const threeDayButton = screen.getByRole('radio', {
        name: /3-day trial/i,
      });
      fireEvent.click(threeDayButton);

      expect(onChange).toHaveBeenCalledWith('THREE_DAY');
    });

    it('should not call onChange when clicking disabled 3-day plan', () => {
      const onChange = jest.fn();
      render(
        <PlanSelector
          {...defaultProps}
          canUseThreeDayPlan={false}
          onChange={onChange}
        />
      );

      const threeDayButton = screen.getByRole('radio', {
        name: /3-day trial/i,
      });
      fireEvent.click(threeDayButton);

      expect(onChange).not.toHaveBeenCalled();
    });

    it('should not call onChange when disabled', () => {
      const onChange = jest.fn();
      render(
        <PlanSelector {...defaultProps} disabled={true} onChange={onChange} />
      );

      const monthlyButton = screen.getByRole('radio', { name: /monthly/i });
      fireEvent.click(monthlyButton);

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('should have correct radiogroup role', () => {
      render(<PlanSelector {...defaultProps} />);

      expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    });

    it('should have radio roles for plan options', () => {
      render(<PlanSelector {...defaultProps} />);

      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(3); // 3-day, monthly, annual
    });

    it('offers the annual plan at the SystemConfig price with its saving', () => {
      const onChange = jest.fn();
      render(<PlanSelector {...defaultProps} onChange={onChange} />);

      const annual = screen.getAllByRole('radio')[2] as HTMLElement;
      expect(annual).toHaveTextContent('Annual');
      expect(annual).toHaveTextContent('Save 31%');
      expect(annual).toHaveTextContent('/year');
      expect(annual).not.toHaveTextContent('NaN');
      fireEvent.click(annual);
      expect(onChange).toHaveBeenCalledWith('YEARLY');
    });

    it('should have aria-label on radiogroup', () => {
      render(<PlanSelector {...defaultProps} />);

      expect(
        screen.getByRole('radiogroup', { name: /select a plan/i })
      ).toBeInTheDocument();
    });
  });
});
