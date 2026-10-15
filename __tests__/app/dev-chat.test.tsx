/**
 * The development preview of Panel B (build step 7 part 8): `/dev/chat`.
 *
 * It must be an honest window on the real thing, and must not exist in a production build. So: every
 * state it lists is built by playing a RECORDED answer of the real message route into the panel's real
 * reducer (nothing hand-made), the words it swaps in for Arabic, German and Thai change nothing but
 * words, the stand-in server answers the way the routes do, and the page refuses under
 * NODE_ENV=production.
 */

import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { render as rtlRender } from '@testing-library/react';
import type { ReactElement } from 'react';

import ChatPreviewPage from '@/app/dev/chat/page';
import { ChatPreview } from '@/app/dev/chat/chat-preview';
import {
  localizeRefusal,
  localizeResult,
  SAMPLE_LANGUAGES,
} from '@/app/dev/chat/samples';
import {
  MODEL_SETS,
  QUOTAS,
  RECORDED,
  SCENARIOS,
  initialStateFor,
  playExchange,
  previewDemo,
  previewInfo,
  inFlightAt,
  TYPED,
} from '@/app/dev/chat/scenarios';
import { standInFetch } from '@/app/dev/chat/stand-in';
import { AppearanceProvider } from '@/components/providers/appearance-provider';
import { STAGES } from '@/components/chat/limits';
import { LocaleProvider } from '@/lib/context/locale-context';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/locale-resolver';
import { INTAKE_TEXT, REFUSAL_TEXT_KEY } from '@/lib/intake/text';

import { resultOf, refusalOf } from '../components/chat/helpers/fake-fetch';

const notFound = jest.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
jest.mock('next/navigation', () => ({
  usePathname: () => '/dev/chat',
  notFound: () => notFound(),
}));

const env = process.env as Record<string, string | undefined>;
const NODE_ENV = env['NODE_ENV'];
afterEach(() => {
  env['NODE_ENV'] = NODE_ENV;
  notFound.mockClear();
});

function renderPreview(language = 'en-US') {
  localStorage.setItem(
    LOCALE_STORAGE_KEY,
    JSON.stringify({
      countryCode: 'US',
      language,
      timezone: 'UTC',
      dateFormat: 'MDY',
      timeFormat: '24h',
      currency: 'USD',
    })
  );
  return rtlRender(<ChatPreview />, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <LocaleProvider>
        <AppearanceProvider>{children}</AppearanceProvider>
      </LocaleProvider>
    ),
  });
}

describe('the page', () => {
  it('shows the preview outside a production build', () => {
    env['NODE_ENV'] = 'development';
    const page = ChatPreviewPage() as ReactElement;
    expect(page.type).toBe(ChatPreview);
    expect(notFound).not.toHaveBeenCalled();
  });

  it('answers 404 in a production build', () => {
    env['NODE_ENV'] = 'production';
    expect(() => ChatPreviewPage()).toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it('is not indexed and is rendered at request time', async () => {
    const mod = await import('@/app/dev/chat/page');
    expect(mod.dynamic).toBe('force-dynamic');
    expect(mod.metadata.robots).toEqual({ index: false, follow: false });
  });
});

describe('the states', () => {
  it('have unique ids and a label and a note each', () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const scenario of SCENARIOS) {
      expect(scenario.label.length).toBeGreaterThan(5);
      expect(scenario.note.length).toBeGreaterThan(10);
    }
  });

  it('cover every state the order names: idle, each stage in flight, Report 1, a short answer, each refusal, flagged numbers, a fixed answer, an error, Free, collapsed', () => {
    const ids = new Set(SCENARIOS.map((s) => s.id));
    for (const needed of [
      'idle',
      ...STAGES.map((s) => `inflight-${s}`),
      'report1-long',
      'report1-short-instant',
      'report1-flagged',
      'answer',
      'fixed-stale',
      'fixed-model-down',
      'fixed-market-closed',
      'action',
      'refusal-out-of-scope',
      'refusal-quota',
      'refusal-tier',
      'refusal-profile',
      'error-persistence',
      'error-network',
      'error-bad-stream',
      'cancelled',
      'unavailable',
      'state-failed',
      'free-demo',
      'free-no-demo',
      'collapsed',
      'live',
    ]) {
      expect(ids.has(needed)).toBe(true);
    }
  });

  it.each(SCENARIOS.map((s) => [s.id, s] as const))(
    '%s builds, from the recorded answers, without a hand-made reply',
    (_id, scenario) => {
      const state = scenario.build(initialStateFor(previewInfo('50', 'two')));
      if (scenario.id.startsWith('inflight-')) {
        expect(state.flight).not.toBeNull();
      } else {
        expect(state.flight).toBeNull();
      }
      for (const item of state.items) {
        if (item.kind === 'RESULT') {
          const recorded = Object.values(RECORDED).some(
            (e) =>
              e.kind === 'STREAM' &&
              JSON.stringify(e.events.at(-1)).includes(item.requestId)
          );
          expect({ id: scenario.id, recorded }).toEqual({
            id: scenario.id,
            recorded: true,
          });
        }
      }
    }
  );

  it.each([...STAGES])(
    '"in flight at %s" has every stage before it done or skipped, and the stage itself running',
    (stage) => {
      const state = inFlightAt(
        initialStateFor(previewInfo('50', 'two')),
        TYPED,
        stage
      );
      const stages = state.flight!.stages;
      const index = STAGES.indexOf(stage);
      expect(stages[stage]).toBe('STARTED');
      for (const earlier of STAGES.slice(0, index)) {
        expect(['DONE', 'SKIPPED']).toContain(stages[earlier]);
      }
      for (const later of STAGES.slice(index + 1)) {
        expect(stages[later]).toBe('PENDING');
      }
    }
  );

  it('each refusal is the real one: the 429 carries the balance, the others do not', () => {
    const quota = playExchange(initialStateFor(null), TYPED, 'refusal-quota')
      .items[1];
    expect(quota).toMatchObject({
      kind: 'REFUSAL',
      quota: { limit_units: 20_000_000, available_units: 30_000 },
    });
    for (const name of [
      'refusal-tier',
      'refusal-profile',
      'refusal-out-of-scope',
    ]) {
      expect(
        playExchange(initialStateFor(null), TYPED, name).items[1]
      ).toMatchObject({ kind: 'REFUSAL', quota: null });
    }
  });

  it('the preview info is TEST data: two models (one measured), or none, and five balances', () => {
    expect(previewInfo('50', 'none').models).toEqual([]);
    const two = previewInfo('50', 'two').models;
    expect(two.map((m) => m.units_per_msg)).toEqual([18_000, null]);
    expect(QUOTAS).toEqual(['50', '0', '100', 'unconfigured', 'unknown']);
    expect(MODEL_SETS).toEqual(['two', 'none']);
    expect(previewInfo('0', 'two').quota.available_units).toBe(0);
    expect(previewInfo('100', 'two').quota.available_units).toBe(
      previewInfo('100', 'two').quota.limit_units
    );
    expect(previewInfo('unconfigured', 'two').quota.configured).toBe(false);
    expect(previewInfo('unknown', 'two').quota).toMatchObject({
      configured: true,
      limit_units: null,
      available_units: null,
    });
  });

  it('the recorded example is made of recorded replies of one cycle', () => {
    const demo = previewDemo();
    expect(demo.as_of).toBe(resultOf('report1-long').stamp.as_of);
    expect(demo.turns.map((t) => t.result.kind)).toEqual(['REPORT1', 'ANSWER']);
  });
});

describe('the sample words for Arabic, German and Thai', () => {
  it('exist for exactly those three', () => {
    expect([...SAMPLE_LANGUAGES].sort()).toEqual(['ar', 'de', 'th']);
  });

  it.each(['ar', 'de', 'th'])(
    '%s: change words only; the direction, levels, zones, stamp, codes and ids are the server’s',
    (language) => {
      const result = resultOf('report1-long');
      const sampled = localizeResult(result, language);
      expect(sampled.kind).toBe('REPORT1');
      if (sampled.kind !== 'REPORT1' || result.kind !== 'REPORT1') return;
      expect(sampled.reply_locale).toBe(language);
      expect(sampled.report.direction).toEqual(result.report.direction);
      expect(sampled.report.levels).toEqual(result.report.levels);
      expect(sampled.report.zones).toEqual(result.report.zones);
      expect(sampled.report.alignment.channels).toEqual(
        result.report.alignment.channels
      );
      expect(sampled.report.news).toEqual(result.report.news);
      expect(sampled.stamp).toEqual(result.stamp);
      expect(sampled.provenance).toEqual(result.provenance);
      expect(sampled.report.headline).not.toBe(result.report.headline);
      expect(sampled.report.alignment.lines.map((l) => l.cites)).toEqual(
        result.report.alignment.lines.map((l) => l.cites)
      );
    }
  );

  it('leaves a reply in any other language as it is, and every other kind of reply alone but for its locale', () => {
    const result = resultOf('report1-long');
    expect(localizeResult(result, 'en-US')).toBe(result);
    expect(localizeResult(result, 'fr')).toBe(result);
    const fixed = resultOf('fixed-stale');
    expect(localizeResult(fixed, 'ar')).toEqual({
      ...fixed,
      reply_locale: 'ar',
    });
    const answer = resultOf('answer');
    const sampled = localizeResult(answer, 'de');
    expect(sampled.kind === 'ANSWER' && sampled.answer.cites).toEqual(
      answer.kind === 'ANSWER' ? answer.answer.cites : null
    );
  });

  it('a refusal is the server’s fixed reply for its code, read from the dictionary of the language', () => {
    const refusal = refusalOf('refusal-out-of-scope');
    const t = jest.fn(
      (key: string, fallback?: string) => `[${key}] ${fallback}`
    );
    const localized = localizeRefusal(refusal, 'de', t);
    expect(localized).toMatchObject({ code: refusal.code, reply_locale: 'de' });
    expect(t).toHaveBeenCalledWith(
      REFUSAL_TEXT_KEY[refusal.code],
      INTAKE_TEXT[REFUSAL_TEXT_KEY[refusal.code]]
    );
  });
});

describe('the stand-in server', () => {
  const make = (answer: string) =>
    standInFetch({
      answer: () => answer,
      info: () => previewInfo('50', 'two'),
      language: () => 'en-US',
      t: (key, fallback) => fallback ?? key,
      stepMs: 0,
    });

  it('answers the state route with the preview’s state', async () => {
    const response = await make('report1-long')('/api/chat/state');
    const body = (await response.json()) as {
      success: boolean;
      models: unknown[];
      quota: { configured: boolean };
    };
    expect(body.success).toBe(true);
    expect(body.models).toHaveLength(2);
    expect(body.quota.configured).toBe(true);
  });

  it('plays a recorded stream as NDJSON, event by event, to its terminal event', async () => {
    const response = await make('report1-long')('/api/chat/message', {
      method: 'POST',
      body: '{}',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(
      /^application\/x-ndjson/
    );
    const lines = (await response.text())
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as { type: string });
    const recorded = RECORDED['report1-long'];
    expect(recorded?.kind).toBe('STREAM');
    expect(lines.map((l) => l.type)).toEqual(
      recorded?.kind === 'STREAM' ? recorded.events.map((e) => e.type) : []
    );
  });

  it('plays a recorded JSON refusal with its status', async () => {
    const response = await make('refusal-quota')('/api/chat/message', {
      method: 'POST',
      body: '{}',
    });
    expect(response.status).toBe(429);
    expect(
      ((await response.json()) as { refusal: { code: string } }).refusal.code
    ).toBe('QUOTA_INSUFFICIENT');
  });

  it('answers the Trade Setup route as a build with Report 2 off does: 404', async () => {
    const response = await make('report1-long')('/api/engine4/offer', {
      method: 'POST',
      body: '{}',
    });
    expect(response.status).toBe(404);
  });

  it('knows no other route', async () => {
    const response = await make('report1-long')('/api/other');
    expect(response.status).toBe(404);
  });

  it('stops when the request is aborted', async () => {
    const controller = new AbortController();
    const response = await standInFetch({
      answer: () => 'report1-long',
      info: () => previewInfo('50', 'two'),
      language: () => 'en-US',
      t: (key, fallback) => fallback ?? key,
      stepMs: 5,
    })('/api/chat/message', {
      method: 'POST',
      body: '{}',
      signal: controller.signal,
    });
    const reading = response.text();
    controller.abort();
    await expect(reading).rejects.toBeDefined();
  });

  it('refuses at once when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      make('report1-long')('/api/chat/message', {
        method: 'POST',
        body: '{}',
        signal: controller.signal,
      })
    ).rejects.toBeDefined();
  });
});

describe('the page, drawn', () => {
  const pick = (id: string) => {
    fireEvent.change(screen.getByTestId('preview-scenario'), {
      target: { value: id },
    });
  };

  it('opens on a Report 1 at 375 px and says what it is', async () => {
    renderPreview();
    expect(
      screen.getByRole('heading', { name: 'Panel B: the live AI copilot' })
    ).toBeInTheDocument();
    expect(screen.getByText(/Development preview/)).toBeInTheDocument();
    expect(await screen.findByTestId('report1-card')).toBeInTheDocument();
    expect(screen.getByTestId('preview-frame')).toHaveAttribute(
      'data-width',
      '375'
    );
    expect(screen.getByTestId('preview-note')).toHaveTextContent(
      /typed question/
    );
  });

  it.each([
    ['idle', 'empty-state'],
    ['inflight-MODEL', 'progress-stages'],
    ['report1-short-instant', 'report1-card'],
    ['report1-flagged', 'flagged-note'],
    ['answer', 'answer-card'],
    ['fixed-stale', 'fixed-answer-card'],
    ['fixed-model-down', 'fixed-answer-card'],
    ['fixed-market-closed', 'fixed-answer-card'],
    ['action', 'action-card'],
    ['refusal-out-of-scope', 'refusal-card'],
    ['refusal-quota', 'refusal-card'],
    ['refusal-tier', 'refusal-card'],
    ['refusal-profile', 'refusal-card'],
    ['error-persistence', 'error-card'],
    ['error-network', 'error-card'],
    ['error-bad-stream', 'error-card'],
    ['cancelled', 'cancelled-note'],
    ['conversation', 'message-list'],
    ['unavailable', 'unavailable'],
    ['state-failed', 'state-failed'],
    ['free-demo', 'demo-banner'],
    ['free-no-demo', 'demo-empty'],
  ])('%s draws a %s', async (id, testId) => {
    renderPreview();
    pick(id);
    expect(await screen.findByTestId(testId)).toBeInTheDocument();
  });

  it('collapsed is the rail, and pressing it opens the panel again', async () => {
    renderPreview();
    pick('collapsed');
    const rail = await screen.findByRole('button', { name: 'Show AI Analyst' });
    expect(screen.getByTestId('preview-frame')).toHaveStyle({ width: '56px' });
    fireEvent.click(rail);
    expect(await screen.findByTestId('chat-panel')).toBeInTheDocument();
  });

  it.each(['320', '375', '700'])('the frame is %s px wide', (width) => {
    renderPreview();
    fireEvent.click(
      within(screen.getByTestId('preview-width')).getByRole('button', {
        name: width,
      })
    );
    expect(screen.getByTestId('preview-frame')).toHaveAttribute(
      'data-width',
      width
    );
    expect(screen.getByTestId('preview-frame')).toHaveStyle({
      width: `${width}px`,
    });
  });

  it('the allowance control changes the meter: 0%, 100%, not set, unreadable', async () => {
    renderPreview();
    pick('idle');
    for (const [quota, state] of [
      ['0', 'empty'],
      ['100', 'ok'],
      ['unconfigured', 'unconfigured'],
      ['unknown', 'unknown'],
    ] as const) {
      fireEvent.change(screen.getByTestId('preview-quota'), {
        target: { value: quota },
      });
      await waitFor(() =>
        expect(screen.getByTestId('quota-meter')).toHaveAttribute(
          'data-state',
          state
        )
      );
    }
  });

  it('with no model passed the picker says so, as it does today', async () => {
    renderPreview();
    pick('idle');
    fireEvent.change(screen.getByTestId('preview-models'), {
      target: { value: 'none' },
    });
    await waitFor(() =>
      expect(screen.getByTestId('model-picker')).toHaveAttribute(
        'data-state',
        'none'
      )
    );
  });

  it('the live stand-in plays a typed question through its stages to a card', async () => {
    renderPreview();
    pick('live');
    const box = await screen.findByRole('textbox', { name: 'Your question' });
    fireEvent.change(box, { target: { value: 'Direction?' } });
    await act(async () => {
      fireEvent.keyDown(box, { key: 'Enter' });
    });
    expect(await screen.findByTestId('progress-stages')).toBeInTheDocument();
    expect(
      await screen.findByTestId('report1-card', undefined, { timeout: 15000 })
    ).toBeInTheDocument();
  }, 30000);

  it('Arabic: the frame runs right to left and the words are Arabic samples', async () => {
    renderPreview('ar');
    await waitFor(() => expect(document.documentElement.lang).toBe('ar'));
    expect(screen.getByTestId('preview-frame')).toHaveAttribute('dir', 'rtl');
    const headline = await screen.findByTestId('headline');
    await waitFor(() => expect(headline).toHaveAttribute('lang', 'ar'));
    expect(headline).toHaveAttribute('dir', 'rtl');
  });

  it('every state draws in German, Arabic and Thai without a crash', async () => {
    for (const language of ['de', 'ar', 'th']) {
      const { unmount } = renderPreview(language);
      await waitFor(() => expect(document.documentElement.lang).toBe(language));
      for (const scenario of SCENARIOS) {
        pick(scenario.id);
        expect(screen.getByTestId('preview-frame')).toBeInTheDocument();
      }
      unmount();
    }
  }, 60000);
});
