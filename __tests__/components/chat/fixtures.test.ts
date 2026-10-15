/**
 * @jest-environment node
 */

/**
 * The recorded fixtures of the chat panel (build step 7 part 8): `app/dev/chat/recorded.json` is what
 * `POST /api/chat/message` answers, recorded from the real route layer over the orchestrator (see
 * `helpers/record.ts`). It is written when `RECORD_CHAT_FIXTURES=1` and otherwise held to what the
 * route answers TODAY, so a change in a contract, the composer or a check fails here instead of
 * leaving the panel drawing a reply the server no longer makes. Every recorded stream also passes the
 * strict contract validators of `lib/reply/contracts`, which the browser does not import.
 */

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));
jest.mock('@/lib/reply/server/ports', () => ({
  createReplyPorts: jest.fn(() => {
    throw new Error('the production ports must not be built here');
  }),
}));

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

import {
  decodeStream,
  encodeEvent,
  type StreamEvent,
} from '@/lib/reply/contracts/stage-events';

import { recordAll, type Exchange, type Recorded } from './helpers/record';

const FILE = join(
  __dirname,
  '..',
  '..',
  '..',
  'app',
  'dev',
  'chat',
  'recorded.json'
);

jest.setTimeout(120_000);

if (process.env['RECORD_CHAT_FIXTURES'] === '1') {
  it('writes app/dev/chat/recorded.json', async () => {
    writeFileSync(FILE, `${JSON.stringify(await recordAll(), null, 2)}\n`);
  });
}

const recorded = JSON.parse(readFileSync(FILE, 'utf8')) as Recorded;
const names = Object.keys(recorded);

const streamOf = (exchange: Exchange): StreamEvent[] => {
  if (exchange.kind !== 'STREAM') throw new Error('not a stream');
  const text = exchange.events
    .map((event) => encodeEvent(event as StreamEvent))
    .join('');
  const decoded = decodeStream(text);
  if (!decoded.ok) {
    throw new Error(`not a valid stream: ${JSON.stringify(decoded.issues)}`);
  }
  return decoded.events;
};

describe('the recorded exchanges', () => {
  it('cover every state the panel draws from a reply', () => {
    expect(names.sort()).toEqual(
      [
        'action',
        'answer',
        'error-persistence',
        'fixed-market-closed',
        'fixed-model-down',
        'fixed-stale',
        'refusal-out-of-scope',
        'refusal-profile',
        'refusal-quota',
        'refusal-tier',
        'report1-flagged',
        'report1-long',
        'report1-short-instant',
      ].sort()
    );
  });

  it.each(names.filter((n) => recorded[n]?.kind === 'STREAM'))(
    '%s is a valid stream of the strict contract',
    (name) => {
      const events = streamOf(recorded[name] as Exchange);
      expect(events.filter((e) => e.type !== 'stage')).toHaveLength(1);
    }
  );

  it('are exactly what the route answers today (run with RECORD_CHAT_FIXTURES=1 to record them again)', async () => {
    const fresh = JSON.parse(JSON.stringify(await recordAll())) as Recorded;
    expect(fresh).toEqual(recorded);
  });

  it('are in the language of an English reader, written for a day trader and a scalper, LONG and SHORT', () => {
    const results = names.flatMap((name) => {
      const exchange = recorded[name] as Exchange;
      if (exchange.kind !== 'STREAM') return [];
      const last = exchange.events[exchange.events.length - 1] as StreamEvent;
      return last.type === 'result' ? [last.result] : [];
    });
    const reports = results.flatMap((r) => (r.kind === 'REPORT1' ? [r] : []));
    expect(new Set(reports.map((r) => r.report.direction.bias))).toEqual(
      new Set(['LONG', 'SHORT'])
    );
    expect(new Set(reports.map((r) => r.report.direction.profile))).toEqual(
      new Set(['DAY_TRADER', 'SCALPER'])
    );
    expect(new Set(results.map((r) => r.kind))).toEqual(
      new Set(['REPORT1', 'ANSWER', 'FIXED_ANSWER', 'ACTION'])
    );
    expect(results.every((r) => r.reply_locale === 'en-US')).toBe(true);
  });

  it('hold a report with a number that could not be verified, marked and never the model’s literal', () => {
    const exchange = recorded['report1-flagged'] as Exchange;
    const last = streamOf(exchange).at(-1) as StreamEvent;
    if (last.type !== 'result' || last.result.kind !== 'REPORT1') {
      throw new Error('not a report');
    }
    expect(last.result.checks.numbers_flagged).toBe(1);
    expect(last.result.report.headline).toContain('not verified');
    expect(JSON.stringify(last.result)).not.toContain('4999.99');
  });
});
