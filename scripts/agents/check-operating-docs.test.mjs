import test from 'node:test';
import assert from 'node:assert/strict';
import {
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
  pad('docs/codex/state/current-state.md', 6000);
  pad('docs/codex/protocols/verification.md', 16000);
  assert.equal(validate(files).ok, true);
  files.set('AGENTS.md', `${files.get('AGENTS.md')}\u0e01`);
  files.set('CLAUDE.md', `${files.get('CLAUDE.md')}x`);
  files.set(
    'docs/codex/state/current-state.md',
    `${files.get('docs/codex/state/current-state.md')}x`
  );
  files.set(
    'docs/codex/protocols/verification.md',
    `${files.get('docs/codex/protocols/verification.md')}x`
  );
  const errors = validate(files).errors;
  assert.equal(errors.length, 4);
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
  assert.equal(errors.length, 3);
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
