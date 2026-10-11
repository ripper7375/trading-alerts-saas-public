#!/usr/bin/env node
/** Read-only, dependency-free checks for the repository's agent operating docs. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REQUIRED_DOCUMENTS = Object.freeze([
  'AGENTS.md',
  'CLAUDE.md',
  'docs/codex/index.md',
  'docs/codex/protocols/session-lifecycle.md',
  'docs/codex/protocols/collaboration.md',
  'docs/codex/protocols/verification.md',
  'docs/codex/state/current-state.md',
  'docs/codex/templates/task.md',
  'docs/codex/templates/handoff.md',
  'docs/codex/tasks/2026-10-11-codex-collaboration-system.md',
  'docs/agent-collaboration/README.md',
  'docs/agent-collaboration/ADVISOR-PROTOCOL.md',
  'docs/agent-collaboration/LANGUAGE-POLICY.md',
  'docs/agent-collaboration/OPENING-PROMPT-TO-ANTIGRAVITY.md',
  'davintrade-claude-md-okf-management/codex/README.md',
  'davintrade-claude-md-okf-management/codex/CODEX_CLAUDE_COLLABORATION_ARCHITECTURE_DESIGN.md',
  'davintrade-claude-md-okf-management/codex/OPERATING_MANUAL.md',
  'davintrade-claude-md-okf-management/codex/PROMPT_LIBRARY.md',
  'davintrade-claude-md-okf-management/codex/ANTIGRAVITY_ADVISOR_GUIDE.md',
  'davintrade-claude-md-okf-management/codex/OPENING_PROMPT_TO_ANTIGRAVITY.md',
  'davintrade-claude-md-okf-management/codex/MAINTENANCE_AND_TROUBLESHOOTING.md',
]);

const BUDGETS = {
  'AGENTS.md': { bytes: 6000, lines: 150 },
  // CLAUDE.md must stay strictly below 5000 bytes.
  'CLAUDE.md': { bytes: 4999, lines: 150 },
  'docs/codex/state/current-state.md': { bytes: 6000, lines: 100 },
};
const SHARED_RULES = '.claude/rules/non-negotiables.md';
const SHARED_BRIDGE = 'docs/agent-collaboration/README.md';

function lineCount(content) {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines.length;
}

function withoutCode(content) {
  let fence;
  // Preserve line count and offsets so diagnostics still identify the source line.
  const result = content.replace(/[^\n]*(?:\n|$)/g, (line) => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fence) {
      const closing = line.match(/^ {0,3}(`+|~+)\s*$/);
      if (
        closing &&
        closing[1][0] === fence.character &&
        closing[1].length >= fence.length
      ) {
        fence = undefined;
      }
      return line.replace(/[^\n]/g, ' ');
    }
    if (marker) {
      fence = { character: marker[1][0], length: marker[1].length };
      return line.replace(/[^\n]/g, ' ');
    }
    return line;
  });
  return result.replace(/(`+)([^\n]*?)\1(?!`)/g, (code) =>
    code.replace(/[^\n]/g, ' ')
  );
}

function cleanDestination(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith('<')) {
    const end = trimmed.indexOf('>');
    return end < 0 ? trimmed : trimmed.slice(1, end);
  }
  return trimmed.replace(/\s+(?:"[^"]*"|'[^']*'|\([^)]*\))\s*$/, '');
}

/** Extract inline and reference-definition targets, excluding fenced/inline code. */
function markdownLinks(content) {
  const source = withoutCode(content);
  const links = [];
  let cursor = 0;
  while (cursor < source.length) {
    const closeLabel = source.indexOf('](', cursor);
    if (closeLabel < 0) break;
    cursor = closeLabel + 2;
    if (source.lastIndexOf('[', closeLabel) < 0) continue;
    const start = cursor;
    let depth = 1;
    let inAngle = false;
    let quote;
    for (; cursor < source.length; cursor += 1) {
      const character = source[cursor];
      if (character === '\\') {
        cursor += 1;
        continue;
      }
      if (quote) {
        if (character === quote) quote = undefined;
        continue;
      }
      if (
        !inAngle &&
        depth === 1 &&
        (character === '"' || character === "'") &&
        /\s/.test(source[cursor - 1] ?? '')
      ) {
        quote = character;
      } else if (character === '<') {
        inAngle = true;
      } else if (character === '>') {
        inAngle = false;
      } else if (!inAngle && character === '(') {
        depth += 1;
      } else if (!inAngle && character === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    if (depth === 0) {
      links.push({
        target: cleanDestination(source.slice(start, cursor)),
        line: source.slice(0, closeLabel).split('\n').length,
      });
    }
    cursor += 1;
  }
  const definition = /^ {0,3}\[([^\]\n]+)\]:[ \t]*(.+)$/gm;
  for (const match of source.matchAll(definition)) {
    // Footnote definitions contain prose, not link destinations.
    if (match[1].startsWith('^')) continue;
    links.push({
      target: cleanDestination(match[2]),
      line: source.slice(0, match.index).split('\n').length,
    });
  }
  return links;
}

function localTarget(documentPath, target) {
  if (!target || /^(?:#|\?|\/\/|[a-z][a-z\d+.-]*:)/i.test(target)) {
    return undefined;
  }
  const withoutFragment = target.split(/[?#]/, 1)[0];
  if (!withoutFragment) return undefined;
  const decoded = decodeURIComponent(withoutFragment)
    .replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~])/g, '$1')
    .replace(/\\/g, '/');
  const resolved = decoded.startsWith('/')
    ? path.posix.normalize(decoded.slice(1))
    : path.posix.normalize(
        path.posix.join(path.posix.dirname(documentPath), decoded)
      );
  if (resolved === '..' || resolved.startsWith('../')) {
    throw new Error('target leaves the repository');
  }
  return resolved;
}

function frontmatterErrors(content) {
  const lines = content
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n');
  if (lines[0] !== '---') return ['Missing YAML frontmatter.'];
  const end = lines.indexOf('---', 1);
  if (end < 0) return ['YAML frontmatter has no closing --- delimiter.'];
  const header = lines.slice(1, end).join('\n');
  return ['type', 'status', 'updated_at'].flatMap((key) => {
    const match = header.match(new RegExp(`^${key}:[ \\t]*([^\\n]*)$`, 'm'));
    const value = match?.[1]
      .trim()
      .replace(/(^|\s+)#.*$/, '')
      .trim();
    return !value || /^(?:null|~|""|'')$/i.test(value)
      ? [`YAML frontmatter requires a nonempty ${key}.`]
      : [];
  });
}

/**
 * Validate repository-relative documents using a supplied read-only adapter.
 * readFile(path) returns a UTF-8 string/Buffer; exists(path) returns a boolean.
 * Optional listMarkdownFiles() returns additional repository-relative docs/codex docs.
 * No filesystem reads, writes, network calls, or logging occur outside the adapter.
 */
export function validateOperatingDocs({
  readFile,
  exists,
  listMarkdownFiles = () => [],
}) {
  const errors = [];
  const documents = [];
  const addError = (documentPath, code, message, line) => {
    errors.push({
      path: documentPath,
      code,
      message,
      ...(line ? { line } : {}),
    });
  };
  let additionalDocuments = [];
  try {
    additionalDocuments = listMarkdownFiles()
      .map((entry) => entry.replace(/\\/g, '/'))
      .filter(
        (entry) => entry.startsWith('docs/codex/') && entry.endsWith('.md')
      )
      .sort();
  } catch (error) {
    addError(
      'docs/codex',
      'discovery',
      `Cannot list Markdown files: ${error.message}`
    );
  }
  const documentPaths = [
    ...new Set([...REQUIRED_DOCUMENTS, ...additionalDocuments]),
  ];
  for (const documentPath of documentPaths) {
    let content;
    try {
      if (!exists(documentPath)) {
        addError(documentPath, 'missing', 'Required document does not exist.');
        continue;
      }
      content = String(readFile(documentPath));
    } catch (error) {
      addError(documentPath, 'read', `Cannot read document: ${error.message}`);
      continue;
    }
    const bytes = Buffer.byteLength(content, 'utf8');
    const lines = lineCount(content);
    documents.push({ path: documentPath, bytes, lines });
    const budget =
      BUDGETS[documentPath] ??
      (documentPath.startsWith('docs/codex/') ? { bytes: 16000 } : undefined);
    if (budget?.bytes !== undefined && bytes > budget.bytes) {
      addError(
        documentPath,
        'byte-budget',
        `${bytes} bytes exceeds the ${budget.bytes}-byte budget.`
      );
    }
    if (budget?.lines !== undefined && lines > budget.lines) {
      addError(
        documentPath,
        'line-budget',
        `${lines} lines exceeds the ${budget.lines}-line budget.`
      );
    }
    if (documentPath.startsWith('docs/codex/')) {
      for (const message of frontmatterErrors(content)) {
        addError(documentPath, 'frontmatter', message);
      }
    }
    if (documentPath === 'AGENTS.md' && !content.includes(SHARED_RULES)) {
      addError(
        documentPath,
        'shared-rules',
        `Must explicitly reference ${SHARED_RULES}.`
      );
    }
    let hasSharedBridge = false;
    for (const link of markdownLinks(content)) {
      let resolved;
      try {
        resolved = localTarget(documentPath, link.target);
        if (resolved === undefined) continue;
        if (resolved === SHARED_BRIDGE) hasSharedBridge = true;
        if (!exists(resolved)) {
          addError(
            documentPath,
            'broken-link',
            `Local link target does not exist: ${link.target} (${resolved}).`,
            link.line
          );
        }
      } catch (error) {
        addError(
          documentPath,
          'invalid-link',
          `Cannot resolve local link ${link.target}: ${error.message}.`,
          link.line
        );
      }
    }
    if (documentPath === 'CLAUDE.md' && !hasSharedBridge) {
      addError(documentPath, 'shared-bridge', `Must link to ${SHARED_BRIDGE}.`);
    }
  }
  return { ok: errors.length === 0, errors, documents };
}

function filesystemAdapter(repositoryRoot) {
  const absolute = (relative) => path.resolve(repositoryRoot, relative);
  return {
    readFile: (relative) => fs.readFileSync(absolute(relative), 'utf8'),
    exists: (relative) => fs.existsSync(absolute(relative)),
    listMarkdownFiles() {
      const documents = [];
      function walk(directory) {
        if (!fs.existsSync(absolute(directory))) return;
        for (const entry of fs.readdirSync(absolute(directory), {
          withFileTypes: true,
        })) {
          const relative = path.posix.join(directory, entry.name);
          if (entry.isDirectory()) walk(relative);
          else if (entry.isFile() && entry.name.endsWith('.md'))
            documents.push(relative);
        }
      }
      walk('docs/codex');
      return documents;
    },
  };
}

function main() {
  const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
  const result = validateOperatingDocs(filesystemAdapter(repositoryRoot));
  if (result.ok) {
    console.log(
      `PASS: ${result.documents.length} operating documents checked (budgets, frontmatter, local links, shared rules).`
    );
    return;
  }
  console.error(`FAIL: ${result.errors.length} operating-document issue(s).`);
  for (const error of result.errors) {
    const location = `${error.path}${error.line ? `:${error.line}` : ''}`;
    console.error(`- ${location} [${error.code}] ${error.message}`);
  }
  process.exitCode = 1;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
