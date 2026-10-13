/**
 * The dispatch matrix (architecture 4.5, ADR-036, plan decisions D2 and D10).
 *
 * "Rules first": which sensors a question needs in full is DATA, not code. The matrix is
 * `config/intake/dispatch-matrix.v1.json` (contract `dispatch-matrix/1`, version
 * `routing-v1`), read strictly at load like the roster and the glossary: a matrix that is
 * wrong would route every request wrongly, so a bad file stops the module. Davin approves
 * its cells; `scripts/intake/matrix_tool.py` writes the tables he reads and holds his
 * approval.
 *
 * One row per intent (all ten: the eight of ADR-037 and the two instant labels):
 *  - `always`: the request carries the ALWAYS set, the trader type's primary sensor and every
 *    warning sensor (ADR-041). False only where no reading is given at all (Report 2 and
 *    Out of scope, D2 a and g);
 *  - `extra`: how the sensors beyond ALWAYS are chosen (the selectors below);
 *  - `domains` and `playbooks`: the knowledge the retrieval looks in (4.7). The playbooks of
 *    domain D2 are scoped to the sensors in M* (finding F6 a), so `playbooks` says
 *    `M_STAR` or `NONE`; the other domains are listed in the order of D11 (d).
 *
 * A selector names a way of choosing; the choosing itself is in `router.ts`.
 *
 * @module lib/intake/matrix
 */

import matrixFile from '@/config/intake/dispatch-matrix.v1.json';

import {
  Issues,
  exactObject,
  join,
  list,
  oneOf,
  text,
  type Issue,
} from './check';
import { INTENTS, type Intent } from './intents';
import { KNOWLEDGE_DOMAINS, type KnowledgeDomain } from './packet';
import { ROUTING_VERSION } from './version';

export const DISPATCH_MATRIX_SCHEMA = 'dispatch-matrix/1';

/**
 * How the sensors beyond ALWAYS are chosen:
 *  - NONE: no extra sensor;
 *  - ZONE_SOURCES: the sensors that supplied the entry zones of the trader's reading;
 *  - TARGET_SIDE_LEVELS: the sensors with a level beyond the entry on the target side;
 *  - TERM_OWNERS: the sensors that own the glossary terms the question names;
 *  - TIMEFRAME_CHANNEL: the sensors that read the channel of the timeframe in question.
 */
export const EXTRA_SELECTORS = [
  'NONE',
  'ZONE_SOURCES',
  'TARGET_SIDE_LEVELS',
  'TERM_OWNERS',
  'TIMEFRAME_CHANNEL',
] as const;
export type ExtraSelector = (typeof EXTRA_SELECTORS)[number];

export const PLAYBOOK_SCOPES = ['M_STAR', 'NONE'] as const;
export type PlaybookScope = (typeof PLAYBOOK_SCOPES)[number];

export interface MatrixRow {
  always: boolean;
  extra: ExtraSelector;
  /** the knowledge domains besides the D2 playbooks, in the order of D11 (d) */
  domains: KnowledgeDomain[];
  playbooks: PlaybookScope;
  note: string;
}

export interface Matrix {
  schema: typeof DISPATCH_MATRIX_SCHEMA;
  version: string;
  intents: Record<Intent, MatrixRow>;
}

export type MatrixParse =
  | { ok: true; matrix: Matrix }
  | { ok: false; issues: Issue[] };

const VERSION_TEXT = /^[a-z0-9][a-z0-9._-]{0,39}$/;
export const NOTE_MAX_CHARS = 240;

function checkRow(
  value: unknown,
  path: string,
  intent: Intent,
  issues: Issues
): void {
  const row = exactObject(
    value,
    path,
    ['always', 'extra', 'domains', 'playbooks', 'note'],
    issues
  );
  if (row === undefined) return;
  if (typeof row['always'] !== 'boolean') {
    issues.add(join(path, 'always'), 'WRONG_TYPE', 'must be true or false');
  }
  const extra = oneOf(
    row['extra'],
    join(path, 'extra'),
    EXTRA_SELECTORS,
    issues
  );
  const playbooks = oneOf(
    row['playbooks'],
    join(path, 'playbooks'),
    PLAYBOOK_SCOPES,
    issues
  );
  text(row['note'], join(path, 'note'), issues, { max: NOTE_MAX_CHARS });

  const domainsPath = join(path, 'domains');
  const domains = list(row['domains'], domainsPath, issues, {
    max: KNOWLEDGE_DOMAINS.length,
  });
  const seen: KnowledgeDomain[] = [];
  domains?.forEach((raw, index) => {
    const found = oneOf(
      raw,
      `${domainsPath}[${index}]`,
      KNOWLEDGE_DOMAINS,
      issues
    );
    if (found === undefined) return;
    const last = seen[seen.length - 1];
    if (seen.includes(found)) {
      issues.add(`${domainsPath}[${index}]`, 'DUPLICATE', `${found} twice`);
    } else if (
      last !== undefined &&
      KNOWLEDGE_DOMAINS.indexOf(found) < KNOWLEDGE_DOMAINS.indexOf(last)
    ) {
      issues.add(
        `${domainsPath}[${index}]`,
        'NOT_SORTED',
        'domains come in the order D1 to D5 (D11 d)'
      );
    }
    seen.push(found);
  });

  // an intent that gives no reading gives no knowledge and no extra sensor either
  const gives = intent !== 'REPORT_2' && intent !== 'OUT_OF_SCOPE';
  if (typeof row['always'] === 'boolean' && row['always'] !== gives) {
    issues.add(
      join(path, 'always'),
      'INCONSISTENT',
      gives
        ? 'only Report 2 and Out of scope go without the always set (ADR-041, D2 a)'
        : `${intent} carries no readings, so it has no always set`
    );
  }
  if (!gives) {
    if (extra !== undefined && extra !== 'NONE') {
      issues.add(
        join(path, 'extra'),
        'INCONSISTENT',
        `${intent} carries no readings, so it has no extra sensor`
      );
    }
    if (
      (domains?.length ?? 0) > 0 ||
      (playbooks !== undefined && playbooks !== 'NONE')
    ) {
      issues.add(
        path,
        'INCONSISTENT',
        `${intent} looks nothing up, so it names no knowledge`
      );
    }
  }
}

/** Read a matrix strictly: every problem with its path, never a throw. */
export function parseMatrix(raw: unknown): MatrixParse {
  const issues = new Issues();
  const record = exactObject(raw, '', ['schema', 'version', 'intents'], issues);
  if (record === undefined) return { ok: false, issues: issues.list };
  if (record['schema'] !== DISPATCH_MATRIX_SCHEMA) {
    issues.add('schema', 'NOT_ONE_OF', `must be ${DISPATCH_MATRIX_SCHEMA}`);
  }
  text(record['version'], 'version', issues, { max: 40 });
  if (
    typeof record['version'] === 'string' &&
    !VERSION_TEXT.test(record['version'])
  ) {
    issues.add('version', 'BAD_FORMAT', 'is not a version name');
  }
  const intents = exactObject(record['intents'], 'intents', INTENTS, issues);
  if (intents !== undefined) {
    for (const intent of INTENTS) {
      checkRow(intents[intent], join('intents', intent), intent, issues);
    }
  }
  return issues.any
    ? { ok: false, issues: issues.list }
    : { ok: true, matrix: record as unknown as Matrix };
}

function loadCommittedMatrix(): Matrix {
  const parsed = parseMatrix(matrixFile as unknown);
  if (!parsed.ok) {
    const first = parsed.issues
      .slice(0, 5)
      .map((issue) => `${issue.path || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(
      `config/intake/dispatch-matrix.v1.json is not a valid matrix (${first})`
    );
  }
  if (parsed.matrix.version !== ROUTING_VERSION) {
    throw new Error(
      `config/intake/dispatch-matrix.v1.json is version ${parsed.matrix.version}; the code names ${ROUTING_VERSION}`
    );
  }
  return parsed.matrix;
}

/** The committed matrix, parsed once. Its version is `ROUTING_VERSION`. */
export const DISPATCH_MATRIX: Matrix = loadCommittedMatrix();

export function matrixRow(
  intent: Intent,
  matrix: Matrix = DISPATCH_MATRIX
): MatrixRow {
  return matrix.intents[intent];
}
