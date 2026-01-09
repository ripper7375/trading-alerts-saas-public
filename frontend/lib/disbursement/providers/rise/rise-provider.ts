/**
 * RiseWorks Payment Provider (Part 19A)
 *
 * Production payment provider using RiseWorks blockchain API.
 * Implements PaymentProvider interface for real USDC payments.
 *
 * Note: This is a skeleton implementation for Part 19A.
 * Full API integration will be completed in Part 19B.
 */

import { PaymentProvider, PaymentProviderError } from '../base-provider';
import type {
  AuthToken,
  PaymentRequest,
  PaymentResult,
  BatchPaymentResult,
  DisbursementTransactionStatus,
  PayeeInfo,
  RiseWorksApiConfig,
} from '@/types/disbursement';
import { SiweAuthenticator } from './siwe-auth';
import { WebhookVerifier } from './webhook-verifier';
import { AmountConverter } from './amount-converter';

/**
 * Configuration for RiseWorks provider
 */
export interface RiseProviderConfig extends RiseWorksApiConfig {
  /** Environment: 'production' or 'staging' */
  environment?: 'production' | 'staging';
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * RiseWorks payment provider implementation
 */
export class RisePaymentProvider extends PaymentProvider {
  readonly name = 'RISE';

  private readonly config: RiseProviderConfig;
  private readonly authenticator: SiweAuthenticator;
  private readonly webhookVerifier: WebhookVerifier;
  private authToken: AuthToken | null = null;

  constructor(config: RiseProviderConfig) {
    super();
    this.validateConfig(config);
    this.config = {
      ...config,
      environment: config.environment ?? 'staging',
      timeout: config.timeout ?? 30000,
    };

    this.authenticator = new SiweAuthenticator({
      walletAddress: config.walletAddress,
      privateKey: config.privateKey,
      apiBaseUrl: config.apiBaseUrl,
    });

    this.webhookVerifier = new WebhookVerifier(config.webhookSecret);
  }

  /**
   * Validate provider configuration
   */
  private validateConfig(config: RiseProviderConfig): void {
    const required = [
      'apiBaseUrl',
      'walletAddress',
      'privateKey',
      'teamId',
      'webhookSecret',
    ] as const;

    for (const field of required) {
      if (!config[field]) {
        throw new Error(`RiseWorks config missing required field: ${field}`);
      }
    }
  }

  /**
   * Authenticate with RiseWorks API
   */
  async authenticate(): Promise<AuthToken> {
    try {
      const result = await this.authenticator.authenticate(this.config.teamId);

      this.authToken = {
        token: result.token,
        expiresAt: result.expiresAt,
      };

      return this.authToken;
    } catch (error) {
      throw PaymentProviderError.authenticationError(
        this.name,
        error instanceof Error ? error.message : 'Authentication failed'
      );
    }
  }

  /**
   * Send a single payment
   *
   * Note: Full implementation in Part 19B
   */
  async sendPayment(request: PaymentRequest): Promise<PaymentResult> {
    // Validate request
    if (request.amount <= 0) {
      throw PaymentProviderError.validationError(
        this.name,
        'Payment amount must be greater than zero'
      );
    }

    if (!request.riseId) {
      throw PaymentProviderError.validationError(
        this.name,
        'Payee Rise ID is required'
      );
    }

    // Validate amount conversion (used in Part 19B for API calls)
    AmountConverter.toRiseUnits(request.amount);

    // Full API call implementation will be added in Part 19B
    throw new Error(
      'RiseWorks sendPayment API integration coming in Part 19B. Use MOCK provider for development.'
    );
  }

  /**
   * Send batch of payments
   *
   * Note: Full implementation in Part 19B
   */
  async sendBatchPayment(
    requests: PaymentRequest[]
  ): Promise<BatchPaymentResult> {
    if (requests.length === 0) {
      return {
        success: true,
        batchId: `rise-batch-empty-${Date.now()}`,
        totalAmount: 0,
        successCount: 0,
        failedCount: 0,
        results: [],
      };
    }

    // Full API call implementation will be added in Part 19B
    throw new Error(
      'RiseWorks sendBatchPayment API integration coming in Part 19B. Use MOCK provider for development.'
    );
  }

  /**
   * Get payment status by transaction ID
   *
   * Note: Full implementation in Part 19B
   */
  async getPaymentStatus(
    _transactionId: string
  ): Promise<DisbursementTransactionStatus> {
    // Full API call implementation will be added in Part 19B
    throw new Error(
      'RiseWorks getPaymentStatus API integration coming in Part 19B. Use MOCK provider for development.'
    );
  }

  /**
   * Get payee information by Rise ID
   *
   * Note: Full implementation in Part 19B
   */
  async getPayeeInfo(_riseId: string): Promise<PayeeInfo> {
    // Full API call implementation will be added in Part 19B
    throw new Error(
      'RiseWorks getPayeeInfo API integration coming in Part 19B. Use MOCK provider for development.'
    );
  }

  /**
   * Verify webhook signature
   */
  verifyWebhook(payload: string, signature: string): boolean {
    return this.webhookVerifier.verify(payload, signature);
  }

  /**
   * Get the current auth token (if authenticated)
   */
  getAuthToken(): AuthToken | null {
    return this.authToken;
  }

  /**
   * Check if the auth token is valid
   */
  isAuthenticated(): boolean {
    if (!this.authToken) {
      return false;
    }

    // Consider token invalid if it expires in less than 5 minutes
    const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;
    return this.authToken.expiresAt.getTime() > fiveMinutesFromNow;
  }

  /**
   * Get the API base URL being used
   */
  getApiBaseUrl(): string {
    return this.config.apiBaseUrl;
  }

  /**
   * Get the environment (production or staging)
   */
  getEnvironment(): 'production' | 'staging' {
    return this.config.environment ?? 'staging';
  }
}
