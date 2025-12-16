# V5 Part O: Notifications & Real-time - Implementation Guide

**For:** Trading Alerts SaaS V7
**Part:** 15 - Notifications
**Total Files:** 9 files
**Complexity:** Medium
**Last Updated:** 2025-11-21

---

## Overview

Real-time notification system using WebSockets for instant updates, plus system monitoring for tier-based health metrics.

### Key Features

- Real-time notifications via WebSocket
- Notification bell with unread count
- Notification list (read/unread status)
- Mark as read functionality
- System health monitoring with tier metrics
- Toast notifications for immediate feedback

---

## Business Requirements

### 1. Notification Types

**Alert Triggered:**

- Sent when price alert condition is met
- Title: "🔔 Alert Triggered: {symbol}"
- Body: "{symbol} {condition} {targetValue} (Current: {currentPrice})"
- Priority: High

**Subscription Changed:**

- Sent when tier changes (upgrade/downgrade)
- Title: "✅ Subscription Updated"
- Body: "You are now on the {tier} tier"
- Priority: Medium

**Payment Received:**

- Sent when payment successful
- Title: "💳 Payment Received"
- Body: "Thank you for your payment of ${amount}"
- Priority: Low

**Payment Failed:**

- Sent when payment fails
- Title: "⚠️ Payment Failed"
- Body: "Please update your payment method"
- Priority: High

**System Maintenance:**

- Sent before scheduled maintenance
- Title: "🔧 Scheduled Maintenance"
- Body: "System will be down from {startTime} to {endTime}"
- Priority: Medium

### 2. Notification Data Model

```typescript
interface Notification {
  id: string;
  userId: string;
  type: 'alert' | 'subscription' | 'payment' | 'system';
  title: string;
  body: string;
  priority: 'low' | 'medium' | 'high';
  read: boolean;
  link?: string; // Optional link to related resource
  createdAt: Date;
  readAt?: Date;
}
```

### 3. WebSocket Implementation

**Connection:**

- Client connects to WebSocket server on `/api/ws`
- Authenticate using session token
- Maintain connection while user is active
- Reconnect automatically if disconnected

**Events:**

**Client → Server:**

- `authenticate`: Send session token
- `ping`: Keep-alive

**Server → Client:**

- `notification`: New notification received
- `notification_read`: Notification marked as read
- `pong`: Response to ping

**Message Format:**

```typescript
{
  type: 'notification',
  data: {
    id: 'notif-123',
    title: '🔔 Alert Triggered: XAUUSD',
    body: 'XAUUSD above 2450.00 (Current: 2451.25)',
    priority: 'high',
    link: '/alerts',
    createdAt: '2025-11-21T10:30:00Z'
  }
}
```

### 4. Notification Bell Component

**Display:**

- Bell icon in top navigation
- Badge with unread count (if > 0)
- Click to toggle dropdown

**Dropdown Content:**

- Header: "Notifications" + "Mark all as read" button
- List of last 5 notifications
- Each notification shows:
  - Icon (based on type)
  - Title
  - Timestamp (relative, e.g., "2 minutes ago")
  - Read/unread indicator (blue dot for unread)
- Footer: "View all" link → opens full notification page

**Behavior:**

- Clicking a notification:
  - Marks it as read
  - Navigates to notification link (if provided)
  - Closes dropdown

### 5. Notification List Page

**Display:**

- Full list of all notifications
- Tabs: All / Unread / Read
- Pagination: 20 per page
- Delete button for each notification

**Filters:**

- All notifications
- Unread only
- By type (Alert / Subscription / Payment / System)

### 6. System Monitoring

**Health Metrics:**

- Database connection status
- Redis connection status
- MT5 service status
- WebSocket server status

**Tier-Specific Metrics:**

- API requests per second (split by tier)
- Average response time (split by tier)
- Error rate (split by tier)
- Active connections (split by tier)

**Alerts:**

- Send notification to admin if error rate > 5%
- Send notification if any service is down
- Send notification if response time > 2 seconds

---

## UI/UX Requirements

### Notification Bell

**Icon:**

- Bell icon (from lucide-react or similar)
- Badge: Red circle with white number (unread count)
- Position: Top-right of navigation bar

**Dropdown:**

- Width: 360px
- Max height: 400px (scrollable)
- Position: Below bell icon, right-aligned
- Shadow for depth

### Toast Notifications

**Types:**

- Success: Green background, checkmark icon
- Error: Red background, X icon
- Warning: Yellow background, exclamation icon
- Info: Blue background, info icon

**Behavior:**

- Appear at top-right of screen
- Auto-dismiss after 5 seconds
- User can dismiss manually (X button)
- Stack multiple toasts vertically

**Use Cases:**

- Success: "Alert created successfully!"
- Error: "Failed to create alert. Please try again."
- Warning: "Your subscription expires in 3 days."
- Info: "New feature available: Multi-chart layout!"

---

## API Endpoints

### GET /api/notifications

- Query params: `status` (all/unread/read), `page`
- Return: Paginated notification list

### GET /api/notifications/[id]

- Return: Single notification details

### POST /api/notifications/[id]/read

- Mark notification as read
- Update readAt timestamp

### DELETE /api/notifications/[id]

- Delete notification (soft delete)

### POST /api/notifications/mark-all-read

- Mark all user's notifications as read

---

## WebSocket Server Implementation

**Server Setup (Next.js API Route):**

```typescript
// pages/api/ws.ts (for Next.js pages dir) or custom server
import { Server } from 'socket.io';

export default function handler(req, res) {
  if (!res.socket.server.io) {
    const io = new Server(res.socket.server);

    io.on('connection', (socket) => {
      // Authenticate user
      socket.on('authenticate', async (token) => {
        const session = await verifySessionToken(token);
        if (session) {
          socket.userId = session.user.id;
          socket.join(`user:${socket.userId}`);
        } else {
          socket.disconnect();
        }
      });

      // Handle ping
      socket.on('ping', () => {
        socket.emit('pong');
      });
    });

    res.socket.server.io = io;
  }
  res.end();
}
```

**Sending Notification:**

```typescript
// lib/notifications/send.ts
export async function sendNotification(
  userId: string,
  notification: Notification
) {
  // Save to database
  await prisma.notification.create({
    data: {
      userId,
      ...notification,
    },
  });

  // Send via WebSocket
  io.to(`user:${userId}`).emit('notification', notification);
}
```

---

## System Monitoring Implementation

**Health Check Endpoint:**

```typescript
// app/api/health/route.ts
export async function GET() {
  const checks = {
    database: await checkDatabaseConnection(),
    redis: await checkRedisConnection(),
    mt5Service: await checkMT5ServiceConnection(),
    websocket: await checkWebSocketServer(),
    tierMetrics: await getTierMetrics(),
  };

  const allHealthy = Object.values(checks).every(
    (check) => check.status === 'healthy'
  );

  return Response.json(
    {
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    },
    {
      status: allHealthy ? 200 : 503,
    }
  );
}
```

**Tier Metrics:**

```typescript
async function getTierMetrics() {
  const freeUsers = await getActiveConnections('FREE');
  const proUsers = await getActiveConnections('PRO');

  return {
    status: 'healthy',
    metrics: {
      FREE: {
        activeConnections: freeUsers,
        avgResponseTime: await getAvgResponseTime('FREE'),
        errorRate: await getErrorRate('FREE'),
      },
      PRO: {
        activeConnections: proUsers,
        avgResponseTime: await getAvgResponseTime('PRO'),
        errorRate: await getErrorRate('PRO'),
      },
    },
  };
}
```

---

## Testing Requirements

**Manual Tests:**

- [ ] WebSocket connection establishes successfully
- [ ] Notifications appear in bell dropdown
- [ ] Unread count updates correctly
- [ ] Mark as read works
- [ ] Mark all as read works
- [ ] Toast notifications display and auto-dismiss
- [ ] Notification page displays all notifications
- [ ] System health endpoint returns correct status

**WebSocket Testing:**

- Use browser console to test connection
- Send test notifications
- Verify reconnection after disconnect

---

## Performance Considerations

**WebSocket Connections:**

- Limit concurrent connections per user to 3 (multiple tabs)
- Close idle connections after 5 minutes
- Use Redis pub/sub for multi-server deployments

**Notification Storage:**

- Auto-delete read notifications after 30 days
- Keep unread notifications indefinitely
- Archive old notifications to separate table

---

## Summary

Notifications system provides real-time user communication:

1. ✅ **WebSocket** - Real-time updates
2. ✅ **Notification Bell** - Unread count and dropdown
3. ✅ **Toast Messages** - Immediate feedback
4. ✅ **System Monitoring** - Health and tier metrics
5. ✅ **Push Delivery** - Instant notification delivery

**Priority:** Medium - Important for user engagement.

---

**Reference:** This guide works with `docs/build-orders/part-15-notifications.md` for file-by-file build instructions.
