// Feature flags gating the money-service Slice-3 read-API transport (Session
// 4A-7a, step 4). Both default OFF in every environment, including local —
// when OFF, every route resolves strictly to the monolith's existing Prisma
// logic. Split by group (not one MIGRATE_READ_APIS_MONEY flag) so 4A-7b can
// flip affiliate-dashboard routes first and admin routes last, each with
// independent rollback, without a code deploy in between.

export function isAffiliateReadApiMigrated(): boolean {
  return process.env['MIGRATE_READ_APIS_MONEY_AFFILIATE'] === 'true';
}

export function isAdminReadApiMigrated(): boolean {
  return process.env['MIGRATE_READ_APIS_MONEY_ADMIN'] === 'true';
}
