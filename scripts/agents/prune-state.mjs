#!/usr/bin/env node
/**
 * Safe, zero-data-loss mechanical state drainer for repo operating files.
 * - Rotates 3rd+ `<!-- session ... -->` entries from `.claude/state/current-state.md`
 *   verbatim into `.claude/state/history/YYYY-MM-sessions.md` + `history/index.md`.
 * - Archives completed `- [x]` checklist items from `.claude/state/active-tasks.md`
 *   (when > threshold) into `.claude/state/checkpoints/completed-tasks-YYYY-MM.md`.
 * - Prunes >10 dated checkpoints and >14-day `status: completed` ephemeral checkpoints.
 *
 * Defaults to --dry-run. Pass --apply to persist changes.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULTS = Object.freeze({
  maxSessions: 2,
  activeTasksThresholdBytes: 8000,
  checkpointMaxDated: 10,
  completedCheckpointDays: 14,
});

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const SESSION_MARKER_RE =
  /^<!--\s*session\s+(\d{4}-\d{2}-\d{2})\s+([^\s>]+)\s*-->$/;

function toCrlf(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
}

export function adjustLinksForHistory(block) {
  // Block moves from .claude/state/ to .claude/state/history/ (one directory deeper).
  return block.replace(/\]\(([^)]+)\)/g, (full, target) => {
    if (/^(?:https?:\/\/|mailto:|#|\/)/i.test(target)) return full;
    if (target.startsWith('./history/')) {
      return `](./${target.slice('./history/'.length)})`;
    }
    if (target.startsWith('history/')) {
      return `](./${target.slice('history/'.length)})`;
    }
    if (target.startsWith('./')) {
      return `](../${target.slice(2)})`;
    }
    if (target.startsWith('../')) {
      return `](../${target})`;
    }
    return `](../${target})`;
  });
}

export function summarizeSessionBlock(block, dateStr, slug) {
  const lines = block.replace(/\r\n/g, '\n').split('\n');
  const firstIdx = lines.findIndex((l) => l.startsWith('> '));
  let headline = slug;
  if (firstIdx >= 0) {
    const collected = [lines[firstIdx].slice(2).trim()];
    for (let i = firstIdx + 1; i < lines.length; i += 1) {
      const l = lines[i];
      if (!l.startsWith('> ')) break;
      const trimmed = l.slice(2).trim();
      if (!trimmed) break;
      if (/^[-*]\s/.test(trimmed)) break;
      if (
        /^\*\*(?:Needs from|Changed|Verified|Next|Blockers|Files)/i.test(
          trimmed
        )
      ) {
        break;
      }
      collected.push(trimmed);
    }
    headline = collected.join(' ').replace(/\*\*/g, '').trim();
  }
  const colonIdx = headline.indexOf(':');
  if (colonIdx > 0 && colonIdx < 80) {
    const prefix = headline.slice(0, colonIdx);
    const rest = headline.slice(colonIdx + 1).trim();
    headline = `${prefix} — ${rest}`;
  }
  headline = headline.replace(/\s+/g, ' ').replace(/\|/g, '/');
  if (headline.length > 200) {
    headline = headline.slice(0, 197).trimEnd() + '...';
  }
  return `| — | ${headline || `Session ${dateStr} (${slug})`} |`;
}

function createMonthHistoryContent(yyyyMm) {
  const [year, monthStr] = yyyyMm.split('-');
  const monthIdx = Number(monthStr) - 1;
  const monthName = MONTH_NAMES[monthIdx] ?? yyyyMm;
  const lastDay = new Date(Date.UTC(Number(year), monthIdx + 1, 0))
    .getUTCDate()
    .toString()
    .padStart(2, '0');
  return [
    '---',
    'type: Concept/SessionHistory',
    'status: archived',
    `period: ${yyyyMm}-01..${yyyyMm}-${lastDay}`,
    'source: .claude/state/current-state.md (rotated entries)',
    `tags: [history, sessions, ${yyyyMm}]`,
    '---',
    '',
    `# Session history — ${monthName} ${year}`,
    '',
    'Entries rotated out of `current-state.md` by [session-lifecycle](../../protocols/session-lifecycle.md), verbatim, newest first.',
    '',
    'Back to [history index](./index.md).',
    '',
  ].join('\n');
}

function insertIntoMonthHistory(
  existingContent,
  yyyyMm,
  adjustedBlock,
  markerLine
) {
  const base = existingContent
    ? existingContent.replace(/\r\n/g, '\n')
    : createMonthHistoryContent(yyyyMm);

  if (base.includes(markerLine)) {
    return { content: base, inserted: false };
  }

  const anchor = 'Back to [history index](./index.md).';
  const anchorIdx = base.indexOf(anchor);
  if (anchorIdx >= 0) {
    const insertAt = anchorIdx + anchor.length;
    const before = base.slice(0, insertAt).replace(/\n*$/, '');
    const after = base.slice(insertAt).replace(/^\n*/, '');
    const combined = after
      ? `${before}\n\n${adjustedBlock}\n\n${after}`
      : `${before}\n\n${adjustedBlock}\n`;
    return { content: combined, inserted: true };
  }

  const firstSession = base.search(/^<!--\s*session\s+/m);
  if (firstSession >= 0) {
    const before = base.slice(0, firstSession).replace(/\n*$/, '');
    const after = base.slice(firstSession).replace(/^\n*/, '');
    return {
      content: `${before}\n\n${adjustedBlock}\n\n${after}`,
      inserted: true,
    };
  }

  return {
    content: `${base.trimEnd()}\n\n${adjustedBlock}\n`,
    inserted: true,
  };
}

function updateHistoryIndex(indexContent, yyyyMm, rowLine) {
  const norm = indexContent.replace(/\r\n/g, '\n');
  if (norm.includes(rowLine)) return { content: norm, updated: false };

  const [year, monthStr] = yyyyMm.split('-');
  const monthIdx = Number(monthStr) - 1;
  const monthName = MONTH_NAMES[monthIdx] ?? yyyyMm;
  const sectionHeader = `## ${monthName} ${year} — [`;
  const secIdx = norm.indexOf(sectionHeader);

  if (secIdx >= 0) {
    const afterSec = norm.slice(secIdx);
    const sepMatch = afterSec.match(/\n\|[\s-|]+\|\n/);
    if (sepMatch && sepMatch.index !== undefined) {
      const insertPos = secIdx + sepMatch.index + sepMatch[0].length;
      const updated = `${norm.slice(0, insertPos)}${rowLine}\n${norm.slice(insertPos)}`;
      return { content: updated, updated: true };
    }
  }

  // Create new month section before first "## <Month>" heading
  const newSection = [
    `## ${monthName} ${year} — [${yyyyMm}-sessions.md](./${yyyyMm}-sessions.md)`,
    '',
    '| Orig. lines | Entry |',
    '| ----------- | ----- |',
    rowLine,
    '',
  ].join('\n');

  const firstMonthMatch = norm.match(/\n## [A-Z][a-z]+ \d{4}/);
  if (firstMonthMatch && firstMonthMatch.index !== undefined) {
    const pos = firstMonthMatch.index + 1;
    return {
      content: `${norm.slice(0, pos)}${newSection}\n${norm.slice(pos)}`,
      updated: true,
    };
  }

  return { content: `${norm.trimEnd()}\n\n${newSection}`, updated: true };
}

export function rotateCurrentState(
  { readFile, writeFile, exists },
  maxSessions = DEFAULTS.maxSessions
) {
  const csPath = '.claude/state/current-state.md';
  if (!exists(csPath)) return { rotated: [], skipped: [] };

  const raw = readFile(csPath);
  const norm = raw.replace(/\r\n/g, '\n');
  const heading = '## Latest sessions (verbatim)';
  const hIdx = norm.indexOf(heading);
  if (hIdx < 0) return { rotated: [], skipped: [] };

  const bodyStart = hIdx + heading.length;
  const prefix = norm.slice(0, bodyStart);
  const tailLines = norm.slice(bodyStart).split('\n');

  const blocks = [];
  let cur = null;
  let fence = null;
  for (const line of tailLines) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fence) {
      const closing = line.match(/^ {0,3}(`+|~+)\s*$/);
      if (
        closing &&
        closing[1][0] === fence.char &&
        closing[1].length >= fence.len
      ) {
        fence = null;
      }
      if (cur) cur.lines.push(line);
      continue;
    }
    if (marker) {
      fence = { char: marker[1][0], len: marker[1].length };
      if (cur) cur.lines.push(line);
      continue;
    }

    const m = line.trim().match(SESSION_MARKER_RE);
    if (m) {
      if (cur) blocks.push(cur);
      cur = { date: m[1], slug: m[2], marker: line.trim(), lines: [line] };
    } else if (cur) {
      cur.lines.push(line);
    }
  }
  if (cur) blocks.push(cur);

  if (blocks.length <= maxSessions) {
    return { rotated: [], skipped: [] };
  }

  const kept = blocks.slice(0, maxSessions);
  const overflow = blocks.slice(maxSessions);
  const rotated = [];
  const skipped = [];

  // Process oldest-to-newest so newer overflow entries land above older ones
  for (const entry of [...overflow].reverse()) {
    const rawBlock = entry.lines.join('\n').trim();
    const yyyyMm = entry.date.slice(0, 7);
    const histPath = `.claude/state/history/${yyyyMm}-sessions.md`;
    const existingHist = exists(histPath) ? readFile(histPath) : '';
    const adjusted = adjustLinksForHistory(rawBlock);
    const { content: newHist, inserted } = insertIntoMonthHistory(
      existingHist,
      yyyyMm,
      adjusted,
      entry.marker
    );
    if (inserted) {
      writeFile(histPath, toCrlf(newHist));
      const idxPath = '.claude/state/history/index.md';
      if (exists(idxPath)) {
        const row = summarizeSessionBlock(rawBlock, entry.date, entry.slug);
        const { content: newIdx, updated } = updateHistoryIndex(
          readFile(idxPath),
          yyyyMm,
          row
        );
        if (updated) writeFile(idxPath, toCrlf(newIdx));
      }
      rotated.push({ date: entry.date, slug: entry.slug, target: histPath });
    } else {
      skipped.push({
        date: entry.date,
        slug: entry.slug,
        reason: 'already-in-history',
      });
    }
  }

  const keptBody = kept.map((b) => b.lines.join('\n').trim()).join('\n\n');
  const nextCurrent = `${prefix.replace(/\n*$/, '')}\n\n${keptBody}\n`;
  writeFile(csPath, toCrlf(nextCurrent));

  return { rotated, skipped };
}

export function archiveCompletedActiveTasks(
  { readFile, writeFile, exists },
  { thresholdBytes = DEFAULTS.activeTasksThresholdBytes, todayIso } = {}
) {
  const atPath = '.claude/state/active-tasks.md';
  if (!exists(atPath)) return { archivedCount: 0, target: null };

  const raw = readFile(atPath);
  const bytes = Buffer.byteLength(raw, 'utf8');
  if (bytes <= thresholdBytes) {
    return { archivedCount: 0, target: null };
  }

  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const kept = [];
  const extracted = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^- \[x\] /i.test(line)) {
      const group = [line];
      while (i + 1 < lines.length && /^(?:  |\t)\S/.test(lines[i + 1])) {
        i += 1;
        group.push(lines[i]);
      }
      extracted.push(group.join('\n'));
    } else {
      kept.push(line);
    }
  }

  if (extracted.length === 0) {
    return { archivedCount: 0, target: null };
  }

  const dateStr = todayIso || new Date().toISOString().slice(0, 10);
  const yyyyMm = dateStr.slice(0, 7);
  const target = `.claude/state/checkpoints/completed-tasks-${yyyyMm}.md`;
  const existingArchive = exists(target)
    ? readFile(target).replace(/\r\n/g, '\n').trimEnd()
    : `# Completed tasks archive (${yyyyMm})\n\nMoved automatically from \`.claude/state/active-tasks.md\`.`;

  const addition = `\n\n## Archived on ${dateStr}\n\n${extracted.join('\n')}\n`;
  writeFile(target, toCrlf(`${existingArchive}${addition}`));

  // Collapse runs of >2 blank lines in kept active-tasks.md
  const cleaned =
    kept
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd() + '\n';
  writeFile(atPath, toCrlf(cleaned));

  return { archivedCount: extracted.length, target };
}

export function pruneCheckpoints(
  repoRoot,
  {
    apply = false,
    maxDated = DEFAULTS.checkpointMaxDated,
    completedDays = DEFAULTS.completedCheckpointDays,
    nowMs = Date.now(),
  } = {}
) {
  const cpDir = path.join(repoRoot, '.claude', 'state', 'checkpoints');
  if (!fs.existsSync(cpDir)) return { removed: [] };

  const entries = fs
    .readdirSync(cpDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md'));

  const removed = [];

  const dated = entries
    .filter((e) => /^\d{4}-\d{2}-\d{2}-\d{4}-.+\.md$/.test(e.name))
    .map((e) => {
      const fp = path.join(cpDir, e.name);
      return { name: e.name, fp, mtimeMs: fs.statSync(fp).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  for (const old of dated.slice(maxDated)) {
    if (apply) fs.unlinkSync(old.fp);
    removed.push({
      path: `.claude/state/checkpoints/${old.name}`,
      reason: 'excess-dated',
    });
  }

  const cutoffMs = nowMs - completedDays * 24 * 60 * 60 * 1000;
  for (const name of [
    'latest.md',
    'emergency-checkpoint.md',
    'pre-compact-checkpoint.md',
  ]) {
    const fp = path.join(cpDir, name);
    if (!fs.existsSync(fp)) continue;
    const st = fs.statSync(fp);
    if (st.mtimeMs >= cutoffMs) continue;
    const head = fs.readFileSync(fp, 'utf8').slice(0, 1024);
    if (/^status:\s*completed\b/m.test(head)) {
      if (apply) fs.unlinkSync(fp);
      removed.push({
        path: `.claude/state/checkpoints/${name}`,
        reason: 'completed-expired',
      });
    }
  }

  return { removed };
}

function resolveMemoryPath(repoRoot) {
  const projectsDir = path.join(os.homedir(), '.claude', 'projects');
  if (!fs.existsSync(projectsDir)) return null;
  const expectedKey = repoRoot.replace(/[:\\/ ]/g, '-').toLowerCase();
  const match = fs
    .readdirSync(projectsDir, { withFileTypes: true })
    .find((e) => e.isDirectory() && e.name.toLowerCase() === expectedKey);
  if (!match) return null;
  const memPath = path.join(projectsDir, match.name, 'memory', 'MEMORY.md');
  return fs.existsSync(memPath) ? memPath : null;
}

export function runPrune(repoRoot, options = {}) {
  const apply = Boolean(options.apply);
  const writes = new Map();

  const adapter = {
    exists: (rel) =>
      writes.has(rel) || fs.existsSync(path.resolve(repoRoot, rel)),
    readFile: (rel) =>
      writes.has(rel)
        ? writes.get(rel)
        : fs.readFileSync(path.resolve(repoRoot, rel), 'utf8'),
    writeFile: (rel, content) => {
      writes.set(rel, content);
      if (apply) {
        const full = path.resolve(repoRoot, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, content, 'utf8');
      }
    },
  };

  const stateRes = rotateCurrentState(adapter, options.maxSessions);
  const tasksRes = archiveCompletedActiveTasks(adapter, {
    thresholdBytes: options.activeTasksThresholdBytes,
    todayIso: options.todayIso,
  });
  const cpRes = pruneCheckpoints(repoRoot, {
    apply,
    maxDated: options.checkpointMaxDated,
    completedDays: options.completedCheckpointDays,
  });

  const budgets = [
    {
      label: 'CLAUDE.md',
      path: path.join(repoRoot, 'CLAUDE.md'),
      max: 4999,
      warn: 101,
    },
    {
      label: 'AGENTS.md',
      path: path.join(repoRoot, 'AGENTS.md'),
      max: 6000,
      warn: 101,
    },
    {
      label: 'GEMINI.md',
      path: path.join(repoRoot, 'GEMINI.md'),
      max: 4000,
      warn: 101,
    },
    {
      label: '.claude/state/current-state.md',
      path: path.join(repoRoot, '.claude/state/current-state.md'),
      max: 18000,
      warn: 85,
    },
    {
      label: '.claude/state/active-tasks.md',
      path: path.join(repoRoot, '.claude/state/active-tasks.md'),
      max: 12000,
      warn: 85,
    },
    {
      label: '.claude/state/waiting-on.md',
      path: path.join(repoRoot, '.claude/state/waiting-on.md'),
      max: 24000,
      warn: 85,
    },
    {
      label: '.claude/architecture/environment-gotchas.md',
      path: path.join(repoRoot, '.claude/architecture/environment-gotchas.md'),
      max: 20000,
      warn: 85,
    },
    {
      label: '.claude/architecture/database-traps.md',
      path: path.join(repoRoot, '.claude/architecture/database-traps.md'),
      max: 20000,
      warn: 85,
    },
  ];
  const mem = resolveMemoryPath(repoRoot);
  if (mem) budgets.push({ label: 'MEMORY.md', path: mem, max: 4000, warn: 85 });

  const telemetry = budgets
    .filter((b) => fs.existsSync(b.path))
    .map((b) => {
      const rel = path.relative(repoRoot, b.path).replace(/\\/g, '/');
      const raw =
        !apply && writes.has(rel)
          ? writes.get(rel)
          : fs.readFileSync(b.path, 'utf8');
      const bytes = Buffer.byteLength(raw, 'utf8');
      const pct = Math.round((bytes / b.max) * 100);
      const status = bytes > b.max ? 'OVER' : pct >= b.warn ? 'NEAR' : 'GREEN';
      return { label: b.label, bytes, max: b.max, pct, status };
    });

  return {
    mode: apply ? 'apply' : 'dry-run',
    rotated: stateRes.rotated,
    skippedRotations: stateRes.skipped,
    archivedTasks: tasksRes.archivedCount,
    archivedTasksTarget: tasksRes.target,
    removedCheckpoints: cpRes.removed,
    telemetry,
  };
}

function main() {
  const args = new Set(process.argv.slice(2));
  const apply = args.has('--apply');
  const repoRoot = path.resolve(
    fileURLToPath(new URL('../../', import.meta.url))
  );

  const parseNum = (prefix, fallback) => {
    for (const a of args) {
      if (a.startsWith(prefix)) {
        const n = Number(a.slice(prefix.length));
        if (Number.isFinite(n) && n >= 0) return n;
      }
    }
    return fallback;
  };

  const result = runPrune(repoRoot, {
    apply,
    maxSessions: parseNum('--max-sessions=', DEFAULTS.maxSessions),
    activeTasksThresholdBytes: parseNum(
      '--active-tasks-threshold=',
      DEFAULTS.activeTasksThresholdBytes
    ),
    checkpointMaxDated: parseNum(
      '--checkpoint-max=',
      DEFAULTS.checkpointMaxDated
    ),
    completedCheckpointDays: parseNum(
      '--completed-days=',
      DEFAULTS.completedCheckpointDays
    ),
  });

  console.log(`prune-state (${result.mode})`);
  console.log(
    `  sessions rotated: ${result.rotated.length}, completed tasks archived: ${result.archivedTasks}, checkpoints removed: ${result.removedCheckpoints.length}`
  );
  for (const r of result.rotated) {
    console.log(`  - rotated ${r.date} ${r.slug} -> ${r.target}`);
  }
  for (const c of result.removedCheckpoints) {
    console.log(`  - removed ${c.path} (${c.reason})`);
  }
  console.log('Telemetry:');
  for (const t of result.telemetry) {
    console.log(
      `  [${t.status.padEnd(5)}] ${t.label}: ${t.bytes}/${t.max} B (${t.pct}%)`
    );
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
