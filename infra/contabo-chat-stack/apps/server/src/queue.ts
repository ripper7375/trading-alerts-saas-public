import { Queue, QueueEvents } from 'bullmq';
import { createRedisConnection } from './redisClient';

export const CHAT_QUEUE_NAME = 'chat-jobs';

export const chatQueue = new Queue(CHAT_QUEUE_NAME, {
  connection: createRedisConnection(),
});

export const chatQueueEvents = new QueueEvents(CHAT_QUEUE_NAME, {
  connection: createRedisConnection(),
});
