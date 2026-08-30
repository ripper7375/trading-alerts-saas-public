import 'dotenv/config';
import Redis from 'ioredis';
import { Worker, Job } from 'bullmq';
import { getLlmReply } from './llmClient';
import { checkAndIncrementAuthQuota } from './quota';
import {
  QUICK_REPLY_CHIPS,
  AUTH_QUOTA_EXCEEDED_MESSAGE,
  SERVER_ERROR_MESSAGE,
} from './systemPrompt';
import type {
  ChatJobData,
  ChatJobResult,
  SupportMessagePayload,
} from './types';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis_broker:6379';
const CHAT_QUEUE_NAME = 'chat-jobs';

const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
const quotaRedis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

function botMessage(
  text: string,
  replyToId: string,
  quickReplies = QUICK_REPLY_CHIPS
): SupportMessagePayload {
  return {
    id: `bot-${Date.now()}`,
    sender: 'bot',
    text,
    timestamp: new Date().toISOString(),
    quickReplies,
    topic: undefined,
  };
}

const worker = new Worker<ChatJobData, ChatJobResult>(
  CHAT_QUEUE_NAME,
  async (job: Job<ChatJobData>) => {
    const { socketId, user, payload } = job.data;

    const { exceeded } = await checkAndIncrementAuthQuota(quotaRedis, user);
    if (exceeded) {
      return {
        socketId,
        message: botMessage(AUTH_QUOTA_EXCEEDED_MESSAGE, payload.id),
        errorCode: 'QUOTA_EXCEEDED',
      };
    }

    try {
      const replyText = await getLlmReply(payload.text);
      return { socketId, message: botMessage(replyText, payload.id) };
    } catch (err) {
      console.error(`[chat-jobs] LLM call failed for job ${job.id}:`, err);
      return {
        socketId,
        message: botMessage(SERVER_ERROR_MESSAGE, payload.id),
        errorCode: 'SERVER_ERROR',
      };
    }
  },
  { connection, concurrency: 5 }
);

worker.on('ready', () =>
  console.log('ai_bot_worker ready, listening on chat-jobs queue')
);
worker.on('error', (err) =>
  console.error('[ai_bot_worker] worker error:', err)
);

function shutdown() {
  console.log('Shutting down ai_bot_worker...');
  worker
    .close()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
