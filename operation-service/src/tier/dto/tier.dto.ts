/**
 * Tier DTOs (Session 4B-10).
 *
 * Validation runs through `ZodValidationPipe` against the canonical Zod
 * schema in `../tier.schemas` (not class-validator decorators), matching
 * the established convention from Alerts/Drawings/Notifications. Type-only
 * re-export giving the controller/service signature a name.
 *
 * @module tier/dto/tier.dto
 */
export type { Tier } from '../tier.schemas';
