import { PrismaClient } from '.prisma/non-market-client';
import bcrypt from 'bcryptjs';

/**
 * Database Seed Helper Functions
 *
 * Provides reusable functions for programmatically seeding the database
 * Used by both the seed script and application initialization
 * Follows Prisma best practices for database operations
 */

/**
 * User tier type
 */
type UserTier = 'FREE' | 'PRO';

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
      tier: 'PRO',
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
      tier: 'PRO',
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

// V8: watchlist seed helpers removed — watchlists eliminated from the product.

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
      symbol: 'XAUUSD',
      timeframe: 'M5',
      condition: JSON.stringify({
        type: 'price_touch_line',
        line: 'horizontal',
        direction: 'resistance',
        description: 'Price approaches XAUUSD M5 horizontal resistance',
      }),
      alertType: 'PRICE_TOUCH_LINE',
      name: 'XAUUSD M5 Resistance Alert',
    },
    {
      symbol: 'XAUUSD',
      timeframe: 'M15',
      condition: JSON.stringify({
        type: 'fractal_signal',
        fractal: 'diagonal',
        direction: 'support',
        description: 'XAUUSD M15 diagonal support line touch',
      }),
      alertType: 'FRACTAL_NEW',
      name: 'XAUUSD M15 Support Alert',
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
  alerts: SeedAlertResult[];
}

/**
 * Complete seeding setup for a new admin user
 * Creates admin user and demonstration alerts (V8: no watchlists)
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
    alerts: [],
  };

  try {
    // Step 1: Create admin user
    results.admin = await seedAdmin(prisma, email, password, name);

    // Step 2: Create sample alerts
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
      },
    });

    if (!user) {
      return;
    }

    // Delete in reverse dependency order
    await prisma.fraudAlert.deleteMany({ where: { userId: user.id } });
    await prisma.payment.deleteMany({ where: { userId: user.id } });
    await prisma.alert.deleteMany({ where: { userId: user.id } });

    // Delete user last
    await prisma.user.delete({ where: { id: user.id } });
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
}
