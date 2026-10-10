'use client';

/**
 * The Trade Setup modal (architecture 6.3 and 6.13; build step 5, part 7).
 *
 * It is handed the modal DEFINITION the `offer` route built (direction, one pill per
 * zone in rank order, the stop options behind each pill, the bounds of a custom
 * entry and stop, the risk pre-set with its reason, the equity from the profile, the
 * RRR with its counter-trend cap) and a `Report2Api`. Every change the trader makes
 * asks the server to SIZE the setup again; nothing is computed here. What it shows
 * is the server's `ValidatedSetup`, drawn through the fixed template, so the numbers
 * on screen are the ones Engine 4 produced and the ones a consent will record.
 *
 * What the browser does itself is only what saves a round trip and never decides:
 * it tells the trader at once that a field is empty, not a number or outside a bound
 * the definition showed (`templates/fields.ts` returns the validator's own codes), it
 * waits a moment after typing before it asks, and it ignores an answer that belongs
 * to figures the trader has already changed. Accept is possible only for the setup
 * that is on screen and passed all eight checks; the hash of that setup travels with
 * the press.
 *
 * `TradeSetupForm` is the whole content; `TradeSetupModal` puts it in a dialog. The
 * dialog unmounts its content on close, so each opening starts from the definition.
 *
 * @module components/report2/trade-setup-modal
 */

import { TrendingDown, TrendingUp } from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  initialStop,
  limitsOf,
  parseTyped,
  precheckCustomEntry,
  precheckEquity,
  precheckRisk,
  precheckRrr,
  precheckStop,
  stopDistanceFor,
  type StopSelection,
} from '@/lib/engine4/templates/fields';
import {
  describeApiError,
  describeCheckCode,
  describeNotice,
  type Described,
} from '@/lib/engine4/templates/messages';
import {
  buildReport2,
  type UnderflowActionDoc,
} from '@/lib/engine4/templates/report2';
import {
  readWire,
  type ConsentAction,
  type WireOfferedModal,
  type WireSizeAnswer,
  type WireValidatedSetup,
} from '@/lib/engine4/templates/wire';
import { cn } from '@/lib/utils';

import type { Report2Api, SetupRequest } from './api-client';
import { ChecksList } from './checks';
import { ConsentBar, type ConsentOutcome } from './consent-bar';
import { EntryPills, type EntrySelection } from './entry-pills';
import {
  Callout,
  CompulsoryNotices,
  NotOfferedNotice,
  OfferNotices,
  ReleaseWarnings,
} from './notices';
import { RiskPair } from './risk-pair';
import { RoomAndBadge, ScenarioTable } from './scenario-table';
import { StopOptions } from './stop-options';
import { UnderflowHelp } from './underflow-help';
import { useReport2 } from './use-report2';

/** How long the figures sit still before the server is asked to size them again. */
export const SIZE_DEBOUNCE_MS = 250;

const percent = (text: string): { kind: 'percent'; text: string } => ({
  kind: 'percent',
  text: readWire(text).toDecimal(2),
});
const ratio = (text: string): { kind: 'ratio'; text: string } => ({
  kind: 'ratio',
  text: readWire(text).toDecimal(2),
});

// ---------------------------------------------------------------------------
// One labelled number field
// ---------------------------------------------------------------------------

function NumberField({
  label,
  value,
  onChange,
  issue,
  notes,
  disabled,
  testId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  issue: string | null;
  notes: readonly string[];
  disabled: boolean;
  testId: string;
}): ReactElement {
  const id = useId();
  const noteId = useId();
  const errorId = useId();
  return (
    <div className="min-w-0 space-y-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        data-testid={testId}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        dir="ltr"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={issue !== null}
        aria-describedby={`${noteId}${issue === null ? '' : ` ${errorId}`}`}
        className={cn(
          'w-full rounded-md border bg-background px-3 py-2 text-sm tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
          issue !== null && 'border-red-500'
        )}
      />
      <div id={noteId} className="space-y-0.5 text-xs text-muted-foreground">
        {notes.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </div>
      {issue === null ? null : (
        <p
          id={errorId}
          role="alert"
          className="text-xs font-medium text-red-700 dark:text-red-300"
        >
          {issue}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The form
// ---------------------------------------------------------------------------

type SizeState =
  | { status: 'loading'; answer: WireSizeAnswer | null; key: string | null }
  | { status: 'ready'; answer: WireSizeAnswer; key: string }
  | {
      status: 'error';
      answer: WireSizeAnswer | null;
      key: string | null;
      code: string;
    };

export interface RecordedEvent {
  action: ConsentAction;
  duplicate: boolean;
  recordedAt: string;
  setup: WireValidatedSetup;
  setupSha256: string;
}

export interface TradeSetupFormProps {
  /** the definition the `offer` route built (the offered kinds; a not-offered definition has no form) */
  modal: WireOfferedModal;
  /** the cycle the setup is pinned to (unix seconds as text) */
  cycleSlot: string;
  api: Report2Api;
  /** the slot of the newest cycle's data, when the offer gave one: "data as of" */
  dataAsOf?: string | null;
  /** the trader pressed Refresh on "the picture changed": fetch the offer again */
  onRefresh?: () => void;
  /** a consent was recorded */
  onRecorded?: (event: RecordedEvent) => void;
  /** wait this long after a change before sizing (a test passes 0) */
  debounceMs?: number;
  /** a new submission id (a test passes its own) */
  makeId?: () => string;
}

export function TradeSetupForm({
  modal,
  cycleSlot,
  api,
  dataAsOf = null,
  onRefresh,
  onRecorded,
  debounceMs = SIZE_DEBOUNCE_MS,
  makeId,
}: TradeSetupFormProps): ReactElement {
  const { tr, fig, say, language, dir } = useReport2();
  const limits = useMemo(() => limitsOf(modal), [modal]);

  // -- what the trader has chosen and typed ---------------------------------------------
  const firstOpen = modal.pills.find((pill) => !pill.invalidated);
  const opening =
    firstOpen === undefined
      ? { selection: { kind: 'CUSTOM' } as StopSelection, custom: '' }
      : initialStop(firstOpen.stop);

  const [entry, setEntry] = useState<EntrySelection>(
    firstOpen === undefined ? null : { kind: 'ZONE', zoneId: firstOpen.zoneId }
  );
  const [customEntry, setCustomEntry] = useState('');
  const [stop, setStop] = useState<StopSelection>(opening.selection);
  const [customStop, setCustomStop] = useState(opening.custom);
  const [equity, setEquity] = useState(modal.equity);
  const [riskPct, setRiskPct] = useState(modal.risk.preset);
  const [rrr, setRrr] = useState(modal.rrr.preset);
  const [finished, setFinished] = useState(false);
  const [reload, setReload] = useState(0);

  const pill =
    entry !== null && entry.kind === 'ZONE'
      ? modal.pills.find((candidate) => candidate.zoneId === entry.zoneId)
      : undefined;
  const choices = pill === undefined ? null : pill.stop;
  const entryText =
    entry === null ? '' : pill !== undefined ? pill.price : customEntry;
  const stopText = stopDistanceFor(stop, choices, customStop);
  const zonePrices = useMemo(
    () => modal.pills.map((candidate) => candidate.price),
    [modal.pills]
  );

  // -- picking a pill, a stop, an entry of one's own ---------------------------------
  const selectZone = (zoneId: string): void => {
    const next = modal.pills.find((candidate) => candidate.zoneId === zoneId);
    if (next === undefined) return;
    const start = initialStop(next.stop);
    setEntry({ kind: 'ZONE', zoneId });
    setStop(start.selection);
    setCustomStop(start.custom);
  };
  const selectCustomEntry = (): void => {
    setEntry({ kind: 'CUSTOM' });
    // the options belong to a zone's entry: keep the distance the trader had, as a custom stop
    setStop({ kind: 'CUSTOM' });
    if (customStop.trim() === '') setCustomStop(stopText);
    if (customEntry.trim() === '') setCustomEntry(entryText);
  };
  const pickStop = (selection: StopSelection): void => {
    if (selection.kind === 'CUSTOM' && customStop.trim() === '') {
      setCustomStop(stopText);
    }
    setStop(selection);
  };

  // -- what the browser can say at once (the validator's own codes) ----------------------
  const code = {
    entry:
      entry === null
        ? null
        : entry.kind === 'CUSTOM'
          ? precheckCustomEntry(customEntry, modal.custom.entry, zonePrices)
          : null,
    equity: precheckEquity(equity),
    risk: precheckRisk(riskPct, modal.risk.max),
    stop: precheckStop(stopText, modal.custom.stopMinDistance, {
      side: modal.side,
      entry: entryText === '' ? null : entryText,
    }),
    rrr: precheckRrr(rrr, {
      min: modal.rrr.min,
      max: modal.rrr.max,
      counterTrend: modal.counterTrend,
    }),
  };
  // an empty field waits for the trader; only something typed is called wrong
  const shown = (field: string, value: string): string | null =>
    value.trim() === '' ? null : field;
  const entryIssue =
    entry !== null && entry.kind === 'CUSTOM' && customEntry.trim() !== ''
      ? code.entry
      : null;
  const equityIssue = code.equity === null ? null : shown(code.equity, equity);
  const riskIssue = code.risk === null ? null : shown(code.risk, riskPct);
  const stopIssue =
    code.stop === null
      ? null
      : stop.kind === 'CUSTOM'
        ? shown(code.stop, stopText)
        : null;
  const rrrIssue = code.rrr === null ? null : shown(code.rrr, rrr);
  const message = (issue: string | null): string | null =>
    issue === null ? null : say(describeCheckCode(issue, limits));

  // -- sizing: ask the server for every set of figures that stands still -----------------
  const request: SetupRequest = useMemo(
    () => ({
      cycleSlot,
      side: modal.side,
      ...(entry !== null && entry.kind === 'ZONE'
        ? { zoneId: entry.zoneId }
        : {}),
      entry: entryText,
      equity,
      riskPct,
      stopDistance: stopText,
      rrr,
      language,
    }),
    [
      cycleSlot,
      modal.side,
      entry,
      entryText,
      equity,
      riskPct,
      stopText,
      rrr,
      language,
    ]
  );
  const key = JSON.stringify(request);
  const [size, setSize] = useState<SizeState>({
    status: 'loading',
    answer: null,
    key: null,
  });
  const turn = useRef(0);

  useEffect(() => {
    const mine = ++turn.current;
    setSize((previous) => ({
      status: 'loading',
      answer: previous.answer,
      key: previous.key,
    }));
    const timer = setTimeout(() => {
      void api.size(request).then((outcome) => {
        // an answer for figures the trader has since changed is of no use
        if (turn.current !== mine) return;
        setSize((previous) =>
          outcome.ok
            ? { status: 'ready', answer: outcome.answer, key }
            : {
                status: 'error',
                answer: previous.answer,
                key: previous.key,
                code: outcome.code,
              }
        );
      });
    }, debounceMs);
    return () => clearTimeout(timer);
    // `key` carries every figure of `request`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, api, debounceMs, reload]);

  const answer = size.answer;
  const fresh = size.status === 'ready' && size.key === key;
  const doc = useMemo(
    () =>
      answer === null
        ? null
        : buildReport2({
            setup: answer.setup,
            badge: answer.badge,
            offer: answer.offer,
          }),
    [answer]
  );

  // -- the notices of the offer ----------------------------------------------------------
  const notices: Described[] = [];
  for (const notice of modal.notices) {
    const described = describeNotice(notice.code, {
      dataAsOfSlot: dataAsOf,
      newSlot: modal.refresh === null ? null : modal.refresh.newSlot,
      cap: modal.counterTrend ? modal.rrr.max : null,
    });
    if (described !== null) notices.push(described);
  }

  // -- consent -----------------------------------------------------------------------
  const submit = async (
    action: ConsentAction,
    submissionId: string
  ): Promise<ConsentOutcome> => {
    if (answer === null || !fresh) {
      return { ok: false, code: 'SETUP_CHANGED', retryable: false };
    }
    const outcome = await api.consent({
      ...request,
      action,
      submissionId,
      shownSetupSha256: answer.setupSha256,
    });
    if (outcome.ok) {
      if (action !== 'MODIFY') setFinished(true);
      onRecorded?.({
        action,
        duplicate: outcome.duplicate,
        recordedAt: outcome.recordedAt,
        setup: answer.setup,
        setupSha256: answer.setupSha256,
      });
    } else if (outcome.code === 'SETUP_CHANGED') {
      // the picture moved under the trader: size it again and show the new one
      setReload((count) => count + 1);
    }
    return outcome;
  };

  // -- the help for a lot below the minimum ---------------------------------------------
  const applyHelp = (action: UnderflowActionDoc): void => {
    if (action.kind === 'RAISE_RISK') {
      setRiskPct(action.riskPct);
      return;
    }
    const wanted = readWire(action.stopDistance);
    const option =
      choices === null
        ? undefined
        : choices.structural.find((candidate) =>
            readWire(candidate.stopDistance).eq(wanted)
          );
    if (option === undefined) {
      setStop({ kind: 'CUSTOM' });
      setCustomStop(action.stopDistance);
    } else {
      setStop({ kind: 'OPTION', stopPrice: option.stopPrice });
    }
  };

  // -- what the fields say beside them ------------------------------------------------
  const risk = parseTyped(riskPct);
  const overridden =
    modal.risk.halfRisk &&
    risk.state === 'OK' &&
    risk.value.gt(readWire(modal.risk.preset)) &&
    risk.value.lte(readWire(modal.risk.max));

  const riskNotes: string[] = [
    tr('report2.risk.max', { max: fig(percent(modal.risk.max)) }),
  ];
  if (modal.risk.halfRisk) {
    riskNotes.push(
      tr('report2.risk.half', {
        preset: fig(percent(modal.risk.preset)),
        max: fig(percent(modal.risk.max)),
      })
    );
    if (modal.risk.reasons.length > 0) {
      riskNotes.push(
        tr('report2.risk.reasons', { reasons: modal.risk.reasons.join(', ') })
      );
    }
  }
  if (overridden) riskNotes.push(tr('report2.risk.override'));

  const rrrNotes: string[] = [
    tr('report2.rrr.range', {
      min: fig(ratio(modal.rrr.min)),
      max: fig(ratio(modal.rrr.max)),
    }),
  ];
  if (modal.counterTrend) {
    rrrNotes.push(
      tr('report2.rrr.counter_cap', { max: fig(ratio(modal.rrr.max)) })
    );
  }
  if (modal.rrr.capped) rrrNotes.push(tr('report2.rrr.lowered'));

  // message keys already said beside a field: the summary below does not repeat them
  const sayingNow = new Set<string>();
  for (const issue of [
    entryIssue,
    equityIssue,
    riskIssue,
    stopIssue,
    rrrIssue,
  ]) {
    if (issue !== null) sayingNow.add(describeCheckCode(issue, limits).key);
  }

  const long = modal.direction === 'LONG';
  const Arrow = long ? TrendingUp : TrendingDown;
  const sizing = size.status === 'loading';

  return (
    <div
      dir={dir}
      className="min-w-0 space-y-5"
      data-testid="report2-modal-form"
      data-sizing={sizing ? 'true' : 'false'}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          data-testid="report2-direction"
          data-direction={modal.direction}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold',
            long
              ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
              : 'bg-red-500/15 text-red-800 dark:text-red-300'
          )}
        >
          <Arrow className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">{tr('report2.direction.label')}: </span>
          {tr(long ? 'report2.direction.long' : 'report2.direction.short')}
        </span>
        {modal.counterTrend ? (
          <span className="rounded-full border border-amber-500/60 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">
            {tr('report2.setup.counter_trend')}
          </span>
        ) : null}
        <span className="text-xs text-muted-foreground">
          {tr('report2.direction.note')}
        </span>
      </div>

      <OfferNotices notices={notices} onRefresh={onRefresh} />

      <EntryPills
        pills={modal.pills}
        selection={entry}
        onSelectZone={selectZone}
        onSelectCustom={selectCustomEntry}
        customValue={customEntry}
        onCustomChange={setCustomEntry}
        customIssue={entryIssue}
        bounds={modal.custom.entry}
        limits={limits}
        disabled={finished}
      />

      <StopOptions
        choices={choices}
        selection={stop}
        onSelect={pickStop}
        customValue={customStop}
        onCustomChange={setCustomStop}
        customIssue={stopIssue}
        limits={limits}
        minDistance={modal.custom.stopMinDistance}
        disabled={finished}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <NumberField
          testId="report2-equity"
          label={tr('report2.equity.label')}
          value={equity}
          onChange={setEquity}
          issue={message(equityIssue)}
          notes={[tr('report2.equity.note')]}
          disabled={finished}
        />
        <NumberField
          testId="report2-risk"
          label={tr('report2.risk.label')}
          value={riskPct}
          onChange={setRiskPct}
          issue={message(riskIssue)}
          notes={riskNotes}
          disabled={finished}
        />
        <NumberField
          testId="report2-rrr"
          label={tr('report2.rrr.label')}
          value={rrr}
          onChange={setRrr}
          issue={message(rrrIssue)}
          notes={rrrNotes}
          disabled={finished}
        />
      </div>

      <div
        aria-live="polite"
        aria-busy={sizing}
        data-testid="report2-results"
        className={cn('space-y-4', !fresh && answer !== null && 'opacity-60')}
      >
        {size.status === 'error' && answer === null ? (
          <Callout tone="danger" role="alert">
            <p>{tr('report2.modal.sizing_failed')}</p>
            <p className="mt-1 text-xs">{say(describeApiError(size.code))}</p>
          </Callout>
        ) : null}
        {answer === null && size.status === 'loading' ? (
          <p className="text-sm text-muted-foreground">
            {tr('report2.modal.loading')}
          </p>
        ) : null}
        {doc === null || answer === null ? null : (
          <>
            {doc.offerReason === null ? null : (
              <NotOfferedNotice reason={doc.offerReason} />
            )}
            <ChecksList
              checks={doc.checks}
              mode="failures"
              hideKeys={sayingNow}
            />
            {doc.underflow === null ? null : (
              <UnderflowHelp
                help={doc.underflow}
                onApply={applyHelp}
                disabled={finished}
              />
            )}
            {doc.risk === null ? null : <RiskPair risk={doc.risk} />}
            <ScenarioTable scenarios={doc.scenarios} omitted={doc.omitted} />
            <RoomAndBadge room={doc.room} badge={doc.badge} />
            <ReleaseWarnings warnings={doc.warnings} />
          </>
        )}
      </div>

      <ConsentBar
        setupSha256={answer === null ? null : answer.setupSha256}
        canAccept={fresh && answer !== null && answer.setup.ok}
        canRecord={fresh && answer !== null}
        finished={finished}
        onSubmit={submit}
        makeId={makeId}
      />

      <CompulsoryNotices />
    </div>
  );
}

// ---------------------------------------------------------------------------
// The dialog
// ---------------------------------------------------------------------------

export interface TradeSetupModalProps extends TradeSetupFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TradeSetupModal({
  open,
  onOpenChange,
  ...form
}: TradeSetupModalProps): ReactElement {
  const { tr, dir } = useReport2();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir={dir}
        className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-3xl gap-4 overflow-y-auto p-4 sm:p-6"
      >
        <DialogHeader className="text-start">
          <DialogTitle>
            {tr('report2.title')}
            <span className="ms-2 text-sm font-normal text-muted-foreground">
              {tr('report2.subtitle')}
            </span>
          </DialogTitle>
          <DialogDescription>
            {tr('report2.modal.description')}
          </DialogDescription>
        </DialogHeader>
        <TradeSetupForm {...form} />
      </DialogContent>
    </Dialog>
  );
}
