'use client';

/**
 * "Open trade setup" (build step 7 part 8; plan part 8: "opens the existing Report 2 modal with the
 * same cycle and zone ids when the gate allows it"). The button of a card calls `open(action)`; this
 * asks Engine 4 whether Report 2 is OFFERED for the cycle of the reply (`POST /api/engine4/offer`, the
 * server runs the offer check on its own data), and then:
 *
 *  - offered: the Trade Setup modal of build step 5 opens, pinned to the reply's cycle, with the
 *    pills of the zones the reply named (all of them when none of the named zones is open);
 *  - not offered: the reason, in the reader's language, from Report 2's own messages;
 *  - the route is off (`ENGINE4_REPORT2_ENABLED` is not on, a 404 for everybody), the trader is not
 *    allowed, or the connection failed: one sentence that says it could not be opened.
 *
 * The chat does not size anything and does not decide whether a setup is offered. The model never
 * computes a position: this only hands the cycle and the zone ids to the modal that does.
 *
 * @module components/chat/trade-setup-launcher
 */

import { X } from 'lucide-react';
import { useCallback, useRef, useState, type ReactElement } from 'react';

import { createHttpApi } from '@/components/report2/api-client';
import { Callout, NotOfferedNotice } from '@/components/report2/notices';
import { TradeSetupModal } from '@/components/report2/trade-setup-modal';
import { useLocale } from '@/lib/context/locale-context';
import { describeNotOffered } from '@/lib/engine4/templates/messages';
import type {
  WireOfferAnswer,
  WireOfferedModal,
} from '@/lib/engine4/templates/wire';

import { CHAT_ROUTES } from './limits';
import type { TradeSetupAction } from './types';
import { useChatWords } from './use-chat-words';

type Fetch = typeof fetch;

type Phase =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'not_offered'; answer: WireOfferAnswer }
  | {
      status: 'offered';
      answer: WireOfferAnswer;
      modal: WireOfferedModal;
      action: TradeSetupAction;
    };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function isOfferAnswer(value: unknown): value is WireOfferAnswer {
  return (
    isRecord(value) &&
    value['success'] === true &&
    isRecord(value['modal']) &&
    isRecord(value['offer']) &&
    typeof value['modal']['status'] === 'string'
  );
}

/** The pills of the zones the reply named; every open zone when none of them is on the modal. */
export function narrowModal(
  modal: WireOfferedModal,
  zoneIds: readonly string[]
): WireOfferedModal {
  const named = modal.pills.filter((pill) => zoneIds.includes(pill.zoneId));
  return named.length === 0 ? modal : { ...modal, pills: named };
}

export interface TradeSetupLauncher {
  /** Ask whether the setup is offered, and open the modal or say why not. */
  open: (action: TradeSetupAction) => void;
  /** What to render beside the panel: the modal, or the notice; null while nothing is open. */
  element: ReactElement | null;
}

export function useTradeSetupLauncher(fetchImpl?: Fetch): TradeSetupLauncher {
  const [phase, setPhase] = useState<Phase>({ status: 'idle' });
  const busy = useRef(false);
  const last = useRef<TradeSetupAction | null>(null);

  const open = useCallback(
    (action: TradeSetupAction): void => {
      if (busy.current) return;
      busy.current = true;
      last.current = action;
      setPhase({ status: 'loading' });
      const seconds = Math.floor(Date.parse(action.cycle_slot) / 1000);
      const call: Fetch = fetchImpl ?? ((...args) => fetch(...args));
      void (async (): Promise<void> => {
        try {
          if (!Number.isFinite(seconds)) {
            setPhase({ status: 'failed' });
            return;
          }
          const response = await call(CHAT_ROUTES.offer, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ cycleSlot: String(seconds) }),
          });
          const body: unknown = await response.json().catch(() => null);
          if (!response.ok || !isOfferAnswer(body)) {
            setPhase({ status: 'failed' });
          } else if (body.modal.status === 'NOT_OFFERED') {
            setPhase({ status: 'not_offered', answer: body });
          } else {
            setPhase({
              status: 'offered',
              answer: body,
              modal: narrowModal(body.modal, action.zone_ids),
              action,
            });
          }
        } catch {
          setPhase({ status: 'failed' });
        } finally {
          busy.current = false;
        }
      })();
    },
    [fetchImpl]
  );

  const close = useCallback((): void => setPhase({ status: 'idle' }), []);
  const refresh = useCallback((): void => {
    if (last.current !== null) open(last.current);
  }, [open]);

  const element =
    phase.status === 'idle' || phase.status === 'loading' ? null : (
      <TradeSetupHost
        phase={phase}
        fetchImpl={fetchImpl}
        onClose={close}
        onRefresh={refresh}
      />
    );
  return { open, element };
}

function TradeSetupHost({
  phase,
  fetchImpl,
  onClose,
  onRefresh,
}: {
  phase: Exclude<Phase, { status: 'idle' } | { status: 'loading' }>;
  fetchImpl: Fetch | undefined;
  onClose: () => void;
  onRefresh: () => void;
}): ReactElement {
  const { tr } = useChatWords();
  const { t } = useLocale();
  const closeLabel = t('settings.security.close', 'Close');

  if (phase.status === 'offered') {
    return (
      <TradeSetupModal
        open
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        modal={phase.modal}
        cycleSlot={phase.answer.cycleSlot ?? '0'}
        api={createHttpApi(fetchImpl)}
        dataAsOf={phase.answer.offer.dataAsOfSlot}
        onRefresh={onRefresh}
      />
    );
  }

  const answer = phase.status === 'not_offered' ? phase.answer : null;
  const modal =
    answer !== null && answer.modal.status === 'NOT_OFFERED'
      ? answer.modal
      : null;
  const reason =
    answer !== null && modal !== null && modal.reason !== null
      ? describeNotOffered(modal.reason.code, {
          dataAsOfSlot: answer.offer.dataAsOfSlot ?? null,
          block:
            answer.blackout.blocks[0] === undefined
              ? null
              : {
                  name: answer.blackout.blocks[0].eventName,
                  time: answer.blackout.blocks[0].eventTime,
                  end:
                    answer.blackout.windowEndsAt ??
                    answer.blackout.blocks[0].windowEnd,
                },
        })
      : null;

  return (
    <div
      data-testid="trade-setup-notice"
      className="relative shrink-0 border-t border-border px-3 py-2"
    >
      <div className="pe-7">
        {phase.status === 'not_offered' ? (
          <NotOfferedNotice reason={reason} />
        ) : (
          <Callout tone="danger" role="alert">
            <p>{tr('chat.action.failed')}</p>
          </Callout>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        title={closeLabel}
        className="absolute end-4 top-3.5 rounded-sm p-0.5 opacity-70 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
