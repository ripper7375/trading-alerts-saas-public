/**
 * Unit Tests: Slider Component
 * Tests UI slider component in components/ui/slider.tsx
 * Verifies accessibility: accessible names reach the thumb (role="slider")
 * while keeping the root container free of duplicate labels.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';
import { Slider } from '@/components/ui/slider';

describe('Slider Component', () => {
  describe('accessibility and labelling', () => {
    it('passes aria-label to the thumb role="slider"', () => {
      render(<Slider aria-label="HRMA period" defaultValue={[14]} />);

      const slider = screen.getByRole('slider', { name: 'HRMA period' });
      expect(slider).toBeInTheDocument();
      expect(slider).toHaveAttribute('data-slot', 'slider-thumb');
    });

    it('does not leave aria-label on the root container', () => {
      const { container } = render(
        <Slider aria-label="Depth" defaultValue={[12]} />
      );

      const root = container.querySelector('[data-slot="slider"]');
      expect(root).toBeInTheDocument();
      expect(root).not.toHaveAttribute('aria-label');
    });

    it('passes aria-labelledby to the thumb role="slider"', () => {
      render(
        <div>
          <span id="slider-label">Smoothing Factor</span>
          <Slider aria-labelledby="slider-label" defaultValue={[5]} />
        </div>
      );

      const slider = screen.getByRole('slider', { name: 'Smoothing Factor' });
      expect(slider).toBeInTheDocument();
      expect(slider).toHaveAttribute('aria-labelledby', 'slider-label');
    });

    it('does not leave aria-labelledby on the root container', () => {
      const { container } = render(
        <div>
          <span id="label-id">Threshold</span>
          <Slider aria-labelledby="label-id" defaultValue={[2]} />
        </div>
      );

      const root = container.querySelector('[data-slot="slider"]');
      expect(root).toBeInTheDocument();
      expect(root).not.toHaveAttribute('aria-labelledby');
    });

    it('assigns the accessible name to all thumbs for multi-thumb sliders', () => {
      render(
        <Slider aria-label="Price range" value={[20, 80]} min={0} max={100} />
      );

      const thumbs = screen.getAllByRole('slider', { name: 'Price range' });
      expect(thumbs).toHaveLength(2);
      thumbs.forEach((thumb) => {
        expect(thumb).toHaveAttribute('data-slot', 'slider-thumb');
      });
    });
  });

  describe('structure and slots', () => {
    it('renders all slider data-slot elements', () => {
      const { container } = render(
        <Slider aria-label="Volume" defaultValue={[50]} />
      );

      expect(
        container.querySelector('[data-slot="slider"]')
      ).toBeInTheDocument();
      expect(
        container.querySelector('[data-slot="slider-track"]')
      ).toBeInTheDocument();
      expect(
        container.querySelector('[data-slot="slider-range"]')
      ).toBeInTheDocument();
      expect(
        container.querySelector('[data-slot="slider-thumb"]')
      ).toBeInTheDocument();
    });

    it('applies custom className to root', () => {
      const { container } = render(
        <Slider
          aria-label="Volume"
          className="custom-slider-class"
          defaultValue={[50]}
        />
      );

      const root = container.querySelector('[data-slot="slider"]');
      expect(root?.className).toContain('custom-slider-class');
    });

    it('supports disabled prop', () => {
      const { container } = render(
        <Slider aria-label="Disabled slider" disabled defaultValue={[30]} />
      );

      const root = container.querySelector('[data-slot="slider"]');
      expect(root).toHaveAttribute('data-disabled');
    });
  });
});
