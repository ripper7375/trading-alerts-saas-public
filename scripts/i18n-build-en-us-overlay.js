#!/usr/bin/env node
/**
 * Regenerates lib/i18n/overlays/en-US.json: the keys whose en-US text differs
 * from en-GB's. The browser loads en-GB as its base dictionary and applies
 * this overlay for en-US (lib/i18n/client-dictionaries.ts), so the US variant
 * is a few kilobytes instead of a second 350 KB copy of the same English.
 *
 * lib/i18n/dictionaries/en-US.json stays the complete file (server rendering,
 * the translation-coverage tooling); this overlay is derived from it, and
 * __tests__/lib/i18n/client-dictionaries.test.ts fails if the two drift apart.
 *
 * Usage:
 *   node scripts/i18n-build-en-us-overlay.js          write the overlay
 *   node scripts/i18n-build-en-us-overlay.js --check  exit 1 if it is stale
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DICT_DIR = path.join(ROOT, 'lib', 'i18n', 'dictionaries');
const OVERLAY_FILE = path.join(ROOT, 'lib', 'i18n', 'overlays', 'en-US.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function buildOverlay() {
  const enGB = readJson(path.join(DICT_DIR, 'en-GB.json'));
  const enUS = readJson(path.join(DICT_DIR, 'en-US.json'));
  const overlay = {};
  for (const [key, value] of Object.entries(enUS)) {
    if (enGB[key] !== value) overlay[key] = value;
  }
  return overlay;
}

function serialise(overlay) {
  return JSON.stringify(overlay, null, 2) + '\n';
}

function main() {
  const text = serialise(buildOverlay());
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OVERLAY_FILE)
      ? fs.readFileSync(OVERLAY_FILE, 'utf8').replace(/\r\n/g, '\n')
      : null;
    if (current !== text) {
      console.error(
        'lib/i18n/overlays/en-US.json is stale. Run: node scripts/i18n-build-en-us-overlay.js'
      );
      process.exit(1);
    }
    console.log('lib/i18n/overlays/en-US.json is up to date.');
    return;
  }
  fs.mkdirSync(path.dirname(OVERLAY_FILE), { recursive: true });
  fs.writeFileSync(OVERLAY_FILE, text);
  console.log(
    `Wrote ${path.relative(ROOT, OVERLAY_FILE)} (${Object.keys(JSON.parse(text)).length} keys).`
  );
}

if (require.main === module) main();

module.exports = { buildOverlay, serialise };
