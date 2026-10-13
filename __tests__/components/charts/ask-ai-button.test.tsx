/**
 * Panel C instant prompts (build step 6 part 10; architecture 4.2 and 4.10; plan decision D10):
 * the button, the press hook and the two buttons inside the stacked charts.
 *
 * What is held here:
 *  - the buttons render only when the flag says so, one on each pane, and never while it is off;
 *  - a PRO press posts `{ kind }` and nothing else, once; a Free press opens the upgrade modal and
 *    posts nothing;
 *  - while a request is in flight everything is disabled and a second press is ignored;
 *  - a refusal shows the server's own reply beside its button, and goes away by itself;
 *  - keyboard and screen-reader behaviour, Arabic and Urdu (right to left), long German and Thai;
 *  - the split arithmetic is untouched: the same canvas heights with the buttons on and off.
 *
 * jsdom has no layout engine, so the width of a long label is held through its wrapping classes and
 * looked at in a browser (the hand-off says how); a real height is held through the heights pushed
 * to the chart.
 */

import React from 'react';
import {
  act,
  fireEvent,
  render as rtlRender,
  renderHook,
  screen,
  waitFor,
  within,
  type RenderOptions,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import { AppearanceProvider } from '@/components/providers/appearance-provider';
import { LocaleProvider } from '@/lib/context/locale-context';
import {
  LOCALE_STORAGE_KEY,
  defaultPreferences,
} from '@/lib/i18n/locale-resolver';
import { INTAKE_TEXT, INSTANT_TEXT_KEY } from '@/lib/intake/text';
import ar from '@/lib/i18n/dictionaries/ar.json';
import de from '@/lib/i18n/dictionaries/de.json';
import th from '@/lib/i18n/dictionaries/th.json';
import ur from '@/lib/i18n/dictionaries/ur.json';

jest.mock('next/navigation', () => ({
  usePathname: () => '/terminal',
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/hooks/use-ohlcv-socket', () => ({
  useOhlcvSocket: jest.fn(),
}));

import { useOhlcvSocket } from '@/hooks/use-ohlcv-socket';
const mockUseOhlcvSocket = useOhlcvSocket as jest.MockedFunction<
  typeof useOhlcvSocket
>;

// See mtf-stacked-charts.test.tsx: `appliedHeights` records every height pushed to a live chart.
jest.mock('lightweight-charts', () => {
  const appliedHeights: number[] = [];
  const mockTimeScale = {
    fitContent: jest.fn(),
    getVisibleRange: jest.fn(() => ({ from: 1000, to: 2000 })),
    setVisibleRange: jest.fn(),
    subscribeVisibleTimeRangeChange: jest.fn(),
    unsubscribeVisibleTimeRangeChange: jest.fn(),
  };
  return {
    __appliedHeights: appliedHeights,
    createChart: jest.fn(() => ({
      addSeries: () => ({
        setData: jest.fn(),
        setMarkers: jest.fn(),
        applyOptions: jest.fn(),
      }),
      remove: jest.fn(),
      timeScale: () => mockTimeScale,
      applyOptions: (options: { height?: number }) => {
        if (typeof options?.height === 'number') {
          appliedHeights.push(options.height);
        }
      },
    })),
    ColorType: { Solid: 'Solid' },
    CandlestickSeries: 'Candlestick',
  };
});

const appliedChartHeights = (
  jest.requireMock('lightweight-charts') as { __appliedHeights: number[] }
).__appliedHeights;

jest.mock('@/components/charts/drawing/DrawingLayer', () => ({
  DrawingLayer: () => null,
}));

jest.mock('@/components/charts/drawing/useFiredAlertMarkers', () => ({
  useFiredAlertMarkers: jest.fn(),
}));

jest.mock('@/components/charts/mtf/MtfToggle', () => ({
  MtfToggle: () => null,
}));

const mockUseSession = jest.fn();
jest.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}));

import { AskAiButton } from '@/components/charts/ask-ai-button';
import { MtfStackedCharts } from '@/components/charts/mtf-stacked-charts';
import { CHROME_PER_CHART } from '@/components/charts/mtf-split-layout';
import {
  INSTANT_ENDPOINT,
  NOTICE_MS,
  instantKindFor,
  postInstantPrompt,
  useInstantPrompt,
} from '@/components/charts/use-instant-prompt';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

type Preferences = typeof defaultPreferences;

function withLanguage(language: string): Preferences {
  return { ...defaultPreferences, language, timezoneSetByUser: true };
}

/** The providers of the app, in a given interface language (English by default). */
function providers(language = 'en-US') {
  const preferences = withLanguage(language);
  // seeding storage skips the provider's geo-IP fetch (LESSONS-LEARNED.md L40)
  localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(preferences));
  return function Providers({ children }: { children: React.ReactNode }) {
    return (
      <LocaleProvider
        initialPreferences={preferences}
        detectedTimezone={preferences.timezone}
      >
        <AppearanceProvider>{children}</AppearanceProvider>
      </LocaleProvider>
    );
  };
}

function render(
  ui: React.ReactElement,
  language = 'en-US',
  options?: RenderOptions
) {
  return rtlRender(ui, { wrapper: providers(language), ...options });
}

const M5_ENGLISH = INTAKE_TEXT[INSTANT_TEXT_KEY.INSTANT_M5_INSPECT];
const M15_ENGLISH = INTAKE_TEXT[INSTANT_TEXT_KEY.INSTANT_M15_INSPECT];
const UNAVAILABLE_ENGLISH = INTAKE_TEXT['intake.refusal.feature_unavailable'];

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const success = (): Response =>
  jsonResponse(200, { success: true, packet: { schema: 'p' }, trace: {} });

const refusal = (status: number, code: string, reply: string): Response =>
  jsonResponse(status, {
    success: false,
    error: { code, message: 'English for a log' },
    refusal: { code, reply, reply_locale: 'en-US' },
    trace: {},
  });

/** A promise the test settles by hand, to hold a request in flight. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const mockFetch = jest.fn();
const ORIGINAL_FETCH = global.fetch;

/** The calls that went to the instant route (the providers make other calls of their own). */
const instantCalls = (): unknown[][] =>
  mockFetch.mock.calls.filter(([url]) => url === INSTANT_ENDPOINT);

/**
 * What the instant route answers, built fresh for each call (a Response can be read once). Every
 * other URL gets its own empty answer: a Response shared through mockResolvedValue would be eaten
 * by whichever provider asked first. With several makers, each call takes the next and the last
 * one repeats.
 */
function answerInstant(
  ...makers: Array<() => Promise<Response> | Response>
): void {
  const queue = [...makers];
  mockFetch.mockImplementation(async (url: unknown) => {
    if (url !== INSTANT_ENDPOINT) return new Response('{}', { status: 200 });
    const make = queue.length > 1 ? queue.shift() : queue[0];
    return (make as () => Promise<Response> | Response)();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  appliedChartHeights.length = 0;
  mockFetch.mockReset();
  mockFetch.mockImplementation(async () => new Response('{}', { status: 200 }));
  global.fetch = mockFetch as unknown as typeof fetch;
  mockUseOhlcvSocket.mockReturnValue({
    data: null,
    isConnected: true,
    isLoading: false,
    error: null,
  } as ReturnType<typeof useOhlcvSocket>);
  mockUseSession.mockReturnValue({ data: { user: { tier: 'PRO' } } });
});

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// the button
// ---------------------------------------------------------------------------

describe('AskAiButton', () => {
  it('shows the dictionary text of the fixed question, for M5 and for M15', () => {
    render(
      <>
        <AskAiButton
          kind="INSTANT_M5_INSPECT"
          loading={false}
          onPress={jest.fn()}
        />
        <AskAiButton
          kind="INSTANT_M15_INSPECT"
          loading={false}
          onPress={jest.fn()}
        />
      </>
    );
    expect(
      screen.getByRole('button', { name: 'Explain the current M5 chart' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Explain the current M15 chart' })
    ).toBeInTheDocument();
    expect(M5_ENGLISH).toBe('Explain the current M5 chart');
    expect(M15_ENGLISH).toBe('Explain the current M15 chart');
  });

  it('is a real button whose accessible name is its visible text, with the older label as the tooltip', () => {
    render(
      <AskAiButton
        kind="INSTANT_M5_INSPECT"
        loading={false}
        onPress={jest.fn()}
      />
    );
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('aria-label', M5_ENGLISH);
    expect(button).toHaveTextContent(M5_ENGLISH);
    expect(button).toHaveAttribute('title', 'Ask AI about M5 Chart');
    expect(button).toHaveAttribute('aria-busy', 'false');
    expect(button).toBeEnabled();
  });

  it('calls onPress with its kind', () => {
    const onPress = jest.fn();
    render(
      <AskAiButton
        kind="INSTANT_M15_INSPECT"
        loading={false}
        onPress={onPress}
      />
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledWith('INSTANT_M15_INSPECT');
  });

  it('is reached with the Tab key and pressed with Enter and with Space', async () => {
    const user = userEvent.setup();
    const onPress = jest.fn();
    render(
      <AskAiButton
        kind="INSTANT_M5_INSPECT"
        loading={false}
        onPress={onPress}
      />
    );
    await user.tab();
    expect(screen.getByRole('button')).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  it('shows a spinner and is disabled and busy while its request is in flight', () => {
    const onPress = jest.fn();
    render(<AskAiButton kind="INSTANT_M5_INSPECT" loading onPress={onPress} />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('ask-ai-spinner-m5')).toBeInTheDocument();
    fireEvent.click(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('is disabled without a spinner when the OTHER pane is waiting', () => {
    render(
      <AskAiButton
        kind="INSTANT_M15_INSPECT"
        loading={false}
        disabled
        onPress={jest.fn()}
      />
    );
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.queryByTestId('ask-ai-spinner-m15')).not.toBeInTheDocument();
  });

  it('shows no spinner when idle', () => {
    render(
      <AskAiButton
        kind="INSTANT_M5_INSPECT"
        loading={false}
        onPress={jest.fn()}
      />
    );
    expect(screen.queryByTestId('ask-ai-spinner-m5')).not.toBeInTheDocument();
  });

  it('shows a refusal beside the button, announced as a status, and nothing when there is none', () => {
    const { rerender } = render(
      <AskAiButton
        kind="INSTANT_M5_INSPECT"
        loading={false}
        onPress={jest.fn()}
      />
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    rerender(
      <AskAiButton
        kind="INSTANT_M5_INSPECT"
        loading={false}
        notice="Your AI analyst allowance is used up for now."
        onPress={jest.fn()}
      />
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Your AI analyst allowance is used up for now.'
    );
  });

  describe('layout: other scripts and long labels', () => {
    it.each([
      ['de', de, 'ltr'],
      ['th', th, 'ltr'],
    ] as const)(
      'shows the %s text in full, wrapping instead of growing past the pane',
      async (language, dictionary, dir) => {
        render(
          <AskAiButton
            kind="INSTANT_M15_INSPECT"
            loading={false}
            notice="Eine längere Meldung, die ebenfalls umbrechen muss, damit sie im Chart bleibt."
            onPress={jest.fn()}
          />,
          language
        );
        const expected = (dictionary as Record<string, string>)[
          'intake.instant.m15'
        ] as string;
        expect(expected).toBeTruthy();
        expect(expected).not.toBe(M15_ENGLISH);
        // the language's dictionary loads after the first render
        const button = await screen.findByRole('button', { name: expected });
        expect(button).toHaveTextContent(expected);
        // wraps: no truncation, no nowrap, bounded by the pane, and the long word breaks anywhere
        expect(button.className).toContain('max-w-full');
        expect(button.className).not.toMatch(/\btruncate\b|whitespace-nowrap/);
        const text = within(button).getByText(expected);
        expect(text.className).toContain('[overflow-wrap:anywhere]');
        expect(text.className).not.toMatch(/\btruncate\b|whitespace-nowrap/);
        expect(screen.getByRole('status').className).toContain(
          '[overflow-wrap:anywhere]'
        );
        expect(screen.getByTestId('ask-ai-m15')).toHaveAttribute('dir', dir);
      }
    );

    it.each([
      ['ar', ar],
      ['ur', ur],
    ] as const)(
      'runs right to left in %s, with its own translation',
      async (language, dictionary) => {
        render(
          <AskAiButton
            kind="INSTANT_M5_INSPECT"
            loading={false}
            onPress={jest.fn()}
          />,
          language
        );
        const expected = (dictionary as Record<string, string>)[
          'intake.instant.m5'
        ] as string;
        expect(expected).toBeTruthy();
        expect(screen.getByTestId('ask-ai-m5')).toHaveAttribute('dir', 'rtl');
        expect(
          await screen.findByRole('button', { name: expected })
        ).toHaveTextContent(expected);
        // the text aligns to the start of its own direction, not to a fixed side
        expect(
          within(screen.getByRole('button')).getByText(expected).parentElement
            ?.className
        ).toContain('text-start');
      }
    );
  });
});

// ---------------------------------------------------------------------------
// the request
// ---------------------------------------------------------------------------

describe('postInstantPrompt', () => {
  it('posts { kind } and nothing else to the instant route', async () => {
    answerInstant(() => success());
    await postInstantPrompt('INSTANT_M5_INSPECT');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/intake/instant');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(init.body).toBe('{"kind":"INSTANT_M5_INSPECT"}');
  });

  it('reads a 200 with success: true as ok', async () => {
    const response = success();
    mockFetch.mockResolvedValue(response);
    const answer = await postInstantPrompt('INSTANT_M15_INSPECT');
    expect(answer.ok).toBe(true);
  });

  it('takes the reply of a refusal', async () => {
    mockFetch.mockResolvedValue(
      refusal(429, 'QUOTA_INSUFFICIENT', 'No allowance.')
    );
    expect(await postInstantPrompt('INSTANT_M5_INSPECT')).toEqual({
      ok: false,
      reply: 'No allowance.',
    });
  });

  it.each([
    [
      'a 404 with a body that is not JSON',
      () => new Response('Not found', { status: 404 }),
    ],
    [
      'a 500 with no refusal',
      () => jsonResponse(500, { success: false, error: { code: 'INTERNAL' } }),
    ],
    [
      'a refusal with an empty reply',
      () => refusal(403, 'TIER_REQUIRED', '   '),
    ],
    [
      'a 200 that is not a success',
      () => jsonResponse(200, { success: false }),
    ],
    ['a 200 that is not an object', () => jsonResponse(200, [])],
  ])('has no reply for %s', async (_name, make) => {
    mockFetch.mockResolvedValue(make());
    expect(await postInstantPrompt('INSTANT_M5_INSPECT')).toEqual({
      ok: false,
      reply: null,
    });
  });

  it('does not throw when the network fails', async () => {
    answerInstant(() => Promise.reject(new TypeError('Failed to fetch')));
    expect(await postInstantPrompt('INSTANT_M5_INSPECT')).toEqual({
      ok: false,
      reply: null,
    });
  });
});

describe('instantKindFor', () => {
  it('has a kind for M5 and M15 only', () => {
    expect(instantKindFor('M5')).toBe('INSTANT_M5_INSPECT');
    expect(instantKindFor('M15')).toBe('INSTANT_M15_INSPECT');
    for (const other of ['M1', 'M30', 'H1', 'D1', 'm5', '']) {
      expect(instantKindFor(other)).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// the stacked charts
// ---------------------------------------------------------------------------

const inUpper = () => within(screen.getByTestId('mtf-upper-container'));
const inLower = () => within(screen.getByTestId('mtf-lower-container'));

describe('the buttons in the stacked charts', () => {
  describe('the flag', () => {
    it('renders no button anywhere when the flag is off (the default)', () => {
      render(<MtfStackedCharts symbol="XAUUSD" isPro />);
      expect(screen.queryByTestId('ask-ai-overlay')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: M5_ENGLISH })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: M15_ENGLISH })
      ).not.toBeInTheDocument();
    });

    it('renders no button for a Free trader either when the flag is off', () => {
      render(
        <MtfStackedCharts
          symbol="XAUUSD"
          isPro={false}
          instantPromptsEnabled={false}
          onOpenUpgradeModal={jest.fn()}
        />
      );
      expect(screen.queryByTestId('ask-ai-overlay')).not.toBeInTheDocument();
    });

    it('renders one button on each pane when the flag is on, for a PRO trader', () => {
      render(<MtfStackedCharts symbol="XAUUSD" isPro instantPromptsEnabled />);
      expect(screen.getAllByTestId('ask-ai-overlay')).toHaveLength(2);
      // M15 is the upper pane and M5 the lower one
      expect(
        inUpper().getByRole('button', { name: M15_ENGLISH })
      ).toBeInTheDocument();
      expect(
        inLower().getByRole('button', { name: M5_ENGLISH })
      ).toBeInTheDocument();
      expect(
        inUpper().queryByRole('button', { name: M5_ENGLISH })
      ).not.toBeInTheDocument();
      expect(
        inLower().queryByRole('button', { name: M15_ENGLISH })
      ).not.toBeInTheDocument();
    });

    it('renders them for a Free trader who has an upgrade modal to open', () => {
      render(
        <MtfStackedCharts
          symbol="XAUUSD"
          isPro={false}
          instantPromptsEnabled
          onOpenUpgradeModal={jest.fn()}
        />
      );
      expect(screen.getAllByTestId('ask-ai-overlay')).toHaveLength(2);
    });

    it('renders none for a Free trader who has nowhere to be sent', () => {
      render(
        <MtfStackedCharts symbol="XAUUSD" isPro={false} instantPromptsEnabled />
      );
      expect(screen.queryByTestId('ask-ai-overlay')).not.toBeInTheDocument();
    });

    it('renders a button only for a pane that has an instant prompt (M5, M15)', () => {
      render(
        <MtfStackedCharts
          symbol="XAUUSD"
          upperTimeframe="M1"
          lowerTimeframe="M5"
          isPro
          instantPromptsEnabled
        />
      );
      expect(screen.getAllByTestId('ask-ai-overlay')).toHaveLength(1);
      expect(
        inLower().getByRole('button', { name: M5_ENGLISH })
      ).toBeInTheDocument();
    });
  });

  describe('a PRO press', () => {
    it('posts INSTANT_M5_INSPECT, once, from the M5 button', async () => {
      answerInstant(() => success());
      render(<MtfStackedCharts symbol="XAUUSD" isPro instantPromptsEnabled />);
      fireEvent.click(inLower().getByRole('button', { name: M5_ENGLISH }));
      await waitFor(() => expect(instantCalls()).toHaveLength(1));
      const [url, init] = instantCalls()[0] as [string, RequestInit];
      expect(url).toBe('/api/intake/instant');
      expect(init.method).toBe('POST');
      expect(init.body).toBe('{"kind":"INSTANT_M5_INSPECT"}');
      await waitFor(() =>
        expect(
          inLower().getByRole('button', { name: M5_ENGLISH })
        ).toBeEnabled()
      );
    });

    it('posts INSTANT_M15_INSPECT, once, from the M15 button', async () => {
      answerInstant(() => success());
      render(<MtfStackedCharts symbol="XAUUSD" isPro instantPromptsEnabled />);
      fireEvent.click(inUpper().getByRole('button', { name: M15_ENGLISH }));
      await waitFor(() => expect(instantCalls()).toHaveLength(1));
      expect((instantCalls()[0] as [string, RequestInit])[1].body).toBe(
        '{"kind":"INSTANT_M15_INSPECT"}'
      );
    });

    it('sends no question text, no language and no thread id', async () => {
      answerInstant(() => success());
      render(
        <MtfStackedCharts symbol="XAUUSD" isPro instantPromptsEnabled />,
        'de'
      );
      // the language's dictionary loads after the first render
      fireEvent.click(
        await inLower().findByRole('button', {
          name: (de as Record<string, string>)['intake.instant.m5'] as string,
        })
      );
      await waitFor(() => expect(instantCalls()).toHaveLength(1));
      const body = JSON.parse(
        (instantCalls()[0] as [string, RequestInit])[1].body as string
      ) as Record<string, unknown>;
      expect(Object.keys(body)).toEqual(['kind']);
    });

    it('hands the success body to onInstantResult and shows no notice', async () => {
      answerInstant(() => success());
      const onInstantResult = jest.fn();
      render(
        <MtfStackedCharts
          symbol="XAUUSD"
          isPro
          instantPromptsEnabled
          onInstantResult={onInstantResult}
        />
      );
      fireEvent.click(inLower().getByRole('button', { name: M5_ENGLISH }));
      await waitFor(() => expect(onInstantResult).toHaveBeenCalledTimes(1));
      expect(onInstantResult).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('does not open the upgrade modal', async () => {
      answerInstant(() => success());
      const onOpenUpgradeModal = jest.fn();
      render(
        <MtfStackedCharts
          symbol="XAUUSD"
          isPro
          instantPromptsEnabled
          onOpenUpgradeModal={onOpenUpgradeModal}
        />
      );
      fireEvent.click(inLower().getByRole('button', { name: M5_ENGLISH }));
      await waitFor(() => expect(instantCalls()).toHaveLength(1));
      expect(onOpenUpgradeModal).not.toHaveBeenCalled();
    });
  });

  describe('a Free press', () => {
    it('opens the upgrade modal and posts nothing', () => {
      const onOpenUpgradeModal = jest.fn();
      render(
        <MtfStackedCharts
          symbol="XAUUSD"
          isPro={false}
          instantPromptsEnabled
          onOpenUpgradeModal={onOpenUpgradeModal}
        />
      );
      fireEvent.click(inLower().getByRole('button', { name: M5_ENGLISH }));
      expect(onOpenUpgradeModal).toHaveBeenCalledTimes(1);
      fireEvent.click(inUpper().getByRole('button', { name: M15_ENGLISH }));
      expect(onOpenUpgradeModal).toHaveBeenCalledTimes(2);
      expect(instantCalls()).toHaveLength(0);
    });

    it('reads the tier from the session when isPro is not passed', async () => {
      mockUseSession.mockReturnValue({ data: { user: { tier: 'FREE' } } });
      const onOpenUpgradeModal = jest.fn();
      render(
        <MtfStackedCharts
          symbol="XAUUSD"
          instantPromptsEnabled
          onOpenUpgradeModal={onOpenUpgradeModal}
        />
      );
      fireEvent.click(inLower().getByRole('button', { name: M5_ENGLISH }));
      expect(onOpenUpgradeModal).toHaveBeenCalledTimes(1);
      expect(instantCalls()).toHaveLength(0);
    });
  });

  describe('a request in flight', () => {
    it('disables both buttons, shows the spinner on the pressed one, and ignores a double click', async () => {
      const pending = deferred<Response>();
      answerInstant(() => pending.promise);
      render(<MtfStackedCharts symbol="XAUUSD" isPro instantPromptsEnabled />);
      const m5 = inLower().getByRole('button', { name: M5_ENGLISH });
      const m15 = inUpper().getByRole('button', { name: M15_ENGLISH });

      // two clicks in the same tick, before React has rendered the disabled state
      act(() => {
        fireEvent.click(m5);
        fireEvent.click(m5);
      });
      expect(instantCalls()).toHaveLength(1);
      expect(m5).toBeDisabled();
      expect(m5).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByTestId('ask-ai-spinner-m5')).toBeInTheDocument();

      // the other pane waits: one request in flight for the whole chart
      expect(m15).toBeDisabled();
      expect(m15).toHaveAttribute('aria-busy', 'false');
      expect(
        screen.queryByTestId('ask-ai-spinner-m15')
      ).not.toBeInTheDocument();
      fireEvent.click(m15);
      fireEvent.click(m5);
      expect(instantCalls()).toHaveLength(1);

      await act(async () => {
        pending.resolve(success());
      });
      await waitFor(() => expect(m5).toBeEnabled());
      expect(m15).toBeEnabled();
      expect(screen.queryByTestId('ask-ai-spinner-m5')).not.toBeInTheDocument();

      // and a press after it has finished is a new request
      answerInstant(() => success());
      fireEvent.click(m15);
      await waitFor(() => expect(instantCalls()).toHaveLength(2));
    });

    it('is enabled again after a failure', async () => {
      answerInstant(() => Promise.reject(new TypeError('Failed to fetch')));
      render(<MtfStackedCharts symbol="XAUUSD" isPro instantPromptsEnabled />);
      const m5 = inLower().getByRole('button', { name: M5_ENGLISH });
      fireEvent.click(m5);
      await waitFor(() =>
        expect(screen.getByRole('status')).toBeInTheDocument()
      );
      expect(m5).toBeEnabled();
    });

    it('does not set state after the chart has gone', async () => {
      const pending = deferred<Response>();
      answerInstant(() => pending.promise);
      const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
      const { unmount } = render(
        <MtfStackedCharts symbol="XAUUSD" isPro instantPromptsEnabled />
      );
      fireEvent.click(inLower().getByRole('button', { name: M5_ENGLISH }));
      unmount();
      await act(async () => {
        pending.resolve(refusal(429, 'QUOTA_INSUFFICIENT', 'Later.'));
      });
      expect(errors).not.toHaveBeenCalled();
      errors.mockRestore();
    });
  });

  describe('a refusal', () => {
    it("shows the server's reply beside the button that was pressed, and only there", async () => {
      answerInstant(() =>
        refusal(429, 'QUOTA_INSUFFICIENT', 'Your allowance is used up for now.')
      );
      render(<MtfStackedCharts symbol="XAUUSD" isPro instantPromptsEnabled />);
      fireEvent.click(inLower().getByRole('button', { name: M5_ENGLISH }));
      await waitFor(() =>
        expect(inLower().getByRole('status')).toHaveTextContent(
          'Your allowance is used up for now.'
        )
      );
      expect(inUpper().queryByRole('status')).not.toBeInTheDocument();
      expect(inLower().getByRole('button', { name: M5_ENGLISH })).toBeEnabled();
    });

    it('shows the fixed "not available" text when the route answers 404 (the intake flag is off)', async () => {
      answerInstant(() => new Response('<html>404</html>', { status: 404 }));
      render(<MtfStackedCharts symbol="XAUUSD" isPro instantPromptsEnabled />);
      fireEvent.click(inUpper().getByRole('button', { name: M15_ENGLISH }));
      await waitFor(() =>
        expect(inUpper().getByRole('status')).toHaveTextContent(
          UNAVAILABLE_ENGLISH
        )
      );
    });

    it('shows the "not available" text in the interface language when the network fails', async () => {
      answerInstant(() => Promise.reject(new TypeError('Failed to fetch')));
      render(
        <MtfStackedCharts symbol="XAUUSD" isPro instantPromptsEnabled />,
        'th'
      );
      fireEvent.click(
        await inLower().findByRole('button', {
          name: (th as Record<string, string>)['intake.instant.m5'] as string,
        })
      );
      const expected = (th as Record<string, string>)[
        'intake.refusal.feature_unavailable'
      ] as string;
      expect(expected).toBeTruthy();
      await waitFor(() =>
        expect(inLower().getByRole('status')).toHaveTextContent(expected)
      );
    });

    it('clears when the next request starts', async () => {
      const pending = deferred<Response>();
      answerInstant(
        () => refusal(429, 'QUOTA_INSUFFICIENT', 'Used up.'),
        () => pending.promise
      );
      render(<MtfStackedCharts symbol="XAUUSD" isPro instantPromptsEnabled />);
      const m5 = inLower().getByRole('button', { name: M5_ENGLISH });
      fireEvent.click(m5);
      await waitFor(() =>
        expect(screen.getByRole('status')).toBeInTheDocument()
      );
      fireEvent.click(m5);
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      await act(async () => {
        pending.resolve(success());
      });
    });

    it('goes away by itself (the hook, with a short time)', async () => {
      const post = jest.fn(async () => ({
        ok: false as const,
        reply: 'Used up.',
      }));
      const { result } = renderHook(
        () => useInstantPrompt({ isPro: true, post, noticeMs: 60 }),
        { wrapper: providers('en-US') }
      );
      act(() => result.current.press('INSTANT_M5_INSPECT'));
      await waitFor(() =>
        expect(result.current.notice).toEqual({
          kind: 'INSTANT_M5_INSPECT',
          text: 'Used up.',
        })
      );
      await waitFor(() => expect(result.current.notice).toBeNull(), {
        timeout: 2000,
      });
      expect(result.current.pending).toBeNull();
    });

    it('stays for twelve seconds when nothing shortens it', () => {
      expect(NOTICE_MS).toBe(12_000);
    });
  });

  describe('right to left and the long languages, in the chart', () => {
    it.each([
      ['ar', ar],
      ['ur', ur],
    ] as const)(
      'puts both buttons right to left in %s',
      async (language, dictionary) => {
        render(
          <MtfStackedCharts symbol="XAUUSD" isPro instantPromptsEnabled />,
          language
        );
        const dict = dictionary as Record<string, string>;
        expect(
          await inUpper().findByRole('button', {
            name: dict['intake.instant.m15'] as string,
          })
        ).toBeInTheDocument();
        expect(
          await inLower().findByRole('button', {
            name: dict['intake.instant.m5'] as string,
          })
        ).toBeInTheDocument();
        expect(screen.getByTestId('ask-ai-m15')).toHaveAttribute('dir', 'rtl');
        expect(screen.getByTestId('ask-ai-m5')).toHaveAttribute('dir', 'rtl');
      }
    );

    it.each([
      ['de', de],
      ['th', th],
    ] as const)(
      'keeps both %s buttons inside their pane',
      async (language, dictionary) => {
        render(
          <MtfStackedCharts symbol="XAUUSD" isPro instantPromptsEnabled />,
          language
        );
        for (const overlay of screen.getAllByTestId('ask-ai-overlay')) {
          // bounded by the pane's own width, on top of the canvas, taking no space of its own
          expect(overlay.className).toContain('max-w-[calc(100%-1.25rem)]');
          expect(overlay.className).toContain('absolute');
        }
        expect(
          await inLower().findByRole('button', {
            name: (dictionary as Record<string, string>)[
              'intake.instant.m5'
            ] as string,
          })
        ).toBeInTheDocument();
      }
    );
  });

  describe('the split layout is untouched', () => {
    it('leaves CHROME_PER_CHART as it was', () => {
      expect(CHROME_PER_CHART).toBe(86);
    });

    it('gives both canvases the same heights with the buttons on and off', () => {
      const first = render(
        <MtfStackedCharts symbol="XAUUSD" isPro instantPromptsEnabled={false} />
      );
      const off = [...appliedChartHeights];
      first.unmount();
      appliedChartHeights.length = 0;

      render(<MtfStackedCharts symbol="XAUUSD" isPro instantPromptsEnabled />);
      const on = [...appliedChartHeights];

      expect(off.length).toBeGreaterThan(0);
      expect(on).toEqual(off);
    });

    it('puts the overlay over the canvas, not in the layout flow', () => {
      render(<MtfStackedCharts symbol="XAUUSD" isPro instantPromptsEnabled />);
      for (const overlay of screen.getAllByTestId('ask-ai-overlay')) {
        expect(overlay.className).toContain('absolute');
        expect(overlay.className).toContain('bottom-9');
        expect(overlay.className).toContain('left-2.5');
        // a direct child of the pane's own relative box, a sibling of the chart
        expect(overlay.parentElement?.className).toContain('relative');
      }
    });
  });
});
