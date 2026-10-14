/**
 * The development preview of the Panel C instant prompts (build step 6 part 10; Option A, 2026-10-14):
 * the real top-left Market Context badge and press hook over a stand-in route, and a 404 in a
 * production build.
 */

import React from 'react';
import {
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { LocaleProvider } from '@/lib/context/locale-context';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';
import { INTAKE_TEXT } from '@/lib/intake/text';

jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'),
  usePathname: () => '/dev/intake/instant',
}));

import InstantPreviewPage, {
  dynamic,
  metadata,
} from '@/app/dev/intake/instant/page';
import { InstantPreview } from '@/app/dev/intake/instant/instant-preview';

const ORIGINAL_ENV = process.env;
const M5 = INTAKE_TEXT['intake.instant.m5'];
const M15 = INTAKE_TEXT['intake.instant.m15'];
/** The accessible names of the two badges: their visible text. */
const M5_BADGE = 'XAUUSD · M5 Market Context';
const M15_BADGE = 'XAUUSD · M15 Market Context';

function setNodeEnv(value: string): void {
  process.env = { ...ORIGINAL_ENV, NODE_ENV: value } as NodeJS.ProcessEnv;
}

function render(ui: React.ReactElement) {
  localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(defaultPreferences));
  return rtlRender(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <LocaleProvider initialPreferences={defaultPreferences}>
        {children}
      </LocaleProvider>
    ),
  });
}

afterEach(() => {
  process.env = ORIGINAL_ENV;
  localStorage.clear();
});

describe('the route', () => {
  it('answers 404 in a production build', () => {
    setNodeEnv('production');
    expect(() => InstantPreviewPage()).toThrow();
    try {
      InstantPreviewPage();
    } catch (error) {
      expect((error as { digest?: string }).digest).toContain('404');
    }
  });

  it('shows the preview in development, not indexed, rendered on every request', () => {
    setNodeEnv('development');
    expect(InstantPreviewPage().type).toBe(InstantPreview);
    expect(dynamic).toBe('force-dynamic');
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});

describe('the preview', () => {
  const press = (name: string) =>
    fireEvent.click(screen.getAllByRole('button', { name })[0] as HTMLElement);
  const spinners = (id: string) => screen.queryAllByTestId(id);

  it('shows both badges in both stand-in panes, M15 above M5, each with its question as the tooltip', () => {
    render(<InstantPreview />);
    const panes = screen.getByTestId('panes');
    const badges = within(panes).getAllByRole('button');
    expect(badges).toHaveLength(2);
    expect(badges[0]).toHaveAccessibleName(M15_BADGE);
    expect(badges[0]).toHaveAttribute('title', M15);
    expect(badges[1]).toHaveAccessibleName(M5_BADGE);
    expect(badges[1]).toHaveAttribute('title', M5);
    // the chart's own place for its overlay badge: top left
    expect(badges[0]?.closest('.absolute')?.className).toContain('top-2.5');
    expect(badges[0]?.closest('.absolute')?.className).toContain('left-2.5');
  });

  it('has no button at the bottom left', () => {
    render(<InstantPreview />);
    expect(screen.queryByTestId('ask-ai-overlay')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: M5 })).not.toBeInTheDocument();
  });

  it('PRO, Live, refusal: a press posts to the stand-in, shows the spinner, then the refusal text', async () => {
    render(<InstantPreview />);
    press(M5_BADGE);
    const log = screen.getByTestId('instant-log');
    expect(log).toHaveTextContent(
      'POST /api/intake/instant {"kind":"INSTANT_M5_INSPECT"} (stand-in)'
    );
    expect(spinners('market-context-spinner-m5').length).toBeGreaterThan(0);
    // one request for the whole chart: the other badge waits, busy and without a spinner
    for (const button of screen.getAllByRole('button', { name: M15_BADGE })) {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-busy', 'true');
    }
    expect(spinners('market-context-spinner-m15')).toHaveLength(0);
    const notice = await screen.findAllByRole('status', {}, { timeout: 4000 });
    expect(notice[0]).toHaveTextContent(
      INTAKE_TEXT['intake.refusal.quota_insufficient']
    );
    await waitFor(() =>
      expect(spinners('market-context-spinner-m5')).toHaveLength(0)
    );
  });

  it('FREE: a press opens the upgrade modal (a log line) and posts nothing', () => {
    render(<InstantPreview />);
    fireEvent.click(
      within(screen.getByTestId('instant-tier')).getByRole('button', {
        name: /FREE/,
      })
    );
    press(M15_BADGE);
    const log = screen.getByTestId('instant-log');
    expect(log).toHaveTextContent('the upgrade modal would open');
    expect(log).not.toHaveTextContent('POST /api/intake/instant');
  });

  it('shows the static states without any request', () => {
    render(<InstantPreview />);
    const mode = within(screen.getByTestId('instant-mode'));
    fireEvent.click(mode.getByRole('button', { name: 'In flight' }));
    expect(spinners('market-context-spinner-m5').length).toBeGreaterThan(0);
    // both badges wait, the spinner is on the M5 one only
    for (const name of [M15_BADGE, M5_BADGE]) {
      for (const badge of screen.getAllByRole('button', { name })) {
        expect(badge).toBeDisabled();
        expect(badge).toHaveAttribute('aria-busy', 'true');
      }
    }
    expect(spinners('market-context-spinner-m15')).toHaveLength(0);
    fireEvent.click(mode.getByRole('button', { name: 'Refused' }));
    expect(screen.getAllByRole('status')[0]).toHaveTextContent(
      INTAKE_TEXT['intake.refusal.quota_insufficient']
    );
    fireEvent.click(mode.getByRole('button', { name: 'Idle' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(spinners('market-context-spinner-m5')).toHaveLength(0);
  });

  it('makes no network call of its own', () => {
    const fetchSpy = jest.fn(async () => new Response('{}'));
    const original = global.fetch;
    global.fetch = fetchSpy as unknown as typeof fetch;
    try {
      render(<InstantPreview />);
      press(M5_BADGE);
      expect(
        (fetchSpy.mock.calls as unknown[][]).filter(
          ([url]) => url === '/api/intake/instant'
        )
      ).toHaveLength(0);
    } finally {
      global.fetch = original;
    }
  });
});
