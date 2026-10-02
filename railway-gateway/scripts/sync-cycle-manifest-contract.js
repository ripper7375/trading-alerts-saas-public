#!/usr/bin/env node
/**
 * Copies gateway_contract_cycle_manifest.schema.json into the gateway package.
 *
 * The contract is OWNED by the VPS side (backend-stack-c), next to the sender
 * that produces the manifest and the tests that pin it. The gateway validates
 * against a copy kept inside this package because Railway builds from this
 * directory only: a path into ../backend-stack-c would not exist at runtime.
 *
 * test/cycle-manifest-contract.spec.ts fails if the two ever differ, and says
 * to re-run this script:
 *
 *   npm run sync:manifest-contract
 */
const fs = require('fs');
const path = require('path');

const SOURCE = path.join(
  __dirname,
  '../../backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture/gateway_contract_cycle_manifest.schema.json'
);
const TARGET = path.join(__dirname, '../src/cycle/cycle-manifest.schema.json');

fs.copyFileSync(SOURCE, TARGET);
console.log(`copied ${path.relative(process.cwd(), SOURCE)}`);
console.log(`    to ${path.relative(process.cwd(), TARGET)}`);
