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

/**
 * Check if the Drawings CRUD routes (Session 4B-8's DrawingsController
 * PORT) should forward to operation-service instead of the monolith's own
 * Prisma logic. Default: false (monolith serves Drawings CRUD directly).
 */
export function shouldUseOperationServiceForDrawings(): boolean {
  return process.env['MIGRATE_DRAWINGS'] === 'true';
}

/**
 * Check if the Notifications routes (Session 4B-9's NotificationsController
 * PORT) should forward to operation-service instead of the monolith's own
 * Prisma logic. Default: false (monolith serves Notifications directly).
 */
export function shouldUseOperationServiceForNotifications(): boolean {
  return process.env['MIGRATE_NOTIFICATIONS'] === 'true';
}

/**
 * Check if the Tier routes (Session 4B-10's TierController PORT) should
 * forward to operation-service instead of the monolith's own local
 * tier-config logic. Default: false (monolith serves Tier directly).
 */
export function shouldUseOperationServiceForTier(): boolean {
  return process.env['MIGRATE_TIER'] === 'true';
}

/**
 * Check if the User Profile/Preferences/Password routes (Session 4B-11's
 * UsersController PORT) should forward to operation-service. Default: false
 * (monolith serves these directly).
 */
export function shouldUseOperationServiceForUserProfile(): boolean {
  return process.env['MIGRATE_USER_PROFILE'] === 'true';
}

/**
 * Check if the 2FA routes (Session 4B-11) should forward to
 * operation-service's UsersController (which itself delegates to the
 * already-live TwoFactorService). Default: false.
 */
export function shouldUseOperationServiceForUser2FA(): boolean {
  return process.env['MIGRATE_USER_2FA'] === 'true';
}

/**
 * Check if the Sessions/Login-History/Account-Deletion routes (Session
 * 4B-11) should forward to operation-service. Default: false.
 */
export function shouldUseOperationServiceForUserSessions(): boolean {
  return process.env['MIGRATE_USER_SESSIONS'] === 'true';
}
