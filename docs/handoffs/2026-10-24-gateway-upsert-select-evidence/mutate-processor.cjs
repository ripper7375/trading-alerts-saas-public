'use strict';
// Mutation check for Unit U. One mutant at a time on market-data.processor.ts, three detectors each:
//   unit  = test/market-data.processor.spec.ts            (a mock)
//   gated = test/market-data.processor.pg.spec.ts         (the scratch PostgreSQL)
//   sql   = the installed-driver probe, diffed against the accepted "after" output
// The source is restored from a backup after every mutant (sha-256 checked); no child shows a window.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const [, , expectedSha, scratchpad] = process.argv;
const GATEWAY = 'D:/SaaS/railway-gateway';
const TARGET = path.join(GATEWAY, 'src/worker/market-data.processor.ts');
const BACKUP = path.join(scratchpad, 'backup/market-data.processor.ts');
const JEST = path.join(GATEWAY, 'node_modules/jest/bin/jest.js');
const PROBE = path.join(scratchpad, 'upsert-sql-probe.cjs');
const ACCEPTED = path.join(scratchpad, 'probe-out/upsert-sql-after.json');
const OUT = path.join(scratchpad, 'mutants');
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const original = fs.readFileSync(BACKUP);
if (
  sha(original) !== expectedSha ||
  sha(fs.readFileSync(TARGET)) !== expectedSha
) {
  console.error(
    'refusing to start: the source or its backup differs from the expected sha-256'
  );
  process.exit(2);
}
fs.mkdirSync(OUT, { recursive: true });

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
function restore() {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      fs.writeFileSync(TARGET, original);
      if (sha(fs.readFileSync(TARGET)) === expectedSha) return true;
    } catch {
      /* Windows may refuse a write to a file open elsewhere: retry */
    }
    sleep(300);
  }
  return false;
}
process.on('exit', () => {
  if (sha(fs.readFileSync(TARGET)) !== expectedSha) restore();
});

const one = (re, replacement) => (text) => {
  const hits =
    text.match(
      new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
    ) || [];
  if (hits.length !== 1)
    throw new Error(`pattern ${re} matched ${hits.length} times, expected 1`);
  return text.replace(re, replacement);
};
const eol = (text) => (text.includes('\r\n') ? '\r\n' : '\n');

const MUTANTS = [
  {
    id: 'U1',
    what: 'remove `select` from the upsert',
    apply: one(/^[ \t]*select: \{ id: true \},\r?\n/m, ''),
  },
  {
    id: 'U2',
    what: 'select: { symbol: true } instead of { id: true }',
    apply: one(/select: \{ id: true \},/, 'select: { symbol: true },'),
  },
  {
    id: 'U3',
    what: 'drop `update: data` (an empty update, so the mutant still compiles)',
    apply: one(/update: data,/, 'update: {},'),
  },
  {
    id: 'U4',
    what: 'drop cycle_id from the update payload',
    apply: one(/update: data,/, 'update: { ...data, cycle_id: undefined },'),
  },
  {
    id: 'U5',
    what: 'swap the order: point-in-time snapshot before the live upsert',
    apply: (text) => {
      const e = eol(text);
      const removed = one(
        /^[ \t]*await this\.writePointInTimeSnapshot\(data\);\r?\n(\r?\n)?/m,
        ''
      )(text);
      return one(
        /^([ \t]*)await this\.prisma\.marketDataV6\.upsert\(\{/m,
        `$1await this.writePointInTimeSnapshot(data);${e}$1await this.prisma.marketDataV6.upsert({`
      )(removed);
    },
  },
  {
    id: 'U6',
    what: 'drop the `await` on the upsert',
    apply: one(
      /await this\.prisma\.marketDataV6\.upsert\(\{/,
      'this.prisma.marketDataV6.upsert({'
    ),
  },
  {
    id: 'U7',
    what: 'swallow an upsert failure (catch and ignore)',
    apply: one(
      /await this\.prisma\.marketDataV6\.upsert\(\{([\s\S]*?)\}\);/,
      'await this.prisma.marketDataV6.upsert({$1}).catch(() => undefined);'
    ),
  },
];

const clean = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
function classify(res) {
  if (res.error && res.error.code === 'ETIMEDOUT') return 'TIMEOUT (neither)';
  const out = clean(`${res.stdout}\n${res.stderr}`);
  const summary = (/^Tests:.*$/m.exec(out) || [''])[0];
  if (/\b\d+ failed\b/.test(summary)) return `KILLED (${summary.trim()})`;
  if (/Test suite failed to run/.test(out))
    return 'KILLED WEAKLY (suite failed to run)';
  if (/\b\d+ passed\b/.test(summary) && res.status === 0)
    return `SURVIVED (${summary.trim()})`;
  if (/\b\d+ skipped\b/.test(summary) && !/\bpassed\b/.test(summary))
    return `GATE OFF (${summary.trim()})`;
  return `UNCLASSIFIED exit=${res.status} ${summary.trim()}`;
}
function jest(spec, extraEnv) {
  return spawnSync(process.execPath, [JEST, spec, '--runInBand', '--silent'], {
    cwd: GATEWAY,
    env: { ...process.env, ...extraEnv },
    windowsHide: true,
    encoding: 'utf8',
    timeout: 150000,
    maxBuffer: 64 * 1024 * 1024,
  });
}
function probeRun(id) {
  const run = spawnSync(process.execPath, [PROBE, 'run', id, OUT], {
    cwd: scratchpad,
    windowsHide: true,
    encoding: 'utf8',
    timeout: 90000,
  });
  if (run.status !== 0)
    return `KILLED WEAKLY (probe could not run: ${
      clean(run.stderr)
        .split('\n')
        .find((l) => l.trim()) || 'error'
    })`;
  const diff = spawnSync(
    process.execPath,
    [
      PROBE,
      'diff',
      ACCEPTED,
      path.join(OUT, `upsert-sql-${id}.json`),
      '--strict',
    ],
    { cwd: scratchpad, windowsHide: true, encoding: 'utf8', timeout: 60000 }
  );
  if (diff.status !== 0 && !clean(diff.stdout).includes('DIFF PROBLEMS:'))
    return `KILLED WEAKLY (the diff itself failed: ${
      clean(diff.stderr)
        .split('\n')
        .find((l) => l.includes('Error')) || 'error'
    })`;
  const problems = clean(diff.stdout).split('DIFF PROBLEMS:')[1];
  return diff.status === 0
    ? 'SURVIVED (SQL equal to the accepted output)'
    : `KILLED (${(problems || '').trim().split('\n').slice(0, 2).join(' ').slice(0, 160)})`;
}

const GATED_ENV = {
  CYCLE_PG_URL: 'postgres://postgres@127.0.0.1:55471/gw_unit_u',
  CYCLE_PG_ALLOW_WIPE: 'yes',
};
const results = [];
try {
  for (const mutant of MUTANTS) {
    let mutated;
    try {
      mutated = mutant.apply(original.toString('utf8'));
    } catch (e) {
      results.push({
        id: mutant.id,
        what: mutant.what,
        error: String(e.message),
      });
      console.log(`${mutant.id} NOT APPLIED: ${e.message}`);
      continue;
    }
    if (mutated === original.toString('utf8')) {
      results.push({
        id: mutant.id,
        what: mutant.what,
        error: 'mutation changed nothing',
      });
      continue;
    }
    fs.writeFileSync(TARGET, mutated);
    const before = original.toString('utf8').split(/\r?\n/);
    const after = mutated.split(/\r?\n/);
    const removed = before
      .filter((l) => !after.includes(l))
      .map((l) => l.trim());
    const added = after.filter((l) => !before.includes(l)).map((l) => l.trim());
    const row = {
      id: mutant.id,
      what: mutant.what,
      landed: { removed, added },
      unit: classify(jest('test/market-data.processor.spec.ts', {})),
      gated: classify(jest('test/market-data.processor.pg.spec.ts', GATED_ENV)),
      sql: probeRun(mutant.id),
    };
    const restored = restore();
    row.restoredByteIdentical = restored;
    results.push(row);
    console.log(JSON.stringify(row));
    if (!restored)
      throw new Error(`could not restore the source after ${mutant.id}`);
  }
} finally {
  const ok = restore();
  fs.writeFileSync(
    path.join(scratchpad, 'mutation-results.json'),
    JSON.stringify(
      {
        finalSourceSha256: sha(fs.readFileSync(TARGET)),
        restoredAtEnd: ok,
        expectedSha,
        results,
      },
      null,
      2
    )
  );
  console.log(
    `FINAL source sha-256 ${sha(fs.readFileSync(TARGET))} ${sha(fs.readFileSync(TARGET)) === expectedSha ? '(byte-identical to the accepted source)' : '(DIFFERENT!)'}`
  );
}
