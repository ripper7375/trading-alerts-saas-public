#!/usr/bin/env node
// Runs security/semgrep-rules.yml over the tracked files of this checkout WITHOUT Semgrep: a Node
// re-run of the same regexes, the same path scopes and the same .semgrepignore (see
// semgrep-rules-lib.mjs). It exists for machines that cannot run Semgrep (Windows) and as the local
// check that the ruleset has no finding on the code as it stands. The CI job runs the real Semgrep.
//
//   node scripts/security/check-semgrep-rules-local.mjs
//   node scripts/security/check-semgrep-rules-local.mjs --details     (rule, file and line; local use only)
//
// Prints counts only unless --details is given, which is refused inside GitHub Actions: the repository
// is public, so a finding on an existing file must not reach a public log.
// Exit codes: 0 no finding, 1 at least one ERROR finding or a setup problem, 2 usage error.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isIgnored,
  parseSemgrepIgnore,
  parseSemgrepRules,
  renderLocalLine,
  runSemgrepRules,
} from './semgrep-rules-lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const details = process.argv.includes('--details');
const extra = process.argv.slice(2).filter((arg) => arg !== '--details');
if (extra.length > 0) {
  console.log(
    'error=usage (node scripts/security/check-semgrep-rules-local.mjs [--details])'
  );
  process.exit(2);
}
if (details && process.env.GITHUB_ACTIONS === 'true') {
  console.log('error=details_not_allowed_in_actions');
  process.exit(2);
}

try {
  const rules = parseSemgrepRules(
    readFileSync(join(ROOT, 'security', 'semgrep-rules.yml'), 'utf8')
  );
  const ignoreFile = join(ROOT, '.semgrepignore');
  const ignorePatterns = existsSync(ignoreFile)
    ? parseSemgrepIgnore(readFileSync(ignoreFile, 'utf8'))
    : [];
  const listed = spawnSync('git', ['ls-files', '-z'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
    maxBuffer: 1 << 28,
  });
  if (listed.status !== 0) throw new Error('git_failed');
  const extensions = [
    '.ts',
    '.tsx',
    '.mts',
    '.cts',
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
  ];
  const files = [];
  for (const path of listed.stdout.split('\0')) {
    if (
      !extensions.some((ext) => path.endsWith(ext)) ||
      isIgnored(path, ignorePatterns)
    )
      continue;
    const file = join(ROOT, path);
    if (existsSync(file))
      files.push({ path, text: readFileSync(file, 'utf8') });
  }
  const result = runSemgrepRules({ rules, files, ignorePatterns });
  console.log(renderLocalLine({ rules, ...result }));
  if (details) {
    for (const f of result.findings)
      console.log(`${f.severity} ${f.ruleId} ${f.path}:${f.line}`);
  }
  process.exitCode = result.findings.some((f) => f.severity === 'ERROR')
    ? 1
    : 0;
} catch {
  // an error message could quote a path or a line of a file
  console.log('error=unexpected_failure');
  process.exitCode = 1;
}
