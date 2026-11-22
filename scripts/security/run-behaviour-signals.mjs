#!/usr/bin/env node
// Behaviour signals (abuse seen while it starts), on their own:
//
//   node scripts/security/run-behaviour-signals.mjs
//   node scripts/security/run-behaviour-signals.mjs --offline
//
// Six signals (section 6.4 of the architecture): webhook 5xx and signature failures, failed
// logins and 2FA checks, the 5xx and 429 rate, the LLM spend, the BullMQ queue of the gateway, and
// a push to `main` that did not come from a merged pull request. The last two are read live (the
// gateway health endpoint when you gave its address, and the GitHub API); the others are judged
// from reports/behaviour-input.json when something has collected it. A signal with no data is
// reported as skipped, never as a pass.
//
// `run-security-pipeline.mjs --with-behaviour` runs the same checks inside the full sweep and
// feeds the P0 and P1 breaches to the LINE notifier. The repository is public: stdout carries
// counts only. The details go to the gitignored
// davintrade-security-monitoring-pipeline/reports/ folder. Run it with --help for the options.
// The logic lives in behaviour-signals-run.mjs; this file only wires the real file system, probes,
// clock and console.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBehaviourProbes } from './behaviour-signals-probes.mjs';
import { runBehaviourCli } from './behaviour-signals-run.mjs';
import { createCredentialFill } from './posture-sweep-probes.mjs';

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
  process.exitCode = await runBehaviourCli({
    argv: process.argv.slice(2),
    env: process.env,
    deps: {
      root: ROOT,
      fs,
      createProbes: ({ token, repo, gatewayHealthUrl }) =>
        createBehaviourProbes({ token, repo, gatewayHealthUrl }),
      now: () => new Date(),
      log: (line) => console.log(line),
      credentialFill: createCredentialFill(),
    },
  });
} catch {
  // an error message could quote a response body, so print a fixed line only
  console.log('error=unexpected_failure');
  process.exitCode = 1;
}
