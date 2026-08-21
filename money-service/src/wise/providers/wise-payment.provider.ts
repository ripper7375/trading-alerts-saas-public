/**
 * Wise Payment Provider (Session 4A-W6, File 3/8)
 *
 * `WisePaymentProvider extends PaymentProvider implements FundableProvider`
 * per design §3.3. Satisfies the unchanged base class per §3.3's own
 * mapping table (`sendBatchPayment` delegates to `prepareBatch`+
 * `completeBatch`, every result `status: 'PENDING'` — successCount means
 * "successfully drafted", NOT "paid"; `getPayeeInfo`'s `riseId` field
 * carries a Wise recipient id, documented not renamed, per Hard Invariant
 * #3's I1 in the design doc).
 *
 * `base-provider.ts` (174 lines) is imported, never edited (Hard Invariant
 * #3 of this order).
 */

import { Injectable } from '@nestjs/common';
import type { DisbursementTransactionStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  PaymentProvider,
  PaymentProviderError,
} from '../../disbursement/providers/base-provider';
import type {
  AuthToken,
  PaymentRequest,
  PaymentResult,
  BatchPaymentResult,
  PayeeInfo,
} from '../../disbursement/disbursement.types';
import { WiseBatchGroupService } from '../services/wise-batch-group.service';
import { WiseQuoteService } from '../services/wise-quote.service';
import { WiseStateMapper } from '../services/wise-state.mapper';
import { WiseTransferService } from '../services/wise-transfer.service';
import { WiseApiClient } from '../wise-api.client';
import { WiseConfig } from '../wise.config';
import { WiseSignatureVerifier } from '../wise-signature.verifier';

import {
  CapabilityUnavailableError,
  type FundableProvider,
  type FundingMode,
  type PayInInstruction,
  type PrepareBatchInput,
  type PreparedBatch,
  type PreparedTransfer,
  type PreparedTransferFailure,
} from './provider-capabilities';

interface WiseTransferGetResponse {
  id: number;
  status?: string;
  state?: string;
}

interface WiseAccountGetResponse {
  id: number;
  accountHolderName: string;
  active: boolean;
}

@Injectable()
export class WisePaymentProvider
  extends PaymentProvider
  implements FundableProvider
{
  readonly name = 'WISE';

  constructor(
    private readonly prisma: PrismaService,
    private readonly wiseApiClient: WiseApiClient,
    private readonly wiseConfig: WiseConfig,
    private readonly wiseQuoteService: WiseQuoteService,
    private readonly wiseTransferService: WiseTransferService,
    private readonly wiseBatchGroupService: WiseBatchGroupService,
    private readonly wiseStateMapper: WiseStateMapper,
    private readonly wiseSignatureVerifier: WiseSignatureVerifier
  ) {
    super();
  }

  get fundingMode(): FundingMode {
    return this.wiseConfig.fundingMode;
  }

  // ── PaymentProvider (base-provider.ts) ────────────────────────────────

  async authenticate(): Promise<AuthToken> {
    // Model A: a static personal token, never expires from this side.
    return {
      token: this.wiseConfig.apiToken,
      expiresAt: new Date(Date.UTC(2099, 0, 1)),
    };
  }

  async sendPayment(request: PaymentRequest): Promise<PaymentResult> {
    const result = await this.sendBatchPayment([request]);
    const single = result.results[0];
    if (!single) {
      return {
        success: false,
        transactionId: request.commissionId,
        status: 'FAILED',
        amount: request.amount,
        error: 'Wise provider produced no result for single payment',
      };
    }
    return single;
  }

  /** Delegates to `prepareBatch`/`completeBatch` (design §3.3). Every
   * result is `status: 'PENDING'` -- `successCount` means "successfully
   * drafted", never "paid" (§3.4's semantic hazard this whole design exists
   * to prevent). */
  async sendBatchPayment(
    requests: PaymentRequest[]
  ): Promise<BatchPaymentResult> {
    const prepared = await this.prepareBatch({
      paymentBatchId:
        (requests[0]?.metadata?.['batchId'] as string | undefined) ?? '',
      batchName: `quickpay-${Date.now()}`,
      sourceCurrency: 'USD',
      items: requests.map((r) => ({
        commissionId: r.commissionId,
        affiliateProfileId: r.affiliateId,
        amount: r.amount,
      })),
    });

    const results: PaymentResult[] = prepared.transfers.map((t) => ({
      success: true,
      transactionId: t.commissionId,
      providerTxId: t.providerTransferId,
      status: 'PENDING' as DisbursementTransactionStatus,
      amount: t.sourceValue,
    }));
    for (const failure of prepared.failures) {
      results.push({
        success: false,
        transactionId: failure.commissionId,
        status: 'FAILED',
        amount: 0,
        error: failure.reason,
      });
    }

    return {
      success: prepared.failures.length === 0,
      batchId: prepared.providerBatchId,
      totalAmount: prepared.totalSourceAmount,
      successCount: prepared.transfers.length,
      failedCount: prepared.failures.length,
      results,
    };
  }

  async getPaymentStatus(
    transactionId: string
  ): Promise<DisbursementTransactionStatus> {
    const response = await this.wiseApiClient.request<WiseTransferGetResponse>(
      `/v1/transfers/${transactionId}`
    );
    const currentState = response.status ?? response.state ?? 'unknown';
    const mapping = this.wiseStateMapper.mapTransferState(currentState);
    return mapping.disbursementStatus ?? 'PROCESSING';
  }

  /** `riseId` carries a Wise recipient id — the field name is preserved
   * verbatim (I1, `base-provider.ts` stays byte-identical), not renamed. */
  async getPayeeInfo(riseId: string): Promise<PayeeInfo> {
    const response = await this.wiseApiClient.request<WiseAccountGetResponse>(
      `/v1/accounts/${riseId}`
    );
    return {
      riseId: String(response.id),
      email: '',
      kycStatus: response.active ? 'APPROVED' : 'PENDING',
      canReceivePayments: response.active,
    };
  }

  verifyWebhook(payload: string, signature: string): boolean {
    return this.wiseSignatureVerifier.verifySignature(
      payload,
      signature,
      this.wiseConfig.environment
    );
  }

  // ── FundableProvider ───────────────────────────────────────────────────

  async prepareBatch(input: PrepareBatchInput): Promise<PreparedBatch> {
    const batchGroup =
      await this.wiseBatchGroupService.getOrCreateForPaymentBatch(
        input.paymentBatchId,
        input.batchName,
        input.sourceCurrency
      );

    const transfers: PreparedTransfer[] = [];
    const failures: PreparedTransferFailure[] = [];
    let totalSourceAmount = 0;

    for (const item of input.items) {
      try {
        const recipient = await this.prisma.affiliateWiseRecipient.findUnique({
          where: { affiliateProfileId: item.affiliateProfileId },
        });
        if (!recipient || !recipient.wiseRecipientId) {
          failures.push({
            commissionId: item.commissionId,
            affiliateProfileId: item.affiliateProfileId,
            reason: 'No Wise recipient on file',
          });
          continue;
        }
        if (recipient.status !== 'ACTIVE') {
          failures.push({
            commissionId: item.commissionId,
            affiliateProfileId: item.affiliateProfileId,
            reason: `Wise recipient status is ${recipient.status}, not ACTIVE`,
          });
          continue;
        }

        const disbursementTransaction =
          await this.prisma.disbursementTransaction.findUnique({
            where: { commissionId: item.commissionId },
          });
        if (!disbursementTransaction) {
          failures.push({
            commissionId: item.commissionId,
            affiliateProfileId: item.affiliateProfileId,
            reason: 'No DisbursementTransaction row for this commission',
          });
          continue;
        }

        const quote = await this.wiseQuoteService.createQuote({
          sourceCurrency: input.sourceCurrency,
          targetCurrency: recipient.targetCurrency,
          // F47: item.amount is always the affiliate's earned commission in
          // USD. Fixing targetAmount for a non-USD recipient would misread
          // that USD figure as if it were already in the target currency.
          ...(recipient.targetCurrency === input.sourceCurrency
            ? { targetAmount: item.amount }
            : { sourceAmount: item.amount }),
          targetAccountId: recipient.wiseRecipientId,
        });

        const { transfer } =
          await this.wiseTransferService.createBatchGroupTransfer({
            disbursementTransactionId: disbursementTransaction.id,
            affiliateWiseRecipientId: recipient.id,
            wiseBatchGroupDbId: batchGroup.id,
            wiseBatchGroupId: batchGroup.wiseBatchGroupId,
            wiseQuoteId: quote.quoteId,
            targetAccountId: recipient.wiseRecipientId,
            reference: `DavinTrade commission ${input.batchName}`,
            sourceCurrency: quote.sourceCurrency,
            sourceValue: quote.sourceValue,
            targetCurrency: quote.targetCurrency,
            targetValue: quote.targetValue,
            rate: quote.rate,
            feeAmount: quote.feeAmount,
            feeBearer: quote.feeBearer,
          });

        await this.wiseBatchGroupService.recordTransferAdded(
          batchGroup.id,
          quote.sourceValue
        );
        totalSourceAmount += quote.sourceValue;

        transfers.push({
          commissionId: item.commissionId,
          affiliateProfileId: item.affiliateProfileId,
          providerTransferId: transfer.wiseTransferId,
          providerQuoteId: quote.quoteId,
          providerRecipientId: recipient.wiseRecipientId,
          idempotencyKey: transfer.customerTransactionId,
          sourceCurrency: quote.sourceCurrency,
          sourceValue: quote.sourceValue,
          targetCurrency: quote.targetCurrency,
          targetValue: quote.targetValue,
          rate: quote.rate,
          fee: quote.feeAmount,
          reference: transfer.reference ?? '',
        });
      } catch (error) {
        failures.push({
          commissionId: item.commissionId,
          affiliateProfileId: item.affiliateProfileId,
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      providerBatchId: batchGroup.wiseBatchGroupId,
      providerBatchVersion: batchGroup.wiseVersion,
      transfers,
      sourceCurrency: input.sourceCurrency,
      totalSourceAmount,
      failures,
    };
  }

  async completeBatch(providerBatchId: string): Promise<PayInInstruction[]> {
    const batchGroup = await this.prisma.wiseBatchGroup.findUniqueOrThrow({
      where: { wiseBatchGroupId: providerBatchId },
    });
    const { payInDetails } = await this.wiseBatchGroupService.completeBatch(
      batchGroup,
      this.fundingMode
    );
    return payInDetails;
  }

  /** Throws under `WISE_FUNDING_MODE=MANUAL` (F37) -- never silently
   * attempts an API funding call Wise will reject (Thailand region gate). */
  async fundBatchFromBalance(providerBatchId: string): Promise<void> {
    if (this.fundingMode === 'MANUAL') {
      throw new CapabilityUnavailableError(
        'fundBatchFromBalance is unavailable under WISE_FUNDING_MODE=MANUAL. Use mark-funded after funding in the Wise app.',
        'fundBatchFromBalance'
      );
    }
    // API mode is designed (design §6.3) but not built in Phase 1.
    throw new CapabilityUnavailableError(
      'API funding mode is designed but not implemented in Phase 1',
      'fundBatchFromBalance'
    );
  }

  async cancelBatch(providerBatchId: string, _version: number): Promise<void> {
    const batchGroup = await this.prisma.wiseBatchGroup.findUniqueOrThrow({
      where: { wiseBatchGroupId: providerBatchId },
    });
    await this.wiseBatchGroupService.cancelBatch(batchGroup.id);
  }
}

// Re-exported so callers only need one import for the "provider throws a
// PaymentProviderError-compatible failure" case, matching Mock/Rise's own
// error surface where relevant.
export { PaymentProviderError };
