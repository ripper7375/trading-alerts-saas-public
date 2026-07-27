/**
 * Provider Factory Tests (Session 4A-W7, Step 1)
 *
 * No test file existed for this factory before this session (same
 * L28-class gap 4A-W6 found for payment-orchestrator.service.ts /
 * commission-aggregator.service.ts). Covers the new `WISE` case added this
 * session: `createPaymentProvider('WISE')` requires a DI-constructed
 * instance passed via `config.wiseProvider` (the factory itself has no DI
 * context to build one), and MUST NOT attempt to `new` a WisePaymentProvider
 * directly -- that would require importing `wise/*` into this file and
 * hand-wiring 8 collaborators outside Nest's container.
 */
import { PaymentProvider } from './base-provider';
import { createPaymentProvider, isProviderAvailable } from './provider-factory';

describe('createPaymentProvider', () => {
  it('returns the exact WisePaymentProvider instance supplied via config.wiseProvider', () => {
    const fakeWiseProvider = {
      name: 'WISE',
    } as unknown as PaymentProvider;

    const provider = createPaymentProvider('WISE', {
      wiseProvider: fakeWiseProvider,
    });

    expect(provider).toBe(fakeWiseProvider);
  });

  it('throws a clear error for WISE when no instance is supplied', () => {
    expect(() => createPaymentProvider('WISE')).toThrow(
      /requires a DI-constructed WisePaymentProvider instance/
    );
  });

  it('still returns a MockPaymentProvider for MOCK, unaffected by the WISE addition', () => {
    const provider = createPaymentProvider('MOCK');
    expect(provider.name).toBe('MOCK');
  });
});

describe('isProviderAvailable', () => {
  it('reports WISE as available now that it is wired', () => {
    expect(isProviderAvailable('WISE')).toBe(true);
  });
});
