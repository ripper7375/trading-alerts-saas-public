/**
 * Alert Validation Schemas
 *
 * Zod schemas for trading alert-related inputs.
 * Includes symbol and timeframe validation based on tier.
 *
 * Hoisted from `lib/validations/alert.ts` (Session 4B-1, F9) — this package
 * is now the single source of truth, consumed by the monolith and (from
 * Session 4B-2 onward) operation-service's ported alert engine.
 */

import { z } from 'zod';

/**
 * All supported symbols (V8: XAUUSD only)
 */
export const SYMBOLS = ['XAUUSD'] as const;

/**
 * @deprecated V8: both tiers share the same symbol list. Use SYMBOLS.
 */
export const FREE_SYMBOLS = SYMBOLS;

/**
 * All supported timeframes (V8: M5 and M15 only)
 */
export const TIMEFRAMES = ['M5', 'M15'] as const;

/**
 * Alert condition types
 */
export const CONDITION_TYPES = [
  'price_above',
  'price_below',
  'price_equals',
  'price_crosses_above',
  'price_crosses_below',
] as const;

/**
 * Symbol enum for validation
 */
export const symbolEnum = z.enum(SYMBOLS);

/**
 * Timeframe enum for validation
 */
export const timeframeEnum = z.enum(TIMEFRAMES);

/**
 * Condition type enum for validation
 */
export const conditionTypeEnum = z.enum(CONDITION_TYPES);

/**
 * Create alert schema
 */
export const createAlertSchema = z.object({
  symbol: symbolEnum,
  timeframe: timeframeEnum,
  conditionType: conditionTypeEnum,
  targetValue: z
    .number()
    .positive('Target value must be positive')
    .max(1000000, 'Target value exceeds maximum'),
  name: z
    .string()
    .max(100, 'Alert name must not exceed 100 characters')
    .optional(),
  notes: z.string().max(500, 'Notes must not exceed 500 characters').optional(),
  enabled: z.boolean().optional().default(true),
  notifyEmail: z.boolean().optional().default(true),
  notifyPush: z.boolean().optional().default(true),
});

/**
 * Update alert schema
 */
export const updateAlertSchema = z.object({
  id: z.string().min(1, 'Alert ID is required'),
  symbol: symbolEnum.optional(),
  timeframe: timeframeEnum.optional(),
  conditionType: conditionTypeEnum.optional(),
  targetValue: z
    .number()
    .positive('Target value must be positive')
    .max(1000000, 'Target value exceeds maximum')
    .optional(),
  name: z
    .string()
    .max(100, 'Alert name must not exceed 100 characters')
    .optional()
    .nullable(),
  notes: z
    .string()
    .max(500, 'Notes must not exceed 500 characters')
    .optional()
    .nullable(),
  enabled: z.boolean().optional(),
  notifyEmail: z.boolean().optional(),
  notifyPush: z.boolean().optional(),
});

/**
 * Delete alert schema
 */
export const deleteAlertSchema = z.object({
  id: z.string().min(1, 'Alert ID is required'),
});

/**
 * Get alert by ID schema
 */
export const getAlertSchema = z.object({
  id: z.string().min(1, 'Alert ID is required'),
});

/**
 * List alerts query schema
 */
export const listAlertsSchema = z.object({
  symbol: symbolEnum.optional(),
  timeframe: timeframeEnum.optional(),
  enabled: z.boolean().optional(),
  triggered: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

/**
 * Validate symbol for tier.
 * V8: tier-independent — XAUUSD is the only valid symbol for everyone.
 * (Alert CREATION is gated separately: FREE users cannot create alerts.)
 */
export function isSymbolValidForTier(
  symbol: string,
  _tier: 'FREE' | 'PRO'
): boolean {
  return SYMBOLS.includes(symbol as (typeof SYMBOLS)[number]);
}

/**
 * Get allowed symbols for tier.
 * V8: identical for both tiers.
 */
export function getAllowedSymbols(_tier: 'FREE' | 'PRO'): readonly string[] {
  return SYMBOLS;
}

/**
 * Create alert schema with tier validation.
 * V8: symbol validation is tier-independent; the FREE-tier block on alert
 * creation is enforced in the API route via canCreateAlert().
 */
export function createAlertSchemaForTier(_tier: 'FREE' | 'PRO') {
  return createAlertSchema;
}

// Type exports
export type CreateAlertInput = z.infer<typeof createAlertSchema>;
export type UpdateAlertInput = z.infer<typeof updateAlertSchema>;
export type DeleteAlertInput = z.infer<typeof deleteAlertSchema>;
export type GetAlertInput = z.infer<typeof getAlertSchema>;
export type ListAlertsInput = z.infer<typeof listAlertsSchema>;
export type Symbol = (typeof SYMBOLS)[number];
export type Timeframe = (typeof TIMEFRAMES)[number];
export type ConditionType = (typeof CONDITION_TYPES)[number];

/**
 * Line-touch (drawing-engine) alert schemas.
 *
 * Hoisted from `lib/drawing/schema.ts` (Session 4B-5) — that file remains the
 * monolith's own copy for `app/api/drawings/**` (out of this migration
 * slice's scope), but the alert-attach/update shapes are duplicated logic
 * the instant two services both need them, so they move here per the same
 * single-source-of-truth rule every other alert schema in this file follows.
 * Byte-identical validation rules to the SOURCE — do not fork.
 */
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

export type AlertAttachInput = z.infer<typeof AlertAttachZ>;
export type AlertUpdateInput = z.infer<typeof AlertUpdateZ>;

/**
 * Alert-count tier limits (V8: FREE 0 / PRO 100 — Alerts are a PRO-exclusive
 * feature). Hoisted from `lib/tier-validation.ts`'s `getAlertLimit`/
 * `TIER_LIMITS.*.maxAlerts` — only the alert-quota slice, not the full
 * tier-config surface (pricing/trial/rate-limit stay monolith-only, out of
 * this session's scope).
 */
export const ALERT_TIER_LIMITS = { FREE: 0, PRO: 100 } as const;

export function getAlertLimit(tier: 'FREE' | 'PRO'): number {
  return ALERT_TIER_LIMITS[tier];
}
