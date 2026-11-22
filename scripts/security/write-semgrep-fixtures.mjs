#!/usr/bin/env node
// Writes the test cases of security/semgrep-rules.yml (scripts/security/semgrep-fixtures.mjs) to a
// folder, each at the path it would have in the repository, so Semgrep can be run over them:
//
//   node scripts/security/write-semgrep-fixtures.mjs --out "$RUNNER_TEMP/semgrep-fixtures"
//
// The folder must be outside the repository: the cases are code that is wrong on purpose, and the
// type check, CodeQL and Semgrep itself must never read them as part of the project.
// Prints counts only. Exit codes: 0 written, 1 failed, 2 usage error.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEMGREP_FIXTURES } from './semgrep-fixtures.mjs';
import { isRepoPath } from './shift-left-targets-lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--out' || !args[1]) {
  console.log(
    'error=usage (node scripts/security/write-semgrep-fixtures.mjs --out <dir>)'
  );
  process.exit(2);
}
const out = resolve(args[1]);
// outside means a path that leaves the repository (`..`), or one on another drive (Windows gives
// an absolute path back from `relative`), never the repository itself or a folder in it
const rel = relative(ROOT, out);
const outside =
  rel !== '' && (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`));
if (!outside) {
  console.log('error=out_inside_repository');
  process.exit(2);
}

try {
  for (const fixture of SEMGREP_FIXTURES) {
    if (!isRepoPath(fixture.path)) throw new Error('bad_path');
    const file = join(out, fixture.path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, fixture.content, 'utf8');
  }
  console.log(`semgrep_fixtures_written: files=${SEMGREP_FIXTURES.length}`);
} catch {
  console.log('error=write_failed');
  process.exitCode = 1;
}
