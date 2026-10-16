// Proof script from docs/handoffs/2026-10-16-nestjs-tier0-tier2-execution.md, addendum
// (sibling defect fix, unit 2: reserveAffiliateCode).
// Runs the COMPILED money-service (`npm run build` first) against a SCRATCH PostgreSQL
// (see README.md). It writes and deletes rows: never point it at a real database.
// Needs the seed rows of seed-2.1-duplicates.sql (user 'u1', affiliate profile 'p1').
//
// Control: the OLD reserveAffiliateCode algorithm (read the status, then an unconditional
// update by id) with 10 checkouts redeeming one code at once: every one of them is told
// "reserved", so ten subscriptions attribute their commissions to one code. New: the
// compiled service, which claims the code with updateMany({ id, status: 'ACTIVE' }).
process.env.DATABASE_URL =
  process.env.PROOF_DATABASE_URL || 'postgresql://postgres@127.0.0.1:55432/t2';
process.env.NODE_ENV = 'test';
const path = require('path');
const ms =
  process.env.MONEY_SERVICE_DIST ||
  path.resolve(__dirname, '../../../money-service/dist');
require(path.resolve(ms, '../node_modules/reflect-metadata'));
const { PrismaService } = require(`${ms}/prisma/prisma.service`);
const { ConversionProcessorService } = require(
  `${ms}/affiliate/conversion-processor.service`
);

let failures = 0;
const check = (name, ok, detail) => {
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`
  );
  if (!ok) failures++;
};
const tally = (arr) =>
  JSON.stringify(arr.reduce((a, x) => ((a[x] = (a[x] || 0) + 1), a), {}));
const CALLERS = 10;

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  const q = (sql, ...p) => prisma.$queryRawUnsafe(sql, ...p);
  const service = new ConversionProcessorService(prisma, {
    getBasePriceUsd: async () => 29,
  });

  async function reset(codeId, code) {
    await q(`DELETE FROM "AffiliateCode" WHERE id='${codeId}'`);
    await q(`INSERT INTO "AffiliateCode"(id,code,"affiliateProfileId","discountPercent","commissionPercent","expiresAt","updatedAt")
             VALUES ('${codeId}','${code}','p1',10,30,(now() at time zone 'utc')+interval '1 day',now())`);
    await q(`UPDATE "AffiliateProfile" SET status='ACTIVE' WHERE id='p1'`);
  }
  const state = async (codeId) =>
    (
      await q(
        `SELECT status::text AS s, "usedBy" AS by, "subscriptionId" AS sub FROM "AffiliateCode" WHERE id='${codeId}'`
      )
    )[0];

  // ---- control: the OLD algorithm (read, check ACTIVE outside, unconditional update by id)
  await reset('rOLD', 'RESOLD');
  async function oldAlgorithm(i) {
    const code = await prisma.affiliateCode.findUnique({
      where: { code: 'RESOLD' },
      include: { affiliateProfile: { select: { status: true } } },
    });
    if (code.status !== 'ACTIVE') return 'not reservable';
    await new Promise((r) => setTimeout(r, 25)); // the window the checkouts share
    await prisma.affiliateCode.update({
      where: { id: code.id },
      data: {
        status: 'USED',
        usedAt: new Date(),
        usedBy: `user-${i}`,
        subscriptionId: `sub_${i}`,
      },
    });
    return 'reserved';
  }
  let r = await Promise.all(
    Array.from({ length: CALLERS }, (_, i) => oldAlgorithm(i))
  );
  let s = await state('rOLD');
  console.log(
    `      control (old algorithm): ${tally(r)}; the row now says usedBy=${s.by}`
  );
  check(
    'control: the OLD algorithm reserves one code for several checkouts (this is the defect)',
    r.filter((x) => x === 'reserved').length > 1,
    tally(r)
  );

  // ---- the new service
  await reset('rNEW', 'RESNEW');
  const reserve = (i) =>
    service.reserveAffiliateCode({
      code: 'RESNEW',
      userId: `user-${i}`,
      subscriptionId: `sub_${i}`,
    });
  r = await Promise.all(Array.from({ length: CALLERS }, (_, i) => reserve(i)));
  s = await state('rNEW');
  const winners = r.map((x, i) => ({ x, i })).filter(({ x }) => x.reserved);
  check(
    'new: exactly 1 of 10 concurrent checkouts reserves the code',
    winners.length === 1,
    tally(r.map((x) => (x.reserved ? 'reserved' : x.reason)))
  );
  check(
    'new: every loser is told ALREADY_USED',
    r.filter((x) => !x.reserved).every((x) => x.reason === 'ALREADY_USED'),
    ''
  );
  check(
    'new: the row names the winner, not the last writer',
    winners.length === 1 &&
      s.s === 'USED' &&
      s.by === `user-${winners[0].i}` &&
      s.sub === `sub_${winners[0].i}`,
    JSON.stringify(s)
  );
  const again = await reserve(99);
  check(
    'new: a later (sequential) attempt is ALREADY_USED',
    !again.reserved && again.reason === 'ALREADY_USED',
    JSON.stringify(again)
  );

  await q(`DELETE FROM "AffiliateCode" WHERE id IN ('rOLD','rNEW')`);
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
