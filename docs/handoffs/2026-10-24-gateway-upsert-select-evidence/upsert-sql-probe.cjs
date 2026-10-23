'use strict';
// Installed-driver probe for the gateway live-row upsert (Unit U).
//
//   node upsert-sql-probe.cjs run  <label> <outDir>      compile the shipped upsert, save SQL + parameters
//   node upsert-sql-probe.cjs diff <before.json> <after.json>
//
// It drives the REAL MarketDataProcessor (loaded from src/ through ts-node, transpile-only) with the
// gateway's own generated Prisma client (node_modules/.prisma/client) over a FAKE driver adapter: no
// network, no PostgreSQL. Prisma's installed query compiler prints the SQL; the fake driver records each
// statement and answers a statement that has RETURNING with one synthesised row, so the processor goes
// on to its point-in-time step and that statement is captured as well.
//
// It shows SQL SHAPE and PARAMETERS only: not transfer bytes, not speed, not write cost.
const fs = require('node:fs');
const path = require('node:path');

const GATEWAY = 'D:/SaaS/railway-gateway';
const FIXED_NOW_MS = 1700003600000; // the processor reads Date.now() for the snapshot's first_seen_at

function stringify(value) {
  return JSON.stringify(
    value,
    (key, v) =>
      typeof v === 'bigint'
        ? v.toString()
        : v instanceof Date
          ? v.toISOString()
          : v,
    2
  );
}

function splitReturning(sql) {
  const at = sql.indexOf(' RETURNING ');
  return at < 0
    ? { head: sql, returning: null }
    : {
        head: sql.slice(0, at),
        returning: sql.slice(at + ' RETURNING '.length),
      };
}

function describeStatement(record) {
  if (!record.sql) return record;
  const { head, returning } = splitReturning(record.sql);
  const insert = /^INSERT INTO\s+\S+\s+\(([^)]*)\)/.exec(head);
  const doUpdate = /DO UPDATE SET (.*)$/s.exec(head);
  return {
    ...record,
    insertColumns: insert ? insert[1].split(',').length : null,
    doUpdateAssignments: doUpdate
      ? doUpdate[1].split(/,\s*(?=")/).length
      : null,
    onConflictDoUpdate: /ON CONFLICT\b.*\bDO UPDATE\b/s.test(head),
    onConflictDoNothing: /ON CONFLICT\b.*\bDO NOTHING\b/s.test(head),
    returningColumns: returning === null ? null : returning.split(',').length,
  };
}

async function run(label, outDir) {
  process.env.TS_NODE_PROJECT = path.join(GATEWAY, 'tsconfig.json');
  require(path.join(GATEWAY, 'node_modules/reflect-metadata'));
  require(path.join(GATEWAY, 'node_modules/ts-node')).register({
    transpileOnly: true,
    project: path.join(GATEWAY, 'tsconfig.json'),
  });
  Date.now = () => FIXED_NOW_MS;

  const { PrismaClient, Prisma } = require(
    path.join(GATEWAY, 'node_modules/.prisma/client')
  );
  const { MarketDataProcessor } = require(
    path.join(GATEWAY, 'src/worker/market-data.processor.ts')
  );
  let ColumnTypeEnum;
  try {
    ({ ColumnTypeEnum } = require(
      path.join(GATEWAY, 'node_modules/@prisma/driver-adapter-utils')
    ));
  } catch {
    ColumnTypeEnum = { Int32: 0, Double: 3, Text: 7, DateTime: 10 };
  }

  const model = Prisma.dmmf.datamodel.models.find(
    (m) => m.name === 'MarketDataV6'
  );
  const scalars = model.fields.filter((f) => f.kind !== 'object');
  const byColumn = new Map(scalars.map((f) => [f.name, f]));
  const GENERATED = new Set(['id', 'createdAt', 'updatedAt']);

  // One value for every contract field (103 of the 106 columns; `id`, `createdAt`, `updatedAt` are generated).
  const NOW_SEC = FIXED_NOW_MS / 1000;
  const data = {};
  scalars
    .filter((f) => !GENERATED.has(f.name))
    .forEach((f, i) => {
      if (f.name === 'terminal_id') data[f.name] = 'push_worker_v5';
      else if (f.name === 'symbol') data[f.name] = 'XAUUSD';
      else if (f.name === 'timeframe') data[f.name] = 'M5';
      else if (f.name === 'timestamp')
        data[f.name] = NOW_SEC - 3600; // a bar that closed long ago
      else if (f.name === 'cycle_id') data[f.name] = 7;
      else if (f.name === 'collected_at') data[f.name] = NOW_SEC;
      else if (f.type === 'Int') data[f.name] = i + 1;
      else if (f.type === 'Float') data[f.name] = i + 0.5;
      else if (f.type === 'String') data[f.name] = `s_${f.name}`;
      else throw new Error(`unexpected field type ${f.type} for ${f.name}`);
    });

  const records = [];
  const synthesise = (returning) => {
    const columns = returning
      .split(',')
      .map((c) => c.trim().split('.').pop().replace(/"/g, ''));
    const types = [];
    const row = columns.map((name) => {
      const f = byColumn.get(name);
      if (!f)
        throw new Error(
          `RETURNING names a column the model does not have: ${name}`
        );
      if (f.type === 'Int') return (types.push(ColumnTypeEnum.Int32), 1);
      if (f.type === 'Float') return (types.push(ColumnTypeEnum.Double), 1.5);
      if (f.type === 'DateTime')
        return (
          types.push(ColumnTypeEnum.DateTime),
          '2023-11-14T00:00:00.000+00:00'
        );
      return (types.push(ColumnTypeEnum.Text), `v_${name}`);
    });
    return { columnNames: columns, columnTypes: types, rows: [row] };
  };
  const queryable = {
    provider: 'postgres',
    adapterName: 'upsert-sql-probe-no-network',
    async queryRaw(query) {
      records.push({
        method: 'queryRaw',
        sql: query.sql,
        args: query.args,
        argTypes: query.argTypes,
      });
      const { returning } = splitReturning(query.sql);
      return returning === null
        ? { columnNames: [], columnTypes: [], rows: [] }
        : synthesise(returning);
    },
    async executeRaw(query) {
      records.push({
        method: 'executeRaw',
        sql: query.sql,
        args: query.args,
        argTypes: query.argTypes,
      });
      return 1;
    },
  };
  const adapter = {
    ...queryable,
    async executeScript() {
      throw new Error('scripts refused');
    },
    async startTransaction() {
      records.push({ method: 'startTransaction' });
      return {
        ...queryable,
        options: { usePhantomQuery: false },
        async commit() {
          records.push({ method: 'commit' });
        },
        async rollback() {
          records.push({ method: 'rollback' });
        },
      };
    },
    getConnectionInfo() {
      return { schemaName: 'public', supportsRelationJoins: false };
    },
    async dispose() {},
  };
  const client = new PrismaClient({
    adapter: {
      provider: 'postgres',
      adapterName: adapter.adapterName,
      async connect() {
        return adapter;
      },
    },
  });

  const processor = new MarketDataProcessor(client, {
    handle: async () => {
      throw new Error('a row job must not reach the manifest service');
    },
  });
  const result = await processor.process({
    name: 'process',
    id: 'probe-1',
    data,
  });
  await client.$disconnect();

  const report = {
    label,
    prismaVersion: Prisma.prismaVersion,
    clientDir: path
      .join(GATEWAY, 'node_modules/.prisma/client')
      .replace(/\\/g, '/'),
    marketDataScalarFieldCount: scalars.length,
    payloadFieldCount: Object.keys(data).length,
    fixedNowMs: FIXED_NOW_MS,
    jobResult: result,
    records: records.map(describeStatement),
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, `upsert-sql-${label}.json`),
    stringify(report) + '\n'
  );
  const text = report.records
    .map((r, i) =>
      r.sql
        ? `-- statement ${i + 1}: ${r.method}\n${r.sql}\n-- parameters (${r.args.length}):\n${stringify(r.args)}\n`
        : `-- statement ${i + 1}: ${r.method}\n`
    )
    .join('\n');
  fs.writeFileSync(path.join(outDir, `upsert-sql-${label}.sql.txt`), text);

  for (const r of report.records) {
    console.log(
      JSON.stringify({
        method: r.method,
        insertColumns: r.insertColumns,
        doUpdateAssignments: r.doUpdateAssignments,
        onConflictDoUpdate: r.onConflictDoUpdate,
        onConflictDoNothing: r.onConflictDoNothing,
        returningColumns: r.returningColumns,
        params: r.args ? r.args.length : undefined,
        sqlHead: r.sql ? r.sql.slice(0, 90) : undefined,
      })
    );
  }
  console.log(
    JSON.stringify({
      prismaVersion: report.prismaVersion,
      scalarFields: report.marketDataScalarFieldCount,
      payloadFields: report.payloadFieldCount,
      jobResult: result,
    })
  );
}

// Which column each bound parameter ($n) feeds: the INSERT's VALUES list (positional) and the
// DO UPDATE SET assignments ("col" = $n).
function paramColumns(sql) {
  const map = new Map();
  const insert = /^INSERT INTO\s+\S+\s+\(([^)]*)\)\s+VALUES\s+\(([^)]*)\)/.exec(
    sql
  );
  if (insert) {
    const columns = insert[1].split(',').map((c) => c.trim().replace(/"/g, ''));
    insert[2].split(',').forEach((placeholder, i) => {
      const n = /^\$(\d+)$/.exec(placeholder.trim());
      if (n) map.set(Number(n[1]), columns[i]);
    });
  }
  for (const m of sql.matchAll(/"([^"]+)" = \$(\d+)/g))
    map.set(Number(m[2]), m[1]);
  return map;
}

// The only columns whose value is made fresh on every run: a cuid, and two timestamps taken from the clock.
const GENERATED_PER_RUN = new Set(['id', 'createdAt', 'updatedAt']);

function diff(beforeFile, afterFile, strict) {
  const before = JSON.parse(fs.readFileSync(beforeFile, 'utf8'));
  const after = JSON.parse(fs.readFileSync(afterFile, 'utf8'));
  const problems = [];
  const changed = [];
  const generatedDiffs = [];
  if (before.records.length !== after.records.length) {
    problems.push(
      `statement count differs: ${before.records.length} -> ${after.records.length}`
    );
  }
  const n = Math.min(before.records.length, after.records.length);
  for (let i = 0; i < n; i++) {
    const b = before.records[i];
    const a = after.records[i];
    if (b.method !== a.method)
      problems.push(`#${i + 1}: method ${b.method} -> ${a.method}`);
    if (b.sql === undefined && a.sql === undefined) continue;
    if (b.sql === undefined || a.sql === undefined) {
      problems.push(
        `#${i + 1}: statement kind differs (${b.method} -> ${a.method})`
      );
      continue;
    }
    if (JSON.stringify(b.argTypes) !== JSON.stringify(a.argTypes))
      problems.push(`#${i + 1}: parameter types differ`);
    const sb = splitReturning(b.sql);
    const sa = splitReturning(a.sql);
    if (sb.head !== sa.head)
      problems.push(`#${i + 1}: SQL before RETURNING differs`);
    if (b.args.length !== a.args.length)
      problems.push(
        `#${i + 1}: parameter count ${b.args.length} -> ${a.args.length}`
      );
    const columns = paramColumns(sb.head);
    for (let p = 0; p < Math.min(b.args.length, a.args.length); p++) {
      if (JSON.stringify(b.args[p]) === JSON.stringify(a.args[p])) continue;
      const column = columns.get(p + 1);
      if (column && GENERATED_PER_RUN.has(column)) {
        generatedDiffs.push({
          statement: i + 1,
          param: `$${p + 1}`,
          column,
          before: b.args[p],
          after: a.args[p],
        });
      } else {
        problems.push(
          `#${i + 1}: parameter $${p + 1} (${column || 'unmapped'}) differs: ${JSON.stringify(b.args[p])} -> ${JSON.stringify(a.args[p])}`
        );
      }
    }
    if (sb.returning !== sa.returning) {
      changed.push({
        statement: i + 1,
        returningColumnsBefore:
          sb.returning === null ? null : sb.returning.split(',').length,
        returningColumnsAfter:
          sa.returning === null ? null : sa.returning.split(',').length,
        returningAfter: sa.returning,
      });
    }
  }
  // strict: the second file must carry the SAME RETURNING lists as the first (used to judge a mutant
  // against the accepted output, where a changed RETURNING list is a defect, not the intended change)
  if (strict && changed.length) {
    problems.push(
      `RETURNING list differs from the accepted output in statement(s) ${changed.map((c) => c.statement).join(', ')}`
    );
  }
  console.log(
    JSON.stringify({
      statementsBefore: before.records.length,
      statementsAfter: after.records.length,
    })
  );
  console.log(
    JSON.stringify({ statementsWhoseReturningListChanged: changed }, null, 2)
  );
  console.log(
    JSON.stringify(
      {
        parametersThatDifferAndAreGeneratedPerRun: generatedDiffs,
        parametersCompared: before.records.reduce(
          (s, r) => s + (r.args ? r.args.length : 0),
          0
        ),
      },
      null,
      2
    )
  );
  console.log(
    problems.length
      ? `DIFF PROBLEMS:\n- ${problems.join('\n- ')}`
      : 'DIFF OK: only the RETURNING list of the upsert differs'
  );
  process.exitCode = problems.length ? 1 : 0;
}

const [, , mode, a, b] = process.argv;
if (mode === 'run') {
  run(a, b).catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
} else if (mode === 'diff') {
  diff(a, b, process.argv[5] === '--strict');
} else {
  console.error(
    'usage: run <label> <outDir> | diff <before.json> <after.json> [--strict]'
  );
  process.exitCode = 2;
}
