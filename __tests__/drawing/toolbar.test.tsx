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

/**
 * The toolbar floats over the chart, and lightweight-charts paints its dashed
 * crosshair for as long as the pointer is over the chart element. The gutter
 * around the toolbar was chart surface, so reaching for a tool flashed a
 * full-height dashed line up the toolbar's own column. A transparent padded
 * wrapper makes that gutter part of the toolbar instead: padding is inside an
 * element's hit area, so the chart sees a mouseleave and drops the crosshair.
 */
describe('Toolbar hover buffer', () => {
  const bufferOf = (container: HTMLElement): HTMLElement => {
    const frame = container.querySelector('[data-layout]');
    const buffer = frame?.parentElement;
    if (!buffer) throw new Error('toolbar is not wrapped');
    return buffer;
  };

  it.each([
    ['stacked', 600],
    ['split', 400],
    ['grid', 264],
  ] as const)('wraps the %s layout in a padded buffer', (_mode, height) => {
    const classes = bufferOf(renderToolbar(height).container).className.split(
      /\s+/
    );

    expect(classes).toEqual(expect.arrayContaining(['absolute', 'z-10']));
    // Any side without padding is a strip of live chart flush against the
    // toolbar, which is exactly where the crosshair was showing up.
    for (const side of ['pl-', 'pt-', 'pr-', 'pb-']) {
      expect(classes.some((c) => c.startsWith(side))).toBe(true);
    }
  });

  /**
   * The buffer carries the offset the frame used to position itself with, so
   * the toolbar must not also be offset -- that would move it 8px further in.
   */
  it('leaves the frame unpositioned, so the toolbar does not shift', () => {
    const { container } = renderToolbar(400);
    const frame = container.querySelector('[data-layout]') as HTMLElement;
    const buffer = bufferOf(container);

    expect(frame.className).not.toMatch(/(^|\s)absolute(\s|$)/);
    expect(frame.className).not.toMatch(/(^|\s)(left|top)-/);
    expect(buffer.className).toMatch(/(^|\s)left-0(\s|$)/);
    expect(buffer.className).toMatch(/(^|\s)top-0(\s|$)/);
  });
});
