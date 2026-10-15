/**
 * @jest-environment node
 */

/**
 * The two acceptance tests of build step 7 part 4.
 *
 *  - the PLANTED-violation corpus: a banned phrase of each of the five "never" rows of 5.9, and a
 *    headline on the wrong side of the synthesis, in every one of the 19 locales. Every one must be
 *    caught (100%), and the same sentence without the violation must pass.
 *  - the GOOD-reply corpus: whole replies that break no rule, in every locale, with the numbers
 *    typed in the notation and the digits of that locale. NOTHING may be flagged: a false positive
 *    costs a second model call and, past it, a visible "not verified".
 */

import { checkNumbers } from '@/lib/reply/checks/number-check';
import { runChecks } from '@/lib/reply/checks/report';
import { checkWording } from '@/lib/reply/checks/wording-check';
import type { ModelText } from '@/lib/reply/checks/wording-check';
import { NEVER_CATEGORIES } from '@/lib/reply/checks/wording-lists';
import { BIASES } from '@/lib/reply/contracts/intake';
import type { Bias } from '@/lib/reply/contracts/intake';
import { report1Texts } from '@/lib/reply/contracts/report1';

import {
  ALL_GOLDEN_IDS,
  TRADER_TYPES_FOR_TESTS,
} from '../context/helpers/context-fixtures';
import { STORED_REPORTS } from '../helpers/fixtures';
import { CORPUS, CORPUS_LANGUAGES, CORPUS_LOCALES } from './helpers/corpus';
import type { GoodReply } from './helpers/corpus';
import { fixtureFor } from './helpers/checks-fixtures';

const BIASES_AND_NONE: readonly (Bias | null)[] = [...BIASES, null];

const asTexts = (good: GoodReply): ModelText[] => [
  { path: 'headline', text: good.headline },
  { path: 'rationale[0].text', text: good.rationale[0] },
  { path: 'rationale[1].text', text: good.rationale[1] },
  { path: 'watch[0].text', text: good.watch[0] },
  { path: 'risks[0].text', text: good.risks[0] },
];

describe('the corpus is complete', () => {
  it('has the 19 locales of 17 languages', () => {
    expect(CORPUS_LANGUAGES).toHaveLength(17);
    expect(CORPUS_LOCALES).toHaveLength(19);
    expect(new Set(CORPUS_LOCALES.map((l) => l.locale)).size).toBe(19);
  });

  it('has, in every language, a planted pair for each of the five rows and the four direction cases', () => {
    for (const language of CORPUS_LANGUAGES) {
      const entry = CORPUS[language];
      expect(Object.keys(entry?.never ?? {}).sort()).toEqual(
        [...NEVER_CATEGORIES].sort()
      );
      for (const pair of Object.values(entry?.never ?? {})) {
        expect(pair.bad).not.toBe(pair.ok);
        expect(pair.bad.length).toBeGreaterThan(8);
      }
      expect(Object.keys(entry?.direction ?? {}).sort()).toEqual([
        'longBiasBad',
        'ok',
        'shortBiasBad',
        'standAsideBad',
      ]);
    }
  });
});

describe('planted violations: every one is caught, in every locale and every row', () => {
  const cases = CORPUS_LOCALES.flatMap(({ locale, language }) =>
    NEVER_CATEGORIES.map((category) => [locale, language, category] as const)
  );

  it('has 95 cases', () => {
    expect(cases).toHaveLength(95);
  });

  it.each(cases)(
    '%s: a %s phrase in %s is caught as that row',
    (locale, language, category) => {
      const bad = CORPUS[language]?.never[category].bad as string;
      for (const bias of BIASES_AND_NONE) {
        const result = checkWording(
          [{ path: 'rationale[0].text', text: bad }],
          locale,
          bias
        );
        expect({
          locale,
          category,
          bias,
          caught: result.categories[category] > 0,
        }).toEqual({
          locale,
          category,
          bias,
          caught: true,
        });
        expect(result.ok).toBe(false);
      }
    }
  );

  it.each(cases)(
    '%s: the same sentence without it passes (%s, %s)',
    (locale, language, category) => {
      const ok = CORPUS[language]?.never[category].ok as string;
      for (const bias of BIASES_AND_NONE) {
        const result = checkWording(
          [{ path: 'rationale[0].text', text: ok }],
          locale,
          bias
        );
        expect({ locale, category, bias, findings: result.findings }).toEqual({
          locale,
          category,
          bias,
          findings: [],
        });
      }
    }
  );

  it('is caught 100%: 95 of 95', () => {
    let caught = 0;
    for (const [locale, language, category] of cases) {
      const bad = CORPUS[language]?.never[category].bad as string;
      if (
        checkWording([{ path: 'text', text: bad }], locale, null).categories[
          category
        ] > 0
      )
        caught += 1;
    }
    expect(caught).toBe(95);
  });

  it('is caught whichever text of the reply carries it', () => {
    for (const { locale, language } of CORPUS_LOCALES) {
      const bad = CORPUS[language]?.never.ADVICE.bad as string;
      for (const path of [
        'headline',
        'rationale[0].text',
        'watch[0].text',
        'risks[1].text',
        'text',
      ]) {
        expect(
          checkWording([{ path, text: bad }], locale, 'LONG').categories.ADVICE
        ).toBeGreaterThan(0);
      }
    }
  });
});

describe('the direction guard: a headline on the wrong side is caught in every locale', () => {
  it.each(CORPUS_LOCALES.map((l) => [l.locale, l.language] as const))(
    '%s (%s)',
    (locale, language) => {
      const d = CORPUS[language]?.direction;
      if (d === undefined) throw new Error(language);
      const head = (text: string): ModelText[] => [{ path: 'headline', text }];
      const direction = (text: string, bias: Bias | null): number =>
        checkWording(head(text), locale, bias).categories.DIRECTION_WORD;
      expect(direction(d.longBiasBad, 'LONG')).toBeGreaterThan(0);
      expect(direction(d.shortBiasBad, 'SHORT')).toBeGreaterThan(0);
      expect(direction(d.standAsideBad, 'STAND_ASIDE')).toBeGreaterThan(0);
      expect(direction(d.standAsideBad, 'NEUTRAL')).toBeGreaterThan(0);
      expect(direction(d.standAsideBad, null)).toBeGreaterThan(0);
      // and the right side, or the neutral headline, passes
      expect(direction(d.longBiasBad, 'SHORT')).toBe(0);
      expect(direction(d.shortBiasBad, 'LONG')).toBe(0);
      for (const bias of BIASES_AND_NONE) expect(direction(d.ok, bias)).toBe(0);
    }
  );

  it('does not hold a watch or a risk line to the reading', () => {
    for (const { locale, language } of CORPUS_LOCALES) {
      const d = CORPUS[language]?.direction;
      if (d === undefined) throw new Error(language);
      for (const path of ['watch[0].text', 'risks[0].text']) {
        expect(
          checkWording([{ path, text: d.longBiasBad }], locale, 'LONG')
            .categories.DIRECTION_WORD
        ).toBe(0);
        expect(
          checkWording([{ path, text: d.standAsideBad }], locale, 'STAND_ASIDE')
            .categories.DIRECTION_WORD
        ).toBe(0);
      }
    }
  });
});

describe('good replies: nothing is flagged', () => {
  it.each(CORPUS_LOCALES.map((l) => [l.locale, l.language] as const))(
    '%s (%s): the whole reply passes both checks, for every reading',
    async (locale, language) => {
      const good = CORPUS[language]?.good;
      if (good === undefined) throw new Error(language);
      const { dictionary } = await fixtureFor('01');
      for (const bias of BIASES_AND_NONE) {
        const pass = runChecks({
          texts: asTexts(good),
          dictionary,
          locale,
          bias,
        });
        expect({
          locale,
          bias,
          wording: pass.wording.findings,
          numbers: pass.numbers.violations,
        }).toEqual({
          locale,
          bias,
          wording: [],
          numbers: [],
        });
      }
    }
  );

  it('has no false positive in 19 locales x 5 readings: 0 of 95', async () => {
    const { dictionary } = await fixtureFor('01');
    let flagged = 0;
    for (const { locale, language } of CORPUS_LOCALES) {
      for (const bias of BIASES_AND_NONE) {
        const good = CORPUS[language]?.good as GoodReply;
        const pass = runChecks({
          texts: asTexts(good),
          dictionary,
          locale,
          bias,
        });
        if (pass.wording.violations > 0 || pass.numbers.violations.length > 0)
          flagged += 1;
      }
    }
    expect(flagged).toBe(0);
  });

  it('passes the three stored reports of the fixture set, with the synthesis reading of each cycle', async () => {
    for (const [prefix, report] of STORED_REPORTS) {
      const fixture = await fixtureFor(prefix);
      const syn = fixture.packet.board.syn;
      const pass = runChecks({
        texts: report1Texts(report),
        dictionary: fixture.dictionary,
        locale: 'en-US',
        bias: syn.state === 'RUNNING' ? syn.bias : null,
      });
      expect({
        prefix,
        findings: pass.wording.findings,
        numbers: pass.numbers.violations,
      }).toEqual({
        prefix,
        findings: [],
        numbers: [],
      });
    }
  });

  it('passes a reply built from the true values of every golden cycle and both trader types, typed in two notations', async () => {
    const cases = ALL_GOLDEN_IDS.flatMap((id) =>
      TRADER_TYPES_FOR_TESTS.map((t) => [id, t] as const)
    );
    for (const [id, trader] of cases) {
      const { dictionary, packet } = await fixtureFor(id.slice(0, 2), trader);
      const levels = dictionary.entries
        .filter((e) => e.addressable && e.kind === 'PRICE')
        .slice(0, 6);
      const distances = dictionary.entries
        .filter((e) => e.addressable && e.kind === 'DISTANCE')
        .slice(0, 3);
      const english = (v: number): string =>
        v.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      const german = (v: number): string =>
        v.toLocaleString('de-DE', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      for (const [locale, format] of [
        ['en-US', english],
        ['de', german],
      ] as const) {
        const sentence = [
          ...levels.map((e) => `level ${format(e.value)}`),
          ...distances.map((e) => `distance $${format(e.value)}`),
        ].join(', ');
        const pass = runChecks({
          texts: [{ path: 'rationale[0].text', text: sentence }],
          dictionary,
          locale,
          bias:
            packet.board.syn.state === 'RUNNING' ? packet.board.syn.bias : null,
        });
        expect({
          id,
          trader,
          locale,
          violations: pass.numbers.violations.map((v) => v.raw),
        }).toEqual({
          id,
          trader,
          locale,
          violations: [],
        });
      }
    }
  });

  it('flags the same replies the moment one price is moved by $0.06 or more', async () => {
    const { dictionary } = await fixtureFor('01');
    const real = dictionary.byId.get('MCD2.LOEDT')?.value as number;
    const near = checkNumbers(
      [{ path: 'text', text: `support ${(real + 0.05).toFixed(2)}` }],
      dictionary,
      'en-US'
    );
    expect(near.violations).toEqual([]);
    const far = checkNumbers(
      [{ path: 'text', text: `support ${(real + 0.56).toFixed(2)}` }],
      dictionary,
      'en-US'
    );
    expect(far.violations.map((v) => v.class)).toEqual(['PRICE']);
  });
});
