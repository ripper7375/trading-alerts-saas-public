import {
  mergeTuning,
  readTuning,
  TimeframeTuning,
} from '../src/sensors/inputs/tuning';

/**
 * The tuning of a cycle as the bundle needs it (rule 9, ADR-015; the plan’s S5 and
 * Davin’s Q13). `market_cycles` keys it by timeframe then source; the kit’s bundle
 * keys it by source only.
 */

describe('readTuning', () => {
  it('reads the two columns of a row into per-timeframe tuning, DYNAMIC as dynamic and FROZEN as frozen', () => {
    const result = readTuning({
      config_hashes: {
        M5: { best_fit_a: 'h1', fractal_edt: 'h2' },
        M15: { non_b: 'h3' },
      },
      source_modes: { M5: { best_fit_a: 'DYNAMIC' }, M15: { non_b: 'FROZEN' } },
    });
    expect(result).toEqual({
      ok: true,
      tuning: {
        M5: {
          hashes: { best_fit_a: 'h1', fractal_edt: 'h2' },
          modes: { best_fit_a: 'dynamic' },
        },
        M15: { hashes: { non_b: 'h3' }, modes: { non_b: 'frozen' } },
      },
    });
  });

  it('a column that is NULL is nothing recorded, not an error (a row from before the promote work)', () => {
    expect(readTuning({ config_hashes: null, source_modes: null })).toEqual({
      ok: true,
      tuning: {},
    });
    expect(
      readTuning({ config_hashes: { M5: { a: 'h' } }, source_modes: null })
    ).toEqual({
      ok: true,
      tuning: { M5: { hashes: { a: 'h' }, modes: {} } },
    });
  });

  it('a timeframe that recorded nothing is absent (an M5-only slot has no M15 section)', () => {
    const result = readTuning({
      config_hashes: { M5: { a: 'h' } },
      source_modes: { M5: {} },
    });
    expect(result).toEqual({
      ok: true,
      tuning: { M5: { hashes: { a: 'h' }, modes: {} } },
    });
  });

  it.each([
    [
      'config_hashes as a list',
      { config_hashes: [], source_modes: null },
      /config_hashes is not an object/,
    ],
    [
      'config_hashes as text',
      { config_hashes: 'x', source_modes: null },
      /config_hashes is not an object/,
    ],
    [
      'a timeframe that does not exist',
      { config_hashes: { H1: {} }, source_modes: null },
      /timeframe H1/,
    ],
    [
      'a timeframe holding a list',
      { config_hashes: { M5: [] }, source_modes: null },
      /config_hashes.M5 is not an object/,
    ],
    [
      'a hash that is a number',
      { config_hashes: { M5: { a: 7 } }, source_modes: null },
      /config_hashes.M5.a is not a hash/,
    ],
    [
      'a hash that is empty',
      { config_hashes: { M5: { a: '' } }, source_modes: null },
      /config_hashes.M5.a is not a hash/,
    ],
    [
      'a mode in lower case',
      { config_hashes: null, source_modes: { M5: { a: 'dynamic' } } },
      /source_modes.M5.a is not DYNAMIC or FROZEN/,
    ],
    [
      'a mode that is a boolean',
      { config_hashes: null, source_modes: { M5: { a: true } } },
      /source_modes.M5.a/,
    ],
    [
      'a mode nobody knows',
      { config_hashes: null, source_modes: { M15: { a: 'LIQUID' } } },
      /source_modes.M15.a/,
    ],
    [
      'an inherited property name as a mode',
      { config_hashes: null, source_modes: { M5: { a: 'toString' } } },
      /source_modes.M5.a/,
    ],
  ])('refuses %s: the row cannot be trusted', (_label, row, expected) => {
    const result = readTuning(row);
    expect(result.ok).toBe(false);
    expect((result as { detail: string }).detail).toMatch(expected);
  });
});

describe('mergeTuning', () => {
  const t = (
    hashes: Record<string, string>,
    modes: Record<string, 'dynamic' | 'frozen'> = {}
  ): TimeframeTuning => ({ hashes, modes });

  it('the seeded setting (M5 best_fit_a, M15 non_b): each timeframe’s own value, every other source carried when only one chart recorded it', () => {
    const merged = mergeTuning(
      { M5: 'best_fit_a', M15: 'non_b' },
      {
        M5: t(
          { best_fit_a: 'a5', fractal_edt: 'f5', resistance: 'r5' },
          { best_fit_a: 'dynamic', fractal_edt: 'dynamic' }
        ),
        M15: t({ non_b: 'n15', sr_levels: 's15' }, { non_b: 'frozen' }),
      }
    );
    expect(merged.config_hash).toEqual({
      best_fit_a: 'a5',
      fractal_edt: 'f5',
      resistance: 'r5',
      non_b: 'n15',
      sr_levels: 's15',
    });
    expect(merged.channel_mode).toEqual({
      best_fit_a: 'dynamic',
      fractal_edt: 'dynamic',
      non_b: 'frozen',
    });
    expect(merged.refusals).toEqual([]);
    expect(merged.notes).toEqual([]);
  });

  it('in production every centroid runs on both charts: the value of the timeframe that USES the source wins, the other chart’s is ignored, and nothing is refused', () => {
    const merged = mergeTuning(
      { M5: 'best_fit_a', M15: 'non_b' },
      {
        M5: t(
          { best_fit_a: 'a-m5', non_b: 'n-m5' },
          { best_fit_a: 'dynamic', non_b: 'dynamic' }
        ),
        M15: t(
          { best_fit_a: 'a-m15', non_b: 'n-m15' },
          { best_fit_a: 'frozen', non_b: 'frozen' }
        ),
      }
    );
    expect(merged.config_hash).toEqual({ best_fit_a: 'a-m5', non_b: 'n-m15' });
    expect(merged.channel_mode).toEqual({
      best_fit_a: 'dynamic',
      non_b: 'frozen',
    });
    expect(merged.refusals).toEqual([]);
  });

  describe('Q13: the same source used by both timeframes', () => {
    it('with the same tuning on both is fine and carried once', () => {
      const merged = mergeTuning(
        { M5: 'non_b', M15: 'non_b' },
        {
          M5: t({ non_b: 'same' }, { non_b: 'dynamic' }),
          M15: t({ non_b: 'same' }, { non_b: 'dynamic' }),
        }
      );
      expect(merged.config_hash).toEqual({ non_b: 'same' });
      expect(merged.channel_mode).toEqual({ non_b: 'dynamic' });
      expect(merged.refusals).toEqual([]);
    });

    it('under two different hashes is a collision: a refusal, and no entry for it', () => {
      const merged = mergeTuning(
        { M5: 'non_b', M15: 'non_b' },
        {
          M5: t({ non_b: 'h5', sr_levels: 's' }),
          M15: t({ non_b: 'h15', sr_levels: 's' }),
        }
      );
      expect(merged.refusals).toEqual([
        {
          code: 'SOURCE_COLLISION',
          source: 'non_b',
          field: 'config_hash',
          values: { M5: 'h5', M15: 'h15' },
          detail:
            'M5 and M15 both use non_b with a different config_hash: M5 h5, M15 h15',
        },
      ]);
      expect(merged.config_hash).toEqual({ sr_levels: 's' });
    });

    it('under two different modes is a collision too', () => {
      const merged = mergeTuning(
        { M5: 'non_b', M15: 'non_b' },
        {
          M5: t({ non_b: 'h' }, { non_b: 'dynamic' }),
          M15: t({ non_b: 'h' }, { non_b: 'frozen' }),
        }
      );
      expect(merged.refusals).toHaveLength(1);
      expect(merged.refusals[0]).toMatchObject({
        code: 'SOURCE_COLLISION',
        source: 'non_b',
        field: 'channel_mode',
        values: { M5: 'dynamic', M15: 'frozen' },
      });
      expect(merged.config_hash).toEqual({ non_b: 'h' });
      expect(merged.channel_mode).toEqual({});
    });

    it('both fields can collide, and the refusals come in a fixed order (field, then source)', () => {
      const merged = mergeTuning(
        { M5: 'cherry_a', M15: 'cherry_a' },
        {
          M5: t({ cherry_a: 'x' }, { cherry_a: 'dynamic' }),
          M15: t({ cherry_a: 'y' }, { cherry_a: 'frozen' }),
        }
      );
      expect(merged.refusals.map((r) => [r.field, r.source])).toEqual([
        ['config_hash', 'cherry_a'],
        ['channel_mode', 'cherry_a'],
      ]);
    });

    it('one timeframe recording nothing for it is not a conflict (two values are needed)', () => {
      const merged = mergeTuning(
        { M5: 'non_b', M15: 'non_b' },
        { M5: t({ non_b: 'h5' }), M15: t({}) }
      );
      expect(merged.refusals).toEqual([]);
      expect(merged.config_hash).toEqual({ non_b: 'h5' });
    });

    it('a collision on a source that only one timeframe uses cannot happen: the other chart’s tuning is another indicator’s', () => {
      const merged = mergeTuning(
        { M5: 'fractal_edt', M15: 'non_b' },
        { M5: t({ non_b: 'a' }), M15: t({ non_b: 'b' }) }
      );
      expect(merged.refusals).toEqual([]);
      expect(merged.config_hash).toEqual({ non_b: 'b' });
    });
  });

  describe('a source no timeframe uses', () => {
    it('is carried when every chart that recorded it agrees (sr_levels on both, v3 and v4)', () => {
      const merged = mergeTuning(
        { M5: 'cherry_a', M15: 'non_b' },
        { M5: t({ sr_levels: 'same' }), M15: t({ sr_levels: 'same' }) }
      );
      expect(merged.config_hash).toEqual({ sr_levels: 'same' });
      expect(merged.notes).toEqual([]);
    });

    it('is left out, and noted, when they differ: no evaluator reads it and no value is a better choice than the other', () => {
      const merged = mergeTuning(
        { M5: 'cherry_a', M15: 'non_b' },
        { M5: t({ sr_levels: 'a' }), M15: t({ sr_levels: 'b' }) }
      );
      expect(merged.config_hash).toEqual({});
      expect(merged.refusals).toEqual([]);
      expect(merged.notes).toEqual([
        'config_hash of sr_levels left out: M5 and M15 recorded different values and no timeframe uses it',
      ]);
    });
  });

  it('a used source the using timeframe did not record gets no entry, even when the other chart recorded it (that would be the wrong chart’s hash)', () => {
    const merged = mergeTuning(
      { M5: 'best_fit_a', M15: 'non_b' },
      { M5: t({}), M15: t({ best_fit_a: 'from-m15', non_b: 'n' }) }
    );
    expect(merged.config_hash).toEqual({ non_b: 'n' });
  });

  it('a setting that is missing for a timeframe uses nothing there', () => {
    const merged = mergeTuning(
      { M15: 'non_b' },
      { M5: t({ best_fit_a: 'a5' }), M15: t({ non_b: 'n', best_fit_a: 'a15' }) }
    );
    // best_fit_a is used by no timeframe now, and the two charts disagree: left out
    expect(merged.config_hash).toEqual({ non_b: 'n' });
  });

  describe('precedence: what comes first does not depend on the order the row listed the sources', () => {
    // `market_cycles` columns are JSON, and the order of their keys is whatever the
    // writer or the database made it. The merge walks the sources by name so one
    // cycle always gives one bundle and one list of notes (mutant T8: no sort).
    it('the maps list the sources by name, whichever chart recorded them first', () => {
      const merged = mergeTuning(
        { M5: 'non_b', M15: 'cherry_a' },
        {
          M5: t(
            { non_b: 'n', zeta: 'z', resistance: 'r' },
            { non_b: 'dynamic', zeta: 'frozen' }
          ),
          M15: t(
            { cherry_a: 'c', zeta: 'z', alpha: 'a' },
            { cherry_a: 'frozen', alpha: 'dynamic', zeta: 'frozen' }
          ),
        }
      );
      expect(Object.keys(merged.config_hash)).toEqual([
        'alpha',
        'cherry_a',
        'non_b',
        'resistance',
        'zeta',
      ]);
      expect(Object.keys(merged.channel_mode)).toEqual([
        'alpha',
        'cherry_a',
        'non_b',
        'zeta',
      ]);
    });

    it('the notes come by source name, config_hash before channel_mode, however the row listed them', () => {
      const merged = mergeTuning(
        { M5: 'cherry_a', M15: 'non_b' },
        {
          M5: t(
            { zeta: 'z5', sr_levels: 's5', alpha: 'a5' },
            { zeta: 'dynamic', alpha: 'dynamic' }
          ),
          M15: t(
            { zeta: 'z15', sr_levels: 's15', alpha: 'a15' },
            { zeta: 'frozen', alpha: 'frozen' }
          ),
        }
      );
      const left = (field: string, source: string) =>
        `${field} of ${source} left out: M5 and M15 recorded different values and no timeframe uses it`;
      expect(merged.notes).toEqual([
        left('config_hash', 'alpha'),
        left('config_hash', 'sr_levels'),
        left('config_hash', 'zeta'),
        left('channel_mode', 'alpha'),
        left('channel_mode', 'zeta'),
      ]);
      expect(merged.refusals).toEqual([]);
    });

    it('a collision is reported beside the notes in the same fixed order: refusals by field, notes by field then source', () => {
      const merged = mergeTuning(
        { M5: 'non_b', M15: 'non_b' },
        {
          M5: t({ non_b: 'h5', zeta: 'z5', alpha: 'a5' }, { non_b: 'dynamic' }),
          M15: t(
            { non_b: 'h15', zeta: 'z15', alpha: 'a15' },
            { non_b: 'frozen' }
          ),
        }
      );
      // zeta and alpha are used by nobody: only notes. non_b collides on both fields.
      // (A cycle can have at most one colliding source, the one both timeframes use.)
      expect(merged.refusals.map((r) => [r.field, r.source])).toEqual([
        ['config_hash', 'non_b'],
        ['channel_mode', 'non_b'],
      ]);
      expect(merged.notes).toEqual([
        'config_hash of alpha left out: M5 and M15 recorded different values and no timeframe uses it',
        'config_hash of zeta left out: M5 and M15 recorded different values and no timeframe uses it',
      ]);
      expect(Object.keys(merged.config_hash)).toEqual([]);
    });
  });

  it('nothing recorded gives empty maps', () => {
    expect(mergeTuning({}, {})).toEqual({
      config_hash: {},
      channel_mode: {},
      refusals: [],
      notes: [],
    });
  });
});
