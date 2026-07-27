/**
 * Admin Code Distribution Service Tests (Session 4A-9, File 7/10, File 9/10)
 */
import { Test } from '@nestjs/testing';

import { CodeGeneratorService } from '../affiliate/code-generator.service';
import { PrismaService } from '../prisma/prisma.service';
import { createPrismaMock } from '../test-utils/prisma-mock';

import { AdminCodeDistributionService } from './admin-code-distribution.service';

describe('AdminCodeDistributionService', () => {
  let service: AdminCodeDistributionService;
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let codeGeneratorMock: { distributeCodes: jest.Mock };

  beforeEach(async () => {
    prismaMock = createPrismaMock();
    codeGeneratorMock = { distributeCodes: jest.fn().mockResolvedValue([]) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminCodeDistributionService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: CodeGeneratorService, useValue: codeGeneratorMock },
      ],
    }).compile();

    service = moduleRef.get(AdminCodeDistributionService);
  });

  it('distributes codes to an active affiliate', async () => {
    prismaMock.affiliateProfile.findUnique.mockResolvedValue({
      id: 'aff-1',
      status: 'ACTIVE',
    } as never);

    const result = await service.distributeCodesAdmin('aff-1', 10, 'Q3 promo');

    expect(result).toEqual({
      success: true,
      message: 'Successfully distributed 10 codes to affiliate',
      codesDistributed: 10,
    });
    expect(codeGeneratorMock.distributeCodes).toHaveBeenCalledWith(
      'aff-1',
      10,
      'ADMIN_BONUS'
    );
  });

  it('rejects a count below 1', async () => {
    await expect(service.distributeCodesAdmin('aff-1', 0, 'x')).rejects.toThrow(
      'Count must be between 1 and 50'
    );
  });

  it('rejects a count above 50', async () => {
    await expect(
      service.distributeCodesAdmin('aff-1', 51, 'x')
    ).rejects.toThrow('Count must be between 1 and 50');
  });

  it('throws when the affiliate does not exist', async () => {
    prismaMock.affiliateProfile.findUnique.mockResolvedValue(null);

    await expect(
      service.distributeCodesAdmin('missing', 5, 'x')
    ).rejects.toThrow('Affiliate not found');
  });

  it('throws when the affiliate is not ACTIVE', async () => {
    prismaMock.affiliateProfile.findUnique.mockResolvedValue({
      id: 'aff-1',
      status: 'SUSPENDED',
    } as never);

    await expect(service.distributeCodesAdmin('aff-1', 5, 'x')).rejects.toThrow(
      'Can only distribute codes to active affiliates'
    );
    expect(codeGeneratorMock.distributeCodes).not.toHaveBeenCalled();
  });
});
