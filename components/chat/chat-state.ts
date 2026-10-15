/**
 * The state of the chat panel and the one function that changes it (build step 7 part 8).
 *
 * A reducer, plain and pure: the same actions in the same order always give the same state, which is
 * what lets the tests (and the development preview) play a recorded stream into it and look at the
 * result. It owns no timer, no network and no random id; the provider feeds it.
 *
 * Every way out of "in flight" is an action and a tested state: a result, a refusal, an error event,
 * a failure of the request (the connection dropped, the stream was cut, the server said 5xx), the
 * trader's own stop, and a route that is not switched on. A flight that cannot end is a stuck spinner,
 * and the reducer has no state in which a terminal action leaves `flight` set.
 *
 * @module components/chat/chat-state
 */

import { STAGES } from './limits';
import type {
  AskInput,
  ChatInfo,
  IntakeRefusal,
  PickerModel,
  QuotaBody,
  ReplyResult,
  ReplyStage,
  StageEvent,
  TerminalEvent,
} from './types';
import type { SendFailure } from './wire';

export type InfoStatus = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';
export type StageState = 'PENDING' | 'STARTED' | 'DONE' | 'SKIPPED';

export type ChatItem =
  | { id: string; kind: 'USER'; input: AskInput }
  | { id: string; kind: 'RESULT'; requestId: string; result: ReplyResult }
  | {
      id: string;
      kind: 'REFUSAL';
      requestId: string | null;
      refusal: IntakeRefusal;
      quota: QuotaBody | null;
    }
  | {
      id: string;
      kind: 'ERROR';
      /** the server's id for the request, when it sent one (support opens it) */
      requestId: string | null;
      code: string;
      retryable: boolean;
      /** what to send again, with the same `clientRequestId` */
      clientRequestId: string;
      input: AskInput;
    }
  | { id: string; kind: 'CANCELLED' };

export interface Flight {
  clientRequestId: string;
  input: AskInput;
  stages: Readonly<Record<ReplyStage, StageState>>;
}

export interface ChatState {
  infoStatus: InfoStatus;
  info: ChatInfo | null;
  threadId: string | null;
  items: ChatItem[];
  flight: Flight | null;
  /** the model the trader picked; the default when null */
  modelSlug: string | null;
  /** the counter the next item id is made from */
  next: number;
}

export type ChatAction =
  | { type: 'INFO_LOADING' }
  | { type: 'INFO_LOADED'; info: ChatInfo }
  | { type: 'INFO_FAILED'; reason: 'DISABLED' | 'FAILED' | 'NETWORK' }
  | {
      type: 'SEND_STARTED';
      clientRequestId: string;
      input: AskInput;
      /** the same request sent again: no second bubble, and the error it is answering goes */
      retry: boolean;
    }
  | { type: 'STAGE'; event: StageEvent }
  | { type: 'TERMINAL'; event: TerminalEvent }
  | {
      type: 'SEND_FAILED';
      failure: SendFailure;
      clientRequestId: string;
      input: AskInput;
    }
  | { type: 'SELECT_MODEL'; slug: string }
  | { type: 'NEW_THREAD' };

export const emptyStages = (): Record<ReplyStage, StageState> =>
  Object.fromEntries(STAGES.map((stage) => [stage, 'PENDING'])) as Record<
    ReplyStage,
    StageState
  >;

export const initialChatState = (): ChatState => ({
  infoStatus: 'idle',
  info: null,
  threadId: null,
  items: [],
  flight: null,
  modelSlug: null,
  next: 1,
});

function push(
  state: ChatState,
  make: (id: string) => ChatItem,
  patch: Partial<ChatState> = {}
): ChatState {
  const item = make(`m${state.next}`);
  return {
    ...state,
    ...patch,
    items: [...state.items, item],
    next: state.next + 1,
  };
}

/** Whether pressing the same request again can be the same request (the server answers from what it stored). */
function retryableFailure(failure: SendFailure): boolean {
  switch (failure.kind) {
    case 'NETWORK':
    case 'BAD_STREAM':
      return true;
    case 'FAILED':
      return failure.status >= 500;
    default:
      return false;
  }
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'INFO_LOADING':
      return { ...state, infoStatus: 'loading' };

    case 'INFO_LOADED':
      return { ...state, infoStatus: 'ready', info: action.info };

    case 'INFO_FAILED':
      return {
        ...state,
        infoStatus: action.reason === 'DISABLED' ? 'unavailable' : 'error',
      };

    case 'SEND_STARTED': {
      const base: ChatState = {
        ...state,
        flight: {
          clientRequestId: action.clientRequestId,
          input: action.input,
          stages: emptyStages(),
        },
      };
      if (action.retry) {
        return {
          ...base,
          items: base.items.filter(
            (item) =>
              !(
                item.kind === 'ERROR' &&
                item.clientRequestId === action.clientRequestId
              )
          ),
        };
      }
      return push(base, (id) => ({ id, kind: 'USER', input: action.input }));
    }

    case 'STAGE': {
      if (state.flight === null) return state;
      const { stage, status } = action.event;
      return {
        ...state,
        flight: {
          ...state.flight,
          stages: { ...state.flight.stages, [stage]: status },
        },
      };
    }

    case 'TERMINAL': {
      const event = action.event;
      const flight = state.flight;
      if (event.type === 'result') {
        return push(
          state,
          (id) => ({
            id,
            kind: 'RESULT',
            requestId: event.request_id,
            result: event.result,
          }),
          { flight: null, threadId: event.result.thread_id }
        );
      }
      if (event.type === 'refusal') {
        return push(
          state,
          (id) => ({
            id,
            kind: 'REFUSAL',
            requestId: event.request_id,
            refusal: event.refusal,
            quota: null,
          }),
          { flight: null }
        );
      }
      return push(
        state,
        (id) => ({
          id,
          kind: 'ERROR',
          requestId: event.request_id,
          code: event.code,
          retryable: event.retryable,
          clientRequestId: flight?.clientRequestId ?? '',
          input: flight?.input ?? { kind: 'TYPED', question: '' },
        }),
        { flight: null }
      );
    }

    case 'SEND_FAILED': {
      const { failure } = action;
      if (failure.kind === 'ABORTED') {
        return push(state, (id) => ({ id, kind: 'CANCELLED' }), {
          flight: null,
        });
      }
      if (failure.kind === 'DISABLED') {
        // the route is not on: the panel says so, and the question it just showed goes with it
        const last = state.items[state.items.length - 1];
        return {
          ...state,
          flight: null,
          infoStatus: 'unavailable',
          items:
            last !== undefined && last.kind === 'USER'
              ? state.items.slice(0, -1)
              : state.items,
        };
      }
      if (failure.kind === 'REFUSED') {
        return push(
          state,
          (id) => ({
            id,
            kind: 'REFUSAL',
            requestId: failure.requestId,
            refusal: failure.refusal,
            quota: failure.quota,
          }),
          { flight: null }
        );
      }
      const code =
        failure.kind === 'FAILED'
          ? failure.code
          : failure.kind === 'NETWORK'
            ? 'NETWORK'
            : 'BAD_STREAM';
      return push(
        state,
        (id) => ({
          id,
          kind: 'ERROR',
          requestId: failure.kind === 'FAILED' ? failure.requestId : null,
          code,
          retryable: retryableFailure(failure),
          clientRequestId: action.clientRequestId,
          input: action.input,
        }),
        { flight: null }
      );
    }

    case 'SELECT_MODEL':
      return { ...state, modelSlug: action.slug };

    case 'NEW_THREAD':
      return { ...state, threadId: null, items: [], flight: null };
  }
}

// ---------------------------------------------------------------------------------------
// What the panel reads from the state
// ---------------------------------------------------------------------------------------

export const isBusy = (state: ChatState): boolean => state.flight !== null;

/** The model the picker shows: the one picked if it is still offered, else the default, else the first. */
export function chosenModel(state: ChatState): PickerModel | null {
  const models = state.info?.models ?? [];
  return (
    models.find((model) => model.slug === state.modelSlug) ??
    models.find((model) => model.default) ??
    models[0] ??
    null
  );
}

/**
 * The share of this month's allowance that is left, between 0 and 1, or null when it cannot be told
 * (the allowance is not set, or the ledger could not be read).
 */
export function shareLeft(info: ChatInfo | null): number | null {
  const quota = info?.quota;
  if (
    quota === undefined ||
    !quota.configured ||
    quota.limit_units === null ||
    quota.limit_units <= 0 ||
    quota.available_units === null
  ) {
    return null;
  }
  return Math.min(1, Math.max(0, quota.available_units / quota.limit_units));
}

/**
 * About how many analyses are left on a model, from what is free and what a message of it MEASURED
 * to cost. Null whenever either is not known: a guess is never shown (ADR-073).
 */
export function analysesLeft(
  info: ChatInfo | null,
  model: PickerModel | null
): number | null {
  const available = info?.quota.available_units;
  const cost = model?.units_per_msg;
  if (
    available === undefined ||
    available === null ||
    cost === undefined ||
    cost === null ||
    cost <= 0
  ) {
    return null;
  }
  return Math.max(0, Math.floor(available / cost));
}
