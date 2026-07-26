/**
 * Wise Batch Group Service (Session 4A-W6, File 2/8)
 *
 * Creates and updates `WiseBatchGroup` through its lifecycle
 * (`NEW` → `COMPLETED`/`AWAITING_MANUAL_FUNDING` → `FUNDED`), per design
 * §6.2 steps 2-6 and `part19.5-wise-disbursement-openapi.yaml`'s
 * `/wise/batches/*` paths (frozen contract — "law").
 *
 * `markFunded` is the ONLY place in this file that sets `status = 'FUNDED'`.
 * It is idempotent (OpenAPI `mark-funded` description: "a second call is a
 * no-op") and — same as every other file in this session — it NEVER touches
 * `Commission.status` or `AffiliateProfile.balance`. Those move only when
 * Wise's `transfers#state-change` events reach 4A-W5's reducer.
 */

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { WiseBatchGroup } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { PayInInstruction } from '../providers/provider-capabilities';
import { WiseApiClient } from '../wise-api.client';
import { WiseConfig } from '../wise.config';
import type { FundingMode } from '../providers/provider-capabilities';

interface WiseBatchGroupCreateResponse {
  id: string; // Wise batch-group UUID
  version: number;
}

interface WiseBatchGroupPatchResponse {
  id: string;
  version: number;
  status: string;
  payInDetails?: PayInInstruction[];
}

export interface MarkFundedInput {
  fundedAt: Date;
  fundedByUserId?: string;
  bankReference?: string;
  note?: string;
}

@Injectable()
export class WiseBatchGroupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wiseApiClient: WiseApiClient,
    private readonly wiseConfig: WiseConfig
  ) {}

  /** Idempotent per `PaymentBatch` — the OpenAPI's own 409 "a Wise batch
   * group already exists for this PaymentBatch" case is handled by simply
   * returning the existing row rather than erroring, matching design
   * §14.4's resumability requirement. */
  async getOrCreateForPaymentBatch(
    paymentBatchId: string,
    batchName: string,
    sourceCurrency: string
  ): Promise<WiseBatchGroup> {
    const existing = await this.prisma.wiseBatchGroup.findUnique({
      where: { paymentBatchId },
    });
    if (existing) return existing;

    const response =
      await this.wiseApiClient.request<WiseBatchGroupCreateResponse>(
        `/v3/profiles/${this.wiseConfig.profileId}/batch-groups`,
        { method: 'POST', body: { sourceCurrency, name: batchName } }
      );

    return this.prisma.wiseBatchGroup.create({
      data: {
        paymentBatchId,
        wiseBatchGroupId: response.id,
        wiseProfileId: this.wiseConfig.profileId,
        wiseVersion: response.version,
        wiseName: batchName,
        sourceCurrency,
        status: 'NEW',
      },
    });
  }

  async recordTransferAdded(id: string, sourceValue: number): Promise<void> {
    await this.prisma.wiseBatchGroup.update({
      where: { id },
      data: {
        transferCount: { increment: 1 },
        totalSourceAmount: { increment: sourceValue },
      },
    });
  }

  /** `NEW → COMPLETED` at Wise; local status becomes
   * `AWAITING_MANUAL_FUNDING` under `WISE_FUNDING_MODE=MANUAL` (design §6.2
   * step 4/5). Idempotent — returns the stored `payInDetails` unchanged if
   * already past `NEW`. */
  async completeBatch(
    batchGroup: WiseBatchGroup,
    fundingMode: FundingMode
  ): Promise<{ batchGroup: WiseBatchGroup; payInDetails: PayInInstruction[] }> {
    if (batchGroup.status !== 'NEW') {
      return {
        batchGroup,
        payInDetails:
          (batchGroup.payInDetails as unknown as PayInInstruction[]) ?? [],
      };
    }

    const response =
      await this.wiseApiClient.request<WiseBatchGroupPatchResponse>(
        `/v3/profiles/${this.wiseConfig.profileId}/batch-groups/${batchGroup.wiseBatchGroupId}`,
        {
          method: 'PATCH',
          body: { status: 'COMPLETED', version: batchGroup.wiseVersion },
        }
      );

    const payInDetails = response.payInDetails ?? [];

    const updated = await this.prisma.wiseBatchGroup.update({
      where: { id: batchGroup.id },
      data: {
        status:
          fundingMode === 'MANUAL' ? 'AWAITING_MANUAL_FUNDING' : 'COMPLETED',
        wiseVersion: response.version,
        payInDetails: payInDetails as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });

    return { batchGroup: updated, payInDetails };
  }

  /** Idempotent human-funding assertion (OpenAPI `mark-funded`). Never
   * touches `Commission`/`AffiliateProfile` — see file header. */
  async markFunded(
    id: string,
    evidence: MarkFundedInput
  ): Promise<WiseBatchGroup> {
    const batchGroup = await this.prisma.wiseBatchGroup.findUniqueOrThrow({
      where: { id },
    });
    if (batchGroup.status === 'FUNDED') return batchGroup;

    return this.prisma.wiseBatchGroup.update({
      where: { id },
      data: {
        status: 'FUNDED',
        fundingSource: 'MANUAL_ADMIN',
        fundedAt: evidence.fundedAt,
        fundedByUserId: evidence.fundedByUserId,
        fundingEvidence: {
          bankReference: evidence.bankReference ?? null,
          note: evidence.note ?? null,
        } as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /** Only valid before funding (OpenAPI `cancel` description). */
  async cancelBatch(id: string): Promise<WiseBatchGroup> {
    const batchGroup = await this.prisma.wiseBatchGroup.findUniqueOrThrow({
      where: { id },
    });
    if (
      batchGroup.status === 'MARKED_FOR_CANCELLATION' ||
      batchGroup.status === 'CANCELLED'
    ) {
      return batchGroup;
    }

    await this.wiseApiClient.request(
      `/v3/profiles/${this.wiseConfig.profileId}/batch-groups/${batchGroup.wiseBatchGroupId}`,
      {
        method: 'PATCH',
        body: {
          status: 'MARKED_FOR_CANCELLATION',
          version: batchGroup.wiseVersion,
        },
      }
    );

    return this.prisma.wiseBatchGroup.update({
      where: { id },
      data: { status: 'MARKED_FOR_CANCELLATION', cancelledAt: new Date() },
    });
  }
}
