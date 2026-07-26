/**
 * Wise Batches Admin Controller (Session 4A-W6, File 6/8)
 *
 * Implements `/wise/batches*` from `part19.5-wise-disbursement-openapi.yaml`
 * (frozen contract — "law"). `main.ts`'s global `/v1` prefix makes the real
 * paths `/v1/wise/batches*`. `AdminGuard` on every route (this is the
 * funding-gate operator surface, not affiliate-facing).
 *
 * Deviation from this order's own File 6/8 prose (recorded in full in the
 * order's Deviations at session close): the order's own description only
 * lists 3 endpoints (`GET /batches`, `GET /batches/:id/pay-in`,
 * `POST /batches/:id/mark-funded`) — the frozen OpenAPI actually documents
 * 7 (`GET /batches`, `POST /batches` [prepare], `GET /batches/:id`,
 * `POST /batches/:id/complete`, `POST /batches/:id/fund`,
 * `POST /batches/:id/mark-funded`, `POST /batches/:id/cancel`), and there is
 * no separate `/pay-in` sub-route at all — pay-in details are embedded in
 * `WiseBatchGroupDetail` (`GET /batches/:id` and the `complete` response).
 * Built against the OpenAPI, not this order's paraphrase (`LESSONS-LEARNED.md`
 * L27).
 *
 * `prepareBatch`/`completeBatch` here are the ADMIN/manual-recovery surface
 * (matching the OpenAPI's own two-step REST shape) — the automated
 * production path is 4A-W6's own `PaymentOrchestratorService.executeBatch`
 * (File 4/8), which does prepare+complete together inside the cron flow per
 * design §6.2's own diagram. Both converge on the SAME underlying services
 * (`WiseBatchGroupService`/`WiseTransferService`), which are idempotent per
 * `PaymentBatch`, so calling either path twice — cron then admin retry, or
 * vice versa — is safe.
 */

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';

import { AdminGuard } from '../../admin/admin.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { CapabilityUnavailableError } from '../providers/provider-capabilities';
import { WisePaymentProvider } from '../providers/wise-payment.provider';
import { WiseBatchGroupService } from '../services/wise-batch-group.service';

const listQuerySchema = z.object({
  status: z
    .enum([
      'NEW',
      'COMPLETED',
      'AWAITING_MANUAL_FUNDING',
      'FUNDED',
      'MARKED_FOR_CANCELLATION',
      'PROCESSING_CANCEL',
      'CANCELLED',
    ])
    .optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(25),
});

const prepareBodySchema = z.object({
  paymentBatchId: z.string().min(1),
  idempotencyKey: z.string().uuid(),
});

const markFundedBodySchema = z.object({
  fundedAt: z.coerce.date(),
  bankReference: z.string().max(255).optional(),
  note: z.string().max(1000).optional(),
});

@Controller('wise/batches')
@UseGuards(JwtAuthGuard, AdminGuard)
export class WiseBatchesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wisePaymentProvider: WisePaymentProvider,
    private readonly wiseBatchGroupService: WiseBatchGroupService
  ) {}

  @Get()
  async list(@Query() query: Record<string, string>) {
    const validation = listQuerySchema.safeParse(query);
    if (!validation.success) {
      throw new BadRequestException({
        error: 'Invalid query parameters',
        details: validation.error.flatten(),
      });
    }
    const { status, page, pageSize } = validation.data;
    const where = status ? { status } : {};

    const [items, total] = await Promise.all([
      this.prisma.wiseBatchGroup.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.wiseBatchGroup.count({ where }),
    ]);

    return { items, total };
  }

  @Post()
  async prepare(@Body() body: unknown) {
    const validation = prepareBodySchema.safeParse(body);
    if (!validation.success) {
      throw new BadRequestException({
        error: 'Invalid request body',
        details: validation.error.flatten(),
      });
    }
    const { paymentBatchId } = validation.data;

    const paymentBatch = await this.prisma.paymentBatch.findUnique({
      where: { id: paymentBatchId },
    });
    if (!paymentBatch) {
      throw new NotFoundException({ error: 'PaymentBatch not found' });
    }
    if (paymentBatch.provider !== 'WISE') {
      throw new BadRequestException({
        error: 'PaymentBatch not in a draftable state, or provider is not WISE',
      });
    }

    const pendingTransactions =
      await this.prisma.disbursementTransaction.findMany({
        where: { batchId: paymentBatchId, status: 'PENDING' },
        include: {
          commission: { select: { affiliateProfileId: true } },
        },
      });

    const prepared = await this.wisePaymentProvider.prepareBatch({
      paymentBatchId,
      batchName: paymentBatch.batchNumber,
      sourceCurrency: paymentBatch.currency,
      items: pendingTransactions.map((txn) => ({
        commissionId: txn.commissionId,
        affiliateProfileId: txn.commission.affiliateProfileId,
        amount: Number(txn.amount),
      })),
    });

    const batchGroup = await this.prisma.wiseBatchGroup.findUniqueOrThrow({
      where: { paymentBatchId },
    });

    return { ...this.toDetailDto(batchGroup), failures: prepared.failures };
  }

  @Get(':batchId')
  async get(@Param('batchId') batchId: string) {
    const batchGroup = await this.findByIdOrThrow(batchId);
    return this.toDetailDto(batchGroup);
  }

  @Post(':batchId/complete')
  async complete(@Param('batchId') batchId: string) {
    const batchGroup = await this.findByIdOrThrow(batchId);
    await this.wisePaymentProvider.completeBatch(batchGroup.wiseBatchGroupId);
    const updated = await this.findByIdOrThrow(batchId);
    return this.toDetailDto(updated);
  }

  @Post(':batchId/fund')
  async fund(@Param('batchId') batchId: string) {
    const batchGroup = await this.findByIdOrThrow(batchId);
    try {
      await this.wisePaymentProvider.fundBatchFromBalance(
        batchGroup.wiseBatchGroupId
      );
    } catch (error) {
      if (error instanceof CapabilityUnavailableError) {
        throw new BadRequestException({
          error: 'Not implemented',
          message: error.message,
          statusCodeOverride: 501,
        });
      }
      throw error;
    }
    const updated = await this.findByIdOrThrow(batchId);
    return this.toDetailDto(updated);
  }

  @Post(':batchId/mark-funded')
  async markFunded(@Param('batchId') batchId: string, @Body() body: unknown) {
    const validation = markFundedBodySchema.safeParse(body);
    if (!validation.success) {
      throw new BadRequestException({
        error: 'Invalid request body',
        details: validation.error.flatten(),
      });
    }
    await this.findByIdOrThrow(batchId);
    const updated = await this.wiseBatchGroupService.markFunded(
      batchId,
      validation.data
    );
    return this.toDetailDto(updated);
  }

  @Post(':batchId/cancel')
  async cancel(@Param('batchId') batchId: string) {
    await this.findByIdOrThrow(batchId);
    const updated = await this.wiseBatchGroupService.cancelBatch(batchId);
    return this.toDetailDto(updated);
  }

  private async findByIdOrThrow(batchId: string) {
    const batchGroup = await this.prisma.wiseBatchGroup.findUnique({
      where: { id: batchId },
    });
    if (!batchGroup) {
      throw new NotFoundException({ error: 'Wise batch group not found' });
    }
    return batchGroup;
  }

  private toDetailDto(batchGroup: {
    id: string;
    paymentBatchId: string;
    wiseBatchGroupId: string;
    sourceCurrency: string;
    transferCount: number;
    totalSourceAmount: unknown;
    status: string;
    payInDetails: unknown;
    fundingSource: string | null;
    fundedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: batchGroup.id,
      paymentBatchId: batchGroup.paymentBatchId,
      wiseBatchGroupId: batchGroup.wiseBatchGroupId,
      sourceCurrency: batchGroup.sourceCurrency,
      transferCount: batchGroup.transferCount,
      totalSourceAmount: String(batchGroup.totalSourceAmount),
      status: batchGroup.status,
      payInDetails: batchGroup.payInDetails ?? null,
      fundingSource: batchGroup.fundingSource,
      fundedAt: batchGroup.fundedAt,
      completedAt: batchGroup.completedAt,
      createdAt: batchGroup.createdAt,
      // Per-affiliate DRAFTING failures are a synchronous, in-memory-only
      // result of `prepare` -- not persisted, so a later GET always shows
      // none here (known limitation, see file header).
      failures: [] as Array<{ affiliateProfileId: string; reason: string }>,
    };
  }
}
