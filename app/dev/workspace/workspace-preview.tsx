'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useMemo, useRef, useState, type ReactElement } from 'react';

import { DemoPolicyContext } from '@/components/chat/demo-source';
import { ProUpgradeModal } from '@/components/ui/pro-upgrade-modal';
import { useAppearance } from '@/components/providers/appearance-provider';
import { TradingWorkspace } from '@/components/workspace/trading-workspace';
import { useLocale } from '@/lib/context/locale-context';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n/languages';

import { RECORDED, previewInfo } from '../chat/scenarios';
import { standInFetch } from '../chat/stand-in';
import {
  THREAD_WORLDS,
  threadsStandIn,
  type ThreadWorld,
} from './threads-stand-in';

const LABEL = 'block text-[11px] font-medium text-muted-foreground';
const SELECT =
  'w-full rounded-md border bg-background px-2 py-1 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** What the next question, or the next press on a badge, is answered with: recorded answers of the real route. */
const ANSWERS = [
  'report1-long',
  'report1-short-instant',
  'report1-flagged',
  'answer',
  'fixed-stale',
  'fixed-model-down',
  'refusal-out-of-scope',
  'refusal-quota',
  'refusal-tier',
  'error-persistence',
] as const;

const WORLD_LABEL: Record<ThreadWorld, string> = {
  five: 'five threads (every direction)',
  many: '45 threads (a second page)',
  none: 'none yet',
  slow: 'five, arriving slowly',
  error: 'the list cannot be read',
  off: 'the chat route is off (404)',
};

function Toggle({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  testId: string;
}): ReactElement {
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span>{label}</span>
      <input
        type="checkbox"
        data-testid={testId}
        checked={value}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4"
      />
    </label>
  );
}

export function WorkspacePreview(): ReactElement {
  const { language, setLocalePreferences, t } = useLocale();
  const { settings, updateSettings } = useAppearance();
  const [tier, setTier] = useState<'PRO' | 'FREE'>('PRO');
  const [replyEnabled, setReplyEnabled] = useState(true);
  const [instantPrompts, setInstantPrompts] = useState(true);
  // the Free tier's recorded example: the files of config/reply/demo/, which the product itself shows
  // only once they are approved and come from a live run (components/chat/demo-source.ts)
  const [recorded, setRecorded] = useState(true);
  const [world, setWorld] = useState<ThreadWorld>('five');
  const [answer, setAnswer] = useState<string>('report1-short-instant');
  const [open, setOpen] = useState(true);
  const [upgrade, setUpgrade] = useState(false);

  // the stand-in reads the latest choices through a ref, so changing one does not rebuild the workspace
  const latest = useRef({ answer, language, world, t });
  latest.current = { answer, language, world, t };

  const standIn = useMemo(() => {
    const threads = threadsStandIn({
      world: () => latest.current.world,
      language: () => latest.current.language,
      t: (key, fallback) => latest.current.t(key, fallback),
    });
    const chat = standInFetch({
      answer: () => latest.current.answer,
      info: () => previewInfo('50', 'two'),
      language: () => latest.current.language,
      t: (key, fallback) => latest.current.t(key, fallback),
      stepMs: 450,
      threadId: (body) =>
        threads.accept({ answer: latest.current.answer, body }),
    });
    const fetcher: typeof fetch = async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const response = threads.handle(url, init);
      return response === null ? chat(input, init) : response;
    };
    return fetcher;
  }, []);

  // a different tier, flag or thread list is a different server-side render: start the workspace again
  const key = `${tier}-${replyEnabled}-${instantPrompts}-${world}`;

  return (
    <div data-testid="workspace-preview" className="relative">
      <DemoPolicyContext.Provider value={{ includeUnapproved: recorded }}>
        <TradingWorkspace
          key={key}
          tier={tier}
          replyEnabled={replyEnabled}
          instantPromptsEnabled={instantPrompts}
          chatFetchImpl={standIn}
          {...(tier === 'FREE'
            ? { onOpenUpgradeModal: () => setUpgrade(true) }
            : {})}
        />
      </DemoPolicyContext.Provider>
      {tier === 'FREE' ? (
        <ProUpgradeModal
          isOpen={upgrade}
          onClose={() => setUpgrade(false)}
          featureName="early access to AI Copilot & Market Comments"
        />
      ) : null}

      <aside
        aria-label="Preview controls"
        data-testid="preview-controls"
        className="fixed bottom-2 end-2 z-50 w-64 max-w-[calc(100vw-1rem)] rounded-lg border bg-card text-card-foreground shadow-xl"
      >
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold"
        >
          <span>Development preview: the three panels</span>
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
        {open ? (
          <div className="max-h-[70vh] space-y-2 overflow-y-auto border-t px-3 py-2">
            <p className="text-[10px] leading-snug text-muted-foreground">
              The real workspace, sidebar, chat panel and chart badges, over a
              stand-in for the chat routes that plays RECORDED answers of the
              real message route. Nothing is sent anywhere. The balance and the
              two models are TEST values. This page does not exist in a
              production build.
            </p>
            <div className="space-y-1">
              <p className={LABEL}>Tier</p>
              <div className="inline-flex overflow-hidden rounded-md border text-xs">
                {(['PRO', 'FREE'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    data-testid={`preview-tier-${value}`}
                    aria-pressed={tier === value}
                    onClick={() => setTier(value)}
                    className={
                      tier === value
                        ? 'bg-primary px-3 py-1 text-primary-foreground'
                        : 'bg-background px-3 py-1 hover:bg-accent'
                    }
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
            <Toggle
              label="REPLY_ENABLED (the chat)"
              value={replyEnabled}
              onChange={setReplyEnabled}
              testId="preview-reply"
            />
            <Toggle
              label="INTAKE_INSTANT_PROMPTS_ENABLED"
              value={instantPrompts}
              onChange={setInstantPrompts}
              testId="preview-instant"
            />
            <Toggle
              label="Free: show the recorded example (stand-in, unapproved)"
              value={recorded}
              onChange={setRecorded}
              testId="preview-demo"
            />
            <div className="space-y-1">
              <label htmlFor="world" className={LABEL}>
                Panel A: the trader&apos;s threads
              </label>
              <select
                id="world"
                data-testid="preview-world"
                className={SELECT}
                value={world}
                onChange={(event) =>
                  setWorld(event.target.value as ThreadWorld)
                }
              >
                {THREAD_WORLDS.map((value) => (
                  <option key={value} value={value}>
                    {WORLD_LABEL[value]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="answer" className={LABEL}>
                The next question or badge press gets
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
            <div className="space-y-1">
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
            <Toggle
              label="Dark theme"
              value={settings.theme === 'dark'}
              onChange={(dark) =>
                updateSettings({ theme: dark ? 'dark' : 'light' })
              }
              testId="preview-theme"
            />
          </div>
        ) : null}
      </aside>
    </div>
  );
}
