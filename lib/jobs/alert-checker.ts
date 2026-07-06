/**
 * Alert Checker Job
 *
 * Background job to check alert conditions against current prices.
 * Runs periodically to detect triggered alerts and send notifications.
 *
 * Uses Flask MT5 service for real-time price data.
 *
 * @module lib/jobs/alert-checker
 */

import { prisma } from '@/lib/db/prisma';

// Flask MT5 service configuration
const MT5_API_URL = process.env['MT5_API_URL'] || 'http://localhost:5000';

/**
 * Parsed condition from alert.condition JSON
 */
interface AlertCondition {
  type: 'price_above' | 'price_below' | 'price_equals';
  targetValue: number;
}

/**
 * Alert record from database
 */
interface AlertRecord {
  id: string;
  userId: string;
  symbol: string;
  timeframe: string;
  condition: string;
  isActive: boolean;
  lastTriggered: Date | null;
  triggerCount: number;
  user: {
    email: string;
    name: string | null;
  };
}

/**
 * Check if alert condition is met
 *
 * @param currentPrice - Current market price
 * @param conditionType - Type of condition to check
 * @param targetValue - Target price value
 * @returns True if condition is met
 */
export function checkAlertCondition(
  currentPrice: number,
  conditionType: string,
  targetValue: number
): boolean {
  switch (conditionType) {
    case 'price_above':
      return currentPrice > targetValue;
    case 'price_below':
      return currentPrice < targetValue;
    case 'price_equals':
      // Allow 0.5% tolerance for price_equals
      const tolerance = targetValue * 0.005;
      return Math.abs(currentPrice - targetValue) <= tolerance;
    default:
      return false;
  }
}

/**
 * Parse condition JSON safely
 *
 * @param conditionJson - JSON string of condition
 * @returns Parsed condition or null if invalid
 */
function parseCondition(conditionJson: string): AlertCondition | null {
  try {
    const parsed = JSON.parse(conditionJson);
    if (
      parsed &&
      typeof parsed.type === 'string' &&
      typeof parsed.targetValue === 'number'
    ) {
      return parsed as AlertCondition;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch the latest XAUUSD close price from the v6 Railway Gateway pipeline's
 * market_data_v6 table. Distinct from the Part 20 Postgres path removed in
 * favor of Flask (see this file's test suite) — this reads a different,
 * newer table (backend-stack-c's Gateway) and only for XAUUSD; every other
 * symbol is unaffected. Returns null (not 0) when there's no synced row yet,
 * so callers can fall back to the Flask service.
 */
async function fetchXauusdPriceFromGatewayPipeline(
  timeframe: string
): Promise<number | null> {
  try {
    const row = await prisma.marketDataV6.findFirst({
      where: { symbol: 'XAUUSD', timeframe },
      orderBy: { timestamp: 'desc' },
    });
    return row?.close ?? null;
  } catch (error) {
    console.error('[AlertChecker] Error querying market_data_v6:', error);
    return null;
  }
}

/**
 * Fetch current price for a symbol/timeframe
 *
 * Queries Flask MT5 service for real-time price data. For XAUUSD, tries the
 * v6 Gateway pipeline's table first (keyed on timeframe) and falls back to
 * the Flask OHLCV endpoint (`/api/indicators/{symbol}/{timeframe}`), taking
 * the latest bar's close.
 *
 * @param symbol - Trading symbol (e.g., XAUUSD)
 * @param timeframe - Timeframe (e.g., M5)
 * @returns Current price or 0 if fetch fails
 */
async function fetchCurrentPrice(
  symbol: string,
  timeframe: string
): Promise<number> {
  if (symbol === 'XAUUSD') {
    const gatewayPrice = await fetchXauusdPriceFromGatewayPipeline(timeframe);
    if (gatewayPrice !== null) {
      return gatewayPrice;
    }
  }

  try {
    // Query the Flask MT5 service's OHLCV endpoint (the service has no
    // dedicated /price route) and use the latest bar's close as the current
    // price. `bars` is clamped to >= 100 server-side, so request the minimum.
    // X-User-Tier: PRO — this is a trusted server-side job; tier gating is a
    // per-user browser concern, and FREE would block most symbols/timeframes.
    const response = await fetch(
      `${MT5_API_URL}/api/indicators/${symbol}/${timeframe}?bars=100`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Tier': 'PRO',
        },
      }
    );

    if (!response.ok) {
      console.error(
        `[AlertChecker] Flask API error for ${symbol}: ${response.status}`
      );
      return 0;
    }

    const json = await response.json();
    const ohlcv: Array<{ close?: number }> = json?.data?.ohlcv ?? [];
    return ohlcv[ohlcv.length - 1]?.close ?? 0;
  } catch (error) {
    console.error(`[AlertChecker] Error fetching price for ${symbol}:`, error);
    return 0;
  }
}

/**
 * Trigger an alert - update status and create notification
 *
 * @param alert - Alert record to trigger
 * @param currentPrice - Current price that triggered the alert
 */
async function triggerAlert(
  alert: AlertRecord,
  currentPrice: number
): Promise<void> {
  const condition = parseCondition(alert.condition);

  console.log(
    `[AlertChecker] Triggering alert ${alert.id}: ${alert.symbol} ` +
      `${condition?.type} ${condition?.targetValue} (current: ${currentPrice})`
  );

  try {
    // Update alert in database
    await prisma.alert.update({
      where: { id: alert.id },
      data: {
        isActive: false, // Deactivate after trigger
        lastTriggered: new Date(),
        triggerCount: { increment: 1 },
      },
    });

    // TODO: Create notification record
    // await prisma.alertNotification.create({
    //   data: {
    //     alertId: alert.id,
    //     userId: alert.userId,
    //     price: currentPrice,
    //     details: {
    //       symbol: alert.symbol,
    //       timeframe: alert.timeframe,
    //       conditionType: condition?.type,
    //       targetValue: condition?.targetValue,
    //       currentPrice,
    //     },
    //   },
    // });

    // TODO: Send WebSocket notification
    // broadcastToUser(alert.userId, {
    //   type: 'alert_triggered',
    //   data: {
    //     alertId: alert.id,
    //     symbol: alert.symbol,
    //     currentPrice,
    //     targetValue: condition?.targetValue,
    //   },
    // });

    // TODO: Send email notification
    // await sendAlertEmail(alert.user.email, {
    //   alertName: alert.name,
    //   symbol: alert.symbol,
    //   condition: condition?.type,
    //   targetValue: condition?.targetValue,
    //   currentPrice,
    // });

    console.log(`[AlertChecker] Alert ${alert.id} triggered successfully`);
  } catch (error) {
    console.error(`[AlertChecker] Failed to trigger alert ${alert.id}:`, error);
  }
}

/**
 * Check all active alerts
 *
 * Main function to run the alert checking job.
 * Groups alerts by symbol to minimize API calls.
 */
export async function checkAlerts(): Promise<void> {
  console.log('[AlertChecker] Starting alert check...');

  try {
    // Fetch all active alerts with user data
    const activeAlerts = await prisma.alert.findMany({
      where: { isActive: true },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    console.log(`[AlertChecker] Found ${activeAlerts.length} active alerts`);

    if (activeAlerts.length === 0) {
      console.log('[AlertChecker] No active alerts to check');
      return;
    }

    // Group alerts by symbol to minimize price fetches
    const alertsBySymbol = new Map<string, AlertRecord[]>();

    for (const alert of activeAlerts) {
      const existing = alertsBySymbol.get(alert.symbol) || [];
      existing.push(alert as AlertRecord);
      alertsBySymbol.set(alert.symbol, existing);
    }

    // Check each symbol group
    for (const [symbol, alerts] of alertsBySymbol) {
      // Fetch current price for this symbol (using first alert's timeframe)
      const currentPrice = await fetchCurrentPrice(
        symbol,
        alerts[0]?.timeframe || 'H1'
      );

      if (currentPrice === 0) {
        console.log(`[AlertChecker] Skipping ${symbol} - no price available`);
        continue;
      }

      console.log(
        `[AlertChecker] Checking ${alerts.length} alerts for ${symbol} (price: ${currentPrice})`
      );

      // Check each alert for this symbol
      for (const alert of alerts) {
        const condition = parseCondition(alert.condition);

        if (!condition) {
          console.warn(
            `[AlertChecker] Invalid condition for alert ${alert.id}`
          );
          continue;
        }

        const conditionMet = checkAlertCondition(
          currentPrice,
          condition.type,
          condition.targetValue
        );

        if (conditionMet) {
          await triggerAlert(alert, currentPrice);
        }
      }
    }

    console.log('[AlertChecker] Alert check completed');
  } catch (error) {
    console.error('[AlertChecker] Error checking alerts:', error);
  }
}

/**
 * Run alert checker once (for manual testing)
 */
export async function runOnce(): Promise<void> {
  await checkAlerts();
}
