/**
 * Wise Transfer Service (Session 4A-W6, File 2/8)
 *
 * Creates a batch-group-scoped Wise transfer
 * (`POST /v3/profiles/{profileId}/batch-groups/{groupId}/transfers`, design
 * §6.2 step 3) and persists it as a `WiseTransfer` row.
 *
 * Hard Invariant #5: `customerTransactionId` is persisted BEFORE the Wise
 * API call, for crash resumability. `WiseTransfer.wiseTransferId` is a
 * required `@unique` column with no Wise-assigned value available yet at
 * that point — so the row is written first with `wiseTransferId` TEMPORARILY
 * equal to `customerTransactionId` (itself `@unique`, so this can never
 * collide with a real Wise transfer id, which is a numeric string), then
 * overwritten with the real Wise transfer id once the API responds. A retry
 * that finds a row still in that placeholder state reuses the SAME
 * `customerTransactionId` rather than minting a new one and never re-derives
 * one from scratch — this is what makes a crash mid-`prepareBatch` safe
 * (design §14.4: "on retry, skip commissions that already have a
 * `WiseTransfer` with a `customerTransactionId`").
 */

import { randomUUID } from 'crypto';

import { Injectable } from '@nestjs/common';
import type { WiseTransfer } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { WiseApiClient } from '../wise-api.client';
import { WiseConfig } from '../wise.config';

export interface CreateBatchGroupTransferInput {
  disbursementTransactionId: string;
  affiliateWiseRecipientId: string;
  wiseBatchGroupDbId: string; // local WiseBatchGroup.id
  wiseBatchGroupId: string; // Wise batch-group UUID
  wiseQuoteId: string;
  targetAccountId: string; // Wise recipient id
  reference: string;
  sourceCurrency: string;
  sourceValue: number;
  targetCurrency: string;
  targetValue: number;
  rate: number;
  feeAmount: number;
  feeBearer: string;
}

interface WiseBatchGroupTransferResponse {
  id: number; // Wise transfer id
}

/** A row is still a pre-Wise-call placeholder iff its `wiseTransferId`
 * equals its own `customerTransactionId` — the one value guaranteed never to
 * collide with a real (numeric, Wise-assigned) transfer id. */
function isPlaceholder(transfer: WiseTransfer): boolean {
  return transfer.wiseTransferId === transfer.customerTransactionId;
}

@Injectable()
export class WiseTransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wiseApiClient: WiseApiClient,
    private readonly wiseConfig: WiseConfig
  ) {}

  async createBatchGroupTransfer(
    input: CreateBatchGroupTransferInput
  ): Promise<{ transfer: WiseTransfer; created: boolean }> {
    const existing = await this.prisma.wiseTransfer.findUnique({
      where: { disbursementTransactionId: input.disbursementTransactionId },
    });

    if (existing && !isPlaceholder(existing)) {
      // A prior attempt already completed this transfer at Wise. Skip.
      return { transfer: existing, created: false };
    }

    const customerTransactionId =
      existing?.customerTransactionId ?? randomUUID();

    const placeholder =
      existing ??
      (await this.prisma.wiseTransfer.create({
        data: {
          disbursementTransactionId: input.disbursementTransactionId,
          affiliateWiseRecipientId: input.affiliateWiseRecipientId,
          wiseBatchGroupId: input.wiseBatchGroupDbId,
          wiseTransferId: customerTransactionId, // placeholder — see file header
          wiseQuoteId: input.wiseQuoteId,
          customerTransactionId,
          reference: input.reference,
          sourceCurrency: input.sourceCurrency,
          sourceValue: input.sourceValue,
          targetCurrency: input.targetCurrency,
          targetValue: input.targetValue,
          rate: input.rate,
          feeAmount: input.feeAmount,
          feeBearer: input.feeBearer,
        },
      }));

    const response =
      await this.wiseApiClient.request<WiseBatchGroupTransferResponse>(
        `/v3/profiles/${this.wiseConfig.profileId}/batch-groups/${input.wiseBatchGroupId}/transfers`,
        {
          method: 'POST',
          body: {
            targetAccount: Number(input.targetAccountId),
            quoteUuid: input.wiseQuoteId,
            customerTransactionId,
            details: { reference: input.reference },
          },
        }
      );

    const transfer = await this.prisma.wiseTransfer.update({
      where: { id: placeholder.id },
      data: { wiseTransferId: String(response.id) },
    });

    return { transfer, created: true };
  }
}
