/**
 * RiseWorks Amount Converter (Part 19A)
 *
 * Handles conversion between USD amounts and RiseWorks 1e6 units.
 * RiseWorks uses USDC which has 6 decimal places.
 *
 * Examples:
 * - $50.00 USD = 50,000,000 RiseWorks units
 * - $0.01 USD = 10,000 RiseWorks units
 */

import { usdToRiseUnits, riseUnitsToUsd, RISE_AMOUNT_FACTOR } from '../../constants';

/**
 * Amount converter utility for RiseWorks payments
 */
export class AmountConverter {
  /**
   * Convert USD amount to RiseWorks units (1e6)
   *
   * @param usdAmount Amount in USD (e.g., 50.00)
   * @returns Amount in RiseWorks units as bigint (e.g., 50000000n)
   */
  static toRiseUnits(usdAmount: number): bigint {
    if (!AmountConverter.validateAmount(usdAmount)) {
      throw new Error(`Invalid amount: ${usdAmount}`);
    }
    return usdToRiseUnits(usdAmount);
  }

  /**
   * Convert RiseWorks units to USD amount
   *
   * @param riseUnits Amount in RiseWorks units (e.g., 50000000n)
   * @returns Amount in USD (e.g., 50.00)
   */
  static fromRiseUnits(riseUnits: bigint): number {
    if (riseUnits < 0n) {
      throw new Error('RiseWorks units cannot be negative');
    }
    return riseUnitsToUsd(riseUnits);
  }

  /**
   * Validate that an amount is valid for payment
   *
   * @param amount Amount to validate
   * @returns true if amount is valid
   */
  static validateAmount(amount: number): boolean {
    // Must be a finite positive number
    if (!Number.isFinite(amount)) {
      return false;
    }

    if (amount < 0) {
      return false;
    }

    // Check for precision issues (more than 6 decimal places)
    const decimalPart = amount.toString().split('.')[1];
    if (decimalPart && decimalPart.length > 6) {
      return false;
    }

    return true;
  }

  /**
   * Round USD amount to 2 decimal places
   *
   * @param amount Amount to round
   * @returns Rounded amount
   */
  static roundUsd(amount: number): number {
    return Math.round(amount * 100) / 100;
  }

  /**
   * Format USD amount for display
   *
   * @param amount Amount in USD
   * @returns Formatted string (e.g., "$50.00")
   */
  static formatUsd(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }

  /**
   * Get the conversion factor
   */
  static getConversionFactor(): number {
    return RISE_AMOUNT_FACTOR;
  }

  /**
   * Calculate the minimum representable amount in USD
   * (one unit in RiseWorks terms)
   */
  static getMinimumAmount(): number {
    return 1 / RISE_AMOUNT_FACTOR;
  }
}
