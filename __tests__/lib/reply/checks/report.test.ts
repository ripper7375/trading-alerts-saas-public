/**
 * @jest-environment node
 */

import { flagAll } from '@/lib/reply/checks/number-check';
import type { ChecksGroup } from '@/lib/reply/checks/report';
import {
  buildChecksGroup,
  checkAnswer,
  checkReport1,
  decideFinal,
  decideFirst,
  passFailed,
  regenerationRequest,
  runChecks,
} from '@/lib/reply/checks/report';
import type { CheckPass, ChecksInput } from '@/lib/reply/checks/report';
import type { ModelText } from '@/lib/reply/checks/wording-check';
import { validateReplyTrace } from '@/lib/reply/contracts/trace-fields';
import type {
  ReplyOutcome,
  ReplyTrace,
} from '@/lib/reply/contracts/trace-fields';

import { clone } from '../../intake/helpers/packets';
import {
  ANSWER,
  REPORT_01,
  REPORT_02,
  REPORT_03,
  makeTrace,
} from '../helpers/fixtures';
import { fixtureFor } from './helpers/checks-fixtures';

const GOOD: ModelText[] = [
  { path: 'headline', text: 'Counter-trend rally inside the M5 corridor' },
  {
    path: 'rationale[0].text',
    text: 'M5 holds above {MCD2.baseline} with 2 closes.',
  },
];
const BAD_NUMBER: ModelText[] = [
  { path: 'headline', text: 'Counter-trend rally inside the M5 corridor' },
  { path: 'rationale[0].text', text: 'M5 holds above 4367.99 with 2 closes.' },
];
const BAD_WORDING: ModelText[] = [
  { path: 'headline', text: 'Counter-trend rally inside the M5 corridor' },
  { path: 'rationale[0].text', text: 'We recommend this guaranteed setup.' },
];
const BAD_BOTH: ModelText[] = [
  { path: 'headline', text: 'A risk-free rally' },
  {
    path: 'rationale[0].text',
    text: 'M5 holds above 4367.99, 4399.01 and 82% likely.',
  },
];

async function input(texts: ModelText[]): Promise<ChecksInput> {
  const { dictionary } = await fixtureFor('01');
  return { texts, dictionary, locale: 'en-US', bias: 'LONG' };
}

const run = async (texts: ModelText[]): Promise<CheckPass> =>
  runChecks(await input(texts));

/** The fixture trace with its checks group replaced, its REGENERATE call kept only when one happened. */
function traceWith(
  group: ReplyTrace['checks'],
  outcome: ReplyOutcome = 'REPORT1'
): ReplyTrace {
  const trace = clone(makeTrace());
  trace.checks = group;
  trace.outcome = outcome;
  trace.model.calls = trace.model.calls.filter(
    (call) => call.role !== 'REGENERATE' || group.regenerations === 1
  );
  return trace;
}

const gate = makeTrace().checks.answer_gate;

describe('runChecks', () => {
  it('runs both checks and finds nothing in a good reply', async () => {
    const pass = await run(GOOD);
    expect(passFailed(pass)).toBe(false);
    expect(pass.numbers.violations).toEqual([]);
    expect(pass.wording.ok).toBe(true);
    expect(pass.numbers.exempt).toBe(1);
  });

  it('is a function of its input: the same texts give the same pass', async () => {
    for (const texts of [GOOD, BAD_NUMBER, BAD_WORDING, BAD_BOTH]) {
      const request = await input(texts);
      expect(runChecks(request)).toEqual(runChecks(request));
    }
  });

  it('does not change the texts it is given', async () => {
    const request = await input(BAD_BOTH);
    const before = JSON.stringify(request.texts);
    runChecks(request);
    expect(JSON.stringify(request.texts)).toBe(before);
  });

  it('fails on a number alone, on wording alone, and on both', async () => {
    expect(passFailed(await run(BAD_NUMBER))).toBe(true);
    expect((await run(BAD_NUMBER)).wording.ok).toBe(true);
    expect(passFailed(await run(BAD_WORDING))).toBe(true);
    expect((await run(BAD_WORDING)).numbers.violations).toEqual([]);
    const both = await run(BAD_BOTH);
    expect(both.numbers.violations.length).toBeGreaterThan(0);
    expect(both.wording.violations).toBeGreaterThan(0);
  });

  it('hands the synthesis bias to the direction guard', async () => {
    const texts = [{ path: 'headline', text: 'Go short on the bounce' }];
    const long = runChecks({ ...(await input(texts)), bias: 'LONG' });
    const short = runChecks({ ...(await input(texts)), bias: 'SHORT' });
    expect(long.wording.categories.DIRECTION_WORD).toBe(1);
    expect(short.wording.categories.DIRECTION_WORD).toBe(0);
  });
});

describe('the request for the one regeneration', () => {
  it('names the literals as the model wrote them, once each', async () => {
    const pass = await run([
      { path: 'headline', text: 'near 4367.99' },
      { path: 'rationale[0].text', text: 'again 4367.99 and 4399.01' },
    ]);
    expect(regenerationRequest(pass).numbers).toEqual(['4367.99', '4399.01']);
  });

  it('names the kind of phrase and the list phrase that matched, without its stars, once each', async () => {
    const pass = await run([
      {
        path: 'headline',
        text: 'A recommended and recommendable rally, guaranteed',
      },
      { path: 'rationale[0].text', text: 'We recommend it' },
    ]);
    const request = regenerationRequest(pass);
    expect(request.wording).toEqual([
      { category: 'ADVICE', phrase: 'recommend' },
      { category: 'GUARANTEE', phrase: 'guarantee' },
    ]);
    expect(request.wording.every((w) => !w.phrase.includes('*'))).toBe(true);
  });

  it('is empty for a pass that failed nothing', async () => {
    expect(regenerationRequest(await run(GOOD))).toEqual({
      numbers: [],
      wording: [],
    });
  });
});

describe('decideFirst: one shared regeneration (decision D11)', () => {
  it('delivers a pass that failed nothing, whether or not the balance would allow another call', async () => {
    const pass = await run(GOOD);
    for (const canRegenerate of [true, false]) {
      expect(decideFirst(pass, canRegenerate)).toEqual({
        action: 'DELIVER',
        request: null,
        fixedReason: null,
      });
    }
  });

  it.each([
    ['a number', BAD_NUMBER],
    ['wording', BAD_WORDING],
    ['both', BAD_BOTH],
  ])(
    'asks again, once, when %s failed and the balance allows',
    async (_name, texts) => {
      const pass = await run(texts);
      const decision = decideFirst(pass, true);
      expect(decision.action).toBe('REGENERATE');
      expect(decision.fixedReason).toBeNull();
      expect(decision.request).toEqual(regenerationRequest(pass));
    }
  );

  it('flags a number at once when no regeneration is possible', async () => {
    expect(decideFirst(await run(BAD_NUMBER), false)).toEqual({
      action: 'FLAG_NUMBERS',
      request: null,
      fixedReason: null,
    });
  });

  it('gives the fixed answer at once for a wording failure when no regeneration is possible', async () => {
    for (const texts of [BAD_WORDING, BAD_BOTH]) {
      expect(decideFirst(await run(texts), false)).toEqual({
        action: 'FIXED_ANSWER',
        request: null,
        fixedReason: 'WORDING_FAILED',
      });
    }
  });
});

describe('decideFinal', () => {
  it('delivers a clean pass', async () => {
    expect(decideFinal(await run(GOOD))).toEqual({
      action: 'DELIVER',
      fixedReason: null,
      flagged: [],
    });
  });

  it('flags the numbers that are still not in the context, and shows the reply', async () => {
    const pass = await run(BAD_NUMBER);
    const decision = decideFinal(pass);
    expect(decision.action).toBe('FLAG_NUMBERS');
    expect(decision.flagged.map((v) => v.raw)).toEqual(['4367.99']);
    const shown = flagAll(BAD_NUMBER, decision.flagged, 'en-US');
    expect(shown[1]?.text).toBe(
      'M5 holds above —, not verified with 2 closes.'
    );
  });

  it('gives the fixed answer for a wording failure, whatever the numbers did', async () => {
    for (const texts of [BAD_WORDING, BAD_BOTH]) {
      expect(decideFinal(await run(texts))).toEqual({
        action: 'FIXED_ANSWER',
        fixedReason: 'WORDING_FAILED',
        flagged: [],
      });
    }
  });
});

describe('the whole flow, as the trace records it', () => {
  async function flow(
    first: ModelText[],
    second: ModelText[] | null,
    canRegenerate = true
  ) {
    const firstPass = await run(first);
    const decision = decideFirst(firstPass, canRegenerate);
    const secondPass =
      decision.action === 'REGENERATE' && second !== null
        ? await run(second)
        : null;
    const final = decideFinal(secondPass ?? firstPass);
    return { firstPass, secondPass, decision, final };
  }

  const group = (f: Awaited<ReturnType<typeof flow>>, extra = {}) =>
    buildChecksGroup({
      first: f.firstPass,
      second: f.secondPass,
      final: f.final,
      shape: 'REPORT1',
      answerGate: gate,
      schemaRetries: 0,
      directionEqualsSyn: true,
      ...extra,
    });

  const valid = (
    checks: ReplyTrace['checks'],
    outcome: ReplyOutcome = 'REPORT1'
  ) => {
    const result = validateReplyTrace(traceWith(checks, outcome));
    expect(result).toMatchObject({ ok: true });
  };

  it('a clean reply: nothing asked, nothing flagged', async () => {
    const f = await flow(GOOD, null);
    const checks = group(f);
    expect(checks.numbers).toMatchObject({
      extracted: 0,
      matched: 0,
      violations: 0,
      flagged: 0,
    });
    expect(checks.wording).toMatchObject({
      violations: 0,
      fixed_answer: false,
    });
    expect(checks.regenerations).toBe(0);
    expect(checks.fixed_reason).toBeNull();
    valid(checks);
  });

  it('a wrong number, asked again and then right: the first pass is what is counted', async () => {
    const f = await flow(BAD_NUMBER, GOOD);
    expect(f.decision.action).toBe('REGENERATE');
    expect(f.final.action).toBe('DELIVER');
    const checks = group(f);
    expect(checks.numbers).toMatchObject({
      extracted: 1,
      matched: 0,
      violations: 1,
      flagged: 0,
    });
    expect(checks.numbers.classes.PRICE).toBe(1);
    expect(checks.regenerations).toBe(1);
    valid(checks);
  });

  it('a wrong number that stays wrong: shown flagged, counted as flagged', async () => {
    const f = await flow(BAD_NUMBER, BAD_NUMBER);
    expect(f.final.action).toBe('FLAG_NUMBERS');
    const checks = group(f);
    expect(checks.numbers).toMatchObject({ violations: 1, flagged: 1 });
    expect(checks.regenerations).toBe(1);
    expect(checks.wording.fixed_answer).toBe(false);
    valid(checks);
  });

  it('a banned phrase, asked again and then clean: delivered, and the violation is counted', async () => {
    const f = await flow(BAD_WORDING, GOOD);
    const checks = group(f);
    expect(checks.wording.violations).toBe(2);
    expect(checks.wording.categories).toMatchObject({
      ADVICE: 1,
      GUARANTEE: 1,
    });
    expect(checks.wording.fixed_answer).toBe(false);
    expect(checks.regenerations).toBe(1);
    valid(checks);
  });

  it('a banned phrase twice: the fixed answer, with the reason', async () => {
    const f = await flow(BAD_WORDING, BAD_WORDING);
    expect(f.final.action).toBe('FIXED_ANSWER');
    const checks = group(f);
    expect(checks.wording.fixed_answer).toBe(true);
    expect(checks.fixed_reason).toBe('WORDING_FAILED');
    expect(checks.numbers.flagged).toBe(0);
    expect(checks.regenerations).toBe(1);
    valid(checks, 'FIXED_ANSWER');
  });

  it('both kinds of failure share the one regeneration', async () => {
    const f = await flow(BAD_BOTH, GOOD);
    const checks = group(f);
    expect(checks.regenerations).toBe(1);
    expect(checks.numbers.violations).toBeGreaterThan(0);
    expect(checks.wording.violations).toBeGreaterThan(0);
    expect(f.final.action).toBe('DELIVER');
    valid(checks);
  });

  it('both kinds, then the numbers fixed but the wording not: the fixed answer, not a flagged reply', async () => {
    const f = await flow(BAD_BOTH, BAD_WORDING);
    expect(f.final.action).toBe('FIXED_ANSWER');
    const checks = group(f);
    expect(checks.numbers.flagged).toBe(0);
    valid(checks, 'FIXED_ANSWER');
  });

  it('no regeneration possible: a number is flagged, with no second call', async () => {
    const f = await flow(BAD_NUMBER, null, false);
    expect(f.secondPass).toBeNull();
    const checks = group(f);
    expect(checks.regenerations).toBe(0);
    expect(checks.numbers).toMatchObject({ violations: 1, flagged: 1 });
    valid(checks);
  });

  it('no regeneration possible: a banned phrase is the fixed answer', async () => {
    const f = await flow(BAD_WORDING, null, false);
    const checks = group(f);
    expect(checks.regenerations).toBe(0);
    expect(checks.wording.fixed_answer).toBe(true);
    valid(checks, 'FIXED_ANSWER');
  });

  it("a reason that is not the checks' own wins", async () => {
    const f = await flow(GOOD, null);
    const checks = group(f, { otherFixedReason: 'DATA_STALE' });
    expect(checks.fixed_reason).toBe('DATA_STALE');
    expect(group(f, { otherFixedReason: null }).fixed_reason).toBeNull();
  });

  it('carries what the other parts hand in', async () => {
    const f = await flow(GOOD, null);
    const checks = group(f, {
      shape: 'ANSWER',
      schemaRetries: 1,
      directionEqualsSyn: null,
      answerGate: null,
    });
    expect(checks).toMatchObject({
      shape: 'ANSWER',
      schema_retries: 1,
      direction_equals_syn: null,
      answer_gate: null,
    });
    valid(checks, 'ANSWER');
  });

  it('does not share its arrays with the passes it was built from', async () => {
    const f = await flow(BAD_BOTH, GOOD);
    const checks = group(f);
    checks.numbers.classes.PRICE += 10;
    checks.wording.categories.ADVICE += 10;
    expect(f.firstPass.numbers.classes.PRICE).not.toBe(
      checks.numbers.classes.PRICE
    );
    expect(f.firstPass.wording.categories.ADVICE).not.toBe(
      checks.wording.categories.ADVICE
    );
  });

  it('keeps matched and violations adding up to extracted in every flow', async () => {
    for (const texts of [GOOD, BAD_NUMBER, BAD_WORDING, BAD_BOTH]) {
      const f = await flow(texts, GOOD);
      const checks = group(f);
      expect(checks.numbers.matched + checks.numbers.violations).toBe(
        checks.numbers.extracted
      );
    }
  });
});

describe('checkReport1 and checkAnswer', () => {
  it('check the five fields of a Report 1 and name the zones that lack an invalidation line', async () => {
    const { dictionary } = await fixtureFor('01');
    const context = { dictionary, locale: 'en-US', bias: 'LONG' as const };
    const clean = checkReport1(REPORT_01, context);
    expect(passFailed(clean)).toBe(false);
    expect(clean.missingInvalidation).toEqual([]);
    const lacking = checkReport1(
      {
        ...REPORT_01,
        watch: [REPORT_01.watch[0] as (typeof REPORT_01.watch)[number]],
      },
      context
    );
    expect(lacking.missingInvalidation).toEqual(['Z2']);
    expect(checkReport1(REPORT_02, context).missingInvalidation).toEqual([]);
    expect(checkReport1(REPORT_03, context).missingInvalidation).toEqual([]);
  });

  it('read the headline, the three lists and every line of them', async () => {
    const { dictionary } = await fixtureFor('01');
    const context = { dictionary, locale: 'en-US', bias: 'LONG' as const };
    const report = {
      ...REPORT_01,
      headline: 'A risk-free rally',
      rationale: [{ text: 'Near 4350.72', cites: ['MCD2'] }],
      watch: [{ text: 'Act now, {Z1.invalidation}', cites: ['Z1'] }],
      risks: [{ text: 'Rumours say a cut is coming', cites: [] }],
    };
    const pass = checkReport1(report, context);
    expect(pass.wording.findings.map((f) => f.path).sort()).toEqual([
      'headline',
      'risks[0].text',
      'watch[0].text',
    ]);
    expect(pass.numbers.violations.map((v) => v.path)).toEqual([
      'rationale[0].text',
    ]);
  });

  it('read an answer in the language it declares', async () => {
    const { dictionary } = await fixtureFor('01');
    const context = { dictionary, bias: 'LONG' as const };
    expect(passFailed(checkAnswer(ANSWER, context))).toBe(false);
    const german = {
      ...ANSWER,
      locale: 'de',
      text: 'Das ist garantiert und sicher.',
    };
    expect(checkAnswer(german, context).wording.languages).toEqual([
      'de',
      'en',
    ]);
    expect(checkAnswer(german, context).wording.categories.GUARANTEE).toBe(1);
    expect(
      checkAnswer({ ...german, locale: 'en-US' }, context).wording.ok
    ).toBe(true);
  });

  it('give the trace group its alias', () => {
    const group: ChecksGroup = makeTrace().checks;
    expect(group.shape).toBe('REPORT1');
  });
});

describe('one violation is enough', () => {
  const ONE_WORDING: ModelText[] = [
    { path: 'headline', text: 'Counter-trend rally inside the M5 corridor' },
    { path: 'rationale[0].text', text: 'We recommend waiting here.' },
  ];

  it('fails a pass with exactly one wording violation and no number', async () => {
    const pass = await run(ONE_WORDING);
    expect(pass.wording.violations).toBe(1);
    expect(pass.numbers.violations).toEqual([]);
    expect(passFailed(pass)).toBe(true);
  });

  it('fails a pass with exactly one number violation and no wording', async () => {
    const pass = await run(BAD_NUMBER);
    expect(pass.numbers.violations).toHaveLength(1);
    expect(pass.wording.violations).toBe(0);
    expect(passFailed(pass)).toBe(true);
  });

  it('gives the fixed answer at once for one wording violation when no regeneration is possible', async () => {
    const pass = await run(ONE_WORDING);
    expect(decideFirst(pass, false)).toEqual({
      action: 'FIXED_ANSWER',
      request: null,
      fixedReason: 'WORDING_FAILED',
    });
    expect(decideFirst(pass, true).action).toBe('REGENERATE');
  });

  it('gives the fixed answer for one wording violation at the end', async () => {
    expect(decideFinal(await run(ONE_WORDING))).toEqual({
      action: 'FIXED_ANSWER',
      fixedReason: 'WORDING_FAILED',
      flagged: [],
    });
  });

  it('flags one number at the end and counts it', async () => {
    const pass = await run(BAD_NUMBER);
    const final = decideFinal(pass);
    expect(final.flagged).toHaveLength(1);
    const group = buildChecksGroup({
      first: pass,
      second: null,
      final,
      shape: 'REPORT1',
      answerGate: null,
      schemaRetries: 0,
      directionEqualsSyn: true,
    });
    expect(group.numbers.flagged).toBe(1);
    const clean = buildChecksGroup({
      first: pass,
      second: await run(GOOD),
      final: decideFinal(await run(GOOD)),
      shape: 'REPORT1',
      answerGate: null,
      schemaRetries: 0,
      directionEqualsSyn: true,
    });
    expect(clean.numbers.flagged).toBe(0);
  });

  it('names the phrase of a language written with a star at both ends without either star', async () => {
    const { dictionary } = await fixtureFor('01');
    const pass = runChecks({
      texts: [{ path: 'text', text: 'Wir empfehlen das.' }],
      dictionary,
      locale: 'de',
      bias: null,
    });
    const request = regenerationRequest(pass);
    expect(request.wording.length).toBeGreaterThan(0);
    for (const entry of request.wording)
      expect(entry.phrase).not.toContain('*');
    expect(request.wording[0]?.phrase).toBe('empfehl');
  });
});
