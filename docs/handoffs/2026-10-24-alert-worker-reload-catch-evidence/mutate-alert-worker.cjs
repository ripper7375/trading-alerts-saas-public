// Mutation check for operation-service/src/alert-engine/alert-worker.service.ts (adhoc-alert-worker-reload-catch).
// Each mutant is applied to the TypeScript source (run against the unit spec) AND to the compiled dist file (run against the
// process probe), then both files are restored byte for byte (sha-256 verified). Children are started with windowsHide.
'use strict';
const fs = require('fs');
const cp = require('child_process');
const crypto = require('crypto');
const path = require('path');

const ROOT = 'D:/SaaS/operation-service';
const TS = ROOT + '/src/alert-engine/alert-worker.service.ts';
const JS = ROOT + '/dist/alert-engine/alert-worker.service.js';
const PROBE = path.join(__dirname, 'probe-alert-worker-reload.cjs');
const SCRATCH = process.env.MUTATION_SCRATCH || __dirname;
const OUT = process.env.MUTATION_OUT || path.join(SCRATCH, 'mutation-results.json');
const JEST = ROOT + '/node_modules/jest/bin/jest.js';

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const origTs = fs.readFileSync(TS);
const origJs = fs.readFileSync(JS);
const shaTs = sha(origTs);
const shaJs = sha(origJs);
const textTs = origTs.toString('utf8');
const textJs = origJs.toString('utf8');
if (!textTs.includes("watch reload failed:") || !textJs.includes("watch reload failed:")) throw new Error('the fix is not in the source and in dist: refusing to start');

function writeRetry(file, buf) {
  for (let i = 0; i < 10; i++) {
    try { fs.writeFileSync(file, buf); return; } catch (e) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300); }
  }
  throw new Error('could not write ' + file);
}

const STMT_TS = /this\.reload\(\)\.catch\(\(error\) =>\s*this\.logger\.error\('watch reload failed:', error\)\s*\);/;
const STMT_JS = /this\.reload\(\)\.catch\(\(error\) => this\.logger\.error\('watch reload failed:', error\)\);/;
const stmt = (id, what, replacement) => ({ id, what, ts: STMT_TS, js: STMT_JS, to: () => replacement });
const mutants = [
  stmt('W1', 'back to void this.reload()', 'void this.reload();'),
  stmt('W2', 'silent catch', 'this.reload().catch(() => undefined);'),
  stmt('W3', 'log with warn instead of error', "this.reload().catch((error) => this.logger.warn('watch reload failed:', error));"),
  stmt('W4', 'log and rethrow', "this.reload().catch((error) => { this.logger.error('watch reload failed:', error); throw error; });"),
  stmt('W5-cache', 'catch clears the watch cache', "this.reload().catch((error) => { this.cache = new Map(); this.logger.error('watch reload failed:', error); });"),
  { id: 'W6', what: 'channel guard flipped (!==)', ts: /channel === 'alerts:changed'/, js: /channel === 'alerts:changed'/, to: () => "channel !== 'alerts:changed'" },
  { id: 'W7', what: 'log message text changed', ts: /'watch reload failed:'/, js: /'watch reload failed:'/, to: () => "'reload failed'" },
];
const only = (process.env.MUTANTS || '').split(',').filter(Boolean);

function runUnit() {
  const json = path.join(SCRATCH, 'mut-alert-worker-unit.json');
  try { fs.unlinkSync(json); } catch (e) { /* none */ }
  const r = cp.spawnSync(process.execPath, [JEST, 'src/alert-engine/alert-worker.service.spec.ts', '--runInBand', '--forceExit', '--json', `--outputFile=${json}`], {
    cwd: ROOT, windowsHide: true, timeout: 240000, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  const failed = [];
  let passed = 0;
  let parsed = false;
  let suiteError = null;
  try {
    const j = JSON.parse(fs.readFileSync(json, 'utf8'));
    parsed = true;
    for (const t of j.testResults) {
      if (t.status === 'failed' && t.assertionResults.every((a) => a.status !== 'failed')) suiteError = (t.message || '').slice(0, 200);
      for (const a of t.assertionResults) (a.status === 'failed' ? failed.push(a.title) : a.status === 'passed' && passed++);
    }
  } catch (e) { /* no json */ }
  return { parsed, failed, passed, suiteError, timedOut: !!r.error && r.error.code === 'ETIMEDOUT' };
}

function runProbe() {
  const r = cp.spawnSync(process.execPath, [PROBE, JS], { windowsHide: true, timeout: 90000, encoding: 'utf8' });
  let summary = null;
  try { summary = JSON.parse(r.stdout); } catch (e) { /* not json */ }
  return {
    exit: r.status,
    timedOut: !!r.error && r.error.code === 'ETIMEDOUT',
    child_exit: summary && summary.exitCode,
    lived: summary && summary.lived_to_the_end,
    mismatch: summary && summary.stdout.find((l) => l.startsWith('PROBE-MISMATCH')) || null,
  };
}

function mutate(text, m, which) {
  const re = m[which];
  const hits = text.match(new RegExp(re.source, 'g')) || [];
  if (hits.length !== 1) throw new Error(`${m.id}: ${which} pattern matched ${hits.length} times`);
  const out = text.replace(re, m.to());
  if (out === text) throw new Error(`${m.id}: no change in ${which}`);
  return out;
}

const results = [];
try {
  for (const m of mutants) {
    if (only.length && !only.includes(m.id)) continue;
    writeRetry(TS, Buffer.from(mutate(textTs, m, 'ts'), 'utf8'));
    writeRetry(JS, Buffer.from(mutate(textJs, m, 'js'), 'utf8'));
    const started = Date.now();
    const unit = runUnit();
    const probe = runProbe();
    writeRetry(TS, origTs);
    writeRetry(JS, origJs);
    if (sha(fs.readFileSync(TS)) !== shaTs || sha(fs.readFileSync(JS)) !== shaJs) throw new Error(`${m.id}: restore did not match`);
    const unitKilled = unit.failed.length > 0;
    const probeKilled = probe.exit !== 0 && !probe.timedOut;
    const row = {
      id: m.id, what: m.what,
      unit: { result: unitKilled ? 'killed' : unit.parsed && !unit.suiteError ? 'SURVIVED' : 'inconclusive', failed: unit.failed, passed: unit.passed },
      probe: { result: probeKilled ? 'killed' : probe.timedOut ? 'inconclusive' : 'SURVIVED', exit: probe.exit, child_exit: probe.child_exit, lived: probe.lived, mismatch: probe.mismatch },
      seconds: Math.round((Date.now() - started) / 1000),
    };
    results.push(row);
    fs.writeFileSync(OUT, JSON.stringify({ sha256_ts: shaTs, sha256_dist: shaJs, results }, null, 2));
    console.log(JSON.stringify(row));
  }
} finally {
  writeRetry(TS, origTs);
  writeRetry(JS, origJs);
  const okTs = sha(fs.readFileSync(TS)) === shaTs;
  const okJs = sha(fs.readFileSync(JS)) === shaJs;
  console.log('restored sha256 matches original: ts', okTs, 'dist', okJs);
  fs.writeFileSync(OUT, JSON.stringify({ sha256_ts: shaTs, sha256_dist: shaJs, restored_matches: okTs && okJs, results }, null, 2));
}
