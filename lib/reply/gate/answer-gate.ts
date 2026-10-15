/**
 * The answer gate (build step 7 part 5; architecture 5.3, ADR-051; plan decision D9, finding
 * S7-F17): what each data status allows, as DATA, and the verdict on one request.
 *
 * THE TABLE (5.3). One row per data status of the packet, never a branch in the code:
 *
 *   status          direction and zones        other questions          chart              Report 2
 *   FRESH           yes                        all                      if its cycle matches   allowed
 *   DELAYED         yes, the delay stated      all                      if its cycle matches   allowed, delay stated
 *   STALE           no: "data stopped at ..."  explain and general only never                 blocked
 *   MARKET_CLOSED   last session's, labelled   all                      if its cycle matches   blocked
 *   UNKNOWN         no                         explain and general only never                 blocked
 *
 * RETUNING (ADR-015) is a flag on the cycle, not a status: while it lasts the sensors read
 * CAUTIONARY and Report 2 opens with the half-risk pre-set (6.4), so it changes the Report 2
 * column of a FRESH or DELAYED row and nothing else.
 *
 * UNKNOWN has no row in 5.3. The gateway could not be asked (finding F16), so nobody knows whether
 * the data is fresh: it is treated as STALE for everything the table decides, and the reply is
 * stamped UNKNOWN so it does not claim to know when the data stopped.
 *
 * "Explain and general only" is `INTENTS_ALLOWED_ON_STALE` (decision D9): EXPLAIN, and NEWS (the
 * calendar has its own status). A refused request gets a fixed answer and NO model call (the
 * orchestrator's call-count tests hold that); `refusal` names the reason and the time the data
 * stopped (the cycle's slot, which the reply's stamp also carries).
 *
 * The chart is decided elsewhere (`read/chart.ts`, which reads storage); the gate only says
 * whether this status allows one (`chartAllowed`) and puts the chart's decision into the trace
 * (`gateTrace`). A status that never sends a chart overrides whatever the chart rule found.
 *
 * Pure: a function of facts the packet already carries.
 *
 * @module lib/reply/gate/answer-gate
 */

import type { DataStatus, PacketIntent } from '../contracts/intake';
import { INTENTS_ALLOWED_ON_STALE } from '../contracts/intent-shapes';
import type { FixedReason } from '../contracts/result';
import type { ChartDecision, TraceAnswerGate } from '../contracts/trace-fields';

export interface GateRowSpec {
  direction: TraceAnswerGate['direction'];
  otherQuestions: TraceAnswerGate['other_questions'];
  /** whether a chart may be sent at all on this status, when its cycle matches */
  chart: 'IF_CYCLE_MATCHES' | 'NEVER';
  report2: TraceAnswerGate['report2'];
}

export const GATE_TABLE: Readonly<Record<DataStatus, GateRowSpec>> = {
  FRESH: {
    direction: 'YES',
    otherQuestions: 'ALL',
    chart: 'IF_CYCLE_MATCHES',
    report2: 'ALLOWED',
  },
  DELAYED: {
    direction: 'DELAYED',
    otherQuestions: 'ALL',
    chart: 'IF_CYCLE_MATCHES',
    report2: 'ALLOWED_DELAY_STATED',
  },
  STALE: {
    direction: 'NO',
    otherQuestions: 'EXPLAIN_AND_GENERAL',
    chart: 'NEVER',
    report2: 'BLOCKED',
  },
  MARKET_CLOSED: {
    direction: 'LAST_SESSION',
    otherQuestions: 'ALL',
    chart: 'IF_CYCLE_MATCHES',
    report2: 'BLOCKED',
  },
  UNKNOWN: {
    direction: 'NO',
    otherQuestions: 'EXPLAIN_AND_GENERAL',
    chart: 'NEVER',
    report2: 'BLOCKED',
  },
};

/** Report 2's column while the sensors are being retuned and Report 2 is otherwise open (6.4). */
export const RETUNING_REPORT2: TraceAnswerGate['report2'] = 'HALF_RISK_PRESET';

/** The Report 2 columns that open the Trade Setup modal. */
const REPORT2_OPEN: readonly TraceAnswerGate['report2'][] = [
  'ALLOWED',
  'ALLOWED_DELAY_STATED',
  'HALF_RISK_PRESET',
];

export interface GateInput {
  intent: PacketIntent;
  dataStatus: DataStatus;
  retuning: boolean;
  /** the packet's cycle slot, `2026-09-18T20:55Z`; null when none could be read */
  cycleSlot: string | null;
}

/** Why a request is answered without a model. */
export interface GateRefusal {
  /** the fixed answer's reason: the data stopped, or the market is closed and Report 2 needs a live cycle */
  reason: Extract<FixedReason, 'DATA_STALE' | 'MARKET_CLOSED'>;
  /** the time the data stopped: the cycle's slot; null when no cycle is known */
  stoppedAt: string | null;
}

export interface GateDecision {
  status: DataStatus;
  retuning: boolean;
  row: GateRowSpec;
  /** the Report 2 column after the retuning flag */
  report2: TraceAnswerGate['report2'];
  /** this intent may be answered on this data */
  allowed: boolean;
  /** present exactly when `allowed` is false */
  refusal: GateRefusal | null;
  /**
   * This status allows a chart if its cycle matches. The labels a reply carries (the delay, the
   * last session, the retuning) are not decided here: they are the stamp's status and flag.
   */
  chartAllowed: boolean;
}

/** The row of a data status. A status the table does not know is UNKNOWN: it fails closed. */
export function rowOf(status: DataStatus): GateRowSpec {
  return Object.prototype.hasOwnProperty.call(GATE_TABLE, status)
    ? GATE_TABLE[status]
    : GATE_TABLE.UNKNOWN;
}

/** Does the Report 2 column open the modal? */
export function report2Open(column: TraceAnswerGate['report2']): boolean {
  return REPORT2_OPEN.includes(column);
}

/** Is this intent answered under the row's "other questions" column? */
function intentFitsRow(row: GateRowSpec, intent: PacketIntent): boolean {
  return row.otherQuestions === 'ALL'
    ? true
    : INTENTS_ALLOWED_ON_STALE.includes(intent);
}

/** The verdict on one request. */
export function evaluateAnswerGate(input: GateInput): GateDecision {
  const known = Object.prototype.hasOwnProperty.call(
    GATE_TABLE,
    input.dataStatus
  );
  const status: DataStatus = known ? input.dataStatus : 'UNKNOWN';
  const row = rowOf(status);
  const report2 =
    input.retuning && row.report2 !== 'BLOCKED'
      ? RETUNING_REPORT2
      : row.report2;

  let refusal: GateRefusal | null = null;
  if (!intentFitsRow(row, input.intent)) {
    refusal = { reason: 'DATA_STALE', stoppedAt: input.cycleSlot };
  } else if (input.intent === 'REPORT_2' && !report2Open(report2)) {
    // the only row that lets other questions through and keeps Report 2 shut is MARKET_CLOSED
    refusal = { reason: 'MARKET_CLOSED', stoppedAt: input.cycleSlot };
  }

  return {
    status,
    retuning: input.retuning,
    row,
    report2,
    allowed: refusal === null,
    refusal,
    chartAllowed: row.chart === 'IF_CYCLE_MATCHES',
  };
}

/**
 * The gate's group of the trace (`checks.answer_gate`). The chart column is the chart rule's
 * decision, except that a status that never sends a chart says `DATA_STATUS` whatever was found.
 */
export function gateTrace(
  decision: GateDecision,
  chart: ChartDecision | null
): TraceAnswerGate {
  return {
    direction: decision.row.direction,
    other_questions: decision.row.otherQuestions,
    chart: decision.chartAllowed ? (chart ?? 'NOT_CALLED_FOR') : 'DATA_STATUS',
    report2: decision.report2,
  };
}
