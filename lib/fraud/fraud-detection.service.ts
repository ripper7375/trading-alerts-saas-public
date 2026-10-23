/**
 * Fraud Alert Service (admin)
 *
 * Reads and updates the fraud alerts shown on the admin dashboard
 * (app/api/admin/fraud-alerts/**). Server-only, and it does no authorization
 * of its own: every caller must authorize first (requireAdmin()).
 *
 * @module lib/fraud/fraud-detection.service
 */

import 'server-only';

import { withSessionBump } from '@/lib/auth/session-version';
import { prisma } from '@/lib/db/prisma';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES (defined locally until Prisma migration is run)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type FraudAlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type FraudAlertStatus = 'PENDING' | 'REVIEWED' | 'DISMISSED' | 'BLOCKED';

export type FraudPattern =
  | 'MULTIPLE_3DAY_ATTEMPTS'
  | 'VELOCITY_LIMIT_EXCEEDED'
  | 'IP_COUNTRY_MISMATCH'
  | 'MULTIPLE_FAILED_PAYMENTS'
  | 'DEVICE_FINGERPRINT_CHANGE'
  | 'SUSPICIOUS_IP_CHANGE';

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

interface FraudAlertWhereClause {
  severity?: FraudAlertSeverity;
  status?: FraudAlertStatus;
  pattern?: FraudPattern;
  userId?: string;
  createdAt?: {
    gte?: Date;
    lte?: Date;
  };
}

/**
 * Get fraud alerts for admin dashboard
 */
export async function getFraudAlerts(
  filters: FraudAlertFilters = {},
  page = 1,
  pageSize = 20
) {
  const where: FraudAlertWhereClause = {};

  if (filters.severity) where.severity = filters.severity;
  if (filters.status) where.status = filters.status;
  if (filters.pattern) where.pattern = filters.pattern;
  if (filters.userId) where.userId = filters.userId;

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      where.createdAt.gte = filters.startDate;
    }
    if (filters.endDate) {
      where.createdAt.lte = filters.endDate;
    }
  }

  const [alertRows, total] = await Promise.all([
    prisma.fraudAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.fraudAlert.count({ where }),
  ]);

  // FraudAlert no longer carries a `user` relation (Session 2-3 FK audit) —
  // batch-fetch contact users separately by userId.
  const alertUsers = await prisma.user.findMany({
    where: { id: { in: alertRows.map((a) => a.userId) } },
    select: { id: true, email: true, name: true },
  });
  const alertUserById = new Map(alertUsers.map((u) => [u.id, u]));
  const alerts = alertRows.map((alert) => ({
    ...alert,
    user: alertUserById.get(alert.userId),
  }));

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
  const [total, bySeverity, pending] = await Promise.all([
    prisma.fraudAlert.count(),
    prisma.fraudAlert.groupBy({
      by: ['severity'],
      _count: { severity: true },
    }),
    prisma.fraudAlert.count({
      where: { status: 'PENDING' },
    }),
  ]);

  const severityCounts: Record<FraudAlertSeverity, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };

  for (const item of bySeverity) {
    const severity = (item as { severity: FraudAlertSeverity }).severity;
    const count = (item as { _count: { severity: number } })._count.severity;
    severityCounts[severity] = count;
  }

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

  // Deactivate user. Every session of the account ends with it (CODE-02B): the suspension, the
  // new session version and the deleted refresh tokens commit together, so a suspended account
  // cannot keep working on a token it already holds or mint a new one from a refresh token.
  await withSessionBump(alert.userId, (tx) =>
    tx.user.update({
      where: { id: alert.userId },
      data: { isActive: false },
      select: { id: true },
    })
  );

  return { success: true };
}
