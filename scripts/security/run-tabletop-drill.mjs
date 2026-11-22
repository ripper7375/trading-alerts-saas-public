#!/usr/bin/env node
// The automated tabletop exercise: the annual rehearsal of the incident response playbooks
// (architecture v3.0, sections 8 and 9).
//
//   node scripts/security/run-tabletop-drill.mjs
//
// Two synthetic scenarios (a confirmed secret and a malicious package; an unexpected data-store
// endpoint and a webhook signature spike) run in memory through the real scoring engine, the real
// LINE message builders and the behaviour signals. The exercise checks the tier and rule of every
// finding, that each alert is counts only, and that each alert maps to a section of
// docs/runbooks/security-incident-playbooks.md that lists its rule. It reads no live system and
// never touches reports/alert-state.json: the only file it reads is the runbook.
//
// The report (a facilitator sheet for the walk-through with the owner) is written to
// davintrade-security-monitoring-pipeline/reports/incidents/<date>-tabletop-exercise-report.md and
// .json (gitignored). stdout carries counts only. Run it with --help for the options. The logic
// lives in tabletop-drill-lib.mjs; this file only wires the real file system, clock and console.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTabletopCli } from './tabletop-drill-lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const fs = {
  readText: (path) => (existsSync(path) ? readFileSync(path, 'utf8') : null),
  writeText: (path, text) => {
    const temp = `${path}.${process.pid}.tmp`;
    writeFileSync(temp, text, 'utf8');
    renameSync(temp, path); // a killed run never leaves a half-written report
  },
  mkdirp: (path) => mkdirSync(path, { recursive: true }),
};

try {
  process.exitCode = await runTabletopCli({
    argv: process.argv.slice(2),
    deps: {
      root: ROOT,
      fs,
      now: () => new Date(),
      log: (line) => console.log(line),
    },
  });
} catch {
  // an error message could quote a path or a value, so print a fixed line only
  console.log('error=unexpected_failure');
  process.exitCode = 1;
}
