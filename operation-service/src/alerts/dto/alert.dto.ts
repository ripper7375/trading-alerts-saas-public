/**
 * Alerts CRUD DTOs (Session 4B-5).
 *
 * Validation runs through `ZodValidationPipe` against the canonical Zod
 * schemas (not class-validator decorators) — see that pipe's own header for
 * why. These are type-only re-exports giving controller/service signatures
 * a name, matching the module layout the order names
 * (`operation-service/src/alerts/dto/alert.dto.ts`).
 *
 * @module alerts/dto/alert.dto
 */
export type {
  CreatePlainAlertInput as CreateAlertDto,
  UpdatePlainAlertInput as UpdateAlertDto,
} from '../alerts.schemas';
export type {
  AlertAttachInput as AttachLineAlertDto,
  AlertUpdateInput as UpdateLineAlertDto,
} from '@trading-alerts/types/validations';
