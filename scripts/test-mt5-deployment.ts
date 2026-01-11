#!/usr/bin/env tsx
/**
 * MT5 to PostgreSQL Deployment Testing Suite
 * Part 20 - Post-Sync Script Deployment Verification
 *
 * This script verifies the complete data pipeline:
 * SQLite (MT5) → Sync Script → Redis (Hot) + PostgreSQL (Warm)
 */

import { createClient } from 'redis';
import { PrismaClient, Prisma } from '@prisma/client';

interface TestResult {
  test: string;
  passed: boolean;
  message: string;
  metrics?: Record<string, any>;
}

class DeploymentTester {
  private redisClient: any;
  private prisma: PrismaClient;
  private results: TestResult[] = [];

  constructor() {
    this.prisma = new PrismaClient();
  }

  async initialize(): Promise<void> {
    // Initialize Redis connection
    if (process.env['REDIS_URL']) {
      this.redisClient = createClient({ url: process.env['REDIS_URL'] });
      await this.redisClient.connect();
    }
  }

  async cleanup(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.disconnect();
    }
    await this.prisma.$disconnect();
  }

  private addResult(test: string, passed: boolean, message: string, metrics?: Record<string, any>): void {
    this.results.push({ test, passed, message, metrics });
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${test}: ${message}`);
    if (metrics) {
      console.log('   Metrics:', JSON.stringify(metrics, null, 2));
    }
  }

  // Test 1: Redis Connection and Hot Tier
  async testRedisHotTier(): Promise<void> {
    console.log('\n━━━ Testing Redis Hot Tier ━━━');

    if (!this.redisClient) {
      this.addResult('Redis Connection', false, 'REDIS_URL not configured');
      return;
    }

    try {
      // Test PING
      const pingStart = Date.now();
      const ping = await this.redisClient.ping();
      const pingTime = Date.now() - pingStart;

      this.addResult(
        'Redis PING',
        ping === 'PONG',
        `Response: ${ping} (${pingTime}ms)`,
        { latency_ms: pingTime }
      );

      // Check symbol candle counts
      const symbols = [
        'audjpy', 'audusd', 'btcusd', 'ethusd', 'eurusd',
        'gbpjpy', 'gbpusd', 'ndx100', 'nzdusd', 'us30',
        'usdcad', 'usdchf', 'usdjpy', 'xagusd', 'xauusd'
      ];

      let totalCandles = 0;
      let symbolsWithData = 0;

      for (const symbol of symbols) {
        const key = `${symbol}:realtime`;
        const count = await this.redisClient.zCard(key);
        const ttl = await this.redisClient.ttl(key);

        if (count > 0) {
          symbolsWithData++;
          totalCandles += count;
        }

        // Each symbol should have ~250 candles
        const passed = count > 200 && count <= 250;
        this.addResult(
          `Redis ${symbol.toUpperCase()}`,
          passed,
          `${count} candles (TTL: ${ttl}s)`,
          { candles: count, ttl_seconds: ttl }
        );
      }

      // Summary
      this.addResult(
        'Redis Hot Tier Summary',
        symbolsWithData === symbols.length,
        `${symbolsWithData}/${symbols.length} symbols populated`,
        { total_candles: totalCandles, avg_candles: Math.round(totalCandles / symbols.length) }
      );

      // Test candle data format
      const testKey = 'eurusd:realtime';
      const latestCandles = await this.redisClient.zRange(testKey, -1, -1);

      if (latestCandles && latestCandles.length > 0) {
        const candleData = JSON.parse(latestCandles[0]);
        const requiredFields = ['t', 'o', 'h', 'l', 'c'];
        const hasAllFields = requiredFields.every(field => field in candleData);

        this.addResult(
          'Redis Candle Format',
          hasAllFields,
          hasAllFields ? 'All required fields present' : 'Missing required fields',
          { sample: candleData }
        );
      }

      // Test query performance
      const perfIterations = 100;
      const perfStart = Date.now();

      for (let i = 0; i < perfIterations; i++) {
        await this.redisClient.zRange('eurusd:realtime', -100, -1);
      }

      const avgTime = (Date.now() - perfStart) / perfIterations;
      this.addResult(
        'Redis Query Performance',
        avgTime < 5,
        `Average: ${avgTime.toFixed(2)}ms (target: <5ms)`,
        { avg_ms: avgTime, iterations: perfIterations }
      );

    } catch (error) {
      this.addResult('Redis Tests', false, `Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Test 2: PostgreSQL Warm Tier
  async testPostgreSQLWarmTier(): Promise<void> {
    console.log('\n━━━ Testing PostgreSQL Warm Tier ━━━');

    try {
      // Test connection
      await this.prisma.$queryRaw`SELECT 1 as test`;
      this.addResult('PostgreSQL Connection', true, 'Connection successful');

      // Count indicator tables
      const tables: Array<{ tablename: string }> = await this.prisma.$queryRaw`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename ~ '^(audjpy|audusd|btcusd|ethusd|eurusd|gbpjpy|gbpusd|ndx100|nzdusd|us30|usdcad|usdchf|usdjpy|xagusd|xauusd)_'
      `;

      const expectedTables = 135; // 15 symbols × 9 timeframes
      this.addResult(
        'PostgreSQL Tables',
        tables.length === expectedTables,
        `Found ${tables.length}/${expectedTables} tables`,
        { table_count: tables.length, expected: expectedTables }
      );

      // Test timeframe data for EURUSD
      const timeframes = ['m5', 'm15', 'm30', 'h1', 'h2', 'h4', 'h8', 'h12', 'd1'];
      const timeframeData: Record<string, number> = {};

      for (const tf of timeframes) {
        const tableName = `eurusd_${tf}`;
        try {
          const result: Array<{ count: bigint }> = await this.prisma.$queryRawUnsafe(
            `SELECT COUNT(*) as count FROM ${tableName}`
          );
          const count = result && result[0] ? Number(result[0].count) : 0;
          timeframeData[tf] = count;

          // Verify row count is reasonable (should decrease with larger timeframes)
          this.addResult(
            `PostgreSQL eurusd_${tf}`,
            count > 0 && count <= 10000,
            `${count} rows`,
            { rows: count }
          );
        } catch (error) {
          this.addResult(
            `PostgreSQL eurusd_${tf}`,
            false,
            `Table missing or error: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      // Test data integrity on eurusd_m5
      try {
        const nullCheck: Array<{ count: bigint }> = await this.prisma.$queryRaw`
          SELECT COUNT(*) as count
          FROM eurusd_m5
          WHERE open IS NULL OR high IS NULL OR low IS NULL OR close IS NULL
        `;
        const nullCount = nullCheck && nullCheck[0] ? Number(nullCheck[0].count) : 0;

        this.addResult(
          'Data Integrity (NULL check)',
          nullCount === 0,
          nullCount === 0 ? 'No NULL values found' : `Found ${nullCount} NULL values`,
          { null_count: nullCount }
        );

        // Check for price anomalies
        const anomalyCheck: Array<{ count: bigint }> = await this.prisma.$queryRaw`
          SELECT COUNT(*) as count
          FROM eurusd_m5
          WHERE high < low OR open < 0 OR close < 0
        `;
        const anomalyCount = anomalyCheck && anomalyCheck[0] ? Number(anomalyCheck[0].count) : 0;

        this.addResult(
          'Data Integrity (Anomaly check)',
          anomalyCount === 0,
          anomalyCount === 0 ? 'No anomalies found' : `Found ${anomalyCount} anomalies`,
          { anomaly_count: anomalyCount }
        );
      } catch (error) {
        this.addResult('Data Integrity', false, `Error: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Test query performance
      const perfStart = Date.now();
      await this.prisma.$queryRaw`
        SELECT * FROM eurusd_m5 ORDER BY timestamp DESC LIMIT 100
      `;
      const queryTime = Date.now() - perfStart;

      this.addResult(
        'PostgreSQL Query Performance',
        queryTime < 50,
        `Query time: ${queryTime}ms (target: <50ms)`,
        { query_time_ms: queryTime }
      );

    } catch (error) {
      this.addResult('PostgreSQL Tests', false, `Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Test 3: Data Freshness
  async testDataFreshness(): Promise<void> {
    console.log('\n━━━ Testing Data Freshness ━━━');

    if (!this.redisClient) {
      this.addResult('Data Freshness', false, 'Redis not available');
      return;
    }

    try {
      const candles = await this.redisClient.zRange('eurusd:realtime', -1, -1);

      if (candles && candles.length > 0) {
        const candleData = JSON.parse(candles[0]);
        const candleTime = new Date(candleData.t * 1000);
        const now = new Date();
        const ageSeconds = Math.floor((now.getTime() - candleTime.getTime()) / 1000);

        this.addResult(
          'Data Freshness',
          ageSeconds < 120,
          `Latest candle: ${candleTime.toISOString()} (${ageSeconds}s old)`,
          { age_seconds: ageSeconds, candle_timestamp: candleTime.toISOString() }
        );
      } else {
        this.addResult('Data Freshness', false, 'No data in Redis');
      }
    } catch (error) {
      this.addResult('Data Freshness', false, `Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Test 4: End-to-End Data Flow
  async testEndToEndFlow(): Promise<void> {
    console.log('\n━━━ Testing End-to-End Data Flow ━━━');

    const testSymbol = 'eurusd';

    // Check Redis
    let redisCandles = 0;
    if (this.redisClient) {
      redisCandles = await this.redisClient.zCard(`${testSymbol}:realtime`);
    }

    // Check PostgreSQL
    let pgRows = 0;
    try {
      const result: Array<{ count: bigint }> = await this.prisma.$queryRaw`
        SELECT COUNT(*) as count FROM eurusd_m5
      `;
      pgRows = result && result[0] ? Number(result[0].count) : 0;
    } catch (error) {
      // Table might not exist
    }

    const hasRedisData = redisCandles > 0;
    const hasPgData = pgRows > 0;

    this.addResult(
      'E2E Data Flow',
      hasRedisData && hasPgData,
      hasRedisData && hasPgData
        ? 'Data present in both Redis and PostgreSQL'
        : 'Data missing in one or both tiers',
      {
        redis_candles: redisCandles,
        postgresql_rows: pgRows,
        redis_ok: hasRedisData,
        postgresql_ok: hasPgData
      }
    );
  }

  // Generate summary report
  generateReport(): void {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 DEPLOYMENT TEST SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const total = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const failed = total - passed;
    const passRate = Math.round((passed / total) * 100);

    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);
    console.log(`Pass Rate: ${passRate}%`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`   • ${r.test}: ${r.message}`);
        });
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (passRate === 100) {
      console.log('✅ All tests passed! Deployment is successful.');
    } else if (passRate >= 80) {
      console.log('⚠️  Most tests passed, but some issues need attention.');
    } else {
      console.log('❌ Multiple tests failed. Deployment verification incomplete.');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  async runAllTests(): Promise<void> {
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║  MT5 to PostgreSQL Deployment Testing Suite          ║');
    console.log('║  Part 20 - Post-Sync Script Deployment               ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    await this.initialize();

    try {
      await this.testRedisHotTier();
      await this.testPostgreSQLWarmTier();
      await this.testDataFreshness();
      await this.testEndToEndFlow();
    } catch (error) {
      console.error('Fatal error during testing:', error);
    } finally {
      await this.cleanup();
    }

    this.generateReport();
  }
}

// Main execution
async function main() {
  const tester = new DeploymentTester();
  await tester.runAllTests();
}

main().catch(console.error);
