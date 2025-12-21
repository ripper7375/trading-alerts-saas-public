/**
 * FraudPatternBadge Component Tests
 *
 * Tests for the fraud pattern severity badge component.
 * Part 14: Admin Dashboard Components
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';

import { FraudPatternBadge } from '@/components/admin/FraudPatternBadge';

describe('FraudPatternBadge Component', () => {
  // ============================================================================
  // Severity Level Rendering
  // ============================================================================
  describe('severity levels', () => {
    it('should render CRITICAL severity', () => {
      render(<FraudPatternBadge severity="CRITICAL" />);
      expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    });

    it('should render HIGH severity', () => {
      render(<FraudPatternBadge severity="HIGH" />);
      expect(screen.getByText('HIGH')).toBeInTheDocument();
    });

    it('should render MEDIUM severity', () => {
      render(<FraudPatternBadge severity="MEDIUM" />);
      expect(screen.getByText('MEDIUM')).toBeInTheDocument();
    });

    it('should render LOW severity', () => {
      render(<FraudPatternBadge severity="LOW" />);
      expect(screen.getByText('LOW')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Color Coding
  // ============================================================================
  describe('color coding', () => {
    it('should have red styling for CRITICAL severity', () => {
      const { container } = render(<FraudPatternBadge severity="CRITICAL" />);
      const badge = container.querySelector('span');
      expect(badge).toHaveClass('bg-red-100');
      expect(badge).toHaveClass('text-red-800');
      expect(badge).toHaveClass('border-red-200');
    });

    it('should have orange styling for HIGH severity', () => {
      const { container } = render(<FraudPatternBadge severity="HIGH" />);
      const badge = container.querySelector('span');
      expect(badge).toHaveClass('bg-orange-100');
      expect(badge).toHaveClass('text-orange-800');
    });

    it('should have yellow styling for MEDIUM severity', () => {
      const { container } = render(<FraudPatternBadge severity="MEDIUM" />);
      const badge = container.querySelector('span');
      expect(badge).toHaveClass('bg-yellow-100');
      expect(badge).toHaveClass('text-yellow-800');
    });

    it('should have blue styling for LOW severity', () => {
      const { container } = render(<FraudPatternBadge severity="LOW" />);
      const badge = container.querySelector('span');
      expect(badge).toHaveClass('bg-blue-100');
      expect(badge).toHaveClass('text-blue-800');
    });
  });

  // ============================================================================
  // Pattern Label
  // ============================================================================
  describe('pattern label', () => {
    it('should render without pattern label by default', () => {
      render(<FraudPatternBadge severity="HIGH" />);
      expect(screen.queryByText(/•/)).not.toBeInTheDocument();
    });

    it('should render with pattern label when provided', () => {
      render(<FraudPatternBadge severity="CRITICAL" pattern="Multiple Cards" />);
      expect(screen.getByText(/Multiple Cards/)).toBeInTheDocument();
    });

    it('should show bullet separator with pattern', () => {
      render(<FraudPatternBadge severity="HIGH" pattern="Velocity Check" />);
      expect(screen.getByText(/• Velocity Check/)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Size Variants
  // ============================================================================
  describe('size variants', () => {
    it('should render medium size by default', () => {
      const { container } = render(<FraudPatternBadge severity="LOW" />);
      const badge = container.querySelector('span');
      expect(badge).toHaveClass('px-3', 'py-1', 'text-sm');
    });

    it('should render small size when specified', () => {
      const { container } = render(<FraudPatternBadge severity="LOW" size="sm" />);
      const badge = container.querySelector('span');
      expect(badge).toHaveClass('px-2', 'py-0.5', 'text-xs');
    });

    it('should render medium size when explicitly specified', () => {
      const { container } = render(<FraudPatternBadge severity="LOW" size="md" />);
      const badge = container.querySelector('span');
      expect(badge).toHaveClass('px-3', 'py-1', 'text-sm');
    });
  });

  // ============================================================================
  // Common Badge Styles
  // ============================================================================
  describe('common styles', () => {
    it('should have rounded-full class', () => {
      const { container } = render(<FraudPatternBadge severity="HIGH" />);
      const badge = container.querySelector('span');
      expect(badge).toHaveClass('rounded-full');
    });

    it('should have border class', () => {
      const { container } = render(<FraudPatternBadge severity="HIGH" />);
      const badge = container.querySelector('span');
      expect(badge).toHaveClass('border');
    });

    it('should have font-medium class', () => {
      const { container } = render(<FraudPatternBadge severity="HIGH" />);
      const badge = container.querySelector('span');
      expect(badge).toHaveClass('font-medium');
    });

    it('should have inline-flex class for layout', () => {
      const { container } = render(<FraudPatternBadge severity="HIGH" />);
      const badge = container.querySelector('span');
      expect(badge).toHaveClass('inline-flex');
    });
  });

  // ============================================================================
  // Combinations
  // ============================================================================
  describe('combinations', () => {
    it('should render CRITICAL with pattern and small size', () => {
      const { container } = render(
        <FraudPatternBadge severity="CRITICAL" pattern="IP Mismatch" size="sm" />
      );
      const badge = container.querySelector('span');
      expect(screen.getByText('CRITICAL')).toBeInTheDocument();
      expect(screen.getByText(/IP Mismatch/)).toBeInTheDocument();
      expect(badge).toHaveClass('bg-red-100', 'text-xs');
    });

    it('should render all severity levels correctly', () => {
      const severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
      severities.forEach((severity) => {
        const { unmount } = render(<FraudPatternBadge severity={severity} />);
        expect(screen.getByText(severity)).toBeInTheDocument();
        unmount();
      });
    });
  });
});
