import { z } from 'zod';

/**
 * Chart drawing Zod schemas — mirrors `lib/drawing/schema.ts`'s
 * `DrawingCreateZ`/`DrawingUpdateZ` exactly, verbatim (type enum, anchor
 * count per type, style shape, drawing quota). Session 4B-8.
 *
 * @module drawings/drawings.schemas
 */
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

export const createDrawingSchema = z
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

export const updateDrawingSchema = z
  .object({
    anchors: z.array(AnchorZ).min(1).max(3).optional(),
    style: StyleZ.optional(),
  })
  .refine((d) => d.anchors !== undefined || d.style !== undefined, {
    message: 'Nothing to update',
  });

export type CreateDrawingInput = z.infer<typeof createDrawingSchema>;
export type UpdateDrawingInput = z.infer<typeof updateDrawingSchema>;

/** Max drawings per tier — mirrors `lib/drawing/schema.ts`'s `DRAWING_LIMITS`. */
export const DRAWING_LIMITS: Record<'FREE' | 'PRO', number> = {
  FREE: 10,
  PRO: 200,
};
