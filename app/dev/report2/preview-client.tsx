'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
} from 'react';

import { useAppearance } from '@/components/providers/appearance-provider';
import type { Report2Api, SetupRequest } from '@/components/report2/api-client';
import { NotOfferedNotice } from '@/components/report2/notices';
import { Report2Card } from '@/components/report2/report2-card';
import {
  TradeSetupForm,
  TradeSetupModal,
} from '@/components/report2/trade-setup-modal';
import { useLocale } from '@/lib/context/locale-context';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n/languages';
import { initialStop, stopDistanceFor } from '@/lib/engine4/templates/fields';
import { describeNotOffered } from '@/lib/engine4/templates/messages';
import type {
  WireOfferAnswer,
  WireOfferedModal,
  WireSizeAnswer,
} from '@/lib/engine4/templates/wire';

import { devConsent, devOffer, devSize } from './actions';
import type { Scenario } from './scenarios';

type View = 'modal' | 'form' | 'card';
type Frame = 'full' | '360' | '320';

const LABEL = 'block text-xs font-medium text-muted-foreground';
const SELECT =
  'rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring';

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

/** The request the modal would open on: the best open zone, its pre-selected stop, the pre-set risk and RRR. */
function openingRequest(
  offer: WireOfferAnswer,
  language: string
): SetupRequest {
  const cycleSlot = offer.cycleSlot ?? '0';
  if (offer.modal.status === 'NOT_OFFERED') {
    return {
      cycleSlot,
      side: 'BUY',
      entry: '',
      equity: offer.profile.equity,
      riskPct: '',
      stopDistance: '',
      rrr: '',
      language,
    };
  }
  const modal: WireOfferedModal = offer.modal;
  const pill = modal.pills.find((candidate) => !candidate.invalidated);
  if (pill === undefined) {
    return {
      cycleSlot,
      side: modal.side,
      entry: '',
      equity: modal.equity,
      riskPct: modal.risk.preset,
      stopDistance: '',
      rrr: modal.rrr.preset,
      language,
    };
  }
  const start = initialStop(pill.stop);
  return {
    cycleSlot,
    side: modal.side,
    zoneId: pill.zoneId,
    entry: pill.price,
    equity: modal.equity,
    riskPct: modal.risk.preset,
    stopDistance: stopDistanceFor(start.selection, pill.stop, start.custom),
    rrr: modal.rrr.preset,
    language,
  };
}

export function PreviewClient({
  scenarios,
}: {
  scenarios: Scenario[];
}): ReactElement {
  const { language, setLocalePreferences } = useLocale();
  const { settings, updateSettings } = useAppearance();
  const [scenarioId, setScenarioId] = useState(scenarios[0]?.id ?? '18sep');
  const [view, setView] = useState<View>('form');
  const [frame, setFrame] = useState<Frame>('full');
  const [open, setOpen] = useState(false);
  const [offer, setOffer] = useState<WireOfferAnswer | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [cardAnswer, setCardAnswer] = useState<WireSizeAnswer | null>(null);

  const scenario = scenarios.find((s) => s.id === scenarioId) ?? scenarios[0];

  const api: Report2Api = useMemo(
    () => ({
      size: async (request) => {
        try {
          return await devSize(scenarioId, request);
        } catch {
          return { ok: false, code: 'NETWORK', retryable: true };
        }
      },
      consent: async (request) => {
        try {
          return await devConsent(scenarioId, request);
        } catch {
          return { ok: false, code: 'NETWORK', retryable: true };
        }
      },
    }),
    [scenarioId]
  );

  useEffect(() => {
    let cancelled = false;
    setOffer(null);
    setCardAnswer(null);
    setProblem(null);
    devOffer(scenarioId).then(
      (answer) => {
        if (!cancelled) setOffer(answer);
      },
      (error: unknown) => {
        if (!cancelled) {
          setProblem(
            error instanceof Error ? error.message : 'The preview failed.'
          );
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [scenarioId, reload]);

  // the card is drawn from the answer the modal would open on
  useEffect(() => {
    if (offer === null || view !== 'card') return;
    let cancelled = false;
    api.size(openingRequest(offer, language)).then((outcome) => {
      if (!cancelled && outcome.ok) setCardAnswer(outcome.answer);
    });
    return () => {
      cancelled = true;
    };
  }, [offer, view, api, language]);

  const refresh = useCallback(() => setReload((count) => count + 1), []);

  const modal: WireOfferedModal | null =
    offer !== null && offer.modal.status !== 'NOT_OFFERED' ? offer.modal : null;

  const notOffered =
    offer !== null && offer.modal.status === 'NOT_OFFERED' ? offer.modal : null;
  const reason =
    notOffered !== null && notOffered.reason !== null
      ? describeNotOffered(notOffered.reason.code, {
          dataAsOfSlot: offer?.offer.dataAsOfSlot ?? null,
          block:
            offer !== null && offer.blackout.blocks[0] !== undefined
              ? {
                  name: offer.blackout.blocks[0].eventName,
                  time: offer.blackout.blocks[0].eventTime,
                  end:
                    offer.blackout.windowEndsAt ??
                    offer.blackout.blocks[0].windowEnd,
                }
              : null,
        })
      : null;

  const width = frame === 'full' ? undefined : Number(frame);

  return (
    <main
      className="mx-auto max-w-5xl space-y-5 px-4 py-6"
      data-testid="report2-preview"
    >
      <header className="space-y-2">
        <h1 className="text-xl font-semibold">
          Report 2: Trade Setup modal and card
        </h1>
        <p className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-950 dark:text-amber-50">
          Development preview. The real Engine 4 runs over a stored cycle; the
          broker figures, the Tier-1 ids and the M5 bars are TEST values.
          Nothing is recorded, nothing is sent, and this page does not exist in
          a production build.
        </p>
      </header>

      <section
        className="flex flex-wrap items-end gap-4"
        aria-label="Preview controls"
      >
        <div className="min-w-0 max-w-full space-y-1">
          <label htmlFor="scenario" className={LABEL}>
            Scenario
          </label>
          <select
            id="scenario"
            data-testid="preview-scenario"
            className={`${SELECT} w-full max-w-full`}
            value={scenarioId}
            onChange={(event) => setScenarioId(event.target.value)}
          >
            {scenarios.map((s) => (
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
          testId="preview-frame"
          label="Width (card and form)"
          value={frame}
          options={[
            { value: 'full', label: 'Full' },
            { value: '360', label: '360' },
            { value: '320', label: '320' },
          ]}
          onChange={setFrame}
        />
        <Segmented
          testId="preview-view"
          label="View"
          value={view}
          options={[
            { value: 'form', label: 'Modal content' },
            { value: 'modal', label: 'Modal (dialog)' },
            { value: 'card', label: 'Card' },
          ]}
          onChange={setView}
        />
      </section>

      {scenario === undefined ? null : (
        <p className="text-sm text-muted-foreground" data-testid="preview-note">
          {scenario.note}
        </p>
      )}

      {problem !== null ? (
        <p
          role="alert"
          className="rounded-md border border-red-500/50 p-3 text-sm text-red-700 dark:text-red-300"
        >
          {problem}
        </p>
      ) : null}
      {offer === null && problem === null ? (
        <p className="text-sm text-muted-foreground">
          Loading the stored cycle…
        </p>
      ) : null}

      {notOffered !== null && view !== 'card' ? (
        <div className="mx-auto" style={{ maxWidth: width }}>
          <NotOfferedNotice reason={reason} />
        </div>
      ) : null}

      {offer !== null && modal !== null && view === 'modal' ? (
        <div>
          <button
            type="button"
            data-testid="open-modal"
            onClick={() => setOpen(true)}
            className="hover:bg-primary/90 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Open the Trade Setup modal
          </button>
          <TradeSetupModal
            open={open}
            onOpenChange={setOpen}
            modal={modal}
            cycleSlot={offer.cycleSlot ?? '0'}
            api={api}
            dataAsOf={offer.offer.dataAsOfSlot}
            onRefresh={refresh}
          />
        </div>
      ) : null}

      {offer !== null && modal !== null && view === 'form' ? (
        <div
          className="mx-auto rounded-lg border border-dashed p-4"
          style={{ maxWidth: width }}
          data-testid="preview-frame-box"
        >
          <TradeSetupForm
            key={`${scenarioId}-${reload}`}
            modal={modal}
            cycleSlot={offer.cycleSlot ?? '0'}
            api={api}
            dataAsOf={offer.offer.dataAsOfSlot}
            onRefresh={refresh}
          />
        </div>
      ) : null}

      {offer !== null && view === 'card' ? (
        <div
          className="mx-auto"
          style={{ maxWidth: width }}
          data-testid="preview-frame-box"
        >
          {cardAnswer === null ? (
            <p className="text-sm text-muted-foreground">
              Sizing the opening setup…
            </p>
          ) : (
            <Report2Card
              setup={cardAnswer.setup}
              badge={cardAnswer.badge}
              offer={cardAnswer.offer}
              blackout={offer.blackout}
            />
          )}
        </div>
      ) : null}
    </main>
  );
}
