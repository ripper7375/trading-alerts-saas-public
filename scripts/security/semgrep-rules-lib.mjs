// Runs the custom Semgrep rules of security/semgrep-rules.yml without Semgrep.
//
// Every rule of that file is a `pattern-regex` rule with a path scope, so what Semgrep does for it is:
// pick the files (language by extension, `paths.include` and `paths.exclude`, `.semgrepignore`), run
// the regex over the text of each, and report each match with its line. This module does the same in
// Node. It exists for three reasons:
//   - the rules and their fixtures are tested on every machine, Windows included, where Semgrep does
//     not run;
//   - the owner can run the whole ruleset on the working tree with one command and read counts;
//   - the CI job runs the real Semgrep over the same rules and the same fixtures, so a difference
//     between the two engines shows up as a failed check instead of a silent gap.
//
// Pure functions: the files are passed in, nothing here reads a file or prints. Problems are fixed
// codes. A rule that is not a portable `pattern-regex` rule is refused (a rule the local engine
// cannot run would be a rule this tool silently skips).

import { parseYaml } from './security-yaml-lite.mjs';

export class SemgrepRulesError extends Error {}

const SEVERITIES = new Set(['ERROR', 'WARNING', 'INFO']);
const RULE_ID_RE = /^davintrade-[a-z0-9]+(?:-[a-z0-9]+)*$/;

// the languages the rules use, as the extensions Semgrep reads them from
const EXTENSIONS = Object.freeze({
  typescript: ['.ts', '.tsx', '.mts', '.cts'],
  javascript: ['.js', '.jsx', '.mjs', '.cjs'],
});

const MAX_TARGET_BYTES = 1_000_000; // Semgrep skips a larger file by default

// --- globs ------------------------------------------------------------------------------------------

/** `**` crosses folders, `*` and `?` stay inside one; a `**` followed by `/` may match no folder. */
export function globToRegExp(glob) {
  const source = String(glob)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '\u0001')
    .replace(/\*\*/g, '\u0002')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\u0001/g, '(?:.*/)?')
    .replace(/\u0002/g, '.*');
  return new RegExp(`^${source}$`);
}

/** The non-empty, non-comment lines of a `.semgrepignore`. */
export const parseSemgrepIgnore = (text) =>
  String(text ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));

/**
 * `.gitignore`-style matching, the part of it the file uses: `name/` is a folder anywhere, a pattern
 * with a `/` inside (or a leading `/`) is anchored at the root, any other pattern matches a file or
 * folder name at any depth. A pattern names a folder or a file; everything under a folder is ignored.
 */
export function isIgnored(path, patterns) {
  const parts = String(path).split('/');
  return patterns.some((raw) => {
    let pattern = raw;
    const folderOnly = pattern.endsWith('/');
    if (folderOnly) pattern = pattern.slice(0, -1);
    const anchored = pattern.startsWith('/') || pattern.includes('/');
    if (pattern.startsWith('/')) pattern = pattern.slice(1);
    const re = globToRegExp(pattern);
    const last = parts.length - 1;
    if (!anchored) {
      return parts.some(
        (segment, i) => (i < last || !folderOnly) && re.test(segment)
      );
    }
    for (let i = 1; i <= parts.length; i += 1) {
      if (folderOnly && i === parts.length) break;
      if (re.test(parts.slice(0, i).join('/'))) return true;
    }
    return false;
  });
}

// --- the rules ------------------------------------------------------------------------------------------

// What a PCRE regex has that a JavaScript one does not (or reads differently): the rules may use `\A`
// as the first token, and nothing else of this kind.
const NOT_PORTABLE = [
  /\\[zZGKRhHXNQE]/, // anchors and classes JavaScript lacks
  /\(\?[a-zA-Z^-]+[:)]/, // inline flags such as (?i) or (?s:
  /[*+?}]\+/, // possessive quantifiers
  /\(\?[>|]/, // atomic groups, branch reset
];

/**
 * A rule's regex as a JavaScript RegExp. `\A` (the start of the file in PCRE, in any flag mode) becomes
 * `^` (the start of the text: no `m` flag is ever set).
 */
export function compileRuleRegex(source) {
  if (typeof source !== 'string' || source === '') {
    throw new SemgrepRulesError('rule_regex_missing');
  }
  const body = source.startsWith('\\A') ? `^${source.slice(2)}` : source;
  if (body.includes('\\A') || NOT_PORTABLE.some((re) => re.test(body))) {
    throw new SemgrepRulesError('rule_regex_not_portable');
  }
  try {
    return new RegExp(body, 'g');
  } catch {
    throw new SemgrepRulesError('rule_regex_invalid');
  }
}

const asStringList = (value) =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : null;

/**
 * Reads and validates the rules file. Returns one entry per rule with its regex compiled.
 *
 * @returns {{ id: string, severity: string, languages: string[], message: string, cwe: string, include: string[], exclude: string[], source: string, regex: RegExp }[]}
 */
export function parseSemgrepRules(text) {
  let doc;
  try {
    doc = parseYaml(text);
  } catch {
    throw new SemgrepRulesError('rules_unreadable');
  }
  if (!doc || !Array.isArray(doc.rules) || doc.rules.length === 0) {
    throw new SemgrepRulesError('rules_missing');
  }
  const seen = new Set();
  return doc.rules.map((raw) => {
    if (!raw || typeof raw !== 'object') {
      throw new SemgrepRulesError('rule_not_a_mapping');
    }
    if (typeof raw.id !== 'string' || !RULE_ID_RE.test(raw.id)) {
      throw new SemgrepRulesError('rule_id_invalid');
    }
    if (seen.has(raw.id)) throw new SemgrepRulesError('rule_id_duplicate');
    seen.add(raw.id);
    if (!SEVERITIES.has(raw.severity)) {
      throw new SemgrepRulesError('rule_severity_invalid');
    }
    const languages = asStringList(raw.languages);
    if (
      !languages ||
      languages.length === 0 ||
      languages.some((l) => !(l in EXTENSIONS))
    ) {
      throw new SemgrepRulesError('rule_languages_invalid');
    }
    if (
      typeof raw.message !== 'string' ||
      raw.message.length < 20 ||
      raw.message.length > 700
    ) {
      throw new SemgrepRulesError('rule_message_invalid');
    }
    const cwe = raw.metadata?.cwe;
    if (typeof cwe !== 'string' || !/^CWE-\d+/.test(cwe)) {
      throw new SemgrepRulesError('rule_cwe_missing');
    }
    // the only pattern key allowed: anything else is a rule this evaluator cannot run
    const patternKeys = Object.keys(raw).filter((key) =>
      key.startsWith('pattern')
    );
    if (patternKeys.length !== 1 || patternKeys[0] !== 'pattern-regex') {
      throw new SemgrepRulesError('rule_not_pattern_regex');
    }
    const include =
      raw.paths?.include === undefined ? [] : asStringList(raw.paths.include);
    const exclude =
      raw.paths?.exclude === undefined ? [] : asStringList(raw.paths.exclude);
    if (include === null || exclude === null) {
      throw new SemgrepRulesError('rule_paths_invalid');
    }
    return {
      id: raw.id,
      severity: raw.severity,
      languages,
      message: raw.message,
      cwe,
      include,
      exclude,
      source: raw['pattern-regex'],
      regex: compileRuleRegex(raw['pattern-regex']),
    };
  });
}

/** Whether a rule reads a file: the language by extension, then `paths.include` and `paths.exclude`. */
export function ruleReadsFile(rule, path) {
  const dot = path.lastIndexOf('.');
  const extension = dot === -1 ? '' : path.slice(dot).toLowerCase();
  if (
    !rule.languages.some((language) => EXTENSIONS[language].includes(extension))
  ) {
    return false;
  }
  if (
    rule.include.length > 0 &&
    !rule.include.some((glob) => globToRegExp(glob).test(path))
  ) {
    return false;
  }
  return !rule.exclude.some((glob) => globToRegExp(glob).test(path));
}

const lineOf = (text, index) => {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (text.charCodeAt(i) === 10) line += 1;
  return line;
};

/**
 * Runs the rules over files and returns what Semgrep would report. `ignorePatterns` are the lines of
 * `.semgrepignore`. A file over one megabyte is skipped, as Semgrep skips it.
 *
 * @param {{ rules: ReturnType<typeof parseSemgrepRules>, files: { path: string, text: string }[], ignorePatterns?: string[] }} input
 */
export function runSemgrepRules({ rules, files, ignorePatterns = [] }) {
  const findings = [];
  let scanned = 0;
  for (const file of files) {
    const path = String(file.path).replace(/\\/g, '/');
    if (isIgnored(path, ignorePatterns)) continue;
    if (typeof file.text !== 'string' || file.text.length > MAX_TARGET_BYTES)
      continue;
    const applicable = rules.filter((rule) => ruleReadsFile(rule, path));
    if (applicable.length === 0) continue;
    scanned += 1;
    for (const rule of applicable) {
      rule.regex.lastIndex = 0;
      for (const match of file.text.matchAll(rule.regex)) {
        findings.push({
          ruleId: rule.id,
          severity: rule.severity,
          path,
          line: lineOf(file.text, match.index),
        });
        // a regex that can match the empty string must not loop (matchAll advances itself)
      }
    }
  }
  return { findings, scanned };
}

/** The findings as a Semgrep-shaped JSON report, so the fixture check can read either engine's output. */
export function toSemgrepReport({ findings, scanned }) {
  return {
    results: findings.map((f) => ({
      check_id: f.ruleId,
      path: f.path,
      start: { line: f.line },
      extra: { severity: f.severity },
    })),
    errors: [],
    paths: { scanned: Array.from({ length: scanned }, (_, i) => `file-${i}`) },
  };
}

/** The counts line of a local run. */
export function renderLocalLine({ rules, findings, scanned }) {
  const by = (severity) =>
    findings.filter((f) => f.severity === severity).length;
  return `semgrep_rules_local: rules=${rules.length} files_scanned=${scanned} error=${by('ERROR')} warning=${by('WARNING')} info=${by('INFO')}`;
}
