import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';

import { LOCALES } from '@/lib/intake';

import {
  GATEWAY_STATES,
  REQUEST_KINDS,
  TRADERS,
  TYPED_INTENTS,
  buildPreview,
  listScenarios,
  type GatewayState,
  type PreviewParams,
  type RequestKindChoice,
} from './world';

/**
 * Development preview of the intake path (build step 6, part 5): the gate, the board, the route,
 * the packet and its trace, on the signed-off golden cycles, in the browser.
 *
 * It exists only outside a production build: Vercel builds and previews run with
 * NODE_ENV=production, so the route answers 404 there. Local development servers show it at
 * /dev/intake. It calls no model, no database, no gateway and no knowledge service, and nothing
 * on it is recorded or sent anywhere. The trader, the calendar and the knowledge chunk are TEST.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Intake preview (development)',
  robots: { index: false, follow: false },
};

type Query = Record<string, string | string[] | undefined>;

function one(query: Query, key: string): string | undefined {
  const value = query[key];
  return Array.isArray(value) ? value[0] : value;
}

function pick<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T
): T {
  return allowed.find((candidate) => candidate === value) ?? fallback;
}

const FIELD =
  'block w-full min-w-0 rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const LABEL = 'block text-xs font-medium text-muted-foreground';
const PRE =
  'overflow-x-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed';

function Select({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
}): ReactElement {
  return (
    <label className="min-w-0 space-y-1">
      <span className={LABEL}>{label}</span>
      <select name={name} defaultValue={value} className={FIELD}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const plain = (values: readonly string[]): { value: string; label: string }[] =>
  values.map((value) => ({ value, label: value }));

export default async function IntakePreviewPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}): Promise<ReactElement> {
  if (process.env.NODE_ENV === 'production') notFound();
  const query = await searchParams;
  const scenarios = listScenarios();

  const params: PreviewParams = {
    scenario: pick(
      one(query, 'scenario'),
      scenarios.map((s) => s.id),
      scenarios[0]?.id ?? ''
    ),
    trader: pick(one(query, 'trader'), TRADERS, 'DAY_TRADER'),
    kind: pick<RequestKindChoice>(one(query, 'kind'), REQUEST_KINDS, 'TYPED'),
    intent: pick(one(query, 'intent'), TYPED_INTENTS, 'DIRECTION'),
    question:
      (one(query, 'question') ?? '').slice(0, 500) || 'Should I buy gold now?',
    locale: pick(one(query, 'locale'), LOCALES, 'en-US'),
    gateway: pick<GatewayState>(one(query, 'gateway'), GATEWAY_STATES, 'FRESH'),
    knowledge: pick(one(query, 'knowledge'), ['OK', 'UNAVAILABLE'], 'OK'),
    quota: pick(one(query, 'quota'), ['ALLOW', 'DENY'], 'ALLOW'),
  };
  const { result, trace, boardLines } = await buildPreview(params);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold">
          Intake preview (development only)
        </h1>
        <p className="text-sm text-muted-foreground">
          The real gate, board, router and packet over a signed-off golden
          cycle. No model, database, gateway or knowledge service is called; the
          trader, the calendar and the knowledge chunk are test fixtures.
        </p>
        <p className="text-sm">
          <Link
            href="/dev/intake/instant"
            className="underline underline-offset-2"
            data-testid="instant-preview-link"
          >
            Panel C instant prompts: the Market Context badges (&quot;Explain
            the current M5 / M15 chart&quot;)
          </Link>
        </p>
      </header>

      <form method="get" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Select
          name="scenario"
          label="Cycle"
          value={params.scenario}
          options={scenarios.map((s) => ({
            value: s.id,
            label: `${s.id} · ${s.title}`.slice(0, 80),
          }))}
        />
        <Select
          name="trader"
          label="Trader type"
          value={params.trader}
          options={plain(TRADERS)}
        />
        <Select
          name="kind"
          label="Request"
          value={params.kind}
          options={plain(REQUEST_KINDS)}
        />
        <Select
          name="intent"
          label="Intent the fake Understand step returns (typed only)"
          value={params.intent}
          options={plain(TYPED_INTENTS)}
        />
        <Select
          name="locale"
          label="Interface locale"
          value={params.locale}
          options={plain(LOCALES)}
        />
        <Select
          name="gateway"
          label="Gateway data status"
          value={params.gateway}
          options={plain(GATEWAY_STATES)}
        />
        <Select
          name="knowledge"
          label="Knowledge service"
          value={params.knowledge}
          options={plain(['OK', 'UNAVAILABLE'])}
        />
        <Select
          name="quota"
          label="Quota pre-check"
          value={params.quota}
          options={plain(['ALLOW', 'DENY'])}
        />
        <label className="col-span-2 min-w-0 space-y-1 md:col-span-3">
          <span className={LABEL}>
            Question (typed only, at most 500 characters)
          </span>
          <input
            name="question"
            defaultValue={params.question}
            maxLength={600}
            className={FIELD}
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
          >
            Run
          </button>
        </div>
      </form>

      <section className="space-y-2" data-testid="outcome">
        <h2 className="text-sm font-semibold">
          Outcome: {result.kind}
          {result.kind === 'REFUSED' ? ` · ${result.refusal.code}` : ''}
        </h2>
        {result.kind === 'REFUSED' ? (
          <p
            className="rounded-md border p-3 text-sm"
            dir={
              ['ar', 'ur'].includes(result.refusal.reply_locale) ? 'rtl' : 'ltr'
            }
          >
            <span className="mr-2 text-xs text-muted-foreground">
              {result.refusal.reply_locale}
            </span>
            {result.refusal.reply}
          </p>
        ) : null}
        {result.kind === 'PACKET' ? (
          <p className="text-sm text-muted-foreground">
            M* = {result.packet.readings.m_star.join(', ') || 'none'} · intent{' '}
            {result.packet.intent} · reply in{' '}
            {result.packet.question.reply_locale} · data{' '}
            {result.packet.data.status} · knowledge{' '}
            {result.packet.knowledge?.status ?? 'none (Report 2)'} ·
            packet_sha256 {result.packet_sha256.slice(0, 12)}
          </p>
        ) : null}
      </section>

      {boardLines === null ? null : (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Sensor board</h2>
          <pre className={PRE} data-testid="board">
            {boardLines.join('\n')}
          </pre>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Trace</h2>
        <pre className={PRE} data-testid="trace">
          {JSON.stringify(trace, null, 2)}
        </pre>
      </section>

      {result.kind === 'PACKET' ? (
        <details className="space-y-2">
          <summary className="cursor-pointer text-sm font-semibold">
            Packet (intake-packet/1)
          </summary>
          <pre className={PRE} data-testid="packet">
            {JSON.stringify(result.packet, null, 2)}
          </pre>
        </details>
      ) : null}
    </main>
  );
}
