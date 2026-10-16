/**
 * @jest-environment node
 */

/**
 * The arithmetic of the table in architecture 5.10 (build step 7 part 10): basis points, the
 * nearest-rank percentile, a language's score and its gap to English at the boundary of 5 points,
 * and the seven rows of the suite.
 */

import { EVAL_LOCALES } from '@/lib/reply/eval/languages';
import {
  basisPoints,
  costTime,
  evaluateBars,
  localeScores,
  percentile,
} from '@/lib/reply/eval/scoring';
import type { Judgement, ScoredCell } from '@/lib/reply/eval/scoring';

const judged = (over: Partial<Judgement> = {}): Judgement => ({
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
  ...over,
});

const cell = (locale: string, over: Partial<ScoredCell> = {}): ScoredCell => ({
  locale,
  scored: true,
  judgement: judged(),
  expectation_met: true,
  units: 10_000,
  latency_ms: 4_000,
  model_replied: true,
  cost_estimated: false,
  ...over,
});

/** `runs` scored runs in every locale, of which `missed[locale]` are not clean. */
function grid(runs: number, missed: Record<string, number> = {}): ScoredCell[] {
  const out: ScoredCell[] = [];
  for (const locale of EVAL_LOCALES) {
    for (let i = 0; i < runs; i += 1) {
      const miss = i < (missed[locale] ?? 0);
      out.push(
        cell(
          locale,
          miss ? { judgement: judged({ clean: false, regenerations: 1 }) } : {}
        )
      );
    }
  }
  return out;
}

describe('basisPoints', () => {
  it('is the share in hundredths of a point, rounded half up, and null for nothing', () => {
    expect(basisPoints(1, 1)).toBe(10_000);
    expect(basisPoints(19, 20)).toBe(9_500);
    expect(basisPoints(1, 3)).toBe(3_333);
    expect(basisPoints(2, 3)).toBe(6_667);
    expect(basisPoints(1, 8)).toBe(1_250);
    expect(basisPoints(1, 16)).toBe(625);
    expect(basisPoints(0, 5)).toBe(0);
    expect(basisPoints(0, 0)).toBeNull();
    expect(basisPoints(3, -1)).toBeNull();
  });
});

describe('percentile (nearest rank: always a value that occurred)', () => {
  it('takes the value of rank ceil(p/100 * n)', () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentile(values, 50)).toBe(50);
    expect(percentile(values, 90)).toBe(90);
    expect(percentile(values, 95)).toBe(100);
    expect(percentile(values, 100)).toBe(100);
    expect(percentile([7], 90)).toBe(7);
    expect(percentile([], 90)).toBeNull();
    // unsorted input, and the list is left as it was
    const loose = [5, 1, 3];
    expect(percentile(loose, 50)).toBe(3);
    expect(loose).toEqual([5, 1, 3]);
  });
});

describe('a language score and its gap to English (the bar: within 5 points)', () => {
  it('is 5.00 points under: inside; 10.00 under: outside (20 scored runs, so one miss is exactly 5 points)', () => {
    const one = localeScores(grid(20, { ar: 1 }));
    const ar1 = one.find((s) => s.locale === 'ar')!;
    expect(ar1).toMatchObject({
      runs: 20,
      clean: 19,
      score_bp: 9_500,
      gap_bp: 500,
      ok: true,
    });

    const two = localeScores(grid(20, { ar: 2 }));
    const ar2 = two.find((s) => s.locale === 'ar')!;
    expect(ar2).toMatchObject({ clean: 18, gap_bp: 1_000, ok: false });
    // nobody else is touched
    expect(two.filter((s) => !s.ok).map((s) => s.locale)).toEqual(['ar']);
  });

  it('is judged on 34 runs as the suite has them: one miss is 2.9 points, two are 5.9', () => {
    const one = localeScores(grid(34, { ur: 1 })).find(
      (s) => s.locale === 'ur'
    )!;
    const two = localeScores(grid(34, { ur: 2 })).find(
      (s) => s.locale === 'ur'
    )!;
    expect(one.gap_bp).toBe(294);
    expect(one.ok).toBe(true);
    expect(two.gap_bp).toBe(588);
    expect(two.ok).toBe(false);
  });

  it('compares a locale with English, never with the best locale: a locale above English is fine, English itself is never "under"', () => {
    const scores = localeScores(grid(20, { 'en-US': 3 }));
    const english = scores.find((s) => s.locale === 'en-US')!;
    expect(english).toMatchObject({ gap_bp: 0, ok: true, score_bp: 8_500 });
    expect(scores.find((s) => s.locale === 'de')!.gap_bp).toBe(-1_500);
    expect(scores.every((s) => s.ok)).toBe(true);
  });

  it('does not count a run that is not scored', () => {
    const cells = [
      ...grid(10),
      ...EVAL_LOCALES.map((locale) =>
        cell(locale, { scored: false, judgement: judged({ clean: false }) })
      ),
    ];
    expect(localeScores(cells).every((s) => s.runs === 10 && s.ok)).toBe(true);
  });

  it('cannot show a locale with no scored run to be within 5 points: it fails; English with none fails everyone', () => {
    const noThai = grid(10).filter((c) => c.locale !== 'th');
    const scores = localeScores(noThai);
    expect(scores.find((s) => s.locale === 'th')).toMatchObject({
      runs: 0,
      score_bp: null,
      gap_bp: null,
      ok: false,
    });
    expect(scores.filter((s) => !s.ok).map((s) => s.locale)).toEqual(['th']);

    const noEnglish = localeScores(
      grid(10).filter((c) => c.locale !== 'en-US')
    );
    expect(noEnglish.find((s) => s.locale === 'en-US')!.ok).toBe(false);
    expect(noEnglish.every((s) => !s.ok)).toBe(true);
  });

  it('counts a run without a judgement (no reply) as not clean', () => {
    const cells = grid(10);
    cells.find((c) => c.locale === 'ja')!.judgement = null;
    const ja = localeScores(cells).find((s) => s.locale === 'ja')!;
    expect(ja).toMatchObject({ runs: 10, clean: 9 });
  });
});

describe('cost and time', () => {
  it('are the median and the 90th percentile of the replies a model wrote', () => {
    const cells = Array.from({ length: 10 }, (_, i) =>
      cell('en-US', { units: (i + 1) * 1_000, latency_ms: (i + 1) * 500 })
    );
    cells.push(
      cell('en-US', {
        model_replied: false,
        units: 999_999,
        latency_ms: 999_999,
      })
    );
    expect(costTime(cells)).toEqual({
      messages: 10,
      estimated: 0,
      units_p50: 5_000,
      units_p90: 9_000,
      latency_p50_ms: 2_500,
      latency_p90_ms: 4_500,
    });
    expect(costTime([])).toMatchObject({
      messages: 0,
      units_p50: null,
      latency_p90_ms: null,
    });
  });
});

describe('the seven rows', () => {
  const rowOf = (cells: ScoredCell[], key: string) =>
    evaluateBars(cells).find((bar) => bar.key === key)!;

  it('all hold for clean replies, and the table has the order of 5.10', () => {
    const bars = evaluateBars(grid(5));
    expect(bars.map((b) => b.key)).toEqual([
      'GOLDEN',
      'SCHEMA',
      'NUMBERS',
      'WORDING',
      'LANGUAGES',
      'COST_TIME',
      'EXPECTATIONS',
    ]);
    expect(bars.every((b) => b.ok)).toBe(true);
    expect(bars.find((b) => b.key === 'LANGUAGES')!.detail).toContain(
      '19 of 19'
    );
  });

  it('GOLDEN fails on a direction, a zone or a stand-aside that is wrong, and on nothing composed', () => {
    for (const bad of [
      { direction_equals_syn: false },
      { zones_valid: false },
      { stand_aside_kept: false },
    ]) {
      const cells = grid(5);
      cells[0]!.judgement = judged(bad);
      expect(rowOf(cells, 'GOLDEN')).toMatchObject({ ok: false, failed: 1 });
    }
    expect(rowOf([cell('en-US', { judgement: null })], 'GOLDEN').ok).toBe(
      false
    );
  });

  it('SCHEMA, NUMBERS and WORDING fail on one bad reply each, and count a retried reply as fine', () => {
    const retried = grid(5);
    retried[0]!.judgement = judged({
      schema_retries: 1,
      schema_ok_first: false,
      clean: false,
    });
    expect(rowOf(retried, 'SCHEMA')).toMatchObject({ ok: true, failed: 0 });

    const schema = grid(5);
    schema[0]!.judgement = judged({ schema_ok_final: false });
    expect(rowOf(schema, 'SCHEMA')).toMatchObject({ ok: false, failed: 1 });
    const numbers = grid(5);
    numbers[0]!.judgement = judged({ numbers_unverified_shown: 2 });
    expect(rowOf(numbers, 'NUMBERS')).toMatchObject({ ok: false, failed: 1 });
    const wording = grid(5);
    wording[0]!.judgement = judged({ wording_violations_shown: 1 });
    expect(rowOf(wording, 'WORDING')).toMatchObject({ ok: false, failed: 1 });
    // a flagged number is not an unverified number SHOWN: it was replaced by the mark
    const flagged = grid(5);
    flagged[0]!.judgement = judged({
      numbers_flagged: 1,
      clean: false,
      final_action: 'FLAG_NUMBERS',
    });
    expect(rowOf(flagged, 'NUMBERS').ok).toBe(true);
  });

  it('EXPECTATIONS fails on any cell that did not meet its scenario, COST_TIME on nothing measured', () => {
    const cells = grid(5);
    cells[3]!.expectation_met = false;
    expect(rowOf(cells, 'EXPECTATIONS')).toMatchObject({
      ok: false,
      failed: 1,
    });
    expect(rowOf([], 'EXPECTATIONS').ok).toBe(false);
    const unmeasured = grid(5).map((c) => ({ ...c, model_replied: false }));
    expect(rowOf(unmeasured, 'COST_TIME').ok).toBe(false);
  });
});
