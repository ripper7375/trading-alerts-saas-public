// Proof script from docs/handoffs/2026-10-16-nestjs-tier0-tier2-execution.md.
// Runs the COMPILED money-service (`npm run build` first) against a SCRATCH PostgreSQL
// (see README.md). It writes and deletes rows: never point it at a real database.
// Real-database proof for Remediation Tier 2 §6.6 (scratch PostgreSQL + a local HTTP target only).
const http = require('http');
process.env.DATABASE_URL =
  process.env.PROOF_DATABASE_URL || 'postgresql://postgres@127.0.0.1:55432/t2';
process.env.NODE_ENV = 'test';
const path = require('path');
const ms =
  process.env.MONEY_SERVICE_DIST ||
  path.resolve(__dirname, '../../../money-service/dist');
require(path.resolve(ms, '../node_modules/reflect-metadata'));
const { PrismaService } = require(`${ms}/prisma/prisma.service`);
const { OutboxPublisherCron } = require(`${ms}/outbox/outbox-publisher.cron`);

let failures = 0;
const check = (name, ok, detail) => {
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`
  );
  if (!ok) failures++;
};

async function main() {
  const delivered = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      delivered.push(JSON.parse(body).id);
      res.statusCode = 200;
      res.end('{}');
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  process.env.OUTBOX_PUBLISHER_TARGET_URL = `http://127.0.0.1:${server.address().port}/events`;

  const prisma = new PrismaService();
  await prisma.$connect();
  const q = (sql, ...p) => prisma.$queryRawUnsafe(sql, ...p);
  const U = `(now() at time zone 'utc')`;

  await q(`DELETE FROM "OutboxEvent" WHERE id LIKE 'ob-%'`);
  const ins = (id, status, processedAt, createdAt) =>
    q(`INSERT INTO "OutboxEvent"(id,"aggregateType","aggregateId","eventType",payload,status,"processedAt","createdAt")
       VALUES ('${id}','User','u1','TIER_UPGRADED','{}','${status}',${processedAt},${createdAt})`);
  await ins(
    'ob-stale',
    'PROCESSING',
    `${U} - interval '10 minutes'`,
    `${U} - interval '20 minutes'`
  );
  await ins(
    'ob-fresh',
    'PROCESSING',
    `${U} - interval '1 minute'`,
    `${U} - interval '20 minutes'`
  );
  await ins('ob-legacy-old', 'PROCESSING', 'NULL', `${U} - interval '2 hours'`);
  await ins(
    'ob-legacy-new',
    'PROCESSING',
    'NULL',
    `${U} - interval '1 minute'`
  );
  await ins('ob-pending', 'PENDING', 'NULL', `${U} - interval '30 seconds'`);

  const cron = new OutboxPublisherCron(prisma);
  const result = await cron.publishPendingEvents();
  const status = Object.fromEntries(
    (
      await q(
        `SELECT id, status::text AS s, "processedAt" IS NOT NULL AS has_t FROM "OutboxEvent" WHERE id LIKE 'ob-%'`
      )
    ).map((r) => [r.id, r.s])
  );

  check(
    'recovered exactly the two dead rows (stale claim, old legacy claim)',
    result.recovered === 2,
    JSON.stringify(result)
  );
  check(
    'the stale-claim row was delivered',
    delivered.includes('ob-stale') && status['ob-stale'] === 'PROCESSED',
    status['ob-stale']
  );
  check(
    'the old legacy row (no claim time) was delivered',
    delivered.includes('ob-legacy-old') &&
      status['ob-legacy-old'] === 'PROCESSED',
    status['ob-legacy-old']
  );
  check(
    'the ordinary PENDING row was delivered',
    delivered.includes('ob-pending') && status['ob-pending'] === 'PROCESSED',
    status['ob-pending']
  );
  check(
    'a row claimed 1 minute ago is NOT touched (still PROCESSING, not delivered)',
    status['ob-fresh'] === 'PROCESSING' && !delivered.includes('ob-fresh'),
    status['ob-fresh']
  );
  check(
    'a legacy row created 1 minute ago is NOT touched',
    status['ob-legacy-new'] === 'PROCESSING' &&
      !delivered.includes('ob-legacy-new'),
    status['ob-legacy-new']
  );

  // a delivery that fails hands the row back with its claim time cleared
  await q(`DELETE FROM "OutboxEvent" WHERE id LIKE 'ob-%'`);
  await ins('ob-fail', 'PENDING', 'NULL', `${U}`);
  process.env.OUTBOX_PUBLISHER_TARGET_URL = 'http://127.0.0.1:1/unreachable';
  const failing = new OutboxPublisherCron(prisma);
  await failing.publishPendingEvents();
  const f = (
    await q(
      `SELECT status::text AS s, "processedAt" AS p, "attemptCount" AS n FROM "OutboxEvent" WHERE id='ob-fail'`
    )
  )[0];
  check(
    'a failed delivery returns the row to PENDING with the claim time cleared and the attempt counted',
    f.s === 'PENDING' && f.p === null && f.n === 1,
    JSON.stringify(f)
  );

  await q(`DELETE FROM "OutboxEvent" WHERE id LIKE 'ob-%'`);
  await prisma.$disconnect();
  server.close();
  console.log(
    failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`
  );
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => {
  console.error('SCRIPT ERROR', e);
  process.exit(2);
});
