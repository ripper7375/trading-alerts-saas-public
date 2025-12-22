/**
 * Transaction Logger Service (Part 19B)
 *
 * Provides audit trail logging for all disbursement operations.
 * Logs batch creation, execution, payment success/failure, and retries.
 */

import type { PrismaClient, AuditLogStatus, Prisma, DisbursementAuditLog } from '@prisma/client';

/**
 * Audit log entry interface
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
   * Create an audit log entry
   *
   * @param entry Audit log data
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.disbursementAuditLog.create({
        data: {
          action: entry.action,
          status: entry.status,
          details: (entry.details ?? {}) as Prisma.InputJsonValue,
          transactionId: entry.transactionId,
          batchId: entry.batchId,
          actor: entry.actor,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        },
      });
    } catch (error) {
      // Log to console but don't throw - audit logging should not break operations
      console.error('Failed to create audit log entry:', error);
    }
  }

  /**
   * Log batch creation
   *
   * @param batchId The batch ID
   * @param actor The user who created the batch
   * @param details Additional details
   */
  async logBatchCreated(
    batchId: string,
    actor?: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      action: 'batch.created',
      status: 'SUCCESS',
      batchId,
      actor,
      details,
    });
  }

  /**
   * Log batch queued for execution
   *
   * @param batchId The batch ID
   * @param actor The user who queued the batch
   */
  async logBatchQueued(batchId: string, actor?: string): Promise<void> {
    await this.log({
      action: 'batch.queued',
      status: 'INFO',
      batchId,
      actor,
    });
  }

  /**
   * Log batch execution started
   *
   * @param batchId The batch ID
   */
  async logBatchExecutionStarted(batchId: string): Promise<void> {
    await this.log({
      action: 'batch.execution_started',
      status: 'INFO',
      batchId,
    });
  }

  /**
   * Log batch execution completed
   *
   * @param batchId The batch ID
   * @param result Execution result
   */
  async logBatchExecuted(
    batchId: string,
    result: { success: boolean; message?: string; successCount?: number; failedCount?: number }
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
   * Log batch cancelled
   *
   * @param batchId The batch ID
   * @param actor The user who cancelled the batch
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
   * Log payment completed successfully
   *
   * @param transactionId The transaction ID
   * @param amount Payment amount
   * @param providerTxId Provider transaction ID
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
      details: { amount, providerTxId },
    });
  }

  /**
   * Log payment failed
   *
   * @param transactionId The transaction ID
   * @param error Error message
   * @param retryable Whether the payment can be retried
   */
  async logPaymentFailed(
    transactionId: string,
    error: string,
    retryable: boolean = true
  ): Promise<void> {
    await this.log({
      action: 'payment.failed',
      status: 'FAILURE',
      transactionId,
      details: { error, retryable },
    });
  }

  /**
   * Log payment retry attempt
   *
   * @param transactionId The transaction ID
   * @param attempt Current attempt number
   * @param maxAttempts Maximum attempts allowed
   */
  async logPaymentRetry(
    transactionId: string,
    attempt: number,
    maxAttempts: number
  ): Promise<void> {
    await this.log({
      action: 'payment.retry',
      status: 'INFO',
      transactionId,
      details: { attempt, maxAttempts },
    });
  }

  /**
   * Log max retries exceeded
   *
   * @param transactionId The transaction ID
   * @param attempts Total attempts made
   */
  async logMaxRetriesExceeded(
    transactionId: string,
    attempts: number
  ): Promise<void> {
    await this.log({
      action: 'payment.max_retries_exceeded',
      status: 'FAILURE',
      transactionId,
      details: { attempts },
    });
  }

  /**
   * Log commission status update
   *
   * @param transactionId The transaction ID
   * @param commissionId The commission ID
   * @param newStatus The new status
   */
  async logCommissionStatusUpdate(
    transactionId: string,
    commissionId: string,
    newStatus: string
  ): Promise<void> {
    await this.log({
      action: 'commission.status_updated',
      status: 'SUCCESS',
      transactionId,
      details: { commissionId, newStatus },
    });
  }

  /**
   * Log webhook received
   *
   * @param eventType Webhook event type
   * @param transactionId Related transaction ID
   * @param verified Whether the webhook was verified
   */
  async logWebhookReceived(
    eventType: string,
    transactionId?: string,
    verified: boolean = true
  ): Promise<void> {
    await this.log({
      action: 'webhook.received',
      status: verified ? 'SUCCESS' : 'WARNING',
      transactionId,
      details: { eventType, verified },
    });
  }

  /**
   * Get audit logs for a batch
   *
   * @param batchId The batch ID
   * @param limit Maximum number of logs to return
   */
  async getBatchLogs(batchId: string, limit: number = 100): Promise<AuditLogEntry[]> {
    const logs = await this.prisma.disbursementAuditLog.findMany({
      where: { batchId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return logs.map((log: DisbursementAuditLog) => ({
      action: log.action,
      status: log.status,
      details: log.details as Record<string, unknown> | undefined,
      transactionId: log.transactionId ?? undefined,
      batchId: log.batchId ?? undefined,
      actor: log.actor ?? undefined,
      ipAddress: log.ipAddress ?? undefined,
      userAgent: log.userAgent ?? undefined,
    }));
  }

  /**
   * Get audit logs for a transaction
   *
   * @param transactionId The transaction ID
   * @param limit Maximum number of logs to return
   */
  async getTransactionLogs(transactionId: string, limit: number = 50): Promise<AuditLogEntry[]> {
    const logs = await this.prisma.disbursementAuditLog.findMany({
      where: { transactionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return logs.map((log: DisbursementAuditLog) => ({
      action: log.action,
      status: log.status,
      details: log.details as Record<string, unknown> | undefined,
      transactionId: log.transactionId ?? undefined,
      batchId: log.batchId ?? undefined,
      actor: log.actor ?? undefined,
      ipAddress: log.ipAddress ?? undefined,
      userAgent: log.userAgent ?? undefined,
    }));
  }
}
