/**
 * Disbursement constants: the payout provider fails closed (CODE-03, WS-1).
 *
 * Outside development and test the provider must be named explicitly. An unset,
 * `MOCK` or unknown `DISBURSEMENT_PROVIDER` is refused at use (never at boot:
 * a service that refuses to start would also stop checkout and webhooks), and
 * Preview is refused too because only `NODE_ENV` decides what counts as
 * development or test.
 */
import {
  DisbursementConfigError,
  getConfiguredProviderName,
  getDefaultProvider,
  isMockProviderAllowed,
} from './disbursement.constants';

type EnvKey = 'NODE_ENV' | 'DISBURSEMENT_PROVIDER' | 'VERCEL_ENV';

const ENV_KEYS: EnvKey[] = ['NODE_ENV', 'DISBURSEMENT_PROVIDER', 'VERCEL_ENV'];

function setEnv(key: EnvKey, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

describe('disbursement provider configuration', () => {
  const saved = new Map<EnvKey, string | undefined>();

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved.set(key, process.env[key]);
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      setEnv(key, saved.get(key));
    }
  });

  describe('isMockProviderAllowed', () => {
    it.each(['development', 'test'])(
      'allows MOCK when NODE_ENV is %s',
      (env) => {
        setEnv('NODE_ENV', env);
        expect(isMockProviderAllowed()).toBe(true);
      }
    );

    it.each(['production', 'staging', '', undefined])(
      'refuses MOCK when NODE_ENV is %p',
      (env) => {
        setEnv('NODE_ENV', env);
        expect(isMockProviderAllowed()).toBe(false);
      }
    );

    it('refuses MOCK on Preview, where NODE_ENV is production', () => {
      setEnv('NODE_ENV', 'production');
      setEnv('VERCEL_ENV', 'preview');
      expect(isMockProviderAllowed()).toBe(false);
    });
  });

  describe('getDefaultProvider in production', () => {
    beforeEach(() => {
      setEnv('NODE_ENV', 'production');
    });

    it('throws a DisbursementConfigError when DISBURSEMENT_PROVIDER is unset', () => {
      setEnv('DISBURSEMENT_PROVIDER', undefined);
      expect(() => getDefaultProvider()).toThrow(DisbursementConfigError);
    });

    it('throws when DISBURSEMENT_PROVIDER is MOCK', () => {
      setEnv('DISBURSEMENT_PROVIDER', 'MOCK');
      expect(() => getDefaultProvider()).toThrow(DisbursementConfigError);
    });

    it('throws when DISBURSEMENT_PROVIDER is MOCK with spaces and lower case', () => {
      setEnv('DISBURSEMENT_PROVIDER', ' mock ');
      expect(() => getDefaultProvider()).toThrow(DisbursementConfigError);
    });

    it('throws when DISBURSEMENT_PROVIDER is empty or unknown', () => {
      setEnv('DISBURSEMENT_PROVIDER', '');
      expect(() => getDefaultProvider()).toThrow(DisbursementConfigError);
      setEnv('DISBURSEMENT_PROVIDER', 'PAYPAL');
      expect(() => getDefaultProvider()).toThrow(DisbursementConfigError);
    });

    it('throws on Preview even when MOCK is named', () => {
      setEnv('VERCEL_ENV', 'preview');
      setEnv('DISBURSEMENT_PROVIDER', 'MOCK');
      expect(() => getDefaultProvider()).toThrow(DisbursementConfigError);
    });

    it('returns WISE for wise, trimmed and in any case', () => {
      setEnv('DISBURSEMENT_PROVIDER', 'wise');
      expect(getDefaultProvider()).toBe('WISE');
      setEnv('DISBURSEMENT_PROVIDER', ' WISE ');
      expect(getDefaultProvider()).toBe('WISE');
    });

    it('still returns RISE (the factory refuses it)', () => {
      setEnv('DISBURSEMENT_PROVIDER', 'RISE');
      expect(getDefaultProvider()).toBe('RISE');
    });

    it('carries a fixed message that names no value and no secret', () => {
      setEnv('DISBURSEMENT_PROVIDER', 'PAYPAL');
      let caught: unknown;
      try {
        getDefaultProvider();
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(DisbursementConfigError);
      expect((caught as Error).name).toBe('DisbursementConfigError');
      expect((caught as Error).message).toBe(
        'DISBURSEMENT_PROVIDER must be set to a real provider outside development and test'
      );
    });
  });

  describe('getDefaultProvider in development and test', () => {
    it.each(['development', 'test'])(
      'falls back to MOCK in %s when unset, MOCK or unknown',
      (env) => {
        setEnv('NODE_ENV', env);
        setEnv('DISBURSEMENT_PROVIDER', undefined);
        expect(getDefaultProvider()).toBe('MOCK');
        setEnv('DISBURSEMENT_PROVIDER', 'MOCK');
        expect(getDefaultProvider()).toBe('MOCK');
        setEnv('DISBURSEMENT_PROVIDER', 'PAYPAL');
        expect(getDefaultProvider()).toBe('MOCK');
      }
    );

    it('still honours WISE and RISE in test', () => {
      setEnv('NODE_ENV', 'test');
      setEnv('DISBURSEMENT_PROVIDER', 'WISE');
      expect(getDefaultProvider()).toBe('WISE');
      setEnv('DISBURSEMENT_PROVIDER', 'RISE');
      expect(getDefaultProvider()).toBe('RISE');
    });
  });

  describe('getConfiguredProviderName', () => {
    it("is 'UNCONFIGURED' in production when the provider is unset, and never throws", () => {
      setEnv('NODE_ENV', 'production');
      setEnv('DISBURSEMENT_PROVIDER', undefined);
      expect(() => getConfiguredProviderName()).not.toThrow();
      expect(getConfiguredProviderName()).toBe('UNCONFIGURED');
    });

    it("is 'UNCONFIGURED' in production when MOCK is named", () => {
      setEnv('NODE_ENV', 'production');
      setEnv('DISBURSEMENT_PROVIDER', 'MOCK');
      expect(getConfiguredProviderName()).toBe('UNCONFIGURED');
    });

    it('reports the real provider when one is configured', () => {
      setEnv('NODE_ENV', 'production');
      setEnv('DISBURSEMENT_PROVIDER', 'WISE');
      expect(getConfiguredProviderName()).toBe('WISE');
    });

    it("reports 'MOCK' in test when nothing is set", () => {
      setEnv('NODE_ENV', 'test');
      setEnv('DISBURSEMENT_PROVIDER', undefined);
      expect(getConfiguredProviderName()).toBe('MOCK');
    });
  });
});
