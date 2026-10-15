/**
 * The shapes the chat panel reads (build step 7 part 8).
 *
 * This is the ONE file of `components/` that imports `lib/reply`, and it imports TYPES only: nothing
 * here runs, so no server code (the intake pipeline, the ledger, `node:crypto`) reaches the browser
 * bundle through it. Every other file of `components/chat/` takes the contracts from here. The
 * reply boundaries guard (`__tests__/lib/reply/boundaries.test.ts`) names this file as the single
 * importer; the lists below that repeat a contract's words at run time (`limits.ts`) are held to the
 * contract by a test, so they cannot drift.
 *
 * @module components/chat/types
 */

import type {
  ActionResult,
  AnswerResult,
  ChannelLine,
  ComposedReport1,
  ComposedZone,
  DataStamp,
  DirectionLine,
  FixedAnswerResult,
  FixedReason,
  LevelLine,
  NewsBlock,
  ReplyResult,
  Report1Result,
  ResolvedLine,
  ResultNote,
  StateChange,
  TradeSetupAction,
} from '@/lib/reply/contracts/result';
import type {
  ErrorEvent,
  RefusalEvent,
  ReplyErrorCode,
  ReplyStage,
  ResultEvent,
  StageEvent,
  StageStatus,
  StreamEvent,
  TerminalEvent,
} from '@/lib/reply/contracts/stage-events';
import type {
  Bias,
  BoardStatus,
  DataFlag,
  DataStatus,
  EventItem,
  EventsStatus,
  InstantIntent,
  IntakeRefusal,
  Locale,
  TraderType,
  TrendRelation,
} from '@/lib/reply/contracts/intake';

export type {
  ActionResult,
  AnswerResult,
  Bias,
  BoardStatus,
  ChannelLine,
  ComposedReport1,
  ComposedZone,
  DataFlag,
  DataStamp,
  DataStatus,
  DirectionLine,
  ErrorEvent,
  EventItem,
  EventsStatus,
  FixedAnswerResult,
  FixedReason,
  InstantIntent,
  IntakeRefusal,
  LevelLine,
  Locale,
  NewsBlock,
  RefusalEvent,
  ReplyErrorCode,
  ReplyResult,
  ReplyStage,
  Report1Result,
  ResolvedLine,
  ResultEvent,
  ResultNote,
  StageEvent,
  StageStatus,
  StateChange,
  StreamEvent,
  TerminalEvent,
  TradeSetupAction,
  TraderType,
  TrendRelation,
};

/** The balance a refused request carries (`quota` in the JSON error body of `POST /api/chat/message`). */
export interface QuotaBody {
  limit_units: number;
  available_units: number;
  needed_units: number;
}

/** One model of `GET /api/chat/state`: only models that passed their evaluation are listed. */
export interface PickerModel {
  slug: string;
  name: string;
  multiplier: number;
  vision: boolean;
  /** MEASURED units per message, or null until a measurement run has produced one */
  units_per_msg: number | null;
  default: boolean;
}

/** `quota` of `GET /api/chat/state`: units, never tokens, and never shown as a number. */
export interface QuotaState {
  /** false while `PRO_MONTHLY_UNITS` is unset: the ledger refuses everything */
  configured: boolean;
  month: string;
  limit_units: number | null;
  used_units: number | null;
  reserved_units: number | null;
  available_units: number | null;
}

/** `GET /api/chat/state`, as the panel keeps it. */
export interface ChatInfo {
  models: PickerModel[];
  quota: QuotaState;
  profile: { trader_type: TraderType } | null;
  cycle: { slot: string | null; data_status: DataStatus } | null;
}

/** What the trader sends: a typed question or the label of a Panel C button. */
export type AskInput =
  | { kind: 'TYPED'; question: string }
  | { kind: 'INSTANT'; intent: InstantIntent };

/**
 * One thread of `GET /api/chat/threads`, as Panel A keeps it (build step 7 part 9). The title is the
 * server's: deterministic from the first answer (`XAUUSD · M15 · LONG · 18 SEP 20:55`) or the trader's
 * own, and is shown as it came. The bias is the thread's last one, null until an answer had one.
 */
export interface ThreadSummary {
  id: string;
  title: string;
  titleSource: 'AUTO' | 'USER';
  lastBias: Bias | null;
  /** one line of the last exchange; may be empty */
  lastPreview: string;
  messageCount: number;
  /** ISO time of the last message */
  lastMessageAt: string;
  /** the cycle slot of the last answer that had one, such as `2026-09-18T20:55Z` */
  lastCycleSlot: string | null;
}

/** A recorded conversation for the Free tier (ADR-072): the turns of one golden scenario. */
export interface DemoTurn {
  /** what the trader asked; an instant prompt has a label instead */
  question: string | null;
  instant: InstantIntent | null;
  result: ReplyResult;
}

export interface DemoRecording {
  /** the cycle the recording was made on (a slot), shown as "data as of" */
  as_of: string;
  locale: Locale;
  turns: DemoTurn[];
}
