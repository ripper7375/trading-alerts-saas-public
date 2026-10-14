'use client';

import { useCallback, useMemo, useState, type ReactElement } from 'react';

import {
  MarketContextBadge,
  type InstantBadgeState,
} from '@/components/charts/ask-ai-button';
import {
  useInstantPrompt,
  type InstantAnswer,
  type PostInstant,
} from '@/components/charts/use-instant-prompt';
import { useLocale } from '@/lib/context/locale-context';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n/languages';
import type { InstantIntent } from '@/lib/intake/intents';
import { INTAKE_TEXT } from '@/lib/intake/text';

type Tier = 'PRO' | 'FREE';
type Outcome = 'SUCCESS' | 'REFUSED' | 'UNREACHABLE';
type Frame = 'full' | '360' | '320';
type Mode = 'LIVE' | 'IDLE' | 'IN_FLIGHT' | 'REFUSED';

const LABEL = 'block text-xs font-medium text-muted-foreground';
const SELECT =
  'block w-full min-w-0 rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const FRAME_CLASS: Record<Frame, string> = {
  full: 'w-full',
  '360': 'w-[360px] max-w-full',
  '320': 'w-[320px] max-w-full',
};

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
  testId,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  testId: string;
}): ReactElement {
  return (
    <div className="space-y-1" data-testid={testId}>
      <p className={LABEL}>{label}</p>
      <div className="inline-flex flex-wrap overflow-hidden rounded-md border">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={
              value === option.value
                ? 'bg-primary px-3 py-1.5 text-sm text-primary-foreground'
                : 'bg-background px-3 py-1.5 text-sm hover:bg-accent'
            }
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * A stand-in for a chart pane: the same `relative` box, and the same top-left box `TradingChart`
 * puts its `overlayBadge` in, with no chart behind it.
 */
function FakePane({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): ReactElement {
  return (
    <div
      className="border-border/60 relative h-56 select-none overflow-hidden rounded-md border bg-card"
      style={{
        backgroundImage:
          'linear-gradient(to right, hsl(var(--border) / 0.35) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border) / 0.35) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }}
    >
      <div className="pointer-events-auto absolute left-2.5 top-2.5 z-20">
        {children}
      </div>
      <span className="absolute bottom-9 right-2.5 font-mono text-xs text-muted-foreground">
        {title}
      </span>
      <div className="border-border/60 bg-background/60 absolute inset-x-0 bottom-0 h-7 border-t" />
    </div>
  );
}

export function InstantPreview(): ReactElement {
  const { t, language, setLocalePreferences } = useLocale();
  const [tier, setTier] = useState<Tier>('PRO');
  const [mode, setMode] = useState<Mode>('LIVE');
  const [outcome, setOutcome] = useState<Outcome>('REFUSED');
  const [frame, setFrame] = useState<Frame>('full');
  const [log, setLog] = useState<string[]>([]);

  const note = useCallback(
    (line: string): void => setLog((rows) => [line, ...rows].slice(0, 6)),
    []
  );

  // The stand-in for the route: no network, no model. The "reply" of a refusal is the fixed text of
  // the interface language, as the server would send it.
  const post = useCallback<PostInstant>(
    async (kind): Promise<InstantAnswer> => {
      note(`POST /api/intake/instant ${JSON.stringify({ kind })} (stand-in)`);
      await delay(1200);
      if (outcome === 'SUCCESS') return { ok: true, body: { success: true } };
      if (outcome === 'UNREACHABLE') return { ok: false, reply: null };
      return {
        ok: false,
        reply: t(
          'intake.refusal.quota_insufficient',
          INTAKE_TEXT['intake.refusal.quota_insufficient']
        ),
      };
    },
    [outcome, t, note]
  );

  const live = useInstantPrompt({
    isPro: tier === 'PRO',
    onOpenUpgradeModal: () => note('the upgrade modal would open'),
    onResult: () => note('200: the packet would go to the chat (step 7)'),
    post,
  });

  const staticNotice = useMemo(
    () =>
      t(
        'intake.refusal.quota_insufficient',
        INTAKE_TEXT['intake.refusal.quota_insufficient']
      ),
    [t]
  );

  const panes: { kind: InstantIntent; timeframe: string; title: string }[] = [
    { kind: 'INSTANT_M15_INSPECT', timeframe: 'M15', title: 'upper pane' },
    { kind: 'INSTANT_M5_INSPECT', timeframe: 'M5', title: 'lower pane' },
  ];

  const instantFor = (kind: InstantIntent): InstantBadgeState => {
    if (mode === 'LIVE') {
      return {
        kind,
        loading: live.pending === kind,
        busy: live.pending !== null,
        notice: live.notice?.kind === kind ? live.notice.text : null,
        onPress: live.press,
      };
    }
    const shown = kind === 'INSTANT_M5_INSPECT';
    return {
      kind,
      loading: mode === 'IN_FLIGHT' && shown,
      busy: mode === 'IN_FLIGHT',
      notice: mode === 'REFUSED' && shown ? staticNotice : null,
      onPress: () => note(`${kind} pressed (static state, nothing happens)`),
    };
  };

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold">
          Panel C instant prompts (development only)
        </h1>
        <p className="text-sm text-muted-foreground">
          The real Market Context badge of{' '}
          <code>components/charts/ask-ai-button.tsx</code> in a stand-in pane
          (top left, where the chart puts it), with the real press hook. The
          route is replaced by a stand-in: no network call, no model. In the
          product the badges are the instant prompts only when{' '}
          <code>INTAKE_INSTANT_PROMPTS_ENABLED</code> is exactly{' '}
          <code>true</code>.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Choice
          label="Trader"
          value={tier}
          testId="instant-tier"
          onChange={setTier}
          options={[
            { value: 'PRO', label: 'PRO (posts)' },
            { value: 'FREE', label: 'FREE (upgrade modal)' },
          ]}
        />
        <Choice
          label="State"
          value={mode}
          testId="instant-mode"
          onChange={setMode}
          options={[
            { value: 'LIVE', label: 'Live' },
            { value: 'IDLE', label: 'Idle' },
            { value: 'IN_FLIGHT', label: 'In flight' },
            { value: 'REFUSED', label: 'Refused' },
          ]}
        />
        <Choice
          label="Frame"
          value={frame}
          testId="instant-frame"
          onChange={setFrame}
          options={[
            { value: 'full', label: 'Full' },
            { value: '360', label: '360 px' },
            { value: '320', label: '320 px' },
          ]}
        />
        <Choice
          label="The stand-in route answers (Live, PRO)"
          value={outcome}
          testId="instant-outcome"
          onChange={setOutcome}
          options={[
            { value: 'SUCCESS', label: '200' },
            { value: 'REFUSED', label: 'Refusal (quota)' },
            { value: 'UNREACHABLE', label: '404 / no network' },
          ]}
        />
        <div className="space-y-1">
          <label htmlFor="instant-language" className={LABEL}>
            Interface language
          </label>
          <select
            id="instant-language"
            data-testid="instant-language"
            className={SELECT}
            value={language}
            onChange={(event) =>
              setLocalePreferences({ language: event.target.value })
            }
          >
            {SUPPORTED_LANGUAGES.map((option) => (
              <option key={option.code} value={option.code}>
                {option.code} · {option.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section
        className={`${FRAME_CLASS[frame]} space-y-3`}
        data-testid="panes"
      >
        {panes.map(({ kind, timeframe, title }) => (
          <FakePane key={kind} title={title}>
            <MarketContextBadge
              symbol="XAUUSD"
              timeframe={timeframe}
              active={timeframe === 'M15'}
              instant={instantFor(kind)}
            />
          </FakePane>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">
          The badge alone, in the way it flows (for a screenshot)
        </h2>
        <div className={`${FRAME_CLASS[frame]} rounded-md border p-3`}>
          <MarketContextBadge
            symbol="XAUUSD"
            timeframe="M5"
            active
            instant={instantFor('INSTANT_M5_INSPECT')}
          />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">What happened</h2>
        <ul
          className="bg-muted/40 rounded-md border p-3 font-mono text-xs"
          data-testid="instant-log"
        >
          {log.length === 0 ? (
            <li className="text-muted-foreground">Press a button.</li>
          ) : (
            log.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)
          )}
        </ul>
      </section>
    </main>
  );
}
