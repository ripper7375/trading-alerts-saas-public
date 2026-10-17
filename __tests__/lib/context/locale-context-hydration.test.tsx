/**
 * Hydrating a page the server rendered in a chunked language (T3-a).
 *
 * The server awaits the language's chunk before it streams the page, so the
 * markup is already translated. The browser has to hold the same dictionary
 * on its first client render or React hydrates over mismatched text (and the
 * labels flip); LocaleProvider therefore waits for the chunk while it
 * hydrates and the server's markup stays untouched meanwhile.
 *
 * Kept in a file of its own: the dictionary cache is module state, and a
 * language another test had loaded would make the wait vanish.
 *
 * @module __tests__/lib/context/locale-context-hydration.test
 */

import { act } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';

import { LocaleProvider, useLocale } from '@/lib/context/locale-context';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
  type LocalePreferences,
} from '@/lib/i18n/locale-resolver';
import { peekDictionary } from '@/lib/i18n/client-dictionaries';
import th from '@/lib/i18n/dictionaries/th.json';

jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));
jest.mock('@/app/actions/locale', () => ({
  syncLocaleCookiesAction: jest.fn(() => Promise.resolve({ success: true })),
}));

/** Holds every chunk load until the test lets it go; calls are recorded. */
let mockGateOpen: () => void = () => {};
let mockGate: Promise<void> = Promise.resolve();
const mockRequested: string[] = [];
const mockLoads = new Map<string, Promise<unknown>>();
jest.mock('@/lib/i18n/client-dictionaries', () => {
  const actual = jest.requireActual('@/lib/i18n/client-dictionaries');
  return {
    ...actual,
    loadDictionary: (language: string) => {
      mockRequested.push(language);
      if (!mockLoads.has(language)) {
        mockLoads.set(
          language,
          mockGate.then(() => actual.loadDictionary(language))
        );
      }
      return mockLoads.get(language);
    },
  };
});

const KEY = 'Help Centre';

function Probe(): React.ReactElement {
  const { t } = useLocale();
  return <p data-testid="probe">{t(KEY)}</p>;
}

const preferencesFor = (language: string): LocalePreferences => ({
  ...defaultPreferences,
  language,
  timezone: 'Europe/London',
  timezoneSetByUser: true,
});

let root: Root | undefined;
let container: HTMLDivElement;
let errors: jest.SpyInstance;

beforeEach(() => {
  localStorage.clear();
  mockRequested.length = 0;
  mockGate = new Promise<void>((resolve) => {
    mockGateOpen = resolve;
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  errors = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  container.remove();
  errors.mockRestore();
});

function hydrate(language: string): void {
  const preferences = preferencesFor(language);
  // Storage as the server saw it, so the provider makes no geo-IP call.
  localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(preferences));
  root = hydrateRoot(
    container,
    <LocaleProvider
      initialPreferences={preferences}
      detectedTimezone="Europe/London"
    >
      <Probe />
    </LocaleProvider>
  );
}

const hydrationErrors = (): unknown[][] =>
  errors.mock.calls.filter((call) => String(call[0]).match(/hydrat/i));

describe('hydrating UK English', () => {
  it('needs no chunk and adopts the server markup at once', async () => {
    container.innerHTML = `<p data-testid="probe">Help Centre</p>`;
    const serverNode = container.firstElementChild;

    await act(async () => hydrate('en-GB'));

    expect(mockRequested).toEqual([]);
    expect(container.firstElementChild).toBe(serverNode);
    expect(hydrationErrors()).toEqual([]);
  });
});

describe('hydrating a page the server rendered in Thai', () => {
  it('leaves the server markup alone until the Thai chunk is in, then adopts it', async () => {
    expect(peekDictionary('th')).toBeUndefined();
    const thaiText = (th as Record<string, string>)[KEY] as string;
    container.innerHTML = `<p data-testid="probe">${thaiText}</p>`;
    const serverNode = container.firstElementChild;

    await act(async () => hydrate('th'));

    // The provider asked for the chunk, and while it is on its way nothing
    // was rendered over the server's Thai text.
    expect(mockRequested).toContain('th');
    expect(peekDictionary('th')).toBeUndefined();
    expect(container.firstElementChild).toBe(serverNode);
    expect(container).toHaveTextContent(thaiText);

    await act(async () => {
      mockGateOpen();
      await mockGate;
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Hydrated over the same text: the server's element is still the element,
    // React reported no mismatch, and the text never became English.
    expect(peekDictionary('th')).toBeDefined();
    expect(container.firstElementChild).toBe(serverNode);
    expect(container).toHaveTextContent(thaiText);
    expect(container).not.toHaveTextContent('Help Centre');
    expect(hydrationErrors()).toEqual([]);
  });
});
