/**
 * The states of Panel B for the development preview (build step 7 part 8): every one is built by
 * playing a RECORDED answer of the real message route (`recorded.json`, made by
 * `__tests__/components/chat/helpers/record.ts`) into the panel's real reducer, so what the preview
 * draws is what the panel draws for the server's real replies. Nothing here is a hand-made reply.
 *
 * The three states that have no reply behind them (a request that is still running, a connection that
 * dropped, a stream that was cut) are made from the reducer's own actions.
 */

import {
  chatReducer,
  initialChatState,
  type ChatState,
} from '@/components/chat/chat-state';
import { STAGES } from '@/components/chat/limits';
import type {
  AskInput,
  ChatInfo,
  DemoRecording,
  ReplyStage,
  ReplyResult,
  StreamEvent,
  TerminalEvent,
} from '@/components/chat/types';
import { failureFromBody } from '@/components/chat/wire';

import recordedJson from './recorded.json';

export type Exchange =
  | { kind: 'STREAM'; status: number; events: StreamEvent[] }
  | { kind: 'JSON'; status: number; body: unknown };

export const RECORDED = recordedJson as unknown as Record<string, Exchange>;

export const TYPED: AskInput = {
  kind: 'TYPED',
  question: 'What is the direction of gold now?',
};
const INSTANT_M15: AskInput = {
  kind: 'INSTANT',
  intent: 'INSTANT_M15_INSPECT',
};

const isTerminal = (event: StreamEvent): event is TerminalEvent =>
  event.type !== 'stage';

let counter = 0;
const requestId = (): string => `preview-request-${(counter += 1)}`;

/** The state after one request is sent and its recorded answer plays to its end. */
export function playExchange(
  from: ChatState,
  input: AskInput,
  name: string
): ChatState {
  const exchange = RECORDED[name];
  if (exchange === undefined) throw new Error(`no recorded exchange ${name}`);
  const clientRequestId = requestId();
  let state = chatReducer(from, {
    type: 'SEND_STARTED',
    clientRequestId,
    input,
    retry: false,
  });
  if (exchange.kind === 'JSON') {
    return chatReducer(state, {
      type: 'SEND_FAILED',
      failure: failureFromBody(exchange.status, exchange.body),
      clientRequestId,
      input,
    });
  }
  for (const event of exchange.events) {
    state = chatReducer(
      state,
      isTerminal(event) ? { type: 'TERMINAL', event } : { type: 'STAGE', event }
    );
  }
  return state;
}

/** The state of a request still running: its recorded stages up to the moment `stage` begins. */
export function inFlightAt(
  from: ChatState,
  input: AskInput,
  stage: ReplyStage
): ChatState {
  const exchange = RECORDED['report1-long'] as Exchange;
  if (exchange.kind !== 'STREAM') throw new Error('not a stream');
  let state = chatReducer(from, {
    type: 'SEND_STARTED',
    clientRequestId: requestId(),
    input,
    retry: false,
  });
  for (const event of exchange.events) {
    if (event.type !== 'stage') break;
    state = chatReducer(state, { type: 'STAGE', event });
    if (event.stage === stage && event.status === 'STARTED') break;
  }
  return state;
}

export interface Scenario {
  id: string;
  label: string;
  note: string;
  tier: 'FREE' | 'PRO';
  /** drawn as the collapsed rail the workspace shows */
  collapsed?: boolean;
  /** the recorded example, for a Free trader */
  demo?: boolean;
  /** the answer to the state route: `unavailable` is its 404, `failed` its failure */
  info?: 'ready' | 'unavailable' | 'failed';
  /** a stand-in server answers what is typed, with `answer` (the live scenario) */
  live?: boolean;
  build: (start: ChatState) => ChatState;
}

const reply = (id: string): ((s: ChatState) => ChatState) => {
  return (s) => playExchange(s, TYPED, id);
};

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'idle',
    label: 'Idle, nothing asked yet',
    note: 'The empty state of a PRO panel after the state route answered.',
    tier: 'PRO',
    build: (s) => s,
  },
  ...STAGES.map(
    (stage): Scenario => ({
      id: `inflight-${stage}`,
      label: `In flight: ${stage}`,
      note: `The request is at the ${stage} stage; the stages before it are done (or skipped), the ones after wait.`,
      tier: 'PRO',
      build: (s) => inFlightAt(s, TYPED, stage),
    })
  ),
  {
    id: 'report1-long',
    label: 'Report 1, LONG (day trader)',
    note: 'A typed question; the full report: headline, direction, six sections, the stamp, the Trade Setup button.',
    tier: 'PRO',
    build: reply('report1-long'),
  },
  {
    id: 'report1-short-instant',
    label: 'Report 1, SHORT (scalper), from a Panel C button',
    note: 'An instant prompt: the Understand stage is skipped.',
    tier: 'PRO',
    build: (s) => playExchange(s, INSTANT_M15, 'report1-short-instant'),
  },
  {
    id: 'report1-flagged',
    label: 'Report 1 with a number that could not be verified',
    note: 'The model wrote a wrong price twice; the card shows the mark of the language, never the literal.',
    tier: 'PRO',
    build: reply('report1-flagged'),
  },
  {
    id: 'answer',
    label: 'Short answer with the Trade Setup action',
    note: 'An exit-targets question: a short text, the ids it rests on, the action.',
    tier: 'PRO',
    build: (s) =>
      playExchange(
        s,
        { kind: 'TYPED', question: 'Where would you exit this?' },
        'answer'
      ),
  },
  {
    id: 'fixed-stale',
    label: 'Fixed answer: the data stopped',
    note: 'No direction; the stamp is the stop time.',
    tier: 'PRO',
    build: reply('fixed-stale'),
  },
  {
    id: 'fixed-model-down',
    label: 'Fixed answer: both models down',
    note: 'The direction word, the rule, the board and the levels; no model text.',
    tier: 'PRO',
    build: reply('fixed-model-down'),
  },
  {
    id: 'fixed-market-closed',
    label: 'Fixed answer: market closed',
    note: 'A Report 2 request while the market is closed.',
    tier: 'PRO',
    build: (s) =>
      playExchange(
        s,
        { kind: 'TYPED', question: 'Open a trade for me' },
        'fixed-market-closed'
      ),
  },
  {
    id: 'action',
    label: 'Action: open the trade setup (no model)',
    note: 'A Report 2 request: the button only.',
    tier: 'PRO',
    build: (s) =>
      playExchange(
        s,
        { kind: 'TYPED', question: 'Open a trade for me' },
        'action'
      ),
  },
  {
    id: 'refusal-out-of-scope',
    label: 'Refusal: another symbol (in the stream)',
    note: 'The scope check; the server wrote the reply in the reader’s language.',
    tier: 'PRO',
    build: (s) =>
      playExchange(
        s,
        { kind: 'TYPED', question: 'What is the direction of EURUSD?' },
        'refusal-out-of-scope'
      ),
  },
  {
    id: 'refusal-quota',
    label: 'Refusal: the allowance cannot cover it (HTTP 429)',
    note: 'Before any stream: a JSON body with the refusal and the balance; the card shows the share left.',
    tier: 'PRO',
    build: reply('refusal-quota'),
  },
  {
    id: 'refusal-tier',
    label: 'Refusal: PRO only (HTTP 403)',
    note: 'With the upgrade button.',
    tier: 'PRO',
    build: reply('refusal-tier'),
  },
  {
    id: 'refusal-profile',
    label: 'Refusal: no trader profile (HTTP 409)',
    note: 'The trader has not confirmed a profile.',
    tier: 'PRO',
    build: reply('refusal-profile'),
  },
  {
    id: 'error-persistence',
    label: 'Error: the reply could not be saved',
    note: 'An error event after the stream began; not retryable; the request id is shown.',
    tier: 'PRO',
    build: reply('error-persistence'),
  },
  {
    id: 'error-network',
    label: 'Error: the connection dropped',
    note: 'No answer came; "Try again" sends the same request with the same id.',
    tier: 'PRO',
    build: (s) => {
      const started = chatReducer(s, {
        type: 'SEND_STARTED',
        clientRequestId: requestId(),
        input: TYPED,
        retry: false,
      });
      return chatReducer(started, {
        type: 'SEND_FAILED',
        failure: { kind: 'NETWORK' },
        clientRequestId: 'preview-network',
        input: TYPED,
      });
    },
  },
  {
    id: 'error-bad-stream',
    label: 'Error: the stream was cut',
    note: 'The answer stopped before its last event; nothing is drawn from it.',
    tier: 'PRO',
    build: (s) =>
      chatReducer(
        chatReducer(s, {
          type: 'SEND_STARTED',
          clientRequestId: requestId(),
          input: TYPED,
          retry: false,
        }),
        {
          type: 'SEND_FAILED',
          failure: { kind: 'BAD_STREAM' },
          clientRequestId: 'preview-cut',
          input: TYPED,
        }
      ),
  },
  {
    id: 'cancelled',
    label: 'Stopped by the trader',
    note: 'The Stop button ended the request.',
    tier: 'PRO',
    build: (s) =>
      chatReducer(
        chatReducer(s, {
          type: 'SEND_STARTED',
          clientRequestId: requestId(),
          input: TYPED,
          retry: false,
        }),
        {
          type: 'SEND_FAILED',
          failure: { kind: 'ABORTED' },
          clientRequestId: 'preview-stop',
          input: TYPED,
        }
      ),
  },
  {
    id: 'conversation',
    label: 'A conversation: report, short answer, refusal',
    note: 'Three turns in one thread, to see the scroll and the spacing.',
    tier: 'PRO',
    build: (s) =>
      playExchange(
        playExchange(
          playExchange(s, TYPED, 'report1-long'),
          { kind: 'TYPED', question: 'Where would you exit this?' },
          'answer'
        ),
        { kind: 'TYPED', question: 'What is the direction of EURUSD?' },
        'refusal-out-of-scope'
      ),
  },
  {
    id: 'unavailable',
    label: 'Not switched on (the state route answers 404)',
    note: 'REPLY_ENABLED is off: no composer, no meter.',
    tier: 'PRO',
    info: 'unavailable',
    build: (s) => s,
  },
  {
    id: 'state-failed',
    label: 'The state route failed',
    note: 'A notice with Try again; the composer stays.',
    tier: 'PRO',
    info: 'failed',
    build: (s) => s,
  },
  {
    id: 'free-demo',
    label: 'Free: the recorded example',
    note: 'The banner "Recorded example, data as of ..." and a replay of two recorded replies; the picker is locked.',
    tier: 'FREE',
    demo: true,
    build: (s) => s,
  },
  {
    id: 'free-no-demo',
    label: 'Free: no recording yet',
    note: 'What the live app shows today: the recording is part 10’s content.',
    tier: 'FREE',
    build: (s) => s,
  },
  {
    id: 'collapsed',
    label: 'Collapsed',
    note: 'The rail the workspace shows in the panel’s place.',
    tier: 'PRO',
    collapsed: true,
    build: (s) => s,
  },
  {
    id: 'live',
    label: 'Live stand-in: type a question',
    note: 'A stand-in server plays a recorded answer with a pause between stages, so the progress can be watched. The Trade Setup button reaches a route that is off, as in production.',
    tier: 'PRO',
    live: true,
    build: (s) => s,
  },
];

// ---------------------------------------------------------------------------------------
// The things the controls choose
// ---------------------------------------------------------------------------------------

export const QUOTAS = ['50', '0', '100', 'unconfigured', 'unknown'] as const;
export type QuotaChoice = (typeof QUOTAS)[number];

export const MODEL_SETS = ['two', 'none'] as const;
export type ModelSet = (typeof MODEL_SETS)[number];

/** TEST values: no model has passed yet, so these two exist only here. */
export function previewInfo(quota: QuotaChoice, models: ModelSet): ChatInfo {
  const limit = 20_000_000;
  const quotaState = {
    '50': { configured: true, limit, used: limit / 2 },
    '0': { configured: true, limit, used: limit },
    '100': { configured: true, limit, used: 0 },
    unconfigured: { configured: false, limit: null, used: null },
    unknown: { configured: true, limit: null, used: null },
  }[quota];
  return {
    models:
      models === 'none'
        ? []
        : [
            {
              slug: 'preview-vendor/test-a',
              name: 'Test model A',
              multiplier: 1,
              vision: true,
              units_per_msg: 18_000,
              default: true,
            },
            {
              slug: 'preview-vendor/test-b',
              name: 'Test model B',
              multiplier: 3,
              vision: false,
              units_per_msg: null,
              default: false,
            },
          ],
    quota: {
      configured: quotaState.configured,
      month: '2026-10',
      limit_units: quotaState.limit,
      used_units: quotaState.used,
      reserved_units: quotaState.limit === null ? null : 0,
      available_units:
        quotaState.limit === null || quotaState.used === null
          ? null
          : quotaState.limit - quotaState.used,
    },
    profile: { trader_type: 'DAY_TRADER' },
    cycle: { slot: '2026-09-18T20:55Z', data_status: 'FRESH' },
  };
}

/** The recorded example of a Free trader: two recorded replies of the same cycle. */
export function previewDemo(): DemoRecording {
  const results = (names: string[]): ReplyResult[] =>
    names.map((name) => {
      const exchange = RECORDED[name] as Exchange;
      if (exchange.kind !== 'STREAM') throw new Error('not a stream');
      const last = exchange.events[exchange.events.length - 1] as StreamEvent;
      if (last.type !== 'result') throw new Error('not a result');
      return last.result;
    });
  const [report, answer] = results(['report1-long', 'answer']) as [
    ReplyResult,
    ReplyResult,
  ];
  return {
    as_of: report.stamp.as_of ?? '2026-09-18T20:55Z',
    locale: 'en-US',
    turns: [
      {
        question: 'What is the direction of gold now?',
        instant: null,
        result: report,
      },
      {
        question: 'Where would you exit this?',
        instant: null,
        result: answer,
      },
    ],
  };
}

export const initialStateFor = (info: ChatInfo | null): ChatState => ({
  ...initialChatState(),
  info,
  infoStatus: info === null ? 'idle' : 'ready',
});
