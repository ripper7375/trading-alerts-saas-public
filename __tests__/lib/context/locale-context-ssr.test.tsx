/**
 * @jest-environment node
 *
 * LocaleProvider rendered on the server (T3-a): the first paint is translated
 * in every language, including the ones that are chunks of their own, without
 * the dictionary travelling as a prop. The server waits for the language's
 * chunk, then streams the page.
 *
 * @module __tests__/lib/context/locale-context-ssr.test
 */

import { PassThrough } from 'node:stream';
import { renderToPipeableStream } from 'react-dom/server';

import { LocaleProvider, useLocale } from '@/lib/context/locale-context';
import {
  defaultPreferences,
  type LocalePreferences,
} from '@/lib/i18n/locale-resolver';
import de from '@/lib/i18n/dictionaries/de.json';
import th from '@/lib/i18n/dictionaries/th.json';
import ar from '@/lib/i18n/dictionaries/ar.json';

jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));
jest.mock('@/app/actions/locale', () => ({
  syncLocaleCookiesAction: jest.fn(() => Promise.resolve({ success: true })),
}));

const KEY = 'Help Centre';
const word = (dictionary: unknown): string =>
  (dictionary as Record<string, string>)[KEY] as string;

function Probe(): React.ReactElement {
  const { t, language } = useLocale();
  return (
    <p data-language={language} data-testid="probe">
      {t(KEY)}
    </p>
  );
}

const preferencesFor = (language: string): LocalePreferences => ({
  ...defaultPreferences,
  language,
  timezone: 'Europe/London',
  timezoneSetByUser: true,
});

/** The HTML the server streams for the page, once every part of it is ready. */
function renderOnServer(language: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const sink = new PassThrough();
    const chunks: Buffer[] = [];
    sink.on('data', (chunk: Buffer) => chunks.push(chunk));
    sink.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    const { pipe } = renderToPipeableStream(
      <LocaleProvider initialPreferences={preferencesFor(language)}>
        <Probe />
      </LocaleProvider>,
      {
        onAllReady: () => pipe(sink),
        onShellError: reject,
        onError: reject,
      }
    );
  });
}

describe('the first paint on the server', () => {
  it('is UK English from the base dictionary', async () => {
    const html = await renderOnServer('en-GB');
    expect(html).toContain('>Help Centre<');
  });

  it('is US English from the base plus the overlay', async () => {
    const html = await renderOnServer('en-US');
    expect(html).toContain('>Help Center<');
  });

  it.each([
    ['th', th],
    ['de', de],
    ['ar', ar],
  ])('is already %s: the server awaits the chunk', async (language, dict) => {
    const html = await renderOnServer(language);
    expect(html).toContain(`data-language="${language}"`);
    expect(html).toContain(`>${word(dict)}<`);
    expect(html).not.toContain('>Help Centre<');
  });

  it('is English for a language it does not know', async () => {
    const html = await renderOnServer("x'+alert(1)+'");
    expect(html).toContain('>Help Centre<');
  });
});
