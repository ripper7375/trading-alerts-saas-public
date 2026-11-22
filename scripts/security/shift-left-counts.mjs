#!/usr/bin/env node
// Reduces the JSON report of a shift-left scanner to counts, for the public Actions log:
//
//   node scripts/security/shift-left-counts.mjs trivy --config out/config.json out/image-*.json
//   node scripts/security/shift-left-counts.mjs osv --report out/osv.json --targets out/targets.json
//   node scripts/security/shift-left-counts.mjs semgrep --report out/semgrep.json
//   node scripts/security/shift-left-counts.mjs semgrep-fixtures --report out/fixtures.json
//   node scripts/security/shift-left-counts.mjs gitleaks --report reports/gitleaks-history-audit.json
//
// The repository is public: stdout carries counts and fixed words only (never an advisory id, a
// package name, a rule finding on a real file or a secret match). The details stay in the scanner's
// report file, which no workflow uploads. Run with no arguments for the usage. The logic lives in
// shift-left-counts-lib.mjs; this file only reads the files and sets the exit code.

import { readFileSync } from 'node:fs';
import {
  COUNTS_USAGE,
  CountsUsageError,
  checkSemgrepFixtures,
  fixturesGate,
  guardLines,
  osvGate,
  parseCountsArgs,
  renderFixtureLines,
  renderGitleaksLines,
  renderOsvLines,
  renderSemgrepLines,
  renderTrivyLines,
  semgrepGate,
  summarizeGitleaks,
  summarizeOsvReport,
  summarizeSemgrepReport,
  summarizeTrivy,
  trivyGate,
} from './shift-left-counts-lib.mjs';
import { SEMGREP_FIXTURES } from './semgrep-fixtures.mjs';

// a missing or unparsable file is null: the library turns that into an error, never a clean scan
const readJson = (path) => {
  if (!path) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
};

const gateLine = (name, gate, blocking, flag) =>
  `${name}_gate: ${gate.mode} (critical+high=${gate.failing ?? 0}, scan_errors=${gate.errors ?? 0}${blocking ? '' : `; set ${flag} to true to fail on them`})`;

function run(options) {
  const targets = readJson(options.targets);
  switch (options.kind) {
    case 'trivy': {
      const summary = summarizeTrivy({
        config: readJson(options.config),
        images: options.files.map(readJson),
        expectedImages: Array.isArray(targets?.images)
          ? targets.images.length
          : null,
      });
      const gate = trivyGate({ summary, blocking: options.blocking });
      return {
        lines: [
          ...renderTrivyLines(summary, {
            notScannable: Array.isArray(targets?.notScannable)
              ? targets.notScannable.length
              : 0,
          }),
          gateLine('trivy', gate, options.blocking, 'TRIVY_BLOCKING'),
        ],
        exit: gate.exit,
        warn: !options.blocking && gate.errors > 0,
      };
    }
    case 'osv': {
      const pip = Array.isArray(targets?.pip) ? targets.pip : [];
      const summary = summarizeOsvReport(readJson(options.report), {
        devPaths: pip
          .filter((p) => p.scope === 'development')
          .map((p) => p.path),
        manifests: pip.map((p) => ({
          assetId: p.assetId,
          scope: p.scope,
          path: p.path,
          names: p.names,
        })),
      });
      const gate = osvGate({ summary, blocking: options.blocking });
      return {
        lines: [
          ...renderOsvLines(summary, {
            pinning:
              pip.length > 0
                ? {
                    requirements: pip.reduce((n, p) => n + p.requirements, 0),
                    unpinned: pip.reduce((n, p) => n + p.unpinned, 0),
                  }
                : null,
          }),
          gateLine('osv_python', gate, options.blocking, 'OSV_BLOCKING'),
        ],
        exit: gate.exit,
        warn: !options.blocking && gate.errors > 0,
      };
    }
    case 'semgrep': {
      const summary = summarizeSemgrepReport(readJson(options.report));
      const gate = semgrepGate({ summary, blocking: options.blocking });
      return {
        lines: [
          ...renderSemgrepLines(summary),
          `semgrep_custom_gate: ${gate.mode} (error findings=${gate.failing}${gate.broken ? ', the scan did not run properly' : ''}${options.blocking ? '' : '; set SEMGREP_BLOCKING to true to fail on them'})`,
        ],
        exit: gate.exit,
        warn: false,
      };
    }
    case 'semgrep-fixtures': {
      const result = checkSemgrepFixtures({
        report: readJson(options.report),
        fixtures: SEMGREP_FIXTURES,
      });
      return {
        lines: renderFixtureLines(result),
        exit: fixturesGate(result).exit,
        warn: false,
      };
    }
    case 'gitleaks': {
      const summary = summarizeGitleaks(readJson(options.report));
      return {
        lines: renderGitleaksLines(summary, { byRule: options.byRule }),
        exit: summary.valid ? 0 : 1,
        warn: false,
      };
    }
    default:
      throw new CountsUsageError('unknown kind');
  }
}

try {
  const options = parseCountsArgs(process.argv.slice(2));
  const { lines, exit, warn } = run(options);
  for (const line of guardLines(lines)) console.log(line);
  // a fixed notice for the run's summary; the numbers are in the lines above
  if (warn)
    console.log(
      '::warning::a shift-left scan did not complete: see the counts above'
    );
  process.exitCode = exit;
} catch (error) {
  if (error instanceof CountsUsageError) {
    console.log(`error=usage (${error.message})`);
    console.log(COUNTS_USAGE);
    process.exitCode = 2;
  } else {
    // an error message could quote a path or a report line
    console.log('error=unexpected_failure');
    process.exitCode = 1;
  }
}
