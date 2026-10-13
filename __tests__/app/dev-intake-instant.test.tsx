/**
 * The development preview of the Panel C instant prompts (build step 6 part 10): the real button,
 * overlay and press hook over a stand-in route, and a 404 in a production build.
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

  it('shows both buttons in both stand-in panes, M15 above M5', () => {
    render(<InstantPreview />);
    const overlays = screen.getAllByTestId('ask-ai-overlay');
    expect(overlays).toHaveLength(2);
    expect(
      within(overlays[0] as HTMLElement).getByRole('button')
    ).toHaveTextContent(M15);
    expect(
      within(overlays[1] as HTMLElement).getByRole('button')
    ).toHaveTextContent(M5);
  });

  it('PRO, Live, refusal: a press posts to the stand-in, shows the spinner, then the refusal text', async () => {
    render(<InstantPreview />);
    press(M5);
    const log = screen.getByTestId('instant-log');
    expect(log).toHaveTextContent(
      'POST /api/intake/instant {"kind":"INSTANT_M5_INSPECT"} (stand-in)'
    );
    expect(screen.getAllByTestId('ask-ai-spinner-m5').length).toBeGreaterThan(
      0
    );
    for (const button of screen.getAllByRole('button', { name: M15 })) {
      expect(button).toBeDisabled();
    }
    const notice = await screen.findAllByRole('status', {}, { timeout: 4000 });
    expect(notice[0]).toHaveTextContent(
      INTAKE_TEXT['intake.refusal.quota_insufficient']
    );
    await waitFor(() =>
      expect(screen.queryByTestId('ask-ai-spinner-m5')).not.toBeInTheDocument()
    );
  });

  it('FREE: a press opens the upgrade modal (a log line) and posts nothing', () => {
    render(<InstantPreview />);
    fireEvent.click(
      within(screen.getByTestId('instant-tier')).getByRole('button', {
        name: /FREE/,
      })
    );
    press(M15);
    const log = screen.getByTestId('instant-log');
    expect(log).toHaveTextContent('the upgrade modal would open');
    expect(log).not.toHaveTextContent('POST /api/intake/instant');
  });

  it('shows the static states without any request', () => {
    render(<InstantPreview />);
    const mode = within(screen.getByTestId('instant-mode'));
    fireEvent.click(mode.getByRole('button', { name: 'In flight' }));
    expect(screen.getAllByTestId('ask-ai-spinner-m5').length).toBeGreaterThan(
      0
    );
    fireEvent.click(mode.getByRole('button', { name: 'Refused' }));
    expect(screen.getAllByRole('status')[0]).toHaveTextContent(
      INTAKE_TEXT['intake.refusal.quota_insufficient']
    );
    fireEvent.click(mode.getByRole('button', { name: 'Idle' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ask-ai-spinner-m5')).not.toBeInTheDocument();
  });

  it('makes no network call of its own', () => {
    const fetchSpy = jest.fn(async () => new Response('{}'));
    const original = global.fetch;
    global.fetch = fetchSpy as unknown as typeof fetch;
    try {
      render(<InstantPreview />);
      press(M5);
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
