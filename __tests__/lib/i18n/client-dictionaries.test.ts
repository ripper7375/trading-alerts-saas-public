/**
 * The browser's per-language dictionary chunks (T3-a): en-GB is the base,
 * en-US is the base plus a generated overlay, and every other language is a
 * chunk of its own that loads on demand.
 *
 * @module __tests__/lib/i18n/client-dictionaries.test
 */

import enGB from '@/lib/i18n/dictionaries/en-GB.json';
import enUS from '@/lib/i18n/dictionaries/en-US.json';
import overlay from '@/lib/i18n/overlays/en-US.json';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n/languages';
import {
  BASE_DICTIONARY,
  CHUNKED_LANGUAGES,
  loadDictionary,
  peekDictionary,
  preloadDictionaries,
} from '@/lib/i18n/client-dictionaries';

const {
  buildOverlay,
  serialise,
} = require('../../../scripts/i18n-build-en-us-overlay.js');

const OVERLAY_COMMAND = 'node scripts/i18n-build-en-us-overlay.js';

describe('the en-US overlay', () => {
  it(`is the base plus the overlay, key for key (regenerate with: ${OVERLAY_COMMAND})`, () => {
    expect({ ...enGB, ...overlay }).toEqual(enUS);
  });

  it('holds only keys whose US text differs from the UK text', () => {
    const redundant = Object.entries(overlay)
      .filter(([key, value]) => (enGB as Record<string, string>)[key] === value)
      .map(([key]) => key);
    expect(redundant).toEqual([]);
    expect(Object.keys(overlay).length).toBeGreaterThan(0);
  });

  it('adds no key the base lacks', () => {
    const unknown = Object.keys(overlay).filter((key) => !(key in enGB));
    expect(unknown).toEqual([]);
  });

  it(`matches what the generator writes (regenerate with: ${OVERLAY_COMMAND})`, () => {
    expect(serialise(buildOverlay())).toBe(
      JSON.stringify(overlay, null, 2) + '\n'
    );
  });

  it('stays small: that is the point of an overlay', () => {
    expect(JSON.stringify(overlay).length).toBeLessThan(20_000);
  });
});

describe('peekDictionary', () => {
  it('has the base at once', () => {
    expect(peekDictionary('en-GB')).toBe(BASE_DICTIONARY);
    expect(BASE_DICTIONARY).toBe(enGB);
  });

  it('has en-US at once, equal to the full en-US file', () => {
    const us = peekDictionary('en-US');
    expect(us).toEqual(enUS);
    expect(us?.['Help Centre']).toBe('Help Center');
    expect(BASE_DICTIONARY['Help Centre']).toBe('Help Centre');
    // One object, so a provider that asks twice gets the same identity.
    expect(peekDictionary('en-US')).toBe(us);
  });

  it('answers an unknown language with the base, as it always did', () => {
    expect(peekDictionary("x'+alert(1)+'")).toBe(BASE_DICTIONARY);
    expect(peekDictionary('')).toBe(BASE_DICTIONARY);
  });

  it('has nothing for a chunked language until it has loaded', async () => {
    jest.resetModules();
    const fresh = await import('@/lib/i18n/client-dictionaries');
    expect(fresh.peekDictionary('ja')).toBeUndefined();
    const loaded = await fresh.loadDictionary('ja');
    expect(fresh.peekDictionary('ja')).toBe(loaded);
  });
});

describe('every language the app offers', () => {
  const codes = SUPPORTED_LANGUAGES.map((l) => l.code);

  it('is either the base, the overlay, or has a chunk of its own', () => {
    const covered = new Set<string>(['en-GB', 'en-US', ...CHUNKED_LANGUAGES]);
    expect(codes.filter((code) => !covered.has(code))).toEqual([]);
    expect(CHUNKED_LANGUAGES.filter((code) => !codes.includes(code))).toEqual(
      []
    );
  });

  it('loads exactly its own dictionary file', async () => {
    for (const code of CHUNKED_LANGUAGES) {
      const [loaded, file] = await Promise.all([
        loadDictionary(code),
        import(`@/lib/i18n/dictionaries/${code}.json`),
      ]);
      expect(loaded).toEqual(file.default);
      expect(Object.keys(loaded).length).toBe(Object.keys(enGB).length);
      expect(peekDictionary(code)).toBe(loaded);
    }
  });
});

describe('loadDictionary', () => {
  it('hands every caller the same promise while a load is in flight', async () => {
    jest.resetModules();
    const fresh = await import('@/lib/i18n/client-dictionaries');
    const first = fresh.loadDictionary('de');
    expect(fresh.loadDictionary('de')).toBe(first);
    await first;
  });

  it('resolves at once for the base and the overlay', async () => {
    await expect(loadDictionary('en-GB')).resolves.toBe(BASE_DICTIONARY);
    await expect(loadDictionary('en-US')).resolves.toEqual(enUS);
  });

  it('preloads several languages', async () => {
    await preloadDictionaries(['fr', 'th']);
    expect(peekDictionary('fr')?.['Help Centre']).toBe("Centre d'aide");
    expect(peekDictionary('th')?.['Help Centre']).toBe('ศูนย์ช่วยเหลือ');
  });

  it('falls back to English when a chunk cannot be fetched, and tries again next time', async () => {
    jest.resetModules();
    let broken = true;
    jest.doMock('@/lib/i18n/dictionaries/ko.json', () => {
      if (broken) throw new Error('ChunkLoadError');
      return { __esModule: true, default: { marker: 'ok' } };
    });
    const fresh = await import('@/lib/i18n/client-dictionaries');

    const first = await fresh.loadDictionary('ko');
    expect(first).toBe(fresh.BASE_DICTIONARY);
    expect(fresh.peekDictionary('ko')).toBeUndefined();

    broken = false;
    const second = await fresh.loadDictionary('ko');
    expect(second).toEqual({ marker: 'ok' });
    expect(fresh.peekDictionary('ko')).toBe(second);
    jest.dontMock('@/lib/i18n/dictionaries/ko.json');
  });
});
