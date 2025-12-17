import { PrismaClient, UserTier } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * Database Seed Helper Functions
 *
 * Provides reusable functions for programmatically seeding the database
 * Used by both the seed script and application initialization
 * Follows Prisma best practices for database operations
 */

/**
 * Created admin user result
 */
interface SeedAdminResult {
  id: string;
  email: string;
  name: string | null;
  tier: UserTier;
  role: string;
  createdAt: Date;
}

/**
 * Creates an admin user with PRO tier access
 * @param prisma - PrismaClient instance
 * @param email - Admin email address
 * @param password - Admin password (will be hashed)
 * @param name - Admin display name
 * @returns Promise resolving to created user
 */
export async function seedAdmin(
  prisma: PrismaClient,
  email: string,
  password: string,
  name: string = 'Admin User'
): Promise<SeedAdminResult> {
  // Validate input parameters
  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  // Hash password using bcrypt with 10 rounds
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create admin user with PRO tier and ADMIN role
  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      password: hashedPassword,
      tier: UserTier.PRO,
      role: 'ADMIN',
      emailVerified: new Date(),
      isActive: true,
      hasUsedStripeTrial: false,
      hasUsedThreeDayPlan: false,
    },
    create: {
      email,
      name,
      password: hashedPassword,
      tier: UserTier.PRO,
      role: 'ADMIN',
      emailVerified: new Date(),
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

  return admin;
}

/**
 * Created watchlist result
 */
interface SeedWatchlistResult {
  id: string;
  name: string;
  createdAt: Date;
}

/**
 * Creates a default watchlist for a user
 * @param prisma - PrismaClient instance
 * @param userId - User ID to create watchlist for
 * @param name - Watchlist name (defaults to 'My Watchlist')
 * @returns Promise resolving to created watchlist
 */
export async function seedDefaultWatchlist(
  prisma: PrismaClient,
  userId: string,
  name: string = 'My Watchlist'
): Promise<SeedWatchlistResult> {
  const watchlist = await prisma.watchlist.upsert({
    where: {
      userId_name: {
        userId,
        name,
      },
    },
    update: {},
    create: {
      userId,
      name,
      order: 0,
    },
    select: {
      id: true,
      name: true,
      createdAt: true,
    },
  });

  return watchlist;
}

/**
 * Created watchlist item result
 */
interface SeedWatchlistItemResult {
  id: string;
  symbol: string;
  timeframe: string;
  order: number;
  createdAt: Date;
}

/**
 * Adds sample watchlist items for FREE tier symbols
 * @param prisma - PrismaClient instance
 * @param watchlistId - Watchlist ID to add items to
 * @param userId - User ID for ownership
 * @returns Promise resolving to array of created items
 */
export async function seedSampleWatchlistItems(
  prisma: PrismaClient,
  watchlistId: string,
  userId: string
): Promise<SeedWatchlistItemResult[]> {
  // FREE tier symbols as defined in tier specifications
  const freeTierSymbols = [
    { symbol: 'BTCUSD', timeframe: 'H1' },
    { symbol: 'EURUSD', timeframe: 'H1' },
    { symbol: 'USDJPY', timeframe: 'H1' },
    { symbol: 'US30', timeframe: 'H1' },
    { symbol: 'XAUUSD', timeframe: 'H1' },
  ];

  const createdItems = [];
  let orderIndex = 0;

  for (const item of freeTierSymbols) {
    const createdItem = await prisma.watchlistItem.create({
      data: {
        watchlistId,
        userId,
        symbol: item.symbol,
        timeframe: item.timeframe,
        order: orderIndex++,
      },
      select: {
        id: true,
        symbol: true,
        timeframe: true,
        order: true,
        createdAt: true,
      },
    });
    createdItems.push(createdItem);
  }

  return createdItems;
}

/**
 * Created alert result
 */
interface SeedAlertResult {
  id: string;
  symbol: string;
  timeframe: string;
  name: string | null;
  isActive: boolean;
  createdAt: Date;
}

/**
 * Creates sample demonstration alerts for a user
 * @param prisma - PrismaClient instance
 * @param userId - User ID to create alerts for
 * @returns Promise resolving to array of created alerts
 */
export async function seedSampleAlerts(
  prisma: PrismaClient,
  userId: string
): Promise<SeedAlertResult[]> {
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

  const createdAlerts = [];

  for (const alertData of sampleAlerts) {
    const alert = await prisma.alert.create({
      data: {
        userId,
        symbol: alertData.symbol,
        timeframe: alertData.timeframe,
        condition: alertData.condition,
        alertType: alertData.alertType,
        name: alertData.name,
        isActive: true,
      },
      select: {
        id: true,
        symbol: true,
        timeframe: true,
        name: true,
        isActive: true,
        createdAt: true,
      },
    });
    createdAlerts.push(alert);
  }

  return createdAlerts;
}

/**
 * Complete seeding setup results
 */
interface SeedCompleteSetupResult {
  admin: SeedAdminResult | null;
  watchlist: SeedWatchlistResult | null;
  watchlistItems: SeedWatchlistItemResult[];
  alerts: SeedAlertResult[];
}

/**
 * Complete seeding setup for a new admin user
 * Creates admin user, default watchlist, sample items, and demonstration alerts
 * @param prisma - PrismaClient instance
 * @param email - Admin email
 * @param password - Admin password
 * @param name - Admin display name
 * @returns Promise resolving to seeding results
 */
export async function seedCompleteSetup(
  prisma: PrismaClient,
  email: string,
  password: string,
  name: string = 'Admin User'
): Promise<SeedCompleteSetupResult> {
  const results: SeedCompleteSetupResult = {
    admin: null,
    watchlist: null,
    watchlistItems: [],
    alerts: [],
  };

  try {
    // Step 1: Create admin user
    results.admin = await seedAdmin(prisma, email, password, name);

    // Step 2: Create default watchlist
    results.watchlist = await seedDefaultWatchlist(prisma, results.admin.id);

    // Step 3: Add sample watchlist items
    results.watchlistItems = await seedSampleWatchlistItems(
      prisma,
      results.watchlist.id,
      results.admin.id
    );

    // Step 4: Create sample alerts
    results.alerts = await seedSampleAlerts(prisma, results.admin.id);

    return results;
  } catch (error) {
    console.error('❌ Seeding setup failed:', error);
    throw error;
  }
}

/**
 * Cleans up test data (for testing environments)
 * @param prisma - PrismaClient instance
 * @param email - Email of admin user to clean up
 * @returns Promise resolving when cleanup is complete
 */
export async function cleanupTestData(
  prisma: PrismaClient,
  email: string
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        alerts: true,
        watchlists: {
          include: {
            items: true,
          },
        },
        payments: true,
        fraudAlerts: true,
      },
    });

    if (!user) {
      return;
    }

    // Delete in reverse dependency order
    await prisma.fraudAlert.deleteMany({ where: { userId: user.id } });
    await prisma.payment.deleteMany({ where: { userId: user.id } });

    // Delete watchlist items first
    for (const watchlist of user.watchlists) {
      await prisma.watchlistItem.deleteMany({
        where: { watchlistId: watchlist.id },
      });
    }
    await prisma.watchlist.deleteMany({ where: { userId: user.id } });
    await prisma.alert.deleteMany({ where: { userId: user.id } });

    // Delete user last
    await prisma.user.delete({ where: { id: user.id } });
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
}
