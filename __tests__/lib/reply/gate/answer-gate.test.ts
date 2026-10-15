/**
 * @jest-environment node
 */

/**
 * The answer gate (build step 7 part 5; architecture 5.3). The table of 5.3 is pinned row by row,
 * then every combination of data status, retuning flag and intent is judged against it.
 */

import {
  GATE_TABLE,
  RETUNING_REPORT2,
  evaluateAnswerGate,
  gateTrace,
  report2Open,
  rowOf,
} from '@/lib/reply/gate/answer-gate';
import { INTENTS_ALLOWED_ON_STALE } from '@/lib/reply/contracts/intent-shapes';
import {
  CHART_DECISIONS,
  GATE_DIRECTION,
  GATE_OTHER_QUESTIONS,
  GATE_REPORT2,
  validateReplyTrace,
} from '@/lib/reply/contracts/trace-fields';
import type { DataStatus, PacketIntent } from '@/lib/reply/contracts/intake';

import { makeTrace } from '../helpers/fixtures';
import { INTENTS, STATUSES } from '../report1/helpers/report1-fixtures';

const SLOT = '2026-09-18T20:55Z';

const gate = (
  intent: PacketIntent,
  dataStatus: DataStatus,
  retuning = false,
  cycleSlot: string | null = SLOT
) => evaluateAnswerGate({ intent, dataStatus, retuning, cycleSlot });

describe('the table of 5.3', () => {
  it('has one row per data status, as data', () => {
    expect(Object.keys(GATE_TABLE).sort()).toEqual(
      ['DELAYED', 'FRESH', 'MARKET_CLOSED', 'STALE', 'UNKNOWN'].sort()
    );
  });

  it.each([
    [
      'FRESH',
      {
        direction: 'YES',
        otherQuestions: 'ALL',
        chart: 'IF_CYCLE_MATCHES',
        report2: 'ALLOWED',
      },
    ],
    [
      'DELAYED',
      {
        direction: 'DELAYED',
        otherQuestions: 'ALL',
        chart: 'IF_CYCLE_MATCHES',
        report2: 'ALLOWED_DELAY_STATED',
      },
    ],
    [
      'STALE',
      {
        direction: 'NO',
        otherQuestions: 'EXPLAIN_AND_GENERAL',
        chart: 'NEVER',
        report2: 'BLOCKED',
      },
    ],
    [
      'MARKET_CLOSED',
      {
        direction: 'LAST_SESSION',
        otherQuestions: 'ALL',
        chart: 'IF_CYCLE_MATCHES',
        report2: 'BLOCKED',
      },
    ],
    [
      'UNKNOWN',
      {
        direction: 'NO',
        otherQuestions: 'EXPLAIN_AND_GENERAL',
        chart: 'NEVER',
        report2: 'BLOCKED',
      },
    ],
  ] as const)('%s is the row architecture 5.3 gives it', (status, row) => {
    expect(GATE_TABLE[status]).toEqual(row);
  });

  it('only uses the words the trace contract has', () => {
    for (const row of Object.values(GATE_TABLE)) {
      expect(GATE_DIRECTION).toContain(row.direction);
      expect(GATE_OTHER_QUESTIONS).toContain(row.otherQuestions);
      expect(GATE_REPORT2).toContain(row.report2);
    }
    expect(RETUNING_REPORT2).toBe('HALF_RISK_PRESET');
    expect(GATE_REPORT2).toContain(RETUNING_REPORT2);
  });

  it('treats UNKNOWN like STALE for everything the table decides (the gateway could not be asked)', () => {
    expect(GATE_TABLE.UNKNOWN).toEqual(GATE_TABLE.STALE);
  });

  it('opens Report 2 for exactly the columns that open the modal', () => {
    expect(GATE_REPORT2.filter(report2Open)).toEqual([
      'ALLOWED',
      'ALLOWED_DELAY_STATED',
      'HALF_RISK_PRESET',
    ]);
  });
});

describe('what each status answers', () => {
  describe.each(['FRESH', 'DELAYED'] as const)('%s', (status) => {
    it.each(INTENTS)('answers %s, retuned or not', (intent) => {
      for (const retuning of [false, true]) {
        const verdict = gate(intent, status, retuning);
        expect(verdict.allowed).toBe(true);
        expect(verdict.refusal).toBeNull();
      }
    });
  });

  describe.each(['STALE', 'UNKNOWN'] as const)('%s', (status) => {
    it.each(INTENTS)('%s: only explain and general questions', (intent) => {
      const verdict = gate(intent, status);
      const allowed = INTENTS_ALLOWED_ON_STALE.includes(intent);
      expect(verdict.allowed).toBe(allowed);
      expect(verdict.refusal).toEqual(
        allowed ? null : { reason: 'DATA_STALE', stoppedAt: SLOT }
      );
    });
  });

  it('answers EXPLAIN and NEWS on a stale cycle, and nothing about direction, exits, sizing or Report 2', () => {
    expect([...INTENTS_ALLOWED_ON_STALE].sort()).toEqual(['EXPLAIN', 'NEWS']);
    for (const intent of [
      'DIRECTION',
      'ENTRY_TIMING',
      'EXIT_TARGETS',
      'RISK_SIZING',
      'REPORT_2',
      'INSTANT_M5_INSPECT',
      'INSTANT_M15_INSPECT',
    ] as const) {
      expect(gate(intent, 'STALE').allowed).toBe(false);
    }
  });

  describe('MARKET_CLOSED', () => {
    it.each(INTENTS.filter((intent) => intent !== 'REPORT_2'))(
      'answers %s with the last session (the stamp labels it)',
      (intent) => {
        expect(gate(intent, 'MARKET_CLOSED').allowed).toBe(true);
      }
    );

    it('blocks Report 2 with its own reason, not the stale one', () => {
      const verdict = gate('REPORT_2', 'MARKET_CLOSED');
      expect(verdict.allowed).toBe(false);
      expect(verdict.refusal).toEqual({
        reason: 'MARKET_CLOSED',
        stoppedAt: SLOT,
      });
    });

    it('blocks Report 2 whether or not the sensors are being retuned', () => {
      expect(gate('REPORT_2', 'MARKET_CLOSED', true).refusal?.reason).toBe(
        'MARKET_CLOSED'
      );
    });
  });

  it('names the time the data stopped: the cycle slot, or nothing when no cycle is known', () => {
    expect(
      gate('DIRECTION', 'STALE', false, '2026-09-18T20:55Z').refusal
    ).toEqual({
      reason: 'DATA_STALE',
      stoppedAt: '2026-09-18T20:55Z',
    });
    expect(gate('DIRECTION', 'UNKNOWN', false, null).refusal).toEqual({
      reason: 'DATA_STALE',
      stoppedAt: null,
    });
  });
});

describe('Report 2 and the retuning flag (ADR-015, 6.4)', () => {
  it('opens with the half-risk pre-set while the sensors are retuned', () => {
    expect(gate('REPORT_2', 'FRESH', true).report2).toBe('HALF_RISK_PRESET');
    expect(gate('REPORT_2', 'DELAYED', true).report2).toBe('HALF_RISK_PRESET');
  });

  it('keeps the plain column when nothing is being retuned', () => {
    expect(gate('REPORT_2', 'FRESH').report2).toBe('ALLOWED');
    expect(gate('REPORT_2', 'DELAYED').report2).toBe('ALLOWED_DELAY_STATED');
  });

  it('never opens what is blocked', () => {
    for (const status of ['STALE', 'MARKET_CLOSED', 'UNKNOWN'] as const) {
      expect(gate('REPORT_2', status, true).report2).toBe('BLOCKED');
    }
  });

  it('does not change the direction or the other questions', () => {
    for (const status of STATUSES) {
      const plain = gate('DIRECTION', status, false);
      const retuned = gate('DIRECTION', status, true);
      expect(retuned.row).toEqual(plain.row);
      expect(retuned.allowed).toBe(plain.allowed);
      expect(retuned.retuning).toBe(true);
    }
  });
});

describe('a status the table does not know', () => {
  it('fails closed as UNKNOWN', () => {
    for (const bad of ['', 'LIVE', 'fresh', 'toString', '__proto__']) {
      const verdict = evaluateAnswerGate({
        intent: 'DIRECTION',
        dataStatus: bad as DataStatus,
        retuning: false,
        cycleSlot: SLOT,
      });
      expect(verdict.status).toBe('UNKNOWN');
      expect(verdict.allowed).toBe(false);
      expect(verdict.chartAllowed).toBe(false);
    }
    expect(rowOf('constructor' as DataStatus)).toBe(GATE_TABLE.UNKNOWN);
  });
});

describe('the chart column', () => {
  it.each(STATUSES)(
    '%s: a chart is allowed exactly when the row says so',
    (status) => {
      expect(gate('DIRECTION', status).chartAllowed).toBe(
        GATE_TABLE[status].chart === 'IF_CYCLE_MATCHES'
      );
    }
  );

  it('allows a chart on FRESH, DELAYED and MARKET_CLOSED and never on STALE or UNKNOWN', () => {
    expect(
      STATUSES.filter((status) => gate('DIRECTION', status).chartAllowed)
    ).toEqual(['FRESH', 'DELAYED', 'MARKET_CLOSED']);
  });

  it('puts the chart rule decision into the trace', () => {
    const decision = gate('DIRECTION', 'FRESH');
    for (const chart of CHART_DECISIONS) {
      expect(gateTrace(decision, chart).chart).toBe(chart);
    }
    expect(gateTrace(decision, null).chart).toBe('NOT_CALLED_FOR');
  });

  it('says DATA_STATUS whatever the chart rule found when the status never sends one', () => {
    for (const status of ['STALE', 'UNKNOWN'] as const) {
      for (const chart of [...CHART_DECISIONS, null]) {
        expect(gateTrace(gate('EXPLAIN', status), chart).chart).toBe(
          'DATA_STATUS'
        );
      }
    }
  });

  it('produces a group the trace contract accepts, for every status and Report 2 column', () => {
    for (const status of STATUSES) {
      for (const retuning of [false, true]) {
        const trace = makeTrace();
        trace.checks.answer_gate = gateTrace(
          gate('DIRECTION', status, retuning),
          'NOT_CALLED_FOR'
        );
        expect(validateReplyTrace(trace)).toMatchObject({ ok: true });
      }
    }
  });
});

describe('the gate is a pure function of its facts', () => {
  it('gives the same verdict twice and changes nothing it was given', () => {
    const input = {
      intent: 'DIRECTION' as const,
      dataStatus: 'STALE' as const,
      retuning: true,
      cycleSlot: SLOT,
    };
    const frozen = JSON.stringify(input);
    expect(evaluateAnswerGate(input)).toEqual(evaluateAnswerGate(input));
    expect(JSON.stringify(input)).toBe(frozen);
    expect(JSON.stringify(GATE_TABLE.STALE)).toBe(
      JSON.stringify({
        direction: 'NO',
        otherQuestions: 'EXPLAIN_AND_GENERAL',
        chart: 'NEVER',
        report2: 'BLOCKED',
      })
    );
  });
});
