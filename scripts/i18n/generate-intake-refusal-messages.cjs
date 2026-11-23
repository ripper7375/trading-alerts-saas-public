#!/usr/bin/env node
/**
 * Regenerates lib/i18n/intake-refusal-messages.json: the `intake.refusal.*` keys of every
 * dictionary and nothing else (10 keys in 19 locales, about 20 KB).
 *
 * The intake route handlers (lib/intake/server/reply.ts) read the refusal replies from this file
 * instead of lib/i18n/get-dictionary.ts. That file holds all 19 dictionaries (6.5 MB), and
 * Turbopack gave every group of route handlers that reached it its own 7.8 MB chunk plus a
 * 7.7 MB source map: four copies were 62 MB of `.next` on 2026-11-23, which left the Bundle Size
 * Monitor 4 MB under its limit. The same pattern for another route:
 * lib/i18n/world-gold-messages.json (scripts/i18n/generate-world-gold-messages.cjs).
 *
 * The dictionaries stay the source of truth; this file is derived from them, and
 * __tests__/lib/i18n/intake-refusal-messages.test.ts (and the replyText tests) fail if the two
 * drift apart.
 *
 * Usage:
 *   node scripts/i18n/generate-intake-refusal-messages.cjs          write the file
 *   node scripts/i18n/generate-intake-refusal-messages.cjs --check  exit 1 if it is stale
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const DICT_DIR = path.join(ROOT, 'lib', 'i18n', 'dictionaries');
const OUT_FILE = path.join(ROOT, 'lib', 'i18n', 'intake-refusal-messages.json');
const PREFIX = 'intake.refusal.';

/** `{ locale: { 'intake.refusal.<code>': text } }`, locales in file-name order. */
function buildMessages() {
  const messages = {};
  for (const file of fs
    .readdirSync(DICT_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort()) {
    const dictionary = JSON.parse(
      fs.readFileSync(path.join(DICT_DIR, file), 'utf8')
    );
    messages[file.slice(0, -'.json'.length)] = Object.fromEntries(
      Object.entries(dictionary).filter(([key]) => key.startsWith(PREFIX))
    );
  }
  return messages;
}

function serialise(messages) {
  return JSON.stringify(messages, null, 2) + '\n';
}

function main() {
  const text = serialise(buildMessages());
  const relative = path.relative(ROOT, OUT_FILE).split(path.sep).join('/');
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUT_FILE)
      ? fs.readFileSync(OUT_FILE, 'utf8').replace(/\r\n/g, '\n')
      : null;
    if (current !== text) {
      console.error(
        `${relative} is stale. Run: node scripts/i18n/generate-intake-refusal-messages.cjs`
      );
      process.exit(1);
    }
    console.log(`${relative} is up to date.`);
    return;
  }
  fs.writeFileSync(OUT_FILE, text);
  const locales = Object.keys(JSON.parse(text));
  console.log(`Wrote ${relative} (${locales.length} locales).`);
}

if (require.main === module) main();

module.exports = { buildMessages, serialise, PREFIX };
