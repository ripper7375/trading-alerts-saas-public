/**
 * The scenarios of the Report 2 development preview (build step 5, part 7).
 *
 * Each one is a STORED cycle (the real 18 Sep 20:55 reading, or one of the signed-off
 * golden scenarios of the Python worker) with a trader profile and, where the case
 * needs it, one thing the world did: the data went stale, a release is due, a newer
 * cycle changed the picture. They are descriptions only; `world.ts` runs the real
 * Engine 4 over them on the server. Plain data, so the page can list them.
 *
 * Development only: the route 404s in a production build.
 */

export interface Scenario {
  id: string;
  label: string;
  /** what to look at in it */
  note: string;
  /** the prefix of the golden scenario folder (`01-` is the real 18 Sep cycle) */
  golden: string;
  /** changes to the roomy test profile (equity $10,000, 1:5 leverage, 1.50% risk, $4 commission) */
  profile?: Record<string, string>;
  /** what the live feed says now */
  dataStatus?: 'FRESH' | 'DELAYED' | 'STALE';
  /** the newest cycle's price, instead of the cycle's own */
  price?: string;
  /** a release in the calendar */
  release?: 'CPI_IN_5_MIN' | 'RETAIL_SALES_IN_3_H';
  /** a newer cycle whose reading differs */
  newer?: boolean;
}

export const SCENARIOS: readonly Scenario[] = [
  {
    id: '18sep',
    label: '18 Sep 20:55: the stored rally (counter-trend, CAUTIONARY)',
    note: 'Z1 4,367.20 and Z2 4,350.16. Half risk is pre-set. NO badge, and the level that stops it is named: sr_1 4,369.57.',
    golden: '01-',
  },
  {
    id: '18sep-default',
    label: '18 Sep, the default profile ($5,000, 1:1.5, trend following)',
    note: 'The leverage limit, not the risk limit, sets the lot (0.01). Declared $37.50, actual $17.07. The style notice appears.',
    golden: '01-',
    profile: {
      style: 'TREND_FOLLOWING',
      maxLeverage: '1.5',
      equity: '5000',
    },
  },
  {
    id: '18sep-small',
    label: '18 Sep, $300 equity: a lot below the broker minimum',
    note: 'No lot is rounded up. The help stays inside the trader’s limits and states the equity needed as a fact.',
    golden: '01-',
    profile: { equity: '300' },
  },
  {
    id: 'short-badge',
    label: 'Golden 07: counter-trend SHORT with a spread (badge)',
    note: 'A SELL triggers on the ask: the chart level is a spread lower than the order price. CONSERVATIVE badge at RRR 1.75, none at 1.50.',
    golden: '07-',
  },
  {
    id: 'with-trend',
    label: 'Golden 04: with the trend, all sensors valid',
    note: 'No half-risk caution. The RRR ceiling is 3.50 here, not the 2.50 counter-trend cap.',
    golden: '04-',
  },
  {
    id: 'delayed',
    label: '18 Sep with a DELAYED feed',
    note: 'Offered, with the delay notice.',
    golden: '01-',
    dataStatus: 'DELAYED',
  },
  {
    id: 'invalidated',
    label: '18 Sep, price already past Z1’s invalidation',
    note: 'Z1 is drawn, marked “No longer valid” and cannot be picked; the modal opens on Z2.',
    golden: '01-',
    price: '4350.30',
  },
  {
    id: 'releases',
    label: '18 Sep with a retail-sales release in 3 hours',
    note: 'A warning, not a block: it is inside a Day Trader’s holding window.',
    golden: '01-',
    release: 'RETAIL_SALES_IN_3_H',
  },
  {
    id: 'refresh',
    label: '18 Sep, a newer cycle changed the picture',
    note: 'Offered with a “The picture changed” notice and a Refresh button.',
    golden: '01-',
    newer: true,
  },
  {
    id: 'stale',
    label: '18 Sep with the data STALE: not offered',
    note: 'No modal: the reason is shown, with the time the data stopped.',
    golden: '01-',
    dataStatus: 'STALE',
  },
  {
    id: 'blackout',
    label: '18 Sep with a CPI release in 5 minutes: not offered',
    note: 'The release is named and so is the time its window ends.',
    golden: '01-',
    release: 'CPI_IN_5_MIN',
  },
];

export function scenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((scenario) => scenario.id === id);
}
