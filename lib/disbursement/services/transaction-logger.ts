/**
 * Transaction Logger Service (Part 19B)
 *
 * Provides audit trail logging for all disbursement operations.
 * Logs batch creation, execution, payment completions, and failures.
 */

import { PrismaClient } from '@prisma/client';
import type { AuditLogStatus } from '@/types/disbursement';

/**
 * Audit log entry for disbursement operations
 */
export interface AuditLogEntry {
  action: string;
  status: AuditLogStatus;
  details?: Record<string, unknown>;
  transactionId?: string;
  batchId?: string;
  actor?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Transaction logger for disbursement audit trails
 */
export class TransactionLogger {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Log a generic audit entry
   *
   * @param entry Audit log entry details
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.disbursementAuditLog.create({
        data: {
          action: entry.action,
          status: entry.status,
          details: entry.details ?? {},
          transactionId: entry.transactionId,
          batchId: entry.batchId,
          actor: entry.actor,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        },
      });
    } catch (error) {
      // Log to console but don't throw - audit logging should not break operations
      console.error('Failed to write audit log:', error);
    }
  }

  /**
   * Log batch creation event
   *
   * @param batchId The created batch ID
   * @param actor User who created the batch
   * @param paymentCount Number of payments in batch
   * @param totalAmount Total amount in batch
   */
  async logBatchCreated(
    batchId: string,
    actor?: string,
    paymentCount?: number,
    totalAmount?: number
  ): Promise<void> {
    await this.log({
      action: 'batch.created',
      status: 'SUCCESS',
      batchId,
      actor,
      details: {
        paymentCount,
        totalAmount,
      },
    });
  }

  /**
   * Log batch execution start
   *
   * @param batchId The batch being executed
   * @param actor User who initiated execution
   */
  async logBatchExecutionStarted(
    batchId: string,
    actor?: string
  ): Promise<void> {
    await this.log({
      action: 'batch.execution_started',
      status: 'INFO',
      batchId,
      actor,
    });
  }

  /**
   * Log batch execution completion
   *
   * @param batchId The executed batch ID
   * @param result Execution result details
   */
  async logBatchExecuted(
    batchId: string,
    result: {
      success: boolean;
      message?: string;
      successCount?: number;
      failedCount?: number;
    }
  ): Promise<void> {
    await this.log({
      action: 'batch.executed',
      status: result.success ? 'SUCCESS' : 'FAILURE',
      batchId,
      details: {
        message: result.message,
        successCount: result.successCount,
        failedCount: result.failedCount,
      },
    });
  }

  /**
   * Log batch cancellation
   *
   * @param batchId The cancelled batch ID
   * @param actor User who cancelled the batch
   * @param reason Cancellation reason
   */
  async logBatchCancelled(
    batchId: string,
    actor?: string,
    reason?: string
  ): Promise<void> {
    await this.log({
      action: 'batch.cancelled',
      status: 'WARNING',
      batchId,
      actor,
      details: { reason },
    });
  }

  /**
   * Log successful payment completion
   *
   * @param transactionId The transaction ID
   * @param amount Payment amount
   * @param providerTxId Provider's transaction ID
   */
  async logPaymentCompleted(
    transactionId: string,
    amount: number,
    providerTxId?: string
  ): Promise<void> {
    await this.log({
      action: 'payment.completed',
      status: 'SUCCESS',
      transactionId,
      details: {
        amount,
        providerTxId,
      },
    });
  }

  /**
   * Log payment failure
   *
   * @param transactionId The transaction ID
   * @param error Error message
   * @param retryCount Current retry count
   */
  async logPaymentFailed(
    transactionId: string,
    error: string,
    retryCount?: number
  ): Promise<void> {
    await this.log({
      action: 'payment.failed',
      status: 'FAILURE',
      transactionId,
      details: {
        error,
        retryCount,
      },
    });
  }

  /**
   * Log payment retry attempt
   *
   * @param transactionId The transaction ID
   * @param attemptNumber The retry attempt number
   */
  async logPaymentRetry(
    transactionId: string,
    attemptNumber: number
  ): Promise<void> {
    await this.log({
      action: 'payment.retry',
      status: 'INFO',
      transactionId,
      details: {
        attemptNumber,
      },
    });
  }

  /**
   * Log max retries exceeded
   *
   * @param transactionId The transaction ID
   * @param maxAttempts Maximum attempts allowed
   */
  async logMaxRetriesExceeded(
    transactionId: string,
    maxAttempts: number
  ): Promise<void> {
    await this.log({
      action: 'payment.max_retries_exceeded',
      status: 'FAILURE',
      transactionId,
      details: {
        maxAttempts,
      },
    });
  }

  /**
   * Log webhook received
   *
   * @param eventType Webhook event type
   * @param transactionId Related transaction ID
   * @param data Webhook payload
   */
  async logWebhookReceived(
    eventType: string,
    transactionId?: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      action: `webhook.${eventType}`,
      status: 'INFO',
      transactionId,
      details: data,
    });
  }

  /**
   * Log commission status update
   *
   * @param commissionId The commission ID
   * @param fromStatus Previous status
   * @param toStatus New status
   * @param transactionId Related transaction ID
   */
  async logCommissionStatusChange(
    commissionId: string,
    fromStatus: string,
    toStatus: string,
    transactionId?: string
  ): Promise<void> {
    await this.log({
      action: 'commission.status_changed',
      status: 'INFO',
      transactionId,
      details: {
        commissionId,
        fromStatus,
        toStatus,
      },
    });
  }

  /**
   * Get audit logs for a batch
   *
   * @param batchId The batch ID
   * @param limit Maximum number of logs to return
   */
  async getLogsForBatch(
    batchId: string,
    limit: number = 100
  ): Promise<unknown[]> {
    return this.prisma.disbursementAuditLog.findMany({
      where: { batchId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get audit logs for a transaction
   *
   * @param transactionId The transaction ID
   * @param limit Maximum number of logs to return
   */
  async getLogsForTransaction(
    transactionId: string,
    limit: number = 100
  ): Promise<unknown[]> {
    return this.prisma.disbursementAuditLog.findMany({
      where: { transactionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get recent audit logs
   *
   * @param limit Maximum number of logs to return
   * @param action Optional action filter
   */
  async getRecentLogs(
    limit: number = 50,
    action?: string
  ): Promise<unknown[]> {
    return this.prisma.disbursementAuditLog.findMany({
      where: action ? { action: { contains: action } } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
