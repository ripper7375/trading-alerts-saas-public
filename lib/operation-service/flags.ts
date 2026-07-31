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
