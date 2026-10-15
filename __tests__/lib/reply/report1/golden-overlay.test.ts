/**
 * @jest-environment node
 */

/**
 * The golden cycles under every data status (build step 7 part 5; plan finding S7-F17): the 16
 * signed-off cycles, both trader types, with the five data statuses laid over them as OVERLAYS
 * (a status is the gateway's live answer, not a property of a stored cycle). Each is run through
 * the pure path the orchestrator will run: gate, shape, then the composer or the fixed answer,
 * and every result is held to the contract. A stand-in model port counts its calls.
 *
 * It names the three "done when" items of 5.14 this part owns: item 3 (a stale cycle gets no
 * direction and says when the data stopped), item 4 (a chart from another cycle is dropped and
 * the reply says so) and item 7 (direction equals the synthesis on every golden scenario).
 */

import type { ValueDictionary } from '@/lib/reply/checks/value-dictionary';
import type {
  IntakePacket,
  PacketIntent,
  TraderType,
} from '@/lib/reply/contracts/intake';
import { validateReplyResult } from '@/lib/reply/contracts/result';
import type { ReplyResult } from '@/lib/reply/contracts/result';
import { evaluateAnswerGate, report2Open } from '@/lib/reply/gate/answer-gate';
import { resolveShape } from '@/lib/reply/gate/shape';
import { readChart } from '@/lib/reply/read/chart';
import type { ChartPort } from '@/lib/reply/read/chart';
import {
  composeAnswerResult,
  composeReport1Result,
} from '@/lib/reply/report1/compose';
import type { ComposeOutcome, ReplyFrame } from '@/lib/reply/report1/compose';
import { composeFixedAnswer } from '@/lib/reply/report1/fixed-answer';
import { buildActionResult } from '@/lib/reply/report1/stamp';

import {
  FRAME,
  GOLDEN_IDS,
  STATUSES,
  TRADER_TYPE_LIST,
  modelReportFor,
  overlay,
  packetOf,
  worldOf,
} from './helpers/report1-fixtures';
import type { Overlay } from './helpers/report1-fixtures';

/** The model port of a stand-in orchestrator: it only counts. */
class CountingModel {
  calls = 0;
  ask(): void {
    this.calls += 1;
  }
}

interface Run {
  model: CountingModel;
  shape: string;
  result: ReplyResult;
}

function value<T>(outcome: ComposeOutcome<T>): T {
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.failures));
  return outcome.value;
}

/** The pure path of one request, as the orchestrator will run it. */
function run(
  base: IntakePacket,
  dictionary: ValueDictionary,
  intent: PacketIntent,
  patch: Overlay = {},
  frame: ReplyFrame = FRAME
): Run {
  const packet = overlay({ ...base, intent }, patch);
  const model = new CountingModel();
  const gate = evaluateAnswerGate({
    intent,
    dataStatus: packet.data.status,
    retuning: packet.data.retuning,
    cycleSlot: packet.data.cycle_slot,
  });
  const resolution = resolveShape({ packet, gate });
  if (resolution.model) model.ask();

  let result: ReplyResult;
  switch (resolution.shape) {
    case 'REPORT1':
      result = value(
        composeReport1Result({
          packet,
          dictionary,
          model: modelReportFor(packet, dictionary),
          frame,
        })
      ).result;
      break;
    case 'ANSWER':
      result = value(
        composeAnswerResult({
          packet,
          dictionary,
          model: {
            locale: packet.question.reply_locale,
            text: 'The upper edge of the corridor is a level of the channel',
            cites: [],
            action: null,
          },
          report2Open: report2Open(gate.report2),
          frame,
        })
      );
      break;
    case 'FIXED_ANSWER':
      result = value(
        composeFixedAnswer({
          packet,
          reason: resolution.reason,
          dictionary,
          frame,
        })
      );
      break;
    case 'ACTION':
      result = buildActionResult(packet, frame, resolution.action);
      break;
  }
  return { model, shape: resolution.shape, result };
}

describe('every golden cycle under every data status', () => {
  it('produces a result the contract accepts with no issue: 16 cycles x 2 trader types x 5 statuses x 3 intents', async () => {
    let count = 0;
    for (const id of GOLDEN_IDS) {
      for (const type of TRADER_TYPE_LIST) {
        const { packet, dictionary } = await worldOf(id.slice(0, 2), type);
        for (const status of STATUSES) {
          for (const intent of ['DIRECTION', 'EXPLAIN', 'REPORT_2'] as const) {
            const { result } = run(packet, dictionary, intent, { status });
            expect(validateReplyResult(result)).toEqual({
              ok: true,
              value: result,
            });
            expect(result.stamp.data_status).toBe(status);
            expect(result.stamp.as_of).toBe(packet.data.cycle_slot);
            count += 1;
          }
        }
      }
    }
    expect(count).toBe(16 * 2 * 5 * 3);
  });

  it('makes no model call for a request the data does not allow, and none for Report 2', async () => {
    for (const id of GOLDEN_IDS) {
      for (const type of TRADER_TYPE_LIST) {
        const { packet, dictionary } = await worldOf(id.slice(0, 2), type);
        for (const status of STATUSES) {
          for (const intent of [
            'DIRECTION',
            'ENTRY_TIMING',
            'EXIT_TARGETS',
            'RISK_SIZING',
            'REPORT_2',
          ] as const) {
            const run1 = run(packet, dictionary, intent, { status });
            const allowed =
              status !== 'STALE' &&
              status !== 'UNKNOWN' &&
              !(status === 'MARKET_CLOSED' && intent === 'REPORT_2');
            const needsModel = allowed && intent !== 'REPORT_2';
            expect({
              id,
              type,
              status,
              intent,
              calls: run1.model.calls,
            }).toEqual({
              id,
              type,
              status,
              intent,
              calls: needsModel ? 1 : 0,
            });
          }
        }
      }
    }
  });
});

describe('5.14 item 3: a STALE cycle gets no direction, and the reply says when the data stopped', () => {
  it.each(['STALE', 'UNKNOWN'] as const)(
    'on all 16 cycles and both trader types (%s)',
    async (status) => {
      for (const id of GOLDEN_IDS) {
        for (const type of TRADER_TYPE_LIST) {
          const { packet, dictionary } = await worldOf(id.slice(0, 2), type);
          for (const intent of [
            'DIRECTION',
            'ENTRY_TIMING',
            'INSTANT_M5_INSPECT',
            'INSTANT_M15_INSPECT',
          ] as const) {
            const out = run(packet, dictionary, intent, { status });
            expect(out.model.calls).toBe(0);
            expect(out.result.kind).toBe('FIXED_ANSWER');
            if (out.result.kind !== 'FIXED_ANSWER') continue;
            expect(out.result.fixed.reason).toBe('DATA_STALE');
            expect(out.result.fixed.direction).toBeNull();
            expect(out.result.fixed.levels).toEqual([]);
            expect(out.result.stamp.as_of).toBe(packet.data.cycle_slot); // when the data stopped
            expect(out.result.stamp.data_status).toBe(status);
            expect(JSON.stringify(out.result)).not.toMatch(/"bias"/);
          }
        }
      }
    }
  );

  it('still explains on a stale cycle, labelled by its stamp, with a model', async () => {
    const { packet, dictionary } = await worldOf('01');
    const out = run(packet, dictionary, 'EXPLAIN', { status: 'STALE' });
    expect(out.model.calls).toBe(1);
    expect(out.result.kind).toBe('ANSWER');
    expect(out.result.stamp).toMatchObject({
      data_status: 'STALE',
      as_of: '2026-09-18T20:55Z',
    });
  });
});

describe('5.14 item 7: direction equals the synthesis reading on every golden scenario', () => {
  it('in the report on live, delayed, closed-market and retuned data: 16 cycles x 2 trader types', async () => {
    const overlays: Overlay[] = [
      {},
      { status: 'DELAYED' },
      { status: 'MARKET_CLOSED' },
      { retuning: true },
      { status: 'DELAYED', retuning: true },
    ];
    let checked = 0;
    for (const id of GOLDEN_IDS) {
      for (const type of TRADER_TYPE_LIST) {
        const { packet, dictionary } = await worldOf(id.slice(0, 2), type);
        const reading = (packet.readings.synthesis as any).reading;
        for (const patch of overlays) {
          const out = run(packet, dictionary, 'DIRECTION', patch);
          expect(out.shape).toBe('REPORT1');
          expect(out.result.kind).toBe('REPORT1');
          if (out.result.kind !== 'REPORT1') continue;
          expect(out.result.report.direction).toEqual({
            bias: reading.bias,
            trend_relation: reading.trend_relation ?? null,
            rule_id: reading.rule_id,
            archetype: reading.archetype ?? null,
            stand_aside: reading.stand_aside,
            profile: type,
          });
          expect(out.result.stamp.retuning).toBe(patch.retuning ?? false);
          checked += 1;
        }
      }
    }
    expect(checked).toBe(16 * 2 * 5);
  });

  it('in the fixed answer that follows a model that failed', async () => {
    for (const id of GOLDEN_IDS) {
      for (const type of TRADER_TYPE_LIST) {
        const { packet, dictionary } = await worldOf(id.slice(0, 2), type);
        const reading = (packet.readings.synthesis as any).reading;
        for (const reason of [
          'WORDING_FAILED',
          'SCHEMA_FAILED',
          'MODEL_UNAVAILABLE',
          'DEADLINE',
        ] as const) {
          const result = value(
            composeFixedAnswer({ packet, reason, dictionary, frame: FRAME })
          );
          expect(result.fixed.direction?.bias).toBe(reading.bias);
          expect(result.fixed.direction?.rule_id).toBe(reading.rule_id);
          expect(result.fixed.direction?.profile).toBe(type);
        }
      }
    }
  });
});

describe('the labels a status puts on the reply', () => {
  it('marks a delayed cycle, the last session and a retuned cycle in the stamp, and answers all of them', async () => {
    const { packet, dictionary } = await worldOf('04');
    const delayed = run(packet, dictionary, 'DIRECTION', { status: 'DELAYED' });
    expect(delayed.result.stamp.data_status).toBe('DELAYED');
    const closed = run(packet, dictionary, 'DIRECTION', {
      status: 'MARKET_CLOSED',
    });
    expect(closed.result.stamp.data_status).toBe('MARKET_CLOSED');
    expect(closed.result.kind).toBe('REPORT1');
    const retuned = run(packet, dictionary, 'DIRECTION', { retuning: true });
    expect(retuned.result.stamp).toMatchObject({
      retuning: true,
      data_status: 'FRESH',
    });
  });

  it('opens the Trade Setup on a live, delayed or retuned cycle and never on a closed or stale one', async () => {
    const { packet, dictionary } = await worldOf('04');
    for (const patch of [
      {},
      { status: 'DELAYED' as const },
      { retuning: true },
    ]) {
      const out = run(packet, dictionary, 'REPORT_2', patch);
      expect(out.result.kind).toBe('ACTION');
      expect(out.model.calls).toBe(0);
    }
    const closed = run(packet, dictionary, 'REPORT_2', {
      status: 'MARKET_CLOSED',
    });
    expect(closed.result.kind).toBe('FIXED_ANSWER');
    expect(
      closed.result.kind === 'FIXED_ANSWER' && closed.result.fixed.reason
    ).toBe('MARKET_CLOSED');
    const stale = run(packet, dictionary, 'REPORT_2', { status: 'STALE' });
    expect(
      stale.result.kind === 'FIXED_ANSWER' && stale.result.fixed.reason
    ).toBe('DATA_STALE');
  });

  it('builds the action from the cycle slot, the trader type and the zone ids, with no model', async () => {
    const { packet: base } = await worldOf('01', 'SCALPER');
    const packet = overlay({ ...base, intent: 'REPORT_2' }, {});
    const gate = evaluateAnswerGate({
      intent: 'REPORT_2',
      dataStatus: 'FRESH',
      retuning: false,
      cycleSlot: packet.data.cycle_slot,
    });
    const resolution = resolveShape({ packet, gate, zoneIds: ['Z1', 'Z2'] });
    expect(resolution.shape).toBe('ACTION');
    if (resolution.shape === 'ACTION') {
      const result = buildActionResult(
        packet,
        { ...FRAME, model: 'x/y', regenerations: 1 },
        resolution.action
      );
      expect(result.action).toEqual({
        type: 'OPEN_TRADE_SETUP',
        cycle_slot: '2026-09-18T20:55Z',
        trader_type: 'SCALPER',
        zone_ids: ['Z1', 'Z2'],
      });
      expect(result.provenance).toMatchObject({
        model: null,
        prompt_version: null,
      });
      expect(result.checks).toEqual({ numbers_flagged: 0, regenerations: 0 });
      expect(validateReplyResult(result)).toMatchObject({ ok: true });
    }
  });
});

describe('5.14 item 4: a chart from another cycle is dropped, and the reply says so', () => {
  const SLOT_SECONDS = Date.UTC(2026, 8, 18, 20, 55) / 1000;
  const stamp = (slot: number) => ({
    slot,
    lastClosedBar: slot - 300,
    overlay: 'best_fit_a',
    variant: 'overlay' as const,
  });
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  const portFor = (slot: number): ChartPort & { fetched: number } => {
    const state = { fetched: 0 };
    return Object.assign(state, {
      getChartStamp: async () => stamp(slot),
      getChartImage: async () => {
        state.fetched += 1;
        return { bytes: PNG, contentType: 'image/png', stamp: stamp(slot) };
      },
    });
  };

  it('says "other cycle" in the report, in the answer and in the fixed answer, and sends nothing', async () => {
    const { packet, dictionary } = await worldOf('01');
    const port = portFor(SLOT_SECONDS - 300);
    const chart = await readChart(
      {
        cycleSlot: packet.data.cycle_slot,
        dataAllows: true,
        calledFor: true,
        tierAllows: true,
        modelVision: true,
      },
      port
    );
    expect(chart.decision).toBe('CYCLE_MISMATCH');
    expect(chart.image).toBeNull();
    expect(port.fetched).toBe(0);
    const notes = chart.note === null ? [] : [chart.note];
    expect(notes).toEqual(['CHART_OTHER_CYCLE']);

    const frame: ReplyFrame = { ...FRAME, notes };
    const report = run(packet, dictionary, 'INSTANT_M5_INSPECT', {}, frame);
    expect(report.result.kind).toBe('REPORT1');
    expect(report.result.notes).toEqual(['CHART_OTHER_CYCLE']);
    const fixed = value(
      composeFixedAnswer({ packet, reason: 'DEADLINE', dictionary, frame })
    );
    expect(fixed.notes).toEqual(['CHART_OTHER_CYCLE']);
    const answered = run(packet, dictionary, 'EXPLAIN', {}, frame);
    expect(answered.result.notes).toEqual(['CHART_OTHER_CYCLE']);
    for (const out of [report.result, fixed, answered.result]) {
      expect(validateReplyResult(out)).toMatchObject({ ok: true });
    }
  });

  it("says nothing about the chart when the cycle's own was sent, and the reply is the same otherwise", async () => {
    const { packet, dictionary } = await worldOf('01');
    const port = portFor(SLOT_SECONDS);
    const chart = await readChart(
      {
        cycleSlot: packet.data.cycle_slot,
        dataAllows: true,
        calledFor: true,
        tierAllows: true,
        modelVision: true,
      },
      port
    );
    expect(chart.decision).toBe('SENT');
    expect(chart.note).toBeNull();
    const out = run(
      packet,
      dictionary,
      'INSTANT_M5_INSPECT',
      {},
      { ...FRAME, notes: [] }
    );
    expect(out.result.notes).toEqual([]);
  });

  it('puts the same note on a reply whose chart could not be read at all', async () => {
    const { packet } = await worldOf('01');
    const chart = await readChart(
      {
        cycleSlot: packet.data.cycle_slot,
        dataAllows: true,
        calledFor: true,
        tierAllows: true,
        modelVision: true,
      },
      { getChartStamp: async () => null, getChartImage: async () => null }
    );
    expect(chart.note).toBe('CHART_UNAVAILABLE');
  });
});

describe('the packets the helper makes are the golden cycles, not invented ones', () => {
  it('has 16 cycles, and an instant prompt for each trader type', () => {
    expect(GOLDEN_IDS).toHaveLength(16);
    for (const type of TRADER_TYPE_LIST as readonly TraderType[]) {
      const p = packetOf('01', type, 'INSTANT_M15_INSPECT');
      expect(p.question.source).toBe('INSTANT');
      expect(p.profile.trader_type).toBe(type);
    }
  });
});
