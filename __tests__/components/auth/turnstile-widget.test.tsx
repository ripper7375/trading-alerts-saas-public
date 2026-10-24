/**
 * The Turnstile widget and its hook (CODE-15).
 *
 * `useTurnstile()` tells a form whether a challenge is required (the site key is set), holds the
 * token and renders the widget. The widget loads Cloudflare's script once, renders explicitly,
 * hands the token to the form, and takes the widget off the page when it unmounts or is reset
 * (a token is single use: every attempt needs a fresh one).
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

jest.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

import {
  TURNSTILE_FAILED_CODE,
  TURNSTILE_SCRIPT_SRC,
  getTurnstileSiteKey,
  useTurnstile,
} from '@/components/auth/turnstile-widget';
import { TURNSTILE_FAILED_CODE as SERVER_FAILED_CODE } from '@/lib/security/turnstile';
import { LocaleProvider } from '@/lib/context/locale-context';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';

import {
  TURNSTILE_TEST_SITE_KEY,
  installFakeTurnstile,
  setTurnstileSiteKey,
  uninstallFakeTurnstile,
} from '../../helpers/fake-turnstile';

function Harness(): React.JSX.Element {
  const turnstile = useTurnstile();
  return (
    <div>
      <p data-testid="state">
        {`${turnstile.required ? 'required' : 'off'}|${turnstile.token ?? 'none'}|${
          turnstile.ready ? 'ready' : 'waiting'
        }`}
      </p>
      {turnstile.widget}
      <button type="button" onClick={turnstile.reset}>
        reset
      </button>
    </div>
  );
}

function withLocale(ui: React.ReactElement): React.ReactElement {
  return <LocaleProvider>{ui}</LocaleProvider>;
}

const state = (): string => screen.getByTestId('state').textContent ?? '';
const scripts = (): NodeListOf<HTMLScriptElement> =>
  document.querySelectorAll<HTMLScriptElement>(
    'script[src^="https://challenges.cloudflare.com"]'
  );

describe('CODE-15: the Turnstile widget', () => {
  let savedKey: string | undefined;

  beforeAll(() => {
    savedKey = process.env['NEXT_PUBLIC_TURNSTILE_SITE_KEY'];
  });

  beforeEach(() => {
    localStorage.setItem(
      LOCALE_STORAGE_KEY,
      JSON.stringify(defaultPreferences)
    );
    setTurnstileSiteKey(TURNSTILE_TEST_SITE_KEY);
    uninstallFakeTurnstile();
  });

  afterEach(() => {
    uninstallFakeTurnstile();
  });

  afterAll(() => {
    setTurnstileSiteKey(savedKey);
  });

  describe('getTurnstileSiteKey', () => {
    it.each([undefined, '', '   '])(
      'is null when the site key is %j',
      (value) => {
        setTurnstileSiteKey(value);
        expect(getTurnstileSiteKey()).toBeNull();
      }
    );

    it('is the (trimmed) key when it is set', () => {
      setTurnstileSiteKey(`  ${TURNSTILE_TEST_SITE_KEY}  `);
      expect(getTurnstileSiteKey()).toBe(TURNSTILE_TEST_SITE_KEY);
    });
  });

  it('answers to the same error code as the server (the literal is spelled out on both sides)', () => {
    expect(TURNSTILE_FAILED_CODE).toBe('TURNSTILE_FAILED');
    expect(SERVER_FAILED_CODE).toBe('TURNSTILE_FAILED');
  });

  it('loads the script from the Cloudflare origin with explicit rendering', () => {
    expect(TURNSTILE_SCRIPT_SRC).toBe(
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    );
  });

  describe('without a site key (local development)', () => {
    it('requires nothing, renders nothing and loads nothing', () => {
      setTurnstileSiteKey(undefined);
      const fake = installFakeTurnstile();

      render(withLocale(<Harness />));

      expect(state()).toBe('off|none|ready');
      expect(fake.api.render).not.toHaveBeenCalled();
      expect(scripts()).toHaveLength(0);
    });
  });

  describe('with a site key', () => {
    it('requires a token, adds the script once and renders once the script has loaded', () => {
      render(withLocale(<Harness />));

      expect(state()).toBe('required|none|waiting');
      expect(scripts()).toHaveLength(1);
      expect(scripts()[0]?.src).toBe(TURNSTILE_SCRIPT_SRC);

      const fake = installFakeTurnstile();
      expect(fake.api.render).not.toHaveBeenCalled();
      act(() => {
        scripts()[0]?.dispatchEvent(new Event('load'));
      });

      expect(fake.api.render).toHaveBeenCalledTimes(1);
      const [container, options] = fake.api.render.mock.calls[0] as [
        HTMLElement,
        Record<string, unknown>,
      ];
      expect(document.body.contains(container)).toBe(true);
      expect(options['sitekey']).toBe(TURNSTILE_TEST_SITE_KEY);
    });

    it('renders at once when the script is already there, without adding another', () => {
      const fake = installFakeTurnstile();

      render(withLocale(<Harness />));

      expect(fake.api.render).toHaveBeenCalledTimes(1);
      expect(scripts()).toHaveLength(0);
    });

    it('adds the script only once for two widgets that mount before it has loaded', () => {
      render(
        withLocale(
          <>
            <Harness />
            <Harness />
          </>
        )
      );

      expect(scripts()).toHaveLength(1);

      const fake = installFakeTurnstile();
      act(() => {
        scripts()[0]?.dispatchEvent(new Event('load'));
      });
      expect(fake.api.render).toHaveBeenCalledTimes(2);
    });

    it('hands the form the token, takes it back when it expires, and is ready only while it holds one', () => {
      const fake = installFakeTurnstile();
      render(withLocale(<Harness />));
      expect(state()).toBe('required|none|waiting');

      fake.solve('cf-token-1');
      expect(state()).toBe('required|cf-token-1|ready');

      fake.expire();
      expect(state()).toBe('required|none|waiting');
    });

    it('shows a message and holds no token when the widget reports an error', () => {
      const fake = installFakeTurnstile();
      render(withLocale(<Harness />));
      fake.solve('cf-token-1');

      fake.fail();

      expect(state()).toBe('required|none|waiting');
      expect(
        screen.getByText(
          'The security check could not be loaded. Reload the page and try again.'
        )
      ).toBeTruthy();
    });

    it('shows the same message when the script cannot be loaded, and lets the next widget try again', () => {
      const first = render(withLocale(<Harness />));
      expect(scripts()).toHaveLength(1);

      act(() => {
        scripts()[0]?.dispatchEvent(new Event('error'));
      });

      expect(
        screen.getByText(
          'The security check could not be loaded. Reload the page and try again.'
        )
      ).toBeTruthy();
      expect(scripts()).toHaveLength(0);

      first.unmount();
      render(withLocale(<Harness />));
      expect(scripts()).toHaveLength(1);
    });

    it('replaces the widget with a fresh one on reset: the old one is removed and no token is held', () => {
      const fake = installFakeTurnstile();
      render(withLocale(<Harness />));
      fake.solve('cf-token-1');
      expect(fake.live()).toHaveLength(1);

      fireEvent.click(screen.getByRole('button', { name: 'reset' }));

      expect(fake.api.remove).toHaveBeenCalledWith('widget-1');
      expect(fake.widgets).toHaveLength(2);
      expect(fake.live().map((w) => w.id)).toEqual(['widget-2']);
      expect(state()).toBe('required|none|waiting');

      fake.solve('cf-token-2');
      expect(state()).toBe('required|cf-token-2|ready');
    });

    it('removes the widget when the form goes away', () => {
      const fake = installFakeTurnstile();
      const view = render(withLocale(<Harness />));

      view.unmount();

      expect(fake.api.remove).toHaveBeenCalledWith('widget-1');
      expect(fake.live()).toHaveLength(0);
    });

    it('does not render a widget for a form that was gone before the script loaded', () => {
      const view = render(withLocale(<Harness />));
      view.unmount();

      const fake = installFakeTurnstile();
      act(() => {
        scripts()[0]?.dispatchEvent(new Event('load'));
      });

      expect(fake.api.render).not.toHaveBeenCalled();
    });
  });
});
