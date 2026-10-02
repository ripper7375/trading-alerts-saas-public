import * as fs from 'fs';
import * as path from 'path';
import { validateCycleManifest } from '../src/cycle/cycle-manifest.contract';
import contractCopy from '../src/cycle/cycle-manifest.schema.json';
import { MANIFEST_THRESHOLDS } from '../src/cycle/manifest-thresholds';
import { ONE_DAY_CLOSED_BARS } from '../src/cycle/windows';
import { readPushWorkerConstants } from './helpers/push-worker-constants';

/**
 * The cycle manifest contract on the gateway side (ADR-009).
 *
 * Four things can go wrong here without anything failing loudly, and each has a
 * block below:
 *
 *   1. The gateway validates against a COPY of the contract (Railway builds from
 *      this directory only). If the copy is stale, the gateway accepts or refuses
 *      the wrong things for as long as nobody notices.
 *   2. A manifest written by hand proves only what its author imagined. The
 *      fixtures are produced by the REAL sender (scripts/generate_cycle_manifest_fixtures.py),
 *      over a full 3,000-bar world built the way the collector leaves its database.
 *   3. The validator is Ajv; the sender's tests use Python's jsonschema. A
 *      keyword the two read differently would show up as a manifest one side
 *      accepts and the other refuses. The corpus pins Ajv's verdict to
 *      jsonschema's on every case.
 *   4. Numbers the two sides must share (the priority window, the one-hour age
 *      limit, the endpoint) are read from the push worker's source.
 */

const STACK_C =
  '../../backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture';
const CONTRACT_SOURCE = path.join(
  __dirname,
  STACK_C,
  'gateway_contract_cycle_manifest.schema.json'
);
const FIXTURES = path.join(__dirname, 'fixtures');

function fixture(name: string): any {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8'));
}

describe("the gateway's copy of the contract", () => {
  it('is identical to the contract the sender is tested against', () => {
    const source = JSON.parse(fs.readFileSync(CONTRACT_SOURCE, 'utf8'));
    // If this fails the copy is stale: run `npm run sync:manifest-contract`.
    expect(contractCopy).toEqual(source);
  });

  it('is byte-identical too, so a diff between the two is always real', () => {
    const copyBytes = fs.readFileSync(
      path.join(__dirname, '../src/cycle/cycle-manifest.schema.json')
    );
    expect(copyBytes.equals(fs.readFileSync(CONTRACT_SOURCE))).toBe(true);
  });
});

describe('manifests produced by the real sender', () => {
  it.each([
    'cycle-manifest-refresh-slot.json',
    'cycle-manifest-plain-slot.json',
    'cycle-manifest-closed-newest.json',
  ])('%s is accepted', (name) => {
    const result = validateCycleManifest(fixture(name));
    expect(result).toEqual({ valid: true, manifest: fixture(name) });
  });

  it('cover the cases the gateway has to tell apart', () => {
    const refresh = fixture('cycle-manifest-refresh-slot.json');
    const plain = fixture('cycle-manifest-plain-slot.json');
    const closed = fixture('cycle-manifest-closed-newest.json');
    expect(Object.keys(refresh.timeframes)).toEqual(['M15', 'M5'].sort());
    expect(Object.keys(plain.timeframes)).toEqual(['M5']);
    expect(refresh.timeframes.M5.attempts).toBe(2);
    expect(closed.timeframes.M5.quarantined_rows).toBe(1);
    // a closed newest row leaves 288 and 96 bars, not 289 and 97
    expect(closed.timeframes.M5.bar_count).toBe(288);
    expect(closed.timeframes.M15.bar_count).toBe(96);
  });

  it('carry exactly the fields the contract requires, and the one optional field the sender now sends (nothing added to the sender alone)', () => {
    const required = [...contractCopy.required].sort();
    // optional in the contract (an older sender omits it), sent since build step 2 part 9
    const sent = [...required, 'repush_rows_unsent'].sort();
    expect(Object.keys(contractCopy.properties).sort()).toEqual(sent);
    for (const name of [
      'cycle-manifest-refresh-slot.json',
      'cycle-manifest-plain-slot.json',
    ]) {
      expect(Object.keys(fixture(name)).sort()).toEqual(sent);
    }
    const perTimeframe = [...contractCopy.$defs.timeframeCycle.required].sort();
    expect(
      Object.keys(
        fixture('cycle-manifest-refresh-slot.json').timeframes.M5
      ).sort()
    ).toEqual(perTimeframe);
  });
});

describe("Ajv agrees with Python's jsonschema on every corpus case", () => {
  const corpus: Array<{ label: string; manifest: unknown; valid: boolean }> =
    fixture('cycle-manifest-validation-corpus.json');

  it('the corpus is a real corpus: many cases, both verdicts', () => {
    expect(corpus.length).toBeGreaterThanOrEqual(90);
    expect(corpus.filter((c) => c.valid).length).toBeGreaterThanOrEqual(5);
    expect(corpus.filter((c) => !c.valid).length).toBeGreaterThanOrEqual(60);
  });

  it('gives the same verdict, case by case', () => {
    const disagreements = corpus
      .filter((c) => validateCycleManifest(c.manifest).valid !== c.valid)
      .map(
        (c) => `${c.label}: jsonschema says ${c.valid ? 'valid' : 'invalid'}`
      );
    expect(disagreements).toEqual([]);
  });

  it.each([
    'slot off the boundary [refresh]',
    'attempts zero [refresh]',
    'unknown source [plain]',
    'extra top-level field [plain]',
    'schema version 2 [refresh]',
    'hash upper case [refresh]',
  ])('refuses "%s"', (label) => {
    const entry = corpus.find((c) => c.label === label);
    expect(entry).toBeDefined();
    expect(validateCycleManifest(entry!.manifest).valid).toBe(false);
  });
});

describe('what the 400 says', () => {
  const good = fixture('cycle-manifest-refresh-slot.json');

  function errorsFor(manifest: unknown): string[] {
    const result = validateCycleManifest(manifest);
    if (result.valid) throw new Error('expected an invalid manifest');
    return result.errors;
  }

  it('names a missing field', () => {
    const { attempts: _dropped, ...withoutAttempts } = good.timeframes.M5;
    const errors = errorsFor({
      ...good,
      timeframes: { ...good.timeframes, M5: withoutAttempts },
    });
    expect(errors).toEqual(['/timeframes/M5 is missing "attempts"']);
  });

  it('names an unexpected field', () => {
    expect(errorsFor({ ...good, extra: 1 })).toEqual([
      'body has an unexpected property "extra"',
    ]);
  });

  it('says where a value is wrong', () => {
    const errors = errorsFor({
      ...good,
      timeframes: {
        ...good.timeframes,
        M5: { ...good.timeframes.M5, attempts: 0 },
      },
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('/timeframes/M5/attempts');
  });

  it('reports every problem at once, up to a limit', () => {
    const errors = errorsFor({});
    expect(errors.length).toBeGreaterThanOrEqual(7);
    const hostile = {
      ...good,
      timeframes: {
        M5: {
          ...good.timeframes.M5,
          config_hashes: Object.fromEntries(
            Array.from({ length: 200 }, (_, i) => [`unknown_${i}`, 'x'])
          ),
        },
      },
    };
    expect(errorsFor(hostile).length).toBeLessThanOrEqual(20);
  });

  it('never throws, whatever the body is', () => {
    for (const body of [
      undefined,
      null,
      0,
      'text',
      true,
      [],
      [good],
      {},
      { timeframes: null },
      { timeframes: { M5: null } },
      JSON.parse('{"__proto__": {"x": 1}}'),
    ]) {
      expect(() => validateCycleManifest(body)).not.toThrow();
      expect(validateCycleManifest(body).valid).toBe(false);
    }
  });
});

describe('numbers the gateway and the sender must share', () => {
  const sender = readPushWorkerConstants();

  it("the one-day window is the sender's priority window (rule 4)", () => {
    expect({ ...ONE_DAY_CLOSED_BARS }).toEqual(sender.priorityClosedBars);
  });

  it('the one-day window is what the architecture document says', () => {
    const arch = fs.readFileSync(
      path.join(__dirname, '../../docs/STACK-D-ARCHITECTURE.md'),
      'utf8'
    );
    const rule4 =
      /the last (\d+) closed M5 bars and (\d+) closed M15 bars/.exec(arch);
    expect(rule4).not.toBeNull();
    expect({ ...ONE_DAY_CLOSED_BARS }).toEqual({
      M5: Number(rule4![1]),
      M15: Number(rule4![2]),
    });
  });

  it('a manifest stale for the sender is stale for the gateway', () => {
    expect(MANIFEST_THRESHOLDS.staleManifestAfterSec).toBe(
      sender.manifestMaxAgeSec
    );
  });

  it('the contract version the sender writes is the one the contract requires', () => {
    expect(sender.manifestSchema).toBe(contractCopy.properties.schema.const);
  });

  it('the thresholds are the documented starting values', () => {
    expect({ ...MANIFEST_THRESHOLDS }).toEqual({
      recheckDelayMs: 5000,
      landedGiveUpAfterSec: 120,
      statisticsGraceSec: 30,
      staleManifestAfterSec: 3600,
      futureSlotToleranceSec: 600,
    });
    expect(Object.isFrozen(MANIFEST_THRESHOLDS)).toBe(true);
  });
});
