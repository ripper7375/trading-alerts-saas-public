/**
 * The labelled question set, the recorded run and the replay (build step 6 part 9).
 *
 * This file is TEST INFRASTRUCTURE shared by `labelled-gate.test.ts` and `scripts/intake/eval_understand.ts`.
 * It loads the set (`knowledge-service/labelled/`), computes the fingerprint of a run, makes the recorded
 * answers (a live model, or the deterministic STAND-IN), replays the real intake pipeline over a recording,
 * and holds the quality bars of ADR-044 and plan decision D15.
 *
 * What is measured where:
 *
 *  - HERE (TypeScript): the intent the model recorded, the router's M* on that intent, the scope outcome,
 *    the warnings that must always be present. The pipeline that runs is the real `runIntake` over the 16
 *    golden cycles; only the Understand model is replaced by the recorded answers.
 *  - IN PYTHON (`knowledge/labelled.py`): recall@4 on the real index, with the retrieval request this replay
 *    produced for each question (it is stored in the run file, and this file proves it is current).
 *
 * The recorded answers are of one of two kinds (`provenance` in the manifest):
 *
 *  - LIVE: what a real model returned. Made by `eval_understand.ts --live` with a key.
 *  - STAND_IN: a deterministic stand-in made WITHOUT a model: it returns the hand-labelled intent, symbols
 *    and timeframes, and the base English question as the pivot, in every language. It proves the replay,
 *    the router, the scope check and the retrieval; it measures NOTHING about the model or about
 *    translation, and every locale gets the same pivot, so the per-locale comparison is equal by
 *    construction. The gate says which kind it ran on.
 */

import { createHash } from 'crypto';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

import { LOCALES, canonicalJson, familyOfLocale } from '@/lib/intake';
import type { TraderType } from '@/lib/intake';
import type { KnowledgeRequest } from '@/lib/intake/knowledge-client';
import { passTheDoor } from '@/lib/intake/text/limits';
import { normalizeQuestion } from '@/lib/intake/text/normalize';
import { spotTerms } from '@/lib/intake/text/glossary';
import {
  UNDERSTAND_PROMPT_VERSION,
  UNDERSTAND_SYSTEM_PROMPT,
  runUnderstand,
  type UnderstandPort,
} from '@/lib/intake/text/understand';
import {
  createFixtureUnderstand,
  type FixtureRecording,
} from '@/lib/intake/text/understand-fixture';

import { profileFor, run, typed } from './ports';
import { goldenWorlds, type World } from './world';

// ---------------------------------------------------------------------------
// Where things are
// ---------------------------------------------------------------------------

const REPO = join(__dirname, '..', '..', '..', '..');
export const LABELLED_DIR = join(REPO, 'knowledge-service', 'labelled');
export const SOURCE_MAP = join(
  REPO,
  'knowledge-service',
  'corpus',
  'source-map.json'
);
const GLOSSARY_FILE = join(REPO, 'config', 'intake', 'glossary.v1.json');

/** The reference locale: every other locale is compared with it. */
export const ENGLISH = 'en-US';

/** The 18 locales that translate the base (the 19 locales of the app, less the base). */
export const TRANSLATED_LOCALES: readonly string[] = LOCALES.filter(
  (locale) => locale !== ENGLISH
);

// ---------------------------------------------------------------------------
// The quality bars (ADR-044 starting values and plan decision D15)
// ---------------------------------------------------------------------------

export const BARS = {
  /** the model's intent, and the router's M* on it, against the hand labels */
  intentMatch: 0.9,
  mStarMatch: 0.9,
  /** every locale within this many points (as a fraction) of English */
  withinEnglish: 0.05,
  /** an out-of-scope question is always refused as out of scope */
  outOfScopeAccuracy: 1,
  /** the stand-aside and opposing sensors are always in M* */
  warningsPresent: 1,
  /** the most in-scope questions that may be refused (D15 c, a starting value) */
  wronglyRefusedMax: 0.05,
  /** recall@4 on the real index (Python) */
  recallAt4: 0.8,
} as const;

// ---------------------------------------------------------------------------
// The set
// ---------------------------------------------------------------------------

export type Slice = 'core' | 'noisy';

export interface LabelledQuestion {
  id: string;
  slice: Slice;
  question: string;
  expected_intent: string;
  trader_type: TraderType;
  scenario_id: string;
  expected_m_star: string[];
  expected_warnings: string[];
  expected_symbols: string[];
  expected_timeframes: string[];
  expected_chunk_ids: string[];
  label_note: string;
}

export interface StandInAnswer {
  english: string;
  intent: string;
  symbols: string[];
  timeframes: string[];
}

export interface AdversarialQuestion {
  id: string;
  kind: string;
  question: string;
  expect: 'REFUSED' | 'NEUTRALISED';
  refusal_codes?: string[];
  same_as?: string;
  stand_in: StandInAnswer | null;
}

export interface BaseSet {
  schema: 'labelled-base/1';
  version: string;
  locale: string;
  note: string;
  questions: LabelledQuestion[];
  adversarial: AdversarialQuestion[];
}

export interface LocaleSet {
  schema: 'labelled-locale/1';
  locale: string;
  translation_status: string;
  questions: { id: string; question: string }[];
}

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(path, 'utf8')) as T;

export const loadBase = (dir: string = LABELLED_DIR): BaseSet =>
  readJson<BaseSet>(join(dir, 'base.en-US.json'));

export const loadLocale = (
  locale: string,
  dir: string = LABELLED_DIR
): LocaleSet => readJson<LocaleSet>(join(dir, 'locales', `${locale}.json`));

/** SHA-256 hex of a text, synchronously. */
export const sha256 = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex');

/** The canonical SHA-256 of a parsed JSON file: the same on every line ending. */
export const canonicalSha = (value: unknown): string =>
  sha256(canonicalJson(value));

export const glossaryVersion = (): string =>
  readJson<{ version: string }>(GLOSSARY_FILE).version;

export const promptSha256 = (): string => sha256(UNDERSTAND_SYSTEM_PROMPT);

/** `sha256(model_id:prompt_version:glossary_version:base_set_sha256)` cut to 32 characters (plan, part 9). */
export function fingerprintOf(parts: {
  model_id: string;
  prompt_version: string;
  glossary_version: string;
  base_set_sha256: string;
}): string {
  return sha256(
    `${parts.model_id}:${parts.prompt_version}:${parts.glossary_version}:${parts.base_set_sha256}`
  ).slice(0, 32);
}

/** One question to be asked in one locale, with the labels it inherits from the base. */
export interface Item {
  locale: string;
  id: string;
  /** the text typed, in the locale */
  question: string;
  /** the labels (always the base's) */
  label: LabelledQuestion;
}

/** The 40 questions of a locale, in order. English is the base itself. */
export function itemsOf(
  locale: string,
  base: BaseSet,
  translation?: LocaleSet
): Item[] {
  return base.questions.map((label) => {
    if (locale === ENGLISH) {
      return { locale, id: label.id, question: label.question, label };
    }
    const found = translation?.questions.find((q) => q.id === label.id);
    if (found === undefined) {
      throw new Error(`${locale} has no translation of ${label.id}`);
    }
    return { locale, id: label.id, question: found.question, label };
  });
}

/** The adversarial slice as items (English only). */
export function adversarialItems(base: BaseSet): AdversarialItem[] {
  return base.adversarial.map((adv) => {
    const sibling =
      adv.same_as === undefined
        ? undefined
        : base.questions.find((q) => q.id === adv.same_as);
    return {
      locale: ENGLISH,
      id: adv.id,
      question: adv.question,
      adv,
      // a refused case needs only some profile and cycle to run on; a neutralised one uses its sibling's
      trader_type: sibling?.trader_type ?? 'DAY_TRADER',
      scenario_id: sibling?.scenario_id ?? 'golden-04',
    };
  });
}

export interface AdversarialItem {
  locale: string;
  id: string;
  question: string;
  adv: AdversarialQuestion;
  trader_type: TraderType;
  scenario_id: string;
}

// ---------------------------------------------------------------------------
// The recording
// ---------------------------------------------------------------------------

export type UnderstandRecord =
  | {
      status: 'OK';
      language: string;
      english: string;
      intent: string;
      symbols: string[];
      timeframes: string[];
    }
  /** the question was refused at the door: the model was not called */
  | { status: 'NOT_CALLED' }
  | { status: 'FAILED'; failure: string };

export interface RetrievalRequest {
  intent: string;
  question_en: string;
  m_star: string[];
  state_codes: string[];
  routing_version: string;
}

/** What the real pipeline did with the recorded answer: derived, and checked by the gate on every run. */
export interface Replay {
  outcome: 'PACKET' | 'REFUSED';
  refusal_code: string | null;
  intent: string | null;
  m_star: string[];
  retrieval: RetrievalRequest | null;
}

export interface RecordedQuestion {
  id: string;
  /** the exact text that was typed */
  question: string;
  status: 'OK' | 'NOT_CALLED' | 'FAILED';
  failure: string | null;
  language: string | null;
  english: string | null;
  intent: string | null;
  symbols: string[] | null;
  timeframes: string[] | null;
  replay: Replay;
}

export interface RecordedLocale {
  schema: 'labelled-run/1';
  fingerprint: string;
  locale: string;
  questions: RecordedQuestion[];
  /** English only */
  adversarial?: RecordedQuestion[];
}

export interface RunManifest {
  schema: 'labelled-run-manifest/1';
  fingerprint: string;
  provenance: 'LIVE' | 'STAND_IN';
  model_id: string;
  prompt_version: string;
  prompt_sha256: string;
  glossary_version: string;
  base_set_sha256: string;
  locale_sha256: Record<string, string>;
  routing_version: string;
  locales: string[];
  recorded_on: string;
  calls: number;
  cost_usd: number | null;
  cost_note: string;
}

export interface RunPointer {
  schema: 'labelled-run-pointer/1';
  fingerprint: string;
}

export interface LoadedRun {
  pointer: RunPointer;
  manifest: RunManifest;
  locales: Record<string, RecordedLocale>;
}

export const runDir = (
  fingerprint: string,
  dir: string = LABELLED_DIR
): string => join(dir, 'runs', fingerprint);

export function loadRun(dir: string = LABELLED_DIR): LoadedRun {
  const pointer = readJson<RunPointer>(join(dir, 'current-run.json'));
  const where = runDir(pointer.fingerprint, dir);
  const manifest = readJson<RunManifest>(join(where, 'manifest.json'));
  const locales: Record<string, RecordedLocale> = {};
  for (const locale of manifest.locales) {
    const file = join(where, `${locale}.json`);
    if (existsSync(file)) locales[locale] = readJson<RecordedLocale>(file);
  }
  return { pointer, manifest, locales };
}

export const understandRecordOf = (
  recorded: RecordedQuestion
): UnderstandRecord =>
  recorded.status === 'OK'
    ? {
        status: 'OK',
        language: recorded.language as string,
        english: recorded.english as string,
        intent: recorded.intent as string,
        symbols: recorded.symbols as string[],
        timeframes: recorded.timeframes as string[],
      }
    : recorded.status === 'NOT_CALLED'
      ? { status: 'NOT_CALLED' }
      : { status: 'FAILED', failure: recorded.failure ?? 'PORT_ERROR' };

/** The model's answer as `understand-result/1`, or nothing when the call did not give one. */
function answerOf(record: UnderstandRecord): unknown {
  return record.status === 'OK'
    ? {
        schema: 'understand-result/1',
        language: record.language,
        english: record.english,
        intent: record.intent,
        symbols: record.symbols,
        timeframes: record.timeframes,
      }
    : undefined;
}

// ---------------------------------------------------------------------------
// The replay: the real pipeline, the recorded answer
// ---------------------------------------------------------------------------

let worlds: World[] | undefined;

export function worldOf(scenarioId: string): World {
  worlds ??= goldenWorlds();
  const number = /^golden-(\d\d)$/.exec(scenarioId)?.[1];
  const world =
    number === undefined
      ? undefined
      : worlds.find((w) => w.name.startsWith(`${number}-`));
  if (world === undefined)
    throw new Error(`${scenarioId} is not a golden cycle`);
  return world;
}

export interface ReplayInput {
  locale: string;
  question: string;
  trader_type: TraderType;
  scenario_id: string;
}

export interface FullReplay {
  replay: Replay;
  /** the packet, when the pipeline made one */
  packet: ReturnType<typeof packetOf> | null;
  /** the messages the Understand step would have sent, when it was called */
  understandRequests: { system: string; user: string }[];
}

function packetOf(result: { kind: string }) {
  return (result as unknown as { packet: Record<string, any> }).packet;
}

/** Run one question through `runIntake` with the recorded answer standing in for the model. */
export async function replayQuestion(
  input: ReplayInput,
  record: UnderstandRecord
): Promise<FullReplay> {
  const answer = answerOf(record);
  const recordings: FixtureRecording[] =
    answer === undefined
      ? []
      : [{ question: normalizeQuestion(input.question).text, output: answer }];
  const understand = createFixtureUnderstand(recordings);
  const { result, fake } = await run(typed(input.question), {
    world: worldOf(input.scenario_id),
    profile: profileFor(input.trader_type),
    understand,
    locale: input.locale,
  });
  const understandRequests = understand.calls.map((call) => ({
    system: call.system,
    user: call.user,
  }));
  if (result.kind === 'PACKET') {
    const packet = packetOf(result);
    const search = fake.calls.knowledgeRequests[0] as
      | KnowledgeRequest
      | undefined;
    return {
      replay: {
        outcome: 'PACKET',
        refusal_code: null,
        intent: packet['intent'] as string,
        m_star: [...(packet['readings'].m_star as string[])],
        retrieval:
          search === undefined
            ? null
            : {
                intent: search.intent,
                question_en: search.question_en,
                m_star: [...search.m_star],
                state_codes: [...search.state_codes],
                routing_version: search.routing_version,
              },
      },
      packet,
      understandRequests,
    };
  }
  if (result.kind === 'REFUSED') {
    return {
      replay: {
        outcome: 'REFUSED',
        refusal_code: result.refusal.code,
        intent: null,
        m_star: [],
        retrieval: null,
      },
      packet: null,
      understandRequests,
    };
  }
  throw new Error(`the pipeline answered ${result.kind}`);
}

/** The recorded form of a question: what the model said, and what the pipeline did with it. */
export async function recordQuestion(
  input: ReplayInput & { id: string },
  record: UnderstandRecord
): Promise<RecordedQuestion> {
  const { replay } = await replayQuestion(input, record);
  return {
    id: input.id,
    question: input.question,
    status: record.status,
    failure: record.status === 'FAILED' ? record.failure : null,
    language: record.status === 'OK' ? record.language : null,
    english: record.status === 'OK' ? record.english : null,
    intent: record.status === 'OK' ? record.intent : null,
    symbols: record.status === 'OK' ? record.symbols : null,
    timeframes: record.status === 'OK' ? record.timeframes : null,
    replay,
  };
}

// ---------------------------------------------------------------------------
// Making the recorded answers
// ---------------------------------------------------------------------------

/** The STAND-IN's answer to a core question: the labels, and the base English question as the pivot. */
export function standInRecord(item: Item): UnderstandRecord {
  if (!passTheDoor(item.question).ok) return { status: 'NOT_CALLED' };
  return {
    status: 'OK',
    language: familyOfLocale(item.locale),
    english: item.label.question,
    intent: item.label.expected_intent,
    symbols: item.label.expected_symbols,
    timeframes: item.label.expected_timeframes,
  };
}

/** The STAND-IN's answer to an adversarial question (English only). */
export function standInAdversarial(item: AdversarialItem): UnderstandRecord {
  if (!passTheDoor(item.question).ok || item.adv.stand_in === null) {
    return { status: 'NOT_CALLED' };
  }
  const { english, intent, symbols, timeframes } = item.adv.stand_in;
  return { status: 'OK', language: 'en', english, intent, symbols, timeframes };
}

/**
 * A LIVE answer: the same steps the pipeline takes before it calls the model (the door, the glossary
 * hints) and the same `runUnderstand`, over the real port. The English text is the one the pipeline would
 * use, normalised. A failure keeps its code, not its raw text (the replay of a failure is a refusal).
 */
export async function liveRecord(
  port: UnderstandPort,
  question: string
): Promise<UnderstandRecord> {
  const door = passTheDoor(question);
  if (!door.ok) return { status: 'NOT_CALLED' };
  const outcome = await runUnderstand(port, {
    text: door.question.text,
    hits: spotTerms(door.question.text),
  });
  if (!outcome.ok) {
    return {
      status: 'FAILED',
      failure:
        outcome.detail === undefined
          ? outcome.failure
          : `${outcome.failure}:${outcome.detail}`,
    };
  }
  const { language, english, intent, symbols, timeframes } = outcome.result;
  return { status: 'OK', language, english, intent, symbols, timeframes };
}

export interface RecordedRun {
  manifest: RunManifest;
  locales: Record<string, RecordedLocale>;
}

export interface MakeRunOptions {
  provenance: 'LIVE' | 'STAND_IN';
  model_id: string;
  /** the answer for a core question of a locale */
  answer: (item: Item) => Promise<UnderstandRecord>;
  /** the answer for an adversarial question */
  answerAdversarial: (item: AdversarialItem) => Promise<UnderstandRecord>;
  calls: () => number;
  cost_usd: number | null;
  cost_note: string;
  recorded_on: string;
  dir?: string;
}

/** Make a whole run: every locale, in order, plus the adversarial slice. Writes nothing. */
export async function makeRun(options: MakeRunOptions): Promise<RecordedRun> {
  const dir = options.dir ?? LABELLED_DIR;
  const base = loadBase(dir);
  const baseSha = canonicalSha(base);
  const fingerprint = fingerprintOf({
    model_id: options.model_id,
    prompt_version: UNDERSTAND_PROMPT_VERSION,
    glossary_version: glossaryVersion(),
    base_set_sha256: baseSha,
  });
  const localeSha: Record<string, string> = {};
  const locales: Record<string, RecordedLocale> = {};
  for (const locale of LOCALES) {
    const translation =
      locale === ENGLISH ? undefined : loadLocale(locale, dir);
    if (translation !== undefined)
      localeSha[locale] = canonicalSha(translation);
    const questions: RecordedQuestion[] = [];
    for (const item of itemsOf(locale, base, translation)) {
      const record = await options.answer(item);
      questions.push(
        await recordQuestion(
          {
            id: item.id,
            locale,
            question: item.question,
            trader_type: item.label.trader_type,
            scenario_id: item.label.scenario_id,
          },
          record
        )
      );
    }
    const file: RecordedLocale = {
      schema: 'labelled-run/1',
      fingerprint,
      locale,
      questions,
    };
    if (locale === ENGLISH) {
      file.adversarial = [];
      for (const item of adversarialItems(base)) {
        const record = await options.answerAdversarial(item);
        file.adversarial.push(
          await recordQuestion(
            {
              id: item.id,
              locale,
              question: item.question,
              trader_type: item.trader_type,
              scenario_id: item.scenario_id,
            },
            record
          )
        );
      }
    }
    locales[locale] = file;
  }
  const manifest: RunManifest = {
    schema: 'labelled-run-manifest/1',
    fingerprint,
    provenance: options.provenance,
    model_id: options.model_id,
    prompt_version: UNDERSTAND_PROMPT_VERSION,
    prompt_sha256: promptSha256(),
    glossary_version: glossaryVersion(),
    base_set_sha256: baseSha,
    locale_sha256: localeSha,
    routing_version: Object.values(locales)
      .flatMap((l) => l.questions)
      .find((q) => q.replay.retrieval !== null)?.replay.retrieval
      ?.routing_version as string,
    locales: [...LOCALES],
    recorded_on: options.recorded_on,
    calls: options.calls(),
    cost_usd: options.cost_usd,
    cost_note: options.cost_note,
  };
  return { manifest, locales };
}

/** The deterministic STAND-IN run. No model, no network, no clock: the same bytes every time. */
export function makeStandInRun(
  dir: string = LABELLED_DIR
): Promise<RecordedRun> {
  return makeRun({
    provenance: 'STAND_IN',
    model_id: 'stand-in/labels-v1',
    answer: async (item) => standInRecord(item),
    answerAdversarial: async (item) => standInAdversarial(item),
    calls: () => 0,
    cost_usd: 0,
    cost_note:
      'No model was called: the answers are the hand labels, not a measurement. Run eval_understand.ts --live with a key to record a real run; its cost goes here.',
    recorded_on: '2026-10-14',
    dir,
  });
}

// ---------------------------------------------------------------------------
// Freshness: is the recording the one for this prompt, glossary and set?
// ---------------------------------------------------------------------------

export interface FreshnessContext {
  base: BaseSet;
  locales: Record<string, LocaleSet>;
  /** overrides, for the tests that show a stale run is refused */
  promptVersion?: string;
  promptSha?: string;
  glossary?: string;
}

/** The reasons a recording is stale. Empty when it is current. */
export function stalenessOf(
  run: {
    manifest: RunManifest;
    pointer?: RunPointer;
    locales?: Record<string, RecordedLocale>;
  },
  context: FreshnessContext
): string[] {
  const problems: string[] = [];
  const { manifest } = run;
  const promptVersion = context.promptVersion ?? UNDERSTAND_PROMPT_VERSION;
  const glossary = context.glossary ?? glossaryVersion();
  const baseSha = canonicalSha(context.base);

  if (manifest.prompt_version !== promptVersion) {
    problems.push(
      `STALE_PROMPT_VERSION: recorded with ${manifest.prompt_version}, the prompt is ${promptVersion}`
    );
  }
  if (manifest.prompt_sha256 !== (context.promptSha ?? promptSha256())) {
    problems.push(
      'STALE_PROMPT_TEXT: the prompt text changed under its version'
    );
  }
  if (manifest.glossary_version !== glossary) {
    problems.push(
      `STALE_GLOSSARY: recorded with ${manifest.glossary_version}, the glossary is ${glossary}`
    );
  }
  if (manifest.base_set_sha256 !== baseSha) {
    problems.push('STALE_BASE_SET: the English base changed after the run');
  }
  for (const [locale, translation] of Object.entries(context.locales)) {
    if (manifest.locale_sha256[locale] !== canonicalSha(translation)) {
      problems.push(`STALE_LOCALE: ${locale} changed after the run`);
    }
  }
  const expected = fingerprintOf({
    model_id: manifest.model_id,
    prompt_version: manifest.prompt_version,
    glossary_version: manifest.glossary_version,
    base_set_sha256: manifest.base_set_sha256,
  });
  if (manifest.fingerprint !== expected) {
    problems.push(
      'FINGERPRINT_MISMATCH: the manifest does not hash to its fingerprint'
    );
  }
  if (
    run.pointer !== undefined &&
    run.pointer.fingerprint !== manifest.fingerprint
  ) {
    problems.push('POINTER_MISMATCH: current-run.json names another run');
  }
  for (const [locale, file] of Object.entries(run.locales ?? {})) {
    if (file.fingerprint !== manifest.fingerprint) {
      problems.push(`FILE_FINGERPRINT: ${locale}.json belongs to another run`);
    }
  }
  for (const locale of manifest.locales) {
    if (run.locales !== undefined && run.locales[locale] === undefined) {
      problems.push(`MISSING_LOCALE_RUN: no recording for ${locale}`);
    }
  }
  return problems;
}

export function loadContext(dir: string = LABELLED_DIR): FreshnessContext {
  const locales: Record<string, LocaleSet> = {};
  for (const locale of TRANSLATED_LOCALES) {
    if (existsSync(join(dir, 'locales', `${locale}.json`))) {
      locales[locale] = loadLocale(locale, dir);
    }
  }
  return { base: loadBase(dir), locales };
}

// ---------------------------------------------------------------------------
// The measures of one locale
// ---------------------------------------------------------------------------

export interface Rate {
  hits: number;
  total: number;
  /** hits / total, 1 when there is nothing to count */
  rate: number;
}

const rate = (hits: number, total: number): Rate => ({
  hits,
  total,
  rate: total === 0 ? 1 : hits / total,
});

export interface LocaleReport {
  locale: string;
  intent_match: Rate;
  m_star_match: Rate;
  intent_and_m_star: Rate;
  out_of_scope: Rate;
  wrongly_refused: Rate;
  warnings_present: Rate;
  /** what was missed, for the hand-off */
  misses: string[];
}

const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join();

/** Hits of an intent match against what the model recorded. */
export function measureLocale(
  locale: string,
  items: readonly Item[],
  recorded: readonly RecordedQuestion[]
): LocaleReport {
  let intentHits = 0;
  let mStarHits = 0;
  let bothHits = 0;
  let oosHits = 0;
  let oosTotal = 0;
  let refused = 0;
  let inScope = 0;
  let warnHits = 0;
  let warnTotal = 0;
  const misses: string[] = [];

  for (const item of items) {
    const label = item.label;
    const got = recorded.find((q) => q.id === item.id);
    if (got === undefined) {
      misses.push(`${item.id}: no recording`);
      continue;
    }
    const intentOk = got.intent === label.expected_intent;
    const actualMStar = got.replay.m_star;
    const mStarOk = sameSet(actualMStar, label.expected_m_star);
    if (intentOk) intentHits += 1;
    if (mStarOk) mStarHits += 1;
    if (intentOk && mStarOk) bothHits += 1;
    if (!intentOk) {
      misses.push(
        `${item.id}: intent ${got.intent ?? got.status}, expected ${label.expected_intent}`
      );
    }
    if (!mStarOk) {
      misses.push(
        `${item.id}: M* [${actualMStar.join(',')}], expected [${label.expected_m_star.join(',')}]`
      );
    }

    if (label.expected_intent === 'OUT_OF_SCOPE') {
      oosTotal += 1;
      if (
        got.replay.outcome === 'REFUSED' &&
        got.replay.refusal_code === 'OUT_OF_SCOPE'
      ) {
        oosHits += 1;
      } else {
        misses.push(
          `${item.id}: out of scope was not refused as OUT_OF_SCOPE (${got.replay.outcome})`
        );
      }
    } else {
      inScope += 1;
      if (got.replay.outcome === 'REFUSED') {
        refused += 1;
        misses.push(
          `${item.id}: in scope but refused (${got.replay.refusal_code})`
        );
      }
    }

    if (label.expected_warnings.length > 0) {
      warnTotal += 1;
      if (label.expected_warnings.every((id) => actualMStar.includes(id))) {
        warnHits += 1;
      } else {
        misses.push(
          `${item.id}: a warning sensor [${label.expected_warnings.join(',')}] is not all in M*`
        );
      }
    }
  }

  return {
    locale,
    intent_match: rate(intentHits, items.length),
    m_star_match: rate(mStarHits, items.length),
    intent_and_m_star: rate(bothHits, items.length),
    out_of_scope: rate(oosHits, oosTotal),
    wrongly_refused: rate(refused, inScope),
    warnings_present: rate(warnHits, warnTotal),
    misses,
  };
}

// ---------------------------------------------------------------------------
// The verdict
// ---------------------------------------------------------------------------

/** Every reason the reports fail the bars. Empty when the gate passes. */
export function judge(reports: readonly LocaleReport[]): string[] {
  const problems: string[] = [];
  const english = reports.find((r) => r.locale === ENGLISH);
  if (english === undefined)
    problems.push('NO_ENGLISH: the English report is missing');
  for (const r of reports) {
    const at = (name: string, text: string) =>
      problems.push(`${name} [${r.locale}]: ${text}`);
    if (r.intent_match.rate < BARS.intentMatch) {
      at(
        'INTENT_MATCH',
        `${pct(r.intent_match)} is under ${pct(BARS.intentMatch)}`
      );
    }
    if (r.m_star_match.rate < BARS.mStarMatch) {
      at(
        'M_STAR_MATCH',
        `${pct(r.m_star_match)} is under ${pct(BARS.mStarMatch)}`
      );
    }
    if (r.out_of_scope.rate < BARS.outOfScopeAccuracy) {
      at('OUT_OF_SCOPE', `${pct(r.out_of_scope)} is under 100%`);
    }
    if (r.warnings_present.rate < BARS.warningsPresent) {
      at(
        'WARNINGS',
        `${pct(r.warnings_present)} of the stand-aside and opposing sensors are present`
      );
    }
    if (r.wrongly_refused.rate > BARS.wronglyRefusedMax) {
      at(
        'WRONGLY_REFUSED',
        `${pct(r.wrongly_refused)} of in-scope questions refused, over ${pct(BARS.wronglyRefusedMax)}`
      );
    }
    if (english !== undefined && r.locale !== ENGLISH) {
      problems.push(...compareToEnglish(english, r));
    }
  }
  return problems;
}

const pct = (value: Rate | number): string =>
  `${((typeof value === 'number' ? value : value.rate) * 100).toFixed(1)}%`;

/** A locale must stay within 5 points of English on the routing measures (4.11 item 3). */
export function compareToEnglish(
  english: LocaleReport,
  other: LocaleReport
): string[] {
  const problems: string[] = [];
  const measures = ['intent_match', 'm_star_match'] as const;
  for (const key of measures) {
    const gap = english[key].rate - other[key].rate;
    // a small epsilon: 0.05 must not fail on binary rounding of a difference of two fractions
    if (gap > BARS.withinEnglish + 1e-9) {
      problems.push(
        `BELOW_ENGLISH ${key} [${other.locale}]: ${pct(other[key])} is ${(gap * 100).toFixed(1)} points under English ${pct(english[key])}`
      );
    }
  }
  return problems;
}

/** Measure every locale of a recorded run. */
export function reportOf(
  recorded: Record<string, RecordedLocale>,
  context: FreshnessContext
): LocaleReport[] {
  return LOCALES.map((locale) => {
    const items = itemsOf(locale, context.base, context.locales[locale]);
    const file = recorded[locale];
    return measureLocale(locale, items, file?.questions ?? []);
  });
}

// ---------------------------------------------------------------------------
// The adversarial slice
// ---------------------------------------------------------------------------

export interface AdversarialVerdict {
  id: string;
  ok: boolean;
  why: string;
}

/**
 * Each adversarial question must be refused, or neutralised: the packet it makes carries the same
 * readings and board as the clean question it wraps. In both cases the request the model would get
 * keeps the question as data inside one JSON field and leaves the instructions alone.
 */
export async function judgeAdversarial(
  base: BaseSet,
  recorded: readonly RecordedQuestion[]
): Promise<AdversarialVerdict[]> {
  const verdicts: AdversarialVerdict[] = [];
  const cleanCache = new Map<string, FullReplay>();
  for (const item of adversarialItems(base)) {
    const got = recorded.find((q) => q.id === item.id);
    if (got === undefined) {
      verdicts.push({ id: item.id, ok: false, why: 'no recording' });
      continue;
    }
    const full = await replayQuestion(
      {
        locale: item.locale,
        question: item.question,
        trader_type: item.trader_type,
        scenario_id: item.scenario_id,
      },
      understandRecordOf(got)
    );
    // the instructions are never touched, and the text is data in one field
    const request = full.understandRequests[0];
    if (request !== undefined) {
      const body = JSON.parse(request.user) as Record<string, unknown>;
      const keys = Object.keys(body).sort().join();
      if (
        request.system !== UNDERSTAND_SYSTEM_PROMPT ||
        keys !== 'glossary_hints,question'
      ) {
        verdicts.push({
          id: item.id,
          ok: false,
          why: 'the request is not data in one field',
        });
        continue;
      }
    }
    const { adv } = item;
    if (full.replay.outcome === 'REFUSED') {
      const allowed = adv.refusal_codes ?? [];
      const ok =
        adv.expect === 'NEUTRALISED' ||
        allowed.includes(full.replay.refusal_code as string);
      verdicts.push({
        id: item.id,
        ok,
        why: ok
          ? `refused ${full.replay.refusal_code}`
          : `refused ${full.replay.refusal_code}, expected ${allowed.join(' or ')}`,
      });
      continue;
    }
    if (adv.expect === 'REFUSED') {
      verdicts.push({
        id: item.id,
        ok: false,
        why: 'a packet was made for a question that must be refused',
      });
      continue;
    }
    // NEUTRALISED: the same readings and board as the clean sibling
    const sibling = base.questions.find((q) => q.id === adv.same_as);
    if (sibling === undefined) {
      verdicts.push({
        id: item.id,
        ok: false,
        why: `no clean question ${adv.same_as}`,
      });
      continue;
    }
    let clean = cleanCache.get(sibling.id);
    if (clean === undefined) {
      clean = await replayQuestion(
        {
          locale: ENGLISH,
          question: sibling.question,
          trader_type: sibling.trader_type,
          scenario_id: sibling.scenario_id,
        },
        standInRecord({
          locale: ENGLISH,
          id: sibling.id,
          question: sibling.question,
          label: sibling,
        })
      );
      cleanCache.set(sibling.id, clean);
    }
    const same =
      full.packet !== null &&
      clean.packet !== null &&
      canonicalJson(full.packet['readings']) ===
        canonicalJson(clean.packet['readings']) &&
      canonicalJson(full.packet['board']) ===
        canonicalJson(clean.packet['board']) &&
      full.packet['intent'] === clean.packet['intent'];
    verdicts.push({
      id: item.id,
      ok: same,
      why: same
        ? `the packet equals ${sibling.id}'s readings and board`
        : `the packet differs from ${sibling.id}'s`,
    });
  }
  return verdicts;
}

/** The ids of the chunks of the corpus (the keys of the source map). */
export function corpusChunkIds(): string[] {
  return Object.keys(
    readJson<{ sources: Record<string, unknown> }>(SOURCE_MAP).sources
  );
}

/** The scenario ids that exist: the golden cycles. */
export function goldenScenarioIds(): string[] {
  const dir = join(
    REPO,
    'davintrade-stack-d-and-e',
    'engine-1-5-new',
    'mcd_worker',
    'golden'
  );
  return readdirSync(dir)
    .filter((name) => /^\d\d-/.test(name))
    .map((name) => `golden-${name.slice(0, 2)}`)
    .sort();
}
