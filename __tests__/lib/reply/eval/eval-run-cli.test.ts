/**
 * @jest-environment node
 */

/**
 * `scripts/reply/eval-run.js` (build step 7 part 10; runbook S2): the command line of the evaluation
 * suite. The stand-in commands run for real (they are free); the LIVE command runs against a fake
 * OpenRouter on this machine, so the key, the cap, the privacy field, the recording of a live run and
 * the refusals are all seen working before anyone spends a dollar on the real service.
 *
 * Every case is a child process: the script loads TypeScript through `tsx`, and a Jest worker is the
 * wrong place for that.
 */

jest.mock('@/lib/db/prisma', () => ({ prisma: {} }));

import { spawn } from 'child_process';
import http from 'http';
import type { AddressInfo } from 'net';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

import { EVAL_LOCALES } from '@/lib/reply/eval/languages';
import { SCENARIO_SET, scenarioById } from '@/lib/reply/eval/scenarios';
import type { EvalRun } from '@/lib/reply/eval/suite';

import { worldEntry } from './helpers/harness';
import { STAND_IN_PATH, lf, readRunFile } from './helpers/runs';
import { asJson, standInReport } from './helpers/stand-in';

const ROOT = resolve(__dirname, '..', '..', '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'reply', 'eval-run.js');
const KEY = 'sk-or-test-0123456789abcdef-NOT-A-REAL-KEY';

let tmp: string;
beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), 'eval-run-'));
});
afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

interface Result {
  code: number | null;
  out: string;
}

function node(
  args: string[],
  env: Record<string, string | undefined> = {}
): Promise<Result> {
  return new Promise((done) => {
    const clean: NodeJS.ProcessEnv = { ...process.env };
    delete clean['OPENROUTER_API_KEY'];
    delete clean['INTAKE_UNDERSTAND_API_KEY'];
    delete clean['OPENROUTER_BASE_URL'];
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      env: { ...clean, ...env } as NodeJS.ProcessEnv,
    });
    let out = '';
    child.stdout.on('data', (c) => (out += String(c)));
    child.stderr.on('data', (c) => (out += String(c)));
    child.on('close', (code) => done({ code, out }));
  });
}

const script = (args: string[], env?: Record<string, string | undefined>) =>
  node([SCRIPT, ...args], env);

// ---------------------------------------------------------------------------------------
// The fake OpenRouter
// ---------------------------------------------------------------------------------------

interface Seen {
  authorization: string | undefined;
  body: any;
}

let server: http.Server;
let base: string;
let seen: Seen[] = [];
let costPerCall: number | undefined = 0.0042;
let failing = false;
/** the next reply is JSON that is not a report (so the run would ask again) */
let badNext = false;
/** the Report 1 a model would write for the M01 world, per locale */
const replies = new Map<string, string>();

beforeAll(async () => {
  const scenario = scenarioById('M01')!;
  for (const locale of EVAL_LOCALES) {
    const entry = await worldEntry(scenario, 'DAY_TRADER', locale);
    replies.set(
      locale,
      asJson(standInReport(entry.packet, entry.dictionary, locale))
    );
  }
  server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      const body = text === '' ? null : JSON.parse(text);
      seen.push({ authorization: req.headers.authorization, body });
      res.setHeader('Content-Type', 'application/json');
      if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
        res.statusCode = 404;
        res.end('{}');
        return;
      }
      if (failing) {
        res.statusCode = 503;
        res.end('{}');
        return;
      }
      // (the prompt is JSON text here: a locale ends at the first character that is not part of one)
      const locale =
        /REPLY LOCALE ([A-Za-z-]+)/.exec(JSON.stringify(body.messages))?.[1] ??
        'en-US';
      res.end(
        JSON.stringify({
          id: 'gen-fake-1',
          model: body.model,
          provider: 'Fake Host',
          choices: [
            {
              finish_reason: 'stop',
              message: {
                role: 'assistant',
                content: badNext
                  ? ((badNext = false), '{"headline":"x"}')
                  : replies.get(locale),
              },
            },
          ],
          usage: {
            prompt_tokens: 14_000,
            completion_tokens: 300,
            prompt_tokens_details: { cached_tokens: 0 },
            ...(costPerCall === undefined ? {} : { cost: costPerCall }),
          },
        })
      );
    });
  });
  await new Promise<void>((resolveListen) =>
    server.listen(0, '127.0.0.1', resolveListen)
  );
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});
afterAll(async () => {
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
});
beforeEach(() => {
  seen = [];
  costPerCall = 0.0042;
  failing = false;
  badNext = false;
});

/** A driver that hands the script a priced registry row, as S1 would leave it (the CLI itself reads the registry). */
function driver(): string {
  const file = join(tmp, 'driver.js');
  writeFileSync(
    file,
    `
const { run } = require(${JSON.stringify(SCRIPT)});
const { boot } = require(${JSON.stringify(join(ROOT, 'scripts', 'reply', 'ts-boot.js'))});
const ts = boot();
const rows = ts.registry.AI_MODEL_REGISTRY.map((row) =>
  row.slug === 'google/gemini-3.6-flash' || row.slug === 'deepseek/deepseek-v4-flash'
    ? { ...row, price_in: 0.3, price_out: 2.5, priced_at: '2026-10-16' }
    : row
);
run(process.argv.slice(2), process.env, { registryRows: rows }).then(
  (code) => { process.exitCode = code; },
  () => { process.exitCode = 2; }
);
`,
    'utf8'
  );
  return file;
}

const live = (args: string[], env: Record<string, string | undefined> = {}) =>
  node([driver(), '--live', ...args], {
    OPENROUTER_API_KEY: KEY,
    OPENROUTER_BASE_URL: base,
    ...env,
  });

// ---------------------------------------------------------------------------------------

describe('arguments', () => {
  it('--help prints the manual and exits 0', async () => {
    const result = await script(['--help']);
    expect(result.code).toBe(0);
    expect(result.out).toContain('--stand-in');
    expect(result.out).toContain('--cap-usd');
    expect(result.out).toContain('NEVER EDITS THE REGISTRY');
  });

  it.each([
    [[], 'give exactly one of'],
    [['--stand-in', '--check'], 'give exactly one of'],
    [['--frobnicate'], 'unknown argument'],
    [['--stand-in', '--passes', '9'], '--passes'],
    [['--stand-in', '--passes', 'x'], '--passes'],
    [['--stand-in', '--date', 'yesterday'], '--date'],
    [['--live', '--cap-usd', '0'], '--cap-usd'],
    [['--live', '--cap-usd', '9999'], '--cap-usd'],
    [['--estimate', '--model'], 'needs a value'],
  ])('%j exits 2 and says why', async (args, words) => {
    const result = await script(args as string[]);
    expect(result.code).toBe(2);
    expect(result.out).toContain(words as string);
  });
});

describe('the stand-in commands (free, offline, deterministic)', () => {
  it('--check finds the committed run to be what a fresh stand-in run gives', async () => {
    const result = await script(['--check']);
    expect(result.out).toContain('is what a fresh stand-in run gives');
    expect(result.out).toContain('STAND-IN');
    expect(result.code).toBe(0);
  }, 120_000);

  it('--check says WHAT moved when the committed run is not a fresh one', async () => {
    const { run } = readRunFile(STAND_IN_PATH);
    const stale = JSON.parse(JSON.stringify(run)) as EvalRun;
    stale.fingerprint.wording_sha256 = 'f'.repeat(64);
    stale.cells[3]!.units += 1;
    const file = join(tmp, 'stale.json');
    writeFileSync(file, JSON.stringify(stale), 'utf8');
    const result = await script(['--check', '--file', file]);
    expect(result.code).toBe(1);
    expect(result.out).toContain('is NOT what a fresh stand-in run gives');
    expect(result.out).toContain('wording_sha256 differs');
    expect(result.out).toContain(`cell ${stale.cells[3]!.id} differs`);
    expect(result.out).toContain(
      'node scripts/reply/eval-run.js --stand-in --write'
    );
  }, 120_000);

  it('--stand-in --write --out makes the committed file, byte for byte, and says it is a stand-in', async () => {
    const out = join(tmp, 'again.json');
    const result = await script([
      '--stand-in',
      '--write',
      '--date',
      '2026-10-16',
      '--out',
      out,
    ]);
    expect(result.code).toBe(0);
    expect(result.out.split('\n')[0]).toContain('STAND-IN RUN');
    expect(result.out).toContain('Verdict: every bar holds');
    expect(lf(readFileSync(out, 'utf8'))).toBe(
      lf(readFileSync(STAND_IN_PATH, 'utf8'))
    );
  }, 120_000);

  it('--report prints the table of 5.10 of a recorded run', async () => {
    const result = await script(['--report', STAND_IN_PATH]);
    expect(result.code).toBe(0);
    expect(result.out).toContain('| Golden scenarios |');
    expect(result.out).toContain('| Languages |');
    expect(result.out).toContain('(STAND-IN RUN)');
  });

  it('--replay plays the recorded replies through the checks with no model and agrees with the record', async () => {
    const result = await script(['--replay', STAND_IN_PATH]);
    expect(result.out).toContain('no model called');
    expect(result.code).toBe(0);
  }, 120_000);

  it('--replay finds a reply that was changed after it was recorded, and a summary that was edited', async () => {
    const { run } = readRunFile(STAND_IN_PATH);
    const tampered = JSON.parse(JSON.stringify(run)) as EvalRun;
    const cell = tampered.cells.find(
      (c) => c.scenario === 'G01' && c.locale === 'de'
    )!;
    cell.calls[0]!.text = '{"headline":"x"}';
    const file = join(tmp, 'tampered.json');
    writeFileSync(file, JSON.stringify(tampered), 'utf8');
    const result = await script(['--replay', file]);
    expect(result.code).toBe(1);
    expect(result.out).toContain(
      `${cell.id}: the judgement of the recorded replies is not the recorded one`
    );
    expect(result.out).toContain(
      'the summary of the run is not the summary of its cells'
    );

    const edited = JSON.parse(JSON.stringify(run)) as EvalRun;
    edited.summary.all_pass = !edited.summary.all_pass;
    writeFileSync(file, JSON.stringify(edited), 'utf8');
    const second = await script(['--replay', file]);
    expect(second.code).toBe(1);
    expect(second.out).toContain(
      'the summary of the run is not the summary of its cells'
    );
  }, 120_000);

  it('--replay refuses a file that is not a run', async () => {
    const file = join(tmp, 'notarun.json');
    writeFileSync(file, '{"schema":"something-else"}', 'utf8');
    const result = await script(['--replay', file]);
    expect(result.code).toBe(1);
    expect(result.out).toContain('schema is not eval-run/1');
    const missing = await script(['--replay', join(tmp, 'nothing.json')]);
    expect(missing.code).toBe(2);
    expect(missing.out).toContain('does not exist');
  });
});

describe('--estimate', () => {
  it('counts the live calls and says a model with no dated price must be priced first (S1)', async () => {
    const result = await script([
      '--estimate',
      '--model',
      'google/gemini-3.6-flash',
    ]);
    expect(result.code).toBe(0);
    const cells = SCENARIO_SET.scenarios
      .filter((s) => s.source === 'MODEL')
      .reduce(
        (sum, s) =>
          sum +
          s.traders.length * (s.locales === 'ALL' ? 19 : s.locales.length),
        0
      );
    expect(result.out).toContain(`asks the model for ${cells * 2} replies`);
    expect(result.out).toContain('no dated price');
  });

  it('prices a live run from the registry when it has a price, as an upper bound', async () => {
    const result = await node([
      driver(),
      '--estimate',
      '--model',
      'google/gemini-3.6-flash',
      '--passes',
      '1',
      '--scenarios',
      'M01',
    ]);
    expect(result.code).toBe(0);
    expect(result.out).toContain('asks the model for 19 replies');
    // 19,600 prompt tokens at 0.3 and 2,048 reply tokens at 2.5 USD per million: $0.0110 a call, $0.21 for 19
    expect(result.out).toContain(
      'Priced at 0.3 / 2.5 USD per million tokens (read 2026-10-16)'
    );
    expect(result.out).toContain('about $0.0110');
    expect(result.out).toContain('at most about $0.21');
  });

  it('refuses a model that is not in the registry, and one that is no answer model', async () => {
    expect(
      (await script(['--estimate', '--model', 'nobody/nothing'])).code
    ).toBe(2);
    expect(
      (await script(['--estimate', '--model', 'nobody/nothing'])).out
    ).toContain('is not in config/ai-models.ts');
  });
});

describe('--live (against a fake OpenRouter on this machine)', () => {
  it('refuses to start without a key, without a cap, with an unpriced model, or with a fallback of the same vendor', async () => {
    const noKey = await script([
      '--live',
      '--model',
      'google/gemini-3.6-flash',
      '--cap-usd',
      '1',
    ]);
    expect(noKey.code).toBe(2);
    expect(noKey.out).toContain('needs OPENROUTER_API_KEY');

    const noCap = await script(
      ['--live', '--model', 'google/gemini-3.6-flash'],
      { OPENROUTER_API_KEY: KEY }
    );
    expect(noCap.code).toBe(2);
    expect(noCap.out).toContain('needs --cap-usd');

    const unpriced = await script(
      ['--live', '--model', 'google/gemini-3.6-flash', '--cap-usd', '1'],
      {
        OPENROUTER_API_KEY: KEY,
        OPENROUTER_BASE_URL: base,
      }
    );
    expect(unpriced.code).toBe(2);
    expect(unpriced.out).toContain('has no dated price');
    expect(seen).toEqual([]);

    const sameVendor = await live([
      '--model',
      'google/gemini-3.6-flash',
      '--fallback',
      'google/gemini-3.6-flash',
      '--cap-usd',
      '1',
    ]);
    expect(sameVendor.code).toBe(2);
    expect(sameVendor.out).toContain('another provider');
    expect(seen).toEqual([]);
  }, 120_000);

  it('records a LIVE run of the Free demo scenario in all 19 locales: the key only in the header, data_collection deny on every request, the cost counted, the run replayable', async () => {
    const file = join(tmp, 'live.json');
    const result = await live([
      '--model',
      'google/gemini-3.6-flash',
      '--cap-usd',
      '1',
      '--passes',
      '1',
      '--scenarios',
      'M01',
      '--date',
      '2026-10-16',
      '--write',
      '--out',
      file,
    ]);
    expect(result.out).not.toContain(KEY);
    expect(result.out).not.toContain('STAND-IN RUN');
    expect(result.out).toContain('(LIVE)');
    expect(result.out).toContain('served by Fake Host');
    expect(result.out).toContain('never edits it');
    expect(result.out).toContain('languages_ok');
    expect(result.code).toBe(0);

    // 19 cells, 19 calls, each with the key in the Authorization header and nowhere else
    expect(seen).toHaveLength(19);
    for (const call of seen) {
      expect(call.authorization).toBe(`Bearer ${KEY}`);
      expect(JSON.stringify(call.body)).not.toContain(KEY);
      expect(call.body.model).toBe('google/gemini-3.6-flash');
      expect(JSON.stringify(call.body.provider)).toContain(
        '"data_collection":"deny"'
      );
    }

    const run = JSON.parse(readFileSync(file, 'utf8')) as EvalRun;
    expect(run.kind).toBe('LIVE');
    expect(run.label).toBe(
      'LIVE RUN of google/gemini-3.6-flash served by Fake Host'
    );
    expect(run.model).toEqual({
      slug: 'google/gemini-3.6-flash',
      provider: 'Fake Host',
    });
    expect(run.fingerprint).toMatchObject({
      model_slug: 'google/gemini-3.6-flash',
      provider: 'Fake Host',
    });
    expect(run.id).toBe(`live-${run.fingerprint.sha256.slice(0, 12)}`);
    expect(run.cells).toHaveLength(19);
    expect(run.passes).toBe(1);
    expect(run.summary.all_pass).toBe(true);
    // what the service reported is what was counted: $0.0042 a call, in micro-dollars
    expect(
      run.cells.every((cell) => cell.calls[0]!.cost_micro_usd === 4_200)
    ).toBe(true);
    expect(run.cells.every((cell) => cell.calls[0]!.host === 'Fake Host')).toBe(
      true
    );
    expect(run.summary.cost_time.messages).toBe(19);
    // units are the cost the service reported, in micro-dollars (decision D2): an instant prompt has no Understand call
    expect(run.summary.cost_time.units_p50).toBe(4_200);

    // and it can be replayed with no model, and reported
    const replayed = await script(['--replay', file]);
    expect(replayed.out).not.toContain('STAND-IN');
    expect(replayed.code).toBe(0);
    const reported = await script(['--report', file]);
    expect(reported.out).toContain('Run live-');
  }, 180_000);

  it('does not write a file unless it is asked to', async () => {
    const file = join(tmp, 'not-written.json');
    const result = await live([
      '--model',
      'google/gemini-3.6-flash',
      '--cap-usd',
      '1',
      '--passes',
      '1',
      '--scenarios',
      'M01',
      '--locales',
      'en-US',
      '--out',
      file,
    ]);
    expect(result.out).not.toContain('wrote ');
    expect(() => readFileSync(file, 'utf8')).toThrow();
  }, 120_000);

  it('makes no call at all once the cap is reached, even to ask a reply again in the same cell', async () => {
    // the first reply is not a report, so the cell would call again; the cap (one call's cost) is already reached
    costPerCall = 0.5;
    badNext = true;
    const result = await live([
      '--model',
      'google/gemini-3.6-flash',
      '--cap-usd',
      '0.5',
      '--passes',
      '1',
      '--scenarios',
      'M01',
    ]);
    expect(result.code).toBe(2);
    expect(result.out).toContain('STOPPED at the cap');
    expect(seen).toHaveLength(1);
  }, 120_000);

  it('scrubs the key from everything it prints, even when the key is what was typed', async () => {
    const result = await script(['--estimate', '--model', KEY], {
      OPENROUTER_API_KEY: KEY,
    });
    expect(result.code).toBe(2);
    expect(result.out).not.toContain(KEY);
    expect(result.out).toContain('[key] is not in config/ai-models.ts');
  });

  it('STOPS at the cap, writes nothing, and says what was spent', async () => {
    costPerCall = 0.5;
    const file = join(tmp, 'capped.json');
    const result = await live([
      '--model',
      'google/gemini-3.6-flash',
      '--cap-usd',
      '1',
      '--passes',
      '1',
      '--scenarios',
      'M01',
      '--write',
      '--out',
      file,
    ]);
    expect(result.code).toBe(2);
    expect(result.out).toContain('STOPPED at the cap');
    expect(result.out).toContain('Nothing was written');
    expect(seen).toHaveLength(2);
    expect(() => readFileSync(file, 'utf8')).toThrow();
  }, 120_000);

  it('when the service reports no cost the gateway works it out from the registry price, the run says so, and the cap still holds', async () => {
    costPerCall = undefined;
    const result = await live([
      '--model',
      'google/gemini-3.6-flash',
      '--cap-usd',
      '0.05',
      '--passes',
      '1',
      '--scenarios',
      'M01',
    ]);
    expect(result.code).toBe(2);
    expect(result.out).toContain('STOPPED at the cap');
    // 14,000 prompt tokens at 0.3 and 300 reply tokens at 2.5 USD per million: /usr/bin/bash.00495 a call; the eleventh crosses /usr/bin/bash.05
    expect(seen).toHaveLength(11);
  }, 120_000);

  it('records which costs were reported and which were worked out from the price', async () => {
    costPerCall = undefined;
    const file = join(tmp, 'estimated.json');
    await live([
      '--model',
      'google/gemini-3.6-flash',
      '--cap-usd',
      '1',
      '--passes',
      '1',
      '--scenarios',
      'M01',
      '--locales',
      'en-US',
      '--write',
      '--out',
      file,
    ]);
    const run = JSON.parse(readFileSync(file, 'utf8')) as EvalRun;
    expect(run.cells[0]!.calls[0]).toMatchObject({
      cost_micro_usd: 4_950,
      cost_estimated: true,
    });
    expect(run.summary.cost_time.estimated).toBe(1);
    const reported = join(tmp, 'reported.json');
    costPerCall = 0.0042;
    await live([
      '--model',
      'google/gemini-3.6-flash',
      '--cap-usd',
      '1',
      '--passes',
      '1',
      '--scenarios',
      'M01',
      '--locales',
      'en-US',
      '--write',
      '--out',
      reported,
    ]);
    const second = JSON.parse(readFileSync(reported, 'utf8')) as EvalRun;
    expect(second.cells[0]!.calls[0]).toMatchObject({
      cost_micro_usd: 4_200,
      cost_estimated: false,
    });
    expect(second.summary.cost_time.estimated).toBe(0);
  }, 120_000);

  it('when the service is down, every cell ends in the fixed answer, a bar fails, and nothing crashes', async () => {
    failing = true;
    const result = await live([
      '--model',
      'google/gemini-3.6-flash',
      '--cap-usd',
      '1',
      '--passes',
      '1',
      '--scenarios',
      'M01',
      '--locales',
      'en-US',
    ]);
    expect(result.code).toBe(1);
    expect(result.out).toContain('FAIL');
    expect(result.out).toContain('a bar fails');
  }, 120_000);
});
