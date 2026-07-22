/**
 * Admin Affiliates Controller Tests (Session 4A-6, File 2/3)
 *
 * New code (no direct SOURCE test file — confirmed zero coverage at
 * CONFIRM). Guards tested independently in admin.guard.spec.ts.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AdminAffiliatesController } from './admin-affiliates.controller';
import { AdminAffiliateManagementService } from './affiliate-management.service';

describe('AdminAffiliatesController', () => {
  let controller: AdminAffiliatesController;
  let managementMock: Record<string, jest.Mock>;

  beforeEach(async () => {
    managementMock = {
      getAffiliatesList: jest.fn(),
      getAffiliateDetails: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminAffiliatesController],
      providers: [
        { provide: AdminAffiliateManagementService, useValue: managementMock },
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
});
