/**
 * @jest-environment node
 */

/**
 * The development preview of the intake path (build step 6 part 5): it runs the real path over
 * the golden cycles in a development build, and answers 404 in production.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import { renderToStaticMarkup } from 'react-dom/server';

import IntakePreviewPage, { dynamic, metadata } from '@/app/dev/intake/page';
import {
  GATEWAY_STATES,
  REQUEST_KINDS,
  TRADERS,
  TYPED_INTENTS,
  buildPreview,
  listScenarios,
  type PreviewParams,
} from '@/app/dev/intake/world';
import { LOCALES, forbiddenKeyPaths, validatePacket } from '@/lib/intake';

const ORIGINAL_ENV = process.env;

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

function setNodeEnv(value: string): void {
  process.env = { ...ORIGINAL_ENV, NODE_ENV: value } as NodeJS.ProcessEnv;
}

const SCENARIOS = listScenarios();

const base = (over: Partial<PreviewParams> = {}): PreviewParams => ({
  scenario: SCENARIOS[0]!.id,
  trader: 'DAY_TRADER',
  kind: 'TYPED',
  intent: 'DIRECTION',
  question: 'Should I buy gold now',
  locale: 'en-US',
  gateway: 'FRESH',
  knowledge: 'OK',
  quota: 'ALLOW',
  ...over,
});

async function page(
  query: Record<string, string | string[]> = {}
): Promise<string> {
  const element = await IntakePreviewPage({
    searchParams: Promise.resolve(query),
  });
  return renderToStaticMarkup(element);
}

describe('in a production build', () => {
  it('the page answers 404', async () => {
    setNodeEnv('production');
    await expect(page()).rejects.toMatchObject({
      digest: expect.stringContaining('404'),
    });
  });

  it('the world refuses to run, and to list its scenarios', async () => {
    setNodeEnv('production');
    await expect(buildPreview(base())).rejects.toThrow(
      'does not run in production'
    );
    expect(() => listScenarios()).toThrow('does not run in production');
  });
});

describe('in development', () => {
  beforeEach(() => setNodeEnv('development'));

  it('lists the sixteen golden cycles', () => {
    expect(SCENARIOS).toHaveLength(16);
    expect(SCENARIOS[0]?.id).toBe('01-real-18-sep-counter-trend-rally');
    expect(SCENARIOS[0]?.title).toBe(
      'The 18 Sep 20:55 test cycle: counter-trend rally'
    );
    expect(SCENARIOS.every((s) => s.title.length > 0)).toBe(true);
    expect(SCENARIOS.every((s) => s.title !== 'undefined')).toBe(true);
    expect(SCENARIOS.map((s) => s.id)).toEqual(
      [...SCENARIOS.map((s) => s.id)].sort()
    );
  });

  it('refuses a cycle that is not one of the golden ones', async () => {
    await expect(
      buildPreview(base({ scenario: '99-no-such-cycle' }))
    ).rejects.toThrow('no golden scenario 99-no-such-cycle');
  });

  it('prices the data line with the stored reading of the cycle: 4378.31 at the 20:50 M5 bar on 18 Sep', async () => {
    const { result, boardLines } = await buildPreview(base());
    if (result.kind !== 'PACKET') throw new Error('expected a packet');
    expect(result.packet.data.last_price).toEqual({
      price: 4378.31,
      timeframe: 'M5',
      bar: '2026-09-18T20:50Z',
    });
    expect(boardLines?.at(-1)).toContain(
      'last price 4378.31 (close of the 20:50 M5 bar)'
    );
  });

  it('gives each trader type its own synthesis reading, the stored one', async () => {
    const expected = JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          'davintrade-stack-d-and-e',
          'engine-1-5-new',
          'mcd_worker',
          'golden',
          '01-real-18-sep-counter-trend-rally',
          'expected.json'
        ),
        'utf8'
      )
    ) as {
      synthesis: { readings: { profile: string; reading_sha256: string }[] };
    };
    for (const trader of TRADERS) {
      const { result } = await buildPreview(base({ trader }));
      if (result.kind !== 'PACKET') throw new Error('expected a packet');
      const stored = expected.synthesis.readings.find(
        (r) => r.profile === trader
      );
      expect(result.packet.readings.synthesis?.profile).toBe(trader);
      expect(result.packet.readings.synthesis?.reading_sha256).toBe(
        stored?.reading_sha256
      );
    }
  });

  it('runs the real path on the first cycle: a packet, its board and its trace', async () => {
    const { result, trace, boardLines } = await buildPreview(base());
    expect(result.kind).toBe('PACKET');
    if (result.kind !== 'PACKET') return;
    expect(validatePacket(result.packet).ok).toBe(true);
    expect(forbiddenKeyPaths(result.packet)).toEqual([]);
    expect(result.packet.readings.m_star).toEqual(['MCD1', 'MCD3']);
    expect(trace.packet_sha256).toBe(result.packet_sha256);
    expect(boardLines?.[0]).toBe(
      'SENSOR BOARD · XAUUSD · 18 SEP 20:55 · DAY TRADER'
    );
    expect(boardLines).toHaveLength(6);
  });

  it.each(SCENARIOS.map((s) => s.id))(
    'makes a packet on %s for both trader types and the two instant prompts',
    async (scenario) => {
      for (const trader of TRADERS) {
        for (const kind of REQUEST_KINDS) {
          const { result } = await buildPreview(
            base({ scenario, trader, kind })
          );
          expect(result.kind).toBe('PACKET');
        }
      }
    }
  );

  it.each(TYPED_INTENTS.filter((i) => i !== 'OUT_OF_SCOPE'))(
    'answers the %s intent with a packet',
    async (intent) => {
      const { result } = await buildPreview(base({ intent }));
      expect(result.kind).toBe('PACKET');
      if (result.kind === 'PACKET') expect(result.packet.intent).toBe(intent);
    }
  );

  it('refuses an out-of-scope question with the fixed reply in the interface language', async () => {
    const { result } = await buildPreview(
      base({ intent: 'OUT_OF_SCOPE', locale: 'ar' })
    );
    expect(result.kind).toBe('REFUSED');
    if (result.kind === 'REFUSED') {
      expect(result.refusal).toMatchObject({
        code: 'OUT_OF_SCOPE',
        reply_locale: 'ar',
      });
    }
  });

  it('refuses at the gate when the quota is denied', async () => {
    const { result } = await buildPreview(
      base({ quota: 'DENY', kind: 'INSTANT_M5_INSPECT', locale: 'de' })
    );
    expect(result.kind).toBe('REFUSED');
    if (result.kind === 'REFUSED') {
      expect(result.refusal).toMatchObject({
        code: 'QUOTA_INSUFFICIENT',
        stage: 'GATE',
        reply_locale: 'de',
      });
    }
  });

  it.each(GATEWAY_STATES)(
    'shows a %s gateway in the packet',
    async (gateway) => {
      const { result } = await buildPreview(base({ gateway }));
      expect(result.kind).toBe('PACKET');
      if (result.kind === 'PACKET') {
        expect(result.packet.data.status).toBe(
          gateway === 'UNREACHABLE' ? 'UNKNOWN' : gateway
        );
      }
    }
  );

  it('shows an unavailable knowledge service as an UNAVAILABLE pack', async () => {
    const { result } = await buildPreview(base({ knowledge: 'UNAVAILABLE' }));
    expect(result.kind === 'PACKET' && result.packet.knowledge?.status).toBe(
      'UNAVAILABLE'
    );
  });

  it('makes a packet in every one of the 19 interface locales', async () => {
    for (const locale of LOCALES) {
      const { result } = await buildPreview(
        base({ locale, kind: 'INSTANT_M15_INSPECT' })
      );
      expect(result.kind).toBe('PACKET');
      if (result.kind === 'PACKET')
        expect(result.packet.question.interface_locale).toBe(locale);
    }
  });

  it('falls back to en-US for a locale the app does not offer, and takes the language of the others', async () => {
    const unknown = await buildPreview(base({ locale: 'xx' }));
    expect(
      unknown.result.kind === 'PACKET' &&
        unknown.result.packet.question.interface_locale
    ).toBe('en-US');
    for (const [locale, language] of [
      ['zh', 'zh'],
      ['zh-TW', 'zh-TW'],
      ['pt-BR', 'pt'],
      ['pt', 'pt'],
      ['en-GB', 'en'],
      ['de', 'de'],
    ] as const) {
      const { result } = await buildPreview(base({ locale }));
      if (result.kind !== 'PACKET') throw new Error('expected a packet');
      expect({ locale, language: result.packet.question.language }).toEqual({
        locale,
        language,
      });
    }
  });

  it('names the route of the request, its tier and its clock', async () => {
    const typed = await buildPreview(base());
    expect(typed.trace).toMatchObject({
      route: 'typed',
      method: 'POST',
      tier: 'PRO',
      started_at: '2026-09-18T20:57:00.000Z',
    });
    const instant = await buildPreview(base({ kind: 'INSTANT_M15_INSPECT' }));
    expect(instant.trace.route).toBe('instant');
    expect(
      instant.result.kind === 'PACKET' && instant.result.packet.question.source
    ).toBe('INSTANT');
  });

  it('says why the knowledge pack is unavailable, and how it is when it is not', async () => {
    const down = await buildPreview(base({ knowledge: 'UNAVAILABLE' }));
    expect(down.trace.problems).toContain('KNOWLEDGE_TIMEOUT');
    const up = await buildPreview(base());
    expect(up.trace.problems).toEqual([]);
    expect(
      up.result.kind === 'PACKET' && up.result.packet.knowledge?.chunks[0]?.id
    ).toBe('TEST-ONLY-D1');
  });

  it('makes a trace that names the preview and no one', async () => {
    const { trace } = await buildPreview(base());
    expect(trace.request_id).toBe('preview-request');
    expect(JSON.stringify(trace)).not.toContain('preview-user');
  });
});

describe('the page, in development', () => {
  beforeEach(() => setNodeEnv('development'));

  it('shows the outcome, the board, the trace and the packet for the first cycle by default', async () => {
    const html = await page();
    expect(html).toContain('Intake preview (development only)');
    expect(html).toContain('Outcome: PACKET');
    expect(html).toContain('SENSOR BOARD · XAUUSD · 18 SEP 20:55 · DAY TRADER');
    expect(html).toContain('R1_MACRO_COUNTER_TREND_RALLY');
    expect(html).toContain('data-testid="trace"');
    expect(html).toContain('data-testid="packet"');
    expect(html).toContain('intake-packet/1');
  });

  it('shows a refusal with its reply, and no packet', async () => {
    const html = await page({
      kind: 'INSTANT_M5_INSPECT',
      quota: 'DENY',
      locale: 'ar',
    });
    expect(html).toContain('Outcome: REFUSED · QUOTA_INSUFFICIENT');
    expect(html).toContain('dir="rtl"');
    expect(html).not.toContain('data-testid="packet"');
  });

  it('reads a choice from the query and falls back to the default for anything it does not offer', async () => {
    const chosen = await page({ trader: 'SCALPER', gateway: 'STALE' });
    expect(chosen).toContain('XAUUSD · 18 SEP 20:55 · SCALPER');
    expect(chosen).toContain('data STALE');
    const wrong = await page({
      trader: 'EVIL',
      scenario: '../../etc/passwd',
      locale: 'xx',
      gateway: 'ON FIRE',
      kind: 'nonsense',
      intent: 'HACK',
      quota: 'MAYBE',
      knowledge: 'MAYBE',
    });
    expect(wrong).toContain('Outcome: PACKET');
    expect(wrong).toContain('DAY TRADER');
    expect(wrong).not.toContain('etc/passwd</');
  });

  it('takes the first of a repeated parameter', async () => {
    const html = await page({ trader: ['SCALPER', 'DAY_TRADER'] });
    expect(html).toContain('XAUUSD · 18 SEP 20:55 · SCALPER');
  });

  it('escapes what the trader typed', async () => {
    const html = await page({ question: '<script>alert(1)</script>' });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('cuts the typed question at 500 characters before it reaches the door', async () => {
    const html = await page({ question: 'g'.repeat(900) });
    expect(html).toContain('Outcome: PACKET');
  });

  it('has a form that sends a GET with one field per choice, each with its default selected', async () => {
    const html = await page();
    expect(html).toMatch(/<form [^>]*method="get"/);
    expect(html).toContain('type="submit"');
    expect(html).toContain('data-testid="outcome"');
    const FIELDS: [string, string, string][] = [
      ['scenario', 'Cycle', '01-real-18-sep-counter-trend-rally'],
      ['trader', 'Trader type', 'DAY_TRADER'],
      ['kind', 'Request', 'TYPED'],
      ['intent', 'Intent the fake Understand step returns', 'DIRECTION'],
      ['locale', 'Interface locale', 'en-US'],
      ['gateway', 'Gateway data status', 'FRESH'],
      ['knowledge', 'Knowledge service', 'OK'],
      ['quota', 'Quota pre-check', 'ALLOW'],
    ];
    for (const [name, label, dflt] of FIELDS) {
      expect(html).toContain(`<select name="${name}"`);
      expect(html).toContain(label);
      expect(html).toMatch(new RegExp(`<option value="${dflt}" selected=""`));
    }
    expect(html).toContain('name="question"');
    expect(html).toContain('value="Should I buy gold now?"');
  });

  it('reads every choice from the query by its own name', async () => {
    const stale = await page({ scenario: '14-primary-sensor-stale' });
    expect(stale).toContain(
      'SENSOR BOARD · XAUUSD · 09 OCT 10:30 · DAY TRADER'
    );
    const m15 = await page({ kind: 'INSTANT_M15_INSPECT' });
    expect(m15).toContain('intent INSTANT_M15_INSPECT');
    expect(m15).toContain('M* = MCD1, MCD3');
    const down = await page({ knowledge: 'UNAVAILABLE' });
    expect(down).toContain('knowledge UNAVAILABLE');
    const up = await page({ knowledge: 'OK' });
    expect(up).toContain('knowledge OK');
    const denied = await page({ quota: 'DENY' });
    expect(denied).toContain('Outcome: REFUSED · QUOTA_INSUFFICIENT');
    const allowed = await page({ quota: 'ALLOW' });
    expect(allowed).toContain('Outcome: PACKET');
    const exit = await page({ intent: 'EXIT_TARGETS' });
    expect(exit).toContain('intent EXIT_TARGETS');
    const german = await page({ locale: 'de', kind: 'INSTANT_M5_INSPECT' });
    expect(german).toContain('reply in de');
  });

  it('offers the choices of the knowledge service and of the quota', async () => {
    const html = await page();
    for (const value of ['OK', 'UNAVAILABLE', 'ALLOW', 'DENY']) {
      expect(html).toContain(`<option value="${value}"`);
    }
  });

  it('says there is no knowledge pack for Report 2, lays the board out line by line and prints the trace indented', async () => {
    const report2 = await page({ intent: 'REPORT_2' });
    expect(report2).toContain('knowledge none (Report 2)');
    const html = await page();
    expect(html).toContain('data-testid="board"');
    expect(html).toContain('DAY TRADER\nSYN ');
    expect(html).toContain(
      '{\n  &quot;request_id&quot;: &quot;preview-request&quot;'
    );
    expect(html).toContain(
      '{\n  &quot;schema&quot;: &quot;intake-packet/1&quot;'
    );
  });

  it('never caches: the page is dynamic', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  it('is kept out of search engines and says it is a development page', () => {
    expect(metadata).toMatchObject({
      title: 'Intake preview (development)',
      robots: { index: false, follow: false },
    });
  });

  it('cuts the typed question at 500 characters, and lets the field take 600', async () => {
    const html = await page({ question: 'g'.repeat(900) });
    expect(html).toContain('g'.repeat(500));
    expect(html).not.toContain('g'.repeat(501));
    expect(html).toContain('maxLength="600"');
  });

  it('cuts the label of a cycle at 80 characters', async () => {
    const html = await page();
    const label =
      /<option value="01-real-18-sep-counter-trend-rally"[^>]*>([^<]*)<\/option>/.exec(
        html
      );
    expect(label?.[1]).toHaveLength(80);
    expect(
      label?.[1]?.startsWith('01-real-18-sep-counter-trend-rally · The 18 Sep')
    ).toBe(true);
  });

  it('writes a reply right to left for Arabic and Urdu and left to right for the others', async () => {
    for (const [locale, dir] of [
      ['ar', 'rtl'],
      ['ur', 'rtl'],
      ['de', 'ltr'],
      ['ja', 'ltr'],
    ] as const) {
      const html = await page({
        kind: 'INSTANT_M5_INSPECT',
        quota: 'DENY',
        locale,
      });
      expect({ locale, dir: new RegExp(`dir="${dir}"`).test(html) }).toEqual({
        locale,
        dir: true,
      });
    }
  });

  it('says none when no sensor is given in full, and shows twelve characters of the fingerprint', async () => {
    const report2 = await page({ intent: 'REPORT_2' });
    expect(report2).toContain('M* = none');
    expect(report2).toMatch(/packet_sha256 [0-9a-f]{12}(?![0-9a-f])/);
    const direction = await page();
    expect(direction).toContain('M* = MCD1, MCD3');
  });

  it('offers every cycle, trader type, request kind, locale and gateway state', async () => {
    const html = await page();
    for (const scenario of SCENARIOS)
      expect(html).toContain(`value="${scenario.id}"`);
    for (const locale of LOCALES) expect(html).toContain(`value="${locale}"`);
    for (const state of GATEWAY_STATES)
      expect(html).toContain(`value="${state}"`);
    for (const kind of REQUEST_KINDS) expect(html).toContain(`value="${kind}"`);
  });
});
