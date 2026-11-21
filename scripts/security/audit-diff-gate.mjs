#!/usr/bin/env node
// Audit gate for CI, counts only (the repository is public).
//
//   full     main (push, weekly schedule, manual run): every high or critical
//            advisory in production dependencies fails the gate.
//   diff     pull requests and feature-branch pushes: fails only on high or
//            critical advisories in lockfile packages the change adds or
//            changes, measured against the merge-base with the base branch. A
//            new advisory published overnight never fails an unrelated change.
//   summary  informational: advisories per severity across all dependencies.
//            Never fails.
//
// Usage: node scripts/security/audit-diff-gate.mjs
//          [--mode auto|full|diff|summary] [--base origin/main]
//          [--lockfile pnpm-lock.yaml] [--base-lockfile <file>]
//          [--audit-json <file>]
// --base-lockfile and --audit-json replace the git and pnpm calls (tests).
// Exit codes: 0 pass, 1 fail, 2 usage or setup error.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import {
  buildReport,
  buildSummaryReport,
  chooseMode,
  classifyAdvisories,
  introducedKeys,
  lockfilePackageKeys,
  parseAuditJson,
  severityCounts,
} from './audit-diff-gate-lib.mjs';

function parseArgs(argv) {
  const opts = {
    mode: 'auto',
    base: 'origin/main',
    lockfile: 'pnpm-lock.yaml',
    baseLockfile: null,
    auditJson: null,
  };
  const names = {
    '--mode': 'mode',
    '--base': 'base',
    '--lockfile': 'lockfile',
    '--base-lockfile': 'baseLockfile',
    '--audit-json': 'auditJson',
  };
  for (let i = 0; i < argv.length; i += 2) {
    const key = names[argv[i]];
    if (!key || argv[i + 1] === undefined) {
      throw new Error(`unknown or incomplete option: ${argv[i]}`);
    }
    opts[key] = argv[i + 1];
  }
  return opts;
}

function git(args) {
  const r = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28 });
  return r.status === 0 ? r.stdout : null;
}

// The lockfile as it was at the merge-base of HEAD and the base branch. For a
// pull request HEAD is the merge commit, so this is the base branch tip the
// change was merged onto; for a branch push it is the point the branch left.
function baseLockfileFromGit(baseRef, lockfile) {
  const mergeBase = git(['merge-base', 'HEAD', baseRef]);
  if (!mergeBase) return null;
  return git(['show', `${mergeBase.trim()}:${lockfile}`]);
}

function auditArgs(production) {
  return production
    ? [
        'audit',
        '--prod',
        '--json',
        '--audit-level=high',
        '--ignore-registry-errors',
      ]
    : ['audit', '--json', '--audit-level=moderate', '--ignore-registry-errors'];
}

function runAudit({ production }) {
  const args = auditArgs(production);
  const options = { encoding: 'utf8', maxBuffer: 1 << 29 };
  // pnpm is a .cmd shim on Windows and needs a shell there; a fixed command
  // string (no variable parts) avoids Node's warning about shell plus args.
  const r =
    process.platform === 'win32'
      ? spawnSync(`pnpm ${args.join(' ')}`, { ...options, shell: true })
      : spawnSync('pnpm', args, options);
  return { status: r.error ? 127 : r.status, stdout: r.stdout ?? '' };
}

// The advisories of one audit run, or why there are none. An empty answer or an
// error object with exit 0 is a registry error that --ignore-registry-errors
// let through (as before, it must not read as a finding); any other output
// without usable advisories is a failed run.
function collectAdvisories(opts, production) {
  let text;
  let status = 0;
  if (opts.auditJson) {
    text = existsSync(opts.auditJson)
      ? readFileSync(opts.auditJson, 'utf8')
      : '';
  } else {
    ({ status, stdout: text } = runAudit({ production }));
  }
  const parsed = parseAuditJson(text);
  if (parsed.kind === 'ok') {
    return {
      advisories: parsed.advisories,
      auditUnavailable: false,
      auditFailedExit: null,
    };
  }
  if (parsed.kind === 'unavailable' && status === 0) {
    return { advisories: null, auditUnavailable: true, auditFailedExit: null };
  }
  return {
    advisories: null,
    auditUnavailable: false,
    auditFailedExit: status || 1,
  };
}

function runSummary(opts) {
  const { advisories, auditUnavailable, auditFailedExit } = collectAdvisories(
    opts,
    false
  );
  const { exitCode, lines } = buildSummaryReport({
    counts: advisories ? severityCounts(advisories) : null,
    auditUnavailable,
    auditFailedExit,
  });
  console.log(lines.join('\n'));
  return exitCode;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
    opts.resolvedMode = chooseMode({ requested: opts.mode });
  } catch (error) {
    console.log(`::error::${error.message}`);
    return 2;
  }
  if (opts.resolvedMode === 'summary') return runSummary(opts);
  if (!existsSync(opts.lockfile)) {
    console.log('::error::The lockfile was not found: nothing to audit.');
    return 2;
  }

  let mode = opts.resolvedMode;
  let introduced = null;
  let baseUnavailable = false;
  if (mode === 'diff') {
    const baseText = opts.baseLockfile
      ? readFileSync(opts.baseLockfile, 'utf8')
      : baseLockfileFromGit(opts.base, opts.lockfile);
    if (baseText === null) {
      baseUnavailable = true;
      mode = 'full';
    } else {
      introduced = introducedKeys(
        lockfilePackageKeys(readFileSync(opts.lockfile, 'utf8')),
        lockfilePackageKeys(baseText)
      );
    }
  }

  const introducedCount = introduced ? introduced.size : null;
  if (mode === 'diff' && introducedCount === 0) {
    const { exitCode, lines } = buildReport({ mode, introducedCount });
    console.log(lines.join('\n'));
    return exitCode;
  }

  const { advisories, auditUnavailable, auditFailedExit } = collectAdvisories(
    opts,
    true
  );
  const { exitCode, lines } = buildReport({
    mode,
    introducedCount,
    counts: advisories ? classifyAdvisories(advisories, introduced) : null,
    auditUnavailable,
    auditFailedExit,
    baseUnavailable,
  });
  console.log(lines.join('\n'));
  return exitCode;
}

process.exitCode = main();
