/**
 * Mock for @prisma/client
 *
 * This mock is automatically used by Jest when code imports from '@prisma/client'.
 * It provides a mock PrismaClient class and exports commonly used Prisma types/enums.
 *
 * Note: This mock prevents the actual Prisma client from trying to load
 * the generated client from .prisma/client (which fails without network access).
 */

// Mock Prisma namespace with common types
export const Prisma = {
  JsonNull: Symbol('JsonNull'),
  DbNull: Symbol('DbNull'),
  AnyNull: Symbol('AnyNull'),
  Decimal: Number,
  TransactionClient: {},
};

// Enum mocks (matching schema.prisma enums)
export const UserTier = {
  FREE: 'FREE',
  PRO: 'PRO',
} as const;

export const SubscriptionStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  CANCELED: 'CANCELED',
  PAST_DUE: 'PAST_DUE',
  UNPAID: 'UNPAID',
  TRIALING: 'TRIALING',
} as const;

export const TrialStatus = {
  NOT_STARTED: 'NOT_STARTED',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  CONVERTED: 'CONVERTED',
  CANCELLED: 'CANCELLED',
} as const;

export const AffiliateStatus = {
  PENDING_VERIFICATION: 'PENDING_VERIFICATION',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  INACTIVE: 'INACTIVE',
} as const;

export const CodeStatus = {
  ACTIVE: 'ACTIVE',
  USED: 'USED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;

export const CommissionStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
} as const;

export const DisbursementProvider = {
  RISE: 'RISE',
  MOCK: 'MOCK',
} as const;

export const DisbursementTransactionStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

export const RiseWorksKycStatus = {
  PENDING: 'PENDING',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
} as const;

export const PaymentBatchStatus = {
  PENDING: 'PENDING',
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

export const AuditLogStatus = {
  SUCCESS: 'SUCCESS',
  FAILURE: 'FAILURE',
  WARNING: 'WARNING',
  INFO: 'INFO',
} as const;

export const NotificationType = {
  ALERT: 'ALERT',
  SUBSCRIPTION: 'SUBSCRIPTION',
  PAYMENT: 'PAYMENT',
  SYSTEM: 'SYSTEM',
} as const;

export const NotificationPriority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;

export const DistributionReason = {
  INITIAL: 'INITIAL',
  MONTHLY: 'MONTHLY',
  ADMIN_BONUS: 'ADMIN_BONUS',
} as const;

// Helper to create a mock model delegate with all CRUD methods
const createMockDelegate = () => ({
  findUnique: jest.fn(),
  findUniqueOrThrow: jest.fn(),
  findFirst: jest.fn(),
  findFirstOrThrow: jest.fn(),
  findMany: jest.fn(),
  create: jest.fn(),
  createMany: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
  upsert: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
  count: jest.fn(),
  aggregate: jest.fn(),
  groupBy: jest.fn(),
});

// Mock PrismaClient class
export class PrismaClient {
  // Connection lifecycle
  $connect = jest.fn().mockResolvedValue(undefined);
  $disconnect = jest.fn().mockResolvedValue(undefined);
  $on = jest.fn();
  $use = jest.fn();

  // Prisma 5.x specific
  $metrics = {
    json: jest
      .fn()
      .mockResolvedValue({ counters: [], gauges: [], histograms: [] }),
    prometheus: jest.fn().mockResolvedValue(''),
  };
  $extends = jest.fn().mockReturnThis();

  // Query methods
  $queryRaw = jest.fn();
  $executeRaw = jest.fn();
  $queryRawUnsafe = jest.fn();
  $executeRawUnsafe = jest.fn();
  $transaction = jest.fn().mockImplementation(async (fn) => {
    if (typeof fn === 'function') {
      return fn(this);
    }
    return Promise.all(fn);
  });

  // Model delegates
  user = createMockDelegate();
  account = createMockDelegate();
  session = createMockDelegate();
  verificationToken = createMockDelegate();
  subscription = createMockDelegate();
  payment = createMockDelegate();
  alert = createMockDelegate();
  watchlist = createMockDelegate();
  watchlistItem = createMockDelegate();
  notification = createMockDelegate();
  userPreferences = createMockDelegate();
  accountDeletionRequest = createMockDelegate();
  fraudAlert = createMockDelegate();
  affiliateProfile = createMockDelegate();
  affiliateCode = createMockDelegate();
  commission = createMockDelegate();
  affiliateRiseAccount = createMockDelegate();
  paymentBatch = createMockDelegate();
  disbursementTransaction = createMockDelegate();
  riseWorksWebhookEvent = createMockDelegate();
  disbursementAuditLog = createMockDelegate();
  systemConfig = createMockDelegate();
  systemConfigHistory = createMockDelegate();

  constructor(_options?: unknown) {
    // Constructor accepts options but ignores them in mock
  }
}

export default PrismaClient;
