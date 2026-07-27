/**
 * Disbursement Batches Controller (Session 4A-9, File 8/10)
 *
 * Ports app/api/disbursement/batches/[batchId]/execute/route.ts.
 * JwtAuthGuard+AdminGuard replace requireAdmin(). Delegates to the
 * already-DI-wired PaymentOrchestratorService/BatchManagerService/
 * provider-factory (built 4A-2, 4A-W6) -- see payment-orchestrator.service.ts
 * and provider-factory.ts's own header comments before touching either;
 * `executeBatch`'s WISE branch (4A-W6's `isFundable` check) is untouched
 * here.
 */

import {
  BadRequestException,
  Controller,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { AdminGuard } from '../../admin/admin.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { IdempotencyInterceptor } from '../../common/idempotency/idempotency.interceptor';
import { WisePaymentProvider } from '../../wise/providers/wise-payment.provider';
import { BatchManagerService } from '../batch-manager.service';
import { PaymentOrchestratorService } from '../payment-orchestrator.service';
import type { PaymentProvider } from '../providers/base-provider';
import {
  createPaymentProvider,
  isProviderAvailable,
} from '../providers/provider-factory';

@Controller('disbursement/batches')
@UseGuards(JwtAuthGuard, AdminGuard)
export class DisbursementBatchesController {
  constructor(
    private readonly batchManager: BatchManagerService,
    private readonly paymentOrchestrator: PaymentOrchestratorService,
    private readonly wisePaymentProvider: WisePaymentProvider
  ) {}

  @Post(':batchId/execute')
  @UseInterceptors(IdempotencyInterceptor)
  async execute(
    @Param('batchId') batchId: string
  ): Promise<Record<string, unknown>> {
    try {
      const batch = await this.batchManager.getBatchById(batchId);

      if (!batch) {
        throw new NotFoundException({ error: 'Batch not found' });
      }

      if (batch.status !== 'PENDING' && batch.status !== 'QUEUED') {
        throw new BadRequestException({
          error: `Cannot execute batch with status ${batch.status}`,
          details: 'Only PENDING or QUEUED batches can be executed',
        });
      }

      if (!isProviderAvailable(batch.provider)) {
        throw new BadRequestException({
          error: `Provider ${batch.provider} is not available`,
          details:
            'The selected payment provider is not implemented or unavailable',
        });
      }

      let provider: PaymentProvider;
      try {
        provider = createPaymentProvider(
          batch.provider,
          batch.provider === 'WISE'
            ? { wiseProvider: this.wisePaymentProvider }
            : undefined
        );
      } catch (error) {
        throw new InternalServerErrorException({
          error: 'Failed to initialize payment provider',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      const result = await this.paymentOrchestrator.executeBatch(
        batchId,
        provider
      );

      const updatedBatch = await this.batchManager.getBatchById(batchId);

      return {
        success: result.success,
        result: {
          batchId: result.batchId,
          batchNumber: result.batchNumber,
          totalAmount: result.totalAmount,
          successCount: result.successCount,
          failedCount: result.failedCount,
          errors: result.errors,
        },
        batch: updatedBatch
          ? {
              id: updatedBatch.id,
              batchNumber: updatedBatch.batchNumber,
              status: updatedBatch.status,
              executedAt: updatedBatch.executedAt,
              completedAt: updatedBatch.completedAt,
              failedAt: updatedBatch.failedAt,
              errorMessage: updatedBatch.errorMessage,
            }
          : null,
        message: result.success
          ? `Batch executed successfully: ${result.successCount} payments completed`
          : `Batch execution completed with errors: ${result.failedCount} failed`,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          throw new NotFoundException({ error: error.message });
        }
        if (error.message.includes('Cannot execute')) {
          throw new BadRequestException({ error: error.message });
        }
      }

      console.error('Error executing batch:', error);
      throw new InternalServerErrorException({
        error: 'Failed to execute batch',
      });
    }
  }
}
