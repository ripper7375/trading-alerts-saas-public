/**
 * Payment Provider Factory (Part 19A)
 *
 * Factory for creating payment provider instances based on configuration.
 * Supports MOCK provider for testing and RISE provider for production.
 */

import type { DisbursementProvider } from '@/types/disbursement';
import { PaymentProvider } from './base-provider';
import { MockPaymentProvider, MockProviderConfig } from './mock-provider';
import { getDefaultProvider, isValidProvider } from '../constants';

/**
 * Configuration for provider factory
 */
export interface ProviderFactoryConfig {
  /** Mock provider configuration */
  mockConfig?: MockProviderConfig;
  /** Rise provider configuration (to be added in Phase C) */
  riseConfig?: {
    apiBaseUrl: string;
    walletAddress: string;
    privateKey: string;
    teamId: string;
    webhookSecret: string;
  };
}

/**
 * Create a payment provider instance
 *
 * @param providerType Optional provider type. If not specified, uses environment config
 * @param config Optional provider-specific configuration
 * @returns PaymentProvider instance
 * @throws Error if provider type is invalid or not implemented
 */
export function createPaymentProvider(
  providerType?: DisbursementProvider,
  config?: ProviderFactoryConfig
): PaymentProvider {
  const provider = providerType ?? getDefaultProvider();

  if (!isValidProvider(provider)) {
    throw new Error(`Unsupported payment provider: ${provider}`);
  }

  switch (provider) {
    case 'MOCK':
      return new MockPaymentProvider(config?.mockConfig);

    case 'RISE':
      // RisePaymentProvider will be implemented in Phase C
      // For now, throw a clear error message
      throw new Error(
        'RISE provider is not yet implemented. Use MOCK provider for development or wait for Phase C implementation.'
      );

    default:
      // This should never happen due to isValidProvider check, but TypeScript likes exhaustive checks
      throw new Error(`Unknown payment provider: ${provider}`);
  }
}

/**
 * Get the name of the default provider
 */
export function getDefaultProviderName(): DisbursementProvider {
  return getDefaultProvider();
}

/**
 * Check if a provider is available/implemented
 */
export function isProviderAvailable(provider: DisbursementProvider): boolean {
  switch (provider) {
    case 'MOCK':
      return true;
    case 'RISE':
      // Will return true after Phase C implementation
      return false;
    default:
      return false;
  }
}

/**
 * Get list of all available providers
 */
export function getAvailableProviders(): DisbursementProvider[] {
  const providers: DisbursementProvider[] = [];

  if (isProviderAvailable('MOCK')) {
    providers.push('MOCK');
  }

  if (isProviderAvailable('RISE')) {
    providers.push('RISE');
  }

  return providers;
}
