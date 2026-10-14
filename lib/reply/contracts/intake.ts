/**
 * The one place the reply contracts read the intake path.
 *
 * The reply path sits on top of the intake path (architecture 5.1: it "receives the intake
 * packet"). `lib/intake` keeps its validation toolkit (`check.ts`) out of its barrel on
 * purpose, and its boundaries guard lists every file outside the folder that imports it.
 * So that list stays at ONE name for the whole reply path, every other file of `lib/reply`
 * and `lib/platform` takes what it needs of the intake path from here, and the names below
 * are the whole of what it needs: the toolkit the hand-written validators are built on, the
 * words of a packet (biases, statuses, intents, locales), canonical JSON, the slot
 * arithmetic and the refusal contract.
 *
 * Pure: nothing here does I/O (the intake modules named are pure too).
 *
 * @module lib/reply/contracts/intake
 */

export {
  MAX_DEPTH,
  Issues,
  at,
  bool,
  exactObject,
  hasOwn,
  isRecord,
  join,
  keysMatching,
  list,
  num,
  oneOf,
  sameList,
  text,
} from '@/lib/intake/check';
export type { Issue, IssueCode, StringRule } from '@/lib/intake/check';

export {
  BIASES,
  BOARD_STATUSES,
  DATA_FLAGS,
  DATA_STATUSES,
  EVENTS_MAX_ITEMS,
  EVENTS_STATUSES,
  FORBIDDEN_PACKET_KEY,
  INSTANT_INTENTS,
  INTAKE_REFUSAL_SCHEMA,
  KNOWLEDGE_STATUSES,
  PACKET_INTENTS,
  PACKET_SYMBOL,
  REFUSAL_CODES,
  SENSOR_STATUSES,
  THREAD_ID,
  TIMEFRAMES,
  TRADER_TYPES,
  TREND_RELATIONS,
  canonicalJson,
  forbiddenKeyPaths,
  instantTimeframe,
  isInstantIntent,
  isLocale,
  sha256Hex,
  validateRefusal,
} from '@/lib/intake';
export type {
  Bias,
  BoardStatus,
  DataFlag,
  DataStatus,
  EventItem,
  EventsStatus,
  IntakePacket,
  InstantIntent,
  IntakeRefusal,
  KnowledgeStatus,
  Locale,
  PacketIntent,
  Timeframe,
  TraderType,
  TrendRelation,
} from '@/lib/intake';

export {
  boardStamp,
  isSlotSeconds,
  secondsOfSlot,
  slotIso,
} from '@/lib/intake/slots';
