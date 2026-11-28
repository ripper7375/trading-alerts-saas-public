import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OPTIONAL_CLAUDE_BUDGETS,
  REQUIRED_DOCUMENTS,
  validateOperatingDocs,
} from './check-operating-docs.mjs';

const FRONTMATTER =
  '---\ntype: protocol\nstatus: active\nupdated_at: 2026-10-11\n---\n';

function fixture() {
  const files = new Map(
    REQUIRED_DOCUMENTS.map((name) => [
      name,
      name.startsWith('docs/codex/')
        ? `${FRONTMATTER}# Operating document\n`
        : '# Operating document\n',
    ])
  );
  files.set('AGENTS.md', '# Codex\nRead `.claude/rules/non-negotiables.md`.\n');
  files.set(
    'CLAUDE.md',
    '# Claude\n[Shared workflow](docs/agent-collaboration/README.md).\n'
  );
  files.set(
    'GEMINI.md',
    '# Antigravity\nRead `.claude/rules/non-negotiables.md` and [Advisor protocol](docs/agent-collaboration/ADVISOR-PROTOCOL.md).\n'
  );
  files.set('.claude/rules/non-negotiables.md', '# Shared rules\n');
  return files;
}

function adapter(files) {
  return {
    exists: (name) => files.has(name),
    readFile: (name) => files.get(name),
    listMarkdownFiles: () =>
      [...files.keys()].filter((name) => name.startsWith('docs/codex/')),
  };
}

function validate(files, overrides = {}) {
  return validateOperatingDocs({ ...adapter(files), ...overrides });
}

test('validates required docs and additional Codex Markdown with no mutations', () => {
  const files = fixture();
  files.set(
    'docs/codex/protocols/extra.md',
    `${FRONTMATTER}# Extra protocol\n`
  );
  const before = [...files.entries()];
  const result = validate(files);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.documents.length, REQUIRED_DOCUMENTS.length + 1);
  assert.deepEqual([...files.entries()], before);
});

test('reports missing, unreadable, and undiscoverable docs without aborting other checks', () => {
  const files = fixture();
  files.delete('docs/codex/templates/task.md');
  const result = validate(files, {
    readFile(name) {
      if (name === 'docs/codex/index.md') throw new Error('access denied');
      return files.get(name);
    },
    listMarkdownFiles() {
      throw new Error('directory unavailable');
    },
  });
  assert.equal(result.ok, false);
  assert.deepEqual(
    result.errors.map((error) => error.code),
    ['discovery', 'read', 'missing']
  );
  assert.ok(result.documents.some((document) => document.path === 'CLAUDE.md'));
});

test('enforces exact byte boundaries, counts UTF-8 bytes, and uses the state-specific budget', () => {
  const files = fixture();
  function pad(name, bytes) {
    files.set(
      name,
      files.get(name) + 'x'.repeat(bytes - Buffer.byteLength(files.get(name)))
    );
  }
  pad('AGENTS.md', 6000);
  pad('CLAUDE.md', 4999);
  pad('GEMINI.md', 4000);
  pad('docs/codex/state/current-state.md', 6000);
  pad('docs/codex/protocols/verification.md', 16000);
  assert.equal(validate(files).ok, true);
  files.set('AGENTS.md', `${files.get('AGENTS.md')}\u0e01`);
  files.set('CLAUDE.md', `${files.get('CLAUDE.md')}x`);
  files.set('GEMINI.md', `${files.get('GEMINI.md')}x`);
  files.set(
    'docs/codex/state/current-state.md',
    `${files.get('docs/codex/state/current-state.md')}x`
  );
  files.set(
    'docs/codex/protocols/verification.md',
    `${files.get('docs/codex/protocols/verification.md')}x`
  );
  const errors = validate(files).errors;
  assert.equal(errors.length, 5);
  assert.ok(errors.every((error) => error.code === 'byte-budget'));
  assert.ok(
    errors
      .find((error) => error.path === 'AGENTS.md')
      .message.startsWith('6003 bytes')
  );
});

test('line budgets accept their boundary, CRLF, and a final newline', () => {
  const files = fixture();
  const budgets = new Map([
    ['AGENTS.md', 150],
    ['CLAUDE.md', 150],
    ['GEMINI.md', 120],
    ['docs/codex/state/current-state.md', 100],
  ]);
  for (const [name, maxLines] of budgets) {
    const existingLines = files.get(name).trimEnd().split('\n').length;
    files.set(
      name,
      (files.get(name) + 'x\n'.repeat(maxLines - existingLines)).replace(
        /\n/g,
        '\r\n'
      )
    );
  }
  assert.equal(validate(files).ok, true);
  for (const name of budgets.keys()) files.set(name, files.get(name) + 'x\r\n');
  const errors = validate(files).errors;
  assert.equal(errors.length, 4);
  assert.ok(errors.every((error) => error.code === 'line-budget'));
});

test('resolves spaces, encoding, fragments, titles, parentheses, root paths, and references', () => {
  const files = fixture();
  files.set('docs/agent-collaboration/space file.md', '# Space\n');
  files.set('docs/agent-collaboration/part(1).md', '# Parentheses\n');
  files.set(
    'docs/agent-collaboration/README.md',
    [
      '[Angle](<space file.md#section>)',
      '[Encoded](space%20file.md#section "A title (with parentheses)")',
      '[Bare spaces](space file.md)',
      '[Parentheses](part(1).md)',
      '[Root](/AGENTS.md#section)',
      '[Reference][one]',
      '[one]: <space file.md> "Title"',
    ].join('\n')
  );
  assert.equal(validate(files).ok, true);
  files.delete('docs/agent-collaboration/space file.md');
  const errors = validate(files).errors;
  assert.equal(errors.length, 4);
  assert.ok(errors.every((error) => error.code === 'broken-link'));
  assert.deepEqual(
    errors.map((error) => error.line),
    [1, 2, 3, 7]
  );
});

test('ignores fenced code, inline code, external URLs, anchors, and footnote prose', () => {
  const files = fixture();
  files.set(
    'docs/agent-collaboration/README.md',
    [
      '````markdown',
      '[Example](missing-a.md)',
      '```',
      '[Still fenced](missing-b.md)',
      '````',
      '~~~md',
      '[Example](missing-c.md)',
      '~~~~',
      '`[Example](missing-d.md)`',
      '[Site](https://example.com/page)',
      '[Mail](mailto:owner@example.com)',
      '[Network](//example.com/page)',
      '[Anchor](#section)',
      '[Query](?tab=one)',
      '[^note]: explanatory prose, not a link destination.',
    ].join('\n')
  );
  assert.equal(validate(files).ok, true);
});

test('requires closed frontmatter and each nonempty metadata key on Codex docs only', () => {
  const files = fixture();
  files.set('docs/codex/index.md', '# No metadata\n');
  files.set(
    'docs/codex/protocols/collaboration.md',
    '---\ntype: protocol\nstatus: active\n'
  );
  files.set(
    'docs/codex/templates/task.md',
    '---\ntype: ""\nstatus: null\nupdated_at: # pending\n---\n'
  );
  const errors = validate(files).errors;
  assert.equal(errors.length, 5);
  assert.ok(errors.every((error) => error.code === 'frontmatter'));
  assert.ok(errors.some((error) => error.message.includes('closing')));
  assert.ok(errors.some((error) => error.message.includes('updated_at')));
});

test('requires shared rules and an actual bridge link, and diagnoses invalid local paths', () => {
  const files = fixture();
  files.set('AGENTS.md', '# Codex\n');
  files.set(
    'CLAUDE.md',
    'Mention docs/agent-collaboration/README.md in prose.\n'
  );
  files.set(
    'docs/agent-collaboration/README.md',
    [
      '[Bad encoding](bad%ZZ.md)',
      '[Escape](../../../outside.md)',
      '[Missing](missing.md#section)',
    ].join('\n')
  );
  const errors = validate(files).errors;
  assert.deepEqual(
    errors.map((error) => error.code),
    [
      'shared-rules',
      'shared-bridge',
      'invalid-link',
      'invalid-link',
      'broken-link',
    ]
  );
  assert.equal(errors.at(-1).line, 3);
});

test('enforces optional .claude state and architecture byte budgets when present', () => {
  const files = fixture();
  for (const [docPath, budget] of Object.entries(OPTIONAL_CLAUDE_BUDGETS)) {
    files.set(docPath, 'x'.repeat(budget.bytes));
  }
  // Keep line-length under 1500 by wrapping into 1000-char lines
  for (const [docPath, budget] of Object.entries(OPTIONAL_CLAUDE_BUDGETS)) {
    const chunk = `${'a'.repeat(999)}\n`;
    const repeatCount = Math.floor(budget.bytes / 1000);
    const rem = budget.bytes - repeatCount * 1000;
    files.set(docPath, chunk.repeat(repeatCount) + 'b'.repeat(rem));
  }
  assert.equal(validate(files).ok, true);

  for (const docPath of Object.keys(OPTIONAL_CLAUDE_BUDGETS)) {
    files.set(docPath, `${files.get(docPath)}z`);
  }
  const errors = validate(files).errors;
  assert.equal(errors.length, Object.keys(OPTIONAL_CLAUDE_BUDGETS).length);
  assert.ok(errors.every((error) => error.code === 'byte-budget'));
});

test('enforces maxLineChars on optional .claude state and architecture docs', () => {
  const files = fixture();
  files.set('.claude/state/waiting-on.md', `${'x'.repeat(1500)}\n`);
  assert.equal(validate(files).ok, true);
  files.set('.claude/state/waiting-on.md', `ok\n${'x'.repeat(1501)}\n`);
  const errors = validate(files).errors;
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, 'line-length');
  assert.equal(errors[0].line, 2);
});

test('enforces maxSessions on .claude/state/current-state.md when present', () => {
  const files = fixture();
  files.set(
    '.claude/state/current-state.md',
    '<!-- session 2026-11-24 b -->\n> ok\n<!-- session 2026-11-23 a -->\n> ok\n'
  );
  assert.equal(validate(files).ok, true);

  files.set(
    '.claude/state/current-state.md',
    '<!-- session 2026-11-25 c -->\n> ok\n' +
      files.get('.claude/state/current-state.md')
  );
  const errors = validate(files).errors;
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, 'session-count');
});

test('trackedOnly skips gitignored active-tasks.md while still enforcing tracked state budgets', () => {
  const files = fixture();
  files.set('.claude/state/active-tasks.md', 'x\n'.repeat(7000)); // > 12,000 B
  files.set(
    '.claude/state/current-state.md',
    '<!-- session 2026-11-25 s1 -->\n> ok\n'
  );

  // Default mode catches oversized gitignored active-tasks.md
  const defaultRes = validate(files);
  assert.equal(defaultRes.ok, false);
  assert.equal(defaultRes.errors[0].path, '.claude/state/active-tasks.md');

  // trackedOnly skips gitignored active-tasks.md
  const trackedRes = validate(files, { trackedOnly: true });
  assert.equal(trackedRes.ok, true);

  // trackedOnly still catches oversized tracked current-state.md
  files.set('.claude/state/current-state.md', 'x\n'.repeat(10000));
  const trackedFail = validate(files, { trackedOnly: true });
  assert.equal(trackedFail.ok, false);
  assert.equal(trackedFail.errors[0].path, '.claude/state/current-state.md');
});

test('requires shared rules and advisor-protocol link on GEMINI.md', () => {
  const files = fixture();
  files.set(
    'GEMINI.md',
    '# Antigravity\nMention docs/agent-collaboration/ADVISOR-PROTOCOL.md without linking.\n'
  );
  const errors = validate(files).errors;
  assert.deepEqual(
    errors.map((error) => error.code),
    ['shared-rules', 'advisor-protocol']
  );
});
