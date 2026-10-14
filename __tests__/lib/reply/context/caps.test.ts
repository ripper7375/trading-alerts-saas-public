/**
 * @jest-environment node
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  CAPS_SCHEMA,
  CONTEXT_CAPS,
  RANK_WHEN_OVER,
  SEGMENT_IDS,
  WHEN_OVER,
  capOf,
  capsProblems,
  parseCaps,
} from '@/lib/reply/context/caps';
import { SEGMENT_COMPONENTS } from '@/lib/reply/context/segments';
import { CONTEXT_COMPONENTS } from '@/lib/reply/contracts/trace-fields';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
type Any = any;

/** The caps of architecture 5.4, typed in once more by hand: if either side moves, a test fails. */
const DOCUMENT = {
  SYSTEM_RULES: { cap: 1500, rank: null },
  BOARD_SYNTHESIS: { cap: 800, rank: null },
  OHLC: { cap: 8000, rank: 3 },
  CHART: { cap: 1500, rank: null },
  READINGS_ZONES: { cap: 2000, rank: 4 },
  KNOWLEDGE: { cap: 2000, rank: 2 },
  PROFILE_EVENTS: { cap: 500, rank: null },
  HISTORY: { cap: 1500, rank: 1 },
  QUESTION: { cap: 300, rank: null },
  ANSWER: { cap: 1500, rank: null },
} as const;

describe('the committed table (config/reply/context-caps.v1.json)', () => {
  it('is the table of architecture 5.4, number for number', () => {
    for (const id of CONTEXT_COMPONENTS) {
      expect({ id, cap: capOf(id).cap, rank: capOf(id).cut_rank }).toEqual({
        id,
        cap: DOCUMENT[id].cap,
        rank: DOCUMENT[id].rank,
      });
    }
  });

  it('adds up to 19,600, and says so', () => {
    const sum = CONTEXT_CAPS.components.reduce(
      (total, row) => total + row.cap,
      0
    );
    expect(sum).toBe(19_600);
    expect(CONTEXT_CAPS.total).toBe(19_600);
  });

  it('is the table in the architecture document itself (parsed from the markdown)', () => {
    const markdown = readFileSync(
      join(
        __dirname,
        '..',
        '..',
        '..',
        '..',
        'docs',
        'STACK-D-ARCHITECTURE.md'
      ),
      'utf8'
    ).replace(/\r\n/g, '\n');
    const start = markdown.indexOf('### 5.4 Context budget');
    const end = markdown.indexOf('**Prompt order for caching**');
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const rows = markdown
      .slice(start, end)
      .split('\n')
      .filter(
        (line) =>
          line.startsWith('| ') &&
          !line.startsWith('| ---') &&
          !line.startsWith('| Component')
      )
      .map((line) =>
        line
          .split('|')
          .slice(1, -1)
          .map((cell) => cell.trim())
      );
    expect(rows).toHaveLength(11);
    const body = rows.slice(0, 10);
    body.forEach((cells, index) => {
      const row = CONTEXT_CAPS.components[index] as Any;
      expect(cells[0]?.replace(/\\\*/g, '*')).toBe(row.label);
      expect(Number((cells[1] as string).replace(/[^0-9]/g, ''))).toBe(row.cap);
      const rank = cells[4] === '—' ? null : Number(cells[4]);
      expect(rank).toBe(row.cut_rank);
    });
    const total = rows[10] as string[];
    expect(Number((total[1] as string).replace(/[^0-9]/g, ''))).toBe(
      CONTEXT_CAPS.total
    );
  });

  it('has the components in the order the trace records them, each once', () => {
    expect(CONTEXT_CAPS.components.map((row) => row.id)).toEqual([
      ...CONTEXT_COMPONENTS,
    ]);
  });

  it('uses the ranks 1 to 4 once each, on the components of ADR-048: history, knowledge, OHLC, reading details', () => {
    const ranked = CONTEXT_CAPS.components
      .filter((row) => row.cut_rank !== null)
      .sort((a, b) => (a.cut_rank as number) - (b.cut_rank as number))
      .map((row) => row.id);
    expect(ranked).toEqual(['HISTORY', 'KNOWLEDGE', 'OHLC', 'READINGS_ZONES']);
  });

  it('never cuts the rules, the board, the profile and events, the question, the chart or the answer', () => {
    for (const id of [
      'SYSTEM_RULES',
      'BOARD_SYNTHESIS',
      'PROFILE_EVENTS',
      'QUESTION',
      'CHART',
      'ANSWER',
    ] as const) {
      expect(capOf(id).cut_rank).toBeNull();
    }
  });

  it('puts every component in the segment of ADR-049 and the segments agree with the assembler', () => {
    for (const row of CONTEXT_CAPS.components) {
      const owners = (
        Object.keys(SEGMENT_COMPONENTS) as (keyof typeof SEGMENT_COMPONENTS)[]
      )
        .filter((segment) => SEGMENT_COMPONENTS[segment].includes(row.id))
        .map(String);
      expect(owners).toEqual(row.segment === 'OUTPUT' ? [] : [row.segment]);
    }
    expect(CONTEXT_CAPS.components.map((r) => r.segment)).toEqual([
      'STATIC',
      'CYCLE',
      'CYCLE',
      'CHART',
      'USER',
      'USER',
      'USER',
      'USER',
      'USER',
      'OUTPUT',
    ]);
  });

  it('holds the limits of 5.11 and 5.5', () => {
    expect(CONTEXT_CAPS.limits).toEqual({
      history_verbatim_messages: 10,
      history_summary_max_tokens: 300,
      ohlc_summary_m5_bars: 12,
      ohlc_summary_m15_bars: 8,
      knowledge_max_chunks: 4,
      ohlc_summary_target_tokens: 500,
    });
  });

  it('carries its schema and a version', () => {
    expect(CONTEXT_CAPS.schema).toBe(CAPS_SCHEMA);
    expect(CONTEXT_CAPS.version).toBe('context-caps.v1');
  });

  it('is accepted by its own validator', () => {
    expect(capsProblems(CONTEXT_CAPS)).toEqual([]);
    expect(parseCaps(clone(CONTEXT_CAPS))).toEqual(CONTEXT_CAPS);
  });

  it('names the rule of each rank', () => {
    expect(RANK_WHEN_OVER).toEqual({
      1: 'OLDER_TURNS_TO_SUMMARY',
      2: 'EXPANSIONS_THEN_CHUNK_4',
      3: 'SUMMARY_MODE',
      4: 'DETAILS_DROPPED',
    });
    expect(SEGMENT_IDS).toEqual(['STATIC', 'CYCLE', 'CHART', 'USER', 'OUTPUT']);
    expect(WHEN_OVER).toHaveLength(7);
  });
});

describe('capsProblems: a damaged table is refused, naming what is wrong', () => {
  const damaged = (change: (doc: Any) => void): string[] => {
    const doc = clone(CONTEXT_CAPS) as Any;
    change(doc);
    return capsProblems(doc);
  };

  it('refuses a total that is not the sum', () => {
    expect(damaged((d) => (d.total = 19_599))).toEqual([
      'total 19599 is not the sum of the caps, 19600',
    ]);
    expect(damaged((d) => (d.components[0].cap = 1_501))).toEqual([
      'total 19600 is not the sum of the caps, 19601',
    ]);
  });

  it('refuses a cap that is not a whole number above zero', () => {
    for (const bad of [0, -5, 1.5, '1500', null]) {
      const problems = damaged((d) => (d.components[1].cap = bad));
      expect(problems).toContain(
        'components[1].cap must be a whole number above zero'
      );
    }
  });

  it('refuses a total that is not a whole number above zero', () => {
    expect(damaged((d) => (d.total = 0))[0]).toBe(
      'total must be a whole number above zero'
    );
    expect(damaged((d) => (d.total = '19600'))[0]).toBe(
      'total must be a whole number above zero'
    );
  });

  it('refuses components out of order, missing or extra', () => {
    expect(
      damaged((d) => {
        const first = d.components[0];
        d.components[0] = d.components[1];
        d.components[1] = first;
      })
    ).toEqual([
      "components[0].id must be SYSTEM_RULES (the table's order)",
      "components[1].id must be BOARD_SYNTHESIS (the table's order)",
    ]);
    expect(damaged((d) => d.components.pop())).toContain(
      'components must have 10 rows'
    );
    expect(damaged((d) => d.components.push(clone(d.components[0])))).toContain(
      'components must have 10 rows'
    );
    expect(damaged((d) => (d.components = 'x'))).toContain(
      'components must be a list'
    );
    expect(damaged((d) => (d.components[2] = 5))).toContain(
      'components[2] must be an object'
    );
  });

  it("refuses a rank used twice, missing, out of range, or with another component's rule", () => {
    expect(damaged((d) => (d.components[2].cut_rank = 1))).toEqual(
      expect.arrayContaining([
        'components[7].cut_rank 1 is used twice',
        'components[2]: cut_rank 1 goes with OLDER_TURNS_TO_SUMMARY',
        'no component has cut_rank 3',
      ])
    );
    expect(damaged((d) => (d.components[2].cut_rank = 5))).toEqual(
      expect.arrayContaining([
        'components[2].cut_rank must be null or 1 to 4',
        'no component has cut_rank 3',
      ])
    );
    expect(damaged((d) => (d.components[2].cut_rank = 0))).toContain(
      'components[2].cut_rank must be null or 1 to 4'
    );
    expect(damaged((d) => (d.components[2].cut_rank = 2.5))).toContain(
      'components[2].cut_rank must be null or 1 to 4'
    );
    expect(damaged((d) => (d.components[2].cut_rank = '3'))).toContain(
      'components[2].cut_rank must be null or 1 to 4'
    );
  });

  it.each([
    [1, 7],
    [2, 5],
    [3, 2],
    [4, 4],
  ])('names the rank %i when no component has it', (rank, index) => {
    const problems = damaged((d) => {
      d.components[index].cut_rank = null;
      d.components[index].when_over = 'NEVER_CUT';
    });
    expect(problems).toEqual([`no component has cut_rank ${rank}`]);
  });

  it('throws even for a single problem', () => {
    const doc = clone(CONTEXT_CAPS) as Any;
    doc.total = 19_599;
    expect(() => parseCaps(doc)).toThrow(
      'context caps are unusable: total 19599 is not the sum of the caps, 19600'
    );
  });

  it('refuses a component that has a ranked rule but no rank', () => {
    expect(damaged((d) => (d.components[2].cut_rank = null))).toEqual(
      expect.arrayContaining([
        'components[2] has a rule that needs a cut_rank',
        'no component has cut_rank 3',
      ])
    );
  });

  it('refuses an unknown segment or rule, and a blank label', () => {
    expect(damaged((d) => (d.components[0].segment = 'MIDDLE'))).toContain(
      'components[0].segment must be one of STATIC, CYCLE, CHART, USER, OUTPUT'
    );
    expect(damaged((d) => (d.components[0].when_over = 'SOMETIMES'))).toContain(
      'components[0].when_over is not a known rule'
    );
    expect(damaged((d) => (d.components[0].label = ''))).toContain(
      'components[0].label must be a non-empty string'
    );
    expect(damaged((d) => (d.components[0].label = 7))).toContain(
      'components[0].label must be a non-empty string'
    );
  });

  it('refuses a wrong schema, version or shape', () => {
    expect(damaged((d) => (d.schema = 'context-caps/2'))).toContain(
      'schema must be context-caps/1'
    );
    expect(damaged((d) => (d.version = ''))).toContain(
      'version must be a non-empty string'
    );
    expect(damaged((d) => (d.version = 3))).toContain(
      'version must be a non-empty string'
    );
    for (const bad of [null, [], 'x', 3]) {
      expect(capsProblems(bad)).toEqual([
        'the caps document must be an object',
      ]);
    }
  });

  it('refuses limits that are missing, zero, fractional or unknown', () => {
    expect(damaged((d) => delete d.limits.history_verbatim_messages)).toContain(
      'limits.history_verbatim_messages must be a whole number above zero'
    );
    expect(damaged((d) => (d.limits.ohlc_summary_m5_bars = 0))).toContain(
      'limits.ohlc_summary_m5_bars must be a whole number above zero'
    );
    expect(damaged((d) => (d.limits.knowledge_max_chunks = 4.5))).toContain(
      'limits.knowledge_max_chunks must be a whole number above zero'
    );
    expect(damaged((d) => (d.limits.extra = 1))).toContain(
      'limits.extra is not a known limit'
    );
    expect(damaged((d) => (d.limits = null))).toContain(
      'limits must be an object'
    );
  });

  it('parseCaps throws with every problem in the message', () => {
    const doc = clone(CONTEXT_CAPS) as Any;
    doc.total = 1;
    doc.schema = 'x';
    expect(() => parseCaps(doc)).toThrow(
      /context caps are unusable: schema must be context-caps\/1; total 1 is not the sum of the caps, 19600/
    );
  });

  it('capOf refuses a component that is not in the table', () => {
    const doc = clone(CONTEXT_CAPS) as Any;
    doc.components = doc.components.slice(0, 9);
    expect(() => capOf('ANSWER', doc)).toThrow('no cap for ANSWER');
    expect(capOf('ANSWER', CONTEXT_CAPS).cap).toBe(1500);
  });
});
