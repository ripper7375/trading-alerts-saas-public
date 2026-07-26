import { MockPaymentProvider } from '../../disbursement/providers/mock-provider';

import type {
  FundableProvider,
  PrepareBatchInput,
  PreparedBatch,
  PayInInstruction,
} from './provider-capabilities';
import {
  isFundable,
  CapabilityUnavailableError,
} from './provider-capabilities';

/** Minimal Wise-shaped stub — only what `isFundable` structurally checks for. */
function makeFundableStub(): FundableProvider {
  return {
    fundingMode: 'MANUAL',
    async prepareBatch(_input: PrepareBatchInput): Promise<PreparedBatch> {
      throw new Error('not used in this test');
    },
    async completeBatch(_id: string): Promise<PayInInstruction[]> {
      throw new Error('not used in this test');
    },
    async fundBatchFromBalance(_id: string): Promise<void> {
      throw new Error('not used in this test');
    },
    async cancelBatch(_id: string, _version: number): Promise<void> {
      throw new Error('not used in this test');
    },
  };
}

describe('isFundable', () => {
  it('narrows a Wise-shaped provider (has prepareBatch) as fundable', () => {
    const wiseLike = Object.assign(
      new MockPaymentProvider(),
      makeFundableStub()
    );
    expect(isFundable(wiseLike)).toBe(true);
  });

  it('does not narrow MockPaymentProvider as fundable', () => {
    const mock = new MockPaymentProvider();
    expect(isFundable(mock)).toBe(false);
  });

  it('does not narrow an archived-Rise-shaped provider (no prepareBatch) as fundable', () => {
    const riseLike = new MockPaymentProvider();
    Object.defineProperty(riseLike, 'name', { value: 'RISE' });
    expect(isFundable(riseLike)).toBe(false);
  });
});

describe('CapabilityUnavailableError', () => {
  it('carries the capability name and a readable message', () => {
    const error = new CapabilityUnavailableError(
      'fundBatchFromBalance unavailable under WISE_FUNDING_MODE=MANUAL',
      'fundBatchFromBalance'
    );
    expect(error.name).toBe('CapabilityUnavailableError');
    expect(error.capability).toBe('fundBatchFromBalance');
    expect(error.message).toContain('MANUAL');
  });
});
