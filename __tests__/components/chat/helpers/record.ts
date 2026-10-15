/**
 * Recording the chat fixtures from the REAL route (build step 7 part 8).
 *
 * The panel's tests and its development preview do not play hand-written objects: they play what
 * `POST /api/chat/message` actually answers, recorded from the route layer (`runMessageRoute`) over the
 * orchestrator of part 7, with the gate, the intake path over a stored golden cycle, the answer gate,
 * the context assembler, the number and wording checks, the composer, the quota ledger and the stores
 * all running for real. Only the model (the fixture model, playing scripted replies), the clock, the
 * storage of the chart and the database are stand-ins, as in the orchestrator's own tests.
 *
 * `recordAll()` makes the exchanges; `__tests__/components/chat/fixtures.test.ts` writes them to
 * `app/dev/chat/recorded.json` when asked (`RECORD_CHAT_FIXTURES=1`) and otherwise holds the file to
 * what the route answers today, so a change in a contract or in the composer fails a test instead of
 * leaving the panel drawing a reply the server no longer makes.
 */

import { runMessageRoute } from '@/lib/reply/server/respond';
import { plantLiteral } from '@/lib/reply/gateway/fixture';
import type { FixtureScript } from '@/lib/reply/gateway/fixture';

import { echoResult } from '../../../lib/intake/helpers/ports';
import { modelReportFor } from '../../../lib/reply/report1/helpers/report1-fixtures';
import {
  USER,
  buildWorld,
  type ReplyWorld,
} from '../../../lib/reply/run/helpers/world';

/** One recorded answer of the message route. */
export type Exchange =
  | { kind: 'STREAM'; status: number; events: unknown[] }
  | { kind: 'JSON'; status: number; body: unknown };

export type Recorded = Record<string, Exchange>;

const uuid = (n: number): string =>
  `3f0c8a52-1d4e-4c7a-9b0e-${String(n).padStart(12, '0')}`;

type Body = { question: string } | { kind: string };

async function exchange(
  w: ReplyWorld,
  n: number,
  body: Body
): Promise<Exchange> {
  const response = await runMessageRoute(
    new Request('http://localhost/api/chat/message', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_request_id: uuid(n), ...body }),
    }),
    { ports: w.ports }
  );
  // the world names a new thread with a tag of the run: a fixture must not change from run to run
  const text = (await response.text()).replace(
    /th-new-[0-9a-z]+-\d+/g,
    `th-fixture-${String(n).padStart(4, '0')}`
  );
  if (
    (response.headers.get('content-type') ?? '').startsWith(
      'application/x-ndjson'
    )
  ) {
    return {
      kind: 'STREAM',
      status: response.status,
      events: text
        .split('\n')
        .filter((line) => line !== '')
        .map((line) => JSON.parse(line) as unknown),
    };
  }
  return { kind: 'JSON', status: response.status, body: JSON.parse(text) };
}

const reply = (text: string, cost = 2_500): FixtureScript => ({
  kind: 'REPLY',
  text,
  usage: {
    prompt_tokens: 14_000,
    completion_tokens: 300,
    cost_micro_usd: cost,
  },
});

const FAIL = (code: string): FixtureScript => ({
  kind: 'FAIL',
  code: code as never,
});

const TYPED: Body = { question: 'What is the direction of gold now?' };

/** The golden cycles, as (index, bias) for one trader type, to pick one that reads LONG and one that reads SHORT. */
async function biasOf(
  golden: number,
  traderType: 'DAY_TRADER' | 'SCALPER'
): Promise<string> {
  const w = await buildWorld({ golden, traderType });
  const out = await exchange(w, 1, { kind: 'INSTANT_M15_INSPECT' });
  if (out.kind !== 'STREAM') return 'NONE';
  const last = out.events[out.events.length - 1] as {
    type: string;
    result?: { kind: string; report?: { direction: { bias: string } } };
  };
  return last.result?.report?.direction.bias ?? 'NONE';
}

/** Which golden cycle reads LONG and which reads SHORT for a day trader. */
export async function pickDirections(): Promise<{
  long: number;
  short: number;
}> {
  let long = -1;
  let short = -1;
  for (let golden = 0; golden < 16 && (long < 0 || short < 0); golden += 1) {
    const bias = await biasOf(golden, 'DAY_TRADER');
    if (bias === 'LONG' && long < 0) long = golden;
    if (bias === 'SHORT' && short < 0) short = golden;
  }
  return { long, short };
}

export async function recordAll(): Promise<Recorded> {
  const { long, short } = await pickDirections();
  const out: Recorded = {};

  // -- the full report, a typed question (every stage runs) ------------------------------
  out['report1-long'] = await exchange(
    await buildWorld({ golden: long }),
    1,
    TYPED
  );
  // -- the same with a button press (the Understand stage is skipped) ---------------------
  out['report1-short-instant'] = await exchange(
    await buildWorld({ golden: short, traderType: 'SCALPER' }),
    2,
    { kind: 'INSTANT_M15_INSPECT' }
  );

  // -- a short answer, with the Trade Setup action ---------------------------------------
  out['answer'] = await exchange(
    await buildWorld({
      intake: {
        understand: echoResult('where would you exit', 'EXIT_TARGETS'),
      },
      primary: [
        reply(
          JSON.stringify({
            locale: 'en-US',
            text: 'The nearest level above is {Z1.reference}; the room to it is shorter than the stop.',
            cites: ['Z1'],
            action: 'OPEN_TRADE_SETUP',
          })
        ),
      ],
    }),
    3,
    { question: 'Where would you exit this?' }
  );

  // -- a report with a number the model got wrong twice: it is marked, never shown ---------
  const probe = await buildWorld({ golden: long });
  const good = JSON.stringify(modelReportFor(probe.packet, probe.dictionary));
  const wrong = plantLiteral(good, '{LAST_PRICE}', '4999.99');
  out['report1-flagged'] = await exchange(
    await buildWorld({ golden: long, primary: [reply(wrong), reply(wrong)] }),
    4,
    TYPED
  );

  // -- the answer from the sensor board ----------------------------------------------------
  out['fixed-stale'] = await exchange(
    await buildWorld({ intake: { worldOptions: { gateway: 'STALE' } } }),
    5,
    TYPED
  );
  out['fixed-model-down'] = await exchange(
    await buildWorld({
      primary: [FAIL('TIMEOUT')],
      fallback: [FAIL('HTTP_500')],
    }),
    6,
    TYPED
  );
  out['fixed-market-closed'] = await exchange(
    await buildWorld({
      intake: {
        understand: echoResult('open a trade', 'REPORT_2'),
        worldOptions: { gateway: 'MARKET_CLOSED' },
      },
    }),
    7,
    { question: 'Open a trade for me' }
  );

  // -- the action (no model is called) ------------------------------------------------------
  out['action'] = await exchange(
    await buildWorld({
      intake: { understand: echoResult('open a trade', 'REPORT_2') },
    }),
    8,
    { question: 'Open a trade for me' }
  );

  // -- refusals: in the stream (the door and the scope check) --------------------------------
  out['refusal-out-of-scope'] = await exchange(
    await buildWorld({
      intake: {
        understand: echoResult('direction of eurusd', 'DIRECTION', {
          symbols: ['EURUSD'],
        }),
      },
    }),
    9,
    { question: 'What is the direction of EURUSD?' }
  );
  // -- refusals: before the stream (JSON with a status) ---------------------------------------
  // a month nearly spent: the first question is answered and charged, then the books are set to what a
  // trader who had asked all month would have left (less than the worst case of one more question)
  const spent = await buildWorld();
  await exchange(spent, 10, TYPED);
  const period = [...spent.ledger.periods.values()][0];
  if (period === undefined) throw new Error('the ledger has no period');
  period.used = period.limit - 30_000;
  out['refusal-quota'] = await exchange(spent, 14, TYPED);
  out['refusal-tier'] = await exchange(
    await buildWorld({ intake: { session: { userId: USER, tier: 'FREE' } } }),
    11,
    TYPED
  );
  out['refusal-profile'] = await exchange(
    await buildWorld({
      intake: {
        profile: { ok: false, code: 'PROFILE_NOT_SET', detail: 'none' },
      },
    }),
    12,
    TYPED
  );

  // -- an error after the stream began: a reply that was paid for and could not be filed ------
  out['error-persistence'] = await exchange(
    await buildWorld({ traceFails: true }),
    13,
    TYPED
  );

  return out;
}
