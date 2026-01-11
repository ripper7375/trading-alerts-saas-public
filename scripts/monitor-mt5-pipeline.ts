#!/usr/bin/env tsx
/**
 * MT5 to PostgreSQL Pipeline Health Monitor
 * Part 20 - Continuous Monitoring Script
 *
 * This script performs health checks on the complete data pipeline
 * and can be run periodically (e.g., every 5 minutes)
 */

import { createClient } from 'redis';
import { PrismaClient } from '@prisma/client';

interface HealthStatus {
  timestamp: string;
  overall: 'healthy' | 'degraded' | 'critical';
  components: {
    redis: ComponentHealth;
    postgresql: ComponentHealth;
    dataFreshness: ComponentHealth;
    dataIntegrity: ComponentHealth;
  };
  alerts: string[];
}

interface ComponentHealth {
  status: 'healthy' | 'warning' | 'critical';
  message: string;
  metrics?: Record<string, any>;
}

class PipelineHealthMonitor {
  private redisClient: any;
  private prisma: PrismaClient;
  private alerts: string[] = [];

  constructor() {
    this.prisma = new PrismaClient();
  }

  async initialize(): Promise<void> {
    if (process.env.REDIS_URL) {
      this.redisClient = createClient({ url: process.env.REDIS_URL });
      await this.redisClient.connect();
    }
  }

  async cleanup(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.disconnect();
    }
    await this.prisma.$disconnect();
  }

  private addAlert(message: string): void {
    this.alerts.push(message);
    console.error(`🚨 ALERT: ${message}`);
  }

  async checkRedisHealth(): Promise<ComponentHealth> {
    if (!this.redisClient) {
      return {
        status: 'critical',
        message: 'Redis not configured',
      };
    }

    try {
      // Test connection
      const pingStart = Date.now();
      await this.redisClient.ping();
      const latency = Date.now() - pingStart;

      // Check candle counts for key symbols
      const testSymbols = ['eurusd', 'btcusd', 'xauusd'];
      let totalCandles = 0;
      let symbolsOk = 0;

      for (const symbol of testSymbols) {
        const count = await this.redisClient.zCard(`${symbol}:realtime`);
        totalCandles += count;

        if (count >= 200) {
          symbolsOk++;
        } else if (count < 200) {
          this.addAlert(`Redis ${symbol.toUpperCase()} has only ${count} candles (expected ~250)`);
        }
      }

      const avgCandles = Math.round(totalCandles / testSymbols.length);

      // Determine status
      let status: 'healthy' | 'warning' | 'critical';
      let message: string;

      if (latency > 10) {
        status = 'warning';
        message = `High latency (${latency}ms)`;
        this.addAlert(`Redis latency is ${latency}ms (expected <5ms)`);
      } else if (symbolsOk === testSymbols.length && avgCandles >= 200) {
        status = 'healthy';
        message = `All systems operational (${avgCandles} avg candles, ${latency}ms latency)`;
      } else if (symbolsOk >= 2) {
        status = 'warning';
        message = `Some symbols have low candle counts`;
      } else {
        status = 'critical';
        message = `Multiple symbols missing data`;
        this.addAlert('CRITICAL: Multiple symbols missing data in Redis');
      }

      return {
        status,
        message,
        metrics: {
          latency_ms: latency,
          avg_candles: avgCandles,
          symbols_ok: symbolsOk,
          total_symbols: testSymbols.length,
        },
      };
    } catch (error) {
      this.addAlert(`Redis connection failed: ${error instanceof Error ? error.message : String(error)}`);
      return {
        status: 'critical',
        message: `Connection failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async checkPostgreSQLHealth(): Promise<ComponentHealth> {
    try {
      // Test connection
      const queryStart = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - queryStart;

      // Check table existence
      const tables: Array<{ tablename: string }> = await this.prisma.$queryRaw`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename ~ '^(eurusd|btcusd|xauusd)_m5$'
      `;

      const expectedTables = 3; // eurusd_m5, btcusd_m5, xauusd_m5

      if (tables.length !== expectedTables) {
        this.addAlert(`PostgreSQL missing tables: found ${tables.length}/${expectedTables}`);
        return {
          status: 'critical',
          message: `Missing tables: found ${tables.length}/${expectedTables}`,
          metrics: { latency_ms: latency, tables_found: tables.length },
        };
      }

      // Check row counts
      const eurusdCount: Array<{ count: bigint }> = await this.prisma.$queryRaw`
        SELECT COUNT(*) as count FROM eurusd_m5
      `;
      const rowCount = Number(eurusdCount[0].count);

      // Determine status
      let status: 'healthy' | 'warning' | 'critical';
      let message: string;

      if (latency > 100) {
        status = 'warning';
        message = `High latency (${latency}ms)`;
        this.addAlert(`PostgreSQL latency is ${latency}ms (expected <50ms)`);
      } else if (rowCount === 0) {
        status = 'critical';
        message = 'No data in tables';
        this.addAlert('CRITICAL: PostgreSQL tables are empty');
      } else {
        status = 'healthy';
        message = `All systems operational (${rowCount} rows, ${latency}ms latency)`;
      }

      return {
        status,
        message,
        metrics: {
          latency_ms: latency,
          row_count: rowCount,
          tables_found: tables.length,
        },
      };
    } catch (error) {
      this.addAlert(`PostgreSQL connection failed: ${error instanceof Error ? error.message : String(error)}`);
      return {
        status: 'critical',
        message: `Connection failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async checkDataFreshness(): Promise<ComponentHealth> {
    if (!this.redisClient) {
      return {
        status: 'critical',
        message: 'Redis not available',
      };
    }

    try {
      const candles = await this.redisClient.zRange('eurusd:realtime', -1, -1);

      if (!candles || candles.length === 0) {
        this.addAlert('CRITICAL: No data found in Redis');
        return {
          status: 'critical',
          message: 'No data in Redis',
        };
      }

      const candleData = JSON.parse(candles[0]);
      const candleTime = new Date(candleData.t * 1000);
      const now = new Date();
      const ageSeconds = Math.floor((now.getTime() - candleTime.getTime()) / 1000);

      let status: 'healthy' | 'warning' | 'critical';
      let message: string;

      if (ageSeconds > 300) {
        // >5 minutes
        status = 'critical';
        message = `Data is stale (${ageSeconds}s old)`;
        this.addAlert(`CRITICAL: Data is ${ageSeconds}s old (expected <120s)`);
      } else if (ageSeconds > 120) {
        // >2 minutes
        status = 'warning';
        message = `Data is aging (${ageSeconds}s old)`;
        this.addAlert(`WARNING: Data is ${ageSeconds}s old (expected <120s)`);
      } else {
        status = 'healthy';
        message = `Data is fresh (${ageSeconds}s old)`;
      }

      return {
        status,
        message,
        metrics: {
          age_seconds: ageSeconds,
          last_update: candleTime.toISOString(),
        },
      };
    } catch (error) {
      this.addAlert(`Data freshness check failed: ${error instanceof Error ? error.message : String(error)}`);
      return {
        status: 'critical',
        message: `Check failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async checkDataIntegrity(): Promise<ComponentHealth> {
    try {
      // Check for NULL values
      const nullCheck: Array<{ count: bigint }> = await this.prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM eurusd_m5
        WHERE open IS NULL OR high IS NULL OR low IS NULL OR close IS NULL
      `;
      const nullCount = Number(nullCheck[0].count);

      // Check for anomalies
      const anomalyCheck: Array<{ count: bigint }> = await this.prisma.$queryRaw`
        SELECT COUNT(*) as count
        FROM eurusd_m5
        WHERE high < low OR open < 0 OR close < 0
      `;
      const anomalyCount = Number(anomalyCheck[0].count);

      let status: 'healthy' | 'warning' | 'critical';
      let message: string;

      if (nullCount > 0 || anomalyCount > 0) {
        status = 'critical';
        message = `Data integrity issues: ${nullCount} NULL values, ${anomalyCount} anomalies`;
        this.addAlert(`CRITICAL: Data integrity issues detected`);
      } else {
        status = 'healthy';
        message = 'Data integrity verified';
      }

      return {
        status,
        message,
        metrics: {
          null_count: nullCount,
          anomaly_count: anomalyCount,
        },
      };
    } catch (error) {
      return {
        status: 'warning',
        message: `Integrity check failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async performHealthCheck(): Promise<HealthStatus> {
    console.log('═══════════════════════════════════════════════════════');
    console.log(`Health Check - ${new Date().toISOString()}`);
    console.log('═══════════════════════════════════════════════════════\n');

    const redis = await this.checkRedisHealth();
    console.log(`🔴 Redis: ${redis.status.toUpperCase()} - ${redis.message}`);
    if (redis.metrics) {
      console.log(`   Metrics: ${JSON.stringify(redis.metrics)}`);
    }

    const postgresql = await this.checkPostgreSQLHealth();
    console.log(`🐘 PostgreSQL: ${postgresql.status.toUpperCase()} - ${postgresql.message}`);
    if (postgresql.metrics) {
      console.log(`   Metrics: ${JSON.stringify(postgresql.metrics)}`);
    }

    const dataFreshness = await this.checkDataFreshness();
    console.log(`⏰ Data Freshness: ${dataFreshness.status.toUpperCase()} - ${dataFreshness.message}`);
    if (dataFreshness.metrics) {
      console.log(`   Metrics: ${JSON.stringify(dataFreshness.metrics)}`);
    }

    const dataIntegrity = await this.checkDataIntegrity();
    console.log(`✓  Data Integrity: ${dataIntegrity.status.toUpperCase()} - ${dataIntegrity.message}`);
    if (dataIntegrity.metrics) {
      console.log(`   Metrics: ${JSON.stringify(dataIntegrity.metrics)}`);
    }

    // Determine overall status
    const statuses = [redis.status, postgresql.status, dataFreshness.status, dataIntegrity.status];
    let overall: 'healthy' | 'degraded' | 'critical';

    if (statuses.includes('critical')) {
      overall = 'critical';
    } else if (statuses.includes('warning')) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    console.log('\n───────────────────────────────────────────────────────');
    console.log(`Overall Status: ${overall.toUpperCase()}`);

    if (this.alerts.length > 0) {
      console.log(`\nAlerts (${this.alerts.length}):`);
      this.alerts.forEach((alert, idx) => {
        console.log(`  ${idx + 1}. ${alert}`);
      });
    }

    console.log('═══════════════════════════════════════════════════════\n');

    return {
      timestamp: new Date().toISOString(),
      overall,
      components: {
        redis,
        postgresql,
        dataFreshness,
        dataIntegrity,
      },
      alerts: this.alerts,
    };
  }

  async run(): Promise<void> {
    await this.initialize();

    try {
      const status = await this.performHealthCheck();

      // Exit with appropriate code
      if (status.overall === 'critical') {
        process.exit(2);
      } else if (status.overall === 'degraded') {
        process.exit(1);
      } else {
        process.exit(0);
      }
    } catch (error) {
      console.error('Fatal error during health check:', error);
      process.exit(3);
    } finally {
      await this.cleanup();
    }
  }
}

// Main execution
async function main() {
  const monitor = new PipelineHealthMonitor();
  await monitor.run();
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(3);
});
