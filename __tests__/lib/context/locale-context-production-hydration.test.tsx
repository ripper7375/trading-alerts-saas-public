/**
 * LocaleProvider hydrating a chunked language, under React's PRODUCTION build.
 *
 * Jest runs React's development build, which tolerates something the production
 * build does not: a hook called after a `use()` that suspended while the
 * component was still mounting (here, while hydrating) throws React error #467,
 * "Update hook called on initial render", only in production. `next build` +
 * `next start` showed it on /about with a Thai cookie; no development-mode test
 * could. This test loads React's production build in an isolated module registry
 * and hydrates server markup the way the browser does -- inside a Suspense
 * boundary, as the app router wraps every page.
 *
 * @module __tests__/lib/context/locale-context-production-hydration.test
 */

import th from '@/lib/i18n/dictionaries/th.json';

const KEY = 'Help Centre';
const thaiText = (th as Record<string, string>)[KEY] as string;

const setNodeEnv = (value: string | undefined): void => {
  (process.env as Record<string, string | undefined>)['NODE_ENV'] = value;
};

describe('LocaleProvider with the production React build', () => {
  const realEnv = process.env['NODE_ENV'];
  afterAll(() => setNodeEnv(realEnv));

  it('hydrates a page the server rendered in Thai without a React error', async () => {
    const errors: unknown[] = [];
    const onError = (event: ErrorEvent): void => {
      errors.push(event.error);
      event.preventDefault();
    };
    window.addEventListener('error', onError);
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation((...args) => {
        errors.push(args);
      });

    const container = document.createElement('div');
    document.body.appendChild(container);
    let serverHtml = '';
    let serverNode: Element | null = null;

    await jest.isolateModulesAsync(async () => {
      setNodeEnv('production');
      jest.doMock('next/navigation', () => ({ usePathname: () => '/about' }));
      jest.doMock('@/app/actions/locale', () => ({
        syncLocaleCookiesAction: () => Promise.resolve({ success: true }),
      }));

      const React = require('react') as typeof import('react');
      const { hydrateRoot } =
        require('react-dom/client') as typeof import('react-dom/client');
      const { LocaleProvider, useLocale } =
        require('@/lib/context/locale-context') as typeof import('@/lib/context/locale-context');
      const { defaultPreferences, LOCALE_STORAGE_KEY } =
        require('@/lib/i18n/locale-resolver') as typeof import('@/lib/i18n/locale-resolver');
      const { peekDictionary } =
        require('@/lib/i18n/client-dictionaries') as typeof import('@/lib/i18n/client-dictionaries');

      // React's production build really is what is loaded (this export is development-only).
      expect(
        (React as unknown as Record<string, unknown>)['captureOwnerStack']
      ).toBeUndefined();

      const preferences = {
        ...defaultPreferences,
        language: 'th',
        timezone: 'Europe/London',
        timezoneSetByUser: true,
      };
      localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(preferences));

      function Probe(): React.ReactElement {
        const { t } = useLocale();
        return React.createElement('p', { 'data-testid': 'probe' }, t(KEY));
      }
      // The app router puts every page inside Suspense boundaries.
      const tree = (): React.ReactElement =>
        React.createElement(
          React.Suspense,
          { fallback: null },
          React.createElement(
            LocaleProvider,
            {
              initialPreferences: preferences,
              detectedTimezone: 'Europe/London',
            },
            React.createElement(Probe)
          )
        );

      // What the server sent: the finished page inside the Suspense boundary the
      // app router puts around every page (its comment markers).
      serverHtml = `<!--$--><p data-testid="probe">${thaiText}</p><!--/$-->`;
      container.innerHTML = serverHtml;
      serverNode = container.querySelector('p');
      expect(peekDictionary('th')).toBeUndefined();
      hydrateRoot(container, tree());
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    window.removeEventListener('error', onError);
    consoleError.mockRestore();

    expect(serverHtml).toContain(thaiText);
    expect(errors).toEqual([]);
    expect(container.querySelector('p')).toBe(serverNode);
    expect(container).toHaveTextContent(thaiText);
    container.remove();
  });
});
