#!/usr/bin/env node
// Counts-only audit of the standalone npm services, for the public CI log.
//
//   node scripts/security/services-audit-counts.mjs money-service operation-service railway-gateway
//   node scripts/security/services-audit-counts.mjs --audit-json report.json money-service   (tests)
//
// Runs `npm audit --package-lock-only --omit=dev --json` in each folder and prints
// the vulnerable packages per severity (`critical=N high=N moderate=N low=N`). The
// repository is public, so no advisory identifier, package name, version or title
// is ever printed: the raw `npm audit` table stays out of the log.
// INFORMATIVE: the exit code is 0 whatever the counts are (2 for wrong usage).

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import {
  npmSeverityCounts,
  parseNpmAuditJson,
} from './security-pipeline-matchers.mjs';

const DIR = /^[A-Za-z0-9._/-]+$/;

function runNpmAudit(cwd) {
  const args = ['audit', '--package-lock-only', '--omit=dev', '--json'];
  const options = {
    cwd,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    timeout: 180000,
  };
  // npm is a .cmd shim on Windows and needs a shell there; the command is fixed.
  const r =
    process.platform === 'win32'
      ? spawnSync(`npm ${args.join(' ')}`, { ...options, shell: true })
      : spawnSync('npm', args, options);
  return r.error ? '' : (r.stdout ?? ''); // npm exits 1 when it finds something: read stdout either way
}

function main(argv) {
  const dirs = [];
  let auditJson = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--audit-json') {
      auditJson = argv[(i += 1)] ?? null;
      if (!auditJson) return usage();
    } else if (
      DIR.test(argv[i]) &&
      !argv[i].startsWith('-') &&
      !argv[i].includes('..')
    ) {
      dirs.push(argv[i]);
    } else {
      return usage();
    }
  }
  if (dirs.length === 0) return usage();

  console.log(
    'Services npm audit (counts only, informational): production dependencies, vulnerable packages per severity'
  );
  let flagged = 0;
  for (const dir of dirs) {
    let text = '';
    if (auditJson)
      text = existsSync(auditJson) ? readFileSync(auditJson, 'utf8') : '';
    else if (existsSync(`${dir}/package-lock.json`)) text = runNpmAudit(dir);
    const parsed = parseNpmAuditJson(text);
    if (parsed.kind !== 'ok') {
      console.log(`service=${dir} result=unavailable`);
      continue;
    }
    const c = npmSeverityCounts(parsed.report);
    console.log(
      `service=${dir} critical=${c.critical} high=${c.high} moderate=${c.moderate} low=${c.low}`
    );
    if (c.critical + c.high > 0) {
      flagged += 1;
      console.log(
        `::warning title=${dir}::critical=${c.critical} high=${c.high} (counts only; informative, not blocking)`
      );
    }
  }
  console.log(
    flagged > 0
      ? 'At least one service reports high or critical production advisories. Informative only; details are not printed in public logs. Run `npm audit --omit=dev` in the service folder locally, or read the private security report.'
      : 'No service reports high or critical production advisories.'
  );
  return 0;
}

function usage() {
  console.log(
    '::error::usage: services-audit-counts.mjs [--audit-json <file>] <service-folder>...'
  );
  return 2;
}

process.exitCode = main(process.argv.slice(2));
