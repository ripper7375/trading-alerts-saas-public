/**
 * The text of an evaluation run for a person (build step 7 part 10; architecture 5.10).
 *
 * `renderRunReport` is what `scripts/reply/eval-run.js` prints and what the hand-off quotes. A
 * STAND-IN run says so on its first line, on the line of every table and on the last, because a
 * table of 100% that measures nothing is the easiest thing in this suite to misquote.
 *
 * Pure.
 *
 * @module lib/reply/eval/report
 */

import { LANGUAGE_BAR_POINTS } from './languages';
import { STAND_IN_LABEL } from './suite';
import type { EvalRun, RunSummary } from './suite';

const points = (bp: number | null): string =>
  bp === null ? 'n/a' : (bp / 100).toFixed(2);

/** The table of 5.10 with the verdict of every row. */
export function renderBars(summary: RunSummary): string[] {
  const lines = [
    '| Test | Bar | Checked | Failed | Verdict |',
    '| --- | --- | ---: | ---: | --- |',
  ];
  for (const bar of summary.bars) {
    lines.push(
      `| ${bar.test} | ${bar.bar} | ${bar.checked} | ${bar.failed} | ${bar.ok ? 'PASS' : 'FAIL'}: ${bar.detail} |`
    );
  }
  return lines;
}

/** The score of every locale against English. */
export function renderLocales(summary: RunSummary): string[] {
  const lines = [
    `| Locale | Scored runs | Clean | Score | Gap to English | Within ${LANGUAGE_BAR_POINTS} |`,
    '| --- | ---: | ---: | ---: | ---: | --- |',
  ];
  for (const score of summary.locales) {
    lines.push(
      `| ${score.locale} | ${score.runs} | ${score.clean} | ${points(score.score_bp)} | ${points(score.gap_bp)} | ${score.ok ? 'yes' : 'NO'} |`
    );
  }
  return lines;
}

export function renderRunReport(run: EvalRun): string {
  const standIn = run.kind === 'STAND_IN';
  const lines: string[] = [];
  if (standIn) lines.push(STAND_IN_LABEL, '');
  lines.push(
    `Run ${run.id} (${run.kind}) made on ${run.made_on}, ${run.passes} pass${run.passes === 1 ? '' : 'es'}`,
    `Model ${run.model.slug} served by ${run.model.provider}`,
    `Fingerprint ${run.fingerprint.sha256}`,
    `  prompt ${run.fingerprint.prompt_version} ${run.fingerprint.prompt_sha256.slice(0, 12)}, wording ${run.fingerprint.wording_version} ${run.fingerprint.wording_sha256.slice(0, 12)}, caps ${run.fingerprint.caps_sha256.slice(0, 12)}, scenarios ${run.fingerprint.scenario_set_sha256.slice(0, 12)}`,
    `${run.summary.cells} cells, ${run.summary.scored_cells} of them scored for the languages`,
    ''
  );
  if (standIn) lines.push(`(${STAND_IN_LABEL.split(':')[0]})`);
  lines.push(...renderBars(run.summary), '');
  if (standIn) lines.push(`(${STAND_IN_LABEL.split(':')[0]})`);
  lines.push(...renderLocales(run.summary), '');
  const cost = run.summary.cost_time;
  lines.push(
    `Cost and time over ${cost.messages} replies (${cost.estimated} with a cost worked out from the price): units p50 ${cost.units_p50 ?? 'n/a'}, p90 ${cost.units_p90 ?? 'n/a'}; time p50 ${cost.latency_p50_ms ?? 'n/a'} ms, p90 ${cost.latency_p90_ms ?? 'n/a'} ms`,
    `Verdict: ${run.summary.all_pass ? 'every bar holds' : 'a bar FAILS'}`
  );
  if (standIn) {
    lines.push(
      'This verdict is about the mechanism only. It does not make any model `passed`: the gate refuses a stand-in run by name.'
    );
  }
  return lines.join('\n');
}
