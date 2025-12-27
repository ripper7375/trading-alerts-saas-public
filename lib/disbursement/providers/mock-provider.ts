/**
 * Mock Payment Provider (Part 19A)
 *
 * A mock implementation of the PaymentProvider interface for testing
 * and development purposes. Simulates payment operations with
 * configurable behavior including failure rates and delays.
 */

import { PaymentProvider, PaymentProviderError } from './base-provider';
import type {
  AuthToken,
  PaymentRequest,
  PaymentResult,
  BatchPaymentResult,
  DisbursementTransactionStatus,
  PayeeInfo,
  RiseWorksKycStatus,
} from '@/types/disbursement';
import { generateTransactionId } from '../constants';

/**
 * Configuration options for MockPaymentProvider
 */
export interface MockProviderConfig {
  /** Probability of payment failure (0.0 to 1.0) */
  failureRate?: number;
  /** Simulated delay in milliseconds */
  delay?: number;
  /** Whether to log operations */
  verbose?: boolean;
}

/**
 * Mock payment provider for testing and development
 */
export class MockPaymentProvider extends PaymentProvider {
  readonly name = 'MOCK';

  private readonly config: Required<MockProviderConfig>;
  private readonly transactions: Map<string, DisbursementTransactionStatus>;
  private readonly payees: Map<string, PayeeInfo>;
  private authToken: AuthToken | null = null;

  constructor(config: MockProviderConfig = {}) {
    super();
    this.config = {
      failureRate: config.failureRate ?? 0.0,
      delay: config.delay ?? 100,
      verbose: config.verbose ?? false,
    };
    this.transactions = new Map();
    this.payees = new Map();
  }

  /**
   * Simulate network delay
   */
  private async simulateDelay(): Promise<void> {
    if (this.config.delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.config.delay));
    }
  }

  /**
   * Determine if current operation should fail based on failure rate
   */
  private shouldFail(): boolean {
    return Math.random() < this.config.failureRate;
  }

  /**
   * Log operation if verbose mode is enabled
   */
  private log(message: string): void {
    if (this.config.verbose) {
      console.log(`[MockPaymentProvider] ${message}`);
    }
  }

  /**
   * Authenticate with mock provider
   */
  async authenticate(): Promise<AuthToken> {
    await this.simulateDelay();
    this.log('Authenticating...');

    if (this.shouldFail()) {
      throw PaymentProviderError.authenticationError(
        this.name,
        'Mock authentication failure'
      );
    }

    this.authToken = {
      token: `mock-token-${Date.now()}`,
      expiresAt: new Date(Date.now() + 3600000), // 1 hour
    };

    this.log(`Authenticated with token: ${this.authToken.token}`);
    return this.authToken;
  }

  /**
   * Send a single payment
   */
  async sendPayment(request: PaymentRequest): Promise<PaymentResult> {
    await this.simulateDelay();
    this.log(`Sending payment of $${request.amount} to ${request.riseId}`);

    const transactionId = generateTransactionId();

    // Validate request
    if (request.amount <= 0) {
      this.transactions.set(transactionId, 'FAILED');
      return {
        success: false,
        transactionId,
        status: 'FAILED',
        amount: request.amount,
        error: 'Invalid amount: must be greater than zero',
      };
    }

    if (!request.riseId) {
      this.transactions.set(transactionId, 'FAILED');
      return {
        success: false,
        transactionId,
        status: 'FAILED',
        amount: request.amount,
        error: 'Invalid payee: riseId is required',
      };
    }

    // Simulate failure
    if (this.shouldFail()) {
      this.transactions.set(transactionId, 'FAILED');
      this.log(`Payment failed: ${transactionId}`);
      return {
        success: false,
        transactionId,
        status: 'FAILED',
        amount: request.amount,
        error: 'Simulated payment failure',
      };
    }

    // Success
    this.transactions.set(transactionId, 'COMPLETED');
    this.log(`Payment completed: ${transactionId}`);

    return {
      success: true,
      transactionId,
      providerTxId: `mock-provider-${transactionId}`,
      status: 'COMPLETED',
      amount: request.amount,
    };
  }

  /**
   * Send batch of payments
   */
  async sendBatchPayment(
    requests: PaymentRequest[]
  ): Promise<BatchPaymentResult> {
    await this.simulateDelay();
    this.log(`Sending batch of ${requests.length} payments`);

    if (requests.length === 0) {
      return {
        success: true,
        batchId: `mock-batch-${Date.now()}`,
        totalAmount: 0,
        successCount: 0,
        failedCount: 0,
        results: [],
      };
    }

    const results: PaymentResult[] = [];
    let totalAmount = 0;
    let successCount = 0;
    let failedCount = 0;

    for (const request of requests) {
      const result = await this.sendPayment(request);
      results.push(result);
      totalAmount += request.amount;

      if (result.success) {
        successCount++;
      } else {
        failedCount++;
      }
    }

    const batchId = `mock-batch-${Date.now()}`;
    this.log(
      `Batch ${batchId} completed: ${successCount}/${requests.length} successful`
    );

    return {
      success: failedCount === 0,
      batchId,
      totalAmount,
      successCount,
      failedCount,
      results,
    };
  }

  /**
   * Get payment status by transaction ID
   */
  async getPaymentStatus(
    transactionId: string
  ): Promise<DisbursementTransactionStatus> {
    await this.simulateDelay();
    this.log(`Getting status for transaction: ${transactionId}`);

    const status = this.transactions.get(transactionId);
    if (!status) {
      this.log(`Transaction not found: ${transactionId}`);
      return 'PENDING';
    }

    return status;
  }

  /**
   * Get payee information
   */
  async getPayeeInfo(riseId: string): Promise<PayeeInfo> {
    await this.simulateDelay();
    this.log(`Getting payee info for: ${riseId}`);

    // Check if payee exists in mock store
    const existingPayee = this.payees.get(riseId);
    if (existingPayee) {
      return existingPayee;
    }

    // Return default mock payee
    return {
      riseId,
      email: 'mock@example.com',
      kycStatus: 'APPROVED' as RiseWorksKycStatus,
      canReceivePayments: true,
    };
  }

  /**
   * Verify webhook signature
   * Mock provider always returns true for testing
   */
  verifyWebhook(_payload: string, _signature: string): boolean {
    this.log('Verifying webhook signature (mock: always true)');
    return true;
  }

  // ===== Test Helper Methods =====

  /**
   * Add a mock payee for testing
   */
  addMockPayee(payee: PayeeInfo): void {
    this.payees.set(payee.riseId, payee);
  }

  /**
   * Set a specific transaction status for testing
   */
  setTransactionStatus(
    transactionId: string,
    status: DisbursementTransactionStatus
  ): void {
    this.transactions.set(transactionId, status);
  }

  /**
   * Get all transactions (for testing)
   */
  getAllTransactions(): Map<string, DisbursementTransactionStatus> {
    return new Map(this.transactions);
  }

  /**
   * Clear all mock data
   */
  reset(): void {
    this.transactions.clear();
    this.payees.clear();
    this.authToken = null;
    this.log('Provider reset');
  }
}
