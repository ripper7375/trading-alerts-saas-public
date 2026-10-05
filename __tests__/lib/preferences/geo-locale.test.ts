/**
 * Regression tests for the pt-BR / it audit findings:
 *  - BR must be an accepted stored `countryCode` (monolith AND operation-service)
 *  - server-side GeoIP must resolve BR -> pt-BR/BRL and IT -> it/EUR
 *  - TradingView widgets must get a real locale for pt-BR and it
 *
 * @module __tests__/lib/preferences/geo-locale.test
 */

import fs from 'fs';
import path from 'path';

import { SUPPORTED_COUNTRIES } from '@/lib/country-config';
import { isSupportedLanguage } from '@/lib/i18n/languages';
import {
  SUPPORTED_COUNTRY_CODES,
  isValidPreference,
  sanitizePreferences,
} from '@/lib/preferences/defaults';
import { resolveLocaleFromCountryHeader } from '@/lib/preferences/geo-locale';
import { resolveTradingViewLocale } from '@/lib/utils/tradingview-locale';

describe('resolveLocaleFromCountryHeader', () => {
  it('resolves Brazil to pt-BR / BRL / São Paulo', () => {
    expect(resolveLocaleFromCountryHeader('BR')).toEqual({
      countryCode: 'BR',
      language: 'pt-BR',
      timezone: 'America/Sao_Paulo',
      dateFormat: 'DMY',
      timeFormat: '24h',
      currency: 'BRL',
    });
  });

  it('is case-insensitive for the header value', () => {
    expect(resolveLocaleFromCountryHeader('br')?.language).toBe('pt-BR');
  });

  it('resolves Italy to the Italian language, not the German Eurozone default', () => {
    expect(resolveLocaleFromCountryHeader('IT')).toMatchObject({
      language: 'it',
      currency: 'EUR',
      timezone: 'Europe/Rome',
      dateFormat: 'DMY',
      timeFormat: '24h',
    });
  });

  it('keeps Italy on a supported countryCode (policy 08 §4.A: no unbacked countries)', () => {
    const bundle = resolveLocaleFromCountryHeader('IT');
    expect(
      SUPPORTED_COUNTRIES[bundle!.countryCode.toLowerCase()]
    ).toBeDefined();
  });

  it('does not change other Eurozone / existing bundles', () => {
    expect(resolveLocaleFromCountryHeader('DE')?.language).toBe('de');
    expect(resolveLocaleFromCountryHeader('ES')?.language).toBe('de');
    expect(resolveLocaleFromCountryHeader('PT')?.language).toBe('de');
    expect(resolveLocaleFromCountryHeader('FR')?.language).toBe('fr');
    expect(resolveLocaleFromCountryHeader('KR')?.language).toBe('ko');
    expect(resolveLocaleFromCountryHeader('GB')?.language).toBe('en-GB');
  });

  it('returns null for unknown countries', () => {
    expect(resolveLocaleFromCountryHeader('XX')).toBeNull();
    expect(resolveLocaleFromCountryHeader(null)).toBeNull();
  });

  it.each(['BR', 'IT', 'DE', 'FR', 'KR', 'GB', 'IN', 'TR', 'AE'])(
    '%s bundle only uses a supported language and a stored-preference countryCode',
    (header) => {
      const bundle = resolveLocaleFromCountryHeader(header)!;
      expect(isSupportedLanguage(bundle.language)).toBe(true);
      expect(isValidPreference('countryCode', bundle.countryCode)).toBe(true);
    }
  );
});

describe('SUPPORTED_COUNTRY_CODES (stored countryCode allowlist)', () => {
  it('accepts every country in SUPPORTED_COUNTRIES (BR regression)', () => {
    for (const country of Object.values(SUPPORTED_COUNTRIES)) {
      expect(SUPPORTED_COUNTRY_CODES as readonly string[]).toContain(
        country.code
      );
    }
  });

  it('accepts BR and survives sanitizePreferences', () => {
    expect(isValidPreference('countryCode', 'BR')).toBe(true);
    expect(sanitizePreferences({ countryCode: 'BR' })).toEqual({
      countryCode: 'BR',
    });
  });

  it('still rejects unbacked countries (policy 08 §4.A)', () => {
    expect(isValidPreference('countryCode', 'CN')).toBe(false);
    expect(isValidPreference('countryCode', 'TW')).toBe(false);
    expect(isValidPreference('countryCode', 'IT')).toBe(false);
  });

  it('is mirrored verbatim by operation-service users.schemas.ts', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'operation-service/src/users/users.schemas.ts'),
      'utf8'
    );
    const block = source.match(
      /SUPPORTED_COUNTRY_CODES\s*=\s*\[([\s\S]*?)\]\s*as const/
    );
    expect(block).not.toBeNull();
    const mirrored = [...block![1]!.matchAll(/'([A-Z]{2})'/g)].map((m) => m[1]);
    expect(mirrored).toEqual([...SUPPORTED_COUNTRY_CODES]);
  });
});

describe('resolveTradingViewLocale', () => {
  it('maps pt-BR to TradingView Brazilian Portuguese', () => {
    expect(resolveTradingViewLocale('pt-BR')).toBe('br');
  });

  it('maps it to Italian', () => {
    expect(resolveTradingViewLocale('it')).toBe('it');
  });

  it('keeps existing mappings and the English fallback', () => {
    expect(resolveTradingViewLocale('pt')).toBe('pt');
    expect(resolveTradingViewLocale('ko')).toBe('kr');
    expect(resolveTradingViewLocale('zh-TW')).toBe('zh_TW');
    expect(resolveTradingViewLocale('xx')).toBe('en');
    expect(resolveTradingViewLocale(undefined)).toBe('en');
  });
});
