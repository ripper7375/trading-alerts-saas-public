// Proof script from docs/handoffs/2026-10-16-nestjs-tier0-tier2-execution.md.
// Runs the COMPILED money-service (`npm run build` first) against a SCRATCH PostgreSQL
// (see README.md). It writes and deletes rows: never point it at a real database.
// Real-database proof for Remediation Tier 2 §6.1 (run against the scratch PostgreSQL, never production).
// Uses the COMPILED money-service classes; only their non-database collaborators are stubbed.
process.env.DATABASE_URL =
  process.env.PROOF_DATABASE_URL || 'postgresql://postgres@127.0.0.1:55432/t2';
process.env.NODE_ENV = 'test';
const path = require('path');
const ms =
  process.env.MONEY_SERVICE_DIST ||
  path.resolve(__dirname, '../../../money-service/dist');
require(path.resolve(ms, '../node_modules/reflect-metadata'));
const { PrismaService } = require(`${ms}/prisma/prisma.service`);
const { ProcessedWebhookEventService, CLAIM_LEASE_MS } = require(
  `${ms}/webhooks/processed-webhook-event.service`
);
const { ConversionProcessorService } = require(
  `${ms}/affiliate/conversion-processor.service`
);
const { StripeWebhookService } = require(`${ms}/stripe/stripe-webhook.service`);

let failures = 0;
function check(name, ok, detail) {
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`
  );
  if (!ok) failures++;
}

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  const claims = new ProcessedWebhookEventService(prisma);
  const conversion = new ConversionProcessorService(prisma, {
    getBasePriceUsd: async () => 29,
  });
  const webhook = new StripeWebhookService(
    prisma,
    conversion,
    { recordInTransaction: async () => undefined },
    { retrieveCharge: async () => ({}) },
    { getBasePriceUsd: async () => 29 }
  );
  const q = (sql, ...p) => prisma.$queryRawUnsafe(sql, ...p);

  // ---- 0. reset: the script must be re-runnable
  await q(`DELETE FROM "ProcessedWebhookEvent"`);
  await q(
    `DELETE FROM "Commission" WHERE id IN ('r1','r2') OR "clawbackOfCommissionId" IN ('r1','r2') OR "stripeInvoiceId"='inv_new'`
  );
  await q(`DELETE FROM "Subscription" WHERE id='s1'`);

  // ---- 1. claim race: N concurrent deliveries of one event -> exactly one claims
  let r = await Promise.all(
    Array.from({ length: 20 }, () => claims.claim('stripe', 'evt_race'))
  );
  check(
    'claim race: exactly 1 of 20 concurrent deliveries is "claimed"',
    r.filter((x) => x === 'claimed').length === 1 &&
      r.filter((x) => x === 'duplicate').length === 19,
    JSON.stringify(r.reduce((a, x) => ((a[x] = (a[x] || 0) + 1), a), {}))
  );

  // ---- 2. complete -> still a duplicate; release never deletes a COMPLETED claim
  await claims.complete('stripe', 'evt_race');
  check(
    'after complete(): a redelivery is a duplicate',
    (await claims.claim('stripe', 'evt_race')) === 'duplicate'
  );
  await claims.release('stripe', 'evt_race');
  check(
    'release() leaves a COMPLETED claim alone',
    (await claims.claim('stripe', 'evt_race')) === 'duplicate'
  );

  // ---- 3. failure path: claim -> release -> the retry claims again
  check(
    'fresh event is claimed',
    (await claims.claim('stripe', 'evt_fail')) === 'claimed'
  );
  await claims.release('stripe', 'evt_fail');
  check(
    'after release(): the retry is claimed again',
    (await claims.claim('stripe', 'evt_fail')) === 'claimed'
  );

  // ---- 4. lease: an UNFINISHED claim older than the lease is taken over by exactly one of N
  await q(
    `INSERT INTO "ProcessedWebhookEvent"(provider,"eventId","createdAt") VALUES ('stripe','evt_stale', (now() at time zone 'utc') - interval '1 hour')`
  );
  await q(
    `INSERT INTO "ProcessedWebhookEvent"(provider,"eventId","createdAt") VALUES ('stripe','evt_young', (now() at time zone 'utc') - interval '1 minute')`
  );
  r = await Promise.all(
    Array.from({ length: 10 }, () => claims.claim('stripe', 'evt_stale'))
  );
  check(
    'stale unfinished claim: exactly 1 of 10 retries takes it over',
    r.filter((x) => x === 'claimed').length === 1 &&
      r.filter((x) => x === 'duplicate').length === 9,
    JSON.stringify(r.reduce((a, x) => ((a[x] = (a[x] || 0) + 1), a), {}))
  );
  check(
    'young unfinished claim (inside the lease) is NOT taken over',
    (await claims.claim('stripe', 'evt_young')) === 'duplicate'
  );
  console.log(`      (lease = ${CLAIM_LEASE_MS / 60000} min)`);

  // ---- 5. providers do not collide
  check(
    'same eventId under another provider is a separate claim',
    (await claims.claim('dlocal', 'evt_race')) === 'claimed'
  );

  // ---- 6. commission credit race: one invoice, N concurrent deliveries -> one row, counters once
  await q(
    `UPDATE "AffiliateProfile" SET "totalEarnings"=100, "pendingCommissions"=100, "totalCodesUsed"=5 WHERE id='p1'`
  );
  const before = (
    await q(
      `SELECT "totalEarnings"::float AS e, "totalCodesUsed" AS c FROM "AffiliateProfile" WHERE id='p1'`
    )
  )[0];
  const credit = () =>
    conversion.creditAffiliateCommission({
      affiliateCodeId: 'c1',
      userId: 'u1',
      subscriptionId: 'sub_x',
      grossRevenueUsd: 29,
      stripeInvoiceId: 'inv_new',
      interval: 'month',
    });
  r = await Promise.all(Array.from({ length: 10 }, credit));
  const rows = (
    await q(
      `SELECT count(*)::int AS n FROM "Commission" WHERE "affiliateCodeId"='c1' AND "stripeInvoiceId"='inv_new'`
    )
  )[0].n;
  const after = (
    await q(
      `SELECT "totalEarnings"::float AS e, "totalCodesUsed" AS c FROM "AffiliateProfile" WHERE id='p1'`
    )
  )[0];
  check(
    'credit race: exactly 1 of 10 deliveries credits',
    r.filter((x) => x.processed).length === 1,
    JSON.stringify(
      r
        .map((x) => (x.processed ? 'credited' : x.reason))
        .reduce((a, x) => ((a[x] = (a[x] || 0) + 1), a), {})
    )
  );
  check(
    'credit race: exactly 1 Commission row for the invoice',
    rows === 1,
    `rows=${rows}`
  );
  check(
    'credit race: affiliate counters moved once (totalCodesUsed +1)',
    after.c === before.c + 1 && Math.abs(after.e - before.e - 5.8) < 1e-9,
    `codesUsed ${before.c}->${after.c}, earnings ${before.e}->${after.e}`
  );

  // ---- 7. refund race on a PENDING commission
  await q(
    `INSERT INTO "Subscription"(id,"userId",status,"amountUsd","stripeCustomerId","stripeSubscriptionId","updatedAt") VALUES ('s1','u1','ACTIVE',29,'cus_x','sub_x',now())`
  );
  await q(`INSERT INTO "Commission"(id,"affiliateProfileId","affiliateCodeId","userId","subscriptionId","stripeInvoiceId","grossRevenue","discountAmount","netRevenue","commissionAmount",status,"updatedAt")
           VALUES ('r1','p1','c1','u1','sub_x','inv_r1',29,0,29,5.8,'PENDING',now())`);
  await q(
    `UPDATE "AffiliateProfile" SET "totalEarnings"=100, "pendingCommissions"=100, "totalCodesUsed"=5 WHERE id='p1'`
  );
  await Promise.all(
    Array.from({ length: 10 }, () =>
      webhook.handleChargeRefunded({ customer: 'cus_x', invoice: 'inv_r1' })
    )
  );
  let p = (
    await q(
      `SELECT "totalEarnings"::float AS e, "pendingCommissions"::float AS pc, "totalCodesUsed" AS c FROM "AffiliateProfile" WHERE id='p1'`
    )
  )[0];
  const st = (
    await q(`SELECT status::text AS s FROM "Commission" WHERE id='r1'`)
  )[0].s;
  check(
    'refund race (PENDING): commission CANCELLED once',
    st === 'CANCELLED',
    st
  );
  check(
    'refund race (PENDING): counters reversed exactly once (100-5.8, codesUsed 5-1)',
    Math.abs(p.e - 94.2) < 1e-9 && Math.abs(p.pc - 94.2) < 1e-9 && p.c === 4,
    JSON.stringify(p)
  );

  // ---- 8. refund race on a PAID commission -> exactly one clawback row
  await q(`INSERT INTO "Commission"(id,"affiliateProfileId","affiliateCodeId","userId","subscriptionId","stripeInvoiceId","grossRevenue","discountAmount","netRevenue","commissionAmount",status,"updatedAt")
           VALUES ('r2','p1','c1','u1','sub_x','inv_r2',29,0,29,5.8,'PAID',now())`);
  await q(
    `UPDATE "AffiliateProfile" SET "totalEarnings"=100, "pendingCommissions"=100 WHERE id='p1'`
  );
  await Promise.all(
    Array.from({ length: 10 }, () =>
      webhook.handleChargeRefunded({ customer: 'cus_x', invoice: 'inv_r2' })
    )
  );
  const claw = (
    await q(
      `SELECT count(*)::int AS n FROM "Commission" WHERE "clawbackOfCommissionId"='r2'`
    )
  )[0].n;
  p = (
    await q(
      `SELECT "totalEarnings"::float AS e, "pendingCommissions"::float AS pc FROM "AffiliateProfile" WHERE id='p1'`
    )
  )[0];
  check(
    'refund race (PAID): exactly 1 clawback row',
    claw === 1,
    `clawbacks=${claw}`
  );
  check(
    'refund race (PAID): counters deducted exactly once (100-5.8)',
    Math.abs(p.e - 94.2) < 1e-9 && Math.abs(p.pc - 94.2) < 1e-9,
    JSON.stringify(p)
  );

  await prisma.$disconnect();
  console.log(
    failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`
  );
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => {
  console.error('SCRIPT ERROR', e);
  process.exit(2);
});
