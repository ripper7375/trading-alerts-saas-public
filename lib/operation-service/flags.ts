/**
 * Operation Service Feature Flags
 *
 * Environment-variable feature flags controlling traffic routing from the Next.js
 * monolith to operation-service.
 *
 * @module lib/operation-service/flags
 */

/**
 * Check if alert engine evaluation should be routed to operation-service.
 * Default: false (monolith evaluates alerts).
 */
export function shouldUseOperationServiceForAlerts(): boolean {
  return process.env['MIGRATE_ALERT_ENGINE'] === 'true';
}

/**
 * Check if the Alerts CRUD routes (Session 4B-5's AlertsController /
 * LineAlertsController PORT) should forward to operation-service instead of
 * the monolith's own Prisma logic. Default: false (monolith serves Alerts
 * CRUD directly) — Session 4B-6 only wires this check in, it never sets the
 * env var. Distinct from shouldUseOperationServiceForAlerts() above, which
 * gates real-time alert *evaluation* (Slice 6, already cut over), not CRUD.
 */
export function shouldUseOperationServiceForAlertsCrud(): boolean {
  return process.env['MIGRATE_ALERTS_CRUD'] === 'true';
}
