/**
 * Base Payment Provider Interface (Part 19A)
 *
 * Abstract class defining the contract for all payment providers.
 * Implementations include MockPaymentProvider and RisePaymentProvider.
 */

import type {
  AuthToken,
  PaymentRequest,
  PaymentResult,
  BatchPaymentResult,
  DisbursementTransactionStatus,
  PayeeInfo,
} from '@/types/disbursement';

/**
 * Abstract base class for payment providers
 */
export abstract class PaymentProvider {
  /**
   * Provider name identifier
   */
  abstract readonly name: string;

  /**
   * Authenticate with the payment provider
   * @returns Authentication token with expiration
   */
  abstract authenticate(): Promise<AuthToken>;

  /**
   * Send a single payment to an affiliate
   * @param request Payment details
   * @returns Payment result with transaction ID and status
   */
  abstract sendPayment(request: PaymentRequest): Promise<PaymentResult>;

  /**
   * Send multiple payments in a batch
   * @param requests Array of payment requests
   * @returns Batch result with individual payment results
   */
  abstract sendBatchPayment(
    requests: PaymentRequest[]
  ): Promise<BatchPaymentResult>;

  /**
   * Get the current status of a payment transaction
   * @param transactionId The transaction ID to query
   * @returns Current transaction status
   */
  abstract getPaymentStatus(
    transactionId: string
  ): Promise<DisbursementTransactionStatus>;

  /**
   * Get payee information by their Rise ID
   * @param riseId The payee's RiseWorks blockchain address
   * @returns Payee information including KYC status
   */
  abstract getPayeeInfo(riseId: string): Promise<PayeeInfo>;

  /**
   * Verify a webhook signature
   * @param payload Raw webhook payload string
   * @param signature Signature from webhook header
   * @returns Whether the signature is valid
   */
  abstract verifyWebhook(payload: string, signature: string): boolean;
}

/**
 * Custom error class for payment provider errors
 */
export class PaymentProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly provider: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'PaymentProviderError';

    // Maintains proper stack trace for V8 engines
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PaymentProviderError);
    }
  }

  /**
   * Create a network error (retryable)
   */
  static networkError(provider: string, originalError?: Error): PaymentProviderError {
    return new PaymentProviderError(
      originalError?.message ?? 'Network error occurred',
      'NETWORK_ERROR',
      provider,
      true
    );
  }

  /**
   * Create an authentication error (not retryable)
   */
  static authenticationError(provider: string, message?: string): PaymentProviderError {
    return new PaymentProviderError(
      message ?? 'Authentication failed',
      'AUTH_ERROR',
      provider,
      false
    );
  }

  /**
   * Create a validation error (not retryable)
   */
  static validationError(provider: string, message: string): PaymentProviderError {
    return new PaymentProviderError(
      message,
      'VALIDATION_ERROR',
      provider,
      false
    );
  }

  /**
   * Create an insufficient funds error (not retryable)
   */
  static insufficientFundsError(provider: string): PaymentProviderError {
    return new PaymentProviderError(
      'Insufficient funds for payment',
      'INSUFFICIENT_FUNDS',
      provider,
      false
    );
  }

  /**
   * Create a rate limit error (retryable)
   */
  static rateLimitError(provider: string): PaymentProviderError {
    return new PaymentProviderError(
      'Rate limit exceeded',
      'RATE_LIMIT',
      provider,
      true
    );
  }

  /**
   * Create a provider unavailable error (retryable)
   */
  static providerUnavailableError(provider: string): PaymentProviderError {
    return new PaymentProviderError(
      'Payment provider is temporarily unavailable',
      'PROVIDER_UNAVAILABLE',
      provider,
      true
    );
  }
}
