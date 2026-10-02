import { CycleSample } from '../../src/cycle/measure-cycles';

/**
 * A fixture for the measurement kit: twelve market_cycles rows with numbers
 * chosen so that every figure in the report can be worked out by hand. The table
 * below is the whole dataset; measure-cycles.spec.ts states each expected value
 * with its working.
 *
 *   k  state       status   att  recv  s2r  M5 age  M15 age  export  valid  RETUNING  terminal
 *   0  READY       FRESH    1    59    60   0       -        -1      20     -         MT5-A
 *   1  READY       FRESH    1    60    62   0       0        2       22     -         MT5-A
 *   2  READY       FRESH    1    63    64   0       -        3       24     -         MT5-A
 *   3  READY       FRESH    1    64    66   0       -        3       26     yes       MT5-B
 *   4  READY       FRESH    1    67    68   0       0        3       28     yes       MT5-B
 *   5  READY       FRESH    1    68    70   0       -        -1      30     yes       MT5-B
 *   6  READY       FRESH    1    71    72   0       -        4       32     -         MT5-B
 *   7  READY       FRESH    1    72    74   300     300      4       34     -         MT5-B
 *   8  READY       FRESH    2    75    76   300     -        5       36     -         MT5-B
 *   9  READY       DELAYED  1    190   200  300     -        5       38     -         MT5-B
 *  10  INCOMPLETE  -        1    130   -    0       0        -1      40     -         MT5-B
 *  11  PENDING     -        1    61    -    0       -        6       42     yes       MT5-B
 *
 *   slot     = FIRST_SLOT + 300 * k
 *   recv     = manifest_received_at - slot        (gateway clock)
 *   s2r      = ready_at - slot                    (gateway clock; READY rows)
 *   M5 age   = slot - m5_newest_bar_ts            (M15 age likewise, on refresh slots k = 1, 4, 7, 10)
 *   export   = m5_export_at - slot                (VPS clock)
 *   valid    = collector_validated_at - slot      (VPS clock)
 */
export const FIRST_SLOT = 1789764900;

type Spec = {
  state: string;
  status: string | null;
  attempts: number;
  recv: number;
  s2r: number | null;
  age5: number;
  age15: number | null;
  exp: number;
  valid: number;
  retuning: boolean;
  terminal: string;
};

// The table is meant to be read as a table, so Prettier leaves it alone.
// prettier-ignore
const TABLE: Spec[] = [
  { state: 'READY', status: 'FRESH', attempts: 1, recv: 59, s2r: 60, age5: 0, age15: null, exp: -1, valid: 20, retuning: false, terminal: 'MT5-A' },
  { state: 'READY', status: 'FRESH', attempts: 1, recv: 60, s2r: 62, age5: 0, age15: 0, exp: 2, valid: 22, retuning: false, terminal: 'MT5-A' },
  { state: 'READY', status: 'FRESH', attempts: 1, recv: 63, s2r: 64, age5: 0, age15: null, exp: 3, valid: 24, retuning: false, terminal: 'MT5-A' },
  { state: 'READY', status: 'FRESH', attempts: 1, recv: 64, s2r: 66, age5: 0, age15: null, exp: 3, valid: 26, retuning: true, terminal: 'MT5-B' },
  { state: 'READY', status: 'FRESH', attempts: 1, recv: 67, s2r: 68, age5: 0, age15: 0, exp: 3, valid: 28, retuning: true, terminal: 'MT5-B' },
  { state: 'READY', status: 'FRESH', attempts: 1, recv: 68, s2r: 70, age5: 0, age15: null, exp: -1, valid: 30, retuning: true, terminal: 'MT5-B' },
  { state: 'READY', status: 'FRESH', attempts: 1, recv: 71, s2r: 72, age5: 0, age15: null, exp: 4, valid: 32, retuning: false, terminal: 'MT5-B' },
  { state: 'READY', status: 'FRESH', attempts: 1, recv: 72, s2r: 74, age5: 300, age15: 300, exp: 4, valid: 34, retuning: false, terminal: 'MT5-B' },
  { state: 'READY', status: 'FRESH', attempts: 2, recv: 75, s2r: 76, age5: 300, age15: null, exp: 5, valid: 36, retuning: false, terminal: 'MT5-B' },
  { state: 'READY', status: 'DELAYED', attempts: 1, recv: 190, s2r: 200, age5: 300, age15: null, exp: 5, valid: 38, retuning: false, terminal: 'MT5-B' },
  { state: 'INCOMPLETE', status: null, attempts: 1, recv: 130, s2r: null, age5: 0, age15: 0, exp: -1, valid: 40, retuning: false, terminal: 'MT5-B' },
  { state: 'PENDING', status: null, attempts: 1, recv: 61, s2r: null, age5: 0, age15: null, exp: 6, valid: 42, retuning: true, terminal: 'MT5-B' },
];

/** The twelve rows, oldest slot first, as `market_cycles` would return them. */
export function sampleRows(): CycleSample[] {
  return TABLE.map((t, k) => {
    const slot = FIRST_SLOT + 300 * k;
    return {
      symbol: 'XAUUSD',
      slot,
      state: t.state,
      data_status: t.status,
      attempts: t.attempts,
      manifest_received_at: slot + t.recv,
      ready_at: t.s2r === null ? null : slot + t.s2r,
      collector_started_at: slot + t.valid - 10,
      collector_validated_at: slot + t.valid,
      m5_newest_bar_ts: slot - t.age5,
      m15_newest_bar_ts: t.age15 === null ? null : slot - t.age15,
      m5_export_at: slot + t.exp,
      m15_export_at: t.age15 === null ? null : slot + t.exp,
      retuning: t.retuning,
      backlog_rows: 5990,
      repush_rows_unsent: 5700,
      terminal_id: t.terminal,
    };
  });
}
