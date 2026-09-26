/**
 * Admin Analytics Controller Tests (Session 4A-6, File 2/3)
 *
 * New code (no direct SOURCE test file — confirmed zero coverage at
 * CONFIRM). Covers the route's own bespoke 403 shape distinct from the
 * other 7 admin routes' AdminGuard shape (see this controller's header
 * comment).
 */
import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { AffiliateConfigService } from '../affiliate/affiliate-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../test-utils/prisma-mock';

import { AdminAnalyticsController } from './admin-analytics.controller';

function requestWithRole(role: string): AuthenticatedRequest {
  return {
    user: {
      id: 'u1',
      email: 'a@example.com',
      tier: 'PRO',
      role,
      isAffiliate: false,
    },
  } as AuthenticatedRequest;
}

describe('AdminAnalyticsController', () => {
  let controller: AdminAnalyticsController;
  let prismaMock: ReturnType<typeof createPrismaMock>;

  beforeEach(async () => {
    prismaMock = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminAnalyticsController],
      providers: [
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: AffiliateConfigService,
          useValue: {
            getBasePriceUsd: jest.fn().mockResolvedValue(35),
            getThreeDayPriceUsd: jest.fn().mockResolvedValue(2.49),
            getCodesPerMonth: jest.fn().mockResolvedValue(12),
            getAnnualPriceUsd: jest.fn().mockResolvedValue(350),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(AdminAnalyticsController);
  });

  it('rejects a non-admin with the route-specific 403 body', async () => {
    try {
      await controller.getAnalytics(requestWithRole('USER'));
      fail('expected ForbiddenException');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toEqual({
        error: 'Forbidden: Admin access required',
      });
    }
  });

  it('computes MRR/ARR and percentages for an admin caller', async () => {
    prismaMock.user.count
      .mockResolvedValueOnce(100) // totalUsers
      .mockResolvedValueOnce(80) // freeUsers
      .mockResolvedValueOnce(20) // proUsers
      .mockResolvedValueOnce(5); // newUsersThisMonth

    const result = await controller.getAnalytics(requestWithRole('ADMIN'));

    expect(result.overview).toEqual({
      totalUsers: 100,
      freeUsers: 80,
      proUsers: 20,
      freePercentage: 80,
      proPercentage: 20,
    });
    // 20 PRO users x the SystemConfig price (mocked 35, not the $29 default)
    expect(result.revenue.mrr).toBe(700);
    expect(result.revenue.arr).toBe(8400); // 700 * 12
    expect(result.growth.newUsersThisMonth).toBe(5);
    expect(result.growth.churnedThisMonth).toBe(0);
  });
});
