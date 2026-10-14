/**
 * Panel C instant prompts as the top-left Market Context badges (build step 6 part 10; architecture
 * 4.2 and 4.10; ADR-098 D10; Owner Decision "Option A", 2026-10-14): the badge, the press hook and
 * the two badges inside the stacked charts.
 *
 * What is held here:
 *  - with the flag on, the badge of each pane IS the instant prompt: upper pane M15, lower pane M5,
 *    `[logo] XAUUSD · M15 Market Context •`; with it off, the badges are the older ones;
 *  - a PRO press posts `{ kind }` and nothing else, once; a Free press opens the upgrade modal and
 *    posts nothing; neither calls the chat panel's `onAskAi`;
 *  - while a request is in flight BOTH badges are disabled and `aria-busy`, only the pressed one shows
 *    the spinner, and a second press is ignored;
 *  - a refusal shows the server's own reply below the badge that was pressed, and goes away by itself;
 *  - there is no button at the bottom left of the pane any more;
 *  - keyboard and screen-reader behaviour, Arabic and Urdu (right to left), long German and Thai;
 *  - the split arithmetic is untouched: the same canvas heights with the flag on and off.
 *
 * jsdom has no layout engine, so the width of a long text is held through its wrapping classes and
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

import {
  MarketContextBadge,
  type InstantBadgeState,
} from '@/components/charts/ask-ai-button';
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

/** The accessible name of a badge: its visible text. */
const M5_BADGE = 'XAUUSD · M5 Market Context';
const M15_BADGE = 'XAUUSD · M15 Market Context';
const PLAIN_TITLE = 'Instant prompt to AI chat';

const dictionaryText = (dictionary: unknown, key: string): string =>
  (dictionary as Record<string, string>)[key] as string;

/** The accessible name of a badge in another interface language. */
const badgeNameIn = (dictionary: unknown, timeframe: 'M5' | 'M15'): string =>
  `XAUUSD · ${timeframe} ${dictionaryText(dictionary, 'Market Context')}`;

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
// the badge
// ---------------------------------------------------------------------------

/** A badge's Panel C state, idle unless the test says otherwise. */
const instantState = (
  overrides: Partial<InstantBadgeState> = {}
): InstantBadgeState => ({
  kind: 'INSTANT_M5_INSPECT',
  loading: false,
  busy: false,
  notice: null,
  onPress: jest.fn(),
  ...overrides,
});

describe('MarketContextBadge', () => {
  describe('the plain badge (the instant prompts are off)', () => {
    it('reads [logo] XAUUSD · M15 Market Context, with the older tooltip and no busy state', () => {
      render(
        <MarketContextBadge symbol="XAUUSD" timeframe="M15" active={false} />
      );
      const badge = screen.getByRole('button', { name: M15_BADGE });
      expect(badge).toHaveAttribute('type', 'button');
      expect(badge).toHaveTextContent('XAUUSD · M15');
      expect(badge).toHaveTextContent('Market Context');
      expect(badge).toHaveAttribute('title', PLAIN_TITLE);
      expect(badge).not.toHaveAttribute('aria-busy');
      expect(badge).toBeEnabled();
      // the logo (its fallback letters) is decoration, not part of the name
      expect(badge.querySelector('[aria-hidden="true"]')).not.toBeNull();
    });

    it('calls onPress', () => {
      const onPress = jest.fn();
      render(
        <MarketContextBadge
          symbol="XAUUSD"
          timeframe="M5"
          active={false}
          onPress={onPress}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: M5_BADGE }));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('does nothing when it has no onPress', () => {
      render(<MarketContextBadge symbol="XAUUSD" timeframe="M5" active />);
      expect(() =>
        fireEvent.click(screen.getByRole('button', { name: M5_BADGE }))
      ).not.toThrow();
    });
  });

  describe('the active dot', () => {
    it('shows after the text on the active pane only', () => {
      const { rerender } = render(
        <MarketContextBadge symbol="XAUUSD" timeframe="M15" active={false} />
      );
      expect(
        screen.queryByTestId('market-context-active-m15')
      ).not.toBeInTheDocument();
      rerender(<MarketContextBadge symbol="XAUUSD" timeframe="M15" active />);
      expect(
        screen.getByTestId('market-context-active-m15')
      ).toBeInTheDocument();
    });

    it('rings the active pane in amber, in the plain badge and in the instant one', () => {
      const ring = ['border-amber-500/70', 'ring-amber-500/30'];
      const { rerender } = render(
        <MarketContextBadge symbol="XAUUSD" timeframe="M15" active />
      );
      for (const cls of ring) {
        expect(
          screen.getByRole('button', { name: M15_BADGE }).className
        ).toContain(cls);
      }
      rerender(
        <MarketContextBadge symbol="XAUUSD" timeframe="M15" active={false} />
      );
      for (const cls of ring) {
        expect(
          screen.getByRole('button', { name: M15_BADGE }).className
        ).not.toContain(cls);
      }
      rerender(
        <MarketContextBadge
          symbol="XAUUSD"
          timeframe="M15"
          active={false}
          instant={instantState({ kind: 'INSTANT_M15_INSPECT' })}
        />
      );
      expect(
        screen.getByRole('button', { name: M15_BADGE }).className
      ).not.toContain('ring-amber-500/30');
    });

    it('follows the pane the trader pressed in the stacked charts', () => {
      render(<MtfStackedCharts symbol="XAUUSD" isPro instantPromptsEnabled />);
      // the upper pane starts active
      expect(upperBadge().className).toContain('ring-amber-500/30');
      expect(lowerBadge().className).not.toContain('ring-amber-500/30');
      fireEvent.pointerDown(lowerBadge());
      expect(lowerBadge().className).toContain('ring-amber-500/30');
      expect(upperBadge().className).not.toContain('ring-amber-500/30');
    });

    it('gives way to the spinner while this badge waits', () => {
      render(
        <MarketContextBadge
          symbol="XAUUSD"
          timeframe="M5"
          active
          instant={instantState({ loading: true, busy: true })}
        />
      );
      expect(
        screen.getByTestId('market-context-spinner-m5')
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId('market-context-active-m5')
      ).not.toBeInTheDocument();
    });
  });

  describe('the instant badge (Panel C)', () => {
    it('keeps its text and takes the fixed question, in the interface language, as its tooltip', () => {
      render(
        <>
          <MarketContextBadge
            symbol="XAUUSD"
            timeframe="M15"
            active
            instant={instantState({ kind: 'INSTANT_M15_INSPECT' })}
          />
          <MarketContextBadge
            symbol="XAUUSD"
            timeframe="M5"
            active={false}
            instant={instantState({ kind: 'INSTANT_M5_INSPECT' })}
          />
        </>
      );
      expect(screen.getByRole('button', { name: M15_BADGE })).toHaveAttribute(
        'title',
        M15_ENGLISH
      );
      expect(screen.getByRole('button', { name: M5_BADGE })).toHaveAttribute(
        'title',
        M5_ENGLISH
      );
      expect(M5_ENGLISH).toBe('Explain the current M5 chart');
      expect(M15_ENGLISH).toBe('Explain the current M15 chart');
    });

    it('is idle: enabled, not busy, no spinner, no status', () => {
      render(
        <MarketContextBadge
          symbol="XAUUSD"
          timeframe="M5"
          active
          instant={instantState()}
        />
      );
      const badge = screen.getByRole('button', { name: M5_BADGE });
      expect(badge).toBeEnabled();
      expect(badge).toHaveAttribute('aria-busy', 'false');
      expect(
        screen.queryByTestId('market-context-spinner-m5')
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('calls the press with its kind, not the plain onPress', () => {
      const onPress = jest.fn();
      const plain = jest.fn();
      render(
        <MarketContextBadge
          symbol="XAUUSD"
          timeframe="M15"
          active
          onPress={plain}
          instant={instantState({
            kind: 'INSTANT_M15_INSPECT',
            onPress,
          })}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: M15_BADGE }));
      expect(onPress).toHaveBeenCalledTimes(1);
      expect(onPress).toHaveBeenCalledWith('INSTANT_M15_INSPECT');
      expect(plain).not.toHaveBeenCalled();
    });

    it('is reached with the Tab key and pressed with Enter and with Space', async () => {
      const user = userEvent.setup();
      const onPress = jest.fn();
      render(
        <MarketContextBadge
          symbol="XAUUSD"
          timeframe="M5"
          active
          instant={instantState({ onPress })}
        />
      );
      await user.tab();
      expect(screen.getByRole('button', { name: M5_BADGE })).toHaveFocus();
      await user.keyboard('{Enter}');
      await user.keyboard(' ');
      expect(onPress).toHaveBeenCalledTimes(2);
    });

    it('shows a spinner and is disabled and busy while its own request is in flight', () => {
      const onPress = jest.fn();
      render(
        <MarketContextBadge
          symbol="XAUUSD"
          timeframe="M5"
          active
          instant={instantState({ loading: true, busy: true, onPress })}
        />
      );
      const badge = screen.getByRole('button', { name: M5_BADGE });
      expect(badge).toBeDisabled();
      expect(badge).toHaveAttribute('aria-busy', 'true');
      expect(
        screen.getByTestId('market-context-spinner-m5')
      ).toBeInTheDocument();
      fireEvent.click(badge);
      expect(onPress).not.toHaveBeenCalled();
    });

    it('is disabled and busy, without a spinner, when the OTHER pane is waiting', () => {
      render(
        <MarketContextBadge
          symbol="XAUUSD"
          timeframe="M15"
          active={false}
          instant={instantState({
            kind: 'INSTANT_M15_INSPECT',
            busy: true,
          })}
        />
      );
      const badge = screen.getByRole('button', { name: M15_BADGE });
      expect(badge).toBeDisabled();
      expect(badge).toHaveAttribute('aria-busy', 'true');
      expect(
        screen.queryByTestId('market-context-spinner-m15')
      ).not.toBeInTheDocument();
    });

    it('shows a refusal BELOW the badge, announced as a status, and nothing when there is none', () => {
      const { rerender } = render(
        <MarketContextBadge
          symbol="XAUUSD"
          timeframe="M5"
          active
          instant={instantState()}
        />
      );
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      rerender(
        <MarketContextBadge
          symbol="XAUUSD"
          timeframe="M5"
          active
          instant={instantState({
            notice: 'Your AI analyst allowance is used up for now.',
          })}
        />
      );
      const status = screen.getByRole('status');
      expect(status).toHaveTextContent(
        'Your AI analyst allowance is used up for now.'
      );
      const badge = screen.getByRole('button', { name: M5_BADGE });
      // below: it follows the badge in the same column
      expect(
        badge.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      expect(badge.parentElement).toBe(status.parentElement);
      expect(badge.parentElement?.className).toContain('flex-col');
    });
  });

  describe('layout: other scripts and long texts', () => {
    it.each([
      ['de', de, 'ltr'],
      ['th', th, 'ltr'],
    ] as const)(
      'shows the %s text in full, wrapping instead of growing past the pane',
      async (language, dictionary, dir) => {
        render(
          <MarketContextBadge
            symbol="XAUUSD"
            timeframe="M15"
            active
            instant={instantState({
              kind: 'INSTANT_M15_INSPECT',
              notice:
                'Eine längere Meldung, die ebenfalls umbrechen muss, damit sie im Chart bleibt.',
            })}
          />,
          language
        );
        // the language's dictionary loads after the first render
        const badge = await screen.findByRole('button', {
          name: badgeNameIn(dictionary, 'M15'),
        });
        expect(dictionaryText(dictionary, 'Market Context')).not.toBe(
          'Market Context'
        );
        expect(badge).toHaveTextContent(
          dictionaryText(dictionary, 'Market Context')
        );
        // the question that a press asks, in this language
        expect(badge).toHaveAttribute(
          'title',
          dictionaryText(dictionary, 'intake.instant.m15')
        );
        // wraps: no truncation, no nowrap, bounded by the pane, the long word breaks anywhere
        expect(badge.className).toContain('max-w-full');
        expect(badge.className).not.toMatch(/\btruncate\b|whitespace-nowrap/);
        const text = within(badge).getByText(
          dictionaryText(dictionary, 'Market Context')
        );
        expect(text.className).toContain('[overflow-wrap:anywhere]');
        expect(text.className).not.toMatch(/\btruncate\b|whitespace-nowrap/);
        const status = screen.getByRole('status');
        expect(status.className).toContain('[overflow-wrap:anywhere]');
        expect(status.className).toContain('max-w-[22rem]');
        expect(status.className).not.toMatch(/\btruncate\b|whitespace-nowrap/);
        expect(status).toHaveAttribute('dir', dir);
      }
    );

    it.each([
      ['ar', ar],
      ['ur', ur],
    ] as const)(
      'runs the refusal right to left in %s, with its own translation of the badge',
      async (language, dictionary) => {
        render(
          <MarketContextBadge
            symbol="XAUUSD"
            timeframe="M5"
            active
            instant={instantState({ notice: 'رسالة قصيرة' })}
          />,
          language
        );
        const badge = await screen.findByRole('button', {
          name: badgeNameIn(dictionary, 'M5'),
        });
        expect(badge).toHaveAttribute(
          'title',
          dictionaryText(dictionary, 'intake.instant.m5')
        );
        const status = screen.getByRole('status');
        expect(status).toHaveAttribute('dir', 'rtl');
        // the text aligns to the start of its own direction, not to a fixed side
        expect(status.className).toContain('text-start');
        // the symbol and the timeframe stay left to right with the chart
        expect(within(badge).getByText('XAUUSD · M5')).toBeInTheDocument();
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
const upperBadge = () => inUpper().getByRole('button', { name: M15_BADGE });
const lowerBadge = () => inLower().getByRole('button', { name: M5_BADGE });

describe('the badges in the stacked charts', () => {
  describe('the layout of the panes (Option A)', () => {
    it('puts M15 in the upper pane and M5 in the lower pane, each badge top left', () => {
      render(<MtfStackedCharts symbol="XAUUSD" isPro instantPromptsEnabled />);
      expect(upperBadge()).toHaveTextContent('XAUUSD · M15');
      expect(lowerBadge()).toHaveTextContent('XAUUSD · M5');
      expect(
        inUpper().queryByRole('button', { name: M5_BADGE })
      ).not.toBeInTheDocument();
      expect(
        inLower().queryByRole('button', { name: M15_BADGE })
      ).not.toBeInTheDocument();
      // the box the chart gives its overlay badge: absolute, top left
      for (const badge of [upperBadge(), lowerBadge()]) {
        const box = badge.closest('.absolute');
        expect(box?.className).toContain('left-2.5');
        expect(box?.className).toContain('top-2.5');
      }
    });

    it('has no button at the bottom left any more', () => {
      render(
        <MtfStackedCharts
          symbol="XAUUSD"
          isPro
          instantPromptsEnabled
          onOpenUpgradeModal={jest.fn()}
        />
      );
      expect(screen.queryByTestId('ask-ai-overlay')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: M5_ENGLISH })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: M15_ENGLISH })
      ).not.toBeInTheDocument();
      for (const container of [
        screen.getByTestId('mtf-upper-container'),
        screen.getByTestId('mtf-lower-container'),
      ]) {
        expect(container.innerHTML).not.toContain('bottom-9');
      }
    });
  });

  describe('a Free trader\'s banner (the centred "tools are unavailable" note of the lower pane)', () => {
    const banner = () => screen.getByTestId('free-tier-tools-banner');

    it('moves just below the badge when the badge is at the top left, so it does not cover it', () => {
      render(
        <MtfStackedCharts
          symbol="XAUUSD"
          isPro={false}
          instantPromptsEnabled
          onOpenUpgradeModal={jest.fn()}
        />
      );
      expect(banner().className).toContain('left-2.5');
      expect(banner().className).toContain('top-[42px]');
      expect(banner().className).toContain('max-w-[calc(100%-1.25rem)]');
      expect(banner().className).not.toContain('left-1/2');
      expect(banner().className).not.toContain('-translate-x-1/2');
    });

    it.each([
      [
        'the flag is off',
        { instantPromptsEnabled: false, onOpenUpgradeModal: jest.fn() },
      ],
      ['there is no upgrade modal to open', { instantPromptsEnabled: true }],
      [
        'the lower pane has no instant prompt (M1)',
        {
          instantPromptsEnabled: true,
          onOpenUpgradeModal: jest.fn(),
          lowerTimeframe: 'M1',
        },
      ],
    ])(
      'stays centred, as it always was, when %s (no badge to avoid)',
      (_name, props) => {
        render(<MtfStackedCharts symbol="XAUUSD" isPro={false} {...props} />);
        expect(banner().className).toContain('left-1/2');
        expect(banner().className).toContain('top-2.5');
        expect(banner().className).toContain('-translate-x-1/2');
        expect(banner().className).not.toContain('top-[42px]');
      }
    );

    it('is not there for a PRO trader', () => {
      render(<MtfStackedCharts symbol="XAUUSD" isPro instantPromptsEnabled />);
      expect(
        screen.queryByTestId('free-tier-tools-banner')
      ).not.toBeInTheDocument();
    });
  });

  describe('the flag', () => {
    it('leaves the badges as they were when the flag is off (the default): they hand the prompt to the chat', () => {
      const onAskAi = jest.fn();
      render(<MtfStackedCharts symbol="XAUUSD" isPro onAskAi={onAskAi} />);
      const badges = screen.getAllByTitle(PLAIN_TITLE);
      expect(badges).toHaveLength(2);
      expect(upperBadge()).toHaveAttribute('title', PLAIN_TITLE);
      expect(upperBadge()).not.toHaveAttribute('aria-busy');
      fireEvent.click(upperBadge());
      fireEvent.click(lowerBadge());
      // the canned prompt of the chat panel (its spelling follows the interface language)
      expect(onAskAi).toHaveBeenCalledTimes(2);
      expect(onAskAi).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('XAUUSD M15 market context and structure.')
      );
      expect(onAskAi).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('XAUUSD M5 market context and structure.')
      );
      expect(instantCalls()).toHaveLength(0);
    });

    it('shows no badge to a Free trader when the flag is off, upgrade modal or not', () => {
      render(
        <MtfStackedCharts
          symbol="XAUUSD"
          isPro={false}
          instantPromptsEnabled={false}
          onOpenUpgradeModal={jest.fn()}
        />
      );
      expect(screen.queryByTitle(PLAIN_TITLE)).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: M15_BADGE })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: M5_BADGE })
      ).not.toBeInTheDocument();
    });

    it('makes both badges the instant prompts when the flag is on, for a PRO trader', () => {
      render(<MtfStackedCharts symbol="XAUUSD" isPro instantPromptsEnabled />);
      expect(upperBadge()).toHaveAttribute('title', M15_ENGLISH);
      expect(lowerBadge()).toHaveAttribute('title', M5_ENGLISH);
      expect(upperBadge()).toHaveAttribute('aria-busy', 'false');
      expect(lowerBadge()).toHaveAttribute('aria-busy', 'false');
      expect(screen.queryByTitle(PLAIN_TITLE)).not.toBeInTheDocument();
    });

    it('shows them to a Free trader who has an upgrade modal to open', () => {
      render(
        <MtfStackedCharts
          symbol="XAUUSD"
          isPro={false}
          instantPromptsEnabled
          onOpenUpgradeModal={jest.fn()}
        />
      );
      expect(upperBadge()).toBeInTheDocument();
      expect(lowerBadge()).toBeInTheDocument();
    });

    it('shows none to a Free trader who has nowhere to be sent', () => {
      render(
        <MtfStackedCharts symbol="XAUUSD" isPro={false} instantPromptsEnabled />
      );
      expect(
        screen.queryByRole('button', { name: M15_BADGE })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: M5_BADGE })
      ).not.toBeInTheDocument();
    });

    it('keeps the older badge on a pane that has no instant prompt (M1), and the instant one on M5', async () => {
      answerInstant(() => success());
      const onAskAi = jest.fn();
      render(
        <MtfStackedCharts
          symbol="XAUUSD"
          upperTimeframe="M1"
          lowerTimeframe="M5"
          isPro
          instantPromptsEnabled
          onAskAi={onAskAi}
        />
      );
      const m1 = inUpper().getByRole('button', {
        name: 'XAUUSD · M1 Market Context',
      });
      expect(m1).toHaveAttribute('title', PLAIN_TITLE);
      expect(lowerBadge()).toHaveAttribute('title', M5_ENGLISH);

      fireEvent.click(m1);
      expect(onAskAi).toHaveBeenCalledTimes(1);
      expect(instantCalls()).toHaveLength(0);

      fireEvent.click(lowerBadge());
      await waitFor(() => expect(instantCalls()).toHaveLength(1));
      expect(onAskAi).toHaveBeenCalledTimes(1);
    });

    it('shows a Free trader nothing on a pane that has no instant prompt', () => {
      render(
        <MtfStackedCharts
          symbol="XAUUSD"
          upperTimeframe="M1"
          lowerTimeframe="M5"
          isPro={false}
          instantPromptsEnabled
          onOpenUpgradeModal={jest.fn()}
        />
      );
      expect(
        inUpper().queryByRole('button', { name: 'XAUUSD · M1 Market Context' })
      ).not.toBeInTheDocument();
      expect(lowerBadge()).toBeInTheDocument();
    });
  });

  describe('a PRO press', () => {
    it('posts INSTANT_M5_INSPECT, once, from the M5 badge', async () => {
      answerInstant(() => success());
      render(<MtfStackedCharts symbol="XAUUSD" isPro instantPromptsEnabled />);
      fireEvent.click(lowerBadge());
      await waitFor(() => expect(instantCalls()).toHaveLength(1));
      const [url, init] = instantCalls()[0] as [string, RequestInit];
      expect(url).toBe('/api/intake/instant');
      expect(init.method).toBe('POST');
      expect(init.body).toBe('{"kind":"INSTANT_M5_INSPECT"}');
      await waitFor(() => expect(lowerBadge()).toBeEnabled());
    });

    it('posts INSTANT_M15_INSPECT, once, from the M15 badge', async () => {
      answerInstant(() => success());
      render(<MtfStackedCharts symbol="XAUUSD" isPro instantPromptsEnabled />);
      fireEvent.click(upperBadge());
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
        await inLower().findByRole('button', { name: badgeNameIn(de, 'M5') })
      );
      await waitFor(() => expect(instantCalls()).toHaveLength(1));
      const body = JSON.parse(
        (instantCalls()[0] as [string, RequestInit])[1].body as string
      ) as Record<string, unknown>;
      expect(Object.keys(body)).toEqual(['kind']);
    });

    it('hands the success body to onInstantResult, shows no notice, and does not use the chat panel', async () => {
      answerInstant(() => success());
      const onInstantResult = jest.fn();
      const onAskAi = jest.fn();
      render(
        <MtfStackedCharts
          symbol="XAUUSD"
          isPro
          instantPromptsEnabled
          onInstantResult={onInstantResult}
          onAskAi={onAskAi}
        />
      );
      fireEvent.click(lowerBadge());
      await waitFor(() => expect(onInstantResult).toHaveBeenCalledTimes(1));
      expect(onInstantResult).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(onAskAi).not.toHaveBeenCalled();
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
      fireEvent.click(lowerBadge());
      await waitFor(() => expect(instantCalls()).toHaveLength(1));
      expect(onOpenUpgradeModal).not.toHaveBeenCalled();
    });
  });

  describe('a Free press', () => {
    it('opens the upgrade modal and posts nothing', () => {
      const onOpenUpgradeModal = jest.fn();
      const onAskAi = jest.fn();
      render(
        <MtfStackedCharts
          symbol="XAUUSD"
          isPro={false}
          instantPromptsEnabled
          onOpenUpgradeModal={onOpenUpgradeModal}
          onAskAi={onAskAi}
        />
      );
      fireEvent.click(lowerBadge());
      expect(onOpenUpgradeModal).toHaveBeenCalledTimes(1);
      fireEvent.click(upperBadge());
      expect(onOpenUpgradeModal).toHaveBeenCalledTimes(2);
      expect(instantCalls()).toHaveLength(0);
      expect(onAskAi).not.toHaveBeenCalled();
      // nothing waits: a Free press is not a request
      expect(lowerBadge()).toBeEnabled();
      expect(upperBadge()).toBeEnabled();
    });

    it('reads the tier from the session when isPro is not passed', () => {
      mockUseSession.mockReturnValue({ data: { user: { tier: 'FREE' } } });
      const onOpenUpgradeModal = jest.fn();
      render(
        <MtfStackedCharts
          symbol="XAUUSD"
          instantPromptsEnabled
          onOpenUpgradeModal={onOpenUpgradeModal}
        />
      );
      fireEvent.click(lowerBadge());
      expect(onOpenUpgradeModal).toHaveBeenCalledTimes(1);
      expect(instantCalls()).toHaveLength(0);
    });
  });

  describe('a request in flight', () => {
    it('disables and busies both badges, spins the pressed one, and ignores a double click', async () => {
      const pending = deferred<Response>();
      answerInstant(() => pending.promise);
      render(<MtfStackedCharts symbol="XAUUSD" isPro instantPromptsEnabled />);
      const m5 = lowerBadge();
      const m15 = upperBadge();

      // two clicks in the same tick, before React has rendered the disabled state
      act(() => {
        fireEvent.click(m5);
        fireEvent.click(m5);
      });
      expect(instantCalls()).toHaveLength(1);

      // BOTH badges are disabled and busy: one request in flight for the whole chart
      expect(m5).toBeDisabled();
      expect(m5).toHaveAttribute('aria-busy', 'true');
      expect(m15).toBeDisabled();
      expect(m15).toHaveAttribute('aria-busy', 'true');

      // the spinner is on the pressed badge only
      expect(
        screen.getByTestId('market-context-spinner-m5')
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId('market-context-spinner-m15')
      ).not.toBeInTheDocument();

      fireEvent.click(m15);
      fireEvent.click(m5);
      expect(instantCalls()).toHaveLength(1);

      await act(async () => {
        pending.resolve(success());
      });
      await waitFor(() => expect(m5).toBeEnabled());
      expect(m15).toBeEnabled();
      expect(m5).toHaveAttribute('aria-busy', 'false');
      expect(m15).toHaveAttribute('aria-busy', 'false');
      expect(
        screen.queryByTestId('market-context-spinner-m5')
      ).not.toBeInTheDocument();

      // and a press after it has finished is a new request
      answerInstant(() => success());
      fireEvent.click(m15);
      await waitFor(() => expect(instantCalls()).toHaveLength(2));
    });

    it('puts the spinner on the M15 badge when M15 was pressed', async () => {
      const pending = deferred<Response>();
      answerInstant(() => pending.promise);
      render(<MtfStackedCharts symbol="XAUUSD" isPro instantPromptsEnabled />);
      fireEvent.click(upperBadge());
      expect(
        screen.getByTestId('market-context-spinner-m15')
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId('market-context-spinner-m5')
      ).not.toBeInTheDocument();
      await act(async () => {
        pending.resolve(success());
      });
    });

    it('is enabled again after a failure', async () => {
      answerInstant(() => Promise.reject(new TypeError('Failed to fetch')));
      render(<MtfStackedCharts symbol="XAUUSD" isPro instantPromptsEnabled />);
      const m5 = lowerBadge();
      fireEvent.click(m5);
      await waitFor(() =>
        expect(screen.getByRole('status')).toBeInTheDocument()
      );
      expect(m5).toBeEnabled();
      expect(upperBadge()).toBeEnabled();
    });

    it('does not set state after the chart has gone', async () => {
      const pending = deferred<Response>();
      answerInstant(() => pending.promise);
      const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
      const { unmount } = render(
        <MtfStackedCharts symbol="XAUUSD" isPro instantPromptsEnabled />
      );
      fireEvent.click(lowerBadge());
      unmount();
      await act(async () => {
        pending.resolve(refusal(429, 'QUOTA_INSUFFICIENT', 'Later.'));
      });
      expect(errors).not.toHaveBeenCalled();
      errors.mockRestore();
    });
  });

  describe('a refusal', () => {
    it("shows the server's reply below the badge that was pressed, and only there", async () => {
      answerInstant(() =>
        refusal(429, 'QUOTA_INSUFFICIENT', 'Your allowance is used up for now.')
      );
      render(<MtfStackedCharts symbol="XAUUSD" isPro instantPromptsEnabled />);
      fireEvent.click(lowerBadge());
      await waitFor(() =>
        expect(inLower().getByRole('status')).toHaveTextContent(
          'Your allowance is used up for now.'
        )
      );
      expect(inUpper().queryByRole('status')).not.toBeInTheDocument();
      expect(
        lowerBadge().compareDocumentPosition(inLower().getByRole('status')) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      expect(lowerBadge()).toBeEnabled();
      expect(upperBadge()).toBeEnabled();
    });

    it('shows the fixed "not available" text when the route answers 404 (the intake flag is off)', async () => {
      answerInstant(() => new Response('<html>404</html>', { status: 404 }));
      render(<MtfStackedCharts symbol="XAUUSD" isPro instantPromptsEnabled />);
      fireEvent.click(upperBadge());
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
        await inLower().findByRole('button', { name: badgeNameIn(th, 'M5') })
      );
      const expected = dictionaryText(th, 'intake.refusal.feature_unavailable');
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
      const m5 = lowerBadge();
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
      'translates both badges and runs a refusal right to left in %s',
      async (language, dictionary) => {
        answerInstant(() => refusal(429, 'QUOTA_INSUFFICIENT', 'رسالة الرفض'));
        render(
          <MtfStackedCharts symbol="XAUUSD" isPro instantPromptsEnabled />,
          language
        );
        const m15 = await inUpper().findByRole('button', {
          name: badgeNameIn(dictionary, 'M15'),
        });
        const m5 = await inLower().findByRole('button', {
          name: badgeNameIn(dictionary, 'M5'),
        });
        expect(m15).toHaveAttribute(
          'title',
          dictionaryText(dictionary, 'intake.instant.m15')
        );
        expect(m5).toHaveAttribute(
          'title',
          dictionaryText(dictionary, 'intake.instant.m5')
        );
        fireEvent.click(m5);
        const status = await inLower().findByRole('status');
        expect(status).toHaveAttribute('dir', 'rtl');
      }
    );

    it.each([
      ['de', de],
      ['th', th],
    ] as const)(
      'keeps both %s badges and their refusal inside their pane',
      async (language, dictionary) => {
        answerInstant(() =>
          refusal(
            429,
            'QUOTA_INSUFFICIENT',
            'Eine längere Meldung, die ebenfalls umbrechen muss, damit sie im Chart bleibt.'
          )
        );
        render(
          <MtfStackedCharts symbol="XAUUSD" isPro instantPromptsEnabled />,
          language
        );
        const m5 = await inLower().findByRole('button', {
          name: badgeNameIn(dictionary, 'M5'),
        });
        expect(
          await inUpper().findByRole('button', {
            name: badgeNameIn(dictionary, 'M15'),
          })
        ).toBeInTheDocument();
        // bounded by the pane's own width, in the chart's own top-left box
        for (const badge of [m5]) {
          expect(badge.className).toContain('max-w-full');
          expect(badge.parentElement?.className).toContain('max-w-full');
        }
        fireEvent.click(m5);
        const status = await inLower().findByRole('status');
        expect(status.className).toContain('[overflow-wrap:anywhere]');
      }
    );
  });

  describe('the split layout is untouched', () => {
    it('leaves CHROME_PER_CHART as it was', () => {
      expect(CHROME_PER_CHART).toBe(86);
    });

    it('gives both canvases the same heights with the flag on and off', () => {
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

    it("adds nothing to the pane: the badge lives in the chart's own overlay box", () => {
      render(<MtfStackedCharts symbol="XAUUSD" isPro instantPromptsEnabled />);
      for (const badge of [upperBadge(), lowerBadge()]) {
        // the chart's overlay box is absolute, so it takes no room in the layout flow
        const box = badge.closest('.absolute');
        expect(box).not.toBeNull();
        expect(box?.className).toContain('absolute');
        // and the pane's own box has no second absolutely positioned control of the badge's
        const pane = badge.closest('[data-testid$="-container"]');
        expect(pane?.className).toContain('relative');
        expect(
          pane?.querySelectorAll('[data-testid^="market-context-"]').length
        ).toBeGreaterThan(0);
        expect(pane?.querySelectorAll('[data-testid^="ask-ai-"]')).toHaveLength(
          0
        );
      }
    });
  });
});
