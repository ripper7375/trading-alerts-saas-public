#!/usr/bin/env tsx
/**
 * Sync Package Deployment Verification
 * Part 20 - Verify sync script deployment and configuration
 *
 * This script verifies that the sync package is properly deployed
 * and configured on the Contabo VPS (via SSH or API calls)
 */

import * as fs from 'fs';
import * as path from 'path';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';

interface VerificationResult {
  category: string;
  checks: Array<{
    name: string;
    passed: boolean;
    message: string;
    critical: boolean;
  }>;
}

class SyncDeploymentVerifier {
  private redisClient: ReturnType<typeof createClient> | undefined;
  private prisma: PrismaClient;
  private results: VerificationResult[] = [];

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env['DATABASE_URL'],
      ssl: { rejectUnauthorized: false },
    });
    this.prisma = new PrismaClient({ adapter });
  }

  async initialize(): Promise<void> {
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

  private addCheck(
    category: string,
    name: string,
    passed: boolean,
    message: string,
    critical: boolean = false
  ): void {
    let categoryResult = this.results.find((r) => r.category === category);

    if (!categoryResult) {
      categoryResult = { category, checks: [] };
      this.results.push(categoryResult);
    }

    categoryResult.checks.push({ name, passed, message, critical });

    const icon = passed ? '✅' : critical ? '🔴' : '⚠️';
    console.log(`${icon} ${name}: ${message}`);
  }

  // Verify local sync package files
  verifyLocalSyncPackage(): void {
    console.log('\n━━━ Verifying Local Sync Package ━━━');

    const syncDir = path.join(process.cwd(), 'sync');
    const requiredFiles = [
      'config.py',
      'db_connections.py',
      'sync_to_postgresql.py',
      'timeframe_filter.py',
      'requirements.txt',
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(syncDir, file);
      const exists = fs.existsSync(filePath);

      this.addCheck(
        'Local Sync Package',
        file,
        exists,
        exists ? 'File exists' : 'File missing',
        true
      );

      if (exists) {
        const stats = fs.statSync(filePath);
        const size = stats.size;
        console.log(
          `   Size: ${size} bytes, Modified: ${stats.mtime.toISOString()}`
        );
      }
    }
  }

  // Verify environment configuration
  verifyEnvironmentConfig(): void {
    console.log('\n━━━ Verifying Environment Configuration ━━━');

    const requiredEnvVars = [
      'POSTGRESQL_URI',
      'REDIS_URL',
      'DATABASE_URL', // For Prisma
    ];

    const optionalEnvVars = ['SQLITE_PATH', 'ENABLE_REDIS_SYNC', 'LOG_LEVEL'];

    // Check required vars
    for (const varName of requiredEnvVars) {
      const exists = !!process.env[varName];
      const value = exists ? process.env[varName] : '';
      const masked = exists ? value!.substring(0, 20) + '...' : '';

      this.addCheck(
        'Environment Variables',
        varName,
        exists,
        exists ? `Set (${masked})` : 'Not set',
        true
      );
    }

    // Check optional vars
    for (const varName of optionalEnvVars) {
      const exists = !!process.env[varName];
      const value = exists ? process.env[varName] : '';

      this.addCheck(
        'Environment Variables',
        varName,
        true,
        exists ? `Set (${value})` : 'Not set (optional)',
        false
      );
    }
  }

  // Test database connections
  async testDatabaseConnections(): Promise<void> {
    console.log('\n━━━ Testing Database Connections ━━━');

    // Test PostgreSQL
    try {
      const result: Array<{ version: string }> = await this.prisma
        .$queryRaw`SELECT version()`;
      const version = result && result[0] ? result[0].version : 'Unknown';

      this.addCheck(
        'Database Connections',
        'PostgreSQL',
        true,
        `Connected: ${version.substring(0, 50)}...`,
        true
      );
    } catch (error) {
      this.addCheck(
        'Database Connections',
        'PostgreSQL',
        false,
        `Connection failed: ${error instanceof Error ? error.message : String(error)}`,
        true
      );
    }

    // Test Redis
    if (this.redisClient) {
      try {
        const pong = await this.redisClient.ping();
        const info = await this.redisClient.info();
        const redisVersion =
          info.match(/redis_version:(\S+)/)?.[1] || 'unknown';

        this.addCheck(
          'Database Connections',
          'Redis',
          pong === 'PONG',
          `Connected: Redis ${redisVersion}`,
          true
        );
      } catch (error) {
        this.addCheck(
          'Database Connections',
          'Redis',
          false,
          `Connection failed: ${error instanceof Error ? error.message : String(error)}`,
          true
        );
      }
    } else {
      this.addCheck(
        'Database Connections',
        'Redis',
        false,
        'REDIS_URL not configured',
        true
      );
    }
  }

  // Verify database schema
  async verifyDatabaseSchema(): Promise<void> {
    console.log('\n━━━ Verifying Database Schema ━━━');

    try {
      // Check for indicator tables
      const tables: Array<{ tablename: string }> = await this.prisma.$queryRaw`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename ~ '^(audjpy|audusd|btcusd|ethusd|eurusd|gbpjpy|gbpusd|ndx100|nzdusd|us30|usdcad|usdchf|usdjpy|xagusd|xauusd)_'
      `;

      const expectedTables = 135; // 15 symbols × 9 timeframes
      const tableCount = tables.length;

      this.addCheck(
        'Database Schema',
        'Indicator Tables',
        tableCount === expectedTables,
        `Found ${tableCount}/${expectedTables} tables`,
        false
      );

      // Check for market_data table (raw data)
      const marketDataCheck: Array<{ exists: boolean }> = await this.prisma
        .$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'market_data'
        ) as exists
      `;

      this.addCheck(
        'Database Schema',
        'market_data table',
        marketDataCheck && marketDataCheck[0]
          ? marketDataCheck[0].exists
          : false,
        marketDataCheck && marketDataCheck[0] && marketDataCheck[0].exists
          ? 'Table exists'
          : 'Table missing',
        false
      );

      // Verify table structure for eurusd_m5
      const columns: Array<{ column_name: string }> = await this.prisma
        .$queryRaw`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'eurusd_m5'
        ORDER BY ordinal_position
      `;

      const requiredColumns = ['timestamp', 'open', 'high', 'low', 'close'];
      const hasAllColumns = requiredColumns.every((col) =>
        columns.some((c) => c.column_name === col)
      );

      this.addCheck(
        'Database Schema',
        'eurusd_m5 columns',
        hasAllColumns,
        hasAllColumns
          ? `All required columns present (${columns.length} total)`
          : 'Missing required columns',
        true
      );
    } catch (error) {
      this.addCheck(
        'Database Schema',
        'Schema verification',
        false,
        `Error: ${error instanceof Error ? error.message : String(error)}`,
        false
      );
    }
  }

  // Verify Redis data structure
  async verifyRedisDataStructure(): Promise<void> {
    console.log('\n━━━ Verifying Redis Data Structure ━━━');

    if (!this.redisClient) {
      this.addCheck(
        'Redis Data Structure',
        'Redis check',
        false,
        'Redis not available',
        true
      );
      return;
    }

    try {
      const symbols = ['eurusd', 'btcusd', 'xauusd'];
      let validSymbols = 0;

      for (const symbol of symbols) {
        const key = `${symbol}:realtime`;
        const exists = (await this.redisClient.exists(key)) === 1;

        if (exists) {
          const count = await this.redisClient.zCard(key);
          const ttl = await this.redisClient.ttl(key);

          validSymbols++;

          this.addCheck(
            'Redis Data Structure',
            `${symbol} key`,
            count > 0,
            `${count} candles, TTL: ${ttl}s`,
            false
          );

          // Check data format
          if (count > 0) {
            const sample = await this.redisClient.zRange(key, -1, -1);
            if (sample && sample.length > 0) {
              const data = JSON.parse(sample[0]!);
              const hasRequiredFields = ['t', 'o', 'h', 'l', 'c'].every(
                (field) => field in data
              );

              this.addCheck(
                'Redis Data Structure',
                `${symbol} format`,
                hasRequiredFields,
                hasRequiredFields ? 'Valid OHLC format' : 'Invalid format',
                false
              );
            }
          }
        } else {
          this.addCheck(
            'Redis Data Structure',
            `${symbol} key`,
            false,
            'Key does not exist',
            false
          );
        }
      }

      this.addCheck(
        'Redis Data Structure',
        'Overall',
        validSymbols === symbols.length,
        `${validSymbols}/${symbols.length} symbols configured`,
        false
      );
    } catch (error) {
      this.addCheck(
        'Redis Data Structure',
        'Redis verification',
        false,
        `Error: ${error instanceof Error ? error.message : String(error)}`,
        false
      );
    }
  }

  // Generate report
  generateReport(): void {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 DEPLOYMENT VERIFICATION SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    for (const result of this.results) {
      const total = result.checks.length;
      const passed = result.checks.filter((c) => c.passed).length;
      const critical = result.checks.filter(
        (c) => c.critical && !c.passed
      ).length;

      console.log(`\n${result.category}:`);
      console.log(`  Total checks: ${total}`);
      console.log(`  Passed: ${passed} ✅`);
      console.log(`  Failed: ${total - passed} ❌`);
      if (critical > 0) {
        console.log(`  Critical failures: ${critical} 🔴`);
      }

      // List failures
      const failures = result.checks.filter((c) => !c.passed);
      if (failures.length > 0) {
        console.log('  Failed checks:');
        failures.forEach((check) => {
          const marker = check.critical ? '🔴' : '⚠️';
          console.log(`    ${marker} ${check.name}: ${check.message}`);
        });
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const allChecks = this.results.flatMap((r) => r.checks);
    const totalChecks = allChecks.length;
    const totalPassed = allChecks.filter((c) => c.passed).length;
    const criticalFailures = allChecks.filter(
      (c) => c.critical && !c.passed
    ).length;

    console.log(`\nOverall: ${totalPassed}/${totalChecks} checks passed`);

    if (criticalFailures > 0) {
      console.log(
        `🔴 ${criticalFailures} CRITICAL FAILURES - Deployment not ready`
      );
    } else if (totalPassed === totalChecks) {
      console.log('✅ All checks passed - Deployment verified');
    } else {
      console.log(
        '⚠️  Some non-critical checks failed - Review before proceeding'
      );
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  async runVerification(): Promise<void> {
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║  Sync Package Deployment Verification                ║');
    console.log('║  Part 20 - MT5 to PostgreSQL Pipeline                ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    await this.initialize();

    try {
      this.verifyLocalSyncPackage();
      this.verifyEnvironmentConfig();
      await this.testDatabaseConnections();
      await this.verifyDatabaseSchema();
      await this.verifyRedisDataStructure();
    } catch (error) {
      console.error('Fatal error during verification:', error);
    } finally {
      await this.cleanup();
    }

    this.generateReport();
  }
}

// Main execution
async function main() {
  const verifier = new SyncDeploymentVerifier();
  await verifier.runVerification();
}

main().catch(console.error);
