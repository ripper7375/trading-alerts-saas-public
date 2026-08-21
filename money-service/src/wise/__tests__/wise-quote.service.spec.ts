/**
 * Wise Quote Service Tests (Session 4A-W6, File 2/8)
 *
 * Verifies F38 (platform bears the fee): quotes are requested by
 * `targetAmount`, and the returned `feeAmount`/`feeBearer` reflect that the
 * platform absorbs the Wise fee rather than the affiliate.
 */
import { Test } from '@nestjs/testing';

import { WiseQuoteService } from '../services/wise-quote.service';
import { WiseConfig } from '../wise.config';
import { WiseApiClient } from '../wise-api.client';

describe('WiseQuoteService', () => {
  let service: WiseQuoteService;
  let requestMock: jest.Mock;

  beforeEach(async () => {
    requestMock = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        WiseQuoteService,
        { provide: WiseApiClient, useValue: { request: requestMock } },
        { provide: WiseConfig, useValue: { profileId: '29617748' } },
      ],
    }).compile();

    service = moduleRef.get(WiseQuoteService);
  });

  it('requests the quote by targetAmount, never sourceAmount (F38)', async () => {
    requestMock.mockResolvedValue({
      id: 'quote-1',
      sourceCurrency: 'USD',
      targetCurrency: 'GBP',
      sourceAmount: 128.5,
      targetAmount: 100,
      rate: 0.78,
      paymentOptions: [
        {
          disabled: false,
          sourceAmount: 128.5,
          targetAmount: 100,
          fee: { total: 3.5 },
        },
      ],
    });

    await service.createQuote({
      sourceCurrency: 'USD',
      targetCurrency: 'GBP',
      targetAmount: 100,
      targetAccountId: '999',
    });

    expect(requestMock).toHaveBeenCalledWith(
      '/v3/profiles/29617748/quotes',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          targetAmount: 100,
          targetAccount: 999,
        }),
      })
    );
    const sentBody = requestMock.mock.calls[0][1].body;
    expect(sentBody.sourceAmount).toBeUndefined();
  });

  it('requests the quote by sourceAmount, never targetAmount, when sourceAmount is provided (F47)', async () => {
    requestMock.mockResolvedValue({
      id: 'quote-2',
      sourceCurrency: 'USD',
      targetCurrency: 'THB',
      sourceAmount: 50,
      targetAmount: 1762.5,
      rate: 35.25,
      paymentOptions: [
        {
          disabled: false,
          sourceAmount: 50,
          targetAmount: 1762.5,
          fee: { total: 1.2 },
        },
      ],
    });

    await service.createQuote({
      sourceCurrency: 'USD',
      targetCurrency: 'THB',
      sourceAmount: 50,
      targetAccountId: '888',
    });

    expect(requestMock).toHaveBeenCalledWith(
      '/v3/profiles/29617748/quotes',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          sourceAmount: 50,
          targetAccount: 888,
        }),
      })
    );
    const sentBody = requestMock.mock.calls[0][1].body;
    expect(sentBody.targetAmount).toBeUndefined();
  });

  it('the platform absorbs the fee -- affiliate receives the exact targetAmount', async () => {
    requestMock.mockResolvedValue({
      id: 'quote-1',
      sourceCurrency: 'USD',
      targetCurrency: 'GBP',
      sourceAmount: 128.5,
      targetAmount: 100,
      rate: 0.78,
      paymentOptions: [
        {
          disabled: false,
          sourceAmount: 128.5,
          targetAmount: 100,
          fee: { total: 3.5 },
        },
      ],
    });

    const result = await service.createQuote({
      sourceCurrency: 'USD',
      targetCurrency: 'GBP',
      targetAmount: 100,
      targetAccountId: '999',
    });

    expect(result.targetValue).toBe(100);
    expect(result.feeAmount).toBe(3.5);
    expect(result.feeBearer).toBe('PLATFORM');
    // sourceValue absorbs the fee, not targetValue
    expect(result.sourceValue).toBeGreaterThan(result.targetValue);
  });
});
