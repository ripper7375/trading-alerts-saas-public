// B2 benchmark harness: the PRO session-bars lookup (latest bar of each REQUESTED index) on a scratch PostgreSQL.
// Usage: node bench-b2.cjs <port> <db1,db2,...> <outDir>
// Data comes from B1's generator (docs/handoffs/2026-10-20-b1-explain/gen.sql); everything talks to the scratch server only.
const cp = require('child_process');
const fs = require('fs');
const path = require('path');

const PSQL = 'C:/Program Files/PostgreSQL/18/bin/psql.exe';
const [port, dbList, outDir] = process.argv.slice(2);
const RUNS = 5;
const T = '"currency_gold_indices"';

// The caller's filters: what chart/screener send (8 FX indices), what detail sends (1), and a hostile mix
// (a duplicate, a name with no rows, an index that is in the table but unlisted elsewhere).
const FILTERS = {
  FX8: ['USDX', 'EURX', 'GBPX', 'JPYX', 'AUDX', 'CADX', 'CHFX', 'NZDX'],
  ONE: ['EURX'],
  MIXED: ['EURX', 'EURX', 'NOPE', 'ZZ1X', 'USDX'],
};

const lit = (names) => names.map((n) => `'${n}'`).join(',');
const arr = (names) => `ARRAY[${lit(names)}]::text[]`;

function statements(names) {
  return {
    // What Prisma 7.9.1 sends today for statement (1) of getTodaysSessionBarsForIndices (study probe, checked on this checkout).
    S0: `SELECT "id", "index_name", "session_open_bar_time" FROM ${T} WHERE "index_name" IN (${lit(names)}) ORDER BY "index_name" ASC, "bar_time" DESC OFFSET 0`,
    S1: `SELECT DISTINCT ON ("index_name") "index_name", "session_open_bar_time" FROM ${T} WHERE "index_name" = ANY(${arr(names)}) ORDER BY "index_name" ASC, "bar_time" DESC`,
    S2:
      `SELECT l.* FROM (SELECT DISTINCT n FROM unnest(${arr(names)}) AS u(n)) AS names ` +
      `CROSS JOIN LATERAL (SELECT c."index_name", c."session_open_bar_time" FROM ${T} c WHERE c."index_name" = names.n ` +
      `ORDER BY c."bar_time" DESC LIMIT 1) l ORDER BY l."index_name" ASC`,
    S3:
      `WITH RECURSIVE names AS ((SELECT "index_name" FROM ${T} WHERE "index_name" = ANY(${arr(names)}) ORDER BY "index_name" LIMIT 1) ` +
      `UNION ALL SELECT (SELECT "index_name" FROM ${T} WHERE "index_name" > names."index_name" AND "index_name" = ANY(${arr(names)}) ORDER BY "index_name" LIMIT 1) ` +
      `FROM names WHERE names."index_name" IS NOT NULL) ` +
      `SELECT l.* FROM names CROSS JOIN LATERAL (SELECT c."index_name", c."session_open_bar_time" FROM ${T} c WHERE c."index_name" = names."index_name" ` +
      `ORDER BY c."bar_time" DESC LIMIT 1) l WHERE names."index_name" IS NOT NULL ORDER BY l."index_name" ASC`,
  };
}

// Independent reference: the row at each requested index's max(bar_time), no DISTINCT ON and no LIMIT.
const reference = (names) =>
  `SELECT t."index_name", t."session_open_bar_time" FROM ${T} t JOIN (SELECT "index_name", max("bar_time") AS bt FROM ${T} ` +
  `WHERE "index_name" = ANY(${arr(names)}) GROUP BY "index_name") m ON t."index_name" = m."index_name" AND t."bar_time" = m.bt ORDER BY t."index_name" ASC`;

// "S0 after the application's own de-duplication": the first row of each index_name run in S0's order.
const s0Deduped = (names) =>
  `SELECT "index_name", "session_open_bar_time" FROM (SELECT "index_name", "session_open_bar_time", ` +
  `lag("index_name") OVER (ORDER BY "index_name" ASC, "bar_time" DESC) AS prev FROM ${T} WHERE "index_name" IN (${lit(names)})) x ` +
  `WHERE prev IS DISTINCT FROM "index_name" ORDER BY "index_name" ASC`;

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
  const plan = JSON.parse(psql(db, ['-c', `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`]))[0];
  const root = plan.Plan;
  const hit = root['Shared Hit Blocks'] || 0;
  const read = root['Shared Read Blocks'] || 0;
  return { exec_ms: plan['Execution Time'], plan_ms: plan['Planning Time'], buffers: hit + read, rows: root['Actual Rows'] };
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

fs.mkdirSync(path.join(outDir, 'plans'), { recursive: true });
const results = {};
for (const db of dbList.split(',')) {
  console.log(`\n=== ${db} ===`);
  const meta = psql(db, ['-c', `SELECT count(*), count(DISTINCT "index_name"), pg_relation_size('currency_gold_indices') FROM ${T}`]).trim();
  const [rows, groups, heap] = meta.split('|');
  const pages = Math.round(Number(heap) / 8192);
  console.log(`rows=${rows} groups=${groups} heap_pages=${pages}`);
  const r = (results[db] = { rows: Number(rows), groups: Number(groups), heap_pages: pages, filters: {} });
  for (const [fname, names] of Object.entries(FILTERS)) {
    const ref = digest(db, reference(names));
    const s0d = digest(db, s0Deduped(names));
    const f = (r.filters[fname] = { names, reference: ref, statements: {} });
    for (const [sname, sql] of Object.entries(statements(names))) {
      const equal = sname === 'S0' ? s0d === ref : digest(db, sql) === ref;
      const runs = [];
      for (let i = 0; i < RUNS; i += 1) runs.push(explainJson(db, sql));
      const client = clientRun(db, sql, path.join(outDir, `${db}-${fname}-${sname}.out`));
      fs.writeFileSync(path.join(outDir, 'plans', `${db}-${fname}-${sname}.plan.txt`), psql(db, ['-c', `EXPLAIN (ANALYZE, BUFFERS, SETTINGS) ${sql}`]));
      const buffers = median(runs.map((x) => x.buffers));
      f.statements[sname] = {
        equal_to_reference: equal,
        buffers_median: buffers,
        buffers_pct_of_heap_pages: Number(((buffers / pages) * 100).toFixed(1)),
        exec_ms_median: Number(median(runs.map((x) => x.exec_ms)).toFixed(2)),
        exec_ms_all: runs.map((x) => Number(x.exec_ms.toFixed(2))),
        client_rows: client.lines,
        client_bytes: client.size,
      };
      const s = f.statements[sname];
      console.log(`${fname} ${sname}: equal=${equal} buffers=${s.buffers_median} (${s.buffers_pct_of_heap_pages}%) exec=${s.exec_ms_median}ms rows=${s.client_rows} bytes=${s.client_bytes}`);
    }
  }
}
fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(results, null, 2));
console.log('\nwrote', path.join(outDir, 'results.json'));
