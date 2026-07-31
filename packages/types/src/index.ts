/**
 * @trading-alerts/types — root barrel.
 *
 * Shared types, Zod validation schemas, and drawing-geometry math consumed by
 * the Next.js monolith and NestJS microservices (operation-service,
 * money-service). Established Session 4B-1 to resolve F9. See
 * docs/migration-orders/4b-1-types-and-geometry.migration-order.md.
 *
 * Subpath exports (`@trading-alerts/types/geometry`,
 * `@trading-alerts/types/alert-engine`, `@trading-alerts/types/validations`)
 * are also available for more granular imports.
 *
 * @module @trading-alerts/types
 */

export * from './geometry';
export * from './alert-engine/types';
export * from './validations/alert';
