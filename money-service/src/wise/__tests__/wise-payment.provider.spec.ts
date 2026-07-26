/**
 * Wise Payment Provider Tests (Session 4A-W6, File 3/8)
 */
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock } from '../../test-utils/prisma-mock';
import { WisePaymentProvider } from '../providers/wise-payment.provider';
import { CapabilityUnavailableError } from '../providers/provider-capabilities';
import { WiseBatchGroupService } from '../services/wise-batch-group.service';
import { WiseQuoteService } from '../services/wise-quote.service';
import { WiseStateMapper } from '../services/wise-state.mapper';
import { WiseTransferService } from '../services/wise-transfer.service';
import { WiseApiClient } from '../wise-api.client';
import { WiseConfig } from '../wise.config';
import { WiseSignatureVerifier } from '../wise-signature.verifier';

describe('WisePaymentProvider', () => {
  let prismaMock: ReturnType<typeof createPrismaMock>;
  let wiseConfigMock: { fundingMode: 'MANUAL' | 'API'; environment: string };
  let provider: WisePaymentProvider;
  let quoteServiceMock: { createQuote: jest.Mock };
  let transferServiceMock: { createBatchGroupTransfer: jest.Mock };
  let batchGroupServiceMock: {
    getOrCreateForPaymentBatch: jest.Mock;
    completeBatch: jest.Mock;
    cancelBatch: jest.Mock;
    recordTransferAdded: jest.Mock;
  };

  beforeEach(() => {
    prismaMock = createPrismaMock();
    wiseConfigMock = { fundingMode: 'MANUAL', environment: 'sandbox' };
    quoteServiceMock = { createQuote: jest.fn() };
    transferServiceMock = { createBatchGroupTransfer: jest.fn() };
    batchGroupServiceMock = {
      getOrCreateForPaymentBatch: jest.fn(),
      completeBatch: jest.fn(),
      cancelBatch: jest.fn(),
      recordTransferAdded: jest.fn(),
    };

    provider = new WisePaymentProvider(
      prismaMock as unknown as PrismaService,
      { request: jest.fn() } as unknown as WiseApiClient,
      wiseConfigMock as unknown as WiseConfig,
      quoteServiceMock as unknown as WiseQuoteService,
      transferServiceMock as unknown as WiseTransferService,
      batchGroupServiceMock as unknown as WiseBatchGroupService,
      new WiseStateMapper(),
      { verifySignature: jest.fn() } as unknown as WiseSignatureVerifier
    );
  });

  describe('fundBatchFromBalance', () => {
    it('throws CapabilityUnavailableError under WISE_FUNDING_MODE=MANUAL', async () => {
      await expect(
        provider.fundBatchFromBalance('wise-batch-uuid')
      ).rejects.toThrow(CapabilityUnavailableError);
    });
  });

  describe('prepareBatch', () => {
    it('never touches Commission.status or AffiliateProfile.balance', async () => {
      batchGroupServiceMock.getOrCreateForPaymentBatch.mockResolvedValue({
        id: 'wbg-1',
        wiseBatchGroupId: 'wise-uuid-1',
        wiseVersion: 1,
      });
      prismaMock.affiliateWiseRecipient.findUnique.mockResolvedValue({
        id: 'rec-1',
        wiseRecipientId: '999',
        targetCurrency: 'GBP',
        status: 'ACTIVE',
      } as never);
      prismaMock.disbursementTransaction.findUnique.mockResolvedValue({
        id: 'dtx-1',
      } as never);
      quoteServiceMock.createQuote.mockResolvedValue({
        quoteId: 'quote-1',
        sourceCurrency: 'USD',
        targetCurrency: 'GBP',
        sourceValue: 128.5,
        targetValue: 100,
        rate: 0.78,
        feeAmount: 3.5,
        feeBearer: 'PLATFORM',
      });
      transferServiceMock.createBatchGroupTransfer.mockResolvedValue({
        transfer: {
          wiseTransferId: '4567890',
          customerTransactionId: 'cid-1',
          reference: 'ref-1',
        },
        created: true,
      });

      const result = await provider.prepareBatch({
        paymentBatchId: 'batch-1',
        batchName: 'BATCH-2026-1',
        sourceCurrency: 'USD',
        items: [
          { commissionId: 'comm-1', affiliateProfileId: 'aff-1', amount: 100 },
        ],
      });

      expect(result.failures).toEqual([]);
      expect(result.transfers).toHaveLength(1);
      expect(prismaMock.commission.update).not.toHaveBeenCalled();
      expect(prismaMock.affiliateProfile.update).not.toHaveBeenCalled();
    });

    it('records a non-fatal per-affiliate failure when the recipient is not ACTIVE, and continues the batch', async () => {
      batchGroupServiceMock.getOrCreateForPaymentBatch.mockResolvedValue({
        id: 'wbg-1',
        wiseBatchGroupId: 'wise-uuid-1',
        wiseVersion: 1,
      });
      prismaMock.affiliateWiseRecipient.findUnique.mockResolvedValue({
        id: 'rec-1',
        wiseRecipientId: '999',
        targetCurrency: 'GBP',
        status: 'INVALID',
      } as never);

      const result = await provider.prepareBatch({
        paymentBatchId: 'batch-1',
        batchName: 'BATCH-2026-1',
        sourceCurrency: 'USD',
        items: [
          { commissionId: 'comm-1', affiliateProfileId: 'aff-1', amount: 100 },
        ],
      });

      expect(result.transfers).toEqual([]);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].reason).toContain('INVALID');
      expect(quoteServiceMock.createQuote).not.toHaveBeenCalled();
    });
  });
});
