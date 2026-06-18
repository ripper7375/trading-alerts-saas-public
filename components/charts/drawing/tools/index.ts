/**
 * Tool registry — declarative definitions that the DrawingEngine uses to create
 * marks from pointer clicks. Adding a tool = adding a definition here (plus its
 * Mark class). The generic create→preview→finalize flow lives in the engine.
 *
 * @module components/charts/drawing/tools
 */

import { HorizontalLineMark } from '../marks/HorizontalLineMark';
import { TrendlineMark } from '../marks/TrendlineMark';
import type { Anchor, DrawingMark, DrawingStyle, DrawingType } from '../types';

export interface ToolDefinition {
  type: DrawingType;
  label: string;
  /** Number of clicks required to finalize the mark. */
  anchorCount: number;
  create(id: string, anchors: Anchor[], style: DrawingStyle): DrawingMark;
}

const DEFAULT_STYLE: DrawingStyle = {
  color: '#2962FF',
  lineWidth: 2,
  lineStyle: 'solid',
};

export function defaultStyle(): DrawingStyle {
  return { ...DEFAULT_STYLE };
}

/**
 * Tools available so far. Channel / fib / text are added in a later batch and
 * will slot in here without engine changes.
 */
export const TOOL_DEFINITIONS: Partial<Record<DrawingType, ToolDefinition>> = {
  HLINE: {
    type: 'HLINE',
    label: 'Horizontal Line',
    anchorCount: 1,
    create: (id, anchors, style) => new HorizontalLineMark(id, anchors, style),
  },
  TRENDLINE: {
    type: 'TRENDLINE',
    label: 'Trendline',
    anchorCount: 2,
    create: (id, anchors, style) => new TrendlineMark(id, anchors, style),
  },
};

/** Ordered list of tools to show in the toolbar. */
export const DRAWABLE_TOOLS: DrawingType[] = ['HLINE', 'TRENDLINE'];

/** Map a mark handle id to the anchor index it controls. */
export function handleToAnchorIndex(handleId: string): number {
  switch (handleId) {
    case 'start':
    case 'p0':
      return 0;
    case 'end':
    case 'p1':
      return 1;
    case 'p2':
      return 2;
    default:
      return 0;
  }
}
