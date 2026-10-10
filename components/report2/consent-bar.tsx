'use client';

/**
 * "Accept setup", "Modify" and "Decline" (architecture 6.3 steps 7 and 8, 6.11,
 * ADR-069).
 *
 * Every press is one SUBMIT with one `submissionId`, and the server writes at most
 * one consent record per id. This bar keeps its half of that promise:
 *
 *  - a press is refused while another is in flight, checked on a ref that is set in
 *    the same tick as the click, so two clicks in one frame (before React has
 *    re-rendered the disabled button) still send ONE request;
 *  - the id belongs to the pair (action, the hash of the setup shown), and an id is
 *    kept for as long as its outcome is unknown (the connection dropped, the server
 *    failed): a second press of the same button sends the SAME id, even if the
 *    trader pressed another button in between, so a record that did get written is
 *    returned, not written twice. A definitive answer ends the id; another setup is
 *    another pair and gets its own;
 *  - the server is told the hash of the setup the trader was shown, and refuses to
 *    record a setup that is not that one.
 *
 * Accept is possible only for a setup that passed all eight checks and is the one on
 * screen. Modify and Decline record what was shown even when it did not pass.
 *
 * @module components/report2/consent-bar
 */

import { CheckCircle2, Loader2 } from 'lucide-react';
import { useRef, useState, type ReactElement } from 'react';

import { describeApiError } from '@/lib/engine4/templates/messages';
import type { Report2Key } from '@/lib/engine4/templates/text';
import type { ConsentAction } from '@/lib/engine4/templates/wire';
import { cn } from '@/lib/utils';

import { Callout } from './notices';
import { newSubmissionId } from './submission';
import { useReport2 } from './use-report2';

export type ConsentOutcome =
  | {
      ok: true;
      duplicate: boolean;
      action: ConsentAction;
      /** ISO 8601 time the record was written */
      recordedAt: string;
    }
  | {
      ok: false;
      /** an `Engine4ErrorCode`, or NETWORK when no answer came */
      code: string;
      /** the outcome is unknown: pressing again sends the same submission id */
      retryable: boolean;
    };

const DONE_KEYS: Record<ConsentAction, Report2Key> = {
  ACCEPT: 'report2.consent.accepted',
  MODIFY: 'report2.consent.modified',
  DECLINE: 'report2.consent.declined',
};

type Status =
  | { kind: 'recorded'; outcome: Extract<ConsentOutcome, { ok: true }> }
  | { kind: 'error'; code: string; retryable: boolean };

export function ConsentBar({
  setupSha256,
  canAccept,
  canRecord,
  finished,
  onSubmit,
  makeId = newSubmissionId,
}: {
  /** the hash of the setup on screen; null until one was sized */
  setupSha256: string | null;
  /** Accept is possible: the setup on screen passed all eight checks */
  canAccept: boolean;
  /** Modify and Decline are possible: a setup is on screen and the figures have settled */
  canRecord: boolean;
  /** Accept or Decline was recorded: nothing more to press */
  finished?: boolean;
  onSubmit: (
    action: ConsentAction,
    submissionId: string
  ) => Promise<ConsentOutcome>;
  /** a new submission id (a test passes its own) */
  makeId?: () => string;
}): ReactElement {
  const { tr, fig, say } = useReport2();
  const [pending, setPending] = useState<ConsentAction | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const inFlight = useRef(false);
  /** the ids whose outcome is not known yet, by (action, setup hash) */
  const unresolved = useRef(new Map<string, string>());

  const idFor = (key: string): string => {
    const known = unresolved.current.get(key);
    if (known !== undefined) return known;
    const fresh = makeId();
    unresolved.current.set(key, fresh);
    return fresh;
  };

  const press = async (action: ConsentAction): Promise<void> => {
    if (inFlight.current || setupSha256 === null) return;
    inFlight.current = true;
    setPending(action);
    setStatus(null);
    const key = `${action}:${setupSha256}`;
    try {
      const outcome = await onSubmit(action, idFor(key));
      if (outcome.ok) {
        unresolved.current.delete(key);
        setStatus({ kind: 'recorded', outcome });
      } else {
        if (!outcome.retryable) unresolved.current.delete(key);
        setStatus({
          kind: 'error',
          code: outcome.code,
          retryable: outcome.retryable,
        });
      }
    } catch {
      // the caller should answer with an outcome; if it threw, nothing is known
      setStatus({ kind: 'error', code: 'NETWORK', retryable: true });
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  };

  const busy = pending !== null;
  const blocked = finished === true;
  const acceptOff = busy || blocked || !canAccept || setupSha256 === null;
  const recordOff = busy || blocked || !canRecord || setupSha256 === null;

  const button = (
    action: ConsentAction,
    labelKey: Report2Key,
    off: boolean,
    style: string
  ): ReactElement => (
    <button
      type="button"
      data-action={action}
      disabled={off}
      aria-busy={pending === action}
      onClick={() => void press(action)}
      className={cn(
        'inline-flex h-10 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 sm:w-auto',
        style
      )}
    >
      {pending === action ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : null}
      {tr(labelKey)}
    </button>
  );

  return (
    <div className="space-y-3" data-testid="report2-consent">
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
        {button(
          'DECLINE',
          'report2.consent.decline',
          recordOff,
          'border border-input bg-background hover:bg-accent'
        )}
        {button(
          'MODIFY',
          'report2.consent.modify',
          recordOff,
          'border border-input bg-background hover:bg-accent'
        )}
        {button(
          'ACCEPT',
          'report2.consent.accept',
          acceptOff,
          'bg-primary text-primary-foreground hover:bg-primary/90'
        )}
      </div>

      <div aria-live="polite">
        {pending !== null ? (
          <p className="text-sm text-muted-foreground">
            {tr('report2.consent.saving')}
          </p>
        ) : null}
        {status !== null && status.kind === 'recorded' ? (
          <Callout tone="info" role="status">
            <p className="flex items-start gap-1.5 font-medium">
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>{tr(DONE_KEYS[status.outcome.action])}</span>
            </p>
            {status.outcome.duplicate ? (
              <p className="mt-1 text-xs">{tr('report2.consent.duplicate')}</p>
            ) : null}
            <p className="mt-1 text-xs">
              {tr('report2.consent.recorded_at', {
                time: fig({
                  kind: 'time',
                  text: String(
                    Math.floor(
                      new Date(status.outcome.recordedAt).getTime() / 1000
                    )
                  ),
                }),
              })}
            </p>
          </Callout>
        ) : null}
        {status !== null && status.kind === 'error' ? (
          <Callout tone="danger" role="alert">
            <p>{say(describeApiError(status.code))}</p>
            {status.retryable ? (
              <p className="mt-1 text-xs">{tr('report2.consent.retry')}</p>
            ) : null}
          </Callout>
        ) : null}
      </div>

      {status === null && !blocked && pending === null ? (
        <p className="text-xs text-muted-foreground">
          {setupSha256 === null
            ? tr('report2.consent.not_ready')
            : !canAccept && canRecord
              ? tr('report2.consent.blocked')
              : !canRecord
                ? tr('report2.consent.not_ready')
                : ''}
        </p>
      ) : null}
    </div>
  );
}
