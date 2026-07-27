/**
 * Admin Affiliates Controller Tests (Session 4A-6, File 2/3)
 *
 * New code (no direct SOURCE test file — confirmed zero coverage at
 * CONFIRM). Guards tested independently in admin.guard.spec.ts.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
import { IdempotencyStore } from '../common/idempotency/idempotency.store';

import { AdminAffiliatesController } from './admin-affiliates.controller';
import { AdminCodeDistributionService } from './admin-code-distribution.service';
import { AdminAffiliateManagementService } from './affiliate-management.service';

describe('AdminAffiliatesController', () => {
  let controller: AdminAffiliatesController;
  let managementMock: Record<string, jest.Mock>;
  let codeDistributionMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    managementMock = {
      getAffiliatesList: jest.fn(),
      getAffiliateDetails: jest.fn(),
    };
    codeDistributionMock = {
      distributeCodesAdmin: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminAffiliatesController],
      providers: [
        { provide: AdminAffiliateManagementService, useValue: managementMock },
        {
          provide: AdminCodeDistributionService,
          useValue: codeDistributionMock,
        },
        IdempotencyInterceptor,
        {
          provide: IdempotencyStore,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            claim: jest.fn().mockResolvedValue(true),
            save: jest.fn().mockResolvedValue(undefined),
            release: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(AdminAffiliatesController);
  });

  describe('list', () => {
    it('returns 400 for an invalid status filter', async () => {
      await expect(controller.list({ status: 'NOT_A_STATUS' })).rejects.toThrow(
        BadRequestException
      );
    });

    it('forwards validated filters to the service', async () => {
      managementMock.getAffiliatesList.mockResolvedValue({
        affiliates: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      const result = await controller.list({ status: 'ACTIVE', country: 'US' });

      expect(managementMock.getAffiliatesList).toHaveBeenCalledWith({
        status: 'ACTIVE',
        country: 'US',
        paymentMethod: undefined,
        page: 1,
        limit: 20,
      });
      expect(result.total).toBe(0);
    });
  });

  describe('detail', () => {
    it('returns 404 when the service reports "Affiliate not found"', async () => {
      managementMock.getAffiliateDetails.mockRejectedValue(
        new Error('Affiliate not found')
      );

      await expect(controller.detail('missing-id')).rejects.toThrow(
        NotFoundException
      );
    });

    it('returns the affiliate details on success', async () => {
      managementMock.getAffiliateDetails.mockResolvedValue({
        id: 'aff-1',
        fullName: 'John Doe',
      });

      const result = await controller.detail('aff-1');

      expect(result).toEqual({ id: 'aff-1', fullName: 'John Doe' });
    });
  });

  describe('distributeCodes (Session 4A-9, File 7/10)', () => {
    it('returns 400 for an invalid body (count out of bounds)', async () => {
      await expect(
        controller.distributeCodes('aff-1', { count: 100, reason: 'promo' })
      ).rejects.toThrow(BadRequestException);
      expect(codeDistributionMock.distributeCodesAdmin).not.toHaveBeenCalled();
    });

    it('forwards a valid request to the service and returns its result', async () => {
      codeDistributionMock.distributeCodesAdmin.mockResolvedValue({
        success: true,
        message: 'Successfully distributed 5 codes to affiliate',
        codesDistributed: 5,
      });

      const result = await controller.distributeCodes('aff-1', {
        count: 5,
        reason: 'Q3 promo',
      });

      expect(codeDistributionMock.distributeCodesAdmin).toHaveBeenCalledWith(
        'aff-1',
        5,
        'Q3 promo'
      );
      expect(result).toEqual(
        expect.objectContaining({ success: true, codesDistributed: 5 })
      );
    });

    it('returns 404 when the service reports "Affiliate not found"', async () => {
      codeDistributionMock.distributeCodesAdmin.mockRejectedValue(
        new Error('Affiliate not found')
      );

      await expect(
        controller.distributeCodes('missing-id', { count: 5, reason: 'x' })
      ).rejects.toThrow(NotFoundException);
    });

    it('returns 400 when the service reports an eligibility error', async () => {
      codeDistributionMock.distributeCodesAdmin.mockRejectedValue(
        new Error('Can only distribute codes to active affiliates')
      );

      await expect(
        controller.distributeCodes('aff-1', { count: 5, reason: 'x' })
      ).rejects.toThrow(BadRequestException);
    });
  });
});
