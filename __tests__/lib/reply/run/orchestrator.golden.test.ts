/**
 * @jest-environment node
 */

/**
 * The orchestrator over the 16 golden cycles and both trader types (build step 7 part 7a;
 * acceptance 5.14 items 1, 3 and 7; plan part 7 "Tests"): a typed question and an instant prompt
 * become a Report 1 whose direction is the synthesis reading's, a trace that equals what
 * happened, a settled ledger line and two stored messages. The model is the fixture model with
 * a recorded good reply; everything around it runs for real.
 */

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));

import type { TraderType } from '@/lib/reply/contracts/intake';
import type { Report1Result } from '@/lib/reply/contracts/result';
import { validateReplyTrace } from '@/lib/reply/contracts/trace-fields';

import { GOLDENS, buildWorld, run, USER } from './helpers/world';

const TRADER_TYPES: TraderType[] = ['DAY_TRADER', 'SCALPER'];

describe.each(GOLDENS.map((g, index) => ({ name: g.name, index })))(
  'golden $name',
  ({ index }) => {
    it.each(TRADER_TYPES)('%s: a typed question', async (traderType) => {
      const w = await buildWorld({ golden: index, traderType });
      const out = await run(w, { kind: 'TYPED' });
      expect(out.kind).toBe('REPLY');
      if (out.kind !== 'REPLY') return;
      expect(out.replayed).toBe(false);
      const result = out.result as Report1Result;
      expect(result.kind).toBe('REPORT1');

      // the direction is the synthesis reading's, field for field (acceptance 5.14 item 7)
      const reading = JSON.parse(
        w.world.synthesis.find((r) => r.profile === traderType)!.reading_json
      ) as Record<string, unknown>;
      expect(result.report.direction).toEqual({
        bias: reading['bias'],
        trend_relation: reading['trend_relation'] ?? null,
        rule_id: reading['rule_id'],
        archetype: reading['archetype'] ?? null,
        stand_aside: reading['stand_aside'],
        profile: traderType,
      });

      // the model was asked once, the fallback never
      expect(w.primary?.count).toBe(1);
      expect(w.fallback).toBeNull();

      // the trace row says what happened and passes the contract
      expect(w.traces.rows.size).toBe(1);
      const row = [...w.traces.rows.values()][0]!;
      // (the fake database clones with the outer realm's `structuredClone`; a JSON round trip makes plain objects)
      const plain = (value: unknown): unknown =>
        JSON.parse(JSON.stringify(value));
      expect(
        validateReplyTrace({
          request: plain(row.request_group),
          data: plain(row.data_group),
          knowledge: plain(row.knowledge_group),
          model: plain(row.model_group),
          checks: plain(row.checks_group),
          risk: null,
          time: plain(row.time_group),
          outcome: row.outcome,
        }).ok
      ).toBe(true);
      expect(row.outcome).toBe('REPORT1');
      expect(row.model).toBe(result.provenance.model);
      expect(row.thread_id).toBe(result.thread_id);
      expect(row.regenerations).toBe(0);
      expect(row.reply_sha256).not.toBeNull();
      expect(
        (row.checks_group as { direction_equals_syn: boolean })
          .direction_equals_syn
      ).toBe(true);

      // the ledger line is settled for the Understand call plus the reply, and the books balance
      const reservation = [...w.ledger.reservations.values()][0]!;
      expect(reservation.status).toBe('SETTLED');
      expect(reservation.user_id).toBe(USER);
      expect(reservation.actual_units).toBe(300 + 2_500);
      expect(row.units_charged).toBe(300 + 2_500);
      const period = [...w.ledger.periods.values()][0]!;
      expect(period.used).toBe(300 + 2_500);
      expect(period.reserved).toBe(0);

      // the thread was made, titled from the answer, and holds the two messages
      expect(w.chat.threads.size).toBe(1);
      const thread = [...w.chat.threads.values()][0]!;
      expect(thread.id).toBe(result.thread_id);
      expect(thread.message_count).toBe(2);
      expect(thread.report_count).toBe(1);
      expect(thread.last_bias).toBe(reading['bias']);
      expect(w.chat.messages.map((m) => m.role)).toEqual(['USER', 'ASSISTANT']);
      expect(w.chat.messages[1]!.request_id).toBe(out.requestId);
    });

    it('an instant prompt', async () => {
      const w = await buildWorld({ golden: index });
      const out = await run(w, {
        kind: 'INSTANT',
        intent: 'INSTANT_M15_INSPECT',
      });
      expect(out.kind).toBe('REPLY');
      if (out.kind !== 'REPLY') return;
      expect(out.result.kind).toBe('REPORT1');
      // an instant prompt has no Understand call: only the reply was paid for
      expect(w.fake.calls.understand).toBe(0);
      const reservation = [...w.ledger.reservations.values()][0]!;
      expect(reservation.status).toBe('SETTLED');
      expect(reservation.actual_units).toBe(2_500);
      // the message of an instant prompt holds no question text
      expect(w.chat.messages[0]!.body_text).toBeNull();
      expect(w.chat.messages[0]!.kind).toBe('INSTANT');
    });
  }
);
