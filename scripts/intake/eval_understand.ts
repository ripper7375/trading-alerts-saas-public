/**
 * Record, check and report the run of the Understand step over the labelled question set
 * (build step 6 part 9; plan part 9; architecture 4.8 and 4.11 items 3 and 7).
 *
 *   npx tsx scripts/intake/eval_understand.ts --stand-in [--write]
 *   npx tsx scripts/intake/eval_understand.ts --live      [--write] [--concurrency 3]
 *   npx tsx scripts/intake/eval_understand.ts --report
 *   npx tsx scripts/intake/eval_understand.ts --check-stand-in
 *
 * `--live` calls the real model through the Understand adapter (`lib/intake/text/understand-model.ts`) for
 * every question that passes the door: 19 locales of 40 questions and the 13 adversarial cases, about 770
 * calls. It needs `INTAKE_UNDERSTAND_API_KEY` and `INTAKE_UNDERSTAND_MODEL` in the environment (the key is
 * read here and goes nowhere but the adapter's Authorization header). The run is named by its fingerprint,
 * `sha256(model_id:prompt_version:glossary_version:base_set_sha256)` cut to 32 characters, and written to
 * `knowledge-service/labelled/runs/<fingerprint>/<locale>.json` with a `manifest.json`; a new run is needed
 * whenever the model, the prompt, the glossary or the English base changes. Anything that is not exactly
 * the fingerprint of the current inputs is STALE and the release gate refuses it.
 *
 * `--stand-in` makes the run WITHOUT a model: the answers are the hand labels (see `helpers/labelled.ts`).
 * It is deterministic, so `--check-stand-in` can regenerate it in memory and compare with the committed
 * files. It proves the replay, the router, the scope check and the retrieval, and it measures nothing about
 * the model or about translation: the manifest says `STAND_IN`, and `--require-live-run` refuses it.
 *
 * `--dir <path>` works on another copy of the labelled folder (the tests use it). Nothing is written without `--write`. `--report` measures the committed run (the TypeScript half of the
 * gate) and prints a table per locale.
 *
 * Exit codes: 0 done, 1 a check or the bars failed, 2 usage or a missing key.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';

import { LOCALES } from '@/lib/intake';
import {
  createModelUnderstandPort,
  understandConfigFromEnv,
} from '@/lib/intake/text/understand-model';

import {
  ENGLISH,
  LABELLED_DIR,
  judge,
  judgeAdversarial,
  liveRecord,
  loadContext,
  loadRun,
  makeRun,
  makeStandInRun,
  reportOf,
  runDir,
  stalenessOf,
  type LocaleReport,
  type RecordedRun,
} from '../../__tests__/lib/intake/helpers/labelled';

const text = (value: unknown): string => JSON.stringify(value, null, 2) + '\n';

function write(run: RecordedRun, dir: string): void {
  const where = runDir(run.manifest.fingerprint, dir);
  mkdirSync(where, { recursive: true });
  writeFileSync(join(where, 'manifest.json'), text(run.manifest));
  for (const locale of LOCALES) {
    writeFileSync(join(where, `${locale}.json`), text(run.locales[locale]));
  }
  writeFileSync(
    join(dir, 'current-run.json'),
    text({
      schema: 'labelled-run-pointer/1',
      fingerprint: run.manifest.fingerprint,
    })
  );
  // an older STAND-IN run is regenerable; an older LIVE run is a measurement and stays
  const runs = join(dir, 'runs');
  for (const name of existsSync(runs) ? readdirSync(runs) : []) {
    if (name === run.manifest.fingerprint) continue;
    const manifest = join(runs, name, 'manifest.json');
    if (!existsSync(manifest)) continue;
    const old = JSON.parse(readFileSync(manifest, 'utf8')) as {
      provenance?: string;
    };
    if (old.provenance === 'STAND_IN') {
      rmSync(join(runs, name), { recursive: true, force: true });
    }
  }
}

const pct = (rate: { rate: number; hits: number; total: number }): string =>
  `${(rate.rate * 100).toFixed(1).padStart(5)}% (${rate.hits}/${rate.total})`;

function table(reports: readonly LocaleReport[]): string {
  const rows = reports.map(
    (r) =>
      `| ${r.locale.padEnd(5)} | ${pct(r.intent_match)} | ${pct(r.m_star_match)} | ${pct(r.out_of_scope)} | ${pct(r.warnings_present)} | ${pct(r.wrongly_refused)} |`
  );
  return [
    '| locale | intent match | M* match | out of scope | warnings present | in scope refused |',
    '| ------ | ------------ | -------- | ------------ | ---------------- | ---------------- |',
    ...rows,
  ].join('\n');
}

async function main(argv: string[]): Promise<number> {
  const has = (flag: string): boolean => argv.includes(flag);
  const modes = ['--live', '--stand-in', '--report', '--check-stand-in'].filter(
    has
  );
  if (modes.length !== 1) {
    console.error(
      'usage: eval_understand.ts one of --live, --stand-in, --report, --check-stand-in [--write]'
    );
    return 2;
  }
  const where = argv.indexOf('--dir');
  const dir = where === -1 ? LABELLED_DIR : (argv[where + 1] ?? LABELLED_DIR);

  if (has('--report')) {
    const run = loadRun(dir);
    const context = loadContext(dir);
    const stale = stalenessOf(run, context);
    const reports = reportOf(run.locales, context);
    console.log(
      `run ${run.manifest.fingerprint} (${run.manifest.provenance}, model ${run.manifest.model_id})`
    );
    console.log(table(reports));
    const english = run.locales[ENGLISH];
    const adversarial = await judgeAdversarial(
      context.base,
      english?.adversarial ?? []
    );
    console.log(
      `adversarial: ${adversarial.filter((v) => v.ok).length} of ${adversarial.length} refused or neutralised`
    );
    const problems = [...stale, ...judge(reports)];
    for (const v of adversarial) if (!v.ok) problems.push(`${v.id}: ${v.why}`);
    for (const p of problems) console.error(p);
    return problems.length === 0 ? 0 : 1;
  }

  if (has('--check-stand-in') || has('--stand-in')) {
    const made = await makeStandInRun(dir);
    if (has('--check-stand-in')) {
      const run = loadRun(dir);
      const same =
        run.manifest.fingerprint === made.manifest.fingerprint &&
        text(run.manifest) === text(made.manifest) &&
        LOCALES.every(
          (locale) => text(run.locales[locale]) === text(made.locales[locale])
        );
      console.log(
        same
          ? `the committed run ${made.manifest.fingerprint} equals a fresh stand-in run`
          : 'the committed run differs from a fresh stand-in run'
      );
      return same ? 0 : 1;
    }
    console.log(`stand-in run ${made.manifest.fingerprint}`);
    if (has('--write')) {
      write(made, dir);
      console.log(`written to ${runDir(made.manifest.fingerprint, dir)}`);
    } else {
      console.log('dry run: nothing written (add --write)');
    }
    return 0;
  }

  // --live
  const config = understandConfigFromEnv(process.env);
  if (config === null) {
    console.error(
      'INTAKE_UNDERSTAND_API_KEY and INTAKE_UNDERSTAND_MODEL must both be set for --live'
    );
    return 2;
  }
  const port = createModelUnderstandPort(config);
  let calls = 0;
  const counted = {
    understand: (request: Parameters<typeof port.understand>[0]) => {
      calls += 1;
      return port.understand(request);
    },
  };
  const index = argv.indexOf('--concurrency');
  const limit = index === -1 ? 3 : Math.max(1, Number(argv[index + 1]) || 3);
  const slots: Promise<unknown>[] = [];
  let running = 0;
  const throttle = async <T>(job: () => Promise<T>): Promise<T> => {
    while (running >= limit) {
      await Promise.race(slots);
    }
    running += 1;
    const p = job().finally(() => {
      running -= 1;
      slots.splice(slots.indexOf(p), 1);
    });
    slots.push(p);
    return p;
  };
  const made = await makeRun({
    provenance: 'LIVE',
    model_id: config.model,
    answer: (item) => throttle(() => liveRecord(counted, item.question)),
    answerAdversarial: (item) =>
      throttle(() => liveRecord(counted, item.question)),
    calls: () => calls,
    cost_usd: null,
    cost_note:
      'The Understand port returns the model text only, so the cost is not measured here: read it from the provider dashboard for this run and write it in cost_usd.',
    recorded_on: new Date().toISOString().slice(0, 10),
    dir,
  });
  console.log(
    `live run ${made.manifest.fingerprint} with ${config.model}: ${calls} calls`
  );
  const context = loadContext(dir);
  const reports = reportOf(made.locales, context);
  console.log(table(reports));
  const problems = judge(reports);
  for (const p of problems) console.error(p);
  if (has('--write')) {
    write(made, dir);
    console.log(`written to ${runDir(made.manifest.fingerprint, dir)}`);
  } else {
    console.log('dry run: nothing written (add --write)');
  }
  return problems.length === 0 ? 0 : 1;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
);
