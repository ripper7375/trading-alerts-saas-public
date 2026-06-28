/**
 * Shared Zod schemas + limits for chart drawings and line-touch alerts.
 *
 * Used by the drawings/alerts API routes (server). The runtime validator here
 * is the source of truth for persisted shapes; the pure geometry module
 * (`levelsForMark`) validates which alert target levels a drawing exposes.
 *
 * @module lib/drawing/schema
 */

import { z } from 'zod';

export const DRAWING_TYPES = [
  'TRENDLINE',
  'HLINE',
  'CHANNEL',
  'FIB_RETRACE',
  'FIB_EXT',
  'TEXT',
] as const;

export const DrawingTypeZ = z.enum(DRAWING_TYPES);
export type DrawingTypeT = z.infer<typeof DrawingTypeZ>;

/** Clicks/anchors required per drawing type. */
const ANCHOR_COUNT: Record<DrawingTypeT, number> = {
  HLINE: 1,
  TRENDLINE: 2,
  CHANNEL: 3,
  FIB_RETRACE: 2,
  FIB_EXT: 3,
  TEXT: 1,
};

export const AnchorZ = z.object({
  time: z.number().int(),
  price: z.number().finite(),
});

export const StyleZ = z
  .object({
    color: z.string().regex(/^#([0-9a-fA-F]{6})$/, 'color must be #RRGGBB'),
    lineWidth: z.number().int().min(1).max(10),
    lineStyle: z.enum(['solid', 'dashed', 'dotted']),
  })
  .passthrough(); // tool-specific extras (offset, levels, text, extend flags…)

export const DrawingCreateZ = z
  .object({
    symbol: z.string().min(1),
    timeframe: z.string().min(1),
    type: DrawingTypeZ,
    anchors: z.array(AnchorZ).min(1).max(3),
    style: StyleZ,
  })
  .superRefine((d, ctx) => {
    const need = ANCHOR_COUNT[d.type];
    if (d.anchors.length !== need) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${d.type} requires ${need} anchor(s)`,
        path: ['anchors'],
      });
    }
  });

export const DrawingUpdateZ = z
  .object({
    anchors: z.array(AnchorZ).min(1).max(3).optional(),
    style: StyleZ.optional(),
  })
  .refine((d) => d.anchors !== undefined || d.style !== undefined, {
    message: 'Nothing to update',
  });

export const AlertAttachZ = z.object({
  drawingId: z.string().cuid(),
  targetLevel: z.string().min(1),
  direction: z.enum(['cross_up', 'cross_down', 'either']).default('either'),
  tolerance: z.number().min(0).default(0),
  cooldownSec: z.number().int().min(0).max(86400).default(60),
  oneShot: z.boolean().default(false),
  name: z.string().max(120).optional(),
});

export const AlertUpdateZ = z
  .object({
    direction: z.enum(['cross_up', 'cross_down', 'either']).optional(),
    tolerance: z.number().min(0).optional(),
    cooldownSec: z.number().int().min(0).max(86400).optional(),
    oneShot: z.boolean().optional(),
    name: z.string().max(120).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Nothing to update' });

/** Max drawings per tier (alert quota reuses lib/tier-validation getAlertLimit). */
export const DRAWING_LIMITS: Record<'FREE' | 'PRO', number> = {
  FREE: 10,
  PRO: 200,
};
