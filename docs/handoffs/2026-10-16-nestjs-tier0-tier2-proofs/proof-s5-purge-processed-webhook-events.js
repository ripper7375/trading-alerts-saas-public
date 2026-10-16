// Proof script from docs/handoffs/2026-10-16-nestjs-tier0-tier2-execution.md, addendum
// (sibling defect fix, unit 5: the ProcessedWebhookEvent purge).
// Runs the COMPILED money-service (`npm run build` first) against a SCRATCH PostgreSQL
// (see README.md). It writes and deletes rows: never point it at a real database.
//
// Seeds claims at known ages, runs ProcessedWebhookEventService.purgeOlderThan() once and
// checks which rows are left: only those older than 90 days go, finished or not, and the
// provider is irrelevant. Ages are written relative to the database's own clock in UTC, the
// column being a TIMESTAMP(3) without a time zone.
process.env.DATABASE_URL =
  process.env.PROOF_DATABASE_URL || 'postgresql://postgres@127.0.0.1:55432/t2';
process.env.NODE_ENV = 'test';
const path = require('path');
const ms =
  process.env.MONEY_SERVICE_DIST ||
  path.resolve(__dirname, '../../../money-service/dist');
require(path.resolve(ms, '../node_modules/reflect-metadata'));
const { PrismaService } = require(`${ms}/prisma/prisma.service`);
const { ProcessedWebhookEventService } = require(
  `${ms}/webhooks/processed-webhook-event.service`
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
  const service = new ProcessedWebhookEventService(prisma);

  await q(`DELETE FROM "ProcessedWebhookEvent" WHERE "eventId" LIKE 'purge-%'`);
  // [provider, eventId, age in days, finished?]
  const seed = [
    ['stripe', 'purge-100d-done', 100, true],
    ['stripe', 'purge-100d-crashed', 100, false],
    ['dlocal', 'purge-95d-done', 95, true],
    ['stripe', 'purge-91d-done', 91, true],
    ['stripe', 'purge-89d-done', 89, true],
    ['stripe', 'purge-3d-done', 3, true],
    ['stripe', 'purge-now-open', 0, false],
  ];
  for (const [provider, eventId, days, done] of seed) {
    await q(
      `INSERT INTO "ProcessedWebhookEvent"(provider,"eventId","createdAt","completedAt")
       VALUES ($1,$2,(now() at time zone 'utc') - ($3 || ' days')::interval,
               CASE WHEN $4::boolean THEN (now() at time zone 'utc') ELSE NULL END)`,
      provider,
      eventId,
      String(days),
      done
    );
  }

  const deleted = await service.purgeOlderThan();
  const left = (
    await q(
      `SELECT "eventId" FROM "ProcessedWebhookEvent" WHERE "eventId" LIKE 'purge-%' ORDER BY "eventId"`
    )
  ).map((r) => r.eventId);
  console.log(
    `      purgeOlderThan() deleted ${deleted}; left: ${left.join(', ')}`
  );

  check(
    'deleted the 4 rows older than 90 days',
    deleted === 4,
    `deleted=${deleted}`
  );
  check(
    'removed the 91-day-old claim too (just past the cutoff)',
    !left.includes('purge-91d-done'),
    ''
  );
  check(
    'kept exactly the rows younger than 90 days (89 d, 3 d, now)',
    JSON.stringify(left) ===
      JSON.stringify(['purge-3d-done', 'purge-89d-done', 'purge-now-open']),
    left.join(', ')
  );
  check(
    'an unfinished claim from today is kept (the lease logic still owns it)',
    left.includes('purge-now-open'),
    ''
  );
  const second = await service.purgeOlderThan();
  check('a second run finds nothing more', second === 0, `deleted=${second}`);

  await q(`DELETE FROM "ProcessedWebhookEvent" WHERE "eventId" LIKE 'purge-%'`);
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
