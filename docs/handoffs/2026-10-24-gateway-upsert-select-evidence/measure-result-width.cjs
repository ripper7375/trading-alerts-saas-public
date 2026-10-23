'use strict';
// Result width of the live-row upsert on a real PostgreSQL: the exact compiled statement and parameters
// from the installed-driver probe are executed through `pg`, and the returned row is measured in the
// text format PostgreSQL sends. Width only: no timing is taken and no speed is claimed.
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('D:/SaaS/railway-gateway/node_modules/pg');

const dir = process.argv[2];
const url = process.argv[3];
const load = (label) =>
  JSON.parse(
    fs.readFileSync(path.join(dir, `upsert-sql-${label}.json`), 'utf8')
  ).records[0];
const raw = { getTypeParser: () => (value) => value }; // keep PostgreSQL's own text

async function width(client, label, record) {
  const res = await client.query({
    text: record.sql,
    values: record.args,
    rowMode: 'array',
    types: raw,
  });
  const row = res.rows[0];
  const dataBytes = row.reduce(
    (sum, v) => sum + (v === null ? 0 : Buffer.byteLength(String(v))),
    0
  );
  // DataRow message: 'D' + int32 length + int16 field count + (int32 length + bytes) per field
  const dataRowMessageBytes = 1 + 4 + 2 + row.length * 4 + dataBytes;
  return {
    statement: label,
    rowCount: res.rowCount,
    fields: res.fields.length,
    dataBytes,
    dataRowMessageBytes,
    firstFields: res.fields.slice(0, 3).map((f) => f.name),
  };
}

(async () => {
  const client = new Client({ connectionString: url });
  await client.connect();
  const out = [];
  // first execution inserts, second takes the ON CONFLICT ... DO UPDATE path: both are measured
  for (const pass of ['insert path', 'conflict-update path']) {
    out.push({
      pass,
      ...(await width(client, 'before (full row)', load('before'))),
    });
    out.push({
      pass,
      ...(await width(client, 'after (select id)', load('after'))),
    });
  }
  const server = (await client.query('select version()')).rows[0].version;
  await client.end();
  console.log(JSON.stringify({ server, measurements: out }, null, 2));
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
