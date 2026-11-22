#!/usr/bin/env node
// Live posture sweep (attack surface and drift of the live state), on its own:
//
//   node scripts/security/run-posture-sweep.mjs
//   node scripts/security/run-posture-sweep.mjs --offline
//
// It checks, from outside: the security headers and the TLS certificate of the public site,
// that a paused asset's DNS names do not resolve, the repository security settings against
// the recorded baseline, the open GitHub secret-scanning alerts (rule R-3: each one is a P0;
// the token needs the right to read them, without it the check is `unavailable`, never a
// pass), and what the services report in reports/runtime-state.json (Node patch level against
// the floors, deployed commit against main).
//
// `run-security-pipeline.mjs --with-posture` runs the same checks inside the full sweep and
// feeds the P0 and P1 breaches to the LINE notifier. The repository is public: stdout carries
// counts only. The details go to the gitignored
// davintrade-security-monitoring-pipeline/reports/ folder. Run it with --help for the options.
// The logic lives in posture-sweep-run.mjs; this file only wires the real file system, probes,
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
import {
  createCredentialFill,
  createPostureProbes,
} from './posture-sweep-probes.mjs';
import { runPostureCli } from './posture-sweep-run.mjs';

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
  process.exitCode = await runPostureCli({
    argv: process.argv.slice(2),
    env: process.env,
    deps: {
      root: ROOT,
      fs,
      createProbes: ({ root, token, repo }) =>
        createPostureProbes({ root, token, repo }),
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
