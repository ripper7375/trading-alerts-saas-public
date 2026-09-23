/**
 * Disbursement Batches Controller Tests (Session 4A-9, File 8/10, File 9/10)
 */
import { Test } from '@nestjs/testing';

import { BatchManagerService } from '../batch-manager.service';
import { PaymentOrchestratorService } from '../payment-orchestrator.service';

import { DisbursementBatchesController } from './disbursement-batches.controller';
import { WisePaymentProvider } from '../../wise/providers/wise-payment.provider';
import { IdempotencyInterceptor } from '../../common/idempotency/idempotency.interceptor';
import { IdempotencyStore } from '../../common/idempotency/idempotency.store';
import { DisbursementSettingsService } from '../disbursement-settings.service';
import {
  createDisbursementSettingsService,
  PAUSED_SETTING_ROWS,
  SettingRowFixture,
} from '../../test-utils/disbursement-settings';

describe('DisbursementBatchesController', () => {
  let controller: DisbursementBatchesController;
  let batchManagerMock: { getBatchById: jest.Mock };
  let orchestratorMock: { executeBatch: jest.Mock };
  let settingRows: SettingRowFixture[];

  beforeEach(async () => {
    batchManagerMock = { getBatchById: jest.fn() };
    orchestratorMock = { executeBatch: jest.fn() };
    settingRows = [];

    const moduleRef = await Test.createTestingModule({
      controllers: [DisbursementBatchesController],
      providers: [
        { provide: BatchManagerService, useValue: batchManagerMock },
        { provide: PaymentOrchestratorService, useValue: orchestratorMock },
        { provide: WisePaymentProvider, useValue: {} },
        {
          provide: DisbursementSettingsService,
          useFactory: () => createDisbursementSettingsService(settingRows),
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

    controller = moduleRef.get(DisbursementBatchesController);
  });

  it('returns 404 when the batch does not exist', async () => {
    batchManagerMock.getBatchById.mockResolvedValue(null);

    await expect(controller.execute('batch-1')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('returns 400 when the batch status is not PENDING/QUEUED', async () => {
    batchManagerMock.getBatchById.mockResolvedValue({
      id: 'batch-1',
      status: 'COMPLETED',
      provider: 'MOCK',
    });

    await expect(controller.execute('batch-1')).rejects.toMatchObject({
      status: 400,
    });
    expect(orchestratorMock.executeBatch).not.toHaveBeenCalled();
  });

  it('returns 400 when the provider is not available (e.g. RISE)', async () => {
    batchManagerMock.getBatchById.mockResolvedValue({
      id: 'batch-1',
      status: 'PENDING',
      provider: 'RISE',
    });

    await expect(controller.execute('batch-1')).rejects.toMatchObject({
      status: 400,
    });
  });

  it('executes a MOCK batch and returns the result + refreshed batch', async () => {
    batchManagerMock.getBatchById
      .mockResolvedValueOnce({
        id: 'batch-1',
        status: 'PENDING',
        provider: 'MOCK',
      })
      .mockResolvedValueOnce({
        id: 'batch-1',
        batchNumber: 'B-001',
        status: 'COMPLETED',
        executedAt: new Date(),
        completedAt: new Date(),
        failedAt: null,
        errorMessage: null,
      });
    orchestratorMock.executeBatch.mockResolvedValue({
      success: true,
      batchId: 'batch-1',
      batchNumber: 'B-001',
      totalAmount: 100,
      successCount: 2,
      failedCount: 0,
      errors: [],
    });

    const result = await controller.execute('batch-1');

    expect(orchestratorMock.executeBatch).toHaveBeenCalledWith(
      'batch-1',
      expect.any(Object)
    );
    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        message: 'Batch executed successfully: 2 payments completed',
      })
    );
  });

  it('reports partial failure message when some payments fail', async () => {
    batchManagerMock.getBatchById
      .mockResolvedValueOnce({
        id: 'batch-1',
        status: 'QUEUED',
        provider: 'MOCK',
      })
      .mockResolvedValueOnce(null);
    orchestratorMock.executeBatch.mockResolvedValue({
      success: false,
      batchId: 'batch-1',
      batchNumber: 'B-001',
      totalAmount: 100,
      successCount: 1,
      failedCount: 1,
      errors: ['provider timeout'],
    });

    const result = await controller.execute('batch-1');

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        message: 'Batch execution completed with errors: 1 failed',
        batch: null,
      })
    );
  });

  it('maps an orchestrator "not found" error to 404', async () => {
    batchManagerMock.getBatchById.mockResolvedValue({
      id: 'batch-1',
      status: 'PENDING',
      provider: 'MOCK',
    });
    orchestratorMock.executeBatch.mockRejectedValue(
      new Error('Batch not found')
    );

    await expect(controller.execute('batch-1')).rejects.toMatchObject({
      status: 404,
    });
  });

  describe('pause gate (E5, DECISION-LOG F83)', () => {
    const pendingBatch = { id: 'batch-1', status: 'PENDING', provider: 'MOCK' };

    it('returns 409 DISBURSEMENTS_PAUSED when payouts are paused in the DB, before any provider check', async () => {
      settingRows.push(...PAUSED_SETTING_ROWS);
      batchManagerMock.getBatchById.mockResolvedValue(pendingBatch);

      await expect(controller.execute('batch-1')).rejects.toMatchObject({
        status: 409,
        response: {
          error: 'Disbursements are paused',
          code: 'DISBURSEMENTS_PAUSED',
        },
      });
      expect(batchManagerMock.getBatchById).not.toHaveBeenCalled();
      expect(orchestratorMock.executeBatch).not.toHaveBeenCalled();
    });

    it('returns 409 when the env kill switch DISBURSEMENT_ENABLED=false is set', async () => {
      const original = process.env['DISBURSEMENT_ENABLED'];
      process.env['DISBURSEMENT_ENABLED'] = 'false';
      try {
        batchManagerMock.getBatchById.mockResolvedValue(pendingBatch);
        await expect(controller.execute('batch-1')).rejects.toMatchObject({
          status: 409,
        });
        expect(orchestratorMock.executeBatch).not.toHaveBeenCalled();
      } finally {
        if (original === undefined) delete process.env['DISBURSEMENT_ENABLED'];
        else process.env['DISBURSEMENT_ENABLED'] = original;
      }
    });
  });
});
