// Socket.IO event & data contract — frozen verbatim at Session 14-0
// (14-0-web-chat-decisions-and-contract.migration-order.md §"Technical
// Specifications & Frozen Contracts" §1). Do not change field names/shapes here
// without re-opening that contract — Session 14-2's frontend client is written
// against this exact shape.
//
// AMENDMENT (security hardening, 2026-11-01): no field name or shape changes.
// The server now also enforces these limits on `client_message`
// (apps/server/src/security.ts), which the 14-0 contract left open:
//   - `id` matches /^[A-Za-z0-9_-]{1,64}$/;
//   - `text` is not blank and at most MAX_CLIENT_MESSAGE_LENGTH characters;
//   - `timestamp` is an ISO-8601 string of at most 64 characters;
//   - `topic`, when present, is one of CLIENT_MESSAGE_TOPICS (the four chips).
// The chat widget caps its input at the same length (maxLength) and the bot
// worker repeats the length check (apps/bot-worker/src/limits.ts).

export const MAX_CLIENT_MESSAGE_LENGTH = 1_000;

export const CLIENT_MESSAGE_TOPICS = [
  'Product Info',
  'Technical Support',
  'PRO Subscription',
  'Billing',
] as const;

export type ClientMessageTopic = (typeof CLIENT_MESSAGE_TOPICS)[number];

// ---- Client emitted events ----

export interface ClientMessagePayload {
  id: string; // Client-generated idempotency key (e.g. "usr-174123456789-a1b2")
  text: string;
  topic?: ClientMessageTopic;
  timestamp: string; // ISO-8601
}

export interface ClientTypingPayload {
  topic?: string;
}

// ---- Server emitted events ----

export interface SupportMessagePayload {
  id: string;
  sender: 'bot' | 'agent' | 'system';
  text: string;
  topic?: string;
  timestamp: string;
  quickReplies?: string[];
}

export interface BotTypingPayload {
  isTyping: boolean;
}

export type ChatErrorCode =
  | 'UNAUTHORIZED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'QUOTA_EXCEEDED'
  | 'SERVER_ERROR';

export interface ChatErrorPayload {
  code: ChatErrorCode;
  message: string;
}

// ---- Auth / identity (server-stamped, never trusted from the client) ----

export type UserTier = 'FREE' | 'PRO' | 'GUEST';

export interface ChatIdentity {
  userId: string;
  name?: string;
  email?: string;
  tier: UserTier;
}

// ---- Internal: server <-> bot-worker job contract (not part of the frozen
// client-facing socket contract; this repo's own choice, documented in the
// order's Deviations) ----

export interface ChatJobData {
  socketId: string;
  user: ChatIdentity;
  payload: ClientMessagePayload;
}

export interface ChatJobResult {
  socketId: string; // carried in the result itself, not re-fetched from job.data —
  // removeOnComplete can purge the job's stored data before the QueueEvents
  // 'completed' listener runs (see order Deviations)
  message: SupportMessagePayload;
  errorCode?: ChatErrorCode; // set alongside a fallback message, e.g. QUOTA_EXCEEDED
}
