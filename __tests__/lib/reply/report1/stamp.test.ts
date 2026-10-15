/**
 * @jest-environment node
 */

/**
 * The envelope of a reply (build step 7 part 5): the data stamp as data, the disclaimer as a
 * version, and the fields of `reply-result/1` that are not the reply itself.
 */

import { REPLY_RESULT_SCHEMA, REPLY_VERSION } from '@/lib/reply/version';
import { validateReplyResult } from '@/lib/reply/contracts/result';
import {
  DISCLAIMER_VERSION,
  buildActionResult,
  buildResultBase,
  buildStamp,
} from '@/lib/reply/report1/stamp';
import { VERSION } from '@/lib/reply/contracts/fields';

import { FRAME, overlay, packetOf } from './helpers/report1-fixtures';

describe('the data stamp', () => {
  it('is the cycle slot, the status, the retuning flag and the flags of the packet', () => {
    const packet = packetOf('01');
    expect(buildStamp(packet)).toEqual({
      as_of: '2026-09-18T20:55Z',
      data_status: 'FRESH',
      retuning: false,
      flags: [],
    });
  });

  it('follows every status, the retuning flag and the flags', () => {
    const packet = packetOf('01');
    for (const status of [
      'FRESH',
      'DELAYED',
      'STALE',
      'MARKET_CLOSED',
      'UNKNOWN',
    ] as const) {
      expect(buildStamp(overlay(packet, { status })).data_status).toBe(status);
    }
    expect(buildStamp(overlay(packet, { retuning: true })).retuning).toBe(true);
    expect(
      buildStamp(
        overlay(packet, { flags: ['SENSORS_NOT_LIVE', 'GATEWAY_UNREACHABLE'] })
      ).flags
    ).toEqual(['SENSORS_NOT_LIVE', 'GATEWAY_UNREACHABLE']);
  });

  it('has no cycle slot when none could be read', () => {
    const packet = packetOf('01');
    const none = { ...packet, data: { ...packet.data, cycle_slot: null } };
    expect(buildStamp(none).as_of).toBeNull();
  });

  it('does not share its flags with the packet', () => {
    const packet = overlay(packetOf('01'), { flags: ['SENSORS_NOT_LIVE'] });
    const stamp = buildStamp(packet);
    stamp.flags.push('GATEWAY_UNREACHABLE');
    expect(packet.data.flags).toEqual(['SENSORS_NOT_LIVE']);
  });
});

describe('the disclaimer', () => {
  it('is a version the contract accepts, not a sentence', () => {
    expect(DISCLAIMER_VERSION).toBe('disclaimer-1');
    expect(VERSION.test(DISCLAIMER_VERSION)).toBe(true);
  });
});

describe('the fields every result has', () => {
  it('come from the packet and the frame', () => {
    const packet = overlay(packetOf('02', 'SCALPER'), { locale: 'de' });
    const base = buildResultBase(
      packet,
      {
        ...FRAME,
        numbersFlagged: 3,
        regenerations: 1,
        changes: [{ mcd_id: 'MCD2', from: 'MCD2_UP_IN_CORRIDOR', to: null }],
        notes: ['CHART_UNAVAILABLE'],
      },
      'ANSWER'
    );
    expect(base).toEqual({
      schema: REPLY_RESULT_SCHEMA,
      kind: 'ANSWER',
      thread_id: FRAME.threadId,
      reply_locale: 'de',
      intent: 'DIRECTION',
      stamp: buildStamp(packet),
      disclaimer_version: DISCLAIMER_VERSION,
      provenance: {
        request_id: FRAME.requestId,
        model: FRAME.model,
        prompt_version: FRAME.promptVersion,
        reply_version: REPLY_VERSION,
      },
      checks: { numbers_flagged: 3, regenerations: 1 },
      changes: [{ mcd_id: 'MCD2', from: 'MCD2_UP_IN_CORRIDOR', to: null }],
      notes: ['CHART_UNAVAILABLE'],
    });
  });

  it('name another release of the reply rules when the frame does', () => {
    const base = buildResultBase(
      packetOf('01'),
      { ...FRAME, numbersFlagged: 0, replyVersion: '2.0.0' },
      'REPORT1'
    );
    expect(base.provenance.reply_version).toBe('2.0.0');
  });

  it('copy the changes and the notes rather than share them', () => {
    const changes = [{ mcd_id: 'MCD2', from: null, to: 'MCD2_X' }];
    const notes: ('CHART_OTHER_CYCLE' | 'CHART_UNAVAILABLE')[] = [
      'CHART_OTHER_CYCLE',
    ];
    const base = buildResultBase(
      packetOf('01'),
      { ...FRAME, numbersFlagged: 0, changes, notes },
      'ANSWER'
    );
    base.changes.push({ mcd_id: 'MCD3', from: null, to: null });
    base.changes[0]!.to = 'CHANGED';
    base.notes.push('CHART_UNAVAILABLE');
    expect(changes).toEqual([{ mcd_id: 'MCD2', from: null, to: 'MCD2_X' }]);
    expect(notes).toEqual(['CHART_OTHER_CYCLE']);
  });
});

describe('the result of a request that opens the Trade Setup', () => {
  const action = {
    type: 'OPEN_TRADE_SETUP' as const,
    cycle_slot: '2026-09-18T20:55Z',
    trader_type: 'DAY_TRADER' as const,
    zone_ids: ['Z1'],
  };

  it('names no model and no prompt, flags nothing and regenerates nothing, whatever the frame says', () => {
    const packet = packetOf('01', 'DAY_TRADER', 'REPORT_2');
    const result = buildActionResult(
      packet,
      {
        ...FRAME,
        model: 'google/gemini-2.5-flash',
        regenerations: 1,
        numbersFlagged: 4,
      } as never,
      action
    );
    expect(result.kind).toBe('ACTION');
    expect(result.provenance.model).toBeNull();
    expect(result.provenance.prompt_version).toBeNull();
    expect(result.checks).toEqual({ numbers_flagged: 0, regenerations: 0 });
    expect(result.intent).toBe('REPORT_2');
    expect(result.action).toEqual(action);
    expect(validateReplyResult(result)).toEqual({ ok: true, value: result });
  });

  it('copies the action', () => {
    const result = buildActionResult(
      packetOf('01', 'DAY_TRADER', 'REPORT_2'),
      FRAME,
      action
    );
    result.action.zone_ids.push('Z2');
    expect(action.zone_ids).toEqual(['Z1']);
  });
});
