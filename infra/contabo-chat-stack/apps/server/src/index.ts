import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import { Job } from 'bullmq';
import { createRedisConnection } from './redisClient';
import { verifyChatToken, guestIdentity } from './auth';
import { checkGuestRateLimit } from './rateLimiter';
import { chatQueue, chatQueueEvents, CHAT_QUEUE_NAME } from './queue';
import type {
  ChatIdentity,
  ChatJobData,
  ChatJobResult,
  ClientMessagePayload,
  ClientTypingPayload,
} from './types';

const PORT = Number(process.env.PORT) || 3001;
const CORS_ORIGIN = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();
app.get('/', (_req, res) =>
  res.status(200).json({ status: 'ok', service: 'socket_chat_server' })
);

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGIN.length > 0 ? CORS_ORIGIN : false,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const rateLimitRedis = createRedisConnection();

interface SocketAuthState {
  identity: ChatIdentity;
  tokenWasInvalid: boolean;
}

function getClientIp(socket: Socket): string {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return socket.handshake.address;
}

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  let identity: ChatIdentity;
  let tokenWasInvalid = false;

  try {
    const verified = verifyChatToken(token);
    identity = verified ?? guestIdentity(socket.id);
  } catch {
    // Token was present but failed verification (expired/tampered/wrong secret).
    // Per Session 14-0 §4, degrade to guest rather than hard-reject the
    // connection — but flag it so we can tell the client once connected.
    tokenWasInvalid = true;
    identity = guestIdentity(socket.id);
  }

  (socket.data as SocketAuthState) = { identity, tokenWasInvalid };
  next();
});

io.on('connection', (socket: Socket) => {
  const { identity, tokenWasInvalid } = socket.data as SocketAuthState;

  if (tokenWasInvalid) {
    socket.emit('chat_error', {
      code: 'UNAUTHORIZED',
      message: 'Your session could not be verified; continuing as a guest.',
    });
  }

  socket.on('client_message', async (payload: ClientMessagePayload) => {
    try {
      if (identity.tier === 'GUEST') {
        const ip = getClientIp(socket);
        const { allowed } = await checkGuestRateLimit(rateLimitRedis, ip);
        if (!allowed) {
          socket.emit('chat_error', {
            code: 'RATE_LIMIT_EXCEEDED',
            message:
              'You have reached the guest message limit for this hour. Please log in or email support@davintrade.app.',
          });
          return;
        }
      }

      socket.emit('bot_typing', { isTyping: true });

      const jobData: ChatJobData = {
        socketId: socket.id,
        user: identity,
        payload,
      };
      await chatQueue.add(CHAT_QUEUE_NAME, jobData, {
        jobId: payload.id,
        removeOnComplete: true,
        removeOnFail: true,
      });
    } catch (err) {
      console.error('[client_message] failed to enqueue job:', err);
      socket.emit('chat_error', {
        code: 'SERVER_ERROR',
        message: 'Something went wrong sending your message. Please try again.',
      });
    }
  });

  // No live human-agent hand-off exists yet in v1 (bot-only) — typing signals
  // from the client have no listener to relay to. Accepted and no-op'd rather
  // than rejected, so the frozen contract's event exists end-to-end for
  // Session 14-2's client to wire up against.
  socket.on('typing_start', (_payload: ClientTypingPayload) => {});
  socket.on('typing_stop', (_payload: ClientTypingPayload) => {});
});

chatQueueEvents.on('completed', async ({ jobId, returnvalue }) => {
  const job = await Job.fromId(chatQueue, jobId);
  const socketId = job?.data?.socketId as string | undefined;
  if (!socketId) return;

  let result: ChatJobResult;
  try {
    result =
      typeof returnvalue === 'string' ? JSON.parse(returnvalue) : returnvalue;
  } catch (err) {
    console.error('[chatQueueEvents] failed to parse job result:', err);
    return;
  }

  io.to(socketId).emit('bot_typing', { isTyping: false });
  if (result.errorCode) {
    io.to(socketId).emit('chat_error', {
      code: result.errorCode,
      message: result.message.text,
    });
  }
  io.to(socketId).emit('support_message', result.message);
});

chatQueueEvents.on('failed', async ({ jobId, failedReason }) => {
  const job = await Job.fromId(chatQueue, jobId);
  const socketId = job?.data?.socketId as string | undefined;
  console.error(`[chatQueueEvents] job ${jobId} failed:`, failedReason);
  if (!socketId) return;

  io.to(socketId).emit('bot_typing', { isTyping: false });
  io.to(socketId).emit('chat_error', {
    code: 'SERVER_ERROR',
    message:
      "I'm having trouble responding right now — please try again or email support@davintrade.app.",
  });
});

httpServer.listen(PORT, () => {
  console.log(`socket_chat_server listening on :${PORT}`);
});

function shutdown() {
  console.log('Shutting down socket_chat_server...');
  io.close();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
