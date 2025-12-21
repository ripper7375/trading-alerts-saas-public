/**
 * StatsCard Component Tests
 *
 * Tests for the dashboard stats card component.
 * Part 8: Dashboard & Layout Components
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';
import { Activity, TrendingUp, AlertTriangle } from 'lucide-react';

import { StatsCard } from '@/components/dashboard/stats-card';

describe('StatsCard Component', () => {
  // ============================================================================
  // Basic Rendering
  // ============================================================================
  describe('rendering', () => {
    it('should render with title and value', () => {
      render(
        <StatsCard
          title="Total Alerts"
          value={42}
          icon={Activity}
        />
      );

      expect(screen.getByText('Total Alerts')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('should render with string value', () => {
      render(
        <StatsCard
          title="Revenue"
          value="$1,234"
          icon={TrendingUp}
        />
      );

      expect(screen.getByText('Revenue')).toBeInTheDocument();
      expect(screen.getByText('$1,234')).toBeInTheDocument();
    });

    it('should render the icon', () => {
      const { container } = render(
        <StatsCard
          title="Test"
          value={0}
          icon={Activity}
        />
      );

      // Lucide icons render as SVG
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should render with description', () => {
      render(
        <StatsCard
          title="Active Users"
          value={100}
          icon={Activity}
          description="Users online now"
        />
      );

      expect(screen.getByText('Users online now')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Change Indicator
  // ============================================================================
  describe('change indicator', () => {
    it('should show positive change with up arrow', () => {
      render(
        <StatsCard
          title="Revenue"
          value="$5,000"
          icon={TrendingUp}
          change={15}
        />
      );

      expect(screen.getByText('+15%')).toBeInTheDocument();
      expect(screen.getByText('from last month')).toBeInTheDocument();
    });

    it('should show negative change with down arrow', () => {
      render(
        <StatsCard
          title="Errors"
          value={50}
          icon={AlertTriangle}
          change={-10}
        />
      );

      expect(screen.getByText('-10%')).toBeInTheDocument();
    });

    it('should show zero change', () => {
      render(
        <StatsCard
          title="Stable"
          value={100}
          icon={Activity}
          change={0}
        />
      );

      expect(screen.getByText('+0%')).toBeInTheDocument();
    });

    it('should use custom change label', () => {
      render(
        <StatsCard
          title="Weekly"
          value={75}
          icon={Activity}
          change={5}
          changeLabel="from last week"
        />
      );

      expect(screen.getByText('from last week')).toBeInTheDocument();
    });

    it('should apply green color for positive change', () => {
      render(
        <StatsCard
          title="Growth"
          value={100}
          icon={TrendingUp}
          change={20}
        />
      );

      const changeText = screen.getByText('+20%');
      expect(changeText).toHaveClass('text-green-600');
    });

    it('should apply red color for negative change', () => {
      render(
        <StatsCard
          title="Decline"
          value={100}
          icon={AlertTriangle}
          change={-15}
        />
      );

      const changeText = screen.getByText('-15%');
      expect(changeText).toHaveClass('text-red-600');
    });
  });

  // ============================================================================
  // Usage Variant
  // ============================================================================
  describe('usage variant', () => {
    it('should render progress bar for usage variant', () => {
      render(
        <StatsCard
          title="Storage"
          value="80 GB"
          icon={Activity}
          variant="usage"
          current={80}
          max={100}
        />
      );

      expect(screen.getByText('80 / 100')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();
    });

    it('should show warning for high usage (>80%)', () => {
      render(
        <StatsCard
          title="Alerts Used"
          value="85/100"
          icon={AlertTriangle}
          variant="usage"
          current={85}
          max={100}
        />
      );

      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText(/Approaching limit/)).toBeInTheDocument();
    });

    it('should not show warning for normal usage', () => {
      render(
        <StatsCard
          title="Alerts Used"
          value="50/100"
          icon={Activity}
          variant="usage"
          current={50}
          max={100}
        />
      );

      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.queryByText(/Approaching limit/)).not.toBeInTheDocument();
    });

    it('should handle 100% usage', () => {
      render(
        <StatsCard
          title="Full"
          value="100/100"
          icon={AlertTriangle}
          variant="usage"
          current={100}
          max={100}
        />
      );

      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getByText(/Approaching limit/)).toBeInTheDocument();
    });

    it('should handle 0% usage', () => {
      render(
        <StatsCard
          title="Empty"
          value="0/100"
          icon={Activity}
          variant="usage"
          current={0}
          max={100}
        />
      );

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should cap progress bar at 100%', () => {
      const { container } = render(
        <StatsCard
          title="Over"
          value="120/100"
          icon={AlertTriangle}
          variant="usage"
          current={120}
          max={100}
        />
      );

      // The progress bar should be capped at 100%
      const progressBar = container.querySelector('[style*="width"]');
      expect(progressBar).toHaveStyle({ width: '100%' });
    });
  });

  // ============================================================================
  // Styling
  // ============================================================================
  describe('styling', () => {
    it('should have proper card structure', () => {
      const { container } = render(
        <StatsCard
          title="Test Card"
          value={42}
          icon={Activity}
        />
      );

      // Should be wrapped in a Card component
      expect(container.querySelector('.bg-white')).toBeInTheDocument();
    });

    it('should have proper text styling for title', () => {
      render(
        <StatsCard
          title="Styled Title"
          value={0}
          icon={Activity}
        />
      );

      const title = screen.getByText('Styled Title');
      expect(title).toHaveClass('text-sm', 'font-medium');
    });

    it('should have proper text styling for value', () => {
      render(
        <StatsCard
          title="Test"
          value="Large Value"
          icon={Activity}
        />
      );

      const value = screen.getByText('Large Value');
      expect(value).toHaveClass('text-2xl', 'font-bold');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================
  describe('edge cases', () => {
    it('should handle very large numbers', () => {
      render(
        <StatsCard
          title="Big Number"
          value={1000000}
          icon={Activity}
        />
      );

      expect(screen.getByText('1000000')).toBeInTheDocument();
    });

    it('should handle decimal values', () => {
      render(
        <StatsCard
          title="Decimal"
          value="99.99"
          icon={Activity}
        />
      );

      expect(screen.getByText('99.99')).toBeInTheDocument();
    });

    it('should handle empty string value', () => {
      render(
        <StatsCard
          title="Empty"
          value=""
          icon={Activity}
        />
      );

      expect(screen.getByText('Empty')).toBeInTheDocument();
    });
  });
});
