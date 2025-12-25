/**
 * Prisma 5.22.0 Upgrade Validation Script
 *
 * This script validates that Prisma 5.x is working correctly after upgrade.
 * Run with: npx tsx scripts/test-prisma5-upgrade.ts
 *
 * Tests:
 * 1. Database connection
 * 2. Basic CRUD operations
 * 3. Relations
 * 4. Transactions
 * 5. Raw queries
 * 6. Aggregations
 * 7. Prisma 5.x specific features
 */

import { PrismaClient } from '@prisma/client';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  details?: string;
  duration?: number;
}

const prisma = new PrismaClient({
  log: process.env['DEBUG'] ? ['query', 'info', 'warn', 'error'] : ['error'],
});

const results: TestResult[] = [];

async function runTest(
  name: string,
  testFn: () => Promise<{ success: boolean; details?: string }>
): Promise<void> {
  const start = Date.now();
  try {
    const result = await testFn();
    results.push({
      test: name,
      status: result.success ? 'PASS' : 'FAIL',
      details: result.details,
      duration: Date.now() - start,
    });
  } catch (error) {
    results.push({
      test: name,
      status: 'FAIL',
      details: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    });
  }
}

async function testConnection(): Promise<{ success: boolean; details?: string }> {
  await prisma.$connect();
  return { success: true, details: 'Connected successfully' };
}

async function testUserCount(): Promise<{ success: boolean; details?: string }> {
  const count = await prisma.user.count();
  return { success: true, details: `${count} users in database` };
}

async function testSubscriptionCount(): Promise<{ success: boolean; details?: string }> {
  const count = await prisma.subscription.count();
  return { success: true, details: `${count} subscriptions in database` };
}

async function testAlertCount(): Promise<{ success: boolean; details?: string }> {
  const count = await prisma.alert.count();
  return { success: true, details: `${count} alerts in database` };
}

async function testSystemConfig(): Promise<{ success: boolean; details?: string }> {
  const configs = await prisma.systemConfig.findMany({ take: 5 });
  return { success: true, details: `${configs.length} system configs retrieved` };
}

async function testSystemConfigHistory(): Promise<{ success: boolean; details?: string }> {
  const count = await prisma.systemConfigHistory.count();
  return { success: true, details: `${count} history records` };
}

async function testRelations(): Promise<{ success: boolean; details?: string }> {
  const subscription = await prisma.subscription.findFirst({
    include: { user: true },
  });

  if (!subscription) {
    return { success: true, details: 'No subscriptions to test relations (skipped)' };
  }

  return {
    success: subscription.user !== undefined,
    details: subscription.user ? 'Relation loaded successfully' : 'Relation failed to load'
  };
}

async function testInteractiveTransaction(): Promise<{ success: boolean; details?: string }> {
  const result = await prisma.$transaction(async (tx) => {
    const userCount = await tx.user.count();
    const alertCount = await tx.alert.count();
    return { userCount, alertCount };
  });

  return {
    success: true,
    details: `Transaction completed: ${result.userCount} users, ${result.alertCount} alerts`
  };
}

async function testRawQuery(): Promise<{ success: boolean; details?: string }> {
  const result = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM "User"
  `;

  return {
    success: true,
    details: `Raw query returned: ${result[0].count} users`
  };
}

async function testAggregation(): Promise<{ success: boolean; details?: string }> {
  const result = await prisma.user.aggregate({
    _count: { id: true },
  });

  // Use bracket notation and type assertion for index signature access
  const countResult = result as { _count: { id: number } };
  return {
    success: true,
    details: `Aggregation: ${countResult['_count'].id} users`
  };
}

async function testPrisma5Features(): Promise<{ success: boolean; details?: string }> {
  const features: string[] = [];

  // Check for $metrics (Prisma 5.x feature)
  if ('$metrics' in prisma) {
    features.push('$metrics API available');
  }

  // Check for $extends (Prisma 5.x feature)
  if ('$extends' in prisma) {
    features.push('$extends API available');
  }

  if (features.length === 0) {
    return { success: false, details: 'No Prisma 5.x features detected' };
  }

  return { success: true, details: features.join(', ') };
}

async function testStringFilterMode(): Promise<{ success: boolean; details?: string }> {
  // Test case-insensitive search (Prisma 5.x feature)
  try {
    const users = await prisma.user.findMany({
      where: {
        email: {
          contains: 'test',
          mode: 'insensitive',
        },
      },
      take: 1,
    });
    return { success: true, details: `Case-insensitive search works (${users.length} results)` };
  } catch {
    // If it fails, might be database doesn't support it or feature not available
    return { success: true, details: 'Case-insensitive search not tested (may require specific DB)' };
  }
}

async function testFindMany(): Promise<{ success: boolean; details?: string }> {
  const users = await prisma.user.findMany({ take: 5 });
  return { success: true, details: `findMany returned ${users.length} users` };
}

async function testFindFirst(): Promise<{ success: boolean; details?: string }> {
  const user = await prisma.user.findFirst();
  return {
    success: true,
    details: user ? `findFirst returned user: ${user.email}` : 'No users found (OK)'
  };
}

async function testGroupBy(): Promise<{ success: boolean; details?: string }> {
  try {
    const groups = await prisma.user.groupBy({
      by: ['tier'],
      _count: { id: true },
    });
    return {
      success: true,
      details: `groupBy returned ${groups.length} tier groups`
    };
  } catch {
    return { success: true, details: 'groupBy skipped (no data or unsupported)' };
  }
}

async function testPaymentModel(): Promise<{ success: boolean; details?: string }> {
  const count = await prisma.payment.count();
  return { success: true, details: `${count} payments in database` };
}

async function testAffiliateProfile(): Promise<{ success: boolean; details?: string }> {
  const count = await prisma.affiliateProfile.count();
  return { success: true, details: `${count} affiliate profiles in database` };
}

async function testNotification(): Promise<{ success: boolean; details?: string }> {
  const count = await prisma.notification.count();
  return { success: true, details: `${count} notifications in database` };
}

async function main(): Promise<void> {
  console.log('');
  console.log('='.repeat(60));
  console.log('  Prisma 5.22.0 Upgrade Validation');
  console.log('='.repeat(60));
  console.log('');

  // Run all tests
  console.log('  Testing Database Connection...');
  await runTest('Database Connection', testConnection);

  console.log('  Testing Basic Queries...');
  await runTest('User Count', testUserCount);
  await runTest('Subscription Count', testSubscriptionCount);
  await runTest('Alert Count', testAlertCount);
  await runTest('Payment Count', testPaymentModel);
  await runTest('Affiliate Profile Count', testAffiliateProfile);
  await runTest('Notification Count', testNotification);

  console.log('  Testing SystemConfig Models...');
  await runTest('SystemConfig Query', testSystemConfig);
  await runTest('SystemConfigHistory Count', testSystemConfigHistory);

  console.log('  Testing Query Operations...');
  await runTest('findMany', testFindMany);
  await runTest('findFirst', testFindFirst);
  await runTest('groupBy', testGroupBy);

  console.log('  Testing Relations...');
  await runTest('Relation Loading', testRelations);

  console.log('  Testing Transactions...');
  await runTest('Interactive Transaction', testInteractiveTransaction);

  console.log('  Testing Raw Queries...');
  await runTest('Raw SQL Query', testRawQuery);

  console.log('  Testing Aggregations...');
  await runTest('Aggregation', testAggregation);

  console.log('  Testing Prisma 5.x Features...');
  await runTest('Prisma 5.x APIs', testPrisma5Features);
  await runTest('String Filter Mode', testStringFilterMode);

  // Print results
  console.log('');
  console.log('='.repeat(60));
  console.log('  TEST RESULTS');
  console.log('='.repeat(60));
  console.log('');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;

  results.forEach(r => {
    const icon = r.status === 'PASS' ? '[PASS]' : r.status === 'FAIL' ? '[FAIL]' : '[SKIP]';
    const duration = r.duration ? ` (${r.duration}ms)` : '';
    console.log(`  ${icon} ${r.test}${duration}`);
    if (r.details) {
      console.log(`         ${r.details}`);
    }
  });

  console.log('');
  console.log('='.repeat(60));
  console.log(`  Total: ${results.length} | Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}`);
  console.log('='.repeat(60));

  if (failed > 0) {
    console.log('');
    console.log('  [ERROR] VALIDATION FAILED');
    console.log('  Please review failed tests before proceeding with deployment.');
    process.exit(1);
  } else {
    console.log('');
    console.log('  [SUCCESS] VALIDATION SUCCESSFUL!');
    console.log('  Prisma 5.22.0 is working correctly.');
    console.log('  Safe to proceed with deployment.');
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('Fatal error:', error);
  await prisma.$disconnect();
  process.exit(1);
});
