/**
 * Notifications DTOs (Session 4B-9).
 *
 * Validation runs through `ZodValidationPipe` against the canonical Zod
 * schema (not class-validator decorators), matching the established
 * convention from Alerts CRUD (Session 4B-5) / Drawings CRUD (Session 4B-8).
 * Type-only re-export giving the controller/service signature a name.
 *
 * @module notifications/dto/notification.dto
 */
export type { NotificationQueryInput as NotificationQueryDto } from '../notifications.schemas';
