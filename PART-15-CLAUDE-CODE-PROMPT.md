# Part 15: Notifications & Real-time - Claude Code Build Prompt

**Project:** Trading Alerts SaaS V7
**Task:** Build Part 15 (Notifications & Real-time) autonomously
**Files to Build:** 9 files
**Estimated Time:** 3 hours
**Current Status:** Parts 6-14 complete and merged to main

---

## YOUR MISSION

You are Claude Code, tasked with building **Part 15: Notifications & Real-time** for the Trading Alerts SaaS V7 project. You will build 9 files autonomously following all project policies, architecture rules, and quality standards.

**Your approach:**
1. Read ALL essential files listed below (policies, architecture, requirements)
2. Build files one-by-one in the specified order
3. Follow coding patterns from policy files
4. Reference seed code for notification bell component
5. Validate each file after creation (TypeScript, ESLint, Prettier)
6. Commit each file individually with descriptive commit messages
7. Test the notification system after all files are built

---

## ESSENTIAL FILES TO READ FIRST

**CRITICAL:** Read these files in order before writing any code. These files contain the "AI constitution" that guides all development.

### 1. **Project Overview & Current State**
```
PROGRESS-part-2.md                   # Current project status (Parts 6-14 complete)
README.md                            # Project overview
ARCHITECTURE-compress.md             # System architecture and design patterns (compressed)
IMPLEMENTATION-GUIDE.md              # Implementation best practices
```

### 2. **Policy Files (MUST READ - These are your rules)**
```
docs/policies/00-tier-specifications.md              # FREE vs PRO tier rules (CRITICAL)
docs/policies/01-approval-policies.md                # When to approve/fix/escalate
docs/policies/02-quality-standards.md                # TypeScript, error handling standards
docs/policies/03-architecture-rules.md               # File structure, architecture patterns
docs/policies/04-escalation-triggers.md              # When to ask for human help
docs/policies/05-coding-patterns-part-1.md           # Copy-paste ready code patterns (Part 1)
docs/policies/05-coding-patterns-part-2.md           # Copy-paste ready code patterns (Part 2)
docs/policies/06-aider-instructions.md               # Build workflow instructions
```

### 3. **Part 15 Requirements & Build Order**
```
docs/build-orders/part-15-notifications.md           # Build order for all 9 files
docs/implementation-guides/v5_part_o.md              # Notifications & real-time business logic
```

### 4. **Seed Code (MUST REFERENCE)**
```
seed-code/v0-components/notification-component-v3/app/page.tsx           # Demo page layout
seed-code/v0-components/notification-component-v3/components/notification-bell.tsx  # MAIN REFERENCE
```

### 5. **OpenAPI Specifications**
```
docs/trading_alerts_openapi.yaml                     # Next.js API contracts
```

### 6. **Validation & Testing**
```
VALIDATION-SETUP-GUIDE.md                            # Validation tools and process
CLAUDE.md                                            # Automated validation guide
```

### 7. **Previous Work (for context and dependencies)**
```
docs/build-orders/part-05-authentication.md          # Authentication (DEPENDENCY)
```

---

## PART 15 - FILES TO BUILD (In Order)

Build these 9 files in sequence:

### **API Routes (3 routes)**

### **File 1/9:** `app/api/notifications/route.ts`
- **GET:** List user notifications with pagination and status filter
- **POST:** Mark all notifications as read
- Query params: status (all/unread/read), page
- Return paginated notification list
- **Commit:** `feat(api): add notifications endpoints`

### **File 2/9:** `app/api/notifications/[id]/route.ts`
- **GET:** Get single notification details
- **DELETE:** Delete notification (soft delete)
- Ownership check (user can only access their own notifications)
- **Commit:** `feat(api): add notification detail endpoints`

### **File 3/9:** `app/api/notifications/[id]/read/route.ts`
- **POST:** Mark notification as read
- Update readAt timestamp
- Return updated notification
- **Commit:** `feat(api): add mark as read endpoint`

### **Components (2 components)**

### **File 4/9:** `components/notifications/notification-bell.tsx`
- Notification bell icon with unread count badge
- Dropdown with recent notifications
- Mark as read on click
- Mark all as read button
- "View All" link to notifications page
- **CRITICAL:** Reference seed code at `seed-code/v0-components/notification-component-v3/components/notification-bell.tsx`
- **Commit:** `feat(notifications): add notification bell component`

### **File 5/9:** `components/notifications/notification-list.tsx`
- Full notification list with all notifications
- Tabs: All / Unread / Read
- Filter by type (Alert / Subscription / Payment / System)
- Pagination (20 per page)
- Delete button for each notification
- **Commit:** `feat(notifications): add notification list component`

### **WebSocket & Monitoring (2 files)**

### **File 6/9:** `lib/websocket/server.ts`
- WebSocket server setup
- Authentication using session token
- Events: authenticate, ping/pong, notification, notification_read
- User-specific rooms for sending notifications
- Connection management
- **Commit:** `feat(websocket): add WebSocket server`

### **File 7/9:** `lib/monitoring/system-monitor.ts`
- System health monitoring
- Track database, Redis, MT5, WebSocket status
- Tier-specific metrics (per FREE/PRO)
- Alert if error rate > 5% or response time > 2s
- **Commit:** `feat(monitoring): add system monitor with tier metrics`

### **React Hooks (2 hooks)**

### **File 8/9:** `hooks/use-websocket.ts`
- React hook for WebSocket connection
- Auto-reconnect on disconnect
- Handle notification events
- Ping/pong for keep-alive
- **Commit:** `feat(websocket): add WebSocket hook`

### **File 9/9:** `hooks/use-toast.ts`
- React hook for toast notifications
- Types: success, error, warning, info
- Auto-dismiss after 5 seconds
- Manual dismiss
- Stack multiple toasts
- **Commit:** `feat(notifications): add toast hook`

---

## GIT WORKFLOW

### **Branch Strategy**
```bash
# Create new branch (MUST start with 'claude/' and end with session ID)
git checkout -b claude/notifications-realtime-{SESSION_ID}

# Build files one by one, commit each file individually
# After all 9 files complete:
git push -u origin claude/notifications-realtime-{SESSION_ID}
```

### **Commit Message Format**
Use conventional commits:
```
feat(api): add notifications endpoints
feat(notifications): add notification bell component
feat(websocket): add WebSocket server
fix(notifications): correct TypeScript type error in bell component
```

### **Push Requirements**
- Branch MUST start with `claude/`
- Branch MUST end with session ID
- Push ONLY after all validations pass
- Create PR after push (do NOT merge to main directly)

---

## VALIDATION REQUIREMENTS

After building each file, run validation:

```bash
# Validate TypeScript types
npm run validate:types

# Validate code quality
npm run validate:lint

# Validate formatting
npm run validate:format

# Run all validations together
npm run validate
```

### **Auto-Fix Minor Issues**
```bash
# Auto-fix ESLint and Prettier issues
npm run fix
```

### **Validation Must Pass Before Committing**
- 0 TypeScript errors
- 0 ESLint errors (warnings OK if < 3)
- All files properly formatted
- No unused imports
- All functions have return types

---

## KEY REQUIREMENTS FOR PART 15

### **1. Notification Types**

```typescript
type NotificationType = 'alert' | 'subscription' | 'payment' | 'system';
type NotificationPriority = 'low' | 'medium' | 'high';

interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  priority: NotificationPriority;
  read: boolean;
  link?: string;
  createdAt: Date;
  readAt?: Date;
}
```

### **2. Notification Title/Body Examples**

```typescript
// Alert Triggered
{
  type: 'alert',
  title: '🔔 Alert Triggered: XAUUSD',
  body: 'XAUUSD above 2450.00 (Current: 2451.25)',
  priority: 'high',
  link: '/alerts',
}

// Subscription Changed
{
  type: 'subscription',
  title: '✅ Subscription Updated',
  body: 'You are now on the PRO tier',
  priority: 'medium',
}

// Payment Received
{
  type: 'payment',
  title: '💳 Payment Received',
  body: 'Thank you for your payment of $29.00',
  priority: 'low',
}

// Payment Failed
{
  type: 'payment',
  title: '⚠️ Payment Failed',
  body: 'Please update your payment method',
  priority: 'high',
  link: '/settings/billing',
}

// System Maintenance
{
  type: 'system',
  title: '🔧 Scheduled Maintenance',
  body: 'System will be down from 2AM to 4AM UTC',
  priority: 'medium',
}
```

### **3. WebSocket Message Format**

```typescript
interface WebSocketMessage {
  type: 'notification' | 'notification_read' | 'pong';
  data: Record<string, unknown>;
}

// Example: notification message
{
  type: 'notification',
  data: {
    id: 'notif-123',
    title: '🔔 Alert Triggered: XAUUSD',
    body: 'XAUUSD above 2450.00 (Current: 2451.25)',
    priority: 'high',
    link: '/alerts',
    createdAt: '2025-11-21T10:30:00Z',
  }
}
```

### **4. Notification Bell Behavior**

From seed code reference:
- Bell icon with red badge showing unread count
- Badge shows 9+ if more than 9 unread
- Click opens dropdown (width: 360px, max-height: 400px)
- Dropdown has tabs: All, Alerts, System, Billing, Unread
- Each notification shows icon, title, timestamp, read indicator
- Click notification marks as read and navigates to link
- "Mark all read" button in header
- "View All" link in footer

### **5. Toast Notification Types**

```typescript
interface ToastOptions {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
  duration?: number; // Default 5000ms
  dismissible?: boolean;
}

// Visual styles
const toastStyles = {
  success: 'bg-green-500', // Green background, checkmark icon
  error: 'bg-red-500',     // Red background, X icon
  warning: 'bg-yellow-500', // Yellow background, exclamation icon
  info: 'bg-blue-500',     // Blue background, info icon
};
```

### **6. System Monitor Health Checks**

```typescript
interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  checks: {
    database: HealthCheck;
    redis: HealthCheck;
    mt5Service: HealthCheck;
    websocket: HealthCheck;
  };
  tierMetrics: {
    FREE: TierMetrics;
    PRO: TierMetrics;
  };
  timestamp: string;
}

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'down';
  responseTime?: number;
  lastChecked: Date;
}

interface TierMetrics {
  activeConnections: number;
  avgResponseTime: number;
  errorRate: number;
}
```

### **7. TypeScript Compliance (CRITICAL)**
- NO `any` types allowed
- All function parameters typed
- All return types specified
- Use proper React types
- Define custom interfaces for all data structures

---

## TESTING REQUIREMENTS

After building all 9 files:

### **1. Start Development Server**
```bash
npm run dev
# Should start on http://localhost:3000
```

### **2. Manual Testing Checklist**
- [ ] Notification bell appears in header
- [ ] Unread count badge displays correctly
- [ ] Click bell opens dropdown
- [ ] Notifications display with correct icons
- [ ] Click notification marks as read
- [ ] "Mark all read" works
- [ ] "View All" navigates to notifications page
- [ ] Notifications page displays all notifications
- [ ] Tab filtering works (All/Unread/Read)
- [ ] Type filtering works
- [ ] Delete notification works
- [ ] Toast notifications appear and auto-dismiss

### **3. API Testing**
```bash
# GET notifications
curl http://localhost:3000/api/notifications

# GET unread only
curl "http://localhost:3000/api/notifications?status=unread"

# GET single notification
curl http://localhost:3000/api/notifications/{id}

# POST mark as read
curl -X POST http://localhost:3000/api/notifications/{id}/read

# POST mark all as read
curl -X POST http://localhost:3000/api/notifications

# DELETE notification
curl -X DELETE http://localhost:3000/api/notifications/{id}
```

### **4. Console Checks**
- [ ] No console errors
- [ ] No React hydration warnings
- [ ] API calls return correct status codes

### **5. TypeScript Build**
```bash
npm run build
# Should complete with 0 errors
```

---

## CODING PATTERNS TO FOLLOW

### **Pattern 1: Notifications API Route**
```typescript
// app/api/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const querySchema = z.object({
  status: z.enum(['all', 'unread', 'read']).default('all'),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(10).max(50).default(20),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const validation = querySchema.safeParse(searchParams);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { status, page, pageSize } = validation.data;

    // Build where clause
    const where: Record<string, unknown> = {
      userId: session.user.id,
    };

    if (status === 'unread') {
      where.read = false;
    } else if (status === 'read') {
      where.read = true;
    }

    // Get total count
    const total = await prisma.notification.count({ where });

    // Get notifications
    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return NextResponse.json({
      notifications,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      unreadCount: await prisma.notification.count({
        where: { userId: session.user.id, read: false },
      }),
    });
  } catch (error) {
    console.error('Notifications error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

export async function POST(): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Mark all as read
    await prisma.notification.updateMany({
      where: {
        userId: session.user.id,
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark all read error:', error);
    return NextResponse.json(
      { error: 'Failed to mark all as read' },
      { status: 500 }
    );
  }
}
```

### **Pattern 2: Notification Detail Route**
```typescript
// app/api/notifications/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db/prisma';

interface RouteParams {
  params: { id: string };
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const notification = await prisma.notification.findUnique({
      where: { id: params.id },
    });

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    // Ownership check
    if (notification.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(notification);
  } catch (error) {
    console.error('Get notification error:', error);
    return NextResponse.json(
      { error: 'Failed to get notification' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const notification = await prisma.notification.findUnique({
      where: { id: params.id },
    });

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    // Ownership check
    if (notification.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.notification.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete notification error:', error);
    return NextResponse.json(
      { error: 'Failed to delete notification' },
      { status: 500 }
    );
  }
}
```

### **Pattern 3: Mark as Read Route**
```typescript
// app/api/notifications/[id]/read/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db/prisma';

interface RouteParams {
  params: { id: string };
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const notification = await prisma.notification.findUnique({
      where: { id: params.id },
    });

    if (!notification) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    // Ownership check
    if (notification.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updated = await prisma.notification.update({
      where: { id: params.id },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Mark as read error:', error);
    return NextResponse.json(
      { error: 'Failed to mark as read' },
      { status: 500 }
    );
  }
}
```

### **Pattern 4: useToast Hook**
```typescript
// hooks/use-toast.ts
'use client';

import { useState, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration: number;
}

interface ToastOptions {
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface UseToastReturn {
  toasts: Toast[];
  addToast: (options: ToastOptions) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((options: ToastOptions) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const duration = options.duration ?? 5000;

    const newToast: Toast = {
      id,
      type: options.type,
      title: options.title,
      description: options.description,
      duration,
    };

    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return {
    toasts,
    addToast,
    removeToast,
    clearToasts,
  };
}

// Convenience functions
export function toast(options: ToastOptions): void {
  // This is a placeholder - in production, use a global toast context
  console.log('Toast:', options);
}

export const toastSuccess = (title: string, description?: string): void =>
  toast({ type: 'success', title, description });

export const toastError = (title: string, description?: string): void =>
  toast({ type: 'error', title, description });

export const toastWarning = (title: string, description?: string): void =>
  toast({ type: 'warning', title, description });

export const toastInfo = (title: string, description?: string): void =>
  toast({ type: 'info', title, description });
```

### **Pattern 5: useWebSocket Hook**
```typescript
// hooks/use-websocket.ts
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface WebSocketMessage {
  type: string;
  data: Record<string, unknown>;
}

interface UseWebSocketOptions {
  onNotification?: (notification: Record<string, unknown>) => void;
  onConnectionChange?: (connected: boolean) => void;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  sendMessage: (message: WebSocketMessage) => void;
  disconnect: () => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const { data: session } = useSession();
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!session?.user) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      options.onConnectionChange?.(true);

      // Authenticate
      ws.send(JSON.stringify({
        type: 'authenticate',
        data: { token: session.user.id },
      }));

      // Start ping interval
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping', data: {} }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'notification':
            options.onNotification?.(message.data);
            break;
          case 'pong':
            // Keep-alive response
            break;
          default:
            console.log('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      options.onConnectionChange?.(false);

      // Clear ping interval
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }

      // Attempt reconnect after 5 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 5000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    wsRef.current = ws;
  }, [session, options]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    isConnected,
    sendMessage,
    disconnect,
  };
}
```

### **Pattern 6: WebSocket Server (Next.js compatible)**
```typescript
// lib/websocket/server.ts
import { Server } from 'socket.io';

interface UserSocket {
  userId: string;
  socketId: string;
}

const connectedUsers: Map<string, UserSocket[]> = new Map();

export function initWebSocketServer(httpServer: unknown): Server {
  const io = new Server(httpServer as import('http').Server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('authenticate', (data: { token: string }) => {
      const userId = data.token; // In production, verify token

      // Store connection
      const userSockets = connectedUsers.get(userId) || [];
      userSockets.push({ userId, socketId: socket.id });
      connectedUsers.set(userId, userSockets);

      // Join user-specific room
      socket.join(`user:${userId}`);

      console.log(`User ${userId} authenticated`);
    });

    socket.on('ping', () => {
      socket.emit('pong');
    });

    socket.on('disconnect', () => {
      // Remove from connected users
      connectedUsers.forEach((sockets, userId) => {
        const filtered = sockets.filter((s) => s.socketId !== socket.id);
        if (filtered.length === 0) {
          connectedUsers.delete(userId);
        } else {
          connectedUsers.set(userId, filtered);
        }
      });

      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
}

export async function sendNotificationToUser(
  io: Server,
  userId: string,
  notification: Record<string, unknown>
): Promise<void> {
  io.to(`user:${userId}`).emit('notification', notification);
}

export function getConnectedUsersCount(): number {
  let count = 0;
  connectedUsers.forEach((sockets) => {
    count += sockets.length;
  });
  return count;
}

export function isUserConnected(userId: string): boolean {
  return connectedUsers.has(userId);
}
```

### **Pattern 7: System Monitor**
```typescript
// lib/monitoring/system-monitor.ts
import { prisma } from '@/lib/db/prisma';

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'down';
  responseTime?: number;
  lastChecked: Date;
  error?: string;
}

interface TierMetrics {
  activeConnections: number;
  avgResponseTime: number;
  errorRate: number;
  requestsPerMinute: number;
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  checks: {
    database: HealthCheck;
    redis: HealthCheck;
    mt5Service: HealthCheck;
    websocket: HealthCheck;
  };
  tierMetrics: {
    FREE: TierMetrics;
    PRO: TierMetrics;
  };
  timestamp: string;
}

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'healthy',
      responseTime: Date.now() - start,
      lastChecked: new Date(),
    };
  } catch (error) {
    return {
      status: 'down',
      lastChecked: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkRedis(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // TODO: Implement Redis health check
    return {
      status: 'healthy',
      responseTime: Date.now() - start,
      lastChecked: new Date(),
    };
  } catch (error) {
    return {
      status: 'down',
      lastChecked: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkMT5Service(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // TODO: Implement MT5 service health check
    return {
      status: 'healthy',
      responseTime: Date.now() - start,
      lastChecked: new Date(),
    };
  } catch (error) {
    return {
      status: 'down',
      lastChecked: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkWebSocket(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // TODO: Implement WebSocket health check
    return {
      status: 'healthy',
      responseTime: Date.now() - start,
      lastChecked: new Date(),
    };
  } catch (error) {
    return {
      status: 'down',
      lastChecked: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function getTierMetrics(tier: 'FREE' | 'PRO'): Promise<TierMetrics> {
  // TODO: Implement actual metrics collection
  return {
    activeConnections: 0,
    avgResponseTime: 0,
    errorRate: 0,
    requestsPerMinute: 0,
  };
}

export async function getSystemHealth(): Promise<SystemHealth> {
  const [database, redis, mt5Service, websocket] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkMT5Service(),
    checkWebSocket(),
  ]);

  const [freeMetrics, proMetrics] = await Promise.all([
    getTierMetrics('FREE'),
    getTierMetrics('PRO'),
  ]);

  // Determine overall status
  const checks = { database, redis, mt5Service, websocket };
  const statuses = Object.values(checks).map((c) => c.status);

  let status: 'healthy' | 'degraded' | 'down' = 'healthy';
  if (statuses.includes('down')) {
    status = 'down';
  } else if (statuses.includes('degraded')) {
    status = 'degraded';
  }

  return {
    status,
    checks,
    tierMetrics: {
      FREE: freeMetrics,
      PRO: proMetrics,
    },
    timestamp: new Date().toISOString(),
  };
}

export async function shouldAlertAdmin(health: SystemHealth): Promise<boolean> {
  // Alert if any service is down
  if (health.status === 'down') {
    return true;
  }

  // Alert if error rate > 5% for any tier
  if (
    health.tierMetrics.FREE.errorRate > 5 ||
    health.tierMetrics.PRO.errorRate > 5
  ) {
    return true;
  }

  // Alert if response time > 2000ms
  const avgResponseTime =
    (health.tierMetrics.FREE.avgResponseTime +
      health.tierMetrics.PRO.avgResponseTime) /
    2;
  if (avgResponseTime > 2000) {
    return true;
  }

  return false;
}
```

---

## CRITICAL RULES

### **DO:**
- Read ALL policy files before writing code
- Reference seed code for notification-bell.tsx
- Use proper notification types and priorities
- Implement ownership checks on all notification endpoints
- Handle WebSocket connection lifecycle properly
- Use proper TypeScript types for all data structures
- Implement auto-reconnect for WebSocket
- Use proper toast notification styling
- Validate after each file
- Commit each file individually
- Test notification flow manually

### **DON'T:**
- Skip ownership checks on notifications
- Use `any` types
- Allow users to access other users' notifications
- Skip WebSocket authentication
- Ignore WebSocket disconnection handling
- Skip validation on API parameters
- Commit multiple files at once
- Push without validation passing
- Push to main branch directly
- Skip testing

---

## SUCCESS CRITERIA

Part 15 is complete when:

- All 9 files created and committed
- All TypeScript validations pass (0 errors)
- All ESLint checks pass
- Notification bell displays in header
- Unread count updates correctly
- Click notification marks as read
- Mark all as read works
- WebSocket connection establishes
- Toast notifications work
- System monitor returns health status
- All API endpoints work with auth
- All manual tests pass
- Code pushed to feature branch
- PR created (ready for review)

---

## PROGRESS TRACKING

Use the TodoWrite tool to track your progress:

```
1. Read all policy and architecture files
2. Read seed code for notification bell
3. Build File 1/9: app/api/notifications/route.ts
4. Build File 2/9: app/api/notifications/[id]/route.ts
5. Build File 3/9: app/api/notifications/[id]/read/route.ts
6. Build File 4/9: components/notifications/notification-bell.tsx
7. Build File 5/9: components/notifications/notification-list.tsx
8. Build File 6/9: lib/websocket/server.ts
9. Build File 7/9: lib/monitoring/system-monitor.ts
10. Build File 8/9: hooks/use-websocket.ts
11. Build File 9/9: hooks/use-toast.ts
12. Run full validation suite
13. Test notification flow manually
14. Push to feature branch
15. Create pull request
```

---

## START HERE

1. **First, read these files in order:**
   - `PROGRESS-part-2.md` - Understand current state
   - `docs/policies/00-tier-specifications.md` - Learn tier system (CRITICAL)
   - `docs/policies/05-coding-patterns-part-1.md` - Learn code patterns
   - `docs/policies/05-coding-patterns-part-2.md` - More code patterns
   - `docs/build-orders/part-15-notifications.md` - Understand Part 15
   - `docs/implementation-guides/v5_part_o.md` - Notifications business logic
   - `seed-code/v0-components/notification-component-v3/components/notification-bell.tsx` - Bell component reference

2. **Then, create your git branch:**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b claude/notifications-realtime-{SESSION_ID}
   ```

3. **Start building File 1/9:**
   - Read the build order for File 1
   - Write the file following patterns
   - Validate: `npm run validate`
   - Fix any issues: `npm run fix`
   - Commit: `git commit -m "feat(api): add notifications endpoints"`

4. **Repeat for Files 2-9**

5. **After all files complete:**
   - Run final validation
   - Test manually
   - Push to remote
   - Create PR

---

## WHEN TO ASK FOR HELP

Escalate to the user if:

- Critical security issues found
- Ambiguous requirements (can't determine correct approach)
- Missing dependencies (socket.io, etc.)
- Validation errors you can't resolve
- Database schema questions (e.g., Notification model missing)
- WebSocket server integration questions
- Real-time communication architecture questions

Otherwise, work autonomously following the policies!

---

**Good luck! Build Part 15 with quality and precision. The user trusts you to follow all policies and deliver production-ready code.**
