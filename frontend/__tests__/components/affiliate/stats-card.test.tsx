/**
 * Unit Tests: StatsCard Component
 * Tests the affiliate dashboard stats card component
 *
 * @module __tests__/components/affiliate/stats-card.test
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';
import { StatsCard } from '@/components/affiliate/stats-card';

describe('StatsCard Component', () => {
  describe('Basic Rendering', () => {
    it('should render title and value', () => {
      render(<StatsCard title="Total Earnings" value="$142.50" />);

      expect(screen.getByText('Total Earnings')).toBeInTheDocument();
      expect(screen.getByText('$142.50')).toBeInTheDocument();
    });

    it('should render with only required props', () => {
      render(<StatsCard title="Balance" value="$50.00" />);

      expect(screen.getByText('Balance')).toBeInTheDocument();
      expect(screen.getByText('$50.00')).toBeInTheDocument();
    });

    it('should render numeric values', () => {
      render(<StatsCard title="Total Codes" value="245" />);

      expect(screen.getByText('245')).toBeInTheDocument();
    });
  });

  describe('Icon Rendering', () => {
    it('should render icon if provided', () => {
      const TestIcon = () => <svg data-testid="test-icon" />;
      render(<StatsCard title="Clicks" value="245" icon={<TestIcon />} />);

      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    });

    it('should not render icon container when icon is not provided', () => {
      const { container } = render(
        <StatsCard title="Balance" value="$50.00" />
      );

      // The icon container should not exist
      const iconContainer = container.querySelector(
        '[data-testid="icon-container"]'
      );
      expect(iconContainer).toBeNull();
    });
  });

  describe('Trend Indicator', () => {
    it('should show trend indicator with positive direction', () => {
      render(
        <StatsCard
          title="Conversions"
          value="12"
          trend={{ value: 8.5, direction: 'up' }}
        />
      );

      expect(screen.getByText(/8\.5%/)).toBeInTheDocument();
    });

    it('should show trend indicator with negative direction', () => {
      render(
        <StatsCard
          title="Clicks"
          value="100"
          trend={{ value: 3.2, direction: 'down' }}
        />
      );

      expect(screen.getByText(/3\.2%/)).toBeInTheDocument();
    });

    it('should handle no trend', () => {
      render(<StatsCard title="Balance" value="$50.00" />);

      expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    });

    it('should apply green color for upward trend', () => {
      render(
        <StatsCard
          title="Test"
          value="100"
          trend={{ value: 5, direction: 'up' }}
        />
      );

      const trendElement = screen.getByText(/5%/);
      expect(trendElement.className).toMatch(/green/i);
    });

    it('should apply red color for downward trend', () => {
      render(
        <StatsCard
          title="Test"
          value="100"
          trend={{ value: 3, direction: 'down' }}
        />
      );

      const trendElement = screen.getByText(/3%/);
      expect(trendElement.className).toMatch(/red/i);
    });

    it('should display up arrow for positive trend', () => {
      render(
        <StatsCard
          title="Test"
          value="100"
          trend={{ value: 10, direction: 'up' }}
        />
      );

      const trendElement = screen.getByText(/10%/);
      expect(trendElement.textContent).toContain('↑');
    });

    it('should display down arrow for negative trend', () => {
      render(
        <StatsCard
          title="Test"
          value="100"
          trend={{ value: 5, direction: 'down' }}
        />
      );

      const trendElement = screen.getByText(/5%/);
      expect(trendElement.textContent).toContain('↓');
    });

    it('should handle zero trend value', () => {
      render(
        <StatsCard
          title="Test"
          value="100"
          trend={{ value: 0, direction: 'up' }}
        />
      );

      expect(screen.getByText(/0%/)).toBeInTheDocument();
    });
  });

  describe('Styling', () => {
    it('should have proper container styling', () => {
      render(<StatsCard title="Test" value="100" data-testid="stats-card" />);

      const card = screen.getByTestId('stats-card');
      expect(card.className).toContain('rounded');
    });

    it('should display value with proper emphasis', () => {
      render(<StatsCard title="Earnings" value="$1,234.56" />);

      const valueElement = screen.getByText('$1,234.56');
      expect(valueElement.className).toContain('font-bold');
    });

    it('should apply custom className', () => {
      render(
        <StatsCard
          title="Test"
          value="100"
          className="custom-class"
          data-testid="stats-card"
        />
      );

      const card = screen.getByTestId('stats-card');
      expect(card.className).toContain('custom-class');
    });
  });

  describe('Accessibility', () => {
    it('should be accessible with proper text content', () => {
      render(
        <StatsCard
          title="Active Codes"
          value="25"
          trend={{ value: 10, direction: 'up' }}
        />
      );

      expect(screen.getByText('Active Codes')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long values', () => {
      render(<StatsCard title="Total" value="$999,999,999.99" />);

      expect(screen.getByText('$999,999,999.99')).toBeInTheDocument();
    });

    it('should handle empty string value', () => {
      render(<StatsCard title="Empty" value="" />);

      expect(screen.getByText('Empty')).toBeInTheDocument();
    });

    it('should handle special characters in title', () => {
      render(<StatsCard title="Earnings (USD)" value="$100" />);

      expect(screen.getByText('Earnings (USD)')).toBeInTheDocument();
    });
  });
});
