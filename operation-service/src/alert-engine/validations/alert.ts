/**
 * Alert Validation Schemas
 *
 * Session 4B-2: ported from the monolith's `lib/validations/alert.ts` — which
 * is itself a thin re-export of `@trading-alerts/types/validations` since
 * Session 4B-1 (F9). This file re-exports the same schemas so
 * `operation-service`'s alert engine validates identically to the monolith.
 * Never fork these schemas — edit `packages/types/src/validations/alert.ts`
 * instead.
 */

export {
  SYMBOLS,
  FREE_SYMBOLS,
  TIMEFRAMES,
  CONDITION_TYPES,
  symbolEnum,
  timeframeEnum,
  conditionTypeEnum,
  createAlertSchema,
  updateAlertSchema,
  deleteAlertSchema,
  getAlertSchema,
  listAlertsSchema,
  isSymbolValidForTier,
  getAllowedSymbols,
  createAlertSchemaForTier,
} from '@trading-alerts/types/validations';

export type {
  CreateAlertInput,
  UpdateAlertInput,
  DeleteAlertInput,
  GetAlertInput,
  ListAlertsInput,
  Symbol,
  Timeframe,
  ConditionType,
} from '@trading-alerts/types/validations';
