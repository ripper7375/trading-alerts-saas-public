/**
 * Layout maths for the 4-panel workbench (`/terminal`, `/free`), rendered by
 * components/workspace/trading-workspace.tsx.
 *
 * A layout is react-resizable-panels' array of percentages, one per panel, in
 * panel order: [sidebar, AI Analyst, chart, Market Comments]. The sidebar, AI
 * Analyst and Market Comments panels collapse to a narrow rail; the chart
 * never collapses and has no max size, so it receives the space a collapse
 * frees and is the first panel an expand takes space back from.
 *
 * Rails are sized in pixels, not percentages, because their content (a 16px
 * icon column) is a fixed width: 4% of the group is 64px at 1600px wide but
 * only 41px at 1024px. The library only speaks percentages, so pixel sizes
 * are converted against the measured panel space.
 *
 * Pure functions, no DOM: unit-tested in
 * __tests__/components/workspace/panel-layout.test.ts.
 *
 * @module components/workspace/panel-layout
 */

export const SIDEBAR = 0;
export const ANALYST = 1;
export const CHART = 2;
export const COMMENTS = 3;

export type CollapsiblePanelIndex =
  | typeof SIDEBAR
  | typeof ANALYST
  | typeof COMMENTS;

export interface PanelConstraint {
  defaultSize: number;
  minSize: number;
  maxSize: number;
  /** Absent for the chart, which never collapses. */
  collapsedSize?: number;
}

/** Collapsed sidebar: the icon column in components/chat-sidebar.tsx. */
export const SIDEBAR_RAIL_PX = 64;
/** Below this an expanded sidebar truncates its nav labels to nothing. */
export const SIDEBAR_MIN_EXPANDED_PX = 200;
/** Collapsed AI Analyst / Market Comments: components/workspace/collapsed-panel-rail.tsx. */
export const PANEL_RAIL_PX = 44;

/**
 * Used until the group has been measured (server render, first paint, jsdom):
 * a 1600px viewport minus the three 10px resize handles.
 */
export const FALLBACK_PANEL_SPACE_PX = 1570;

const SIDEBAR_DEFAULT = 16;
const SIDE_PANEL_MIN = 15;

/** Tolerance for comparing layout percentages. */
const EPSILON = 0.01;

function round(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}

export function pxToPercent(px: number, panelSpacePx: number): number {
  const space = panelSpacePx > 0 ? panelSpacePx : FALLBACK_PANEL_SPACE_PX;
  return round((px / space) * 100);
}

/**
 * A rail must stay below its panel's minimum, or the library cannot tell a
 * collapsed panel from an expanded one. Only matters on very narrow screens.
 */
function railSize(railPercent: number, minSize: number): number {
  return Math.min(railPercent, round(minSize / 2));
}

export function buildPanelConstraints(panelSpacePx: number): PanelConstraint[] {
  // Capped at the default so defaultSize never falls below minSize (the
  // library warns and clamps otherwise) on screens narrower than ~1250px.
  const sidebarMin = Math.min(
    pxToPercent(SIDEBAR_MIN_EXPANDED_PX, panelSpacePx),
    SIDEBAR_DEFAULT
  );
  const panelRail = pxToPercent(PANEL_RAIL_PX, panelSpacePx);

  return [
    {
      defaultSize: SIDEBAR_DEFAULT,
      minSize: sidebarMin,
      maxSize: 25,
      collapsedSize: railSize(
        pxToPercent(SIDEBAR_RAIL_PX, panelSpacePx),
        sidebarMin
      ),
    },
    {
      defaultSize: 24,
      minSize: SIDE_PANEL_MIN,
      maxSize: 35,
      collapsedSize: railSize(panelRail, SIDE_PANEL_MIN),
    },
    { defaultSize: 38, minSize: 25, maxSize: 100 },
    {
      defaultSize: 22,
      minSize: SIDE_PANEL_MIN,
      maxSize: 35,
      collapsedSize: railSize(panelRail, SIDE_PANEL_MIN),
    },
  ];
}

/**
 * The library only lets a collapsible panel sit at its collapsed size or at
 * minSize and above, so anything below minSize is collapsed. Comparing
 * against minSize rather than collapsedSize also holds for the moment after a
 * window resize, before the library has moved a rail to its new percentage.
 */
export function isPanelCollapsed(
  layout: readonly number[],
  index: number,
  constraints: readonly PanelConstraint[]
): boolean {
  const constraint = constraints[index];
  const size = layout[index];
  if (
    !constraint ||
    constraint.collapsedSize === undefined ||
    size === undefined
  ) {
    return false;
  }
  return size < constraint.minSize - EPSILON;
}

export function collapseLayout(
  layout: readonly number[],
  index: CollapsiblePanelIndex,
  constraints: readonly PanelConstraint[]
): number[] {
  const next = [...layout];
  const collapsedSize = constraints[index]?.collapsedSize;
  const size = next[index];
  const chart = next[CHART];
  if (
    collapsedSize === undefined ||
    size === undefined ||
    chart === undefined
  ) {
    return next;
  }
  const freed = size - collapsedSize;
  if (freed <= 0) return next;

  next[index] = collapsedSize;
  next[CHART] = chart + freed;
  return next;
}

/**
 * Expands a collapsed panel to `preferredSize` (the width it had before it
 * collapsed) or its default, clamped to its limits. Space comes from the chart
 * down to its minimum, then from the other expanded side panels down to
 * theirs. Returns the layout unchanged if even the panel's minimum won't fit.
 */
export function expandLayout(
  layout: readonly number[],
  index: CollapsiblePanelIndex,
  constraints: readonly PanelConstraint[],
  preferredSize?: number
): number[] {
  const constraint = constraints[index];
  const current = layout[index];
  if (!constraint || current === undefined) return [...layout];

  const target = Math.min(
    Math.max(preferredSize ?? constraint.defaultSize, constraint.minSize),
    constraint.maxSize
  );
  const next = [...layout];
  let need = target - current;
  if (need <= 0) return next;

  const donors = [
    CHART,
    ...([SIDEBAR, ANALYST, COMMENTS] as const).filter(
      (i) => i !== index && !isPanelCollapsed(layout, i, constraints)
    ),
  ];
  for (const donor of donors) {
    const donorSize = next[donor];
    const donorMin = constraints[donor]?.minSize ?? 0;
    if (donorSize === undefined) continue;
    const give = Math.min(need, Math.max(0, donorSize - donorMin));
    next[donor] = donorSize - give;
    next[index] = (next[index] ?? 0) + give;
    need -= give;
    if (need <= EPSILON) break;
  }

  return (next[index] ?? 0) >= constraint.minSize - EPSILON
    ? next
    : [...layout];
}
