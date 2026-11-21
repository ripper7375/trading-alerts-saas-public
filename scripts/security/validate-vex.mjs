#!/usr/bin/env node
// Validates security/vex-registry.json: schema, the public-safe policy (only
// not_affected and fixed statements, no address in the text, a malicious-package
// advisory can never be suppressed), the compound key
// (advisory_id, asset_id, package_spec), asset ids against the inventory, and
// the review window. An expired review is reported, never an error. The output
// is counts and error codes only: the registry is public, and so are CI logs.
//
// Usage: node scripts/security/validate-vex.mjs
//          [--registry security/vex-registry.json]
//          [--inventory security/security-inventory.yaml]
//          [--package-json package.json] [--today YYYY-MM-DD]
//          [--require-parity]
// --require-parity fails when an accepted ignore in package.json
// (pnpm.auditConfig.ignoreGhsas) has no VEX statement; without it the parity
// is only reported.
// Exit codes: 0 valid, 1 invalid, 2 usage or setup error.

import { existsSync, readFileSync } from 'node:fs';
import {
  buildValidationReport,
  inventoryAssetIds,
  isIsoDate,
  parityCounts,
  validateRegistry,
} from './vex-lib.mjs';

function parseArgs(argv) {
  const opts = {
    registry: 'security/vex-registry.json',
    inventory: 'security/security-inventory.yaml',
    packageJson: 'package.json',
    today: new Date().toISOString().slice(0, 10),
    requireParity: false,
  };
  const names = {
    '--registry': 'registry',
    '--inventory': 'inventory',
    '--package-json': 'packageJson',
    '--today': 'today',
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--require-parity') {
      opts.requireParity = true;
      continue;
    }
    const key = names[argv[i]];
    if (!key || argv[i + 1] === undefined) {
      throw new Error(`unknown or incomplete option: ${argv[i]}`);
    }
    opts[key] = argv[(i += 1)];
  }
  if (!isIsoDate(opts.today)) throw new Error('--today must be YYYY-MM-DD');
  return opts;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.log(`::error::${error.message}`);
    return 2;
  }
  if (!existsSync(opts.registry)) {
    console.log('::error::The VEX registry was not found.');
    return 2;
  }

  let registry;
  try {
    registry = JSON.parse(readFileSync(opts.registry, 'utf8'));
  } catch {
    console.log('::error::The VEX registry is not valid JSON.');
    return 1;
  }

  const assetIds = existsSync(opts.inventory)
    ? inventoryAssetIds(readFileSync(opts.inventory, 'utf8'))
    : null;
  const result = validateRegistry(registry, { assetIds, today: opts.today });

  let parity = null;
  if (existsSync(opts.packageJson)) {
    try {
      const pkg = JSON.parse(readFileSync(opts.packageJson, 'utf8'));
      const ignored = pkg?.pnpm?.auditConfig?.ignoreGhsas;
      if (Array.isArray(ignored)) parity = parityCounts(registry, ignored);
    } catch {
      // an unreadable package.json is not this script's concern
    }
  }

  const { exitCode, lines } = buildValidationReport({
    result,
    assetCount: assetIds ? assetIds.size : null,
    parity,
    requireParity: opts.requireParity,
  });
  console.log(lines.join('\n'));
  return exitCode;
}

process.exitCode = main();
