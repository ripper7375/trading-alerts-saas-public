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

import { render, screen, fireEvent } from '@testing-library/react';
import { PlanSelector } from '@/components/payments/PlanSelector';

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
      expect(screen.getByText(/\$29\.00/)).toBeInTheDocument();
    });

    it('should render 3-day plan when showThreeDayPlan is true', () => {
      render(<PlanSelector {...defaultProps} />);

      expect(screen.getByText('3-Day Trial')).toBeInTheDocument();
      expect(screen.getByText(/\$1\.99/)).toBeInTheDocument();
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
      expect(radios).toHaveLength(2);
    });

    it('should have aria-label on radiogroup', () => {
      render(<PlanSelector {...defaultProps} />);

      expect(
        screen.getByRole('radiogroup', { name: /select a plan/i })
      ).toBeInTheDocument();
    });
  });
});
