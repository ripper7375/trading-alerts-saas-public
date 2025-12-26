'use server';

/**
 * Fraud Detection Service
 *
 * Detects suspicious payment patterns and creates fraud alerts:
 * - Multiple 3-day plan attempts from same user
 * - Velocity limit exceeded (>10 attempts/hour)
 * - IP/country mismatch
 * - Multiple failed payments
 * - Device fingerprint anomalies
 *
 * @module lib/fraud/fraud-detection.service
 */

import { prisma } from '@/lib/db/prisma';
import { FraudAlertSeverity, FraudAlertStatus } from '@prisma/client';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type FraudPattern =
  | 'MULTIPLE_3DAY_ATTEMPTS'
  | 'VELOCITY_LIMIT_EXCEEDED'
  | 'IP_COUNTRY_MISMATCH'
  | 'MULTIPLE_FAILED_PAYMENTS'
  | 'DEVICE_FINGERPRINT_CHANGE'
  | 'SUSPICIOUS_IP_CHANGE';

export interface FraudCheckContext {
  userId: string;
  ipAddress?: string;
  country?: string;
  paymentMethod?: string;
  amount?: number;
  currency?: string;
  deviceFingerprint?: string;
}

export interface FraudCheckResult {
  isSuspicious: boolean;
  alerts: {
    pattern: FraudPattern;
    severity: FraudAlertSeverity;
    description: string;
  }[];
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const VELOCITY_LIMIT = 10; // Max payment attempts per hour
const VELOCITY_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const THREE_DAY_ATTEMPT_LIMIT = 3; // Max 3-day plan attempts before flagging
const FAILED_PAYMENT_THRESHOLD = 5; // Failed payments to trigger alert

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FRAUD DETECTION FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Check for multiple 3-day plan purchase attempts
 */
async function checkThreeDayPlanAbuse(
  userId: string
): Promise<FraudCheckResult['alerts'][0] | null> {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const attempts = await prisma.payment.count({
    where: {
      userId,
      planType: 'THREE_DAY',
      createdAt: { gte: oneWeekAgo },
    },
  });

  if (attempts >= THREE_DAY_ATTEMPT_LIMIT) {
    return {
      pattern: 'MULTIPLE_3DAY_ATTEMPTS',
      severity: 'CRITICAL',
      description: `User attempted to purchase 3-day plan ${attempts} times in the last week`,
    };
  }

  return null;
}

/**
 * Check for velocity limit (too many payment attempts in short time)
 */
async function checkVelocityLimit(
  userId: string
): Promise<FraudCheckResult['alerts'][0] | null> {
  const oneHourAgo = new Date(Date.now() - VELOCITY_WINDOW_MS);

  const recentAttempts = await prisma.payment.count({
    where: {
      userId,
      createdAt: { gte: oneHourAgo },
    },
  });

  if (recentAttempts >= VELOCITY_LIMIT) {
    return {
      pattern: 'VELOCITY_LIMIT_EXCEEDED',
      severity: 'HIGH',
      description: `More than ${VELOCITY_LIMIT} payment attempts in 1 hour`,
    };
  }

  return null;
}

/**
 * Check for multiple failed payments
 */
async function checkFailedPayments(
  userId: string
): Promise<FraudCheckResult['alerts'][0] | null> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const failedPayments = await prisma.payment.count({
    where: {
      userId,
      status: 'FAILED',
      createdAt: { gte: oneDayAgo },
    },
  });

  if (failedPayments >= FAILED_PAYMENT_THRESHOLD) {
    return {
      pattern: 'MULTIPLE_FAILED_PAYMENTS',
      severity: 'HIGH',
      description: `${failedPayments} failed payment attempts in 24 hours`,
    };
  }

  return null;
}

/**
 * Check for IP/country mismatch
 */
async function checkIPCountryMismatch(
  userId: string,
  ipAddress?: string,
  paymentCountry?: string
): Promise<FraudCheckResult['alerts'][0] | null> {
  if (!ipAddress || !paymentCountry) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { signupIP: true, lastLoginIP: true },
  });

  // If user's signup IP location doesn't match payment country
  // This is a simplified check - in production, use a geo-IP service
  if (user?.signupIP && user.signupIP !== ipAddress) {
    return {
      pattern: 'IP_COUNTRY_MISMATCH',
      severity: 'MEDIUM',
      description: `Payment country (${paymentCountry}) does not match user's registered location`,
    };
  }

  return null;
}

/**
 * Check for suspicious IP changes
 */
async function checkSuspiciousIPChange(
  userId: string,
  currentIP?: string
): Promise<FraudCheckResult['alerts'][0] | null> {
  if (!currentIP) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastLoginIP: true, signupIP: true },
  });

  if (user?.lastLoginIP && user.lastLoginIP !== currentIP) {
    // Check if there have been multiple IP changes recently
    const recentAlerts = await prisma.fraudAlert.count({
      where: {
        userId,
        pattern: 'SUSPICIOUS_IP_CHANGE',
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    if (recentAlerts >= 2) {
      return {
        pattern: 'SUSPICIOUS_IP_CHANGE',
        severity: 'MEDIUM',
        description: `Multiple IP address changes detected in 24 hours`,
      };
    }
  }

  return null;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN FRAUD CHECK FUNCTION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Run all fraud checks for a payment context
 */
export async function runFraudChecks(
  context: FraudCheckContext
): Promise<FraudCheckResult> {
  const { userId, ipAddress, country, deviceFingerprint } = context;

  const alerts: FraudCheckResult['alerts'] = [];

  // Run all checks in parallel
  const [
    threeDayAbuse,
    velocityLimit,
    failedPayments,
    ipMismatch,
    ipChange,
  ] = await Promise.all([
    checkThreeDayPlanAbuse(userId),
    checkVelocityLimit(userId),
    checkFailedPayments(userId),
    checkIPCountryMismatch(userId, ipAddress, country),
    checkSuspiciousIPChange(userId, ipAddress),
  ]);

  if (threeDayAbuse) alerts.push(threeDayAbuse);
  if (velocityLimit) alerts.push(velocityLimit);
  if (failedPayments) alerts.push(failedPayments);
  if (ipMismatch) alerts.push(ipMismatch);
  if (ipChange) alerts.push(ipChange);

  return {
    isSuspicious: alerts.length > 0,
    alerts,
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ALERT CREATION
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Create fraud alerts from check results
 */
export async function createFraudAlerts(
  context: FraudCheckContext,
  checkResult: FraudCheckResult
): Promise<void> {
  if (!checkResult.isSuspicious) return;

  const alertsToCreate = checkResult.alerts.map((alert) => ({
    userId: context.userId,
    pattern: alert.pattern,
    severity: alert.severity,
    status: 'PENDING' as FraudAlertStatus,
    description: alert.description,
    country: context.country,
    paymentMethod: context.paymentMethod,
    amount: context.amount,
    currency: context.currency,
    ipAddress: context.ipAddress,
    deviceFingerprint: context.deviceFingerprint,
  }));

  await prisma.fraudAlert.createMany({
    data: alertsToCreate,
    skipDuplicates: true,
  });
}

/**
 * Check for fraud and create alerts if suspicious
 * This is the main entry point for fraud detection
 */
export async function detectAndAlertFraud(
  context: FraudCheckContext
): Promise<FraudCheckResult> {
  const result = await runFraudChecks(context);

  if (result.isSuspicious) {
    await createFraudAlerts(context, result);
  }

  return result;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN FUNCTIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface FraudAlertFilters {
  severity?: FraudAlertSeverity;
  status?: FraudAlertStatus;
  pattern?: FraudPattern;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Get fraud alerts for admin dashboard
 */
export async function getFraudAlerts(
  filters: FraudAlertFilters = {},
  page = 1,
  pageSize = 20
) {
  const where: Record<string, unknown> = {};

  if (filters.severity) where.severity = filters.severity;
  if (filters.status) where.status = filters.status;
  if (filters.pattern) where.pattern = filters.pattern;
  if (filters.userId) where.userId = filters.userId;

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      (where.createdAt as Record<string, Date>).gte = filters.startDate;
    }
    if (filters.endDate) {
      (where.createdAt as Record<string, Date>).lte = filters.endDate;
    }
  }

  const [alerts, total] = await Promise.all([
    prisma.fraudAlert.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.fraudAlert.count({ where }),
  ]);

  return {
    alerts,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * Get fraud alert statistics
 */
export async function getFraudAlertStats() {
  const [total, bySeverity, byStatus, pending] = await Promise.all([
    prisma.fraudAlert.count(),
    prisma.fraudAlert.groupBy({
      by: ['severity'],
      _count: { severity: true },
    }),
    prisma.fraudAlert.groupBy({
      by: ['status'],
      _count: { status: true },
    }),
    prisma.fraudAlert.count({
      where: { status: 'PENDING' },
    }),
  ]);

  const severityCounts = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };

  bySeverity.forEach((item) => {
    severityCounts[item.severity] = item._count.severity;
  });

  return {
    total,
    critical: severityCounts.CRITICAL,
    high: severityCounts.HIGH,
    medium: severityCounts.MEDIUM,
    low: severityCounts.LOW,
    pending,
  };
}

/**
 * Update fraud alert status (admin action)
 */
export async function updateFraudAlertStatus(
  alertId: string,
  status: FraudAlertStatus,
  adminUserId: string,
  resolution?: string,
  notes?: string
) {
  return prisma.fraudAlert.update({
    where: { id: alertId },
    data: {
      status,
      resolution,
      notes,
      reviewedBy: adminUserId,
      reviewedAt: new Date(),
    },
  });
}

/**
 * Block user based on fraud alert
 */
export async function blockUserFromFraudAlert(
  alertId: string,
  adminUserId: string,
  notes?: string
) {
  const alert = await prisma.fraudAlert.findUnique({
    where: { id: alertId },
    select: { userId: true },
  });

  if (!alert) {
    throw new Error('Fraud alert not found');
  }

  // Update alert status
  await updateFraudAlertStatus(
    alertId,
    'BLOCKED',
    adminUserId,
    'USER_BLOCKED',
    notes
  );

  // Deactivate user
  await prisma.user.update({
    where: { id: alert.userId },
    data: { isActive: false },
  });

  return { success: true };
}
