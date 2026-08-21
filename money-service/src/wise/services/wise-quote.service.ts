/**
 * Wise Quote Service (Session 4A-W6, File 2/8)
 *
 * Creates authenticated Wise transfer quotes (`02-…reference.md` §4.1,
 * `POST /v3/profiles/{profileId}/quotes`).
 *
 * F38 (`DECISION-LOG.md`, RESOLVED Session 4A-W2, binding): the platform
 * absorbs the Wise fee, so the caller always fixes the leg that represents
 * the affiliate's exact earned USD commission and lets the other leg float
 * to cover the fee (F47, Session 4A-15): USD->USD payouts fix `targetAmount`;
 * USD->non-USD payouts fix `sourceAmount` (the USD amount actually earned),
 * letting Wise convert it at the current rate rather than misreading a raw
 * USD figure as if it were already in the target currency.
 */

import { Injectable } from '@nestjs/common';

import { WiseApiClient } from '../wise-api.client';
import { WiseConfig } from '../wise.config';

/** F38's binding decision — not runtime-configurable, same convention as
 * `WISE_SOURCE_CURRENCY` in `wise-recipients.controller.ts` (a platform
 * decision, not a bank field). */
const FEE_BEARER = 'PLATFORM' as const;

export interface CreateQuoteInput {
  sourceCurrency: string;
  targetCurrency: string;
  /** Fixed source-side USD amount (F47: USD->non-USD payouts). Mutually
   * exclusive with `targetAmount`. */
  sourceAmount?: number;
  /** Fixed target-side amount (F38: USD->USD payouts, affiliate receives
   * exactly this). Mutually exclusive with `sourceAmount`. */
  targetAmount?: number;
  /** Wise recipient id (`AffiliateWiseRecipient.wiseRecipientId`). */
  targetAccountId: string;
}

export interface WiseQuoteResult {
  quoteId: string;
  sourceCurrency: string;
  targetCurrency: string;
  sourceValue: number;
  targetValue: number;
  rate: number;
  feeAmount: number;
  feeBearer: typeof FEE_BEARER;
}

interface WisePaymentOption {
  disabled?: boolean;
  sourceAmount?: number;
  targetAmount?: number;
  fee?: { total?: number };
}

interface WiseQuoteResponse {
  id: string;
  sourceCurrency: string;
  targetCurrency: string;
  sourceAmount: number;
  targetAmount: number;
  rate: number;
  paymentOptions?: WisePaymentOption[];
}

@Injectable()
export class WiseQuoteService {
  constructor(
    private readonly wiseApiClient: WiseApiClient,
    private readonly wiseConfig: WiseConfig
  ) {}

  async createQuote(input: CreateQuoteInput): Promise<WiseQuoteResult> {
    const response = await this.wiseApiClient.request<WiseQuoteResponse>(
      `/v3/profiles/${this.wiseConfig.profileId}/quotes`,
      {
        method: 'POST',
        body: {
          sourceCurrency: input.sourceCurrency,
          targetCurrency: input.targetCurrency,
          ...(input.sourceAmount !== undefined
            ? { sourceAmount: input.sourceAmount }
            : { targetAmount: input.targetAmount }),
          targetAccount: Number(input.targetAccountId),
        },
      }
    );

    const selectedOption = response.paymentOptions?.find(
      (option) => !option.disabled
    );

    return {
      quoteId: response.id,
      sourceCurrency: response.sourceCurrency,
      targetCurrency: response.targetCurrency,
      sourceValue: selectedOption?.sourceAmount ?? response.sourceAmount,
      targetValue: selectedOption?.targetAmount ?? response.targetAmount,
      rate: response.rate,
      feeAmount: selectedOption?.fee?.total ?? 0,
      feeBearer: FEE_BEARER,
    };
  }
}
