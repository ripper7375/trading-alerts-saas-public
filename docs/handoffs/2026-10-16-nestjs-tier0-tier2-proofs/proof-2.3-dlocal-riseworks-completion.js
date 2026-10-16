// Proof script from docs/handoffs/2026-10-16-nestjs-tier0-tier2-execution.md.
// Runs the COMPILED money-service (`npm run build` first) against a SCRATCH PostgreSQL
// (see README.md). It writes and deletes rows: never point it at a real database.
// Real-database proof for Remediation Tier 2 §6.3 (scratch PostgreSQL only).
process.env.DATABASE_URL =
  process.env.PROOF_DATABASE_URL || 'postgresql://postgres@127.0.0.1:55432/t2';
process.env.NODE_ENV = 'test';
const path = require('path');
const ms =
  process.env.MONEY_SERVICE_DIST ||
  path.resolve(__dirname, '../../../money-service/dist');
require(path.resolve(ms, '../node_modules/reflect-metadata'));
const { PrismaService } = require(`${ms}/prisma/prisma.service`);
const { OutboxService } = require(`${ms}/outbox/outbox.service`);
const { DlocalWebhookController } = require(
  `${ms}/dlocal/dlocal-webhook.controller`
);
const { WebhookEventProcessorService } = require(
  `${ms}/disbursement/webhook-event-processor.service`
);

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
  const N = 10;

  // ================= dLocal =================
  const outbox = new OutboxService();
  let conversions = 0;
  const controller = new DlocalWebhookController(
    prisma,
    { markThreeDayPlanUsed: async () => undefined },
    {
      processAffiliateConversion: async () => {
        conversions++;
        return { processed: true };
      },
    },
    outbox,
    {
      getBasePriceUsd: async () => 29,
      getThreeDayPriceUsd: async () => 2.49,
      getAnnualPriceUsd: async () => 350,
    }
  );

  const counts = async (userId) => ({
    notifications: (
      await q(
        `SELECT count(*)::int AS n FROM "Notification" WHERE "userId"='${userId}'`
      )
    )[0].n,
    outbox: (
      await q(
        `SELECT count(*)::int AS n FROM "OutboxEvent" WHERE "aggregateId"='${userId}'`
      )
    )[0].n,
  });

  // control: the OLD flow -- the flag is read BEFORE the transaction, so every racer sees "not completed"
  const stale = (await q(`SELECT * FROM "Payment" WHERE id='pay-dl-old'`))[0];
  async function oldFlow() {
    const alreadyCompleted = stale.status === 'COMPLETED';
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: stale.id },
        data: { status: 'COMPLETED', providerStatus: 'PAID' },
      });
      await tx.user.update({
        where: { id: stale.userId },
        data: { tier: 'PRO' },
      });
      if (!alreadyCompleted) {
        await outbox.recordInTransaction(tx, {
          aggregateType: 'User',
          aggregateId: stale.userId,
          eventType: 'TIER_UPGRADED',
          payload: { tier: 'PRO' },
        });
      }
    });
    if (!alreadyCompleted) {
      await prisma.notification.create({
        data: {
          userId: stale.userId,
          type: 'SUBSCRIPTION',
          title: 'Welcome to PRO!',
          body: 'x',
          priority: 'HIGH',
        },
      });
    }
  }
  await Promise.all(Array.from({ length: N }, oldFlow));
  let c = await counts('u-dl-old');
  console.log(
    `      control (old flow): ${N} concurrent deliveries -> ${c.outbox} outbox events, ${c.notifications} notifications`
  );
  check(
    'control: the OLD dLocal flow repeats the one-time effects under concurrency (this is the defect)',
    c.outbox > 1 && c.notifications > 1,
    JSON.stringify(c)
  );

  // the new controller
  const payment = (await q(`SELECT * FROM "Payment" WHERE id='pay-dl'`))[0]; // every racer holds this same stale read
  const webhookData = { id: 'dl-1', status: 'PAID', order_id: 'o-1' };
  await Promise.all(
    Array.from({ length: N }, () =>
      controller.handlePaymentCompleted(payment, webhookData)
    )
  );
  c = await counts('u-dl');
  const subs = (
    await q(
      `SELECT count(*)::int AS n FROM "Subscription" WHERE "userId"='u-dl'`
    )
  )[0].n;
  const st = (await q(`SELECT status FROM "Payment" WHERE id='pay-dl'`))[0]
    .status;
  check(
    'new dLocal: exactly 1 TIER_UPGRADED outbox event for 10 concurrent deliveries',
    c.outbox === 1,
    JSON.stringify(c)
  );
  check(
    'new dLocal: exactly 1 notification',
    c.notifications === 1,
    JSON.stringify(c)
  );
  check(
    'new dLocal: one Subscription row, payment COMPLETED',
    subs === 1 && st === 'COMPLETED',
    `subs=${subs} status=${st}`
  );
  const expiry1 = (
    await q(`SELECT "expiresAt" FROM "Subscription" WHERE "userId"='u-dl'`)
  )[0].expiresAt.getTime();
  await new Promise((r) => setTimeout(r, 30));
  await controller.handlePaymentCompleted(payment, webhookData);
  const expiry2 = (
    await q(`SELECT "expiresAt" FROM "Subscription" WHERE "userId"='u-dl'`)
  )[0].expiresAt.getTime();
  check(
    'new dLocal: a later replay does not extend the subscription expiry',
    expiry1 === expiry2,
    `${expiry1} vs ${expiry2}`
  );
  c = await counts('u-dl');
  check(
    'new dLocal: a later replay adds no outbox event or notification',
    c.outbox === 1 && c.notifications === 1,
    JSON.stringify(c)
  );

  // ================= RiseWorks =================
  const logger = {
    logPaymentCompleted: async () => undefined,
    logPaymentFailed: async () => undefined,
    log: async () => undefined,
  };
  const processor = new WebhookEventProcessorService(prisma, logger);
  const profile = async () =>
    (
      await q(
        `SELECT "pendingCommissions"::float AS pc, "paidCommissions"::float AS paid FROM "AffiliateProfile" WHERE id='p1'`
      )
    )[0];
  const reset = () =>
    q(
      `UPDATE "AffiliateProfile" SET "pendingCommissions"=100, "paidCommissions"=0 WHERE id='p1'`
    );

  // control: the OLD flow (status read outside, unconditional update inside)
  await reset();
  async function oldRise() {
    const t = (
      await q(
        `SELECT id, status::text AS status, "commissionId" FROM "DisbursementTransaction" WHERE id='dt-old'`
      )
    )[0];
    if (t.status === 'COMPLETED') return;
    await new Promise((r) => setTimeout(r, 25));
    await prisma.$transaction(async (tx) => {
      await tx.disbursementTransaction.update({
        where: { id: t.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      const commission = await tx.commission.update({
        where: { id: t.commissionId },
        data: { status: 'PAID', paidAt: new Date() },
        select: { affiliateProfileId: true, commissionAmount: true },
      });
      await tx.affiliateProfile.update({
        where: { id: commission.affiliateProfileId },
        data: {
          pendingCommissions: { decrement: commission.commissionAmount },
          paidCommissions: { increment: commission.commissionAmount },
        },
      });
    });
  }
  await Promise.all(Array.from({ length: N }, oldRise));
  let p = await profile();
  console.log(
    `      control (old flow): ${N} concurrent deliveries -> pending 100 -> ${p.pc}, paid 0 -> ${p.paid}`
  );
  check(
    'control: the OLD RiseWorks flow moves the balance more than once (this is the defect)',
    p.paid > 10,
    JSON.stringify(p)
  );

  await reset();
  const results = await Promise.all(
    Array.from({ length: N }, () =>
      processor.processEvent({
        event: 'payment.completed',
        data: { providerTxId: 'ptx-new', amount: 10 },
        timestamp: new Date(),
      })
    )
  );
  p = await profile();
  check(
    'new RiseWorks: every delivery is acknowledged as processed',
    results.every((r) => r.processed),
    JSON.stringify(results.map((r) => r.message.slice(0, 22)))
  );
  check(
    'new RiseWorks: balance moved from pending to paid exactly once (100->90, 0->10)',
    Math.abs(p.pc - 90) < 1e-9 && Math.abs(p.paid - 10) < 1e-9,
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
