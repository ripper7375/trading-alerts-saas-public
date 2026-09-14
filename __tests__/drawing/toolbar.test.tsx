import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';

import { Toolbar, toolbarLayout } from '@/components/charts/drawing/Toolbar';

/**
 * The drawing toolbar used to be a fixed ~460px column that ran off the bottom
 * of a stacked M5/M15 chart. It now lays itself out to fit the chart height.
 *
 * The thresholds below are the toolbar's real rendered heights, measured in a
 * browser: 459px as one column, 286px as two. Each chart keeps 16px clear
 * (8px above and below the toolbar).
 */

const STACKED_PX = 459;
const SPLIT_PX = 286;
const INSET_PX = 16;

describe('toolbarLayout', () => {
  it('keeps the single column when the chart height is unknown', () => {
    expect(toolbarLayout()).toEqual({ mode: 'stacked' });
  });

  it('uses one column only when all of it fits', () => {
    expect(toolbarLayout(STACKED_PX + INSET_PX)).toEqual({ mode: 'stacked' });
    expect(toolbarLayout(STACKED_PX + INSET_PX - 1)).toEqual({
      mode: 'split',
    });
  });

  it('puts tools and actions side by side while that fits', () => {
    expect(toolbarLayout(SPLIT_PX + INSET_PX)).toEqual({ mode: 'split' });
    expect(toolbarLayout(SPLIT_PX + INSET_PX - 1).mode).toBe('grid');
  });

  it('wraps into as many rows as fit on a short chart', () => {
    // 264px chart (measured on a 680px-tall window): 6 rows of 36px + gaps.
    expect(toolbarLayout(264)).toEqual({ mode: 'grid', rows: 6 });
  });

  it('never asks for fewer than one row', () => {
    expect(toolbarLayout(10)).toEqual({ mode: 'grid', rows: 1 });
  });
});

function renderToolbar(chartHeight?: number) {
  return render(
    <Toolbar
      chartHeight={chartHeight}
      activeTool={null}
      hasSelection={false}
      canAddAlert={false}
      alertsOpen={false}
      onSelectTool={() => {}}
      onDelete={() => {}}
      onAddAlert={() => {}}
      onEditStyle={() => {}}
      onToggleAlerts={() => {}}
    />
  );
}

describe('Toolbar layout', () => {
  it.each([
    ['stacked', 600],
    ['split', 400],
    ['grid', 264],
  ] as const)('renders every button in the %s layout', (mode, height) => {
    const { container } = renderToolbar(height);
    const toolbar = container.querySelector('[data-layout]');

    expect(toolbar).toHaveAttribute('data-layout', mode);
    expect(screen.getAllByRole('button')).toHaveLength(11);
    expect(
      screen.getByRole('button', { name: 'Select / cursor' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete selected' })
    ).toBeInTheDocument();
  });

  it('sizes the grid rows to the chart', () => {
    const { container } = renderToolbar(264);
    expect(
      (container.querySelector('[data-layout="grid"]') as HTMLElement).style
        .gridTemplateRows
    ).toBe('repeat(6, 36px)');
  });

  it('keeps tools and actions in separate columns when split', () => {
    const { container } = renderToolbar(400);
    const columns = container.querySelectorAll(
      '[data-layout="split"] > div.flex-col'
    );
    expect(columns).toHaveLength(2);
    expect(columns[0]).toContainElement(
      screen.getByRole('button', { name: 'Select / cursor' })
    );
    expect(columns[1]).toContainElement(
      screen.getByRole('button', { name: 'Delete selected' })
    );
  });
});
