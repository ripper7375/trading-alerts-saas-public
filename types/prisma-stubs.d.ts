/**
 * Prisma Type Stubs
 *
 * These type declarations allow TypeScript compilation when Prisma client
 * cannot be generated (e.g., network restrictions blocking binaries.prisma.sh).
 *
 * Generated from prisma/schema.prisma
 * Updated for Prisma 7.x compatibility
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
    drawings?: Drawing[];
    subscription?: Subscription | null;
    payments?: Payment[];
    fraudAlerts?: FraudAlert[];
    affiliateProfile?: AffiliateProfile | null;
    preferences?: UserPreferences | null;
    sessions?: Session[];
    _count?: {
      alerts: number;
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
    drawingAlert?: DrawingAlert | null;
  }

  export interface Drawing {
    id: string;
    userId: string;
    symbol: string;
    timeframe: string;
    type: string;
    anchors: JsonValue;
    style: JsonValue;
    createdAt: Date;
    updatedAt: Date;
    user?: User;
    alerts?: DrawingAlert[];
  }

  export interface DrawingAlert {
    id: string;
    drawingId: string;
    alertId: string;
    targetLevel: string;
    direction: string;
    tolerance: number;
    cooldownSec: number;
    oneShot: boolean;
    createdAt: Date;
    updatedAt: Date;
    drawing?: Drawing;
    alert?: Alert;
  }

  // V8: Watchlist / WatchlistItem models removed (watchlists eliminated)

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

  // The old 63-column MarketData interface (EA v2.27+: tema/hrma/smma,
  // Keltner Channels, Heiken Ashi, sr_1-8, zigzag_high/low, pinbar, fractal
  // diag/horiz lines) was decommissioned 2026-07-05 alongside the Prisma
  // model of the same name (see prisma/schema.prisma's MarketDataV6 section
  // comment and migration 20260705010000_drop_market_data).

  // backend-stack-c v6 XAUUSD Gateway pipeline — a different indicator
  // methodology (centroid-regression variants, ZigZag categorization,
  // fractal EDT lines) than the now-decommissioned MarketData above. See
  // gateway_contract_market_data.schema.json for the authoritative field list.
  export interface MarketDataV6 {
    id: string;
    terminal_id: string;
    timestamp: number;
    symbol: string;
    timeframe: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    best_fit_a_horiz_high_map: number | null;
    best_fit_a_horiz_low_map: number | null;
    best_fit_a_ssa: number | null;
    best_fit_a_ema_ssa: number | null;
    best_fit_a_crossing: number | null;
    best_fit_a_base_fl: number | null;
    best_fit_a_uoedt: number | null;
    best_fit_a_loedt: number | null;
    best_fit_b_horiz_high_map: number | null;
    best_fit_b_horiz_low_map: number | null;
    best_fit_b_ssa: number | null;
    best_fit_b_ema_ssa: number | null;
    best_fit_b_crossing: number | null;
    best_fit_b_base_fl: number | null;
    best_fit_b_uoedt: number | null;
    best_fit_b_loedt: number | null;
    cherry_a_horiz_high_map: number | null;
    cherry_a_horiz_low_map: number | null;
    cherry_a_ssa: number | null;
    cherry_a_ema_ssa: number | null;
    cherry_a_crossing: number | null;
    cherry_a_base_fl: number | null;
    cherry_a_uoedt: number | null;
    cherry_a_loedt: number | null;
    cherry_b_horiz_high_map: number | null;
    cherry_b_horiz_low_map: number | null;
    cherry_b_ssa: number | null;
    cherry_b_ema_ssa: number | null;
    cherry_b_crossing: number | null;
    cherry_b_base_fl: number | null;
    cherry_b_uoedt: number | null;
    cherry_b_loedt: number | null;
    most_recent_horiz_high_map: number | null;
    most_recent_horiz_low_map: number | null;
    most_recent_ssa: number | null;
    most_recent_ema_ssa: number | null;
    most_recent_crossing: number | null;
    most_recent_base_fl: number | null;
    most_recent_uoedt: number | null;
    most_recent_loedt: number | null;
    non_a_horiz_high_map: number | null;
    non_a_horiz_low_map: number | null;
    non_a_ssa: number | null;
    non_a_ema_ssa: number | null;
    non_a_crossing: number | null;
    non_a_base_fl: number | null;
    non_a_uoedt: number | null;
    non_a_loedt: number | null;
    non_b_horiz_high_map: number | null;
    non_b_horiz_low_map: number | null;
    non_b_ssa: number | null;
    non_b_ema_ssa: number | null;
    non_b_crossing: number | null;
    non_b_base_fl: number | null;
    non_b_uoedt: number | null;
    non_b_loedt: number | null;
    fractal_best_fl: number | null;
    fractal_uoedt: number | null;
    fractal_loedt: number | null;
    best_resistance: number | null;
    best_support: number | null;
    sr_1: number | null;
    sr_2: number | null;
    sr_3: number | null;
    sr_4: number | null;
    sr_5: number | null;
    sr_6: number | null;
    sr_7: number | null;
    sr_8: number | null;
    sr_9: number | null;
    sr_10: number | null;
    sr_11: number | null;
    sr_12: number | null;
    sr_13: number | null;
    sr_14: number | null;
    sr_15: number | null;
    sr_16: number | null;
    body_direction: number | null;
    body_size: number | null;
    body_classification: number | null;
    zigzag_point_type: string | null;
    zigzag_current_point: number | null;
    zigzag_price_change: number | null;
    zigzag_pct_change: number | null;
    zigzag_pct_change_class: number | null;
    zigzag_bars: number | null;
    zigzag_bars_class: number | null;
    zigzag_price_per_bar: number | null;
    zigzag_price_per_bar_class: number | null;
    zigzag_slope: number | null;
    zigzag_category: string | null;
    cycle_id: number;
    collected_at: number;
    calculated_at: number | null;
    createdAt: Date | string;
    updatedAt: Date | string;
  }

  // Stack D chapter 1 tables (build step 2, part 2; migration
  // 20261002000000_add_cycle_pipeline_tables). Mirrors of the market-data
  // schema's MarketCycle, ActiveIndicatorSetting, SymbolSpec and CycleEvent.
  // Slots and other business timestamps are unix UTC seconds, like MarketDataV6.
  export interface MarketCycle {
    id: string;
    symbol: string;
    slot: number;
    state: string;
    data_status: string | null;
    attempts: number;
    manifest_received_at: number;
    ready_at: number | null;
    collector_started_at: number | null;
    collector_validated_at: number | null;
    m5_collection_cycle_id: number | null;
    m15_collection_cycle_id: number | null;
    m5_bar_count: number | null;
    m15_bar_count: number | null;
    m5_newest_bar_ts: number | null;
    m15_newest_bar_ts: number | null;
    m5_export_at: number | null;
    m15_export_at: number | null;
    check_detail: JsonValue | null;
    terminal_id: string | null;
    config_hashes: JsonValue | null;
    source_modes: JsonValue | null;
    retuning: boolean;
    backlog_rows: number | null;
    repush_rows_unsent: number | null;
    closed_bars_digest: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
  }

  export interface ActiveIndicatorSetting {
    id: string;
    timeframe: string;
    source: string;
    effective_slot: number;
    set_by: string;
    reason: string | null;
    createdAt: Date | string;
  }

  export interface SymbolSpec {
    id: string;
    terminal_id: string;
    symbol: string;
    version: number;
    captured_at: number;
    contract_size: number;
    volume_min: number;
    volume_step: number;
    volume_max: number;
    tick_size: number;
    typical_spread: number;
    swap_long: number;
    swap_short: number;
    point: number;
    digits: number;
    swap_mode: number;
    createdAt: Date | string;
  }

  export interface CycleEvent {
    id: string;
    symbol: string;
    event_type: string;
    effective_slot: number;
    dedupe_key: string;
    terminal_id: string | null;
    config_hashes: JsonValue | null;
    source_modes: JsonValue | null;
    detail: JsonValue | null;
    createdAt: Date | string;
  }

  // Stack D chapter 2 tables (build step 3, part 2; migration
  // 20261003000000_add_sensor_tables). Mirrors of the market-data schema's
  // McdOutput, MarketCycleInput and StateStatistic. Slots and other business
  // timestamps are unix UTC seconds. Unlike the chapter 1 tables these keep the
  // schema's snake_case `created_at` and `updated_at`.
  export interface McdOutput {
    id: string;
    symbol: string;
    cycle_slot: number;
    mcd_id: string;
    flag: string;
    evaluator_version: string;
    status: string;
    state_code: string | null;
    bias: string | null;
    envelope_json: string;
    envelope: JsonValue;
    envelope_sha256: string;
    evaluator_envelope_sha256: string;
    inputs_sha256: string | null;
    inherited_reasons: string[];
    guard_problems: string[];
    retuning_observed: boolean;
    retuning_applied: boolean;
    runner_version: string;
    python_version: string;
    duration_ms: number;
    evaluated_at: number;
    created_at: Date | string;
  }

  export interface MarketCycleInput {
    id: string;
    symbol: string;
    cycle_slot: number;
    bundle_gz: Uint8Array;
    bundle_encoding: string;
    bundle_bytes: number;
    inputs_sha256: string;
    retuning_observed: boolean;
    created_at: Date | string;
  }

  export interface StateStatistic {
    id: string;
    mcd_id: string;
    evaluator_version_series: string;
    config_hash_key: string;
    state_code: string;
    horizon_hours: number;
    n: number;
    forward_move_median: number | null;
    forward_move_q1: number | null;
    forward_move_q3: number | null;
    opposing_level_rate: number | null;
    adverse_excursion_median: number | null;
    adverse_excursion_q3: number | null;
    series_notes: string;
    created_at: Date | string;
    updated_at: Date | string;
  }

  // Stack D chapter 3 tables (build step 4, part 4; migration
  // 20261004000000_add_synthesis_tables). Mirrors of the market-data schema's
  // SynthesisReading and EntryZone. Slots are unix UTC seconds; like the chapter 2
  // tables these keep the schema's snake_case `created_at`.
  export interface SynthesisReading {
    id: string;
    symbol: string;
    cycle_slot: number;
    profile: string;
    flag: string;
    rules_version: string;
    rules_sha256: string;
    rule_id: string;
    branch_id: string | null;
    status: string;
    status_reasons: string[];
    data_status: string;
    archetype: string | null;
    bias: string;
    trend_relation: string | null;
    stand_aside: boolean;
    reading_json: string;
    reading: JsonValue;
    reading_sha256: string;
    zone_count: number;
    zones_reason: string | null;
    zones_json: string;
    zones_sha256: string;
    zone_params_version: string;
    zone_params_sha256: string;
    reference_price: number | null;
    guard_problems: string[];
    inputs_sha256: string | null;
    retuning_observed: boolean;
    retuning_applied: boolean;
    runner_version: string;
    python_version: string;
    duration_ms: number;
    evaluated_at: number;
    created_at: Date | string;
  }

  export interface EntryZone {
    id: string;
    symbol: string;
    cycle_slot: number;
    profile: string;
    zone_id: string;
    rank: number;
    bias: string;
    low: number;
    high: number;
    reference_price: number;
    source_sensors: string[];
    confluence_count: number;
    invalidation_price: number;
    invalidation_basis: string;
    stop_distance: number;
    next_opposing_price: number | null;
    runway: number | null;
    runway_ratio: number | null;
    levels: JsonValue;
    zone_params_version: string;
    zone_params_sha256: string;
    created_at: Date | string;
  }

  // Engine 4 (build step 5 part 5). The eight profile figures are canonical decimal TEXT.
  export interface UserTradePreferences {
    id: string;
    user_id: string;
    snapshot_id: string;
    trader_type: string;
    style: string;
    max_risk_pct: string;
    max_leverage: string;
    target_rrr: string;
    equity: string;
    min_sld: string;
    commission: string;
    created_at: Date | string;
    updated_at: Date | string;
  }

  export interface UserTradePreferencesHistory {
    id: string;
    user_id: string | null;
    user_id_hash: string;
    key_version: number;
    trader_type: string;
    style: string;
    max_risk_pct: string;
    max_leverage: string;
    target_rrr: string;
    equity: string;
    min_sld: string;
    commission: string;
    recorded_at: Date | string;
  }

  export interface TradeConsentRecord {
    id: string;
    user_id: string | null;
    user_id_hash: string;
    key_version: number;
    action: string;
    symbol: string;
    cycle_slot: number;
    synthesis_rule_id: string;
    synthesis_rules_version: string;
    zone_id: string | null;
    side: string | null;
    profile_snapshot_id: string;
    badge: string | null;
    setup_json: string;
    setup: JsonValue;
    setup_sha256: string;
    engine4_version: string;
    symbol_specs_version: number | null;
    template_version: string;
    disclaimer_version: string;
    language: string;
    recorded_at: Date | string;
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
    export type SystemConfigWhereInput = Record<string, unknown>;
    export type SystemConfigCreateInput = Record<string, unknown>;
    export type SystemConfigUpdateInput = Record<string, unknown>;
    export type SystemConfigHistoryWhereInput = Record<string, unknown>;
    export type SystemConfigHistoryCreateInput = Record<string, unknown>;
    export type SystemConfigHistoryUpdateInput = Record<string, unknown>;
    export type MarketDataWhereInput = Record<string, unknown>;
    export type MarketDataCreateInput = Record<string, unknown>;
    export type MarketDataUpdateInput = Record<string, unknown>;
  }

  // ============================================================
  // PRISMA CLIENT
  // ============================================================

  // Prisma 5.x: Enhanced client options
  // Prisma 7.x: driver adapters are mandatory at runtime (see lib/db/prisma.ts);
  // `adapter` is typed loosely here since this stub only needs to satisfy the
  // compiler, never actually construct a working client.
  export type PrismaClientOptions = {
    datasources?: {
      db?: {
        url?: string;
      };
    };
    adapter?: unknown;
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

    // Transaction support (Prisma 6.x)
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
    drawing: ModelDelegate<Drawing>;
    drawingAlert: ModelDelegate<DrawingAlert>;
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
    marketDataV6: ModelDelegate<MarketDataV6>;
    marketCycle: ModelDelegate<MarketCycle>;
    activeIndicatorSetting: ModelDelegate<ActiveIndicatorSetting>;
    symbolSpec: ModelDelegate<SymbolSpec>;
    cycleEvent: ModelDelegate<CycleEvent>;
    mcdOutput: ModelDelegate<McdOutput>;
    marketCycleInput: ModelDelegate<MarketCycleInput>;
    stateStatistic: ModelDelegate<StateStatistic>;
    synthesisReading: ModelDelegate<SynthesisReading>;
    entryZone: ModelDelegate<EntryZone>;
    userTradePreferences: ModelDelegate<UserTradePreferences>;
    userTradePreferencesHistory: ModelDelegate<UserTradePreferencesHistory>;
    tradeConsentRecord: ModelDelegate<TradeConsentRecord>;
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
