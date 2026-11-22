#!/usr/bin/env node
// Private security sweep: matchers (pnpm audit, npm audit, pinned Python), OSV
// (including malicious-package records), CISA KEV, FIRST EPSS, the Node.js
// release index, an optional Dependabot reconciliation, the priority matrix of
// the architecture (section 7.4) and, optionally, a LINE push.
//
//   node scripts/security/run-security-pipeline.mjs --dry-run-line
//   node scripts/security/run-security-pipeline.mjs --notify-line --heartbeat
//
// The repository is public: stdout carries counts only. The details (advisory
// identifiers, package names) go to the gitignored
// davintrade-security-monitoring-pipeline/reports/ folder. Run it with --help for
// the options. The logic lives in security-pipeline-run.mjs; this file only wires
// the real file system, process runner, fetch and clock.

import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
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
import { runPipeline } from './security-pipeline-run.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const COMMANDS = new Set(['pnpm', 'npm']);

// pnpm and npm are .cmd shims on Windows and need a shell there; the command
// string is built from fixed arguments only (never from input).
function runCommand(command, args, { cwd, timeoutMs = 180000 }) {
  if (!COMMANDS.has(command)) throw new Error('command_not_allowed');
  const options = {
    cwd,
    encoding: 'utf8',
    maxBuffer: 1 << 29,
    timeout: timeoutMs,
    windowsHide: true,
    env: {
      ...process.env,
      NO_COLOR: '1',
      NO_UPDATE_NOTIFIER: '1',
      npm_config_update_notifier: 'false',
    },
  };
  const r =
    process.platform === 'win32'
      ? spawnSync([command, ...args].join(' '), { ...options, shell: true })
      : spawnSync(command, args, options);
  // pnpm and npm exit 1 when they find something: the caller reads stdout either way
  return {
    status: r.error ? (r.error.code === 'ETIMEDOUT' ? 124 : 127) : r.status,
    stdout: r.stdout ?? '',
  };
}

const fs = {
  readText: (path) => (existsSync(path) ? readFileSync(path, 'utf8') : null),
  writeText: (path, text) => {
    const temp = `${path}.${process.pid}.tmp`;
    writeFileSync(temp, text, 'utf8');
    renameSync(temp, path); // a killed run never leaves a half-written report
  },
  appendText: (path, text) => appendFileSync(path, text, 'utf8'),
  mkdirp: (path) => mkdirSync(path, { recursive: true }),
};

try {
  process.exitCode = await runPipeline({
    argv: process.argv.slice(2),
    env: process.env,
    deps: {
      root: ROOT,
      fs,
      runCommand,
      fetchImpl: globalThis.fetch,
      now: () => new Date(),
      sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
      log: (line) => console.log(line),
      // the credential Git holds for github.com, in memory only (never printed or stored)
      credentialFill: createCredentialFill(),
      nodeVersion: process.version,
      // the probes of --with-posture: HTTPS, TLS, DNS, the GitHub API and Git
      posture: {
        createProbes: ({ root, token, repo }) =>
          createPostureProbes({ root, token, repo }),
      },
    },
  });
} catch {
  // an error message could quote a response body, so print a fixed line only
  console.log('error=unexpected_failure');
  process.exitCode = 1;
}
