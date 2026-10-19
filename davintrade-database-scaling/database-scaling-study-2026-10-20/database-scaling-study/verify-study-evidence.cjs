'use strict';
// Validate offline compiler evidence only. No database, network or environment access.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const checks = [];
for (const suffix of ['market', 'gateway']) {
  const report = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, `query-sql-probe-${suffix}.json`),
      'utf8'
    )
  );
  const record = (name) => {
    const entry = report.records.find((item) => item.case === name && item.sql);
    assert.ok(entry, `${suffix}: missing SQL for ${name}`);
    return entry.sql;
  };
  assert.equal(report.marketDataScalarFieldCount, 106);
  for (const name of [
    'currency-latest-distinct-ordered',
    'pro-session-latest-distinct-ordered',
    'indicator-latest-distinct-ordered',
  ]) {
    const sql = record(name);
    assert.ok(/^SELECT /i.test(sql));
    assert.ok(!/\bDISTINCT\b/i.test(sql));
    assert.ok(!/\bLIMIT\b/i.test(sql));
    checks.push({
      client: suffix,
      case: name,
      sqlDistinct: false,
      sqlLimit: false,
    });
  }
  const countSelect = (sql) =>
    sql.slice(7, sql.indexOf(' FROM ')).split(',').length;
  const currentRead = record('channel-current');
  const narrowRead = record('channel-projected');
  assert.equal(countSelect(currentRead), 106);
  assert.equal(countSelect(narrowRead), 5);
  assert.equal(
    currentRead.slice(currentRead.indexOf(' FROM ')),
    narrowRead.slice(narrowRead.indexOf(' FROM '))
  );
  checks.push({
    client: suffix,
    case: 'channel-projection',
    before: 106,
    after: 5,
    filterOrderLimitUnchanged: true,
  });
  const currentWrite = record('gateway-upsert-current');
  const narrowWrite = record('gateway-upsert-projected');
  assert.equal(currentWrite.split(' RETURNING ')[1].split(',').length, 106);
  assert.equal(narrowWrite.split(' RETURNING ')[1].split(',').length, 1);
  assert.equal(
    currentWrite.split(' RETURNING ')[0],
    narrowWrite.split(' RETURNING ')[0]
  );
  checks.push({
    client: suffix,
    case: 'upsert-returning',
    before: 106,
    after: 1,
    sqlBeforeReturningUnchanged: true,
  });
}
const revalidation = JSON.parse(
  fs
    .readFileSync(
      path.join(__dirname, 'source-revalidation-2026-10-20.json'),
      'utf8'
    )
    .replace(/^\uFEFF/, '')
);
assert.equal(revalidation.length, 23);
assert.ok(revalidation.every((item) => item.unchanged));
const result = {
  date: '2026-10-20',
  status: 'passed',
  sourceFilesUnchanged: 23,
  compilerObservationGroups: checks.length,
  checks,
  limitation:
    'SQL compilation only. No live SQL execution, runtime performance, deployed topology or result equivalence is established.',
};
fs.writeFileSync(
  path.join(__dirname, 'verification-summary-2026-10-20.json'),
  JSON.stringify(result, null, 2)
);
console.log(
  JSON.stringify({
    status: result.status,
    sourceFilesUnchanged: 23,
    compilerObservationGroups: checks.length,
  })
);
