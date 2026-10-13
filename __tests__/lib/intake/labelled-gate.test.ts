/**
 * @jest-environment node
 */

/**
 * The labelled question set, the recorded run and the TypeScript half of the release gate
 * (build step 6 part 9; plan part 9; architecture 4.8 and 4.11 items 3 and 7).
 *
 * The question set is `knowledge-service/labelled/`: 40 hand-labelled English questions (five for each of
 * eight intents, eight of them noisy) and the same 40 in each of the 18 other locales, and an adversarial
 * slice. The run is `knowledge-service/labelled/runs/<fingerprint>/`: what the Understand model answered to
 * each question, and what the REAL intake pipeline did with that answer.
 *
 * This file does not call a model. It REPLAYS the pipeline (`runIntake`: the door, the scope check, the
 * snapshot of the golden cycle, the board, the router) over the recorded answers and holds the result to the
 * bars. The retrieval half (recall@4 on the real index) is `knowledge/labelled.py` in the knowledge service,
 * which searches with the retrieval requests this replay produced; the test "the run file is the replay"
 * below is what makes those requests trustworthy.
 *
 * What the run IS depends on its manifest: LIVE (a real model answered) or STAND_IN (the hand labels
 * answered, no model). A STAND_IN run proves the mechanism and measures nothing about the model or about
 * translation. The tests say which they ran on.
 */

import { readdirSync } from 'fs';
import { join } from 'path';

import {
  LOCALES,
  UNDERSTAND_PROMPT_VERSION,
  ROUTING_VERSION,
} from '@/lib/intake';
import { UNDERSTAND_SYSTEM_PROMPT } from '@/lib/intake/text/understand';
import type { UnderstandPort } from '@/lib/intake/text/understand';

import {
  BARS,
  ENGLISH,
  LABELLED_DIR,
  TRANSLATED_LOCALES,
  adversarialItems,
  canonicalSha,
  compareToEnglish,
  corpusChunkIds,
  fingerprintOf,
  glossaryVersion,
  goldenScenarioIds,
  itemsOf,
  judge,
  judgeAdversarial,
  liveRecord,
  loadContext,
  loadRun,
  makeStandInRun,
  measureLocale,
  promptSha256,
  recordQuestion,
  replayQuestion,
  reportOf,
  standInRecord,
  stalenessOf,
  understandRecordOf,
  type FreshnessContext,
  type Item,
  type LoadedRun,
  type LocaleReport,
  type RecordedLocale,
  type RecordedQuestion,
  type UnderstandRecord,
} from './helpers/labelled';

jest.setTimeout(240_000);

const run: LoadedRun = loadRun();
const context: FreshnessContext = loadContext();
const base = context.base;
const items = (locale: string): Item[] =>
  itemsOf(locale, base, context.locales[locale]);
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const INTENTS = [
  'DIRECTION',
  'ENTRY_TIMING',
  'EXIT_TARGETS',
  'RISK_SIZING',
  'EXPLAIN',
  'NEWS',
  'REPORT_2',
  'OUT_OF_SCOPE',
];

// ---------------------------------------------------------------------------
// The set
// ---------------------------------------------------------------------------

describe('the labelled question set', () => {
  it('holds 40 questions, five for each of eight intents, eight of them noisy', () => {
    expect(base.questions.map((q) => q.id)).toEqual(
      Array.from(
        { length: 40 },
        (_, i) => `q-${String(i + 1).padStart(2, '0')}`
      )
    );
    for (const intent of INTENTS) {
      expect(
        base.questions.filter((q) => q.expected_intent === intent)
      ).toHaveLength(5);
    }
    const noisy = base.questions.filter((q) => q.slice === 'noisy');
    expect(noisy).toHaveLength(8);
    expect(new Set(noisy.map((q) => q.expected_intent))).toEqual(
      new Set(INTENTS)
    );
  });

  it('covers all 19 locales: the base is English and 18 files translate it', () => {
    expect(LOCALES).toHaveLength(19);
    expect(TRANSLATED_LOCALES).toHaveLength(18);
    expect(Object.keys(context.locales).sort()).toEqual(
      [...TRANSLATED_LOCALES].sort()
    );
    const files = readdirSync(join(LABELLED_DIR, 'locales')).sort();
    expect(files).toEqual(
      [...TRANSLATED_LOCALES].map((l) => `${l}.json`).sort()
    );
    // the order's list had Malay and Russian, which the app does not have: live code wins
    expect(LOCALES).not.toContain('ms');
    expect(LOCALES).not.toContain('ru');
    expect(LOCALES).toEqual(expect.arrayContaining(['en-GB', 'pt', 'pt-BR']));
  });

  it('gives every locale the same 40 ids in order and lets a translation carry no label of its own', () => {
    const ids = base.questions.map((q) => q.id);
    for (const [locale, file] of Object.entries(context.locales)) {
      expect(file.locale).toBe(locale);
      expect(file.translation_status).toBe('DRAFT');
      expect(file.questions.map((q) => q.id)).toEqual(ids);
      for (const q of file.questions) {
        expect(Object.keys(q).sort()).toEqual(['id', 'question']);
        expect(q.question.trim()).not.toBe('');
      }
    }
  });

  it('names only chunks the corpus has, one to four for a question that retrieves and none for the rest', () => {
    const chunks = new Set(corpusChunkIds());
    expect(chunks.size).toBe(141);
    for (const q of base.questions) {
      for (const id of q.expected_chunk_ids) expect(chunks.has(id)).toBe(true);
      if (['REPORT_2', 'OUT_OF_SCOPE'].includes(q.expected_intent)) {
        expect(q.expected_chunk_ids).toEqual([]);
        expect(q.expected_m_star).toEqual([]);
      } else {
        expect(q.expected_chunk_ids.length).toBeGreaterThanOrEqual(1);
        expect(q.expected_chunk_ids.length).toBeLessThanOrEqual(4);
      }
    }
  });

  it('names only golden cycles that exist, and uses a spread of them', () => {
    const existing = goldenScenarioIds();
    expect(existing).toHaveLength(16);
    const used = new Set(base.questions.map((q) => q.scenario_id));
    for (const id of used) expect(existing).toContain(id);
    expect(used.size).toBeGreaterThanOrEqual(10);
    for (const q of base.questions) {
      expect(['DAY_TRADER', 'SCALPER']).toContain(q.trader_type);
    }
    expect(new Set(base.questions.map((q) => q.trader_type))).toEqual(
      new Set(['DAY_TRADER', 'SCALPER'])
    );
  });

  it('labels every warning as part of M*, and every M* sensor as one of the three', () => {
    for (const q of base.questions) {
      for (const sensor of q.expected_m_star)
        expect(['MCD1', 'MCD2', 'MCD3']).toContain(sensor);
      for (const sensor of q.expected_warnings)
        expect(q.expected_m_star).toContain(sensor);
    }
    // the labels do reach the hard cases: some questions carry a warning sensor
    expect(
      base.questions.filter((q) => q.expected_warnings.length > 0).length
    ).toBeGreaterThanOrEqual(10);
  });

  it('has an adversarial slice of about a dozen cases, apart from the 40', () => {
    expect(base.adversarial.length).toBeGreaterThanOrEqual(10);
    expect(base.adversarial.length).toBeLessThanOrEqual(15);
    expect(base.adversarial.some((a) => a.question.length > 500)).toBe(true);
    expect(base.adversarial.some((a) => a.question.trim() === '')).toBe(true);
    for (const adv of base.adversarial) {
      if (adv.expect === 'NEUTRALISED') {
        expect(base.questions.some((q) => q.id === adv.same_as)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The recorded run
// ---------------------------------------------------------------------------

describe('the recorded run', () => {
  it('is the one for this prompt, this glossary and this set (the fingerprint is current)', () => {
    expect(stalenessOf(run, context)).toEqual([]);
    expect(run.manifest.fingerprint).toBe(
      fingerprintOf({
        model_id: run.manifest.model_id,
        prompt_version: UNDERSTAND_PROMPT_VERSION,
        glossary_version: glossaryVersion(),
        base_set_sha256: canonicalSha(base),
      })
    );
    expect(run.manifest.fingerprint).toMatch(/^[0-9a-f]{32}$/);
    expect(run.manifest.prompt_sha256).toBe(promptSha256());
    expect(run.manifest.routing_version).toBe(ROUTING_VERSION);
  });

  it('covers the 19 locales in the order of the app, with the model id and the cost written next to it', () => {
    expect(run.manifest.locales).toEqual([...LOCALES]);
    expect(Object.keys(run.locales)).toEqual([...LOCALES]);
    expect(['LIVE', 'STAND_IN']).toContain(run.manifest.provenance);
    expect(run.manifest.model_id.length).toBeGreaterThan(0);
    expect(run.manifest).toHaveProperty('cost_usd');
    expect(run.manifest.cost_note.length).toBeGreaterThan(0);
    if (run.manifest.provenance === 'STAND_IN') {
      expect(run.manifest.calls).toBe(0);
    } else {
      expect(run.manifest.calls).toBeGreaterThan(0);
    }
  });

  it('says plainly when no model answered it', () => {
    // a STAND_IN run is a proof of mechanism, not a measurement; this test fails the day someone relabels it
    if (run.manifest.provenance !== 'STAND_IN') return;
    expect(run.manifest.model_id).toMatch(/^stand-in\//);
    const english = run.locales[ENGLISH] as RecordedLocale;
    // the stand-in answers with the labels: every recorded intent is the labelled one
    for (const item of items(ENGLISH)) {
      const row = english.questions.find(
        (q) => q.id === item.id
      ) as RecordedQuestion;
      expect(row.intent).toBe(item.label.expected_intent);
    }
  });

  it('is reproducible: a stand-in run made again is the committed run, byte for byte', async () => {
    if (run.manifest.provenance !== 'STAND_IN') return;
    const again = await makeStandInRun();
    expect(JSON.stringify(again.manifest)).toBe(JSON.stringify(run.manifest));
    for (const locale of LOCALES) {
      expect(JSON.stringify(again.locales[locale])).toBe(
        JSON.stringify(run.locales[locale])
      );
    }
  });

  it('holds the question as it was typed in each locale', () => {
    for (const locale of LOCALES) {
      const recorded = (run.locales[locale] as RecordedLocale).questions;
      expect(recorded).toHaveLength(40);
      for (const item of items(locale)) {
        expect(recorded.find((q) => q.id === item.id)?.question).toBe(
          item.question
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The replay: the real pipeline over the recorded answers
// ---------------------------------------------------------------------------

describe('the replay', () => {
  describe.each([...LOCALES])('%s', (locale) => {
    it('the run file is the replay: the pipeline does today what the file says it did', async () => {
      const recorded = (run.locales[locale] as RecordedLocale).questions;
      for (const item of items(locale)) {
        const row = recorded.find((q) => q.id === item.id) as RecordedQuestion;
        const { replay } = await replayQuestion(
          {
            locale,
            question: item.question,
            trader_type: item.label.trader_type,
            scenario_id: item.label.scenario_id,
          },
          understandRecordOf(row)
        );
        expect({ id: item.id, replay }).toEqual({
          id: item.id,
          replay: row.replay,
        });
      }
    });
  });

  it('is what makes the retrieval half trustworthy: every retrieving question stores the request it made', () => {
    for (const locale of LOCALES) {
      const recorded = (run.locales[locale] as RecordedLocale).questions;
      for (const item of items(locale)) {
        const row = recorded.find((q) => q.id === item.id) as RecordedQuestion;
        const retrieves = !['REPORT_2', 'OUT_OF_SCOPE'].includes(
          item.label.expected_intent
        );
        if (retrieves) {
          expect(row.replay.retrieval).not.toBeNull();
          expect(row.replay.retrieval?.m_star).toEqual(row.replay.m_star);
          expect(row.replay.retrieval?.routing_version).toBe(ROUTING_VERSION);
          expect(row.replay.retrieval?.question_en.length).toBeGreaterThan(0);
        } else {
          expect(row.replay.retrieval).toBeNull();
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The bars
// ---------------------------------------------------------------------------

describe('the quality bars', () => {
  const reports: LocaleReport[] = reportOf(run.locales, context);

  it('measures all 19 locales', () => {
    expect(reports.map((r) => r.locale)).toEqual([...LOCALES]);
    for (const r of reports) {
      expect(r.intent_match.total).toBe(40);
      expect(r.m_star_match.total).toBe(40);
      expect(r.out_of_scope.total).toBe(5);
      expect(r.wrongly_refused.total).toBe(35);
      expect(r.warnings_present.total).toBeGreaterThanOrEqual(10);
    }
  });

  it('meets every bar in every locale (4.11 item 3: routing within 5 points of English, all 19)', () => {
    expect(judge(reports)).toEqual([]);
  });

  it.each(reports.map((r) => [r.locale, r] as const))(
    'intent and M* match at least 90%, scope exact, warnings always present: %s',
    (_locale, r) => {
      expect(r.intent_match.rate).toBeGreaterThanOrEqual(BARS.intentMatch);
      expect(r.m_star_match.rate).toBeGreaterThanOrEqual(BARS.mStarMatch);
      expect(r.out_of_scope.rate).toBe(1);
      expect(r.warnings_present.rate).toBe(1);
      expect(r.wrongly_refused.rate).toBeLessThanOrEqual(
        BARS.wronglyRefusedMax
      );
    }
  );

  it('keeps every locale within 5 points of English', () => {
    const english = reports.find((r) => r.locale === ENGLISH) as LocaleReport;
    for (const r of reports) {
      expect(compareToEnglish(english, r)).toEqual([]);
    }
  });

  it('refuses every out-of-scope question in every locale, whatever the model said about the symbol', async () => {
    // the text scan alone saves a question that names another symbol or timeframe, even if the model labels it DIRECTION
    const item = items(ENGLISH).find((i) => i.id === 'q-36') as Item;
    const wrong: UnderstandRecord = {
      status: 'OK',
      language: 'en',
      english: item.question,
      intent: 'DIRECTION',
      symbols: ['XAUUSD'],
      timeframes: [],
    };
    const { replay } = await replayQuestion(
      {
        locale: ENGLISH,
        question: item.question,
        trader_type: 'DAY_TRADER',
        scenario_id: 'golden-04',
      },
      wrong
    );
    expect(replay.outcome).toBe('REFUSED');
    expect(replay.refusal_code).toBe('OUT_OF_SCOPE');
  });

  it('gives the sensors that stand aside or oppose the reading in full, for every intent that gives readings', () => {
    for (const locale of LOCALES) {
      const recorded = (run.locales[locale] as RecordedLocale).questions;
      for (const item of items(locale)) {
        const row = recorded.find((q) => q.id === item.id) as RecordedQuestion;
        for (const sensor of item.label.expected_warnings) {
          expect(row.replay.m_star).toContain(sensor);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The adversarial slice
// ---------------------------------------------------------------------------

describe('the adversarial slice', () => {
  it('is refused or neutralised in every case (judged apart from the percentages)', async () => {
    const english = run.locales[ENGLISH] as RecordedLocale;
    const verdicts = await judgeAdversarial(base, english.adversarial ?? []);
    expect(verdicts).toHaveLength(base.adversarial.length);
    expect(verdicts.filter((v) => !v.ok)).toEqual([]);
  });

  it('keeps the question as data inside one JSON field and the instructions untouched', async () => {
    const english = run.locales[ENGLISH] as RecordedLocale;
    for (const item of adversarialItems(base)) {
      const row = (english.adversarial ?? []).find(
        (q) => q.id === item.id
      ) as RecordedQuestion;
      const full = await replayQuestion(
        {
          locale: ENGLISH,
          question: item.question,
          trader_type: item.trader_type,
          scenario_id: item.scenario_id,
        },
        understandRecordOf(row)
      );
      for (const request of full.understandRequests) {
        expect(request.system).toBe(UNDERSTAND_SYSTEM_PROMPT);
        const body = JSON.parse(request.user) as { question: string };
        expect(Object.keys(body).sort()).toEqual([
          'glossary_hints',
          'question',
        ]);
        expect(typeof body.question).toBe('string');
      }
    }
  });

  it('never calls the model for a question refused at the door (empty, white space, invisible, too long)', async () => {
    const english = run.locales[ENGLISH] as RecordedLocale;
    const door = (english.adversarial ?? []).filter(
      (q) => q.status === 'NOT_CALLED'
    );
    expect(door.map((q) => q.id)).toEqual([
      'adv-06',
      'adv-07',
      'adv-08',
      'adv-09',
      'adv-10',
    ]);
    for (const q of door) {
      expect(['QUESTION_EMPTY', 'QUESTION_TOO_LONG']).toContain(
        q.replay.refusal_code
      );
    }
    const long = (english.adversarial ?? []).find(
      (q) => q.id === 'adv-06'
    ) as RecordedQuestion;
    expect(long.question).toHaveLength(501);
    expect(long.replay.refusal_code).toBe('QUESTION_TOO_LONG');
  });

  it('puts a neutralised case through retrieval with the same sensors as the question it wraps', () => {
    const english = run.locales[ENGLISH] as RecordedLocale;
    for (const adv of base.adversarial.filter(
      (a) => a.expect === 'NEUTRALISED'
    )) {
      const hostile = (english.adversarial ?? []).find(
        (q) => q.id === adv.id
      ) as RecordedQuestion;
      const clean = english.questions.find(
        (q) => q.id === adv.same_as
      ) as RecordedQuestion;
      expect(hostile.replay.m_star).toEqual(clean.replay.m_star);
      expect(hostile.replay.retrieval?.intent).toBe(
        clean.replay.retrieval?.intent
      );
      expect(hostile.replay.retrieval?.state_codes).toEqual(
        clean.replay.retrieval?.state_codes
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 4.11 item 7: the gate FAILS
// ---------------------------------------------------------------------------

describe('the gate fails (4.11 item 7)', () => {
  const messages = (problems: string[]): string[] =>
    problems.map((p) => p.split(':')[0] as string);

  describe('a stale fingerprint', () => {
    it('is refused when the prompt version changes', () => {
      expect(
        messages(
          stalenessOf(run, { ...context, promptVersion: 'understand-2' })
        )
      ).toEqual(['STALE_PROMPT_VERSION']);
    });

    it('is refused when the prompt text changes under its version', () => {
      expect(
        messages(stalenessOf(run, { ...context, promptSha: 'f'.repeat(64) }))
      ).toEqual(['STALE_PROMPT_TEXT']);
    });

    it('is refused when the glossary changes', () => {
      expect(
        messages(stalenessOf(run, { ...context, glossary: '1.0.1' }))
      ).toEqual(['STALE_GLOSSARY']);
    });

    it('is refused when one word of the English base changes', () => {
      const changed: FreshnessContext = { ...context, base: clone(base) };
      changed.base.questions[0] = {
        ...changed.base.questions[0]!,
        question: 'Should I buy or sell gold today?',
      };
      expect(messages(stalenessOf(run, changed))).toEqual(['STALE_BASE_SET']);
    });

    it('is refused when a label of the English base changes', () => {
      const changed: FreshnessContext = { ...context, base: clone(base) };
      changed.base.questions[2] = {
        ...changed.base.questions[2]!,
        expected_m_star: ['MCD2'],
      };
      expect(messages(stalenessOf(run, changed))).toEqual(['STALE_BASE_SET']);
    });

    it('is refused when one translation changes', () => {
      const changed: FreshnessContext = {
        ...context,
        locales: clone(context.locales),
      };
      const de = changed.locales['de']!;
      de.questions[0] = {
        ...de.questions[0]!,
        question: 'Soll ich Gold kaufen?',
      };
      expect(messages(stalenessOf(run, changed))).toEqual(['STALE_LOCALE']);
    });

    it('is refused when the manifest does not hash to its fingerprint', () => {
      const tampered = {
        ...run,
        manifest: { ...run.manifest, model_id: 'another-model' },
      };
      expect(messages(stalenessOf(tampered, context))).toEqual([
        'FINGERPRINT_MISMATCH',
      ]);
    });

    it('is refused when the pointer names another run', () => {
      const tampered = {
        ...run,
        pointer: { ...run.pointer, fingerprint: '0'.repeat(32) },
      };
      expect(messages(stalenessOf(tampered, context))).toEqual([
        'POINTER_MISMATCH',
      ]);
    });

    it('is refused when a locale has no recording, or a file of another run', () => {
      const missing = clone(run.locales);
      delete missing['th'];
      expect(
        messages(stalenessOf({ ...run, locales: missing }, context))
      ).toEqual(['MISSING_LOCALE_RUN']);
      const foreign = clone(run.locales);
      (foreign['fr'] as RecordedLocale).fingerprint = 'f'.repeat(32);
      expect(
        messages(stalenessOf({ ...run, locales: foreign }, context))
      ).toEqual(['FILE_FINGERPRINT']);
    });

    it('is not a thing a LIVE and a STAND-IN run can share: the model id is part of the fingerprint', () => {
      const parts = {
        prompt_version: UNDERSTAND_PROMPT_VERSION,
        glossary_version: glossaryVersion(),
        base_set_sha256: canonicalSha(base),
      };
      expect(
        fingerprintOf({ model_id: 'stand-in/labels-v1', ...parts })
      ).not.toBe(fingerprintOf({ model_id: 'vendor/model-1', ...parts }));
    });
  });

  /** The 40 questions of a locale recorded again with a few answers changed, so the pipeline has run on them. */
  async function withAnswers(
    locale: string,
    change: (
      item: Item,
      record: UnderstandRecord
    ) => UnderstandRecord | undefined
  ): Promise<RecordedQuestion[]> {
    const out: RecordedQuestion[] = [];
    for (const item of items(locale)) {
      const record = standInRecord(item);
      const replaced = change(item, record) ?? record;
      out.push(
        await recordQuestion(
          {
            id: item.id,
            locale,
            question: item.question,
            trader_type: item.label.trader_type,
            scenario_id: item.label.scenario_id,
          },
          replaced
        )
      );
    }
    return out;
  }

  const wrongIntent =
    (ids: string[]) => (item: Item, record: UnderstandRecord) =>
      ids.includes(item.id) && record.status === 'OK'
        ? ({
            ...record,
            intent: record.intent === 'NEWS' ? 'EXPLAIN' : 'NEWS',
          } as UnderstandRecord)
        : undefined;

  describe('a locale that falls below English', () => {
    const english = reportOf(run.locales, context).find(
      (r) => r.locale === ENGLISH
    ) as LocaleReport;
    const german = items('de');

    // questions that do not retrieve change nothing else when their intent is wrong; use retrieving ones
    const ids = ['q-01', 'q-06', 'q-11', 'q-16', 'q-21', 'q-26'];

    it('exactly five points under English is still inside (two of 40 wrong)', async () => {
      const recorded = await withAnswers('de', wrongIntent(ids.slice(0, 2)));
      const report = measureLocale('de', german, recorded);
      expect(english.intent_match.rate - report.intent_match.rate).toBeCloseTo(
        0.05,
        10
      );
      expect(
        compareToEnglish(english, report).filter((p) =>
          p.includes('intent_match')
        )
      ).toEqual([]);
    });

    it('7.5 points under English fails (three of 40 wrong), though it is still over the 90% bar', async () => {
      const recorded = await withAnswers('de', wrongIntent(ids.slice(0, 3)));
      const report = measureLocale('de', german, recorded);
      expect(report.intent_match.rate).toBeGreaterThanOrEqual(BARS.intentMatch);
      const problems = judge([english, report]);
      expect(
        messages(problems).some((m) =>
          m.startsWith('BELOW_ENGLISH intent_match [de]')
        )
      ).toBe(true);
      expect(problems.every((p) => !p.startsWith('INTENT_MATCH'))).toBe(true);
    });

    it('a locale at 87.5% fails the 90% bar of its own', async () => {
      const recorded = await withAnswers('de', wrongIntent(ids.slice(0, 5)));
      const report = measureLocale('de', german, recorded);
      expect(report.intent_match.rate).toBeLessThan(BARS.intentMatch);
      expect(messages(judge([english, report]))).toEqual(
        expect.arrayContaining(['INTENT_MATCH [de]'])
      );
    });

    it('a locale whose M* is wrong in five questions fails', async () => {
      const recorded = clone((run.locales['ja'] as RecordedLocale).questions);
      for (const id of ['q-01', 'q-06', 'q-11', 'q-16', 'q-21']) {
        (recorded.find((q) => q.id === id) as RecordedQuestion).replay.m_star =
          [];
      }
      const report = measureLocale('ja', items('ja'), recorded);
      expect(report.m_star_match.rate).toBeCloseTo(0.875, 10);
      expect(messages(judge([english, report]))).toEqual(
        expect.arrayContaining(['M_STAR_MATCH [ja]'])
      );
    });

    it('one missing warning sensor fails the 100% bar', () => {
      const recorded = clone(
        (run.locales[ENGLISH] as RecordedLocale).questions
      );
      const target = recorded.find((q) => q.id === 'q-03') as RecordedQuestion;
      target.replay.m_star = target.replay.m_star.filter((id) => id !== 'MCD3');
      const report = measureLocale(ENGLISH, items(ENGLISH), recorded);
      expect(report.warnings_present.rate).toBeLessThan(1);
      expect(messages(judge([report]))).toEqual(
        expect.arrayContaining(['WARNINGS [en-US]'])
      );
    });

    it('an out-of-scope question that the pipeline answers fails the 100% bar', async () => {
      // the weather in London: no symbol in the text for the scan to catch, so only the model's label can refuse it
      const recorded = await withAnswers(ENGLISH, (item, record) =>
        item.id === 'q-40' && record.status === 'OK'
          ? { ...record, intent: 'DIRECTION', symbols: ['XAUUSD'] }
          : undefined
      );
      const report = measureLocale(ENGLISH, items(ENGLISH), recorded);
      expect(report.out_of_scope.hits).toBe(4);
      expect(messages(judge([report]))).toEqual(
        expect.arrayContaining(['OUT_OF_SCOPE [en-US]'])
      );
    });

    it('two in-scope questions refused fails the cap on questions wrongly refused', async () => {
      const refuse =
        (ids: string[]) => (item: Item, record: UnderstandRecord) =>
          ids.includes(item.id) && record.status === 'OK'
            ? ({ ...record, symbols: ['EURUSD'] } as UnderstandRecord)
            : undefined;
      const one = measureLocale(
        ENGLISH,
        items(ENGLISH),
        await withAnswers(ENGLISH, refuse(['q-01']))
      );
      expect(one.wrongly_refused.hits).toBe(1);
      expect(
        judge([one]).filter((p) => p.startsWith('WRONGLY_REFUSED'))
      ).toEqual([]);
      const two = measureLocale(
        ENGLISH,
        items(ENGLISH),
        await withAnswers(ENGLISH, refuse(['q-01', 'q-06']))
      );
      expect(messages(judge([two]))).toEqual(
        expect.arrayContaining(['WRONGLY_REFUSED [en-US]'])
      );
    });

    it('a recording with a question missing is a miss, never a crash', () => {
      const recorded = (run.locales['it'] as RecordedLocale).questions.slice(
        0,
        39
      );
      const report = measureLocale('it', items('it'), recorded);
      expect(report.misses.some((m) => m.includes('no recording'))).toBe(true);
      expect(report.intent_match.hits).toBe(39);
    });
  });
});

// ---------------------------------------------------------------------------
// The live path, without a model
// ---------------------------------------------------------------------------

describe('recording a live run (a fake port stands in for the model)', () => {
  const echo = (
    answer: (question: string) => unknown
  ): UnderstandPort & { calls: number } => {
    const port = {
      calls: 0,
      understand: async (request: { user: string }) => {
        port.calls += 1;
        const { question } = JSON.parse(request.user) as { question: string };
        return answer(question);
      },
    };
    return port;
  };

  it('calls the port once for a question that passes the door and never for one that does not', async () => {
    const port = echo((q) => ({
      schema: 'understand-result/1',
      language: 'en',
      english: q,
      intent: 'NEWS',
      symbols: ['XAUUSD'],
      timeframes: [],
    }));
    expect(
      await liveRecord(port, 'Is there news for gold today?')
    ).toMatchObject({ status: 'OK', intent: 'NEWS' });
    expect(port.calls).toBe(1);
    expect(await liveRecord(port, '   ')).toEqual({ status: 'NOT_CALLED' });
    expect(await liveRecord(port, 'x'.repeat(501))).toEqual({
      status: 'NOT_CALLED',
    });
    expect(port.calls).toBe(1);
  });

  it('records a failed or invalid answer as FAILED, and the replay of that is a refusal', async () => {
    const broken = await liveRecord(
      echo(() => ({ nonsense: true })),
      'Is there news for gold today?'
    );
    expect(broken).toMatchObject({ status: 'FAILED', failure: 'SCHEMA' });
    const notJson = await liveRecord(
      echo(() => 'I cannot help'),
      'Is there news for gold today?'
    );
    expect(notJson).toMatchObject({ status: 'FAILED', failure: 'NOT_JSON' });
    const { replay } = await replayQuestion(
      {
        locale: ENGLISH,
        question: 'Is there news for gold today?',
        trader_type: 'DAY_TRADER',
        scenario_id: 'golden-04',
      },
      broken
    );
    expect(replay).toMatchObject({
      outcome: 'REFUSED',
      refusal_code: 'UNDERSTANDING_FAILED',
    });
  });

  it('records what a rejecting port did, and keeps the failure code', async () => {
    const port: UnderstandPort = {
      understand: () =>
        Promise.reject(Object.assign(new Error('x'), { code: 'TIMEOUT' })),
    };
    expect(await liveRecord(port, 'Is there news for gold today?')).toEqual({
      status: 'FAILED',
      failure: 'PORT_ERROR:TIMEOUT',
    });
  });

  it('writes the same file shape a stand-in run does (a live recording is replayed by the same code)', async () => {
    const record = await liveRecord(
      echo((q) => ({
        schema: 'understand-result/1',
        language: 'de',
        english: q,
        intent: 'DIRECTION',
        symbols: ['XAUUSD'],
        timeframes: [],
      })),
      'Soll ich Gold kaufen?'
    );
    const row = await recordQuestion(
      {
        id: 'q-01',
        locale: 'de',
        question: 'Soll ich Gold kaufen?',
        trader_type: 'DAY_TRADER',
        scenario_id: 'golden-04',
      },
      record
    );
    expect(Object.keys(row)).toEqual([
      'id',
      'question',
      'status',
      'failure',
      'language',
      'english',
      'intent',
      'symbols',
      'timeframes',
      'replay',
    ]);
    expect(row.status).toBe('OK');
    expect(row.replay.outcome).toBe('PACKET');
    expect(row.replay.retrieval?.question_en).toBe('Soll ich Gold kaufen?');
  });
});

// ---------------------------------------------------------------------------
// Known gaps found by the set (kept as a ledger, not hidden)
// ---------------------------------------------------------------------------

describe('gaps of the deterministic front found while labelling (closed)', () => {
  it('"2day" for today is NOT read as the two-day timeframe: the question is in scope and a packet is built', async () => {
    // Found on the first draft of q-29 (part 9): text-speak for "today" was a spoken timeframe to the scope check
    // and the question was refused as out of scope. Closed in part 10 (`lib/intake/text/scope.ts`). The set still
    // spells it "todya": changing its text would change `content_sha256`, which the approval pins.
    const question = 'is ther big nws 4 gold 2day?? fomc cpi nfp';
    const { replay } = await replayQuestion(
      {
        locale: ENGLISH,
        question,
        trader_type: 'DAY_TRADER',
        scenario_id: 'golden-11',
      },
      {
        status: 'OK',
        language: 'en',
        english: question,
        intent: 'NEWS',
        symbols: ['XAUUSD'],
        timeframes: [],
      }
    );
    expect(replay).toMatchObject({
      outcome: 'PACKET',
      refusal_code: null,
      intent: 'NEWS',
    });
  });

  it('the set holds the question as it was spelled once the gap was found', () => {
    const q29 = base.questions.find((q) => q.id === 'q-29') as {
      question: string;
    };
    expect(q29.question).toContain('todya');
    expect(q29.question).not.toMatch(/\b2day\b/i);
  });
});
