/**
 * Wise Recipient Service Tests (Session 4A-W3a, File 10/10)
 *
 * Covers fingerprint calculation, account-tail extraction, and recipient
 * creation/read/deactivate against a mocked PrismaService + WiseApiClient
 * — same NestJS testing-module DI pattern as
 * `dlocal/three-day-validator.service.spec.ts`.
 */
import { createHash } from 'crypto';

import { Test } from '@nestjs/testing';

import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock } from '../../test-utils/prisma-mock';
import { WiseApiClient } from '../wise-api.client';
import { WiseRecipientService } from '../wise-recipient.service';
import type { CreateRecipientDto, WiseRecipientResponse } from '../wise.types';

describe('WiseRecipientService', () => {
  let service: WiseRecipientService;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let requestMock: jest.Mock;

  const payload: CreateRecipientDto = {
    currency: 'GBP',
    type: 'sort_code',
    profile: 29617748,
    accountHolderName: 'Jane Doe',
    details: {
      legalType: 'PRIVATE',
      sortCode: '040075',
      accountNumber: '37778842',
      dateOfBirth: '1961-01-01',
      country: 'GB',
    },
  };

  const wiseResponse: WiseRecipientResponse = {
    id: 999,
    profile: 29617748,
    accountHolderName: 'Jane Doe',
    currency: 'GBP',
    type: 'sort_code',
    details: payload.details,
    active: true,
  };

  const persistedRecipient = {
    id: 'rec-1',
    affiliateProfileId: 'aff-profile-1',
    wiseRecipientId: '999',
    wiseProfileId: '29617748',
    accountHolderName: 'Jane Doe',
    targetCurrency: 'GBP',
    recipientCountry: 'GB',
    legalType: 'PRIVATE',
    requirementsType: 'sort_code',
    accountTail: '8842',
    detailsFingerprint: 'fingerprint-stub',
    status: 'ACTIVE',
    lastValidatedAt: null,
    invalidReason: null,
    metadata: null,
    createdAt: new Date('2026-07-26T00:00:00Z'),
    updatedAt: new Date('2026-07-26T00:00:00Z'),
  };

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    requestMock = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        WiseRecipientService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: WiseApiClient, useValue: { request: requestMock } },
      ],
    }).compile();

    service = moduleRef.get(WiseRecipientService);
  });

  describe('createRecipient', () => {
    beforeEach(() => {
      requestMock.mockResolvedValue(wiseResponse);
      prismaMock.affiliateWiseRecipient.upsert.mockResolvedValue(
        persistedRecipient as never
      );
    });

    it('computes a deterministic SHA-256 detailsFingerprint over canonicalized details', async () => {
      await service.createRecipient('aff-profile-1', payload, {
        recipientCountry: 'GB',
        legalType: 'PRIVATE',
      });

      const upsertArgs = prismaMock.affiliateWiseRecipient.upsert.mock
        .calls[0][0] as {
        create: { detailsFingerprint: string; accountTail: string | null };
      };

      const expectedFingerprint = createHash('sha256')
        .update(
          JSON.stringify({
            accountNumber: '37778842',
            country: 'GB',
            dateOfBirth: '1961-01-01',
            legalType: 'PRIVATE',
            sortCode: '040075',
          })
        )
        .digest('hex');

      expect(upsertArgs.create.detailsFingerprint).toBe(expectedFingerprint);
    });

    it('extracts the last-4-digit accountTail from accountNumber', async () => {
      await service.createRecipient('aff-profile-1', payload, {
        recipientCountry: 'GB',
        legalType: 'PRIVATE',
      });

      const upsertArgs = prismaMock.affiliateWiseRecipient.upsert.mock
        .calls[0][0] as { create: { accountTail: string | null } };

      expect(upsertArgs.create.accountTail).toBe('8842');
    });

    it('never persists the raw details object anywhere in the Prisma call', async () => {
      await service.createRecipient('aff-profile-1', payload, {
        recipientCountry: 'GB',
        legalType: 'PRIVATE',
      });

      const upsertArgs =
        prismaMock.affiliateWiseRecipient.upsert.mock.calls[0][0];
      const serialized = JSON.stringify(upsertArgs);

      expect(serialized).not.toContain('37778842');
      expect(serialized).not.toContain('1961-01-01');
      expect(serialized).not.toContain('040075');
    });

    it('redacts the details object when calling the Wise API client', async () => {
      await service.createRecipient('aff-profile-1', payload, {
        recipientCountry: 'GB',
        legalType: 'PRIVATE',
      });

      expect(requestMock).toHaveBeenCalledWith(
        '/v1/accounts?refund=false',
        expect.objectContaining({
          method: 'POST',
          redactBodyFields: ['details'],
        })
      );
    });

    it('stores the caller-supplied recipientCountry/legalType, not a guess from details', async () => {
      await service.createRecipient(
        'aff-profile-1',
        {
          ...payload,
          details: { ...payload.details, country: 'THIS-SHOULD-BE-IGNORED' },
        },
        { recipientCountry: 'TH', legalType: 'BUSINESS' }
      );

      const upsertArgs = prismaMock.affiliateWiseRecipient.upsert.mock
        .calls[0][0] as {
        create: { recipientCountry: string; legalType: string };
      };

      expect(upsertArgs.create.recipientCountry).toBe('TH');
      expect(upsertArgs.create.legalType).toBe('BUSINESS');
    });
  });

  describe('revalidateRecipient', () => {
    it('returns null when no recipient exists', async () => {
      prismaMock.affiliateWiseRecipient.findUnique.mockResolvedValue(
        null as never
      );

      expect(await service.revalidateRecipient('aff-1')).toBeNull();
      expect(requestMock).not.toHaveBeenCalled();
    });

    it('returns null when the recipient has no wiseRecipientId yet', async () => {
      prismaMock.affiliateWiseRecipient.findUnique.mockResolvedValue({
        ...persistedRecipient,
        wiseRecipientId: null,
      } as never);

      expect(await service.revalidateRecipient('aff-profile-1')).toBeNull();
      expect(requestMock).not.toHaveBeenCalled();
    });

    it('marks the recipient ACTIVE when Wise reports it active', async () => {
      prismaMock.affiliateWiseRecipient.findUnique.mockResolvedValue(
        persistedRecipient as never
      );
      requestMock.mockResolvedValue({ ...wiseResponse, active: true });
      prismaMock.affiliateWiseRecipient.update.mockResolvedValue({
        ...persistedRecipient,
        status: 'ACTIVE',
      } as never);

      const result = await service.revalidateRecipient('aff-profile-1');

      expect(requestMock).toHaveBeenCalledWith('/v1/accounts/999');
      expect(result?.status).toBe('ACTIVE');
    });

    it('marks the recipient INVALID when Wise reports it inactive', async () => {
      prismaMock.affiliateWiseRecipient.findUnique.mockResolvedValue(
        persistedRecipient as never
      );
      requestMock.mockResolvedValue({ ...wiseResponse, active: false });
      prismaMock.affiliateWiseRecipient.update.mockResolvedValue({
        ...persistedRecipient,
        status: 'INVALID',
      } as never);

      const result = await service.revalidateRecipient('aff-profile-1');

      const updateArgs = prismaMock.affiliateWiseRecipient.update.mock
        .calls[0][0] as {
        data: { status: string; invalidReason: string | null };
      };
      expect(updateArgs.data.status).toBe('INVALID');
      expect(updateArgs.data.invalidReason).toBeTruthy();
      expect(result?.status).toBe('INVALID');
    });
  });

  describe('getRecipientByAffiliateProfileId', () => {
    it('returns null when no recipient exists', async () => {
      prismaMock.affiliateWiseRecipient.findUnique.mockResolvedValue(
        null as never
      );

      expect(
        await service.getRecipientByAffiliateProfileId('aff-1')
      ).toBeNull();
    });

    it('maps a found recipient to the summary DTO shape', async () => {
      prismaMock.affiliateWiseRecipient.findUnique.mockResolvedValue(
        persistedRecipient as never
      );

      const result =
        await service.getRecipientByAffiliateProfileId('aff-profile-1');

      expect(result).toMatchObject({
        id: 'rec-1',
        affiliateProfileId: 'aff-profile-1',
        wiseRecipientId: '999',
        accountTail: '8842',
        status: 'ACTIVE',
      });
    });
  });

  describe('deactivateRecipient', () => {
    it('returns null when no recipient exists', async () => {
      prismaMock.affiliateWiseRecipient.findUnique.mockResolvedValue(
        null as never
      );

      expect(await service.deactivateRecipient('aff-1')).toBeNull();
      expect(requestMock).not.toHaveBeenCalled();
    });

    it('calls Wise to deactivate an ACTIVE recipient and marks it ARCHIVED locally', async () => {
      prismaMock.affiliateWiseRecipient.findUnique.mockResolvedValue(
        persistedRecipient as never
      );
      requestMock.mockResolvedValue(undefined);
      prismaMock.affiliateWiseRecipient.update.mockResolvedValue({
        ...persistedRecipient,
        status: 'ARCHIVED',
      } as never);

      const result = await service.deactivateRecipient('aff-profile-1');

      expect(requestMock).toHaveBeenCalledWith('/v1/accounts/999/deactivate', {
        method: 'POST',
      });
      expect(result?.status).toBe('ARCHIVED');
    });

    it('does not call Wise for an already-ARCHIVED recipient, only updates locally', async () => {
      prismaMock.affiliateWiseRecipient.findUnique.mockResolvedValue({
        ...persistedRecipient,
        status: 'ARCHIVED',
      } as never);
      prismaMock.affiliateWiseRecipient.update.mockResolvedValue({
        ...persistedRecipient,
        status: 'ARCHIVED',
      } as never);

      await service.deactivateRecipient('aff-profile-1');

      expect(requestMock).not.toHaveBeenCalled();
    });
  });
});
