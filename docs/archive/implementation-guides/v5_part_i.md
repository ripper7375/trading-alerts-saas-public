### 9.6 SERVICE 6: System Notifications

#### 9.6.1 Notifications API

Create `app/api/notifications/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const unreadOnly = searchParams.get('unread') === 'true';

    const notifications = await prisma.notification.findMany({
      where: {
        userId: session.user.id,
        ...(unreadOnly && { isRead: false }),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('Get notifications error:', error);
    return NextResponse.json(
      { error: 'Failed to get notifications' },
      { status: 500 }
    );
  }
}
```

Create `app/api/notifications/[id]/read/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.notification.update({
      where: {
        id: params.id,
        userId: session.user.id,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark notification read error:', error);
    return NextResponse.json(
      { error: 'Failed to mark notification as read' },
      { status: 500 }
    );
  }
}
```

#### 9.6.2 System Monitoring Service

Create `lib/monitoring/system-monitor.ts`:

```typescript
import { prisma } from '@/lib/db/prisma';
import { sendSystemAlert } from '@/lib/email';

export class SystemMonitor {
  private thresholds = {
    apiErrorRate: 0.05, // 5%
    responseTime: 1000, // 1 second
    diskUsage: 0.85, // 85%
    memoryUsage: 0.9, // 90%
  };

  async checkSystemHealth() {
    const checks = await Promise.all([
      this.checkApiHealth(),
      this.checkDatabaseHealth(),
      this.checkMT5ServiceHealth(),
      this.checkResourceUsage(),
      this.checkTierDistribution(),
    ]);

    const issues = checks.filter((check) => !check.healthy);

    if (issues.length > 0) {
      await this.createSystemNotification(issues);
    }

    return {
      healthy: issues.length === 0,
      checks,
    };
  }

  private async checkApiHealth() {
    const recentErrors = await prisma.apiUsage.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        },
        status: {
          gte: 500,
        },
      },
    });

    const totalRequests = await prisma.apiUsage.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000),
        },
      },
    });

    const errorRate = totalRequests > 0 ? recentErrors / totalRequests : 0;

    return {
      name: 'API Health',
      healthy: errorRate < this.thresholds.apiErrorRate,
      details: {
        errorRate: `${(errorRate * 100).toFixed(2)}%`,
        recentErrors,
        totalRequests,
      },
    };
  }

  private async checkDatabaseHealth() {
    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - start;

      return {
        name: 'Database Health',
        healthy: responseTime < this.thresholds.responseTime,
        details: {
          responseTime: `${responseTime}ms`,
        },
      };
    } catch (error) {
      return {
        name: 'Database Health',
        healthy: false,
        details: {
          error: 'Database connection failed',
        },
      };
    }
  }

  private async checkMT5ServiceHealth() {
    try {
      const response = await fetch(`${process.env.MT5_API_URL}/api/health`, {
        headers: { 'X-API-Key': process.env.MT5_API_KEY! },
      });

      return {
        name: 'MT5 Service Health',
        healthy: response.ok,
        details: await response.json(),
      };
    } catch (error) {
      return {
        name: 'MT5 Service Health',
        healthy: false,
        details: {
          error: 'MT5 service unreachable',
        },
      };
    }
  }

  private async checkResourceUsage() {
    // This would integrate with your hosting platform's API
    // For example: Vercel, Railway, AWS CloudWatch
    return {
      name: 'Resource Usage',
      healthy: true,
      details: {
        message: 'Within normal parameters',
      },
    };
  }

  private async checkTierDistribution() {
    // Monitor tier distribution and usage patterns
    const tierStats = await prisma.user.groupBy({
      by: ['tier'],
      _count: true,
    });

    const freeUsers = tierStats.find((s) => s.tier === 'FREE')?._count || 0;
    const proUsers = tierStats.find((s) => s.tier === 'PRO')?._count || 0;
    const totalUsers = freeUsers + proUsers;

    const proPercentage = totalUsers > 0 ? (proUsers / totalUsers) * 100 : 0;

    return {
      name: 'Tier Distribution',
      healthy: true,
      details: {
        freeUsers,
        proUsers,
        totalUsers,
        proPercentage: `${proPercentage.toFixed(1)}%`,
        message: `${proUsers} PRO users (${proPercentage.toFixed(1)}% conversion)`,
      },
    };
  }

  private async createSystemNotification(issues: any[]) {
    // Get all admin users (PRO tier users with admin flag)
    const admins = await prisma.user.findMany({
      where: {
        tier: 'PRO',
        // Add admin flag check if you have one
      },
    });

    const message = issues
      .map((issue) => `${issue.name}: ${JSON.stringify(issue.details)}`)
      .join('\n');

    // Create notifications for all admins
    await prisma.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        type: 'SYSTEM',
        title: 'System Health Alert',
        message,
        data: { issues },
      })),
    });

    // Send email alerts
    for (const admin of admins) {
      await sendSystemAlert(admin.email, 'System Health Alert', message);
    }

    // Log to system logs
    await prisma.systemLog.create({
      data: {
        level: 'ERROR',
        source: 'system-monitor',
        message: 'System health check failed',
        metadata: { issues },
      },
    });
  }
}
```

#### 9.6.3 Notification Component

Create `components/notifications/notification-bell.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: async () => {
      const res = await fetch('/api/notifications?unread=true');
      return res.json();
    },
    refetchInterval: 30000 // Refetch every 30 seconds
  });

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const unreadCount = data?.notifications?.length || 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-2">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount === 0 ? (
            <p className="text-sm text-gray-500">No new notifications</p>
          ) : (
            data.notifications.map((notification: any) => (
              <div
                key={notification.id}
                className="p-3 hover:bg-gray-50 rounded-lg cursor-pointer"
                onClick={() => markAsRead.mutate(notification.id)}
              >
                <p className="font-medium text-sm">{notification.title}</p>
                <p className="text-xs text-gray-600 mt-1">
                  {notification.message}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(notification.createdAt).toLocaleTimeString()}
                </p>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

---

## 10. Code Examples

### 10.1 Next.js API Route for Indicators

Create `app/api/indicators/[symbol]/[timeframe]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { z } from 'zod';
import { redis } from '@/lib/redis';
import { prisma } from '@/lib/db/prisma';

// V5: Updated timeframes
const VALID_TIMEFRAMES = ['M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'D1'] as const;

// V5: Tier-based symbol access
const TIER_SYMBOLS = {
  FREE: ['XAUUSD'],
  PRO: [
    'AUDUSD',
    'BTCUSD',
    'ETHUSD',
    'EURUSD',
    'GBPUSD',
    'NDX100',
    'US30',
    'USDJPY',
    'XAGUSD',
    'XAUUSD',
  ],
} as const;

const querySchema = z.object({
  bars: z.coerce.number().min(100).max(5000).default(1000),
});

// V5: Helper to check tier access
function canAccessSymbol(tier: 'FREE' | 'PRO', symbol: string): boolean {
  return TIER_SYMBOLS[tier].includes(symbol as any);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string; timeframe: string } }
) {
  try {
    // 1. Authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // V5: Get user tier (only FREE or PRO)
    const tier = session.user.tier as 'FREE' | 'PRO';

    // 2. Validate params
    const { symbol, timeframe } = params;

    // V5: Validate timeframe
    if (!VALID_TIMEFRAMES.includes(timeframe as any)) {
      return NextResponse.json({ error: 'Invalid timeframe' }, { status: 400 });
    }

    // V5: Validate tier-based symbol access
    if (!canAccessSymbol(tier, symbol)) {
      return NextResponse.json(
        {
          error: 'Symbol not available in your tier',
          message:
            tier === 'FREE'
              ? 'Upgrade to PRO to access more symbols'
              : 'Invalid symbol',
        },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const validation = querySchema.safeParse({
      bars: searchParams.get('bars'),
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid parameters' },
        { status: 400 }
      );
    }

    const { bars } = validation.data;

    // 3. Rate limiting
    const identifier = `indicators:${session.user.id}`;
    const { success } = await rateLimit(identifier, tier);

    if (!success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // 4. Check cache
    const cacheKey = `indicators:${symbol}:${timeframe}:${bars}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      // Log cache hit
      await logApiUsage(
        session.user.id,
        'indicators',
        symbol,
        timeframe,
        tier,
        200,
        0
      );

      return NextResponse.json({
        success: true,
        data: JSON.parse(cached),
        cached: true,
      });
    }

    // 5. Fetch from Flask MT5 service
    const startTime = Date.now();
    const response = await fetch(
      `${process.env.MT5_API_URL}/api/indicators/${symbol}/${timeframe}?bars=${bars}`,
      {
        headers: {
          'X-API-Key': process.env.MT5_API_KEY!,
          'X-User-Tier': tier, // V5: Pass tier to Flask service
        },
      }
    );

    const duration = Date.now() - startTime;

    if (!response.ok) {
      await logApiUsage(
        session.user.id,
        'indicators',
        symbol,
        timeframe,
        tier,
        response.status,
        duration
      );
      throw new Error('MT5 service unavailable');
    }

    const result = await response.json();

    // 6. Cache result (5 minutes)
    await redis.setex(cacheKey, 300, JSON.stringify(result.data));

    // 7. Log usage with tier
    await logApiUsage(
      session.user.id,
      'indicators',
      symbol,
      timeframe,
      tier,
      200,
      duration
    );

    return NextResponse.json({
      success: true,
      data: result.data,
      cached: false,
    });
  } catch (error) {
    console.error('Indicators API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper: Rate limiting with tier-based limits
async function rateLimit(identifier: string, tier: 'FREE' | 'PRO') {
  const limits = {
    FREE: { requests: 100, window: 3600 },
    PRO: { requests: 1000, window: 3600 },
  };

  const limit = limits[tier];

  const now = Date.now();
  const windowStart = now - limit.window * 1000;

  const key = `ratelimit:${identifier}`;

  await redis.zremrangebyscore(key, 0, windowStart);
  const count = await redis.zcard(key);

  if (count >= limit.requests) {
    return { success: false };
  }

  await redis.zadd(key, now, `${now}`);
  await redis.expire(key, limit.window);

  return { success: true };
}

// Helper: Log API usage with tier tracking
async function logApiUsage(
  userId: string,
  endpoint: string,
  symbol: string,
  timeframe: string,
  tier: string,
  status: number,
  duration: number
) {
  await prisma.apiUsage.create({
    data: {
      userId,
      endpoint,
      method: 'GET',
      status,
      duration,
      symbol,
      timeframe,
      tier, // V5: Track tier in usage logs
    },
  });
}
```

### 10.2 Trading Chart Component

Create `components/charts/trading-chart.tsx`:

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi } from 'lightweight-charts';
import { useQuery } from '@tanstack/react-query';
import { useWebSocket } from '@/hooks/use-websocket';

interface TradingChartProps {
  symbol: string;
  timeframe: string;
}

// V5: Updated valid timeframes
const VALID_TIMEFRAMES = ['M15', 'M30', 'H1', 'H2', 'H4', 'H8', 'D1'] as const;

export function TradingChart({ symbol, timeframe }: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [candleSeries, setCandleSeries] = useState<ISeriesApi<'Candlestick'> | null>(null);
  const [lineSeries, setLineSeries] = useState<ISeriesApi<'Line'>[]>([]);

  // V5: Validate timeframe
  if (!VALID_TIMEFRAMES.includes(timeframe as any)) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-[#1e222d] rounded-lg">
        <div className="text-red-500">Invalid timeframe: {timeframe}</div>
      </div>
    );
  }

  // Fetch indicator data
  const { data, isLoading, error } = useQuery({
    queryKey: ['indicators', symbol, timeframe],
    queryFn: async () => {
      const res = await fetch(`/api/indicators/${symbol}/${timeframe}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to fetch indicators');
      }
      return res.json();
    },
    refetchInterval: 60000
  });

  // WebSocket for real-time updates
  const { lastMessage } = useWebSocket(`indicators/${symbol}/${timeframe}`);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 600,
      layout: {
        background: { color: '#1e222d' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2a2e39' },
        horzLines: { color: '#2a2e39' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#2a2e39',
      },
      timeScale: {
        borderColor: '#2a2e39',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    const series = chart.addCandlestickSeries({
      upColor: '#00c853',
      downColor: '#f23645',
      borderVisible: false,
      wickUpColor: '#00c853',
      wickDownColor: '#f23645',
    });

    setCandleSeries(series);

    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // Load data
  useEffect(() => {
    if (!data?.success || !candleSeries) return;

    candleSeries.setData(data.data.ohlc);

    lineSeries.forEach(series => {
      if (chartRef.current) {
        chartRef.current.removeSeries(series);
      }
    });

    const newLineSeries: ISeriesApi<'Line'>[] = [];

    // Add horizontal lines
    if (data.data.horizontal) {
      const colors = {
        peak_1: '#f23645',
        peak_2: '#ff6b6b',
        peak_3: '#ff8c8c',
        bottom_1: '#00c853',
        bottom_2: '#4ecdc4',
        bottom_3: '#95e1d3'
      };

      Object.entries(data.data.horizontal).forEach(([key, points]) => {
        if (Array.isArray(points) && points.length > 0 && chartRef.current) {
          const series = chartRef.current.addLineSeries({
            color: colors[key as keyof typeof colors],
            lineWidth: 2,
            crosshairMarkerVisible: false,
          });
          series.setData(points);
          newLineSeries.push(series);
        }
      });
    }

    // Add diagonal lines
    if (data.data.diagonal) {
      const colors = {
        ascending_1: '#1e88e5',
        ascending_2: '#64b5f6',
        ascending_3: '#90caf9',
        descending_1: '#ff6b35',
        descending_2: '#ff8c5a',
        descending_3: '#ffad7f'
      };

      Object.entries(data.data.diagonal).forEach(([key, points]) => {
        if (Array.isArray(points) && points.length > 0 && chartRef.current) {
          const series = chartRef.current.addLineSeries({
            color: colors[key as keyof typeof colors],
            lineWidth: 2,
            crosshairMarkerVisible: false,
          });
          series.setData(points);
          newLineSeries.push(series);
        }
      });
    }

    // Add fractal markers
    if (data.data.fractals && candleSeries) {
      const markers: any[] = [];

      data.data.fractals.peaks?.forEach((peak: any) => {
        markers.push({
          time: peak.time,
          position: 'aboveBar',
          color: '#f23645',
          shape: 'arrowDown',
          text: 'P'
        });
      });

      data.data.fractals.bottoms?.forEach((bottom: any) => {
        markers.push({
          time: bottom.time,
          position: 'belowBar',
          color: '#00c853',
          shape: 'arrowUp',
          text: 'B'
        });
      });

      candleSeries.setMarkers(markers);
    }

    setLineSeries(newLineSeries);
  }, [data, candleSeries]);

  // Handle real-time updates
  useEffect(() => {
    if (!lastMessage || !candleSeries) return;

    try {
      const update = JSON.parse(lastMessage);
      candleSeries.update(update);
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }, [lastMessage, candleSeries]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-[#1e222d] rounded-lg">
        <div className="text-[#d1d4dc]">Loading chart...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-[#1e222d] rounded-lg">
        <div className="text-red-500">
          {error instanceof Error ? error.message : 'Error loading chart'}
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={chartContainerRef} className="rounded-lg overflow-hidden" />
    </div>
  );
}
```

### 10.3 WebSocket Hook

Create `hooks/use-websocket.ts`:

```typescript
import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export function useWebSocket(channel: string) {
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(
      process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001',
      {
        transports: ['websocket'],
      }
    );

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      socket.emit('subscribe', channel);
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    socket.on(channel, (data) => {
      setLastMessage(JSON.stringify(data));
    });

    return () => {
      socket.emit('unsubscribe', channel);
      socket.disconnect();
    };
  }, [channel]);

  return { lastMessage, isConnected };
}
```

### 10.4 Email Helper Functions

Create `lib/email.ts`:

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(
  email: string,
  name: string,
  token: string
) {
  const verificationUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${token}`;

  try {
    await resend.emails.send({
      from: 'Trading Alerts <noreply@yourdomain.com>',
      to: email,
      subject: 'Verify your email address',
      html: `
        <div>
          <h1>Welcome to Trading Alerts, ${name}!</h1>
          <p>Please verify your email address by clicking the link below:</p>
          <a href="${verificationUrl}">Verify Email</a>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create an account, you can safely ignore this email.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error('Failed to send verification email:', error);
    throw error;
  }
}

export async function sendWelcomeEmail(email: string, name: string) {
  try {
    await resend.emails.send({
      from: 'Trading Alerts <noreply@yourdomain.com>',
      to: email,
      subject: 'Welcome to Trading Alerts!',
      html: `
        <div>
          <h1>Welcome aboard, ${name}!</h1>
          <p>Your account has been verified successfully.</p>
          <p>You can now start using Trading Alerts to monitor your favorite symbols.</p>
          <a href="${process.env.NEXTAUTH_URL}/dashboard">Go to Dashboard</a>
        </div>
      `,
    });
  } catch (error) {
    console.error('Failed to send welcome email:', error);
  }
}

export async function sendPasswordResetEmail(
  email: string,
  name: string,
  token: string
) {
  const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;

  try {
    await resend.emails.send({
      from: 'Trading Alerts <noreply@yourdomain.com>',
      to: email,
      subject: 'Reset your password',
      html: `
        <div>
          <h1>Password Reset Request</h1>
          <p>Hi ${name},</p>
          <p>We received a request to reset your password. Click the link below to create a new password:</p>
          <a href="${resetUrl}">Reset Password</a>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request a password reset, you can safely ignore this email.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw error;
  }
}

export async function sendSystemAlert(
  email: string,
  subject: string,
  message: string
) {
  try {
    await resend.emails.send({
      from: 'Trading Alerts System <alerts@yourdomain.com>',
      to: email,
      subject: `[SYSTEM ALERT] ${subject}`,
      html: `
        <div>
          <h1>System Alert</h1>
          <p><strong>Priority:</strong> High</p>
          <p><strong>Message:</strong></p>
          <pre>${message}</pre>
          <p>Please check the admin dashboard for more details.</p>
          <a href="${process.env.NEXTAUTH_URL}/admin">Admin Dashboard</a>
        </div>
      `,
    });
  } catch (error) {
    console.error('Failed to send system alert email:', error);
  }
}

export async function sendAlertNotification(
  email: string,
  alertName: string,
  symbol: string,
  price: number,
  details: string
) {
  try {
    await resend.emails.send({
      from: 'Trading Alerts <alerts@yourdomain.com>',
      to: email,
      subject: `Alert Triggered: ${alertName}`,
      html: `
        <div>
          <h1>Trading Alert Triggered</h1>
          <p><strong>Alert:</strong> ${alertName}</p>
          <p><strong>Symbol:</strong> ${symbol}</p>
          <p><strong>Price:</strong> ${price}</p>
          <p><strong>Details:</strong> ${details}</p>
          <a href="${process.env.NEXTAUTH_URL}/alerts">View All Alerts</a>
        </div>
      `,
    });
  } catch (error) {
    console.error('Failed to send alert notification:', error);
  }
}
```

### 10.5 Token Generation Helper

Create `lib/tokens.ts`:

```typescript
import { randomBytes } from 'crypto';

export function generateVerificationToken(): string {
  return randomBytes(32).toString('hex');
}

export function generateResetToken(): string {
  return randomBytes(32).toString('hex');
}

export function generateApiKey(): string {
  return `sk_${randomBytes(24).toString('hex')}`;
}
```

---
