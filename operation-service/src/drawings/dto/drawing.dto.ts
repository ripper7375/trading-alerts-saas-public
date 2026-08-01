/**
 * Drawings CRUD DTOs (Session 4B-8).
 *
 * Validation runs through `ZodValidationPipe` against the canonical Zod
 * schemas (not class-validator decorators), matching the established
 * convention from Alerts CRUD (Session 4B-5). Type-only re-exports giving
 * controller/service signatures a name.
 *
 * @module drawings/dto/drawing.dto
 */
export type {
  CreateDrawingInput as CreateDrawingDto,
  UpdateDrawingInput as UpdateDrawingDto,
} from '../drawings.schemas';
