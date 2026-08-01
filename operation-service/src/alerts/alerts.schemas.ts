import { z } from 'zod';
import { SYMBOLS, TIMEFRAMES } from '@trading-alerts/types/validations';

/**
 * Plain (price) alert schemas — mirrors `app/api/alerts/route.ts`'s and
 * `app/api/alerts/[id]/route.ts`'s OWN route-local `z.object()` schemas
 * exactly, verbatim.
 *
 * These are deliberately NOT the same as `@trading-alerts/types`'s
 * `createAlertSchema`/`updateAlertSchema` (re-exported by
 * `operation-service/src/alert-engine/validations/alert.ts`) — that pair
 * allows 5 condition types (including `price_crosses_above`/
 * `price_crosses_below`) and extra fields (`notes`, `enabled`,
 * `notifyEmail`, `notifyPush`) used by the alert-engine's own internal
 * validation (ported Session 4B-2). The live `/api/alerts` route has always
 * validated against its own narrower, 3-condition-type, inline schema — two
 * independent "create alert" schemas already existed in this codebase
 * before this session; porting either one under the other's name would
 * silently change accepted input. See Session 4B-5 Deviations.
 *
 * @module alerts/alerts.schemas
 */
export const createPlainAlertSchema = z.object({
  symbol: z.enum(SYMBOLS, {
    errorMap: () => ({ message: 'Only XAUUSD is supported' }),
  }),
  timeframe: z.enum(TIMEFRAMES, {
    errorMap: () => ({ message: 'Only M5 and M15 timeframes are supported' }),
  }),
  conditionType: z.enum(['price_above', 'price_below', 'price_equals'], {
    errorMap: () => ({ message: 'Invalid condition type' }),
  }),
  targetValue: z.number().positive('Target value must be positive'),
  name: z.string().max(100).optional(),
});

export const updatePlainAlertSchema = z.object({
  isActive: z.boolean().optional(),
  name: z.string().max(100).optional(),
  targetValue: z.number().positive().optional(),
});

export type CreatePlainAlertInput = z.infer<typeof createPlainAlertSchema>;
export type UpdatePlainAlertInput = z.infer<typeof updatePlainAlertSchema>;
