/**
 * System Status Checks (Session 6-10, B2-12)
 *
 * Real, cheap checks -- not fabricated "all systems operational" copy
 * (F64/6-1b established that pattern must not repeat). Mirrors the existing
 * `app/api/disbursement/health/route.ts` precedent (a real `SELECT 1` DB
 * ping, "Public endpoint for monitoring") rather than inventing a new one.
 *
 * Server-only: imports the Prisma client.
 *
 * @module lib/status/check-system-status
 */

import { prisma } from '@/lib/db/prisma';

export type ComponentStatus = 'operational' | 'degraded' | 'not_configured';

export interface StatusComponent {
  name: string;
  status: ComponentStatus;
  detail: string;
}

export interface SystemStatus {
  overall: ComponentStatus;
  checkedAt: string;
  components: StatusComponent[];
}

const HEALTH_CHECK_TIMEOUT_MS = 3000;

async function checkDatabase(): Promise<StatusComponent> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      name: 'Database',
      status: 'operational',
      detail: 'Connection healthy',
    };
  } catch {
    return {
      name: 'Database',
      status: 'degraded',
      detail: 'Connection check failed',
    };
  }
}

async function checkRealtime(): Promise<StatusComponent> {
  const configuredUrl = process.env['OPERATION_SERVICE_URL'];
  if (!configuredUrl) {
    return {
      name: 'Realtime & WebSockets',
      status: 'not_configured',
      detail: 'Realtime service URL not configured in this environment',
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      HEALTH_CHECK_TIMEOUT_MS
    );
    const response = await fetch(`${configuredUrl}/health`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);
    return response.ok
      ? {
          name: 'Realtime & WebSockets',
          status: 'operational',
          detail: 'Realtime service responding',
        }
      : {
          name: 'Realtime & WebSockets',
          status: 'degraded',
          detail: `Realtime service returned ${response.status}`,
        };
  } catch {
    return {
      name: 'Realtime & WebSockets',
      status: 'degraded',
      detail: 'Realtime service unreachable',
    };
  }
}

function checkPaymentGateways(): StatusComponent {
  const stripeConfigured = Boolean(process.env['STRIPE_SECRET_KEY']);
  const dlocalConfigured = Boolean(
    process.env['DLOCAL_LOGIN'] || process.env['DLOCAL_API_KEY']
  );

  if (stripeConfigured && dlocalConfigured) {
    return {
      name: 'Payment Gateways',
      status: 'operational',
      detail: 'Stripe and dLocal configured',
    };
  }
  if (stripeConfigured || dlocalConfigured) {
    return {
      name: 'Payment Gateways',
      status: 'degraded',
      detail: 'One payment provider is not configured in this environment',
    };
  }
  return {
    name: 'Payment Gateways',
    status: 'not_configured',
    detail: 'No payment provider configured in this environment',
  };
}

function worstStatus(components: StatusComponent[]): ComponentStatus {
  if (components.some((c) => c.status === 'degraded')) return 'degraded';
  if (components.some((c) => c.status === 'not_configured'))
    return 'not_configured';
  return 'operational';
}

/**
 * Real, live checks -- API (trivially true if this code is executing),
 * Database (SELECT 1), Realtime (operation-service /health reachability),
 * Payment Gateways (config presence, value-blind).
 */
export async function getSystemStatus(): Promise<SystemStatus> {
  const [database, realtime] = await Promise.all([
    checkDatabase(),
    checkRealtime(),
  ]);

  const components: StatusComponent[] = [
    { name: 'API', status: 'operational', detail: 'Responding' },
    database,
    realtime,
    checkPaymentGateways(),
  ];

  return {
    overall: worstStatus(components),
    checkedAt: new Date().toISOString(),
    components,
  };
}
