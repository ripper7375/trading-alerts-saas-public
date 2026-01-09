/**
 * Transaction Logger Service (Part 19B)
 *
 * Provides audit trail logging for disbursement operations.
 * Logs batch creation, execution, payment success/failure events.
 */

import { PrismaClient, AuditLogStatus, Prisma } from '@prisma/client';

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
   * Log an audit entry
   *
   * @param entry Audit log entry data
   */
  async log(entry: AuditLogEntry): Promise<void> {
    await this.prisma.disbursementAuditLog.create({
      data: {
        action: entry.action,
        status: entry.status,
        details: (entry.details || {}) as Prisma.InputJsonValue,
        transactionId: entry.transactionId,
        batchId: entry.batchId,
        actor: entry.actor,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    });
  }

  /**
   * Log batch creation event
   *
   * @param batchId Batch ID
   * @param actor Optional actor ID (admin user)
   * @param details Optional additional details
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
   * Log batch execution result
   *
   * @param batchId Batch ID
   * @param result Execution result
   */
  async logBatchExecuted(
    batchId: string,
    result: { success: boolean; message?: string }
  ): Promise<void> {
    await this.log({
      action: 'batch.executed',
      status: result.success ? 'SUCCESS' : 'FAILURE',
      batchId,
      details: { message: result.message },
    });
  }

  /**
   * Log batch queued for processing
   *
   * @param batchId Batch ID
   */
  async logBatchQueued(batchId: string): Promise<void> {
    await this.log({
      action: 'batch.queued',
      status: 'INFO',
      batchId,
    });
  }

  /**
   * Log batch cancellation
   *
   * @param batchId Batch ID
   * @param actor Optional actor ID
   * @param reason Optional cancellation reason
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
   * @param transactionId Transaction ID
   * @param amount Payment amount
   * @param providerTxId Optional provider transaction ID
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
   * Log payment failure
   *
   * @param transactionId Transaction ID
   * @param error Error message
   * @param retryable Whether the payment can be retried
   */
  async logPaymentFailed(
    transactionId: string,
    error: string,
    retryable: boolean = false
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
   * @param transactionId Transaction ID
   * @param retryCount Current retry count
   */
  async logPaymentRetry(
    transactionId: string,
    retryCount: number
  ): Promise<void> {
    await this.log({
      action: 'payment.retry',
      status: 'INFO',
      transactionId,
      details: { retryCount },
    });
  }

  /**
   * Log max retries exceeded
   *
   * @param transactionId Transaction ID
   * @param maxAttempts Maximum attempts reached
   */
  async logMaxRetriesExceeded(
    transactionId: string,
    maxAttempts: number
  ): Promise<void> {
    await this.log({
      action: 'payment.max_retries_exceeded',
      status: 'FAILURE',
      transactionId,
      details: { maxAttempts },
    });
  }

  /**
   * Get audit logs for a batch
   *
   * @param batchId Batch ID
   * @param limit Optional limit
   * @returns Array of audit logs
   */
  async getBatchLogs(batchId: string, limit: number = 100) {
    return this.prisma.disbursementAuditLog.findMany({
      where: { batchId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get audit logs for a transaction
   *
   * @param transactionId Transaction ID
   * @param limit Optional limit
   * @returns Array of audit logs
   */
  async getTransactionLogs(transactionId: string, limit: number = 100) {
    return this.prisma.disbursementAuditLog.findMany({
      where: { transactionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
