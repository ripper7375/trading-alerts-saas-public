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
 * Deviation (recorded in the order's Deviations section at session close):
 * `CreateRecipientDto` (File 3/10, frozen by the order text) carries no
 * explicit country field, but `AffiliateWiseRecipient.recipientCountry` is
 * non-nullable. `extractCountry` best-effort-derives it from
 * `details.country`/`details.address.country` (common Wise
 * account-requirements field names, not Thailand-specific — Hard
 * Invariant #1 still holds), falling back to `''` rather than a fabricated
 * value. Flagged for the Advisor/Davin, not silently resolved.
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
    // quote has been created).
    const params = new URLSearchParams({
      source: sourceCurrency,
      target: targetCurrency,
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
    payload: CreateRecipientDto
  ): Promise<RecipientSummaryDto> {
    const detailsFingerprint = createHash('sha256')
      .update(JSON.stringify(this.canonicalize(payload.details)))
      .digest('hex');
    const accountTail = this.extractAccountTail(payload.details);
    const legalType = this.extractLegalType(payload.details);
    const recipientCountry = this.extractCountry(payload.details);

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
      recipientCountry,
      legalType,
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

  private extractLegalType(details: Record<string, unknown>): string {
    const legalType = details['legalType'];
    return typeof legalType === 'string' ? legalType : '';
  }

  private extractCountry(details: Record<string, unknown>): string {
    if (typeof details['country'] === 'string') {
      return details['country'] as string;
    }
    const address = details['address'];
    if (address && typeof address === 'object') {
      const country = (address as Record<string, unknown>)['country'];
      if (typeof country === 'string') return country;
    }
    return '';
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
