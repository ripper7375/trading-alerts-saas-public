/**
 * User profile/preferences/password/account-deletion DTOs (Session 4B-11).
 *
 * Validation runs through `ZodValidationPipe` against the canonical Zod
 * schemas (not class-validator decorators), matching the established
 * convention from Alerts CRUD / Drawings. Type-only re-exports giving
 * controller/service signatures a name.
 *
 * @module users/dto/user.dto
 */
export type {
  UpdateProfileInput as UpdateProfileDto,
  UpdatePreferencesInput as UpdatePreferencesDto,
  ChangePasswordInput as ChangePasswordDto,
  DeletionConfirmInput as DeletionConfirmDto,
  DeletionCancelInput as DeletionCancelDto,
} from '../users.schemas';
