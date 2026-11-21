#!/usr/bin/env node
// Dismisses open Dependabot alerts whose manifest lives in a non-production
// directory (reference, archived, prototype or pre-release mobile code).
//
//   node scripts/security/dismiss-nonprod-dependabot-alerts.mjs --dry-run
//   node scripts/security/dismiss-nonprod-dependabot-alerts.mjs --max-dismiss 800
//
// Token: DEPENDABOT_TRIAGE_TOKEN, else GITHUB_TOKEN (a token that may write
// Dependabot alerts is needed for a live run). The token is never printed.
// Output is aggregate counts only: the repository is public, so no advisory
// identifier, package name, version or summary is ever printed.
// Tests: node --test 'scripts/security/*.test.mjs'

import { runTriage } from './dependabot-triage-lib.mjs';

try {
  process.exitCode = await runTriage({
    argv: process.argv.slice(2),
    env: process.env,
    fetchImpl: globalThis.fetch,
    log: (line) => console.log(line),
  });
} catch {
  // An error message could quote a response body, so print a fixed line only.
  console.log('error=unexpected_failure');
  process.exitCode = 1;
}
