// Mutation check for operation-service/src/prisma/prisma.service.ts (Unit P-operation).
// Applies one mutant at a time, runs the unit spec and the gated pool fixture against it, records which tests fail,
// restores the file byte for byte (sha-256 verified) after every mutant. Children are started with windowsHide.
'use strict';
const fs = require('fs');
const cp = require('child_process');
const crypto = require('crypto');
const path = require('path');

const ROOT = 'D:/SaaS/operation-service';
const FILE = ROOT + '/src/prisma/prisma.service.ts';
const SCRATCH = path.resolve(__dirname);
const BACKUP = path.join(SCRATCH, 'prisma.service.ts.orig');
const OUT = process.env.MUTATION_OUT || path.join(SCRATCH, 'mutation-results.json');
const JEST = ROOT + '/node_modules/jest/bin/jest.js';
const FIXTURE_URL = process.env.OPS_POOL_PG_URL;

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const ORIG = fs.readFileSync(FILE);
const ORIG_SHA = sha(ORIG);
if (!fs.existsSync(BACKUP)) fs.writeFileSync(BACKUP, ORIG);
if (sha(fs.readFileSync(BACKUP)) !== ORIG_SHA) throw new Error('backup differs from the source: refusing to start');
const text = ORIG.toString('utf8');
if (!/connectionTimeoutMillis: 2_000,/.test(text)) throw new Error('the fix is not in the source: refusing to start');

function writeRetry(buf) {
  for (let i = 0; i < 10; i++) {
    try {
      fs.writeFileSync(FILE, buf);
      return;
    } catch (e) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);
    }
  }
  throw new Error('could not write ' + FILE);
}

const FIELD = /( *)connectionTimeoutMillis: 2_000,(\r?\n)/;
const SSL = /( *)ssl: \{ rejectUnauthorized: false \},(\r?\n)/;
const mutants = [
  { id: 'M1', what: 'remove connectionTimeoutMillis', re: FIELD, to: () => '' },
  { id: 'M2', what: 'connectionTimeoutMillis 20_000', re: FIELD, to: (m, i, nl) => `${i}connectionTimeoutMillis: 20_000,${nl}` },
  { id: 'M3', what: 'connectionTimeoutMillis 1', re: FIELD, to: (m, i, nl) => `${i}connectionTimeoutMillis: 1,${nl}` },
  { id: 'M4', what: 'add max: 2', re: FIELD, to: (m, i, nl) => `${m}${i}max: 2,${nl}` },
  { id: 'M5', what: 'drop ssl', re: SSL, to: () => '' },
  { id: 'M6', what: 'connectionTimeoutMillis 500', re: FIELD, to: (m, i, nl) => `${i}connectionTimeoutMillis: 500,${nl}` },
  { id: 'M7', what: 'add idleTimeoutMillis: 60_000', re: FIELD, to: (m, i, nl) => `${m}${i}idleTimeoutMillis: 60_000,${nl}` },
];
const only = (process.env.MUTANTS || '').split(',').filter(Boolean);

function runJest(spec, env, timeoutMs) {
  const json = path.join(SCRATCH, `mut-${path.basename(spec)}.json`);
  try { fs.unlinkSync(json); } catch (e) { /* none */ }
  const r = cp.spawnSync(process.execPath, [JEST, spec, '--runInBand', '--forceExit', '--json', `--outputFile=${json}`], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    windowsHide: true,
    timeout: timeoutMs,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  let failed = [];
  let passed = 0;
  let parsed = false;
  let suiteError = null;
  try {
    const j = JSON.parse(fs.readFileSync(json, 'utf8'));
    parsed = true;
    for (const t of j.testResults) {
      if (t.status === 'failed' && t.assertionResults.every((a) => a.status !== 'failed')) suiteError = (t.message || '').slice(0, 300);
      for (const a of t.assertionResults) {
        if (a.status === 'failed') failed.push(a.title);
        else if (a.status === 'passed') passed++;
      }
    }
  } catch (e) { /* no json: timeout or crash */ }
  return { exit: r.status, timedOut: !!r.error && r.error.code === 'ETIMEDOUT', parsed, failed, passed, suiteError };
}

const results = [];
try {
  for (const m of mutants) {
    if (only.length && !only.includes(m.id)) continue;
    const hits = text.match(new RegExp(m.re.source, 'g')) || [];
    if (hits.length !== 1) throw new Error(`${m.id}: pattern matched ${hits.length} times`);
    const mutated = text.replace(m.re, (match, indent, nl) => m.to(match, indent, nl));
    if (mutated === text) throw new Error(`${m.id}: no change`);
    writeRetry(Buffer.from(mutated, 'utf8'));
    const started = Date.now();
    const unit = runJest('src/prisma/prisma.pool.spec.ts', {}, 180000);
    const fixture = FIXTURE_URL
      ? runJest('src/prisma/prisma.pool.pg.spec.ts', { OPS_POOL_PG_URL: FIXTURE_URL, OPS_POOL_PG_ALLOW_WIPE: 'yes' }, 420000)
      : null;
    writeRetry(ORIG);
    if (sha(fs.readFileSync(FILE)) !== ORIG_SHA) throw new Error(`${m.id}: restore did not match`);
    const kill = (r) => (r ? (r.failed.length > 0 ? 'killed' : r.parsed && !r.suiteError ? 'SURVIVED' : 'inconclusive') : 'n/a');
    const row = { id: m.id, what: m.what, unit: { result: kill(unit), failed: unit.failed }, fixture: fixture && { result: kill(fixture), failed: fixture.failed, passed: fixture.passed, timedOut: fixture.timedOut, suiteError: fixture.suiteError }, seconds: Math.round((Date.now() - started) / 1000) };
    results.push(row);
    fs.writeFileSync(OUT, JSON.stringify({ original_sha256: ORIG_SHA, results }, null, 2));
    console.log(JSON.stringify(row));
  }
} finally {
  writeRetry(ORIG);
  const final = sha(fs.readFileSync(FILE));
  console.log('restored sha256 matches original:', final === ORIG_SHA, final);
  fs.writeFileSync(OUT, JSON.stringify({ original_sha256: ORIG_SHA, restored_matches: final === ORIG_SHA, results }, null, 2));
}
