/**
 * @jest-environment node
 */

/**
 * The judge (build step 7 part 10): what the checks find in the replies a cell's calls returned,
 * by the same sequence the answer step uses. Each case is a small story of calls: a clean reply, a
 * reply asked for again because the JSON was cut, a wrong price that survives its regeneration, a
 * listed phrase that does not, and the one extra call that the schema retry and the regeneration
 * SHARE (decision D11).
 *
 * The orchestrator and the judge are held together cell by cell in `eval-gate.test.ts` (the harness
 * throws when they disagree); this file is the judge alone, on worlds it knows by heart.
 */

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));

import { scenarioById } from '@/lib/reply/eval/scenarios';
import type { Scenario } from '@/lib/reply/eval/scenarios';
import { expectationProblems, judgeReplies } from '@/lib/reply/eval/suite';
import type {
  CallRecord,
  CellRecord,
  JudgeWorld,
} from '@/lib/reply/eval/suite';

import { worldEntry } from './helpers/harness';
import {
  adviceSentence,
  asJson,
  standInAnswer,
  standInReport,
  withBadJson,
  withBadZone,
  withBannedPhrase,
  withWrongPrice,
} from './helpers/stand-in';

const scenario = (id: string): Scenario => scenarioById(id) as Scenario;

async function worldOf(
  id: string,
  trader: 'DAY_TRADER' | 'SCALPER' = 'DAY_TRADER',
  locale = 'en-US'
): Promise<{
  world: JudgeWorld;
  good: string;
  report: ReturnType<typeof standInReport>;
}> {
  const entry = await worldEntry(scenario(id), trader, locale);
  const report = standInReport(entry.packet, entry.dictionary, locale);
  return { world: entry.judge, good: asJson(report), report };
}

describe('a clean reply', () => {
  it('is delivered at once, with nothing retried, flagged or regenerated', async () => {
    const { world, good } = await worldOf('G01');
    expect(judgeReplies(world, [good])).toEqual({
      schema_ok_first: true,
      schema_retries: 0,
      schema_ok_final: true,
      regenerations: 0,
      final_action: 'DELIVER',
      fixed_reason: null,
      numbers_flagged: 0,
      numbers_unverified_shown: 0,
      wording_violations_shown: 0,
      direction_equals_syn: true,
      zones_valid: true,
      stand_aside_kept: true,
      clean: true,
    });
  });

  it('ignores a second reply it never asked for', async () => {
    const { world, good } = await worldOf('G01');
    expect(judgeReplies(world, [good, withBadJson(JSON.parse(good))])).toEqual(
      judgeReplies(world, [good])
    );
  });

  it('is judged the same for both trader types and for a stand-aside reading', async () => {
    for (const id of ['G04', 'G09', 'G12', 'G15']) {
      for (const trader of ['DAY_TRADER', 'SCALPER'] as const) {
        const { world, good } = await worldOf(id, trader);
        const judged = judgeReplies(world, [good])!;
        expect(judged.clean).toBe(true);
        expect(judged.direction_equals_syn).toBe(true);
        expect(judged.stand_aside_kept).toBe(true);
      }
    }
  });

  it('is judged in every language (a short answer too)', async () => {
    for (const locale of ['ar', 'ja', 'th', 'zh-TW', 'pt-BR']) {
      const { world, good } = await worldOf('G01', 'DAY_TRADER', locale);
      expect(judgeReplies(world, [good])!.clean).toBe(true);
    }
    const entry = await worldEntry(scenario('D01b'), 'DAY_TRADER', 'en-US');
    const answer = asJson(standInAnswer(entry.packet, 'en-US'));
    const judged = judgeReplies(entry.judge, [answer])!;
    expect(judged).toMatchObject({
      clean: true,
      final_action: 'DELIVER',
      direction_equals_syn: null,
    });
  });
});

describe('the schema retry', () => {
  it('malformed JSON, then a good reply: delivered after ONE retry, which is not "clean"', async () => {
    const { world, good, report } = await worldOf('G01');
    const judged = judgeReplies(world, [withBadJson(report), good])!;
    expect(judged).toMatchObject({
      schema_ok_first: false,
      schema_retries: 1,
      schema_ok_final: true,
      regenerations: 0,
      final_action: 'DELIVER',
      clean: false,
    });
  });

  it('a zone id the cycle does not have, then a good reply: the same', async () => {
    const { world, good, report } = await worldOf('G01');
    const judged = judgeReplies(world, [withBadZone(report, 'Z5'), good])!;
    expect(judged).toMatchObject({
      schema_ok_first: false,
      schema_retries: 1,
      schema_ok_final: true,
    });
  });

  it('still wrong after the retry: SCHEMA_FAILED, nothing delivered', async () => {
    const { world, report } = await worldOf('G01');
    const bad = withBadJson(report);
    expect(judgeReplies(world, [bad, bad])).toMatchObject({
      schema_ok_final: false,
      schema_retries: 1,
      final_action: 'FIXED_ANSWER',
      fixed_reason: 'SCHEMA_FAILED',
      direction_equals_syn: null,
      clean: false,
    });
  });

  it('the retry returned nothing (the model went down): SCHEMA_FAILED', async () => {
    const { world, report } = await worldOf('G01');
    expect(judgeReplies(world, [withBadJson(report), null])).toMatchObject({
      fixed_reason: 'SCHEMA_FAILED',
    });
    expect(judgeReplies(world, [withBadJson(report)])).toMatchObject({
      fixed_reason: 'SCHEMA_FAILED',
    });
  });

  it('a reply that is JSON but not an object of the schema fails it', async () => {
    const { world } = await worldOf('G01');
    for (const text of ['[]', '"x"', '{}', 'null', '{"headline": 1}']) {
      expect(judgeReplies(world, [text, text])).toMatchObject({
        fixed_reason: 'SCHEMA_FAILED',
      });
    }
  });

  it('nothing at all from the first call: no judgement', async () => {
    const { world } = await worldOf('G01');
    expect(judgeReplies(world, [])).toBeNull();
    expect(judgeReplies(world, [null])).toBeNull();
    expect(judgeReplies(world, [null, 'x'])).toBeNull();
  });
});

describe('a wrong price (5.8, ADR-053)', () => {
  it('is regenerated once and, when the regeneration is clean, is not shown at all', async () => {
    const { world, good, report } = await worldOf('G01');
    const judged = judgeReplies(world, [withWrongPrice(report), good])!;
    expect(judged).toMatchObject({
      regenerations: 1,
      numbers_flagged: 0,
      final_action: 'DELIVER',
      numbers_unverified_shown: 0,
      clean: false,
    });
  });

  it('survives the regeneration: shown as "not verified", counted once, never as an unverified number SHOWN', async () => {
    const { world, report } = await worldOf('G01');
    const wrong = withWrongPrice(report);
    expect(judgeReplies(world, [wrong, wrong])).toMatchObject({
      regenerations: 1,
      numbers_flagged: 1,
      final_action: 'FLAG_NUMBERS',
      numbers_unverified_shown: 0,
      direction_equals_syn: true,
      clean: false,
    });
  });

  it('is flagged at once when no regeneration is possible because the retry already took the extra call', async () => {
    const { world, report } = await worldOf('G01');
    const wrong = withWrongPrice(report);
    // call 1 is not JSON (spends the one extra call on the retry); call 2 is valid but has the wrong price
    const judged = judgeReplies(world, [withBadJson(report), wrong])!;
    expect(judged).toMatchObject({
      schema_retries: 1,
      regenerations: 0,
      numbers_flagged: 1,
      final_action: 'FLAG_NUMBERS',
    });
    // a third call, if the model made one, is never asked for
    expect(
      judgeReplies(world, [withBadJson(report), wrong, JSON.stringify(report)])
    ).toEqual(judged);
  });

  it('a regeneration that returned nothing leaves the first reply to be judged as it stands', async () => {
    const { world, report } = await worldOf('G01');
    const judged = judgeReplies(world, [withWrongPrice(report), null])!;
    expect(judged).toMatchObject({
      regenerations: 1,
      numbers_flagged: 1,
      final_action: 'FLAG_NUMBERS',
    });
  });
});

describe('a listed phrase (5.9, ADR-056)', () => {
  it('is regenerated once and, when the regeneration is clean, never reaches the reader', async () => {
    for (const locale of ['en-US', 'es', 'ja', 'ar', 'hi', 'zh-TW', 'ur']) {
      const { world, good, report } = await worldOf(
        'G01',
        'DAY_TRADER',
        locale
      );
      const banned = withBannedPhrase(report, locale);
      expect(banned).toContain(adviceSentence(locale).slice(0, 6));
      const judged = judgeReplies(world, [banned, good])!;
      expect(judged).toMatchObject({
        regenerations: 1,
        wording_violations_shown: 0,
        final_action: 'DELIVER',
        clean: false,
      });
    }
  });

  it('twice: the fixed answer, with no phrase shown', async () => {
    const { world, report } = await worldOf('G01');
    const banned = withBannedPhrase(report, 'en-US');
    expect(judgeReplies(world, [banned, banned])).toMatchObject({
      regenerations: 1,
      final_action: 'FIXED_ANSWER',
      fixed_reason: 'WORDING_FAILED',
      wording_violations_shown: 0,
      direction_equals_syn: null,
    });
  });

  it('with no regeneration left (the retry took it): the fixed answer at once', async () => {
    const { world, report } = await worldOf('G01');
    const banned = withBannedPhrase(report, 'en-US');
    expect(judgeReplies(world, [withBadJson(report), banned])).toMatchObject({
      schema_retries: 1,
      regenerations: 0,
      fixed_reason: 'WORDING_FAILED',
    });
  });
});

describe("the direction is the synthesis reading's", () => {
  it('whatever the model wrote, for every cycle and both trader types', async () => {
    for (let n = 1; n <= 16; n += 1) {
      const id = `G${String(n).padStart(2, '0')}`;
      for (const trader of ['DAY_TRADER', 'SCALPER'] as const) {
        const { world, good } = await worldOf(id, trader);
        const judged = judgeReplies(world, [good])!;
        expect([
          id,
          trader,
          judged.direction_equals_syn,
          judged.zones_valid,
          judged.stand_aside_kept,
        ]).toEqual([id, trader, true, true, true]);
      }
    }
  }, 60_000);
});

describe('what a cell is held to', () => {
  const base = (over: Partial<CellRecord> = {}): CellRecord => {
    const call: CallRecord = {
      slot: 'PRIMARY',
      host: 'fixture',
      text: '{}',
      tries: 1,
      prompt_tokens: 1,
      completion_tokens: 1,
      cached_tokens: 0,
      cost_micro_usd: 1,
      cost_estimated: false,
      latency_ms: 1,
    };
    return {
      id: 'G01.DAY_TRADER.en-US.1',
      scenario: 'G01',
      trader: 'DAY_TRADER',
      locale: 'en-US',
      pass: 1,
      outcome: 'REPORT1',
      fixed_reason: null,
      refusal: null,
      balance_shown: false,
      notes: [],
      direction_stated: true,
      direction_equals_syn: true,
      news_status: null,
      model_calls: 1,
      fallback_used: false,
      calls: [call],
      units: 1,
      latency_ms: 1,
      judgement: {
        schema_ok_first: true,
        schema_retries: 0,
        schema_ok_final: true,
        regenerations: 0,
        final_action: 'DELIVER',
        fixed_reason: null,
        numbers_flagged: 0,
        numbers_unverified_shown: 0,
        wording_violations_shown: 0,
        direction_equals_syn: true,
        zones_valid: true,
        stand_aside_kept: true,
        clean: true,
      },
      ...over,
    };
  };

  it('meets G01 when it is the clean Report 1 it should be', () => {
    expect(expectationProblems(scenario('G01'), base())).toEqual([]);
  });

  it.each([
    ['another outcome', { outcome: 'FIXED_ANSWER' as const }, 'the outcome'],
    [
      'a fixed reason',
      { fixed_reason: 'DATA_STALE' as const },
      'the fixed reason',
    ],
    ['a refusal', { refusal: 'QUOTA_INSUFFICIENT' }, 'the refusal'],
    ['two model calls', { model_calls: 2 }, 'the model calls'],
    ['no model call', { model_calls: 0 }, 'the model calls'],
    ['a note', { notes: ['CHART_UNAVAILABLE' as const] }, 'the notes'],
    ['a fallback', { fallback_used: true }, 'the fallback used'],
    [
      'a direction not stated',
      { direction_stated: false },
      'the direction stated',
    ],
    [
      'a direction that is not the synthesis',
      { direction_equals_syn: false },
      'the direction equal to the synthesis reading',
    ],
  ])('does not meet G01 with %s', (_name, over, words) => {
    expect(
      expectationProblems(scenario('G01'), base(over)).join('\n')
    ).toContain(words);
  });

  it('does not meet G01 with a regeneration, a retry or a flagged number', () => {
    const cell = base();
    cell.judgement = {
      ...cell.judgement!,
      regenerations: 1,
      schema_retries: 1,
      numbers_flagged: 2,
    };
    const problems = expectationProblems(scenario('G01'), cell).join('\n');
    expect(problems).toContain('the regenerations');
    expect(problems).toContain('the schema retries');
    expect(problems).toContain('the numbers flagged');
  });

  it('does not meet G01 with a zone that is not stored or a stand-aside that took a side', () => {
    const cell = base();
    cell.judgement = {
      ...cell.judgement!,
      zones_valid: false,
      stand_aside_kept: false,
    };
    const problems = expectationProblems(scenario('G01'), cell).join('\n');
    expect(problems).toContain('the zone ids valid');
    expect(problems).toContain('the stand-aside kept');
  });

  it('holds the quota refusal to showing the balance, and the calendar scenario to its status', () => {
    const refused = base({
      outcome: 'REFUSED',
      refusal: 'QUOTA_INSUFFICIENT',
      direction_stated: false,
      direction_equals_syn: null,
      model_calls: 0,
      judgement: null,
    });
    expect(expectationProblems(scenario('D07'), refused).join()).toContain(
      'the balance shown with the refusal'
    );
    expect(
      expectationProblems(scenario('D07'), { ...refused, balance_shown: true })
    ).toEqual([]);
    expect(
      expectationProblems(scenario('D09'), base({ news_status: 'OK' })).join()
    ).toContain('the calendar status');
    expect(
      expectationProblems(scenario('D09'), base({ news_status: 'LATE' }))
    ).toEqual([]);
  });
});
