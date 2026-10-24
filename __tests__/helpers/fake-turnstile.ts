/**
 * A stand-in for Cloudflare's `window.turnstile` (CODE-15), for the tests of the three forms and of
 * the widget. `render` records every widget the code asks for; `solve` plays the part of a person
 * passing the challenge in the newest widget that is still on the page.
 */
import { act } from '@testing-library/react';

export const TURNSTILE_TEST_SITE_KEY = 'test-site-key-1x00000000000000';

export interface TurnstileRenderOptions {
  sitekey: string;
  callback: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
  [key: string]: unknown;
}

export interface FakeWidget {
  id: string;
  container: HTMLElement;
  options: TurnstileRenderOptions;
  removed: boolean;
}

export interface FakeTurnstile {
  api: {
    render: jest.Mock;
    remove: jest.Mock;
    reset: jest.Mock;
  };
  widgets: FakeWidget[];
  /** The widgets still on the page. */
  live: () => FakeWidget[];
  /** The newest live widget hands its callback a token. */
  solve: (token: string) => void;
  /** The newest live widget reports an error. */
  fail: () => void;
  /** The newest live widget reports that its token expired. */
  expire: () => void;
}

export function installFakeTurnstile(): FakeTurnstile {
  const widgets: FakeWidget[] = [];
  const api = {
    render: jest.fn(
      (container: HTMLElement, options: TurnstileRenderOptions): string => {
        const id = `widget-${widgets.length + 1}`;
        widgets.push({ id, container, options, removed: false });
        return id;
      }
    ),
    remove: jest.fn((id: string): void => {
      const widget = widgets.find((w) => w.id === id);
      if (widget) widget.removed = true;
    }),
    reset: jest.fn(),
  };
  Reflect.set(window, 'turnstile', api);

  const live = (): FakeWidget[] => widgets.filter((w) => !w.removed);
  const newest = (): FakeWidget => {
    const widget = live()[live().length - 1];
    if (!widget) throw new Error('no Turnstile widget is on the page');
    return widget;
  };

  return {
    api,
    widgets,
    live,
    solve: (token) => act(() => newest().options.callback(token)),
    fail: () => act(() => newest().options['error-callback']?.()),
    expire: () => act(() => newest().options['expired-callback']?.()),
  };
}

export function uninstallFakeTurnstile(): void {
  Reflect.deleteProperty(window, 'turnstile');
  document
    .querySelectorAll('script[src^="https://challenges.cloudflare.com"]')
    .forEach((script) => script.remove());
}

export function setTurnstileSiteKey(value: string | undefined): void {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, 'NEXT_PUBLIC_TURNSTILE_SITE_KEY');
  } else {
    Reflect.set(process.env, 'NEXT_PUBLIC_TURNSTILE_SITE_KEY', value);
  }
}
