// B1 benchmark harness: S0..S3 on a scratch PostgreSQL, one database per volume.
// Usage: node bench.cjs <port> <db1,db2,...> <outDir>
// Everything here talks to the scratch server only (127.0.0.1:<port>), through psql.
const cp = require('child_process');
const fs = require('fs');
const path = require('path');

const PSQL = 'C:/Program Files/PostgreSQL/18/bin/psql.exe';
const [port, dbList, outDir] = process.argv.slice(2);
const RUNS = 5;
const NAMES = ['XAUX', 'USDX', 'EURX', 'JPYX', 'GBPX', 'AUDX', 'NZDX', 'CADX', 'CHFX'];
const T = '"currency_gold_indices"';
const COLS = ['index_name', 'bar_time', 'value', 'change_pct', 'session_open_bar_time'];
const q = (c) => `"${c}"`;
const cols = COLS.map(q).join(', ');
const colsC = COLS.map((c) => `c.${q(c)}`).join(', ');

const STATEMENTS = {
  // What Prisma 7.9.1 sends today (the study's probe, checked on this checkout), minus OFFSET's bind.
  S0: `SELECT "id", ${cols} FROM ${T} ORDER BY "index_name" ASC, "bar_time" DESC OFFSET 0`,
  S1: `SELECT DISTINCT ON ("index_name") ${cols} FROM ${T} ORDER BY "index_name" ASC, "bar_time" DESC`,
  S2:
    `SELECT l.* FROM unnest(ARRAY[${NAMES.map((n) => `'${n}'`).join(',')}]::text[]) AS n("index_name") ` +
    `CROSS JOIN LATERAL (SELECT ${colsC} FROM ${T} c WHERE c."index_name" = n."index_name" ` +
    `ORDER BY c."bar_time" DESC LIMIT 1) l ORDER BY l."index_name" ASC`,
  S3:
    `WITH RECURSIVE names AS ((SELECT "index_name" FROM ${T} ORDER BY "index_name" LIMIT 1) ` +
    `UNION ALL SELECT (SELECT "index_name" FROM ${T} WHERE "index_name" > names."index_name" ORDER BY "index_name" LIMIT 1) ` +
    `FROM names WHERE names."index_name" IS NOT NULL) ` +
    `SELECT l.* FROM names CROSS JOIN LATERAL (SELECT ${colsC} FROM ${T} c WHERE c."index_name" = names."index_name" ` +
    `ORDER BY c."bar_time" DESC LIMIT 1) l WHERE names."index_name" IS NOT NULL ORDER BY l."index_name" ASC`,
};

// Independent reference (no DISTINCT ON, no LIMIT): the row at each index's max(bar_time).
const REFERENCE =
  `SELECT t.${q('index_name')}, t.${q('bar_time')}, t.${q('value')}, t.${q('change_pct')}, t.${q('session_open_bar_time')} ` +
  `FROM ${T} t JOIN (SELECT "index_name", max("bar_time") AS bt FROM ${T} GROUP BY "index_name") m ` +
  `ON t."index_name" = m."index_name" AND t."bar_time" = m.bt ORDER BY t."index_name" ASC`;

// "S0 after the application's own de-duplication": first row of each index_name run in S0's order.
const S0_DEDUPED =
  `SELECT ${cols} FROM (SELECT ${cols}, lag("index_name") OVER (ORDER BY "index_name" ASC, "bar_time" DESC) AS prev ` +
  `FROM ${T}) x WHERE prev IS DISTINCT FROM "index_name" ORDER BY "index_name" ASC`;

function psql(db, args, input) {
  const r = cp.spawnSync(PSQL, ['-X', '-q', '-At', '-h', '127.0.0.1', '-p', port, '-U', 'postgres', '-d', db, ...args], {
    input,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    windowsHide: true,
  });
  if (r.status !== 0) throw new Error(`psql failed (${db}): ${r.stderr}`);
  return r.stdout;
}

const digest = (db, sql) =>
  psql(db, ['-c', `SELECT md5(coalesce(string_agg(x::text, '|' ORDER BY ord), '')), count(*) FROM (SELECT row_number() OVER () AS ord, * FROM (${sql}) s) x`]).trim();

function explainJson(db, sql) {
  const out = psql(db, ['-c', `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`]);
  const plan = JSON.parse(out)[0];
  const root = plan.Plan;
  const hit = root['Shared Hit Blocks'] || 0;
  const read = root['Shared Read Blocks'] || 0;
  return { exec_ms: plan['Execution Time'], plan_ms: plan['Planning Time'], buffers: hit + read, hit, read, rows: root['Actual Rows'] };
}

const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

function clientRun(db, sql, file) {
  const t0 = process.hrtime.bigint();
  psql(db, ['-o', file, '-c', sql]);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const size = fs.statSync(file).size;
  const buf = fs.readFileSync(file);
  let lines = 0;
  for (let i = 0; i < buf.length; i += 1) if (buf[i] === 10) lines += 1;
  fs.unlinkSync(file);
  return { ms, size, lines };
}

fs.mkdirSync(outDir, { recursive: true });
const results = {};
for (const db of dbList.split(',')) {
  console.log(`\n=== ${db} ===`);
  const meta = psql(db, ['-c', `SELECT count(*), count(DISTINCT "index_name"), pg_relation_size('${T.replace(/"/g, '')}'), pg_indexes_size('${T.replace(/"/g, '')}') FROM ${T}`]).trim();
  const [rows, groups, heap, idx] = meta.split('|');
  const pages = Math.round(Number(heap) / 8192);
  console.log(`rows=${rows} groups=${groups} heap_pages=${pages} index_bytes=${idx}`);
  const ref = digest(db, REFERENCE);
  const s0d = digest(db, S0_DEDUPED);
  console.log(`reference digest ${ref}`);
  const idle = (() => { const t0 = process.hrtime.bigint(); psql(db, ['-c', 'SELECT 1']); return Number(process.hrtime.bigint() - t0) / 1e6; })();
  const r = (results[db] = { rows: Number(rows), groups: Number(groups), heap_pages: pages, index_bytes: Number(idx), reference: ref, idle_ms: idle, statements: {} });
  for (const [name, sql] of Object.entries(STATEMENTS)) {
    const equal = name === 'S0' ? s0d === ref : digest(db, sql) === ref;
    const runs = [];
    for (let i = 0; i < RUNS; i += 1) runs.push(explainJson(db, sql));
    const client = clientRun(db, sql, path.join(outDir, `${db}-${name}.out`));
    const text = psql(db, ['-c', `EXPLAIN (ANALYZE, BUFFERS, SETTINGS) ${sql}`]);
    fs.writeFileSync(path.join(outDir, `${db}-${name}.plan.txt`), text);
    r.statements[name] = {
      equal_to_reference: equal,
      buffers_median: median(runs.map((x) => x.buffers)),
      buffers_pct_of_heap_pages: Number(((median(runs.map((x) => x.buffers)) / pages) * 100).toFixed(1)),
      exec_ms_median: Number(median(runs.map((x) => x.exec_ms)).toFixed(2)),
      exec_ms_all: runs.map((x) => Number(x.exec_ms.toFixed(2))),
      plan_ms_median: Number(median(runs.map((x) => x.plan_ms)).toFixed(2)),
      rows_returned: runs[0].rows,
      client_rows: client.lines,
      client_bytes: client.size,
      client_ms: Number(client.ms.toFixed(1)),
    };
    const s = r.statements[name];
    console.log(`${name}: equal=${equal} buffers=${s.buffers_median} (${s.buffers_pct_of_heap_pages}% of heap pages) exec=${s.exec_ms_median}ms client=${s.client_ms}ms rows=${s.client_rows} bytes=${s.client_bytes}`);
  }
}
fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(results, null, 2));
console.log('\nwrote', path.join(outDir, 'results.json'));
