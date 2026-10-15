/**
 * @jest-environment node
 */

/**
 * The fixed answer (build step 7 part 5; architecture 5.9 and 7.6, plan decision D20): the
 * reply built from the board when a model cannot or may not answer. A direction word, a rule id,
 * statuses, state codes, levels, the stamp: no free text, in any of the 19 languages.
 */

import { LOCALES } from '@/lib/reply/contracts/intake';
import type { IntakePacket } from '@/lib/reply/contracts/intake';
import {
  FIXED_REASONS,
  validateReplyResult,
} from '@/lib/reply/contracts/result';
import type {
  FixedAnswerResult,
  FixedReason,
} from '@/lib/reply/contracts/result';
import type { ComposeOutcome } from '@/lib/reply/report1/compose';
import {
  composeFixedAnswer,
  directionAllowed,
} from '@/lib/reply/report1/fixed-answer';

import {
  FRAME,
  GOLDEN_IDS,
  STATUSES,
  TRADER_TYPE_LIST,
  overlay,
  worldOf,
} from './helpers/report1-fixtures';

function must<T>(outcome: ComposeOutcome<T>): T {
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.failures));
  return outcome.value;
}

/** Every string a value holds, at any depth. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (typeof value === 'object' && value !== null) {
    Object.values(value).forEach((v) => strings(v, out));
  }
  return out;
}

const fixedOf = async (
  prefix: string,
  reason: FixedReason,
  patch: Parameters<typeof overlay>[1] = {},
  type: 'DAY_TRADER' | 'SCALPER' = 'DAY_TRADER',
  withDictionary = true
): Promise<FixedAnswerResult> => {
  const { packet, dictionary } = await worldOf(prefix, type);
  return must(
    composeFixedAnswer({
      packet: overlay(packet, patch),
      reason,
      dictionary: withDictionary ? dictionary : null,
      frame: FRAME,
    })
  );
};

describe('a fixed answer from a live cycle', () => {
  it.each([
    'WORDING_FAILED',
    'SCHEMA_FAILED',
    'MODEL_UNAVAILABLE',
    'DEADLINE',
  ] as const)(
    'for %s states the synthesis direction, the board and the levels',
    async (reason) => {
      const { packet, dictionary } = await worldOf('01');
      const result = must(
        composeFixedAnswer({ packet, reason, dictionary, frame: FRAME })
      );
      expect(result.kind).toBe('FIXED_ANSWER');
      expect(result.fixed.reason).toBe(reason);
      expect(result.fixed.direction).toEqual({
        bias: 'LONG',
        trend_relation: 'COUNTER_TREND',
        rule_id: 'R1_MACRO_COUNTER_TREND_RALLY',
        archetype: 'C',
        stand_aside: false,
        profile: 'DAY_TRADER',
      });
      expect(result.fixed.board).toEqual([
        {
          mcd_id: 'MCD1',
          status: 'CAUTIONARY',
          state_code: 'MCD1_DOWN_UPPER_BREAKOUT',
        },
        {
          mcd_id: 'MCD2',
          status: 'CAUTIONARY',
          state_code: 'MCD2_UP_IN_CORRIDOR',
        },
        {
          mcd_id: 'MCD3',
          status: 'CAUTIONARY',
          state_code: 'MCD3_NON_CONSOLIDATED_TREND_CONFLICT',
        },
      ]);
      expect(result.fixed.levels.length).toBeGreaterThan(5);
      expect(
        result.fixed.levels.some(
          (l) => l.id === 'MCD2.baseline' && l.price === 4367.2
        )
      ).toBe(true);
      expect(result.stamp.data_status).toBe('FRESH');
      expect(validateReplyResult(result)).toMatchObject({ ok: true });
    }
  );

  it('states the direction of every golden cycle for both trader types, equal to the synthesis', async () => {
    for (const id of GOLDEN_IDS) {
      for (const type of TRADER_TYPE_LIST) {
        const { packet, dictionary } = await worldOf(id.slice(0, 2), type);
        const result = must(
          composeFixedAnswer({
            packet,
            reason: 'MODEL_UNAVAILABLE',
            dictionary,
            frame: FRAME,
          })
        );
        const reading = (packet.readings.synthesis as any).reading;
        expect(result.fixed.direction).toEqual({
          bias: reading.bias,
          trend_relation: reading.trend_relation ?? null,
          rule_id: reading.rule_id,
          archetype: reading.archetype ?? null,
          stand_aside: reading.stand_aside,
          profile: type,
        });
        expect(validateReplyResult(result)).toMatchObject({ ok: true });
      }
    }
  });

  it('still states a stand-aside, an invalid-data and a no-match reading as they are', async () => {
    const standAside = await fixedOf('09', 'DEADLINE');
    expect(standAside.fixed.direction).toMatchObject({
      bias: 'STAND_ASIDE',
      stand_aside: true,
    });
    const noMatch = await fixedOf('15', 'DEADLINE');
    expect(noMatch.fixed.direction).toMatchObject({
      rule_id: 'NO_MATCH',
      bias: 'NEUTRAL',
    });
    const dataCheck = await fixedOf('15', 'DEADLINE', {}, 'SCALPER');
    expect(dataCheck.fixed.direction).toMatchObject({
      rule_id: 'R0_DATA_CHECK',
      stand_aside: true,
    });
  });

  it('has no levels when no dictionary is given, and still the direction and the board', async () => {
    const result = await fixedOf(
      '01',
      'MODEL_UNAVAILABLE',
      {},
      'DAY_TRADER',
      false
    );
    expect(result.fixed.levels).toEqual([]);
    expect(result.fixed.direction).not.toBeNull();
    expect(result.fixed.board).toHaveLength(3);
  });

  it('labels a delayed, a closed-market and a retuned cycle by its stamp, and keeps the direction', async () => {
    for (const [patch, expected] of [
      [
        { status: 'DELAYED' as const },
        { data_status: 'DELAYED', retuning: false },
      ],
      [
        { status: 'MARKET_CLOSED' as const },
        { data_status: 'MARKET_CLOSED', retuning: false },
      ],
      [{ retuning: true }, { data_status: 'FRESH', retuning: true }],
    ] as const) {
      const result = await fixedOf('01', 'DEADLINE', patch);
      expect(result.stamp).toMatchObject(expected);
      expect(result.fixed.direction?.bias).toBe('LONG');
    }
  });
});

describe('a fixed answer from a cycle whose data stopped (5.14 item 3)', () => {
  it.each(['STALE', 'UNKNOWN'] as const)(
    'states no direction on a %s cycle and says when the data stopped',
    async (status) => {
      const result = await fixedOf('01', 'DATA_STALE', { status });
      expect(result.fixed.reason).toBe('DATA_STALE');
      expect(result.fixed.direction).toBeNull();
      expect(result.fixed.levels).toEqual([]);
      expect(result.stamp).toEqual({
        as_of: '2026-09-18T20:55Z', // the time the data stopped
        data_status: status,
        retuning: false,
        flags: [],
      });
      // the sensors' last states are listed, labelled by that stamp
      expect(result.fixed.board.map((l) => l.mcd_id)).toEqual([
        'MCD1',
        'MCD2',
        'MCD3',
      ]);
      expect(validateReplyResult(result)).toMatchObject({ ok: true });
      // nothing in the reply names a side
      expect(JSON.stringify(result)).not.toMatch(/"bias"|LONG|SHORT/);
    }
  );

  it.each([
    'WORDING_FAILED',
    'SCHEMA_FAILED',
    'MODEL_UNAVAILABLE',
    'DEADLINE',
    'MARKET_CLOSED',
  ] as const)(
    'states none for %s either: the gate decides, not the reason',
    async (reason) => {
      const result = await fixedOf('01', reason, { status: 'STALE' });
      expect(result.fixed.direction).toBeNull();
      expect(result.fixed.levels).toEqual([]);
      expect(result.fixed.reason).toBe(reason);
    }
  );

  it('states none and shows no price on any golden cycle for either trader type', async () => {
    for (const id of GOLDEN_IDS) {
      for (const type of TRADER_TYPE_LIST) {
        const result = await fixedOf(
          id.slice(0, 2),
          'DATA_STALE',
          { status: 'STALE' },
          type
        );
        expect(result.fixed.direction).toBeNull();
        expect(result.fixed.levels).toEqual([]);
        expect(result.stamp.as_of).toBe(
          (await worldOf(id.slice(0, 2), type)).packet.data.cycle_slot
        );
        expect(validateReplyResult(result)).toMatchObject({ ok: true });
      }
    }
  });
});

describe('a fixed answer for a cycle with no synthesis reading', () => {
  it("states no direction but shows the board and the sensors' levels", async () => {
    const { packet, dictionary } = await worldOf('01');
    const none = {
      ...packet,
      readings: { ...packet.readings, synthesis: null },
    };
    const result = must(
      composeFixedAnswer({
        packet: none,
        reason: 'NO_SYNTHESIS',
        dictionary,
        frame: FRAME,
      })
    );
    expect(result.fixed.direction).toBeNull();
    expect(result.fixed.board).toHaveLength(3);
    expect(result.fixed.levels.length).toBeGreaterThan(0);
    expect(result.fixed.levels.every((l) => l.kind === 'CHANNEL')).toBe(true);
    expect(validateReplyResult(result)).toMatchObject({ ok: true });
  });

  it('states none for any other reason either, when the reading is missing', async () => {
    const { packet, dictionary } = await worldOf('01');
    const none = {
      ...packet,
      readings: { ...packet.readings, synthesis: null },
    };
    const result = must(
      composeFixedAnswer({
        packet: none,
        reason: 'DEADLINE',
        dictionary,
        frame: FRAME,
      })
    );
    expect(result.fixed.direction).toBeNull();
  });

  it('lists nothing when the sensors are not live', async () => {
    const { packet, dictionary } = await worldOf('01');
    const dark: IntakePacket = {
      ...packet,
      board: { ...packet.board, sensors: [] },
      readings: { m_star: [], sensors: [], synthesis: null },
      data: { ...packet.data, flags: ['SENSORS_NOT_LIVE'] },
    };
    const result = must(
      composeFixedAnswer({
        packet: dark,
        reason: 'NO_SYNTHESIS',
        dictionary,
        frame: FRAME,
      })
    );
    expect(result.fixed.board).toEqual([]);
    expect(result.fixed.levels).toEqual([]);
    expect(result.stamp.flags).toEqual(['SENSORS_NOT_LIVE']);
    expect(validateReplyResult(result)).toMatchObject({ ok: true });
  });
});

describe('who may state a direction', () => {
  it('is decided by the reason and the status, in this order of authority', async () => {
    const { packet } = await worldOf('01');
    for (const status of STATUSES) {
      for (const reason of FIXED_REASONS) {
        const expected =
          reason !== 'DATA_STALE' &&
          reason !== 'NO_SYNTHESIS' &&
          (status === 'FRESH' ||
            status === 'DELAYED' ||
            status === 'MARKET_CLOSED');
        expect({
          status,
          reason,
          allowed: directionAllowed(overlay(packet, { status }), reason),
        }).toEqual({
          status,
          reason,
          allowed: expected,
        });
      }
    }
  });
});

describe('no free text, in any of the 19 languages (decision D20)', () => {
  it('carries nothing a sensor, the synthesis or the question wrote in prose', async () => {
    let compared = 0;
    for (const id of GOLDEN_IDS) {
      for (const type of TRADER_TYPE_LIST) {
        const { packet, dictionary } = await worldOf(id.slice(0, 2), type);
        const prose = new Set<string>([
          packet.board.syn.summary,
          packet.question.english,
          packet.question.original ?? '',
          ...packet.board.sensors.flatMap((line) => [
            line.summary ?? '',
            ...line.reasons,
          ]),
          ...packet.readings.sensors.flatMap((s) => [
            String(s.envelope['summary_line'] ?? ''),
            String(s.envelope['commentary'] ?? ''),
          ]),
          ...((packet.readings.synthesis?.reading['reasons'] as
            | string[]
            | undefined) ?? []),
          String(packet.readings.synthesis?.reading['summary_line'] ?? ''),
          ...(packet.knowledge?.chunks.map((c) => c.text) ?? []),
          ...packet.events.items.map((e) => e.name),
        ]);
        prose.delete('');
        for (const locale of LOCALES) {
          const localized = overlay(packet, { locale });
          for (const status of ['FRESH', 'STALE'] as const) {
            const result = must(
              composeFixedAnswer({
                packet: overlay(localized, { status }),
                reason: status === 'STALE' ? 'DATA_STALE' : 'MODEL_UNAVAILABLE',
                dictionary,
                frame: FRAME,
              })
            );
            const all = strings(result);
            // every string is a code, an id, a slot, a number-free name: no spaces, plain ASCII
            for (const text of all)
              expect(text).toMatch(/^[A-Za-z0-9_.:/\-]+$/);
            for (const sentence of prose) {
              expect(JSON.stringify(result)).not.toContain(sentence);
            }
            expect(result.reply_locale).toBe(locale);
            expect(validateReplyResult(result)).toMatchObject({ ok: true });
            compared += 1;
          }
        }
      }
    }
    expect(compared).toBe(16 * 2 * 19 * 2);
  });

  it('keeps ids, prices and state codes ASCII and left to right in the right-to-left languages', async () => {
    const { packet, dictionary } = await worldOf('01');
    for (const locale of ['ar', 'ur']) {
      const result = must(
        composeFixedAnswer({
          packet: overlay(packet, { locale }),
          reason: 'MODEL_UNAVAILABLE',
          dictionary,
          frame: FRAME,
        })
      );
      const json = JSON.stringify(result);
      expect(json).not.toMatch(/[^\x20-\x7e]/); // nothing outside ASCII: no isolate, no mark, no translated word
      expect(typeof result.fixed.levels[0]?.price).toBe('number');
    }
  });
});

describe('who wrote it', () => {
  it('names no model and no prompt, flags nothing, and keeps the count of regenerations', async () => {
    const { packet, dictionary } = await worldOf('01');
    const result = must(
      composeFixedAnswer({
        packet,
        reason: 'WORDING_FAILED',
        dictionary,
        frame: {
          ...FRAME,
          regenerations: 1,
          notes: ['CHART_UNAVAILABLE'],
          changes: [],
        },
      })
    );
    expect(result.provenance).toEqual({
      request_id: FRAME.requestId,
      model: null,
      prompt_version: null,
      reply_version: '1.0.0',
    });
    expect(result.checks).toEqual({ numbers_flagged: 0, regenerations: 1 });
    expect(result.notes).toEqual(['CHART_UNAVAILABLE']);
  });

  it('is refused by the contract when the frame is wrong, with the place', async () => {
    const { packet, dictionary } = await worldOf('01');
    const outcome = composeFixedAnswer({
      packet,
      reason: 'DEADLINE',
      dictionary,
      frame: { ...FRAME, threadId: 'not valid!' },
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.failures.map((f) => f.path)).toContain('thread_id');
      expect(outcome.failures.every((f) => f.code === 'INVALID_RESULT')).toBe(
        true
      );
      expect(outcome.failures.every((f) => f.detail.includes(':'))).toBe(true);
    }
  });

  it('changes nothing it was given', async () => {
    const { packet, dictionary } = await worldOf('02');
    const before = JSON.stringify(packet);
    const result = must(
      composeFixedAnswer({
        packet,
        reason: 'DEADLINE',
        dictionary,
        frame: FRAME,
      })
    );
    result.fixed.board.push({
      mcd_id: 'MCD9',
      status: 'VALID',
      state_code: null,
    });
    expect(JSON.stringify(packet)).toBe(before);
  });
});
