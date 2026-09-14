import { describe, it, expect } from '@jest/globals';

import {
  ANALYST,
  CHART,
  COMMENTS,
  FALLBACK_PANEL_SPACE_PX,
  SIDEBAR,
  buildPanelConstraints,
  collapseLayout,
  expandLayout,
  isPanelCollapsed,
  pxToPercent,
} from '@/components/workspace/panel-layout';

const DEFAULT_LAYOUT = [16, 24, 38, 22];
const constraints = buildPanelConstraints(FALLBACK_PANEL_SPACE_PX);

const sum = (layout: number[]): number => layout.reduce((a, b) => a + b, 0);

describe('pxToPercent', () => {
  it('converts against the measured panel space', () => {
    expect(pxToPercent(64, 1600)).toBe(4);
  });

  it('falls back to a 1600px viewport before the group is measured', () => {
    expect(pxToPercent(64, 0)).toBe(pxToPercent(64, FALLBACK_PANEL_SPACE_PX));
  });
});

describe('buildPanelConstraints', () => {
  it('sizes the rails in pixels, whatever the screen width', () => {
    for (const space of [1570, 1070, 2530]) {
      const [sidebar, analyst, , comments] = buildPanelConstraints(space);
      expect(((sidebar?.collapsedSize ?? 0) / 100) * space).toBeCloseTo(64, 0);
      expect(((analyst?.collapsedSize ?? 0) / 100) * space).toBeCloseTo(44, 0);
      expect(((comments?.collapsedSize ?? 0) / 100) * space).toBeCloseTo(44, 0);
    }
  });

  it('keeps the expanded sidebar at least 200px wide on wide screens', () => {
    const [sidebar] = buildPanelConstraints(1570);
    expect(((sidebar?.minSize ?? 0) / 100) * 1570).toBeCloseTo(200, 0);
  });

  it('never lets the sidebar minimum exceed its default size', () => {
    const [sidebar] = buildPanelConstraints(1070);
    expect(sidebar?.minSize).toBe(sidebar?.defaultSize);
  });

  it('keeps every rail below its panel minimum on a very narrow screen', () => {
    for (const constraint of buildPanelConstraints(200)) {
      if (constraint.collapsedSize === undefined) continue;
      expect(constraint.collapsedSize).toBeLessThan(constraint.minSize);
    }
  });

  it('never makes the chart collapsible', () => {
    expect(constraints[CHART]?.collapsedSize).toBeUndefined();
  });
});

describe('isPanelCollapsed', () => {
  it('reads a panel below its minimum as collapsed', () => {
    const layout = collapseLayout(DEFAULT_LAYOUT, ANALYST, constraints);
    expect(isPanelCollapsed(layout, ANALYST, constraints)).toBe(true);
    expect(isPanelCollapsed(DEFAULT_LAYOUT, ANALYST, constraints)).toBe(false);
  });

  it('never reports the chart as collapsed', () => {
    expect(isPanelCollapsed([40, 35, 1, 24], CHART, constraints)).toBe(false);
  });
});

describe('collapseLayout', () => {
  it.each([
    ['sidebar', SIDEBAR],
    ['AI Analyst', ANALYST],
    ['Market Comments', COMMENTS],
  ] as const)(
    'shrinks the %s to its rail and gives only the chart the freed space',
    (_name, index) => {
      const next = collapseLayout(DEFAULT_LAYOUT, index, constraints);
      const freed = (DEFAULT_LAYOUT[index] ?? 0) - (next[index] ?? 0);

      expect(next[index]).toBe(constraints[index]?.collapsedSize);
      expect(next[CHART]).toBeCloseTo(38 + freed, 6);
      DEFAULT_LAYOUT.forEach((size, i) => {
        if (i !== index && i !== CHART) expect(next[i]).toBe(size);
      });
      expect(sum(next)).toBeCloseTo(100, 6);
    }
  );

  it('leaves an already-collapsed panel alone', () => {
    const once = collapseLayout(DEFAULT_LAYOUT, SIDEBAR, constraints);
    expect(collapseLayout(once, SIDEBAR, constraints)).toEqual(once);
  });
});

describe('expandLayout', () => {
  it('restores the width a panel had before it collapsed', () => {
    const collapsed = collapseLayout(DEFAULT_LAYOUT, SIDEBAR, constraints);
    const restored = expandLayout(collapsed, SIDEBAR, constraints, 16);
    restored.forEach((size, i) =>
      expect(size).toBeCloseTo(DEFAULT_LAYOUT[i] ?? 0, 6)
    );
  });

  it('uses the default size when no earlier width is known', () => {
    const collapsed = collapseLayout(DEFAULT_LAYOUT, ANALYST, constraints);
    expect(expandLayout(collapsed, ANALYST, constraints)[ANALYST]).toBeCloseTo(
      24,
      6
    );
  });

  it('clamps a remembered width to the panel limits', () => {
    const collapsed = collapseLayout(DEFAULT_LAYOUT, COMMENTS, constraints);
    expect(
      expandLayout(collapsed, COMMENTS, constraints, 80)[COMMENTS]
    ).toBeCloseTo(35, 6);
  });

  it('takes space from other expanded side panels once the chart is at its minimum', () => {
    // Chart at its 25% minimum, AI Analyst collapsed.
    const analystRail = constraints[ANALYST]?.collapsedSize ?? 0;
    const layout = [25, analystRail, 25, 50 - analystRail];
    const next = expandLayout(layout, ANALYST, constraints, 24);

    expect(next[ANALYST]).toBeCloseTo(24, 6);
    expect(next[CHART]).toBeCloseTo(25, 6);
    expect(sum(next)).toBeCloseTo(100, 6);
    next.forEach((size, i) =>
      expect(size).toBeGreaterThanOrEqual((constraints[i]?.minSize ?? 0) - 0.01)
    );
  });

  it('does not take space from a panel that is itself collapsed', () => {
    const sidebarRail = constraints[SIDEBAR]?.collapsedSize ?? 0;
    const commentsRail = constraints[COMMENTS]?.collapsedSize ?? 0;
    const analystRail = constraints[ANALYST]?.collapsedSize ?? 0;
    const layout = [
      sidebarRail,
      analystRail,
      100 - sidebarRail - analystRail - commentsRail,
      commentsRail,
    ];
    const next = expandLayout(layout, ANALYST, constraints, 24);

    expect(next[SIDEBAR]).toBe(sidebarRail);
    expect(next[COMMENTS]).toBe(commentsRail);
    expect(next[ANALYST]).toBeCloseTo(24, 6);
  });

  it('leaves the layout unchanged when even the minimum does not fit', () => {
    const analystRail = constraints[ANALYST]?.collapsedSize ?? 0;
    // Nothing above its minimum anywhere: a layout the constraints can't
    // produce, but the guard must still refuse to break a minimum.
    const impossible = [16, analystRail, 25, 15];
    expect(expandLayout(impossible, ANALYST, constraints, 24)).toEqual(
      impossible
    );
  });
});
