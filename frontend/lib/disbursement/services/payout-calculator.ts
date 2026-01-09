/**
 * Payout Calculator Service (Part 19A)
 *
 * Calculates payout amounts, applies thresholds, and handles
 * fee calculations for commission disbursements.
 */

import type { CommissionAggregate } from '@/types/disbursement';
import { MINIMUM_PAYOUT_USD } from '../constants';

/**
 * Payout calculation result
 */
export interface PayoutCalculation {
  /** Whether the affiliate is eligible for payout */
  eligible: boolean;
  /** Gross amount before any fees */
  grossAmount: number;
  /** Any fees applied */
  feeAmount: number;
  /** Net amount to be paid */
  netAmount: number;
  /** Reason if not eligible */
  reason?: string;
}

/**
 * Batch payout summary
 */
export interface BatchPayoutSummary {
  /** Total number of affiliates in batch */
  affiliateCount: number;
  /** Number eligible for payout */
  eligibleCount: number;
  /** Number not eligible */
  ineligibleCount: number;
  /** Total gross amount */
  totalGrossAmount: number;
  /** Total fees */
  totalFeeAmount: number;
  /** Total net amount to pay */
  totalNetAmount: number;
  /** Individual calculations */
  calculations: Map<string, PayoutCalculation>;
}

/**
 * Payout calculator for commission disbursements
 */
export class PayoutCalculator {
  /**
   * Calculate payout for a single commission aggregate
   *
   * @param aggregate Commission aggregate data
   * @param feePercentage Optional fee percentage (0-100)
   * @returns Payout calculation result
   */
  static calculatePayout(
    aggregate: CommissionAggregate,
    feePercentage: number = 0
  ): PayoutCalculation {
    // Validate fee percentage
    if (feePercentage < 0 || feePercentage > 100) {
      throw new Error('Fee percentage must be between 0 and 100');
    }

    // Check minimum threshold
    if (aggregate.totalAmount < MINIMUM_PAYOUT_USD) {
      return {
        eligible: false,
        grossAmount: aggregate.totalAmount,
        feeAmount: 0,
        netAmount: 0,
        reason: `Below minimum payout threshold of $${MINIMUM_PAYOUT_USD}`,
      };
    }

    // Check if there are any commissions
    if (aggregate.commissionCount === 0) {
      return {
        eligible: false,
        grossAmount: 0,
        feeAmount: 0,
        netAmount: 0,
        reason: 'No approved commissions to pay',
      };
    }

    // Calculate fee and net amount
    const feeAmount = PayoutCalculator.applyFee(
      aggregate.totalAmount,
      feePercentage
    );
    const netAmount = aggregate.totalAmount - feeAmount;

    return {
      eligible: true,
      grossAmount: aggregate.totalAmount,
      feeAmount,
      netAmount,
    };
  }

  /**
   * Calculate total for a batch of aggregates
   *
   * @param aggregates Array of commission aggregates
   * @param feePercentage Optional fee percentage (0-100)
   * @returns Batch payout summary
   */
  static calculateBatchTotal(
    aggregates: CommissionAggregate[],
    feePercentage: number = 0
  ): BatchPayoutSummary {
    const calculations = new Map<string, PayoutCalculation>();

    let eligibleCount = 0;
    let ineligibleCount = 0;
    let totalGrossAmount = 0;
    let totalFeeAmount = 0;
    let totalNetAmount = 0;

    for (const aggregate of aggregates) {
      const calculation = PayoutCalculator.calculatePayout(
        aggregate,
        feePercentage
      );

      calculations.set(aggregate.affiliateId, calculation);

      if (calculation.eligible) {
        eligibleCount++;
        totalGrossAmount += calculation.grossAmount;
        totalFeeAmount += calculation.feeAmount;
        totalNetAmount += calculation.netAmount;
      } else {
        ineligibleCount++;
      }
    }

    return {
      affiliateCount: aggregates.length,
      eligibleCount,
      ineligibleCount,
      totalGrossAmount: PayoutCalculator.roundUsd(totalGrossAmount),
      totalFeeAmount: PayoutCalculator.roundUsd(totalFeeAmount),
      totalNetAmount: PayoutCalculator.roundUsd(totalNetAmount),
      calculations,
    };
  }

  /**
   * Apply a fee to an amount
   *
   * @param amount Amount to apply fee to
   * @param feePercentage Fee percentage (0-100)
   * @returns Fee amount
   */
  static applyFee(amount: number, feePercentage: number): number {
    if (feePercentage <= 0) {
      return 0;
    }

    const fee = amount * (feePercentage / 100);
    return PayoutCalculator.roundUsd(fee);
  }

  /**
   * Calculate the net amount after fees
   *
   * @param amount Gross amount
   * @param feePercentage Fee percentage (0-100)
   * @returns Net amount after fees
   */
  static calculateNetAmount(amount: number, feePercentage: number): number {
    const fee = PayoutCalculator.applyFee(amount, feePercentage);
    return PayoutCalculator.roundUsd(amount - fee);
  }

  /**
   * Round a USD amount to 2 decimal places
   *
   * @param amount Amount to round
   * @returns Rounded amount
   */
  static roundUsd(amount: number): number {
    return Math.round(amount * 100) / 100;
  }

  /**
   * Check if an amount meets the minimum payout threshold
   *
   * @param amount Amount to check
   * @returns true if amount meets minimum
   */
  static meetsMinimumThreshold(amount: number): boolean {
    return amount >= MINIMUM_PAYOUT_USD;
  }

  /**
   * Get the minimum payout threshold
   *
   * @returns Minimum payout amount in USD
   */
  static getMinimumThreshold(): number {
    return MINIMUM_PAYOUT_USD;
  }

  /**
   * Calculate how much more is needed to reach minimum threshold
   *
   * @param currentAmount Current pending amount
   * @returns Amount needed to reach minimum, or 0 if already met
   */
  static amountToMinimum(currentAmount: number): number {
    if (currentAmount >= MINIMUM_PAYOUT_USD) {
      return 0;
    }
    return PayoutCalculator.roundUsd(MINIMUM_PAYOUT_USD - currentAmount);
  }

  /**
   * Validate batch payment request amounts
   *
   * @param amounts Array of amounts to validate
   * @returns Validation result with any errors
   */
  static validateBatchAmounts(amounts: number[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    for (let i = 0; i < amounts.length; i++) {
      const amount = amounts[i];

      if (amount === undefined) {
        errors.push(`Amount at index ${i} is undefined`);
        continue;
      }

      if (!Number.isFinite(amount)) {
        errors.push(`Amount at index ${i} is not a valid number: ${amount}`);
        continue;
      }

      if (amount < 0) {
        errors.push(`Amount at index ${i} is negative: ${amount}`);
        continue;
      }

      if (amount < MINIMUM_PAYOUT_USD) {
        errors.push(
          `Amount at index ${i} (${amount}) is below minimum threshold of ${MINIMUM_PAYOUT_USD}`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Format a payout calculation as a summary string
   *
   * @param calculation Payout calculation
   * @returns Human-readable summary
   */
  static formatCalculation(calculation: PayoutCalculation): string {
    if (!calculation.eligible) {
      return `Not eligible: ${calculation.reason}`;
    }

    if (calculation.feeAmount > 0) {
      return `$${calculation.grossAmount.toFixed(2)} - $${calculation.feeAmount.toFixed(2)} fee = $${calculation.netAmount.toFixed(2)} net`;
    }

    return `$${calculation.netAmount.toFixed(2)} (no fees)`;
  }
}
