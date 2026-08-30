// Mirrors the subset of infra/contabo-chat-stack/apps/server/src/types.ts that
// crosses the BullMQ job boundary. Kept as a separate small copy rather than a
// shared package — this stack has no monorepo linkage of its own, and the
// frozen contract these types encode (Session 14-0 §1) changes rarely enough
// that duplication is cheaper than adding a workspace dependency for two files.

export type UserTier = 'FREE' | 'PRO' | 'GUEST';

export interface ChatIdentity {
  userId: string;
  name?: string;
  email?: string;
  tier: UserTier;
}

export interface ClientMessagePayload {
  id: string;
  text: string;
  topic?: 'Product Info' | 'Technical Support' | 'PRO Subscription' | 'Billing';
  timestamp: string;
}

export interface SupportMessagePayload {
  id: string;
  sender: 'bot' | 'agent' | 'system';
  text: string;
  topic?: string;
  timestamp: string;
  quickReplies?: string[];
}

export type ChatErrorCode =
  | 'UNAUTHORIZED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'QUOTA_EXCEEDED'
  | 'SERVER_ERROR';

export interface ChatJobData {
  socketId: string;
  user: ChatIdentity;
  payload: ClientMessagePayload;
}

export interface ChatJobResult {
  message: SupportMessagePayload;
  errorCode?: ChatErrorCode;
}
