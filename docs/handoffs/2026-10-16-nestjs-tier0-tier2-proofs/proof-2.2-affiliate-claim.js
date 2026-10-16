// Proof script from docs/handoffs/2026-10-16-nestjs-tier0-tier2-execution.md.
// Runs the COMPILED money-service (`npm run build` first) against a SCRATCH PostgreSQL
// (see README.md). It writes and deletes rows: never point it at a real database.
// Real-database proof for Remediation Tier 2 §6.2 (scratch PostgreSQL only).
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

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();
  const q = (sql, ...p) => prisma.$queryRawUnsafe(sql, ...p);
  const service = new ConversionProcessorService(prisma, {
    getBasePriceUsd: async () => 29,
  });

  async function reset(codeId, code) {
    await q(`DELETE FROM "Commission" WHERE "affiliateCodeId"='${codeId}'`);
    await q(`DELETE FROM "AffiliateCode" WHERE id='${codeId}'`);
    await q(`INSERT INTO "AffiliateCode"(id,code,"affiliateProfileId","discountPercent","commissionPercent","expiresAt","updatedAt")
             VALUES ('${codeId}','${code}','p1',10,30,(now() at time zone 'utc')+interval '1 day',now())`);
    await q(
      `UPDATE "AffiliateProfile" SET "totalEarnings"=100, "pendingCommissions"=100, "totalCodesUsed"=5, status='ACTIVE' WHERE id='p1'`
    );
  }
  const state = async (codeId) => ({
    rows: (
      await q(
        `SELECT count(*)::int AS n FROM "Commission" WHERE "affiliateCodeId"='${codeId}'`
      )
    )[0].n,
    p: (
      await q(
        `SELECT "totalEarnings"::float AS e, "totalCodesUsed" AS c FROM "AffiliateProfile" WHERE id='p1'`
      )
    )[0],
  });

  // ---- control: the OLD algorithm (read, check USED outside, unconditional update inside the transaction)
  await reset('cOLD', 'OLDCODE');
  async function oldAlgorithm() {
    const code = await prisma.affiliateCode.findUnique({
      where: { code: 'OLDCODE' },
    });
    if (code.status === 'USED') return 'ALREADY_USED';
    await new Promise((r) => setTimeout(r, 25)); // the window the two deliveries share
    await prisma.$transaction(async (tx) => {
      await tx.affiliateCode.update({
        where: { id: code.id },
        data: { status: 'USED', usedBy: 'u1' },
      });
      await tx.commission.create({
        data: {
          affiliateProfileId: 'p1',
          affiliateCodeId: code.id,
          userId: 'u1',
          grossRevenue: 100,
          discountAmount: 10,
          netRevenue: 90,
          commissionAmount: 27,
          status: 'PENDING',
        },
      });
      await tx.affiliateProfile.update({
        where: { id: 'p1' },
        data: {
          totalCodesUsed: { increment: 1 },
          totalEarnings: { increment: 27 },
          pendingCommissions: { increment: 27 },
        },
      });
    });
    return 'paid';
  }
  let r = await Promise.all(Array.from({ length: 10 }, oldAlgorithm));
  let s = await state('cOLD');
  console.log(
    `      control (old algorithm): ${tally(r)}; commission rows=${s.rows}; earnings 100 -> ${s.p.e}`
  );
  check(
    'control: the OLD algorithm double-pays under concurrency (this is the defect)',
    s.rows > 1,
    `rows=${s.rows}`
  );

  // ---- the new service
  await reset('cNEW', 'NEWCODE');
  const convert = () =>
    service.processAffiliateConversion({
      code: 'NEWCODE',
      userId: 'u1',
      subscriptionId: null,
      grossRevenueUsd: 100,
      provider: 'DLOCAL',
    });
  r = await Promise.all(Array.from({ length: 10 }, convert));
  s = await state('cNEW');
  check(
    'new: exactly 1 of 10 concurrent deliveries pays',
    r.filter((x) => x.processed).length === 1,
    tally(r.map((x) => (x.processed ? 'paid' : x.reason)))
  );
  check('new: exactly 1 Commission row', s.rows === 1, `rows=${s.rows}`);
  check(
    'new: the affiliate is credited once (100 -> 127, codesUsed 5 -> 6)',
    Math.abs(s.p.e - 127) < 1e-9 && s.p.c === 6,
    JSON.stringify(s.p)
  );
  const code = (
    await q(`SELECT status::text AS s FROM "AffiliateCode" WHERE id='cNEW'`)
  )[0].s;
  check('new: the code ends USED', code === 'USED', code);
  const again = await convert();
  check(
    'new: a later (sequential) retry is ALREADY_USED',
    !again.processed && again.reason === 'ALREADY_USED',
    JSON.stringify(again)
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
