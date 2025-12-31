/**
 * Prisma Type Stubs
 *
 * These type declarations allow TypeScript compilation when Prisma client
 * cannot be generated (e.g., network restrictions blocking binaries.prisma.sh).
 *
 * Generated from prisma/schema.prisma
 * Updated for Prisma 5.22.0 compatibility
 */

declare module '@prisma/client' {
  // ============================================================
  // ENUMS (from schema.prisma) - Using string literal union types
  // ============================================================

  export type UserTier = 'FREE' | 'PRO';
  export const UserTier: {
    FREE: 'FREE';
    PRO: 'PRO';
  };

  export type SubscriptionStatus =
    | 'ACTIVE'
    | 'INACTIVE'
    | 'CANCELED'
    | 'PAST_DUE'
    | 'UNPAID'
    | 'TRIALING';
  export const SubscriptionStatus: {
    ACTIVE: 'ACTIVE';
    INACTIVE: 'INACTIVE';
    CANCELED: 'CANCELED';
    PAST_DUE: 'PAST_DUE';
    UNPAID: 'UNPAID';
    TRIALING: 'TRIALING';
  };

  export type TrialStatus =
    | 'NOT_STARTED'
    | 'ACTIVE'
    | 'EXPIRED'
    | 'CONVERTED'
    | 'CANCELLED';
  export const TrialStatus: {
    NOT_STARTED: 'NOT_STARTED';
    ACTIVE: 'ACTIVE';
    EXPIRED: 'EXPIRED';
    CONVERTED: 'CONVERTED';
    CANCELLED: 'CANCELLED';
  };

  export type AffiliateStatus =
    | 'PENDING_VERIFICATION'
    | 'ACTIVE'
    | 'SUSPENDED'
    | 'INACTIVE';
  export const AffiliateStatus: {
    PENDING_VERIFICATION: 'PENDING_VERIFICATION';
    ACTIVE: 'ACTIVE';
    SUSPENDED: 'SUSPENDED';
    INACTIVE: 'INACTIVE';
  };

  export type CodeStatus = 'ACTIVE' | 'USED' | 'EXPIRED' | 'CANCELLED';
  export const CodeStatus: {
    ACTIVE: 'ACTIVE';
    USED: 'USED';
    EXPIRED: 'EXPIRED';
    CANCELLED: 'CANCELLED';
  };

  export type DistributionReason = 'INITIAL' | 'MONTHLY' | 'ADMIN_BONUS';
  export const DistributionReason: {
    INITIAL: 'INITIAL';
    MONTHLY: 'MONTHLY';
    ADMIN_BONUS: 'ADMIN_BONUS';
  };

  export type CommissionStatus = 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED';
  export const CommissionStatus: {
    PENDING: 'PENDING';
    APPROVED: 'APPROVED';
    PAID: 'PAID';
    CANCELLED: 'CANCELLED';
  };

  export type NotificationType =
    | 'ALERT'
    | 'SUBSCRIPTION'
    | 'PAYMENT'
    | 'SYSTEM';
  export const NotificationType: {
    ALERT: 'ALERT';
    SUBSCRIPTION: 'SUBSCRIPTION';
    PAYMENT: 'PAYMENT';
    SYSTEM: 'SYSTEM';
  };

  export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH';
  export const NotificationPriority: {
    LOW: 'LOW';
    MEDIUM: 'MEDIUM';
    HIGH: 'HIGH';
  };

  export type RiseWorksKycStatus =
    | 'PENDING'
    | 'SUBMITTED'
    | 'APPROVED'
    | 'REJECTED'
    | 'EXPIRED';
  export const RiseWorksKycStatus: {
    PENDING: 'PENDING';
    SUBMITTED: 'SUBMITTED';
    APPROVED: 'APPROVED';
    REJECTED: 'REJECTED';
    EXPIRED: 'EXPIRED';
  };

  export type PaymentBatchStatus =
    | 'PENDING'
    | 'QUEUED'
    | 'PROCESSING'
    | 'COMPLETED'
    | 'FAILED'
    | 'CANCELLED';
  export const PaymentBatchStatus: {
    PENDING: 'PENDING';
    QUEUED: 'QUEUED';
    PROCESSING: 'PROCESSING';
    COMPLETED: 'COMPLETED';
    FAILED: 'FAILED';
    CANCELLED: 'CANCELLED';
  };

  export type DisbursementTransactionStatus =
    | 'PENDING'
    | 'PROCESSING'
    | 'COMPLETED'
    | 'FAILED'
    | 'CANCELLED';
  export const DisbursementTransactionStatus: {
    PENDING: 'PENDING';
    PROCESSING: 'PROCESSING';
    COMPLETED: 'COMPLETED';
    FAILED: 'FAILED';
    CANCELLED: 'CANCELLED';
  };

  export type DisbursementProvider = 'RISE' | 'MOCK';
  export const DisbursementProvider: {
    RISE: 'RISE';
    MOCK: 'MOCK';
  };

  export type AuditLogStatus = 'SUCCESS' | 'FAILURE' | 'WARNING' | 'INFO';
  export const AuditLogStatus: {
    SUCCESS: 'SUCCESS';
    FAILURE: 'FAILURE';
    WARNING: 'WARNING';
    INFO: 'INFO';
  };

  export type LoginStatus = 'SUCCESS' | 'FAILED' | 'BLOCKED';
  export const LoginStatus: {
    SUCCESS: 'SUCCESS';
    FAILED: 'FAILED';
    BLOCKED: 'BLOCKED';
  };

  export type SecurityAlertType =
    | 'NEW_DEVICE_LOGIN'
    | 'PASSWORD_CHANGED'
    | 'EMAIL_CHANGED'
    | 'TWO_FACTOR_ENABLED'
    | 'TWO_FACTOR_DISABLED'
    | 'SUSPICIOUS_LOGIN'
    | 'ACCOUNT_LOCKED';
  export const SecurityAlertType: {
    NEW_DEVICE_LOGIN: 'NEW_DEVICE_LOGIN';
    PASSWORD_CHANGED: 'PASSWORD_CHANGED';
    EMAIL_CHANGED: 'EMAIL_CHANGED';
    TWO_FACTOR_ENABLED: 'TWO_FACTOR_ENABLED';
    TWO_FACTOR_DISABLED: 'TWO_FACTOR_DISABLED';
    SUSPICIOUS_LOGIN: 'SUSPICIOUS_LOGIN';
    ACCOUNT_LOCKED: 'ACCOUNT_LOCKED';
  };

  // ============================================================
  // UTILITY TYPES
  // ============================================================

  export type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonValue[]
    | { [key: string]: JsonValue };

  export type JsonObject = { [key: string]: JsonValue };
  export type JsonArray = JsonValue[];

  export type InputJsonValue =
    | string
    | number
    | boolean
    | null
    | InputJsonValue[]
    | { [key: string]: InputJsonValue };

  // Prisma 5.x: Nullable JSON handling
  export type NullableJsonInput = JsonValue | null;

  export type Decimal = number;

  // ============================================================
  // PRISMA 5.x FILTER TYPES
  // ============================================================

  // Query mode for case-insensitive search (new in Prisma 5.x)
  export type QueryMode = 'default' | 'insensitive';

  // String filters with mode option
  export type NestedStringFilter = {
    equals?: string;
    in?: string[];
    notIn?: string[];
    lt?: string;
    lte?: string;
    gt?: string;
    gte?: string;
    contains?: string;
    startsWith?: string;
    endsWith?: string;
    mode?: QueryMode;
    not?: string | NestedStringFilter;
  };

  export type StringFilter = {
    equals?: string;
    in?: string[];
    notIn?: string[];
    lt?: string;
    lte?: string;
    gt?: string;
    gte?: string;
    contains?: string;
    startsWith?: string;
    endsWith?: string;
    mode?: QueryMode;
    not?: string | NestedStringFilter;
  };

  export type StringNullableFilter = StringFilter & {
    equals?: string | null;
    not?: string | null | NestedStringFilter;
  };

  // DateTime filters with nested support
  export type NestedDateTimeFilter = {
    equals?: Date | string;
    in?: Date[] | string[];
    notIn?: Date[] | string[];
    lt?: Date | string;
    lte?: Date | string;
    gt?: Date | string;
    gte?: Date | string;
    not?: Date | string | NestedDateTimeFilter;
  };

  export type DateTimeFilter = {
    equals?: Date | string;
    in?: Date[] | string[];
    notIn?: Date[] | string[];
    lt?: Date | string;
    lte?: Date | string;
    gt?: Date | string;
    gte?: Date | string;
    not?: Date | string | NestedDateTimeFilter;
  };

  export type NestedDateTimeNullableFilter = {
    equals?: Date | string | null;
    in?: Date[] | string[] | null;
    notIn?: Date[] | string[] | null;
    lt?: Date | string;
    lte?: Date | string;
    gt?: Date | string;
    gte?: Date | string;
    not?: Date | string | null | NestedDateTimeNullableFilter;
  };

  export type DateTimeNullableFilter = DateTimeFilter & {
    equals?: Date | string | null;
    not?: Date | string | null | NestedDateTimeNullableFilter;
  };

  // Int filters
  export type NestedIntFilter = {
    equals?: number;
    in?: number[];
    notIn?: number[];
    lt?: number;
    lte?: number;
    gt?: number;
    gte?: number;
    not?: number | NestedIntFilter;
  };

  export type IntFilter = {
    equals?: number;
    in?: number[];
    notIn?: number[];
    lt?: number;
    lte?: number;
    gt?: number;
    gte?: number;
    not?: number | NestedIntFilter;
  };

  export type IntNullableFilter = IntFilter & {
    equals?: number | null;
    not?: number | null | NestedIntFilter;
  };

  // Float filters
  export type NestedFloatFilter = {
    equals?: number;
    in?: number[];
    notIn?: number[];
    lt?: number;
    lte?: number;
    gt?: number;
    gte?: number;
    not?: number | NestedFloatFilter;
  };

  export type FloatFilter = {
    equals?: number;
    in?: number[];
    notIn?: number[];
    lt?: number;
    lte?: number;
    gt?: number;
    gte?: number;
    not?: number | NestedFloatFilter;
  };

  export type FloatNullableFilter = FloatFilter & {
    equals?: number | null;
    not?: number | null | NestedFloatFilter;
  };

  // Bool filters
  export type NestedBoolFilter = {
    equals?: boolean;
    not?: boolean | NestedBoolFilter;
  };

  export type BoolFilter = {
    equals?: boolean;
    not?: boolean | NestedBoolFilter;
  };

  export type BoolNullableFilter = BoolFilter & {
    equals?: boolean | null;
    not?: boolean | null | NestedBoolFilter;
  };

  // Prisma 5.x: Relation load strategy
  export type RelationLoadStrategy = 'query' | 'join';

  // ============================================================
  // MODEL TYPES (from schema.prisma)
  // ============================================================

  export interface User {
    id: string;
    email: string;
    name: string | null;
    password: string | null;
    image: string | null;
    emailVerified: Date | null;
    tier: UserTier;
    role: string;
    isActive: boolean;
    isAffiliate: boolean;
    trialStatus: TrialStatus;
    trialStartDate: Date | null;
    trialEndDate: Date | null;
    trialConvertedAt: Date | null;
    trialCancelledAt: Date | null;
    hasUsedFreeTrial: boolean;
    hasUsedStripeTrial: boolean;
    stripeTrialStartedAt: Date | null;
    hasUsedThreeDayPlan: boolean;
    threeDayPlanUsedAt: Date | null;
    signupIP: string | null;
    lastLoginIP: string | null;
    deviceFingerprint: string | null;
    verificationToken: string | null;
    resetToken: string | null;
    resetTokenExpiry: Date | null;
    createdAt: Date;
    updatedAt: Date;
    accounts?: Account[];
    alerts?: Alert[];
    watchlists?: Watchlist[];
    subscription?: Subscription | null;
    payments?: Payment[];
    fraudAlerts?: FraudAlert[];
    affiliateProfile?: AffiliateProfile | null;
    preferences?: UserPreferences | null;
    sessions?: Session[];
    _count?: {
      alerts: number;
      watchlists: number;
      payments: number;
      [key: string]: number;
    };
  }

  export interface Account {
    id: string;
    userId: string;
    type: string;
    provider: string;
    providerAccountId: string;
    refresh_token: string | null;
    access_token: string | null;
    expires_at: number | null;
    token_type: string | null;
    scope: string | null;
    id_token: string | null;
    session_state: string | null;
    user?: User;
  }

  export interface Session {
    id: string;
    sessionToken: string;
    userId: string;
    expires: Date;
    user?: User;
  }

  export interface UserSession {
    id: string;
    userId: string;
    userAgent: string | null;
    ipAddress: string | null;
    deviceType: string | null;
    browser: string | null;
    browserVersion: string | null;
    os: string | null;
    osVersion: string | null;
    country: string | null;
    city: string | null;
    region: string | null;
    isActive: boolean;
    lastActiveAt: Date;
    createdAt: Date;
    expiresAt: Date;
    sessionToken: string | null;
    user?: User;
  }

  export interface VerificationToken {
    identifier: string;
    token: string;
    expires: Date;
  }

  export interface UserPreferences {
    id: string;
    userId: string;
    preferences: JsonValue;
    createdAt: Date;
    updatedAt: Date;
    user?: User;
  }

  export interface AccountDeletionRequest {
    id: string;
    userId: string;
    token: string;
    status: string;
    expiresAt: Date;
    confirmedAt: Date | null;
    cancelledAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }

  export interface Subscription {
    id: string;
    userId: string;
    affiliateCodeId: string | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    stripePriceId: string | null;
    stripeCurrentPeriodEnd: Date | null;
    dLocalPaymentId: string | null;
    dLocalPaymentMethod: string | null;
    dLocalCountry: string | null;
    dLocalCurrency: string | null;
    planType: string | null;
    amountUsd: number;
    status: SubscriptionStatus;
    expiresAt: Date | null;
    renewalReminderSent: boolean;
    createdAt: Date;
    updatedAt: Date;
    user?: User;
    payments?: Payment[];
  }

  export interface Alert {
    id: string;
    userId: string;
    name: string | null;
    symbol: string;
    timeframe: string;
    condition: string;
    alertType: string;
    isActive: boolean;
    lastTriggered: Date | { not: null } | null;
    triggerCount: number;
    createdAt: Date;
    updatedAt: Date;
    user?: User;
  }

  export interface Watchlist {
    id: string;
    userId: string;
    name: string;
    order: number;
    createdAt: Date;
    updatedAt: Date;
    user?: User;
    items?: WatchlistItem[];
  }

  export interface WatchlistItem {
    id: string;
    watchlistId: string;
    userId: string;
    symbol: string;
    timeframe: string;
    order: number;
    createdAt: Date;
    watchlist?: Watchlist;
  }

  export interface Payment {
    id: string;
    userId: string;
    subscriptionId: string | null;
    provider: string;
    providerPaymentId: string;
    providerStatus: string;
    amount: Decimal;
    amountUSD: Decimal;
    currency: string;
    country: string | null;
    paymentMethod: string | null;
    planType: string | null;
    duration: number | null;
    discountCode: string | null;
    discountAmount: Decimal | null;
    status: string;
    failureReason: string | null;
    ipAddress: string | null;
    deviceFingerprint: string | null;
    createdAt: Date;
    updatedAt: Date;
    user?: User;
    subscription?: Subscription | null;
  }

  export interface FraudAlert {
    id: string;
    userId: string;
    alertType: string;
    severity: string;
    description: string;
    detectedAt: Date;
    ipAddress: string | null;
    deviceFingerprint: string | null;
    additionalData: JsonValue | null;
    reviewedBy: string | null;
    reviewedAt: Date | null;
    resolution: string | null;
    notes: string | null;
    user?: User;
  }

  export interface AffiliateProfile {
    id: string;
    userId: string;
    fullName: string;
    country: string;
    facebookUrl: string | null;
    instagramUrl: string | null;
    twitterUrl: string | null;
    youtubeUrl: string | null;
    tiktokUrl: string | null;
    paymentMethod: string;
    paymentDetails: JsonValue;
    totalCodesDistributed: number;
    totalCodesUsed: number;
    totalEarnings: Decimal;
    pendingCommissions: Decimal;
    paidCommissions: Decimal;
    status: AffiliateStatus;
    verifiedAt: Date | null;
    suspendedAt: Date | null;
    suspensionReason: string | null;
    createdAt: Date;
    updatedAt: Date;
    user?: User;
    affiliateCodes?: AffiliateCode[];
    commissions?: Commission[];
    riseAccount?: AffiliateRiseAccount | null;
  }

  export interface AffiliateCode {
    id: string;
    code: string;
    affiliateProfileId: string;
    discountPercent: number;
    commissionPercent: number;
    status: CodeStatus;
    distributedAt: Date;
    expiresAt: Date;
    usedAt: Date | null;
    cancelledAt: Date | null;
    distributionReason: DistributionReason;
    usedBy: string | null;
    subscriptionId: string | null;
    createdAt: Date;
    updatedAt: Date;
    affiliateProfile?: AffiliateProfile;
    commissions?: Commission[];
  }

  export interface Commission {
    id: string;
    affiliateProfileId: string;
    affiliateCodeId: string;
    userId: string;
    subscriptionId: string | null;
    grossRevenue: Decimal;
    discountAmount: Decimal;
    netRevenue: Decimal;
    commissionAmount: Decimal;
    status: CommissionStatus;
    earnedAt: Date;
    approvedAt: Date | null;
    paidAt: Date | null;
    cancelledAt: Date | null;
    paymentBatchId: string | null;
    paymentMethod: string | null;
    paymentReference: string | null;
    createdAt: Date;
    updatedAt: Date;
    affiliateProfile?: AffiliateProfile;
    affiliateCode?: AffiliateCode;
    disbursementTransaction?: DisbursementTransaction | null;
  }

  export interface Notification {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    priority: NotificationPriority;
    read: boolean;
    readAt: Date | null;
    link: string | null;
    createdAt: Date;
    updatedAt: Date;
  }

  export interface AffiliateRiseAccount {
    id: string;
    affiliateProfileId: string;
    riseId: string;
    email: string;
    kycStatus: RiseWorksKycStatus;
    kycCompletedAt: Date | null;
    invitationSentAt: Date | null;
    invitationAcceptedAt: Date | null;
    lastSyncAt: Date | null;
    metadata: JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
    affiliateProfile?: AffiliateProfile;
    disbursementTransactions?: DisbursementTransaction[];
    _count?: { disbursementTransactions: number; [key: string]: number };
  }

  export interface PaymentBatch {
    id: string;
    batchNumber: string;
    paymentCount: number;
    totalAmount: Decimal;
    currency: string;
    provider: DisbursementProvider;
    status: PaymentBatchStatus;
    scheduledAt: Date | null;
    executedAt: Date | null;
    completedAt: Date | null;
    failedAt: Date | null;
    errorMessage: string | null;
    metadata: JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
    transactions?: DisbursementTransaction[];
    auditLogs?: DisbursementAuditLog[];
  }

  export interface DisbursementTransaction {
    id: string;
    batchId: string;
    commissionId: string;
    transactionId: string;
    providerTxId: string | null;
    provider: DisbursementProvider;
    affiliateRiseAccountId: string | null;
    payeeRiseId: string | null;
    amount: Decimal;
    amountRiseUnits: bigint | null;
    currency: string;
    status: DisbursementTransactionStatus;
    retryCount: number;
    lastRetryAt: Date | null;
    errorMessage: string | null;
    metadata: JsonValue | null;
    createdAt: Date;
    completedAt: Date | null;
    failedAt: Date | null;
    batch?: PaymentBatch;
    commission?: Commission;
    affiliateRiseAccount?: AffiliateRiseAccount | null;
    webhookEvents?: RiseWorksWebhookEvent[];
    auditLogs?: DisbursementAuditLog[];
  }

  export interface RiseWorksWebhookEvent {
    id: string;
    transactionId: string | null;
    eventType: string;
    provider: DisbursementProvider;
    payload: JsonValue;
    signature: string | null;
    hash: string | null;
    verified: boolean;
    processed: boolean;
    processedAt: Date | null;
    errorMessage: string | null;
    receivedAt: Date;
    transaction?: DisbursementTransaction | null;
  }

  export interface DisbursementAuditLog {
    id: string;
    transactionId: string | null;
    batchId: string | null;
    action: string;
    actor: string | null;
    status: AuditLogStatus;
    details: JsonValue | null;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
    transaction?: DisbursementTransaction | null;
    batch?: PaymentBatch | null;
  }

  export interface SystemConfig {
    id: string;
    key: string;
    value: string;
    valueType: string;
    description: string | null;
    category: string;
    updatedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
  }

  export interface SystemConfigHistory {
    id: string;
    configKey: string;
    oldValue: string;
    newValue: string;
    changedBy: string;
    reason: string | null;
    changedAt: Date;
  }

  export interface LoginHistory {
    id: string;
    userId: string;
    status: LoginStatus;
    provider: string;
    userAgent: string | null;
    deviceType: string | null;
    browser: string | null;
    browserVersion: string | null;
    os: string | null;
    osVersion: string | null;
    ipAddress: string | null;
    country: string | null;
    city: string | null;
    region: string | null;
    deviceFingerprint: string | null;
    isNewDevice: boolean;
    failureReason: string | null;
    createdAt: Date;
  }

  export interface SecurityAlert {
    id: string;
    userId: string;
    type: SecurityAlertType;
    title: string;
    message: string;
    ipAddress: string | null;
    deviceInfo: string | null;
    location: string | null;
    emailSent: boolean;
    emailSentAt: Date | null;
    read: boolean;
    readAt: Date | null;
    createdAt: Date;
  }

  // ============================================================
  // PRISMA NAMESPACE
  // ============================================================

  export namespace Prisma {
    export type Decimal = number;

    export type TransactionClient = Omit<
      PrismaClient,
      | '$connect'
      | '$disconnect'
      | '$on'
      | '$transaction'
      | '$use'
      | '$extends'
      | '$metrics'
    >;

    // ===== JSON TYPE SYSTEM (enhanced in Prisma 5.x) =====
    export type JsonValue =
      | string
      | number
      | boolean
      | null
      | JsonValue[]
      | { [key: string]: JsonValue };

    export type JsonObject = { [key: string]: JsonValue };
    export type JsonArray = JsonValue[];

    export type InputJsonValue =
      | string
      | number
      | boolean
      | null
      | InputJsonValue[]
      | { [key: string]: InputJsonValue };

    // Prisma 5.x: Nullable JSON handling
    export type NullableJsonInput = JsonValue | null;

    // ===== JSON NULL TYPES (critical for Prisma 5.x) =====
    // These symbols distinguish between JSON null value and database NULL
    export const JsonNull: unique symbol;
    export const DbNull: unique symbol;
    export const AnyNull: unique symbol;
    export type NullTypes = typeof JsonNull | typeof DbNull | typeof AnyNull;

    // ===== TRANSACTION TYPES (enhanced in Prisma 5.x) =====
    export type TransactionIsolationLevel =
      | 'ReadUncommitted'
      | 'ReadCommitted'
      | 'RepeatableRead'
      | 'Serializable';

    // ===== METRICS TYPES (new in Prisma 5.x) =====
    export interface Metrics {
      json(): Promise<MetricsJson>;
      prometheus(): Promise<string>;
    }

    export interface MetricsJson {
      counters: MetricCounter[];
      gauges: MetricGauge[];
      histograms: MetricHistogram[];
    }

    export interface MetricCounter {
      key: string;
      value: number;
      labels: Record<string, string>;
      description: string;
    }

    export interface MetricGauge {
      key: string;
      value: number;
      labels: Record<string, string>;
      description: string;
    }

    export interface MetricHistogram {
      key: string;
      value: { buckets: [number, number][]; sum: number; count: number };
      labels: Record<string, string>;
      description: string;
    }

    // ===== PROMISE TYPES =====
    export type PrismaPromise<T> = Promise<T> & {
      [Symbol.toStringTag]: 'PrismaPromise';
    };

    // ===== MIDDLEWARE TYPES (enhanced in Prisma 5.x) =====
    export type Middleware = (
      params: MiddlewareParams,
      next: (params: MiddlewareParams) => Promise<unknown>
    ) => Promise<unknown>;

    export interface MiddlewareParams {
      model?: string;
      action: string;
      args: Record<string, unknown>;
      dataPath: string[];
      runInTransaction: boolean;
    }

    // ===== FILTER TYPES =====
    export type QueryMode = 'default' | 'insensitive';
    export type RelationLoadStrategy = 'query' | 'join';

    // Where input types - relaxed to allow Prisma query syntax
    export type UserWhereInput = Record<string, unknown>;
    export type CommissionWhereInput = Record<string, unknown>;
    export type AffiliateProfileWhereInput = Record<string, unknown>;
    export type PaymentBatchWhereInput = Record<string, unknown>;
    export type DisbursementTransactionWhereInput = Record<string, unknown>;
    export type PaymentWhereInput = Record<string, unknown>;
    export type AffiliateCodeWhereInput = Record<string, unknown>;
    export type AlertWhereInput = Record<string, unknown>;

    // Input types for create/update operations - relaxed
    export type UserCreateInput = Record<string, unknown>;
    export type UserUpdateInput = Record<string, unknown>;
    export type SubscriptionCreateInput = Record<string, unknown>;
    export type SubscriptionUpdateInput = Record<string, unknown>;
    export type AffiliateProfileCreateInput = Record<string, unknown>;
    export type AffiliateProfileUpdateInput = Record<string, unknown>;
    export type CommissionCreateInput = Record<string, unknown>;
    export type CommissionUpdateInput = Record<string, unknown>;
    export type PaymentBatchCreateInput = Record<string, unknown>;
    export type PaymentBatchUpdateInput = Record<string, unknown>;
    export type DisbursementTransactionCreateInput = Record<string, unknown>;
    export type DisbursementTransactionUpdateInput = Record<string, unknown>;
    export type DisbursementAuditLogCreateInput = Record<string, unknown>;
    export type RiseWorksWebhookEventCreateInput = Record<string, unknown>;
    export type AffiliateRiseAccountCreateInput = Record<string, unknown>;
    export type AffiliateRiseAccountUpdateInput = Record<string, unknown>;
    export type PaymentCreateInput = Record<string, unknown>;
    export type NotificationCreateInput = Record<string, unknown>;
    export type AffiliateCodeCreateInput = Record<string, unknown>;
    export type AffiliateCodeUpdateInput = Record<string, unknown>;
    export type AccountDeletionRequestUpdateInput = Record<string, unknown>;
    export type AlertCreateInput = Record<string, unknown>;
    export type AlertUpdateInput = Record<string, unknown>;
    export type WatchlistCreateInput = Record<string, unknown>;
    export type WatchlistItemCreateInput = Record<string, unknown>;
    export type SystemConfigWhereInput = Record<string, unknown>;
    export type SystemConfigCreateInput = Record<string, unknown>;
    export type SystemConfigUpdateInput = Record<string, unknown>;
    export type SystemConfigHistoryWhereInput = Record<string, unknown>;
    export type SystemConfigHistoryCreateInput = Record<string, unknown>;
    export type SystemConfigHistoryUpdateInput = Record<string, unknown>;
  }

  // ============================================================
  // PRISMA CLIENT
  // ============================================================

  // Prisma 5.x: Enhanced client options
  export type PrismaClientOptions = {
    datasources?: {
      db?: {
        url?: string;
      };
    };
    log?: Array<
      | 'query'
      | 'info'
      | 'warn'
      | 'error'
      | { emit: 'event' | 'stdout'; level: 'query' | 'info' | 'warn' | 'error' }
    >;
    errorFormat?: 'pretty' | 'colorless' | 'minimal';
  };

  // Generic delegate interface for model operations - relaxed types
  interface ModelDelegate<T> {
    findUnique(args: Record<string, unknown>): Promise<T | null>;
    findFirst(args?: Record<string, unknown>): Promise<T | null>;
    findMany(args?: Record<string, unknown>): Promise<T[]>;
    create(args: Record<string, unknown>): Promise<T>;
    createMany(args: Record<string, unknown>): Promise<{ count: number }>;
    update(args: Record<string, unknown>): Promise<T>;
    updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
    upsert(args: Record<string, unknown>): Promise<T>;
    delete(args: Record<string, unknown>): Promise<T>;
    deleteMany(args?: Record<string, unknown>): Promise<{ count: number }>;
    count(args?: Record<string, unknown>): Promise<number>;
    aggregate(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    groupBy(
      args: Record<string, unknown>
    ): Promise<Array<Record<string, unknown>>>;
  }

  export class PrismaClient {
    constructor(options?: PrismaClientOptions);

    // Connection management
    $connect(): Promise<void>;
    $disconnect(): Promise<void>;
    $on(
      event: 'query' | 'info' | 'warn' | 'error',
      callback: (e: unknown) => void
    ): void;

    // Middleware (enhanced in Prisma 5.x)
    $use(middleware: Prisma.Middleware): void;

    // Transaction support (improved in Prisma 5.x)
    $transaction<T>(
      fn: (prisma: Prisma.TransactionClient) => Promise<T>,
      options?: {
        maxWait?: number;
        timeout?: number;
        isolationLevel?: Prisma.TransactionIsolationLevel;
      }
    ): Promise<T>;
    $transaction<T>(
      promises: Prisma.PrismaPromise<T>[],
      options?: { isolationLevel?: Prisma.TransactionIsolationLevel }
    ): Promise<T[]>;

    // Query execution
    $queryRaw<T = unknown>(
      query: TemplateStringsArray,
      ...values: unknown[]
    ): Prisma.PrismaPromise<T>;
    $queryRawUnsafe<T = unknown>(
      query: string,
      ...values: unknown[]
    ): Prisma.PrismaPromise<T>;
    $executeRaw(
      query: TemplateStringsArray,
      ...values: unknown[]
    ): Prisma.PrismaPromise<number>;
    $executeRawUnsafe(
      query: string,
      ...values: unknown[]
    ): Prisma.PrismaPromise<number>;

    // NEW IN PRISMA 5.x: Metrics API for observability
    $metrics: Prisma.Metrics;

    // NEW IN PRISMA 5.x: Client extensions
    $extends: (extension: unknown) => PrismaClient;

    user: ModelDelegate<User>;
    account: ModelDelegate<Account>;
    session: ModelDelegate<Session>;
    verificationToken: ModelDelegate<VerificationToken>;
    userPreferences: ModelDelegate<UserPreferences>;
    accountDeletionRequest: ModelDelegate<AccountDeletionRequest>;
    subscription: ModelDelegate<Subscription>;
    alert: ModelDelegate<Alert>;
    watchlist: ModelDelegate<Watchlist>;
    watchlistItem: ModelDelegate<WatchlistItem>;
    payment: ModelDelegate<Payment>;
    fraudAlert: ModelDelegate<FraudAlert>;
    affiliateProfile: ModelDelegate<AffiliateProfile>;
    affiliateCode: ModelDelegate<AffiliateCode>;
    commission: ModelDelegate<Commission>;
    notification: ModelDelegate<Notification>;
    affiliateRiseAccount: ModelDelegate<AffiliateRiseAccount>;
    paymentBatch: ModelDelegate<PaymentBatch>;
    disbursementTransaction: ModelDelegate<DisbursementTransaction>;
    riseWorksWebhookEvent: ModelDelegate<RiseWorksWebhookEvent>;
    disbursementAuditLog: ModelDelegate<DisbursementAuditLog>;
    systemConfig: ModelDelegate<SystemConfig>;
    systemConfigHistory: ModelDelegate<SystemConfigHistory>;
    userSession: ModelDelegate<UserSession>;
    loginHistory: ModelDelegate<LoginHistory>;
    securityAlert: ModelDelegate<SecurityAlert>;
  }
}

declare module '@prisma/client/runtime/library' {
  export type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonValue[]
    | { [key: string]: JsonValue };

  export type InputJsonValue =
    | string
    | number
    | boolean
    | null
    | InputJsonValue[]
    | { [key: string]: InputJsonValue };
}

declare module '@prisma/client/runtime/library.js' {
  export type JsonValue =
    | string
    | number
    | boolean
    | null
    | JsonValue[]
    | { [key: string]: JsonValue };

  export type InputJsonValue =
    | string
    | number
    | boolean
    | null
    | InputJsonValue[]
    | { [key: string]: InputJsonValue };
}

// Re-export for .prisma/client import path (used when custom output is specified)
declare module '.prisma/client' {
  export * from '@prisma/client';
}
