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
import { DisbursementConfigError } from '../disbursement.constants';

import { PaymentProvider } from './base-provider';
import {
  createPaymentProvider,
  getAvailableProviders,
  isProviderAvailable,
} from './provider-factory';

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

// CODE-03 (WS-1): the mock provider exists only in development and test.
describe('provider factory fails closed outside development and test', () => {
  const KEYS = ['NODE_ENV', 'DISBURSEMENT_PROVIDER', 'VERCEL_ENV'] as const;
  const saved = new Map<string, string | undefined>();

  const setEnv = (key: (typeof KEYS)[number], value: string | undefined) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  };

  beforeEach(() => {
    for (const key of KEYS) saved.set(key, process.env[key]);
    setEnv('NODE_ENV', 'production');
    setEnv('DISBURSEMENT_PROVIDER', undefined);
    setEnv('VERCEL_ENV', undefined);
  });

  afterEach(() => {
    for (const key of KEYS) setEnv(key, saved.get(key));
  });

  it('refuses createPaymentProvider(MOCK) in production', () => {
    expect(() => createPaymentProvider('MOCK')).toThrow(
      DisbursementConfigError
    );
  });

  it('refuses createPaymentProvider(MOCK) on Preview, where NODE_ENV is production', () => {
    setEnv('VERCEL_ENV', 'preview');
    expect(() => createPaymentProvider('MOCK')).toThrow(
      DisbursementConfigError
    );
  });

  it('refuses the default provider in production when the variable is unset', () => {
    expect(() => createPaymentProvider()).toThrow(DisbursementConfigError);
  });

  it('refuses the default provider in production when the variable is MOCK', () => {
    setEnv('DISBURSEMENT_PROVIDER', 'MOCK');
    expect(() => createPaymentProvider()).toThrow(DisbursementConfigError);
  });

  it('still builds WISE from the supplied instance in production', () => {
    setEnv('DISBURSEMENT_PROVIDER', 'wise');
    const fakeWiseProvider = { name: 'WISE' } as unknown as PaymentProvider;

    expect(
      createPaymentProvider(undefined, { wiseProvider: fakeWiseProvider })
    ).toBe(fakeWiseProvider);
  });

  it('reports MOCK as unavailable in production, so a stored MOCK batch is refused', () => {
    expect(isProviderAvailable('MOCK')).toBe(false);
    expect(isProviderAvailable('WISE')).toBe(true);
  });

  it('lists only WISE as available in production', () => {
    expect(getAvailableProviders()).toEqual(['WISE']);
  });

  it('keeps MOCK available in test and development', () => {
    setEnv('NODE_ENV', 'test');
    expect(isProviderAvailable('MOCK')).toBe(true);
    expect(createPaymentProvider('MOCK').name).toBe('MOCK');
    setEnv('NODE_ENV', 'development');
    expect(getAvailableProviders()).toEqual(['MOCK', 'WISE']);
  });
});
