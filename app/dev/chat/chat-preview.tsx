'use client';

import { Bot } from 'lucide-react';
import { useMemo, useRef, useState, type ReactElement } from 'react';

import { ChatPanelView } from '@/components/chat/chat-panel-view';
import { ChatProvider } from '@/components/chat/chat-provider';
import type { ChatItem, ChatState } from '@/components/chat/chat-state';
import { useTradeSetupLauncher } from '@/components/chat/trade-setup-launcher';
import type { DemoRecording } from '@/components/chat/types';
import { useAppearance } from '@/components/providers/appearance-provider';
import { CollapsedPanelRail } from '@/components/workspace/collapsed-panel-rail';
import { useLocale } from '@/lib/context/locale-context';
import { SUPPORTED_LANGUAGES, textDirection } from '@/lib/i18n/languages';

import {
  MODEL_SETS,
  QUOTAS,
  RECORDED,
  SCENARIOS,
  initialStateFor,
  previewDemo,
  previewInfo,
  type ModelSet,
  type QuotaChoice,
  type Scenario,
} from './scenarios';
import { localizeRefusal, localizeResult } from './samples';
import { standInFetch } from './stand-in';

type Width = '320' | '375' | '700';

const LABEL = 'block text-xs font-medium text-muted-foreground';
const SELECT =
  'rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** The recorded exchanges a typed question can be answered with in the preview. */
const ANSWERS = [
  'report1-long',
  'report1-short-instant',
  'report1-flagged',
  'answer',
  'fixed-stale',
  'fixed-model-down',
  'action',
  'refusal-out-of-scope',
  'refusal-quota',
  'refusal-tier',
  'error-persistence',
] as const;

function Segmented<T extends string>({
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
      <div className="inline-flex overflow-hidden rounded-md border">
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

export function ChatPreview(): ReactElement {
  const { language, setLocalePreferences, t } = useLocale();
  const { settings, updateSettings } = useAppearance();
  const [scenarioId, setScenarioId] = useState('report1-long');
  const [width, setWidth] = useState<Width>('375');
  const [quota, setQuota] = useState<QuotaChoice>('50');
  const [models, setModels] = useState<ModelSet>('two');
  const [answer, setAnswer] = useState<string>('report1-long');
  const [collapsedBack, setCollapsedBack] = useState(false);

  const scenario = SCENARIOS.find((s) => s.id === scenarioId) as Scenario;
  const dir = textDirection(language);
  const info = useMemo(() => previewInfo(quota, models), [quota, models]);

  // the stand-in reads the latest choices through refs, so changing one does not rebuild the panel
  const latest = useRef({ answer, language, info, t });
  latest.current = { answer, language, info, t };
  const standIn = useMemo(
    () =>
      standInFetch({
        answer: () => latest.current.answer,
        info: () => latest.current.info,
        language: () => latest.current.language,
        t: (key, fallback) => latest.current.t(key, fallback),
      }),
    []
  );
  const launcher = useTradeSetupLauncher(standIn);

  const translated = !language.startsWith('en');

  const start: ChatState = useMemo(() => {
    const base: ChatState =
      scenario.info === 'unavailable'
        ? { ...initialStateFor(null), infoStatus: 'unavailable' }
        : scenario.info === 'failed'
          ? { ...initialStateFor(null), infoStatus: 'error' }
          : initialStateFor(info);
    const built = scenario.build(base);
    if (!translated) return built;
    const items: ChatItem[] = built.items.map((item) => {
      if (item.kind === 'RESULT') {
        return { ...item, result: localizeResult(item.result, language) };
      }
      if (item.kind === 'REFUSAL') {
        return {
          ...item,
          refusal: localizeRefusal(item.refusal, language, t),
        };
      }
      return item;
    });
    return { ...built, items };
  }, [scenario, info, language, t, translated]);

  const demo: DemoRecording | null = useMemo(() => {
    if (!scenario.demo) return null;
    const recording = previewDemo();
    return {
      ...recording,
      turns: recording.turns.map((turn) => ({
        ...turn,
        result: localizeResult(turn.result, language),
      })),
    };
  }, [scenario.demo, language]);

  const collapsed = scenario.collapsed === true && !collapsedBack;
  const panelKey = `${scenarioId}-${language}-${quota}-${models}`;

  return (
    <main
      className="mx-auto max-w-5xl space-y-5 px-4 py-6"
      data-testid="chat-preview"
    >
      <header className="space-y-2">
        <h1 className="text-xl font-semibold">Panel B: the live AI copilot</h1>
        <p className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-950 dark:text-amber-50">
          Development preview. The real panel components and reducer draw
          answers RECORDED from the real message route (the fixture model wrote
          the words). The two models and the balance are TEST values. For
          Arabic, German and Thai the model&apos;s words are layout samples
          written for this page, not translations anyone has read. Nothing is
          recorded, nothing is sent, and this page does not exist in a
          production build.
        </p>
      </header>

      <section
        className="flex flex-wrap items-end gap-4"
        aria-label="Preview controls"
      >
        <div className="min-w-0 max-w-full space-y-1">
          <label htmlFor="scenario" className={LABEL}>
            State
          </label>
          <select
            id="scenario"
            data-testid="preview-scenario"
            className={`${SELECT} w-full max-w-full`}
            value={scenarioId}
            onChange={(event) => {
              setScenarioId(event.target.value);
              setCollapsedBack(false);
            }}
          >
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 max-w-full space-y-1">
          <label htmlFor="language" className={LABEL}>
            Language
          </label>
          <select
            id="language"
            data-testid="preview-language"
            className={SELECT}
            value={language}
            onChange={(event) =>
              setLocalePreferences({ language: event.target.value })
            }
          >
            {SUPPORTED_LANGUAGES.map((option) => (
              <option key={option.code} value={option.code}>
                {option.flag} {option.name}
              </option>
            ))}
          </select>
        </div>
        <Segmented
          testId="preview-theme"
          label="Theme"
          value={settings.theme === 'dark' ? 'dark' : 'light'}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
          onChange={(theme) => updateSettings({ theme })}
        />
        <Segmented
          testId="preview-width"
          label="Panel width (px)"
          value={width}
          options={[
            { value: '320', label: '320' },
            { value: '375', label: '375' },
            { value: '700', label: '700' },
          ]}
          onChange={setWidth}
        />
        <div className="space-y-1">
          <label htmlFor="quota" className={LABEL}>
            Allowance left
          </label>
          <select
            id="quota"
            data-testid="preview-quota"
            className={SELECT}
            value={quota}
            onChange={(event) => setQuota(event.target.value as QuotaChoice)}
          >
            {QUOTAS.map((q) => (
              <option key={q} value={q}>
                {q === 'unconfigured'
                  ? 'not set'
                  : q === 'unknown'
                    ? 'unreadable'
                    : `${q}%`}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="models" className={LABEL}>
            Models that passed
          </label>
          <select
            id="models"
            data-testid="preview-models"
            className={SELECT}
            value={models}
            onChange={(event) => setModels(event.target.value as ModelSet)}
          >
            {MODEL_SETS.map((m) => (
              <option key={m} value={m}>
                {m === 'none' ? 'none (as today)' : 'two (TEST)'}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 max-w-full space-y-1">
          <label htmlFor="answer" className={LABEL}>
            A typed question gets
          </label>
          <select
            id="answer"
            data-testid="preview-answer"
            className={SELECT}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
          >
            {ANSWERS.filter((name) => RECORDED[name] !== undefined).map(
              (name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              )
            )}
          </select>
        </div>
      </section>

      <p className="text-sm text-muted-foreground" data-testid="preview-note">
        {scenario.note}
      </p>

      <div
        data-testid="preview-frame"
        data-width={width}
        dir={dir}
        style={{ width: collapsed ? 56 : Number(width), maxWidth: '100%' }}
        className="h-[720px] overflow-hidden rounded-lg border bg-card"
      >
        {collapsed ? (
          <CollapsedPanelRail
            side="left"
            icon={Bot}
            label={t('AI Analyst')}
            actionLabel={t('Show AI Analyst')}
            accent="amber"
            onExpand={() => setCollapsedBack(true)}
          />
        ) : (
          <ChatProvider
            key={panelKey}
            tier={scenario.tier}
            fetchImpl={standIn}
            initialState={start}
            loadOnMount={scenario.live === true && scenario.tier === 'PRO'}
            onOpenTradeSetup={launcher.open}
          >
            <ChatPanelView
              tier={scenario.tier}
              demo={demo}
              overlay={launcher.element}
              onCollapsePanel={() => setScenarioId('collapsed')}
              onOpenUpgradeModal={() => undefined}
            />
          </ChatProvider>
        )}
      </div>
    </main>
  );
}
