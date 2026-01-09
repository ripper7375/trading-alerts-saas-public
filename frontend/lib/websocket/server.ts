import type { Server as HTTPServer } from 'http';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface UserSocket {
  userId: string;
  socketId: string;
}

interface WebSocketMessage {
  type: 'notification' | 'notification_read' | 'pong' | 'authenticated';
  data: NotificationPayload | Record<string, unknown>;
}

interface NotificationPayload {
  id: string;
  type: 'ALERT' | 'SUBSCRIPTION' | 'PAYMENT' | 'SYSTEM';
  title: string;
  body: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  link?: string;
  createdAt: string;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONNECTED USERS STORE
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Map of userId to array of their connected sockets */
const connectedUsers: Map<string, UserSocket[]> = new Map();

/** Reference to the Socket.IO server instance */
let ioInstance: SocketIOServer | null = null;

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SOCKET.IO SERVER TYPE (lazy import)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface SocketIOServer {
  on: (event: string, callback: (socket: SocketIOSocket) => void) => void;
  to: (room: string) => { emit: (event: string, data: unknown) => void };
}

interface SocketIOSocket {
  id: string;
  userId?: string;
  on: (event: string, callback: (data: unknown) => void) => void;
  emit: (event: string, data: unknown) => void;
  join: (room: string) => void;
  disconnect: () => void;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WEBSOCKET SERVER INITIALIZATION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Initialize WebSocket server with Socket.IO
 *
 * This function sets up the WebSocket server for real-time notifications.
 * It handles:
 * - Client authentication using session tokens
 * - User-specific rooms for targeted notifications
 * - Connection lifecycle management
 * - Ping/pong for keep-alive
 *
 * @param httpServer - The HTTP server instance to attach Socket.IO to
 * @returns The Socket.IO server instance
 */
export async function initWebSocketServer(
  httpServer: HTTPServer
): Promise<SocketIOServer> {
  // Dynamically import socket.io to avoid build-time issues
  const { Server } = await import('socket.io');

  const io = new Server(httpServer, {
    cors: {
      origin: process.env['NEXT_PUBLIC_APP_URL'] || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on('connection', (socket: SocketIOSocket) => {
    console.info(`WebSocket client connected: ${socket.id}`);

    // Handle authentication
    socket.on('authenticate', (data: unknown) => {
      const authData = data as { token: string };

      if (!authData?.token) {
        socket.emit('error', { message: 'Authentication token required' });
        socket.disconnect();
        return;
      }

      // In production, verify the token against NextAuth session
      // For now, we use the token as the userId
      const userId = authData.token;
      socket.userId = userId;

      // Store connection
      const userSockets = connectedUsers.get(userId) || [];
      userSockets.push({ userId, socketId: socket.id });
      connectedUsers.set(userId, userSockets);

      // Join user-specific room for targeted notifications
      socket.join(`user:${userId}`);

      console.info(`User ${userId} authenticated on socket ${socket.id}`);

      socket.emit('authenticated', { success: true, userId });
    });

    // Handle ping for keep-alive
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Handle notification read acknowledgment
    socket.on('notification_read', (data: unknown) => {
      const readData = data as { notificationId: string };
      if (socket.userId && readData?.notificationId) {
        // Broadcast to other tabs/devices of the same user
        io.to(`user:${socket.userId}`).emit('notification_read', {
          notificationId: readData.notificationId,
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      if (socket.userId) {
        // Remove from connected users
        const userSockets = connectedUsers.get(socket.userId) || [];
        const filtered = userSockets.filter((s) => s.socketId !== socket.id);

        if (filtered.length === 0) {
          connectedUsers.delete(socket.userId);
        } else {
          connectedUsers.set(socket.userId, filtered);
        }

        console.info(
          `User ${socket.userId} disconnected from socket ${socket.id}`
        );
      } else {
        console.info(`Unauthenticated client disconnected: ${socket.id}`);
      }
    });
  });

  ioInstance = io;
  return io;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SEND NOTIFICATION TO USER
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Send a notification to a specific user via WebSocket
 *
 * @param userId - The user's ID to send the notification to
 * @param notification - The notification payload
 */
export function sendNotificationToUser(
  userId: string,
  notification: NotificationPayload
): void {
  if (!ioInstance) {
    console.warn('WebSocket server not initialized');
    return;
  }

  const message: WebSocketMessage = {
    type: 'notification',
    data: notification,
  };

  ioInstance.to(`user:${userId}`).emit('notification', message);
  console.info(`Notification sent to user ${userId}: ${notification.title}`);
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BROADCAST TO ALL USERS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Broadcast a notification to all connected users
 *
 * @param notification - The notification payload
 */
export function broadcastNotification(notification: NotificationPayload): void {
  if (!ioInstance) {
    console.warn('WebSocket server not initialized');
    return;
  }

  const message: WebSocketMessage = {
    type: 'notification',
    data: notification,
  };

  // Send to all connected users
  connectedUsers.forEach((_sockets, userId) => {
    ioInstance!.to(`user:${userId}`).emit('notification', message);
  });

  console.info(
    `Broadcast notification sent to ${connectedUsers.size} users: ${notification.title}`
  );
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONNECTION STATUS HELPERS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get the total number of connected WebSocket clients
 */
export function getConnectedUsersCount(): number {
  let count = 0;
  connectedUsers.forEach((sockets) => {
    count += sockets.length;
  });
  return count;
}

/**
 * Get the number of unique connected users
 */
export function getUniqueUsersCount(): number {
  return connectedUsers.size;
}

/**
 * Check if a specific user is currently connected
 *
 * @param userId - The user's ID to check
 */
export function isUserConnected(userId: string): boolean {
  return connectedUsers.has(userId);
}

/**
 * Get all connected user IDs
 */
export function getConnectedUserIds(): string[] {
  return Array.from(connectedUsers.keys());
}

/**
 * Get the WebSocket server instance
 */
export function getWebSocketServer(): SocketIOServer | null {
  return ioInstance;
}
