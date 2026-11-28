import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  adjustLinksForHistory,
  archiveCompletedActiveTasks,
  pruneCheckpoints,
  rotateCurrentState,
  runPrune,
  summarizeSessionBlock,
} from './prune-state.mjs';

function memAdapter(initialFiles) {
  const files = new Map(Object.entries(initialFiles));
  return {
    files,
    exists: (p) => files.has(p),
    readFile: (p) => files.get(p),
    writeFile: (p, content) => files.set(p, content),
  };
}

test('rotateCurrentState moves 3rd and 4th entries to YYYY-MM-sessions.md, adjusts links, updates index, and is idempotent', () => {
  const current = [
    '# Active session state',
    '',
    '## Latest sessions (verbatim)',
    '',
    '<!-- session 2026-11-24 s4 -->',
    '> **Session 4: newest**',
    '',
    '<!-- session 2026-11-23 s3 -->',
    '> **Session 3: keep**',
    '',
    '<!-- session 2026-11-20 s2 -->',
    '> **Session 2: [waiting](./waiting-on.md) and [arch](../architecture/infrastructure.md)**',
    '',
    '<!-- session 2026-10-31 s1 -->',
    '> **Session 1: October work**',
    '',
  ].join('\n');

  const novHistory = [
    '---',
    'type: Concept/SessionHistory',
    'status: archived',
    '---',
    '',
    '# Session history — November 2026',
    '',
    'Back to [history index](./index.md).',
    '',
    '<!-- session 2026-11-10 existing -->',
    '> **Existing Nov entry**',
    '',
  ].join('\n');

  const indexMd = [
    '# Session history index',
    '',
    '## November 2026 — [2026-11-sessions.md](./2026-11-sessions.md)',
    '',
    '| Orig. lines | Entry |',
    '| ----------- | ----- |',
    '| — | Existing Nov entry |',
    '',
  ].join('\n');

  const adapter = memAdapter({
    '.claude/state/current-state.md': current,
    '.claude/state/history/2026-11-sessions.md': novHistory,
    '.claude/state/history/index.md': indexMd,
  });

  const res1 = rotateCurrentState(adapter, 2);
  assert.equal(res1.rotated.length, 2);

  const csAfter = adapter.readFile('.claude/state/current-state.md');
  assert.ok(csAfter.includes('<!-- session 2026-11-24 s4 -->'));
  assert.ok(csAfter.includes('<!-- session 2026-11-23 s3 -->'));
  assert.ok(!csAfter.includes('<!-- session 2026-11-20 s2 -->'));
  assert.ok(!csAfter.includes('<!-- session 2026-10-31 s1 -->'));

  const novAfter = adapter.readFile(
    '.claude/state/history/2026-11-sessions.md'
  );
  assert.ok(novAfter.includes('[waiting](../waiting-on.md)'));
  assert.ok(novAfter.includes('[arch](../../architecture/infrastructure.md)'));
  assert.ok(novAfter.indexOf('s2') < novAfter.indexOf('existing'));

  const octAfter = adapter.readFile(
    '.claude/state/history/2026-10-sessions.md'
  );
  assert.ok(octAfter.includes('<!-- session 2026-10-31 s1 -->'));

  const idxAfter = adapter.readFile('.claude/state/history/index.md');
  assert.ok(idxAfter.includes('## October 2026 — [2026-10-sessions.md]'));
  assert.ok(idxAfter.includes('Session 2'));

  // Idempotent on second run
  const res2 = rotateCurrentState(adapter, 2);
  assert.equal(res2.rotated.length, 0);
});

test('archiveCompletedActiveTasks extracts - [x] with indented lines and keeps - [ ] open items', () => {
  const padding = 'x'.repeat(8100);
  const active = [
    '# Active tasks',
    '',
    '- [x] Completed task 1',
    '  continuation detail line',
    '- [ ] Open task A',
    `  detail ${padding}`,
    '- [x] Completed task 2',
    '- [ ] Open task B',
    '',
  ].join('\n');

  const adapter = memAdapter({ '.claude/state/active-tasks.md': active });
  const res = archiveCompletedActiveTasks(adapter, {
    thresholdBytes: 8000,
    todayIso: '2026-11-25',
  });

  assert.equal(res.archivedCount, 2);
  assert.equal(
    res.target,
    '.claude/state/checkpoints/completed-tasks-2026-11.md'
  );

  const remaining = adapter.readFile('.claude/state/active-tasks.md');
  assert.ok(!remaining.includes('Completed task 1'));
  assert.ok(!remaining.includes('continuation detail line'));
  assert.ok(!remaining.includes('Completed task 2'));
  assert.ok(remaining.includes('- [ ] Open task A'));
  assert.ok(remaining.includes('- [ ] Open task B'));

  const archived = adapter.readFile(res.target);
  assert.ok(archived.includes('## Archived on 2026-11-25'));
  assert.ok(
    archived.includes(
      '- [x] Completed task 1\n  continuation detail line'.replace(
        /\n/g,
        '\r\n'
      )
    )
  );
  assert.ok(archived.includes('- [x] Completed task 2'));
});

test('runPrune --dry-run modifies zero files on disk while reporting actions', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prune-dry-'));
  try {
    fs.mkdirSync(path.join(tmp, '.claude/state/history'), { recursive: true });
    const csPath = path.join(tmp, '.claude/state/current-state.md');
    const originalCs = [
      '## Latest sessions (verbatim)',
      '',
      '<!-- session 2026-11-25 s3 -->',
      '> **Three**',
      '',
      '<!-- session 2026-11-24 s2 -->',
      '> **Two**',
      '',
      '<!-- session 2026-11-23 s1 -->',
      '> **One**',
      '',
    ].join('\n');
    fs.writeFileSync(csPath, originalCs, 'utf8');

    const res = runPrune(tmp, { apply: false });
    assert.equal(res.mode, 'dry-run');
    assert.equal(res.rotated.length, 1);
    assert.equal(fs.readFileSync(csPath, 'utf8'), originalCs);
    assert.equal(
      fs.existsSync(
        path.join(tmp, '.claude/state/history/2026-11-sessions.md')
      ),
      false
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('pruneCheckpoints keeps 10 newest dated snapshots, removes >14d completed, preserves open & archives', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prune-cp-'));
  try {
    const cpDir = path.join(tmp, '.claude/state/checkpoints');
    fs.mkdirSync(cpDir, { recursive: true });

    const baseNow = Date.now();
    for (let i = 1; i <= 12; i += 1) {
      const fp = path.join(
        cpDir,
        `2026-11-${String(i).padStart(2, '0')}-1000-snap.md`
      );
      fs.writeFileSync(fp, '# snap\n', 'utf8');
      const t = new Date(baseNow - (20 - i) * 3600 * 1000);
      fs.utimesSync(fp, t, t);
    }

    const oldCompleted = path.join(cpDir, 'emergency-checkpoint.md');
    fs.writeFileSync(oldCompleted, '---\nstatus: completed\n---\n', 'utf8');
    const oldTime = new Date(baseNow - 20 * 24 * 60 * 60 * 1000);
    fs.utimesSync(oldCompleted, oldTime, oldTime);

    const oldOpen = path.join(cpDir, 'latest.md');
    fs.writeFileSync(oldOpen, '---\nstatus: open\n---\n', 'utf8');
    fs.utimesSync(oldOpen, oldTime, oldTime);

    const archiveFile = path.join(cpDir, 'archive-active-tasks-2026-11-25.md');
    fs.writeFileSync(archiveFile, '---\nstatus: completed\n---\n', 'utf8');
    fs.utimesSync(archiveFile, oldTime, oldTime);

    const res = pruneCheckpoints(tmp, { apply: true, nowMs: baseNow });
    assert.equal(res.removed.length, 3); // 2 excess dated + 1 expired completed
    assert.equal(fs.existsSync(oldCompleted), false);
    assert.equal(fs.existsSync(oldOpen), true);
    assert.equal(fs.existsSync(archiveFile), true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('summarizeSessionBlock joins multi-line wrapped blockquote paragraph and stops before metadata bullets', () => {
  const block = [
    '<!-- session 2026-11-25 wrap-test -->',
    '> **Session 2026-11-25 (wrap-test):** First wrapped line that continues',
    '> cleanly onto a second quoted line and finishes the summary sentence.',
    '> **Needs from Davin:** Should not be pulled into the headline.',
  ].join('\n');
  const row = summarizeSessionBlock(block, '2026-11-25', 'wrap-test');
  assert.ok(row.includes('finishes the summary sentence.'));
  assert.ok(!row.includes('Should not be pulled into the headline'));
});

test('adjustLinksForHistory rewrites bare, dot-slash, and parent relative links cleanly', () => {
  const input = [
    '[Bare](waiting-on.md)',
    '[Dot](history/2026-10-sessions.md)',
    '[DotHist](./history/2026-09-sessions.md)',
    '[Up](../architecture/infrastructure.md)',
    '[Ext](https://example.com)',
    '[Frag](#anchor)',
  ].join(' ');
  const out = adjustLinksForHistory(input);
  assert.ok(out.includes('[Bare](../waiting-on.md)'));
  assert.ok(out.includes('[Dot](./2026-10-sessions.md)'));
  assert.ok(out.includes('[DotHist](./2026-09-sessions.md)'));
  assert.ok(out.includes('[Up](../../architecture/infrastructure.md)'));
  assert.ok(out.includes('[Ext](https://example.com)'));
  assert.ok(out.includes('[Frag](#anchor)'));
});

test('rotateCurrentState ignores session markers inside fenced code blocks', () => {
  const current = [
    '## Latest sessions (verbatim)',
    '',
    '<!-- session 2026-11-25 s2 -->',
    '> **Session 2 with code example**',
    '```markdown',
    '<!-- session 2026-01-01 fake-example -->',
    '> pretend entry',
    '```',
    '',
    '<!-- session 2026-11-24 s1 -->',
    '> **Session 1 real**',
    '',
  ].join('\n');

  const adapter = memAdapter({ '.claude/state/current-state.md': current });
  const res = rotateCurrentState(adapter, 2);
  assert.equal(res.rotated.length, 0);
});
