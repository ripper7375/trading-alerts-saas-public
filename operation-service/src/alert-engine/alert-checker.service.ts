import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Alert Checker Job
 *
 * Background job to check alert conditions against current prices.
 * Runs periodically to detect triggered alerts and send notifications.
 *
 * Uses Flask MT5 service for real-time price data.
 *
 * @module alert-engine/alert-checker.service
 */

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
    case 'price_equals': {
      // Allow 0.5% tolerance for price_equals
      const tolerance = targetValue * 0.005;
      return Math.abs(currentPrice - targetValue) <= tolerance;
    }
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

@Injectable()
export class AlertCheckerService {
  private readonly logger = new Logger(AlertCheckerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetch the latest XAUUSD close price from the v6 Railway Gateway
   * pipeline's market_data_v6 table. Distinct from the Part 20 Postgres
   * path removed in favor of Flask — this reads a different, newer table
   * (backend-stack-c's Gateway) and only for XAUUSD; every other symbol is
   * unaffected. Returns null (not 0) when there's no synced row yet, so
   * callers can fall back to the Flask service.
   */
  private async fetchXauusdPriceFromGatewayPipeline(
    timeframe: string
  ): Promise<number | null> {
    try {
      const row = await this.prisma.marketDataV6.findFirst({
        where: { symbol: 'XAUUSD', timeframe },
        orderBy: { timestamp: 'desc' },
      });
      return row?.close ?? null;
    } catch (error) {
      this.logger.error('Error querying market_data_v6:', error);
      return null;
    }
  }

  /**
   * Fetch current price for a symbol/timeframe
   *
   * Queries Flask MT5 service for real-time price data. For XAUUSD, tries
   * the v6 Gateway pipeline's table first (keyed on timeframe) and falls
   * back to the Flask OHLCV endpoint (`/api/indicators/{symbol}/{timeframe}`),
   * taking the latest bar's close.
   */
  private async fetchCurrentPrice(
    symbol: string,
    timeframe: string
  ): Promise<number> {
    if (symbol === 'XAUUSD') {
      const gatewayPrice =
        await this.fetchXauusdPriceFromGatewayPipeline(timeframe);
      if (gatewayPrice !== null) {
        return gatewayPrice;
      }
    }

    try {
      // Query the Flask MT5 service's OHLCV endpoint (the service has no
      // dedicated /price route) and use the latest bar's close as the
      // current price. `bars` is clamped to >= 100 server-side, so request
      // the minimum.
      // X-User-Tier: PRO — this is a trusted server-side job; tier gating
      // is a per-user browser concern, and FREE would block most
      // symbols/timeframes.
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
        this.logger.error(`Flask API error for ${symbol}: ${response.status}`);
        return 0;
      }

      const json = await response.json();
      const ohlcv: Array<{ close?: number }> = json?.data?.ohlcv ?? [];
      return ohlcv[ohlcv.length - 1]?.close ?? 0;
    } catch (error) {
      this.logger.error(`Error fetching price for ${symbol}:`, error);
      return 0;
    }
  }

  /**
   * Trigger an alert - update status
   *
   * @param alert - Alert record to trigger
   * @param currentPrice - Current price that triggered the alert
   */
  private async triggerAlert(
    alert: AlertRecord,
    currentPrice: number
  ): Promise<void> {
    const condition = parseCondition(alert.condition);

    this.logger.log(
      `Triggering alert ${alert.id}: ${alert.symbol} ` +
        `${condition?.type} ${condition?.targetValue} (current: ${currentPrice})`
    );

    try {
      // Update alert in database
      await this.prisma.alert.update({
        where: { id: alert.id },
        data: {
          isActive: false, // Deactivate after trigger
          lastTriggered: new Date(),
          triggerCount: { increment: 1 },
        },
      });

      this.logger.log(`Alert ${alert.id} triggered successfully`);
    } catch (error) {
      this.logger.error(`Failed to trigger alert ${alert.id}:`, error);
    }
  }

  /**
   * Check all active alerts
   *
   * Main function to run the alert checking job.
   * Groups alerts by symbol to minimize API calls.
   */
  async checkAlerts(): Promise<void> {
    this.logger.log('Starting alert check...');

    try {
      // Fetch all active alerts
      const activeAlerts = await this.prisma.alert.findMany({
        where: { isActive: true },
      });

      this.logger.log(`Found ${activeAlerts.length} active alerts`);

      if (activeAlerts.length === 0) {
        this.logger.log('No active alerts to check');
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
        const currentPrice = await this.fetchCurrentPrice(
          symbol,
          alerts[0]?.timeframe || 'M5' // V8 default timeframe
        );

        if (currentPrice === 0) {
          this.logger.log(`Skipping ${symbol} - no price available`);
          continue;
        }

        this.logger.log(
          `Checking ${alerts.length} alerts for ${symbol} (price: ${currentPrice})`
        );

        // Check each alert for this symbol
        for (const alert of alerts) {
          const condition = parseCondition(alert.condition);

          if (!condition) {
            this.logger.warn(`Invalid condition for alert ${alert.id}`);
            continue;
          }

          const conditionMet = checkAlertCondition(
            currentPrice,
            condition.type,
            condition.targetValue
          );

          if (conditionMet) {
            await this.triggerAlert(alert, currentPrice);
          }
        }
      }

      this.logger.log('Alert check completed');
    } catch (error) {
      this.logger.error('Error checking alerts:', error);
    }
  }

  /**
   * Run alert checker once (for manual testing)
   */
  async runOnce(): Promise<void> {
    await this.checkAlerts();
  }
}
