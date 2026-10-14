/**
 * The context assembler (build step 7 part 2; architecture 5.4 and 5.5, ADR-047 to ADR-049 and
 * ADR-057, plan decisions D6, D7 and D14).
 *
 * It turns an intake packet, the day's closed bars, the thread so far and the chart that was
 * kept into the prompt for ONE model call, inside the budget of that model:
 *
 *  1. Every component is built as a LADDER of forms, fullest first (`cut.ts`): the OHLC as the
 *     full day or the summary, the readings with or without their details, the knowledge as
 *     many items as there are or fewer, the history as its last messages or fewer or a summary.
 *  2. Each starts in the fullest form that fits its own cap (the "when over" column of 5.4).
 *  3. The total is held to `min(19,600, the model's budget)` by the cut order of ADR-048:
 *     history, then knowledge (expansions, then chunk 4), then the OHLC, then reading details.
 *     The rules, the board, the warnings, the profile and events and the question are never cut;
 *     when only they are left and the request is still over, the result is a REFUSAL
 *     (`CONTEXT_OVER_BUDGET`) and the model is never called.
 *  4. The forms are put in cache order: static rules, cycle block, chart, user part (ADR-049).
 *  5. Before it is handed back, the finished text is read for its structure: the marker lines
 *     must be exactly the ones this code writes, in the order it writes them. If anything else
 *     ever starts a line with the marker prefix, the result is a refusal (`PROMPT_STRUCTURE`).
 *
 * The estimates are the estimator's raw counts (`tokens.ts`); the trace records them per
 * component, and the real count from the gateway is kept beside them so the estimator's error is
 * measured on every request.
 *
 * Pure: no I/O, no clock. Hashing is a separate async step (`sealAssembly`).
 *
 * @module lib/reply/context/assemble
 */

import { PACKET_SYMBOL, secondsOfSlot, sha256Hex } from '../contracts/intake';
import type { IntakePacket } from '../contracts/intake';
import { SHAPE_OF_INTENT } from '../contracts/intent-shapes';
import { CONTEXT_COMPONENTS } from '../contracts/trace-fields';
import type { ContextComponent, ReplyShape } from '../contracts/trace-fields';
import { budgetInputProblem, effectiveBudget } from './budget';
import { CONTEXT_CAPS, capOf } from './caps';
import type { ContextCaps } from './caps';
import { fitToBudget, startForm } from './cut';
import type { CutStep, Form } from './cut';
import { historyForms } from './history';
import type { HistoryRow } from './history';
import { formatCompactOhlc } from './ohlc-compact';
import type { DayBars, OhlcMode } from './ohlc-compact';
import { markerLabel, markerLines, marker } from './prompt';
import { renderReadings } from './readings';
import {
  acceptedKnowledge,
  renderBoard,
  renderKnowledge,
  renderProfileEvents,
  renderQuestion,
} from './sections';
import {
  composePrompt,
  composeSegments,
  prefixOf,
  promptText,
} from './segments';
import type { Prompt, Segment } from './segments';
import {
  PROMPTS_VERSION,
  SYSTEM_RULES_TEXT,
  WORDING_GUIDE_TEXT,
} from './static-text';
import {
  DEFAULT_CALIBRATION,
  estimateRawTokens,
  validateCalibration,
} from './tokens';
import type { TokenCalibration } from './tokens';

export interface ChartInput {
  /** an opaque reference the gateway turns into the image part */
  ref: string;
  /** what the image costs this model, in tokens */
  tokens: number;
}

export interface AssembleInput {
  /** a packet that passed the gate, the door and the scope check (`validatePacket`) */
  packet: IntakePacket;
  /** the day's closed bars of the packet's cycle; null when they could not be read */
  dayBars: DayBars | null;
  /** the thread so far, oldest first, NOT including the question being asked */
  history?: readonly HistoryRow[];
  /** the chart the answer gate kept, or none */
  chart?: ChartInput | null;
  /** the model's budget (registry `context_budget`), in the model's own tokens */
  modelBudget: number;
  calibration?: Readonly<TokenCalibration>;
  caps?: ContextCaps;
  /** the output tokens held back for the answer; the cap of 5.4 when omitted */
  answerReserve?: number;
  /** the static texts; the committed ones when omitted (a test passes its own) */
  texts?: { rules: string; wording: string };
}

export type AssembleCode =
  | 'NO_CYCLE'
  | 'NO_MODEL_SHAPE'
  | 'BAD_INPUT'
  | 'CONTEXT_OVER_BUDGET'
  | 'PROMPT_STRUCTURE';

export interface ComponentReport {
  /** the estimated size of the form that was used, before the margin */
  tokens: number;
  cap: number;
  /** the form that was used: `FULL`, `SUMMARY`, `VERBATIM_7`, ... */
  form: string;
  overCap: boolean;
}

export interface AssemblyDetails {
  components: Record<ContextComponent, ComponentReport>;
  /** the trace's `model.components`: the estimated size of each of the ten rows of 5.4 */
  componentTokens: Record<ContextComponent, number>;
  /** the sum of the ten, before the margin */
  total: number;
  /** `min(19,600, the model's budget less the margin)`, in the same tokens */
  budget: number;
  modelBudget: number;
  /** what the cut order did, in order; empty when nothing had to be cut */
  cuts: CutStep[];
}

export interface Assembly extends AssemblyDetails {
  ok: true;
  shape: ReplyShape;
  prompt: Prompt;
  segments: Segment[];
  /** the static rules then the cycle block: what a provider that caches by prefix can reuse */
  prefix: { text: string; tokens: number };
  ohlcMode: OhlcMode;
  /** events left out of the profile component to keep it inside its cap */
  eventsOmitted: number;
  /** the components that are over their own cap and cannot be cut (rules, board, profile, question) */
  capsExceeded: ContextComponent[];
}

export interface AssemblyRefused extends Partial<AssemblyDetails> {
  ok: false;
  code: AssembleCode;
  detail: string;
}

export type AssembleResult = Assembly | AssemblyRefused;

interface TextForm extends Form {
  text: string | null;
  /** for a knowledge form: how many items of the pack it shows */
  items?: number;
}

const refuse = (code: AssembleCode, detail: string): AssemblyRefused => ({
  ok: false,
  code,
  detail,
});

function single(
  label: string,
  text: string | null,
  tokens: number
): TextForm[] {
  return [{ label, text, tokens }];
}

/** The forms of one component with the same text collapsed, so a cut always changes something. */
function distinct(forms: TextForm[]): TextForm[] {
  const out: TextForm[] = [];
  for (const form of forms) {
    const last = out[out.length - 1];
    if (last === undefined || last.text !== form.text) out.push(form);
  }
  return out;
}

/** The marker labels a finished prompt must have, given how many knowledge items it shows. */
function expectedLabels(kinds: readonly ('CHUNK' | 'EXPANSION')[]): string[] {
  return [
    'RULES',
    'CYCLE BLOCK',
    'USER PART',
    'READINGS',
    'KNOWLEDGE',
    ...kinds,
    'HISTORY',
    'TRADER QUESTION',
    'END TRADER QUESTION',
    'TASK REMINDER',
  ];
}

export function assemble(input: AssembleInput): AssembleResult {
  const packet = input.packet;
  const caps = input.caps ?? CONTEXT_CAPS;
  const calibration = input.calibration ?? DEFAULT_CALIBRATION;
  const answerReserve = input.answerReserve ?? capOf('ANSWER', caps).cap;

  const calibrationProblems = validateCalibration(calibration);
  if (calibrationProblems.length > 0) {
    return refuse(
      'BAD_INPUT',
      `the calibration is unusable: ${calibrationProblems.join('; ')}`
    );
  }
  const budgetProblem = budgetInputProblem(input.modelBudget, answerReserve);
  if (budgetProblem !== null) {
    return refuse('BAD_INPUT', `${budgetProblem} is not a usable number`);
  }
  const slotSeconds = secondsOfSlot(packet.data.cycle_slot);
  if (slotSeconds === null) {
    return refuse('NO_CYCLE', 'the packet has no cycle to build a prompt for');
  }
  const shape = SHAPE_OF_INTENT[packet.intent];
  if (shape === 'NONE') {
    return refuse(
      'NO_MODEL_SHAPE',
      `${packet.intent} is answered without a model`
    );
  }
  if (input.dayBars !== null && input.dayBars.slotSeconds !== slotSeconds) {
    return refuse(
      'BAD_INPUT',
      "the day's bars are for another cycle than the packet's"
    );
  }
  const chart = input.chart ?? null;
  if (
    chart !== null &&
    (!Number.isInteger(chart.tokens) || chart.tokens < 0 || chart.ref === '')
  ) {
    return refuse(
      'BAD_INPUT',
      'the chart needs a reference and a whole number of tokens'
    );
  }

  const limits = caps.limits;
  const capFor = (id: ContextComponent): number => capOf(id, caps).cap;
  const rawTokens = (text: string): number =>
    estimateRawTokens(text, calibration);
  const header = { shape, chartAttached: chart !== null };

  // --- the ladders ---------------------------------------------------------

  const forms: Record<ContextComponent, TextForm[]> = {} as Record<
    ContextComponent,
    TextForm[]
  >;

  const rules = input.texts?.rules ?? SYSTEM_RULES_TEXT;
  const wording = input.texts?.wording ?? WORDING_GUIDE_TEXT;
  const rulesText = `${marker('RULES', { version: PROMPTS_VERSION })}${rules}\n\n${wording}\n`;
  forms.SYSTEM_RULES = single('STATIC', rulesText, rawTokens(rulesText));

  const boardText = renderBoard(packet);
  forms.BOARD_SYNTHESIS = single('BOARD', boardText, rawTokens(boardText));

  const bars: DayBars = input.dayBars ?? {
    symbol: PACKET_SYMBOL,
    slotSeconds,
    m5: [],
    m15: [],
  };
  const last =
    packet.data.last_price === null
      ? null
      : {
          price: packet.data.last_price.price,
          bar: packet.data.last_price.bar,
        };
  const summaryBars = {
    m5: limits.ohlc_summary_m5_bars,
    m15: limits.ohlc_summary_m15_bars,
  };
  const ohlcFull = formatCompactOhlc(bars, {
    mode: 'FULL',
    lastPrice: last,
    summaryBars,
  });
  const ohlcSummary = formatCompactOhlc(bars, {
    mode: 'SUMMARY',
    lastPrice: last,
    summaryBars,
  });
  const ohlcForms: TextForm[] = [
    { label: 'FULL', text: ohlcFull.text, tokens: rawTokens(ohlcFull.text) },
  ];
  if (
    ohlcSummary.m5Rows < ohlcFull.m5Rows ||
    ohlcSummary.m15Rows < ohlcFull.m15Rows
  ) {
    ohlcForms.push({
      label: 'SUMMARY',
      text: ohlcSummary.text,
      tokens: rawTokens(ohlcSummary.text),
    });
  }
  forms.OHLC = ohlcForms;

  forms.CHART = single(
    chart === null ? 'NONE' : 'ATTACHED',
    null,
    chart === null ? 0 : chart.tokens
  );

  const readingsFull = renderReadings(packet, 'FULL');
  const readingsLean = renderReadings(packet, 'DETAILS_DROPPED');
  forms.READINGS_ZONES = distinct([
    { label: 'FULL', text: readingsFull, tokens: rawTokens(readingsFull) },
    {
      label: 'DETAILS_DROPPED',
      text: readingsLean,
      tokens: rawTokens(readingsLean),
    },
  ]);

  const items = acceptedKnowledge(packet.knowledge);
  const knowledgeForms: TextForm[] = [];
  if (items.length === 0) {
    const text = renderKnowledge(packet.knowledge);
    knowledgeForms.push({ label: 'STATEMENT', text, tokens: rawTokens(text) });
  } else {
    const chunks = items.filter((item) => item.kind === 'CHUNK').length;
    // expansions go first, then chunk 4; the first three chunks stay
    const least = Math.max(
      Math.min(chunks, limits.knowledge_max_chunks - 1),
      1
    );
    for (let count = items.length; count >= least; count -= 1) {
      const text = renderKnowledge(packet.knowledge, count);
      knowledgeForms.push({
        label: `ITEMS_${count}`,
        text,
        tokens: rawTokens(text),
        items: count,
      });
    }
  }
  forms.KNOWLEDGE = knowledgeForms;

  const profile = renderProfileEvents(
    packet,
    header,
    capFor('PROFILE_EVENTS'),
    calibration
  );
  forms.PROFILE_EVENTS = single(
    'FITTED',
    profile.text,
    rawTokens(profile.text)
  );

  forms.HISTORY = historyForms(
    input.history ?? [],
    {
      verbatimMessages: limits.history_verbatim_messages,
      summaryMaxTokens: limits.history_summary_max_tokens,
    },
    calibration
  ).map((form) => ({
    label: form.verbatim === 0 ? 'SUMMARY_ONLY' : `VERBATIM_${form.verbatim}`,
    text: form.text,
    tokens: form.tokens,
  }));

  const questionText = renderQuestion(packet, shape);
  forms.QUESTION = single('BLOCK', questionText, rawTokens(questionText));

  forms.ANSWER = single('RESERVED', null, answerReserve);

  // --- the cut -------------------------------------------------------------

  const ladders = CONTEXT_COMPONENTS.map((id) => {
    const row = capOf(id, caps);
    const own = forms[id];
    return {
      id,
      rank: row.cut_rank,
      forms: own,
      start: row.cut_rank === null ? 0 : startForm(own, row.cap),
    };
  });
  const budget = effectiveBudget(caps, input.modelBudget, calibration);
  const cut = fitToBudget(ladders, budget);

  const components = {} as Record<ContextComponent, ComponentReport>;
  const componentTokens = {} as Record<ContextComponent, number>;
  const texts = {} as Record<ContextComponent, string | null>;
  const capsExceeded: ContextComponent[] = [];
  for (const id of CONTEXT_COMPONENTS) {
    const form = forms[id][cut.chosen[id]] as TextForm;
    const cap = capFor(id);
    components[id] = {
      tokens: form.tokens,
      cap,
      form: form.label,
      overCap: form.tokens > cap,
    };
    componentTokens[id] = form.tokens;
    texts[id] = form.text;
    if (form.tokens > cap) capsExceeded.push(id);
  }
  const details: AssemblyDetails = {
    components,
    componentTokens,
    total: cut.total,
    budget,
    modelBudget: input.modelBudget,
    cuts: cut.steps,
  };
  if (!cut.ok) {
    return {
      ok: false,
      code: 'CONTEXT_OVER_BUDGET',
      detail: `the prompt needs ${cut.total} tokens at its smallest and the budget is ${budget}`,
      ...details,
    };
  }

  // --- the segments and the structure check --------------------------------

  const segments = composeSegments(
    texts,
    componentTokens,
    chart === null ? null : chart.ref
  );
  const prompt = composePrompt(segments);
  const shownKnowledge = (forms.KNOWLEDGE[cut.chosen.KNOWLEDGE] as TextForm)
    .items;
  const kinds = items.slice(0, shownKnowledge ?? 0).map((item) => item.kind);
  const want = expectedLabels(kinds);
  const got = markerLines(promptText(prompt)).map(markerLabel);
  if (want.join('\n') !== got.join('\n')) {
    return {
      ok: false,
      code: 'PROMPT_STRUCTURE',
      detail: `the prompt's marker lines are not the ones this assembler writes: expected ${want.join(' > ')} but found ${got.join(' > ')}`,
      ...details,
    };
  }

  return {
    ok: true,
    shape,
    prompt,
    segments,
    prefix: prefixOf(segments),
    ohlcMode: components.OHLC.form === 'SUMMARY' ? 'SUMMARY' : 'FULL',
    eventsOmitted: profile.eventsOmitted,
    capsExceeded,
    ...details,
  };
}

// ---------------------------------------------------------------------------
// Hashes (async: the digest is Web Crypto's)
// ---------------------------------------------------------------------------

export interface SegmentHashes {
  static: string;
  /** the trace's `cycle_block_sha256` */
  cycle: string;
  /** static plus cycle: the shared prefix */
  prefix: string;
  user: string;
  /** the whole text of the prompt */
  full: string;
}

export interface SealedAssembly extends Assembly {
  hashes: SegmentHashes;
}

/** The SHA-256 of each segment, of the prefix and of the whole text. */
export async function sealAssembly(
  assembly: Assembly
): Promise<SealedAssembly> {
  const text = (id: Segment['id']): string =>
    assembly.segments.find((s) => s.id === id)?.text ?? '';
  const [staticHash, cycle, prefix, user, full] = await Promise.all([
    sha256Hex(text('STATIC')),
    sha256Hex(text('CYCLE')),
    sha256Hex(assembly.prefix.text),
    sha256Hex(text('USER')),
    sha256Hex(promptText(assembly.prompt)),
  ]);
  return {
    ...assembly,
    hashes: { static: staticHash, cycle, prefix, user, full },
  };
}
