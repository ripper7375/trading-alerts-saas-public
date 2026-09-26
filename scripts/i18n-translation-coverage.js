#!/usr/bin/env node
/**
 * Translation coverage: how much of what the app shows is really translated.
 *
 * Every dictionary carries every key (4,710), and the Tier-2 dictionaries
 * hold English copies of keys nobody has translated yet. Key presence
 * therefore says nothing; this tool compares each value with en-GB instead.
 *
 * A key counts as TRANSLATED in a language when its value differs from the
 * en-GB value, or when the English text needs no translation (no run of
 * three lowercase letters, e.g. "XAUUSD", "PRO", "{count}"; or a brand name
 * in NO_TRANSLATION_NEEDED). English columns are always 100%.
 *
 * A key is USED by a file when it appears as a complete string literal in it.
 * A page uses the keys of its own file plus every local file it imports
 * (transitively, within app/, components/, lib/, hooks/). Layout chrome
 * (header, sidebar) is not counted: pages do not import it.
 *
 * Usage:
 *   node scripts/i18n-translation-coverage.js                 # per-language summary
 *   node scripts/i18n-translation-coverage.js --pages list.txt --json out.json
 *     list.txt: one page source path per line (absolute or repo-relative)
 *     out.json: { languages, summary, pages: { [path]: { keys, byLanguage } } }
 *
 * Grades used in docs/files-completion-list/davintrade-ui-page.xlsx:
 *   Pass >= 80% translated, Partial 20-79%, Untranslated < 20%.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DICT_DIR = path.join(ROOT, 'lib/i18n/dictionaries');
const SOURCE_DIRS = ['app', 'components', 'lib', 'hooks'];
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  'dictionaries',
  '__tests__',
]);
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
/**
 * Imported by nearly every page, but their strings (country names, relative
 * times) only show where the page asks for them; following them would charge
 * every page for the header's country list.
 */
const SHARED_INFRASTRUCTURE = new Set([
  'lib/context/locale-context.tsx',
  'lib/country-config.ts',
]);

/** Proper nouns that stay the same in every language. */
const NO_TRANSLATION_NEEDED = new Set([
  'DavinTrade',
  'DavinTrade AI',
  'Davin AI',
  'Gold Trade',
  'YouTube',
  'Stripe',
  'dLocal',
  'Wise',
  'TradingView',
  'Facebook',
  'Instagram',
  'LinkedIn',
  'Telegram',
  'Discord',
  'Google',
  'WhatsApp',
  'MetaTrader 5',
]);

function loadDictionaries() {
  const dicts = {};
  for (const file of fs
    .readdirSync(DICT_DIR)
    .filter((f) => f.endsWith('.json'))) {
    dicts[file.replace(/\.json$/, '')] = JSON.parse(
      fs.readFileSync(path.join(DICT_DIR, file), 'utf8')
    );
  }
  return dicts;
}

/**
 * Keys whose correct translation in a language is the English text itself
 * (e.g. "Heiken Ashi", or "Dashboard" in German). Maintained by hand next to
 * the translations: { "<lang>": ["<key>", ...] }.
 */
const IDENTICAL_OK_FILE = path.join(__dirname, 'i18n-identical-ok.json');
const IDENTICAL_OK = fs.existsSync(IDENTICAL_OK_FILE)
  ? Object.fromEntries(
      Object.entries(
        JSON.parse(fs.readFileSync(IDENTICAL_OK_FILE, 'utf8'))
      ).map(([lang, keys]) => [lang, new Set(keys)])
    )
  : {};

function needsTranslation(english) {
  return (
    /[a-z]{3,}/.test(english) && !NO_TRANSLATION_NEEDED.has(english.trim())
  );
}

function isTranslated(language, key, dicts) {
  const english = dicts['en-GB'][key];
  if (language.startsWith('en') || !needsTranslation(english)) return true;
  const value = dicts[language][key];
  if (value === english && IDENTICAL_OK[language]?.has(key)) return true;
  return typeof value === 'string' && value !== '' && value !== english;
}

/**
 * String literals in a JS/TS source, via a small lexer (a single regex pairs
 * the backticks of `${...}` templates wrongly and swallows everything between
 * two templates). Comments are skipped; a template contributes its text only
 * when it has no `${}`; a quote that reaches a line end is JSX text, not a
 * string (`<p>don't</p>`).
 */
function scanLiterals(src) {
  const out = [];
  let i = 0;
  const n = src.length;

  function readQuoted(quote) {
    let s = '';
    let j = i + 1;
    while (j < n) {
      const c = src[j];
      if (c === '\\') {
        s += src[j + 1] ?? '';
        j += 2;
      } else if (c === quote) {
        i = j + 1;
        return s;
      } else if (c === '\n') {
        break;
      } else {
        s += c;
        j++;
      }
    }
    i += 1; // not a string: step past the quote
    return null;
  }

  function readTemplate() {
    let s = '';
    let dynamic = false;
    i++;
    while (i < n) {
      const c = src[i];
      if (c === '\\') {
        s += src[i + 1] ?? '';
        i += 2;
      } else if (c === '`') {
        i++;
        return dynamic ? null : s;
      } else if (c === '$' && src[i + 1] === '{') {
        dynamic = true;
        i += 2;
        scan(true);
      } else {
        s += c;
        i++;
      }
    }
    return null;
  }

  // Scans until the end, or (inside `${`) until the matching `}`.
  function scan(inExpression) {
    let depth = 0;
    while (i < n) {
      const c = src[i];
      const next = src[i + 1];
      if (c === '/' && next === '/') {
        const end = src.indexOf('\n', i);
        i = end === -1 ? n : end;
      } else if (c === '/' && next === '*') {
        const end = src.indexOf('*/', i + 2);
        i = end === -1 ? n : end + 2;
      } else if (c === "'" || c === '"') {
        const s = readQuoted(c);
        if (s !== null) out.push(s);
      } else if (c === '`') {
        const s = readTemplate();
        if (s !== null) out.push(s);
      } else if (inExpression && c === '{') {
        depth++;
        i++;
      } else if (inExpression && c === '}') {
        i++;
        if (depth-- === 0) return;
      } else {
        i++;
      }
    }
  }

  scan(false);
  return out;
}

const literalCache = new Map();
function literalsOf(file) {
  if (literalCache.has(file)) return literalCache.get(file);
  const raw = fs.readFileSync(file, 'utf8');
  // Drop t()/dt() fallback arguments: `t('upgrade.confirming', 'Confirming
  // your upgrade...')` renders the dotted key, even when the fallback text
  // also happens to be a (legacy) key of its own.
  const src = raw.replace(
    /(\b(?:t|dt)\(\s*(['"`])(?:(?!\2)[^\\]|\\.)*\2\s*,\s*)(['"`])(?:(?!\3)[^\\]|\\.)*\3/g,
    '$1null'
  );
  const literals = new Set(scanLiterals(src));
  let m;
  const imports = [];
  const importRe =
    /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;
  while ((m = importRe.exec(src))) imports.push(m[1]);
  const entry = { literals, imports };
  literalCache.set(file, entry);
  return entry;
}

function resolveImport(spec, fromFile) {
  let base;
  if (spec.startsWith('@/')) base = path.join(ROOT, spec.slice(2));
  else if (spec.startsWith('.'))
    base = path.resolve(path.dirname(fromFile), spec);
  else return null;
  const candidates = [
    base,
    ...EXTENSIONS.map((e) => base + e),
    ...EXTENSIONS.map((e) => path.join(base, 'index' + e)),
  ];
  const found = candidates.find(
    (c) => fs.existsSync(c) && fs.statSync(c).isFile()
  );
  if (!found || !EXTENSIONS.includes(path.extname(found))) return null;
  const rel = path.relative(ROOT, found).split(path.sep);
  if (
    !SOURCE_DIRS.includes(rel[0]) ||
    rel.some((part) => SKIP_DIRS.has(part)) ||
    SHARED_INFRASTRUCTURE.has(rel.join('/'))
  ) {
    return null;
  }
  return found;
}

function keysForPage(pageFile, dictKeys) {
  const seen = new Set();
  const keys = new Set();
  const stack = [pageFile];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const { literals, imports } = literalsOf(file);
    for (const literal of literals)
      if (dictKeys.has(literal)) keys.add(literal);
    for (const spec of imports) {
      const next = resolveImport(spec, file);
      if (next) stack.push(next);
    }
  }
  return keys;
}

function allSourceKeys(dictKeys) {
  const keys = new Set();
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(p);
      } else if (EXTENSIONS.includes(path.extname(entry.name))) {
        for (const literal of literalsOf(p).literals) {
          if (dictKeys.has(literal)) keys.add(literal);
        }
      }
    }
  };
  for (const dir of SOURCE_DIRS) {
    const abs = path.join(ROOT, dir);
    if (fs.existsSync(abs)) walk(abs);
  }
  return keys;
}

/**
 * Pages that must be fully translated in every language (Davin, 2026-09-25):
 * public marketing, auth, and FREE/PRO user pages, with their layouts,
 * loading and error files, plus the provider tree that renders on every page
 * (chat widget). Admin pages are internal and affiliate pages are optional,
 * so both are excluded; so are local-only preview routes (app/dev*).
 * Repo-relative paths, sorted.
 */
function compulsoryPages() {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), {
      withFileTypes: true,
    })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (
          rel === 'app/admin' ||
          rel === 'app/affiliate' ||
          rel === 'app/api' ||
          /^app\/dev/.test(rel)
        ) {
          continue;
        }
        walk(rel);
      } else if (
        /^(page|layout|loading|error|global-error|not-found)\.tsx$/.test(
          entry.name
        )
      ) {
        out.push(rel);
      }
    }
  };
  walk('app');
  out.push('components/providers/client-providers.tsx');
  return out.sort();
}

function coverage(keys, dicts, languages) {
  const byLanguage = {};
  for (const language of languages) {
    const translated = [...keys].filter((k) =>
      isTranslated(language, k, dicts)
    ).length;
    byLanguage[language] = keys.size ? translated / keys.size : null;
  }
  return byLanguage;
}

function main() {
  const args = process.argv.slice(2);
  const arg = (name) => {
    const i = args.indexOf(name);
    return i === -1 ? null : args[i + 1];
  };
  const dicts = loadDictionaries();
  const languages = Object.keys(dicts).sort();
  const dictKeys = new Set(Object.keys(dicts['en-GB']));

  const used = allSourceKeys(dictKeys);
  const summary = coverage(used, dicts, languages);
  console.log(
    `Keys in dictionaries: ${dictKeys.size}; used in source: ${used.size}`
  );
  for (const language of languages) {
    console.log(
      `  ${language.padEnd(6)} ${(100 * summary[language]).toFixed(1).padStart(5)}% of used keys translated`
    );
  }

  const explain = arg('--explain');
  if (explain) {
    const language = arg('--lang') || 'fr';
    const abs = path.isAbsolute(explain) ? explain : path.join(ROOT, explain);
    const missing = [...keysForPage(abs, dictKeys)].filter(
      (k) => !isTranslated(language, k, dicts)
    );
    console.log(
      `\n${explain}: ${missing.length} keys not translated in ${language}`
    );
    for (const k of missing) console.log(`  ${JSON.stringify(k)}`);
  }

  const pagesFile = arg('--pages');
  if (!pagesFile) return;
  const pages = {};
  for (const line of fs.readFileSync(pagesFile, 'utf8').split(/\r?\n/)) {
    const p = line.trim();
    if (!p) continue;
    const abs = path.isAbsolute(p) ? p : path.join(ROOT, p);
    if (!fs.existsSync(abs)) {
      pages[p] = { missing: true };
      continue;
    }
    const keys = keysForPage(abs, dictKeys);
    pages[p] = {
      keys: keys.size,
      byLanguage: coverage(keys, dicts, languages),
    };
  }
  const out = arg('--json');
  if (out)
    fs.writeFileSync(
      out,
      JSON.stringify({ languages, summary, pages }, null, 1)
    );
}

if (require.main === module) main();

module.exports = {
  loadDictionaries,
  isTranslated,
  keysForPage,
  allSourceKeys,
  coverage,
  compulsoryPages,
  literalsOf,
  resolveImport,
};
