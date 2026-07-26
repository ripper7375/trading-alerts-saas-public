/**
 * Wise Transfer State Mapper (Session 4A-W5, File 1/8)
 *
 * Maps a Wise `data.current_state` string to internal transition signals,
 * per `01-part-19.5-wise-disbursement-architecture-design.md` §5.2 — the
 * table itself is a frozen invariant ("changing any row requires a
 * Deviation with written justification"), so this file follows the real
 * table, not this session's order text (see the order's own Deviations for
 * the divergences that were corrected: `bounced_back` does not get its own
 * terminal state, `cancelled`/`charged_back` can revert a paid commission,
 * `incoming_payment_initiated` was missing).
 *
 * Deliberately pure — no logging, no DB access, no side effects — so the
 * full §5.2 table can be asserted with a single enumeration test. The
 * caller (`wise-transfer-state.reducer.ts`) is responsible for acting on
 * `alert`/`skippedReason`.
 */

import { Injectable } from '@nestjs/common';
import type { DisbursementTransactionStatus } from '@prisma/client';

import type { WiseTransferCurrentState } from '../wise.types';

export type WiseCommissionAction = 'NONE' | 'MARK_PAID' | 'REVERT_IF_PAID';

export interface WiseStateMapping {
  /** `null` means "leave `DisbursementTransaction.status` unchanged" —
   * used only for unrecognised states, where we don't know what it should
   * become (design §5.1: fail visible, not fatal). */
  disbursementStatus: DisbursementTransactionStatus | null;
  commissionAction: WiseCommissionAction;
  setHasActiveIssues: boolean;
  alert: boolean;
  skippedReason?: 'unknown-state';
}

type KnownMapping = Omit<WiseStateMapping, 'skippedReason'>;

// §5.2's table, verbatim. Row order matches the design doc for easy
// side-by-side review.
const KNOWN_STATE_MAP: Record<string, KnownMapping> = {
  incoming_payment_waiting: {
    disbursementStatus: 'PENDING',
    commissionAction: 'NONE',
    setHasActiveIssues: false,
    alert: false,
  },
  incoming_payment_initiated: {
    disbursementStatus: 'PROCESSING',
    commissionAction: 'NONE',
    setHasActiveIssues: false,
    alert: false,
  },
  processing: {
    disbursementStatus: 'PROCESSING',
    commissionAction: 'NONE',
    setHasActiveIssues: false,
    alert: false,
  },
  funds_converted: {
    disbursementStatus: 'PROCESSING',
    commissionAction: 'NONE',
    setHasActiveIssues: false,
    alert: false,
  },
  outgoing_payment_sent: {
    disbursementStatus: 'COMPLETED',
    commissionAction: 'MARK_PAID',
    setHasActiveIssues: false,
    alert: false,
  },
  // Wise says it may still deliver, or may go to funds_refunded. Reverting
  // here would flap the affiliate's balance — raise an admin alert instead
  // and leave the commission PAID (§5.2).
  bounced_back: {
    disbursementStatus: 'PROCESSING',
    commissionAction: 'NONE',
    setHasActiveIssues: true,
    alert: true,
  },
  funds_refunded: {
    disbursementStatus: 'FAILED',
    commissionAction: 'REVERT_IF_PAID',
    setHasActiveIssues: false,
    alert: false,
  },
  // Can follow ANY state (§5.2's own note) — reverts if it was PAID.
  charged_back: {
    disbursementStatus: 'FAILED',
    commissionAction: 'REVERT_IF_PAID',
    setHasActiveIssues: false,
    alert: false,
  },
  // Usually "never funded within 14 days" — but can also follow a paid
  // transfer, so it shares the same conditional-revert action.
  cancelled: {
    disbursementStatus: 'CANCELLED',
    commissionAction: 'REVERT_IF_PAID',
    setHasActiveIssues: false,
    alert: false,
  },
  // Wise's own literal `unknown` state string — distinct from a state we
  // simply don't recognise (the default branch below). Alert + manual
  // review; never auto-resolve (§5.2).
  unknown: {
    disbursementStatus: 'PROCESSING',
    commissionAction: 'NONE',
    setHasActiveIssues: false,
    alert: true,
  },
};

@Injectable()
export class WiseStateMapper {
  mapTransferState(currentState: WiseTransferCurrentState): WiseStateMapping {
    const known = KNOWN_STATE_MAP[currentState];
    if (known) {
      return { ...known };
    }

    return {
      disbursementStatus: null,
      commissionAction: 'NONE',
      setHasActiveIssues: false,
      alert: true,
      skippedReason: 'unknown-state',
    };
  }
}
