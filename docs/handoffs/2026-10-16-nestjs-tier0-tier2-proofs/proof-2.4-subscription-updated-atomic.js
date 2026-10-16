// Proof script from docs/handoffs/2026-10-16-nestjs-tier0-tier2-execution.md.
// Runs the COMPILED money-service (`npm run build` first) against a SCRATCH PostgreSQL
// (see README.md). It writes and deletes rows: never point it at a real database.
// Real-database proof for Remediation Tier 2 §6.4(b): subscription.updated is atomic (scratch PostgreSQL only).
process.env.DATABASE_URL =
  process.env.PROOF_DATABASE_URL || 'postgresql://postgres@127.0.0.1:55432/t2';
process.env.NODE_ENV = 'test';
const path = require('path');
const ms =
  process.env.MONEY_SERVICE_DIST ||
  path.resolve(__dirname, '../../../money-service/dist');
require(path.resolve(ms, '../node_modules/reflect-metadata'));
const { PrismaService } = require(`${ms}/prisma/prisma.service`);
const { StripeWebhookService } = require(`${ms}/stripe/stripe-webhook.service`);

let failures = 0;
const check = (name, ok, detail) => {
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`
  );
  if (!ok) failures++;
};

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  const q = (sql, ...p) => prisma.$queryRawUnsafe(sql, ...p);
  const service = new StripeWebhookService(
    prisma,
    {},
    { recordInTransaction: async () => undefined },
    {},
    {}
  );
  const event = (id) => ({
    id,
    status: 'past_due',
    current_period_end: 1900000000,
  });

  // a healthy account: the subscription row and the user move together
  await q(`DELETE FROM "Subscription" WHERE id = 's-ok'`);
  await q(`DELETE FROM "User" WHERE id='u-ok'`);
  await q(
    `INSERT INTO "User"(id,email,tier,"updatedAt") VALUES ('u-ok','ok@x.test','PRO',now())`
  );
  await q(
    `INSERT INTO "Subscription"(id,"userId",status,"amountUsd","stripeSubscriptionId","updatedAt") VALUES ('s-ok','u-ok','ACTIVE',29,'sub_ok',now())`
  );
  await service.handleSubscriptionUpdated(event('sub_ok'));
  const ok = (
    await q(
      `SELECT s.status::text AS s, u.tier::text AS t FROM "Subscription" s JOIN "User" u ON u.id=s."userId" WHERE s.id='s-ok'`
    )
  )[0];
  check(
    'healthy: subscription PAST_DUE and the user downgraded to FREE together',
    ok.s === 'PAST_DUE' && ok.t === 'FREE',
    JSON.stringify(ok)
  );

  // a subscription whose user row is missing (seeded with psql under the replica role): the tier write fails -> the subscription write must roll back
  let threw = false;
  try {
    await service.handleSubscriptionUpdated(event('sub_ghost'));
  } catch {
    threw = true;
  }
  const ghost = (
    await q(`SELECT status::text AS s FROM "Subscription" WHERE id='s-ghost'`)
  )[0];
  check(
    'orphan: the failed tier write makes the handler throw (Stripe is told)',
    threw
  );
  check(
    'orphan: the subscription change was rolled back (still ACTIVE, not PAST_DUE)',
    ghost.s === 'ACTIVE',
    JSON.stringify(ghost)
  );

  await prisma.$disconnect();
  console.log(
    failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`
  );
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => {
  console.error('SCRIPT ERROR', e.message);
  process.exit(2);
});
