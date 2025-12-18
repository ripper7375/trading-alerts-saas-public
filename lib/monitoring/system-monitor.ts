import { prisma } from '@/lib/db/prisma';
import {
  getConnectedUsersCount,
  isUserConnected,
} from '@/lib/websocket/server';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type HealthStatus = 'healthy' | 'degraded' | 'down';

interface HealthCheck {
  status: HealthStatus;
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
  status: HealthStatus;
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

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HEALTH CHECK FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Check database connectivity and response time
 */
async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Simple query to check database connectivity
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'healthy',
      responseTime: Date.now() - start,
      lastChecked: new Date(),
    };
  } catch (error) {
    console.error('Database health check failed:', error);
    return {
      status: 'down',
      lastChecked: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check Redis connectivity
 * TODO: Implement actual Redis client check when Redis is integrated
 */
async function checkRedis(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Placeholder - implement actual Redis check when integrated
    // For now, return healthy status
    return {
      status: 'healthy',
      responseTime: Date.now() - start,
      lastChecked: new Date(),
    };
  } catch (error) {
    console.error('Redis health check failed:', error);
    return {
      status: 'down',
      lastChecked: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check MT5 service connectivity
 * TODO: Implement actual MT5 service check when integrated
 */
async function checkMT5Service(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Placeholder - implement actual MT5 service check when integrated
    // Could ping the Flask MT5 service endpoint
    const mt5ServiceUrl = process.env['MT5_SERVICE_URL'];

    if (!mt5ServiceUrl) {
      return {
        status: 'degraded',
        responseTime: Date.now() - start,
        lastChecked: new Date(),
        error: 'MT5_SERVICE_URL not configured',
      };
    }

    // For now, return healthy status
    return {
      status: 'healthy',
      responseTime: Date.now() - start,
      lastChecked: new Date(),
    };
  } catch (error) {
    console.error('MT5 service health check failed:', error);
    return {
      status: 'down',
      lastChecked: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check WebSocket server status
 */
async function checkWebSocket(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Verify WebSocket server is responsive by getting connected users count
    getConnectedUsersCount();
    return {
      status: 'healthy',
      responseTime: Date.now() - start,
      lastChecked: new Date(),
    };
  } catch (error) {
    console.error('WebSocket health check failed:', error);
    return {
      status: 'down',
      lastChecked: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TIER METRICS FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get metrics for a specific tier
 *
 * @param tier - The user tier (FREE or PRO)
 */
async function getTierMetrics(tier: 'FREE' | 'PRO'): Promise<TierMetrics> {
  try {
    // Get count of users by tier
    const userCount = await prisma.user.count({
      where: { tier },
    });

    // Get active subscriptions for PRO tier
    const activeSubscriptions =
      tier === 'PRO'
        ? await prisma.subscription.count({
            where: { status: 'ACTIVE' },
          })
        : 0;

    // Placeholder metrics - in production, these would come from
    // a metrics collection system (e.g., Prometheus, DataDog)
    return {
      activeConnections: tier === 'PRO' ? activeSubscriptions : userCount,
      avgResponseTime: Math.random() * 100 + 50, // Placeholder: 50-150ms
      errorRate: Math.random() * 2, // Placeholder: 0-2%
      requestsPerMinute: Math.floor(Math.random() * 100) + 10, // Placeholder
    };
  } catch (error) {
    console.error(`Failed to get tier metrics for ${tier}:`, error);
    return {
      activeConnections: 0,
      avgResponseTime: 0,
      errorRate: 0,
      requestsPerMinute: 0,
    };
  }
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN HEALTH CHECK FUNCTION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get comprehensive system health status
 *
 * Performs health checks on all system components:
 * - Database (PostgreSQL via Prisma)
 * - Redis (for caching/sessions)
 * - MT5 Service (Flask trading service)
 * - WebSocket (real-time notifications)
 *
 * Also collects tier-specific metrics for FREE and PRO users.
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  // Run all health checks in parallel
  const [database, redis, mt5Service, websocket] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkMT5Service(),
    checkWebSocket(),
  ]);

  // Get tier metrics in parallel
  const [freeMetrics, proMetrics] = await Promise.all([
    getTierMetrics('FREE'),
    getTierMetrics('PRO'),
  ]);

  // Determine overall system status
  const checks = { database, redis, mt5Service, websocket };
  const statuses = Object.values(checks).map((c) => c.status);

  let status: HealthStatus = 'healthy';
  if (statuses.includes('down')) {
    // If any critical service is down, system is down
    status = 'down';
  } else if (statuses.includes('degraded')) {
    // If any service is degraded, system is degraded
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

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ALERT FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Determine if admin should be alerted based on system health
 *
 * Alerts are triggered when:
 * - Any service is down
 * - Error rate exceeds 5% for any tier
 * - Average response time exceeds 2000ms
 *
 * @param health - The current system health status
 */
export function shouldAlertAdmin(health: SystemHealth): boolean {
  // Alert if any service is down
  if (health.status === 'down') {
    return true;
  }

  // Alert if error rate exceeds 5% for any tier
  if (
    health.tierMetrics.FREE.errorRate > 5 ||
    health.tierMetrics.PRO.errorRate > 5
  ) {
    return true;
  }

  // Alert if average response time exceeds 2000ms
  const avgResponseTime =
    (health.tierMetrics.FREE.avgResponseTime +
      health.tierMetrics.PRO.avgResponseTime) /
    2;
  if (avgResponseTime > 2000) {
    return true;
  }

  return false;
}

/**
 * Get alert reasons based on system health
 *
 * @param health - The current system health status
 */
export function getAlertReasons(health: SystemHealth): string[] {
  const reasons: string[] = [];

  // Check service status
  Object.entries(health.checks).forEach(([service, check]) => {
    if (check.status === 'down') {
      reasons.push(
        `${service} service is down: ${check.error || 'Unknown error'}`
      );
    } else if (check.status === 'degraded') {
      reasons.push(
        `${service} service is degraded: ${check.error || 'Performance issues'}`
      );
    }
  });

  // Check error rates
  if (health.tierMetrics.FREE.errorRate > 5) {
    reasons.push(
      `FREE tier error rate is ${health.tierMetrics.FREE.errorRate.toFixed(2)}% (threshold: 5%)`
    );
  }
  if (health.tierMetrics.PRO.errorRate > 5) {
    reasons.push(
      `PRO tier error rate is ${health.tierMetrics.PRO.errorRate.toFixed(2)}% (threshold: 5%)`
    );
  }

  // Check response times
  const avgResponseTime =
    (health.tierMetrics.FREE.avgResponseTime +
      health.tierMetrics.PRO.avgResponseTime) /
    2;
  if (avgResponseTime > 2000) {
    reasons.push(
      `Average response time is ${avgResponseTime.toFixed(0)}ms (threshold: 2000ms)`
    );
  }

  return reasons;
}

/**
 * Check if a specific user is currently connected via WebSocket
 *
 * @param userId - The user ID to check
 */
export function checkUserConnection(userId: string): boolean {
  return isUserConnected(userId);
}
