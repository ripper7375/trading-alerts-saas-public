#!/usr/bin/env node
/**
 * Copies the Python sensor engine's runtime files into the gateway package (build step 3).
 *
 *   npm run sync:sensor-kit     copy the files into railway-gateway/sensors/
 *   npm run check:sensor-kit    verify the copy, change nothing (--check)
 *
 * The engine is OWNED by `davintrade-stack-d-and-e/engine-1-5-new/` (the MCD kit, the four evaluators
 * and the cycle runner), next to the Python tests that pin it. The sensor worker starts
 * `python -B -m mcd_worker.cli` once per cycle from a folder named by SENSOR_ENGINE_DIR, and Railway
 * builds from `railway-gateway/` alone, so a path into ../davintrade-stack-d-and-e would not exist in
 * the image. This script puts the files the runner opens inside the package, byte for byte, keeping
 * their paths. Settled by Davin in step 3 part 4 (decision 6, option (a)); the list and the evidence
 * that it is enough are docs/runbooks/deploy-stack-d-step3.md section 2.2.
 *
 * Rules (runbook 2.2):
 *   - it copies an EXPLICIT list. A new MCD folder or a new runtime module is a deliberate edit of
 *     FILES below, and of the list in test/sensors-kit-sync.spec.ts;
 *   - it never writes outside railway-gateway/sensors/ and never deletes anything (a list entry that
 *     would leave the engine folder or sensors/ is refused before anything is read or written);
 *   - it refuses to run when the four `flag:` lines of the registries and mcd_worker/worker_config.yaml
 *     disagree (the engine's own test pins that too; the flags are the on/off switch of each sensor);
 *   - --check exits 0 when every file of the copy exists and equals its source, 1 when the copy has
 *     drifted (a file missing, different or not on the list), 2 when the script cannot run (a source
 *     file is missing, a list entry escapes, the flags disagree, an unknown option).
 *
 * This file stays plain JavaScript: tsconfig compiles every .ts file under scripts/, and one there would
 * change the build's output layout and break `node dist/main`; test/measure-cycles.spec.ts guards it.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SOURCE_DIR = path.resolve(
  __dirname,
  '../../davintrade-stack-d-and-e/engine-1-5-new'
);
const TARGET_DIR = path.resolve(__dirname, '../sensors');

/** The 45 runtime files, relative to the engine folder (and to railway-gateway/sensors/). */
const FILES = [
  // mcd_common: the kit (9)
  'mcd_common/__init__.py',
  'mcd_common/budget.py',
  'mcd_common/cycle_inputs.py',
  'mcd_common/envelope.py',
  'mcd_common/preflight.py',
  'mcd_common/reason_codes.py',
  'mcd_common/testing.py',
  'mcd_common/wording.py',
  'mcd_common/mcd-output-1.schema.json',
  // mcd0 to mcd3: evaluator, parameters, registry (3 each)
  'mcd0/mcd0_evaluator.py',
  'mcd0/mcd0_params.yaml',
  'mcd0/mcd0_registry.yaml',
  'mcd1/mcd1_evaluator.py',
  'mcd1/mcd1_params.yaml',
  'mcd1/mcd1_registry.yaml',
  'mcd2/mcd2_evaluator.py',
  'mcd2/mcd2_params.yaml',
  'mcd2/mcd2_registry.yaml',
  'mcd3/mcd3_evaluator.py',
  'mcd3/mcd3_params.yaml',
  'mcd3/mcd3_registry.yaml',
  // mcd_worker: the cycle runner, its configuration and the four checklists (13)
  'mcd_worker/__init__.py',
  'mcd_worker/cli.py',
  'mcd_worker/cycle_runner.py',
  'mcd_worker/errors.py',
  'mcd_worker/flags.py',
  'mcd_worker/guards.py',
  'mcd_worker/inheritance.py',
  'mcd_worker/registry.py',
  'mcd_worker/worker_config.yaml',
  'mcd_worker/checklists/MCD0.yaml',
  'mcd_worker/checklists/MCD1.yaml',
  'mcd_worker/checklists/MCD2.yaml',
  'mcd_worker/checklists/MCD3.yaml',
  // mcd_worker/synthesis: the rules engine, the entry-zone builder, their rules and parameters (11).
  // The runner imports it (build step 4 part 3), so it must travel with the runner.
  'mcd_worker/synthesis/__init__.py',
  'mcd_worker/synthesis/cycle.py',
  'mcd_worker/synthesis/engine.py',
  'mcd_worker/synthesis/facts.py',
  'mcd_worker/synthesis/pills.py',
  'mcd_worker/synthesis/reading.py',
  'mcd_worker/synthesis/rules.py',
  'mcd_worker/synthesis/zones.py',
  'mcd_worker/synthesis/rules/draft-1.yaml',
  'mcd_worker/synthesis/syn-output-1.schema.json',
  'mcd_worker/synthesis/zone_params.yaml',
];

const USAGE = `usage: node scripts/sync-sensor-kit.js [--check]
  (no option)  copy the ${FILES.length} runtime files of the sensor engine into sensors/
  --check      verify sensors/ against the engine; change nothing; exit 1 on drift`;

const FLAG_VALUE = /^(off|shadow|live)$/;

const rel = (from, to) => path.relative(from, to).split(path.sep).join('/');
const shown = (p) => rel(process.cwd(), p) || '.';
const bytes = (n) => `${n.toLocaleString('en-US')} bytes`;

function readLines(file) {
  return fs.readFileSync(file, 'utf8').split(/\r?\n/);
}

/** The value of a quoted-or-bare scalar on one line, or null. */
function scalar(text) {
  const m = /^(['"]?)([A-Za-z]+)\1\s*(?:#.*)?$/.exec(text.trim());
  return m ? m[2] : null;
}

/**
 * The flag of each MCD as the engine states it twice: `flag:` at the top of mcdN_registry.yaml and
 * under `flags:` in mcd_worker/worker_config.yaml. Returns the problems; none means they agree.
 */
function flagProblems() {
  const problems = [];
  const config = new Map();
  let inFlags = false;
  for (const line of readLines(
    path.join(SOURCE_DIR, 'mcd_worker/worker_config.yaml')
  )) {
    if (/^flags:\s*$/.test(line)) inFlags = true;
    else if (/^\S/.test(line) && !/^#/.test(line)) inFlags = false;
    const m = inFlags ? /^\s+(MCD[0-9]+):\s*(.*)$/.exec(line) : null;
    if (m) config.set(m[1], scalar(m[2]));
  }
  for (const n of [0, 1, 2, 3]) {
    const id = `MCD${n}`;
    const file = `mcd${n}/mcd${n}_registry.yaml`;
    const line = readLines(path.join(SOURCE_DIR, file)).find((l) =>
      /^flag:/.test(l)
    );
    const registry = line ? scalar(line.slice('flag:'.length)) : null;
    const worker = config.get(id) ?? null;
    if (registry === null || !FLAG_VALUE.test(registry))
      problems.push(
        `${file}: no readable \`flag:\` line (off, shadow or live)`
      );
    else if (worker === null || !FLAG_VALUE.test(worker))
      problems.push(
        `mcd_worker/worker_config.yaml: no readable flag for ${id} (off, shadow or live)`
      );
    else if (registry !== worker)
      problems.push(
        `${id}: ${file} says '${registry}' but mcd_worker/worker_config.yaml says '${worker}'`
      );
  }
  return problems;
}

function missingSources() {
  return FILES.filter(
    (f) =>
      !fs.existsSync(path.join(SOURCE_DIR, f)) ||
      !fs.statSync(path.join(SOURCE_DIR, f)).isFile()
  );
}

/** Every file under `dir` except Python's own caches, as paths relative to `dir`. */
function walk(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__pycache__') found.push(...walk(full, base));
    } else if (!entry.name.endsWith('.pyc')) {
      found.push(rel(base, full));
    }
  }
  return found;
}

function inside(dir, file) {
  const r = path.relative(dir, file);
  return r !== '' && !r.startsWith('..') && !path.isAbsolute(r);
}

/**
 * Entries of FILES that would write outside sensors/. The same relative path is read from the engine folder, so
 * an entry that leaves one leaves the other.
 */
function escapingPaths() {
  return FILES.filter((f) => !inside(TARGET_DIR, path.join(TARGET_DIR, f)));
}

/** Compares the copy with the engine. Reads only. */
function compare() {
  const missing = [];
  const different = [];
  let total = 0;
  for (const f of FILES) {
    const source = fs.readFileSync(path.join(SOURCE_DIR, f));
    total += source.length;
    const target = path.join(TARGET_DIR, f);
    if (!fs.existsSync(target) || !fs.statSync(target).isFile())
      missing.push(f);
    else {
      const copy = fs.readFileSync(target);
      if (!source.equals(copy))
        different.push(
          `${f} (engine ${bytes(source.length)}, copy ${bytes(copy.length)})`
        );
    }
  }
  const listed = new Set(FILES);
  const extra = walk(TARGET_DIR).filter((f) => !listed.has(f));
  return { missing, different, extra, total };
}

function check() {
  const { missing, different, extra, total } = compare();
  if (!missing.length && !different.length && !extra.length) {
    console.log(
      `sensor kit: ${FILES.length} files, ${bytes(total)}, ${shown(TARGET_DIR)} equals ${shown(SOURCE_DIR)} byte for byte`
    );
    return 0;
  }
  console.error(`sensor kit: ${shown(TARGET_DIR)} has drifted from the engine`);
  for (const f of missing) console.error(`  missing    ${f}`);
  for (const f of different) console.error(`  different  ${f}`);
  for (const f of extra) console.error(`  not listed ${f}`);
  console.error(
    'run `npm run sync:sensor-kit` (a file not listed is removed by hand)'
  );
  return 1;
}

function sync() {
  let total = 0;
  let written = 0;
  for (const f of FILES) {
    const target = path.join(TARGET_DIR, f);
    const source = fs.readFileSync(path.join(SOURCE_DIR, f));
    total += source.length;
    const same =
      fs.existsSync(target) && source.equals(fs.readFileSync(target));
    if (same) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, source);
    written += 1;
  }
  console.log(
    `sensor kit: ${FILES.length} files, ${bytes(total)} in ${shown(TARGET_DIR)} (${written} written, ${FILES.length - written} already identical)`
  );
  const listed = new Set(FILES);
  const extra = walk(TARGET_DIR).filter((f) => !listed.has(f));
  for (const f of extra)
    console.error(`  not listed, left in place: ${f} (remove it by hand)`);
  return 0;
}

function main(argv) {
  const args = argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    return 0;
  }
  const unknown = args.filter((a) => a !== '--check');
  if (unknown.length) {
    console.error(`unknown option: ${unknown.join(' ')}\n${USAGE}`);
    return 2;
  }
  const escaping = escapingPaths();
  if (escaping.length) {
    console.error(
      `sensor kit: the list in this script names a path outside ${shown(SOURCE_DIR)} or ${shown(TARGET_DIR)}; nothing was read or written:`
    );
    for (const f of escaping) console.error(`  ${f}`);
    return 2;
  }
  const absent = missingSources();
  if (absent.length) {
    console.error(
      `sensor kit: ${absent.length} listed file(s) not in ${shown(SOURCE_DIR)}; the list in this script is stale or the engine moved:`
    );
    for (const f of absent) console.error(`  ${f}`);
    return 2;
  }
  const problems = flagProblems();
  if (problems.length) {
    console.error(
      'sensor kit: refusing to run, the engine disagrees with itself:'
    );
    for (const p of problems) console.error(`  ${p}`);
    return 2;
  }
  return args.includes('--check') ? check() : sync();
}

process.exitCode = main(process.argv);
