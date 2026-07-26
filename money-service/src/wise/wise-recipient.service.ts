/**
 * Wise Recipient Management Service (Session 4A-W3a, File 7/10)
 *
 * Domain service managing recipient requirements, recipient creation,
 * details fingerprinting, and DB persistence. Zero raw bank details ever
 * reach Postgres or application logs (design §4.4/§7.4, Hard Invariant #2)
 * — only `accountTail` (last 4 digits) and `detailsFingerprint` (SHA-256
 * hash) persist locally; full bank details live at Wise, keyed by
 * `wiseRecipientId`.
 *
 * `recipientCountry`/`legalType` are accepted as explicit caller-supplied
 * fields (not derived by guessing from `details`) — matches the frozen
 * `part19.5-wise-disbursement-openapi.yaml` `POST /wise/recipients` request
 * body (`targetCurrency`, `recipientCountry`, `legalType`,
 * `accountHolderName`, `requirementsType`, `details`), which is a
 * DIFFERENT shape than `CreateRecipientDto` (File 3/10) — that DTO mirrors
 * Wise's OWN `POST /v1/accounts` body instead
 * (`02-…reference.md` §4.3: `currency`, `type`, `profile`,
 * `accountHolderName`, `details`). `wise-recipients.controller.ts` (File
 * 8/10) is the translation layer between the two.
 */

import { createHash } from 'crypto';

import { Injectable } from '@nestjs/common';
import type { AffiliateWiseRecipient } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { WiseApiClient } from './wise-api.client';
import {
  ACCEPT_MINOR_VERSION_HEADER,
  ACCOUNTS_URL,
  ACCOUNT_REQUIREMENTS_URL,
  MINOR_VERSION_1,
  quoteAccountRequirementsPath,
} from './wise.constants';
import type {
  AccountRequirementGroup,
  CreateRecipientDto,
  RecipientSummaryDto,
  WiseRecipientResponse,
} from './wise.types';

const ACCOUNT_TAIL_CANDIDATE_KEYS = [
  'accountNumber',
  'iban',
  'clabe',
  'cardNumber',
  'ifscCode',
];

@Injectable()
export class WiseRecipientService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wiseApiClient: WiseApiClient
  ) {}

  async getAccountRequirements(
    quoteId?: string,
    sourceCurrency?: string,
    targetCurrency?: string
  ): Promise<AccountRequirementGroup[]> {
    const headers = { [ACCEPT_MINOR_VERSION_HEADER]: MINOR_VERSION_1 };

    if (quoteId) {
      return this.wiseApiClient.request<AccountRequirementGroup[]>(
        quoteAccountRequirementsPath(quoteId),
        { headers }
      );
    }

    if (!sourceCurrency || !targetCurrency) {
      throw new Error(
        'getAccountRequirements requires either quoteId or both sourceCurrency and targetCurrency'
      );
    }

    // Discouraged fallback per 02-…reference.md §4.2 — used only when no
    // quote context exists yet (e.g. a fresh onboarding form before any
    // quote has been created). Wise rejects this endpoint with 422
    // "validation.failure.only.source.or.target.amount" unless EXACTLY one
    // of sourceAmount/targetAmount is present — confirmed live against
    // sandbox this session. sourceAmount is a nominal discovery-only value
    // (no quote, no money moved); the reference doc's own example for this
    // exact discouraged path already shows `sourceAmount=1000`.
    const params = new URLSearchParams({
      source: sourceCurrency,
      target: targetCurrency,
      sourceAmount: '1000',
    });
    return this.wiseApiClient.request<AccountRequirementGroup[]>(
      `${ACCOUNT_REQUIREMENTS_URL}?${params.toString()}`,
      { headers }
    );
  }

  async refreshRequirementsOnChange(
    quoteId: string,
    currentDetails: Record<string, unknown>
  ): Promise<AccountRequirementGroup[]> {
    return this.wiseApiClient.request<AccountRequirementGroup[]>(
      quoteAccountRequirementsPath(quoteId),
      {
        method: 'POST',
        body: currentDetails,
        headers: { [ACCEPT_MINOR_VERSION_HEADER]: MINOR_VERSION_1 },
        redactBodyFields: Object.keys(currentDetails),
      }
    );
  }

  async createRecipient(
    affiliateProfileId: string,
    payload: CreateRecipientDto,
    recipientMeta: { recipientCountry: string; legalType: string }
  ): Promise<RecipientSummaryDto> {
    const detailsFingerprint = createHash('sha256')
      .update(JSON.stringify(this.canonicalize(payload.details)))
      .digest('hex');
    const accountTail = this.extractAccountTail(payload.details);

    const response = await this.wiseApiClient.request<WiseRecipientResponse>(
      `${ACCOUNTS_URL}?refund=false`,
      {
        method: 'POST',
        body: payload,
        redactBodyFields: ['details'],
      }
    );

    const shared = {
      wiseRecipientId: String(response.id),
      wiseProfileId: String(payload.profile),
      accountHolderName: payload.accountHolderName,
      targetCurrency: payload.currency,
      recipientCountry: recipientMeta.recipientCountry,
      legalType: recipientMeta.legalType,
      requirementsType: payload.type,
      accountTail,
      detailsFingerprint,
      status: 'ACTIVE' as const,
    };

    const recipient = await this.prisma.affiliateWiseRecipient.upsert({
      where: { affiliateProfileId },
      create: { affiliateProfileId, ...shared },
      update: { ...shared, invalidReason: null },
    });

    return this.toSummaryDto(recipient);
  }

  /**
   * "Re-read the recipient from Wise and refresh local status"
   * (`part19.5-wise-disbursement-openapi.yaml`
   * `POST /wise/recipients/{recipientId}/revalidate`) — not in File 7/10's
   * own original method list, added while building File 8/10's controller
   * since the frozen OpenAPI contract requires this endpoint to exist and
   * do something real, not a stub.
   */
  async revalidateRecipient(
    affiliateProfileId: string
  ): Promise<RecipientSummaryDto | null> {
    const recipient = await this.prisma.affiliateWiseRecipient.findUnique({
      where: { affiliateProfileId },
    });
    if (!recipient || !recipient.wiseRecipientId) return null;

    const response = await this.wiseApiClient.request<WiseRecipientResponse>(
      `${ACCOUNTS_URL}/${recipient.wiseRecipientId}`
    );

    const updated = await this.prisma.affiliateWiseRecipient.update({
      where: { affiliateProfileId },
      data: {
        status: response.active ? 'ACTIVE' : 'INVALID',
        invalidReason: response.active
          ? null
          : 'Wise reports this recipient as inactive',
        lastValidatedAt: new Date(),
      },
    });

    return this.toSummaryDto(updated);
  }

  async getRecipientByAffiliateProfileId(
    affiliateProfileId: string
  ): Promise<RecipientSummaryDto | null> {
    const recipient = await this.prisma.affiliateWiseRecipient.findUnique({
      where: { affiliateProfileId },
    });
    return recipient ? this.toSummaryDto(recipient) : null;
  }

  async deactivateRecipient(
    affiliateProfileId: string
  ): Promise<RecipientSummaryDto | null> {
    const recipient = await this.prisma.affiliateWiseRecipient.findUnique({
      where: { affiliateProfileId },
    });
    if (!recipient) return null;

    if (recipient.wiseRecipientId && recipient.status === 'ACTIVE') {
      await this.wiseApiClient.request(
        `${ACCOUNTS_URL}/${recipient.wiseRecipientId}/deactivate`,
        { method: 'POST' }
      );
    }

    const updated = await this.prisma.affiliateWiseRecipient.update({
      where: { affiliateProfileId },
      data: { status: 'ARCHIVED' },
    });

    return this.toSummaryDto(updated);
  }

  private toSummaryDto(recipient: AffiliateWiseRecipient): RecipientSummaryDto {
    return {
      id: recipient.id,
      affiliateProfileId: recipient.affiliateProfileId,
      wiseRecipientId: recipient.wiseRecipientId,
      accountHolderName: recipient.accountHolderName,
      targetCurrency: recipient.targetCurrency,
      recipientCountry: recipient.recipientCountry,
      legalType: recipient.legalType,
      accountTail: recipient.accountTail,
      status: recipient.status,
      createdAt: recipient.createdAt,
    };
  }

  private extractAccountTail(details: Record<string, unknown>): string | null {
    for (const key of ACCOUNT_TAIL_CANDIDATE_KEYS) {
      const value = details[key];
      if (typeof value === 'string' && value.length > 0) {
        return value.slice(-4);
      }
    }
    return null;
  }

  private canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.canonicalize(item));
    }
    if (value && typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = this.canonicalize((value as Record<string, unknown>)[key]);
          return acc;
        }, {});
    }
    return value;
  }
}
