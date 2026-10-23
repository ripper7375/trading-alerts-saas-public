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

import { OutboxService } from '../../outbox/outbox.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock } from '../../test-utils/prisma-mock';
import { WiseApiClient } from '../wise-api.client';
import { WiseRecipientService } from '../wise-recipient.service';
import type { CreateRecipientDto, WiseRecipientResponse } from '../wise.types';

describe('WiseRecipientService', () => {
  let service: WiseRecipientService;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let requestMock: jest.Mock;
  let outboxMock: { recordInTransaction: jest.Mock };

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
    outboxMock = {
      recordInTransaction: jest.fn().mockResolvedValue(undefined),
    };
    // The recipient write and its outbox event share one interactive transaction.
    prismaMock.$transaction.mockImplementation(((
      callback: (tx: unknown) => Promise<unknown>
    ) => callback(prismaMock)) as never);

    const moduleRef = await Test.createTestingModule({
      providers: [
        WiseRecipientService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: WiseApiClient, useValue: { request: requestMock } },
        { provide: OutboxService, useValue: outboxMock },
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

  describe('change detection and the 72-hour hold (WS-9, CODE-06A)', () => {
    const NOW = new Date('2026-10-23T10:00:00.000Z');
    const meta = { recipientCountry: 'GB', legalType: 'PRIVATE' };
    const fingerprint = createHash('sha256')
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
    // What the stored row looks like when the same details are already on file.
    const storedSame = {
      ...persistedRecipient,
      detailsFingerprint: fingerprint,
      detailsChangedAt: new Date('2026-10-01T00:00:00.000Z'),
    };

    beforeEach(() => {
      jest.useFakeTimers({ now: NOW });
      requestMock.mockResolvedValue(wiseResponse);
      prismaMock.affiliateWiseRecipient.findUnique.mockResolvedValue(
        null as never
      );
      prismaMock.affiliateWiseRecipient.upsert.mockResolvedValue(
        persistedRecipient as never
      );
      prismaMock.affiliateProfile.findUnique.mockResolvedValue({
        userId: 'user-1',
      } as never);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    type UpsertArgs = {
      create: { detailsChangedAt?: Date };
      update: { detailsChangedAt?: Date };
    };
    const upsertArgs = (): UpsertArgs =>
      prismaMock.affiliateWiseRecipient.upsert.mock.calls[0][0] as UpsertArgs;

    it('the first recipient of an account starts the hold and records one event for the affiliate’s User', async () => {
      await service.createRecipient('aff-profile-1', payload, meta);

      expect(upsertArgs().create.detailsChangedAt).toEqual(NOW);
      expect(upsertArgs().update.detailsChangedAt).toEqual(NOW);
      expect(outboxMock.recordInTransaction).toHaveBeenCalledTimes(1);
      expect(outboxMock.recordInTransaction).toHaveBeenCalledWith(prismaMock, {
        aggregateType: 'AffiliateWiseRecipient',
        aggregateId: 'user-1',
        eventType: 'PAYOUT_DETAILS_CHANGED',
        payload: {
          affiliateProfileId: 'aff-profile-1',
          changeKind: 'ADDED',
          changedAt: '2026-10-23T10:00:00.000Z',
          holdUntil: '2026-10-26T10:00:00.000Z',
          holdHours: 72,
        },
      });
    });

    it('replacing the details of an ACTIVE recipient restarts the hold and records a REPLACED event', async () => {
      prismaMock.affiliateWiseRecipient.findUnique.mockResolvedValue({
        ...storedSame,
        detailsFingerprint: 'the-old-details',
      } as never);

      await service.createRecipient('aff-profile-1', payload, meta);

      expect(upsertArgs().update.detailsChangedAt).toEqual(NOW);
      expect(outboxMock.recordInTransaction).toHaveBeenCalledTimes(1);
      const event = outboxMock.recordInTransaction.mock.calls[0][1] as {
        payload: { changeKind: string };
      };
      expect(event.payload.changeKind).toBe('REPLACED');
    });

    it('a recipient added again after a removal is held and recorded as an addition', async () => {
      prismaMock.affiliateWiseRecipient.findUnique.mockResolvedValue({
        ...storedSame,
        status: 'ARCHIVED',
      } as never);

      await service.createRecipient('aff-profile-1', payload, meta);

      expect(upsertArgs().update.detailsChangedAt).toEqual(NOW);
      const event = outboxMock.recordInTransaction.mock.calls[0][1] as {
        payload: { changeKind: string };
      };
      expect(event.payload.changeKind).toBe('ADDED');
    });

    it('an identical re-submission on an ACTIVE recipient leaves the clock alone and sends nothing', async () => {
      prismaMock.affiliateWiseRecipient.findUnique.mockResolvedValue(
        storedSame as never
      );

      await service.createRecipient('aff-profile-1', payload, meta);

      expect(upsertArgs().update).not.toHaveProperty('detailsChangedAt');
      expect(outboxMock.recordInTransaction).not.toHaveBeenCalled();
    });

    it('writes the recipient and the event in ONE transaction, on the transaction’s own client', async () => {
      const tx = createPrismaMock();
      tx.affiliateWiseRecipient.findUnique.mockResolvedValue(null as never);
      tx.affiliateWiseRecipient.upsert.mockResolvedValue(
        persistedRecipient as never
      );
      tx.affiliateProfile.findUnique.mockResolvedValue({
        userId: 'user-1',
      } as never);
      prismaMock.$transaction.mockImplementation(((
        callback: (client: unknown) => Promise<unknown>
      ) => callback(tx)) as never);

      await service.createRecipient('aff-profile-1', payload, meta);

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.affiliateWiseRecipient.upsert).toHaveBeenCalledTimes(1);
      expect(prismaMock.affiliateWiseRecipient.upsert).not.toHaveBeenCalled();
      expect(outboxMock.recordInTransaction.mock.calls[0][0]).toBe(tx);
    });

    it('records no event when the recipient write fails', async () => {
      prismaMock.affiliateWiseRecipient.upsert.mockRejectedValue(
        new Error('database down')
      );

      await expect(
        service.createRecipient('aff-profile-1', payload, meta)
      ).rejects.toThrow('database down');
      expect(outboxMock.recordInTransaction).not.toHaveBeenCalled();
    });

    it('a failing outbox write fails the whole write, so a held recipient is never silent', async () => {
      outboxMock.recordInTransaction.mockRejectedValue(
        new Error('outbox down')
      );

      await expect(
        service.createRecipient('aff-profile-1', payload, meta)
      ).rejects.toThrow('outbox down');
    });

    it('still holds the recipient when its profile row has vanished, and skips the event', async () => {
      prismaMock.affiliateProfile.findUnique.mockResolvedValue(null as never);

      await service.createRecipient('aff-profile-1', payload, meta);

      expect(upsertArgs().create.detailsChangedAt).toEqual(NOW);
      expect(outboxMock.recordInTransaction).not.toHaveBeenCalled();
    });

    it('puts no bank detail, account tail or fingerprint in the event', async () => {
      await service.createRecipient('aff-profile-1', payload, meta);

      const serialized = JSON.stringify(
        outboxMock.recordInTransaction.mock.calls[0][1]
      );
      for (const secret of [
        '37778842',
        '8842',
        '040075',
        '1961-01-01',
        fingerprint,
        'Jane Doe',
      ]) {
        expect(serialized).not.toContain(secret);
      }
    });

    it('removing or revalidating a recipient neither starts a hold nor sends anything', async () => {
      prismaMock.affiliateWiseRecipient.findUnique.mockResolvedValue(
        storedSame as never
      );
      prismaMock.affiliateWiseRecipient.update.mockResolvedValue(
        storedSame as never
      );

      await service.deactivateRecipient('aff-profile-1');
      requestMock.mockResolvedValue({ ...wiseResponse, active: true });
      await service.revalidateRecipient('aff-profile-1');

      for (const call of prismaMock.affiliateWiseRecipient.update.mock.calls) {
        expect(
          (call[0] as { data: Record<string, unknown> }).data
        ).not.toHaveProperty('detailsChangedAt');
      }
      expect(outboxMock.recordInTransaction).not.toHaveBeenCalled();
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
