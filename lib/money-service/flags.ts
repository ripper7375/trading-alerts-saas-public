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

// Feature flags gating the money-service Slice-4 write-API transport
// (Session 4A-10a). All four default OFF in every environment — when OFF,
// every route resolves strictly to the monolith's existing Prisma/Stripe/
// dLocal logic, unchanged. Split by group (not one MIGRATE_WRITE_APIS_MONEY
// flag) so 4A-10b can flip each provider/endpoint-group independently, with
// independent rollback, matching the Slice-3 precedent above.

export function shouldUseMoneyServiceForStripeWrite(): boolean {
  return process.env['MIGRATE_WRITE_APIS_MONEY_STRIPE'] === 'true';
}

export function shouldUseMoneyServiceForDlocalWrite(): boolean {
  return process.env['MIGRATE_WRITE_APIS_MONEY_DLOCAL'] === 'true';
}

export function shouldUseMoneyServiceForAdminWrite(): boolean {
  return process.env['MIGRATE_WRITE_APIS_MONEY_ADMIN'] === 'true';
}

export function shouldUseMoneyServiceForDisbursementWrite(): boolean {
  return process.env['MIGRATE_WRITE_APIS_MONEY_DISBURSEMENT'] === 'true';
}
