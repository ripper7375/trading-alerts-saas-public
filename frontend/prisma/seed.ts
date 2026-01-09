import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Database Seed Script for Trading Alerts SaaS
 *
 * Creates initial admin user for development and production setup
 * Uses environment variables for configuration
 * Follows security best practices with bcrypt hashing
 */

async function main() {
  console.log('🌱 Starting database seed...');

  // Get admin credentials from environment variables
  const adminEmail = process.env['ADMIN_EMAIL'] || 'admin@tradingalerts.com';
  const adminPassword = process.env['ADMIN_PASSWORD'] || 'ChangeMe123!';
  const adminName = process.env['ADMIN_NAME'] || 'Admin User';

  // Validate environment variables
  if (!adminEmail || !adminPassword) {
    throw new Error(
      'ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required'
    );
  }

  // Hash password using bcrypt with 10 rounds (industry standard)
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  try {
    // Create or upsert admin user
    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        name: adminName,
        password: hashedPassword,
        tier: 'PRO', // Admin gets PRO tier
        role: 'ADMIN',
        emailVerified: new Date(), // Admin email is pre-verified
        isActive: true,
        hasUsedStripeTrial: false,
        hasUsedThreeDayPlan: false,
      },
      create: {
        email: adminEmail,
        name: adminName,
        password: hashedPassword,
        tier: 'PRO', // Admin gets PRO tier
        role: 'ADMIN',
        emailVerified: new Date(), // Admin email is pre-verified
        isActive: true,
        hasUsedStripeTrial: false,
        hasUsedThreeDayPlan: false,
      },
      select: {
        id: true,
        email: true,
        name: true,
        tier: true,
        role: true,
        createdAt: true,
      },
    });

    console.log('✅ Admin user created successfully:');
    console.log(`   Email: ${admin.email}`);
    console.log(`   Name: ${admin.name}`);
    console.log(`   Tier: ${admin.tier}`);
    console.log(`   Role: ${admin.role}`);
    console.log(`   Created: ${admin.createdAt.toISOString()}`);

    // Create E2E test users (only in development)
    if (process.env['NODE_ENV'] !== 'production') {
      const testUsers = [
        {
          email: 'free-test@trading-alerts.test',
          password: 'TestPassword123!',
          name: 'Free Test User',
          tier: 'FREE' as const,
          role: 'USER' as const,
        },
        {
          email: 'pro-test@trading-alerts.test',
          password: 'TestPassword123!',
          name: 'Pro Test User',
          tier: 'PRO' as const,
          role: 'USER' as const,
        },
        {
          email: 'admin-test@trading-alerts.test',
          password: 'AdminPassword123!',
          name: 'Admin Test User',
          tier: 'PRO' as const,
          role: 'ADMIN' as const,
        },
        {
          email: 'affiliate-test@trading-alerts.test',
          password: 'AffiliatePassword123!',
          name: 'Affiliate Test User',
          tier: 'FREE' as const,
          role: 'USER' as const,
        },
        {
          email: 'unverified@trading-alerts.test',
          password: 'TestPassword123!',
          name: 'Unverified Test User',
          tier: 'FREE' as const,
          role: 'USER' as const,
          emailVerified: false,
        },
      ];

      for (const testUser of testUsers) {
        const hashedTestPassword = await bcrypt.hash(testUser.password, 10);
        await prisma.user.upsert({
          where: { email: testUser.email },
          update: {
            name: testUser.name,
            password: hashedTestPassword,
            tier: testUser.tier,
            role: testUser.role,
            emailVerified: testUser.emailVerified === false ? null : new Date(),
            isActive: true,
          },
          create: {
            email: testUser.email,
            name: testUser.name,
            password: hashedTestPassword,
            tier: testUser.tier,
            role: testUser.role,
            emailVerified: testUser.emailVerified === false ? null : new Date(),
            isActive: true,
            hasUsedStripeTrial: false,
            hasUsedThreeDayPlan: false,
          },
        });
      }

      console.log('✅ E2E test users created:');
      console.log('   - free-test@trading-alerts.test (FREE)');
      console.log('   - pro-test@trading-alerts.test (PRO)');
      console.log('   - admin-test@trading-alerts.test (ADMIN)');
      console.log('   - affiliate-test@trading-alerts.test (AFFILIATE)');
      console.log('   - unverified@trading-alerts.test (UNVERIFIED)');
    }

    // Create default watchlist for admin
    const defaultWatchlist = await prisma.watchlist.upsert({
      where: {
        userId_name: {
          userId: admin.id,
          name: 'My Watchlist',
        },
      },
      update: {},
      create: {
        userId: admin.id,
        name: 'My Watchlist',
        order: 0,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    console.log('✅ Default watchlist created:');
    console.log(`   Name: ${defaultWatchlist.name}`);
    console.log(`   Created: ${defaultWatchlist.createdAt.toISOString()}`);

    // Add sample watchlist items for FREE tier symbols
    const sampleItems = [
      { symbol: 'BTCUSD', timeframe: 'H1' },
      { symbol: 'EURUSD', timeframe: 'H1' },
      { symbol: 'USDJPY', timeframe: 'H1' },
      { symbol: 'US30', timeframe: 'H1' },
      { symbol: 'XAUUSD', timeframe: 'H1' },
    ];

    let orderIndex = 0;
    for (const item of sampleItems) {
      await prisma.watchlistItem.create({
        data: {
          watchlistId: defaultWatchlist.id,
          userId: admin.id,
          symbol: item.symbol,
          timeframe: item.timeframe,
          order: orderIndex++,
        },
      });
    }

    console.log('✅ Sample watchlist items created (5 FREE tier symbols)');

    // Create sample alerts for demonstration
    const sampleAlerts = [
      {
        symbol: 'BTCUSD',
        timeframe: 'H1',
        condition: JSON.stringify({
          type: 'price_touch_line',
          line: 'horizontal',
          direction: 'resistance',
          description: 'Price approaches BTCUSD horizontal resistance',
        }),
        alertType: 'PRICE_TOUCH_LINE',
        name: 'BTCUSD Resistance Alert',
      },
      {
        symbol: 'EURUSD',
        timeframe: 'H1',
        condition: JSON.stringify({
          type: 'fractal_signal',
          fractal: 'diagonal',
          direction: 'support',
          description: 'EURUSD diagonal support line touch',
        }),
        alertType: 'FRACTAL_NEW',
        name: 'EURUSD Support Alert',
      },
    ];

    for (const alert of sampleAlerts) {
      await prisma.alert.create({
        data: {
          userId: admin.id,
          symbol: alert.symbol,
          timeframe: alert.timeframe,
          condition: alert.condition,
          alertType: alert.alertType,
          name: alert.name,
          isActive: true,
        },
      });
    }

    console.log('✅ Sample alerts created (2 demonstration alerts)');

    // Create SystemConfig entries for affiliate settings
    const systemConfigEntries = [
      {
        key: 'affiliate_discount_percent',
        value: '20.0',
        valueType: 'number',
        description: 'Discount percentage for customers using affiliate codes',
        category: 'affiliate',
      },
      {
        key: 'affiliate_commission_percent',
        value: '20.0',
        valueType: 'number',
        description: 'Commission percentage for affiliates on net revenue',
        category: 'affiliate',
      },
      {
        key: 'affiliate_codes_per_month',
        value: '15',
        valueType: 'number',
        description: 'Number of codes distributed to each affiliate monthly',
        category: 'affiliate',
      },
      {
        key: 'affiliate_base_price',
        value: '29.0',
        valueType: 'number',
        description: 'Base subscription price in USD before discount',
        category: 'affiliate',
      },
      {
        key: 'affiliate_three_day_price',
        value: '1.99',
        valueType: 'number',
        description: '3-day trial plan price in USD (dLocal only)',
        category: 'affiliate',
      },
    ];

    for (const config of systemConfigEntries) {
      await prisma.systemConfig.upsert({
        where: { key: config.key },
        update: {},
        create: config,
      });
    }

    console.log('✅ SystemConfig entries created (affiliate settings)');
    console.log('');
    console.log('🎉 Database seeding completed successfully!');
    console.log('');
    console.log('📋 Summary:');
    console.log(`   Admin User: ${admin.email} (${admin.role}, ${admin.tier})`);
    console.log(`   Watchlist: ${defaultWatchlist.name} (5 items)`);
    console.log(`   Sample Alerts: 2 demonstration alerts`);
    console.log('');
    console.log('🔐 Login Credentials:');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log('');
    console.log('⚠️  IMPORTANT: Change these credentials in production!');
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    throw error;
  }
}

// Run seed function with proper error handling
main()
  .catch((e) => {
    console.error('Seed script error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
