/**
 * @jest-environment node
 */

/**
 * The launch registry and its checker (build step 7 part 3; architecture 5.10, ADR-055, ADR-077;
 * decision D1): the table as shipped, every rule of the validator by damaging it, the launch
 * pair, the kill switch, the picker.
 */

import { AI_MODELS, type AiModel } from '@/config/ai-models';
import { DEFAULT_CALIBRATION } from '@/lib/reply/context/tokens';
import {
  AI_MODEL_REGISTRY,
  DISABLED_MODELS_ENV,
  MAX_PRICE_PER_MILLION,
  disabledModelsFromEnv,
  findModel,
  isIsoDate,
  loadRegistry,
  modelsForRole,
  parseDisabledModels,
  pickerModels,
  planLaunch,
  validateRegistry,
  vendorOf,
} from '@/lib/reply/gateway/registry';

import { registryRow } from './helpers/gateway-fixtures';

type Any = any;

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const first = (): AiModel => copy(AI_MODELS[0]) as AiModel;

const passed = (slug: string, extra: Partial<AiModel> = {}): AiModel =>
  registryRow({ slug, name: slug, ...extra });

/** A launch pair of two vendors, as it will look once S1 and part 10 have run. */
const PAIR = (): AiModel[] => [
  passed('vendor-a/one', { launch_role: 'default' }),
  passed('vendor-b/two', { launch_role: 'fallback' }),
];

describe('config/ai-models.ts as shipped (decision D1)', () => {
  it('is a valid registry', () => {
    expect(validateRegistry(AI_MODELS)).toEqual([]);
  });

  it('holds the six models of file D, in the order of the picker’s list of candidates', () => {
    expect(AI_MODELS.map((m) => [m.name, m.multiplier])).toEqual([
      ['Gemini 3.6 Flash', 1.0],
      ['DeepSeek V4 Flash', 1.0],
      ['GLM-5.2', 2.5],
      ['Kimi K3', 3.0],
      ['GPT 5.6 Terra', 8.0],
      ['Claude Sonnet 5', 10.0],
    ]);
  });

  it('ships every model as a candidate and names nobody for the launch pair', () => {
    for (const model of AI_MODELS) {
      expect(model.status).toBe('candidate');
      expect(model.launch_role).toBeNull();
      expect(model.eval_run).toBeNull();
    }
  });

  it('claims nothing it has not checked: unverified, on the safe side, with no price', () => {
    for (const model of AI_MODELS) {
      expect(model.verified_at).toBeNull();
      expect(model.vision).toBe(false);
      expect(model.json_schema).toBe(false);
      expect(model.prompt_caching).toBe('NONE');
      expect(model.price_in).toBeNull();
      expect(model.price_out).toBeNull();
      expect(model.priced_at).toBeNull();
      expect(model.languages_ok).toEqual([]);
      expect(model.units_per_msg).toBeNull();
      expect(model.context_tokens).toBeLessThanOrEqual(32_768);
      expect(model.max_output_tokens).toBeLessThanOrEqual(2_048);
    }
  });

  it('leaves the picker and the launch pair empty until a model has passed', () => {
    expect(pickerModels('FREE')).toEqual([]);
    expect(pickerModels('PRO')).toEqual([]);
    expect(planLaunch()).toEqual({ primary: null, fallback: null });
  });

  it('keeps the picker’s tier access: the default model is open to Free, the rest are Pro only', () => {
    expect(AI_MODELS.map((m) => [m.name, [...m.tier_access]])).toEqual([
      ['Gemini 3.6 Flash', ['FREE', 'PRO']],
      ['DeepSeek V4 Flash', ['PRO']],
      ['GLM-5.2', ['PRO']],
      ['Kimi K3', ['PRO']],
      ['GPT 5.6 Terra', ['PRO']],
      ['Claude Sonnet 5', ['PRO']],
    ]);
  });

  it('lets the two 1.0x models take the Understand call and the others only answer', () => {
    expect(modelsForRole('understand').map((m) => m.name)).toEqual([
      'Gemini 3.6 Flash',
      'DeepSeek V4 Flash',
    ]);
    expect(modelsForRole('answer')).toHaveLength(6);
  });

  it('uses the estimator’s starting calibration, written out here and held equal to it', () => {
    for (const model of AI_MODELS) {
      expect(model.calibration).toEqual(DEFAULT_CALIBRATION);
    }
  });

  it('names its models vendor/model, lower case, each slug once, none a :free variant', () => {
    const slugs = AI_MODELS.map((m) => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9._-]+\/[a-z0-9._-]+$/);
      expect(slug.endsWith(':free')).toBe(false);
    }
  });

  it('leaves room for the prompt and the answer inside the window it claims', () => {
    for (const model of AI_MODELS) {
      expect(
        model.context_budget + model.max_output_tokens
      ).toBeLessThanOrEqual(model.context_tokens);
    }
  });

  it('is loaded and frozen when the registry module is imported', () => {
    expect(AI_MODEL_REGISTRY).toHaveLength(6);
    expect(Object.isFrozen(AI_MODEL_REGISTRY)).toBe(true);
    expect(Object.isFrozen(AI_MODEL_REGISTRY[0])).toBe(true);
    expect(Object.isFrozen(AI_MODEL_REGISTRY[0]?.calibration)).toBe(true);
    expect(Object.isFrozen(AI_MODEL_REGISTRY[0]?.roles)).toBe(true);
    // a copy: changing the table afterwards does not reach the loaded registry
    expect(AI_MODEL_REGISTRY[0]).not.toBe(AI_MODELS[0]);
  });
});

describe('validateRegistry: what a good table looks like', () => {
  it('accepts a verified passed row, a candidate and a launch pair of two vendors', () => {
    expect(validateRegistry([passed('vendor-a/one'), first()])).toEqual([]);
    expect(validateRegistry([...PAIR(), first()])).toEqual([]);
  });

  it('accepts an optional :variant suffix other than :free', () => {
    expect(
      validateRegistry([
        passed('vendor-a/one:thinking'),
        passed('vendor-b/two:nitro'),
      ])
    ).toEqual([]);
  });

  it.each([
    ['not a list', {}],
    ['null', null],
    ['an empty list', []],
  ])('refuses a registry that is %s', (_name, value) => {
    expect(validateRegistry(value)).toEqual([
      'the registry must be a non-empty list of models',
    ]);
  });

  it('refuses a row that is not an object', () => {
    expect(validateRegistry([null])[0]).toContain('must be an object');
    expect(validateRegistry(['x'])[0]).toContain('must be an object');
    expect(validateRegistry([[]])[0]).toContain('must be an object');
  });
});

describe('validateRegistry: every rule, by damaging a good row', () => {
  /** [name, how to damage a verified passed row, a word the problem must contain] */
  const DAMAGE: [string, (row: Any) => void, string][] = [
    [
      'an unknown field (an unknown capability)',
      (r) => {
        r.streaming = true;
      },
      'streaming is not a field',
    ],
    [
      'a missing field',
      (r) => {
        delete r.name;
      },
      'name is missing',
    ],
    [
      'a slug with no vendor',
      (r) => {
        r.slug = 'model';
      },
      'vendor/model',
    ],
    [
      'an upper-case slug',
      (r) => {
        r.slug = 'Vendor/Model';
      },
      'vendor/model',
    ],
    [
      'a slug with a space',
      (r) => {
        r.slug = 'vendor/my model';
      },
      'vendor/model',
    ],
    [
      'a :free variant',
      (r) => {
        r.slug = 'vendor-a/model:free';
      },
      ':free variant is refused',
    ],
    [
      'an empty name',
      (r) => {
        r.name = ' ';
      },
      'name must be text',
    ],
    [
      'a name that is too long',
      (r) => {
        r.name = 'x'.repeat(61);
      },
      'name must be text',
    ],
    [
      'a multiplier of zero',
      (r) => {
        r.multiplier = 0;
      },
      'multiplier',
    ],
    [
      'a multiplier that is not a number',
      (r) => {
        r.multiplier = '1';
      },
      'multiplier',
    ],
    [
      'vision as a string',
      (r) => {
        r.vision = 'yes';
      },
      'vision must be true or false',
    ],
    [
      'json_schema as a number',
      (r) => {
        r.json_schema = 1;
      },
      'json_schema must be true or false',
    ],
    [
      'an unknown caching mode',
      (r) => {
        r.prompt_caching = 'SOMETIMES';
      },
      'prompt_caching must be one of',
    ],
    [
      'a context window of zero',
      (r) => {
        r.context_tokens = 0;
      },
      'context_tokens',
    ],
    [
      'a fractional context window',
      (r) => {
        r.context_tokens = 1000.5;
      },
      'context_tokens',
    ],
    [
      'a typo-sized context window',
      (r) => {
        r.context_tokens = 10_000_001;
      },
      'context_tokens',
    ],
    [
      'a budget of zero',
      (r) => {
        r.context_budget = 0;
      },
      'context_budget must be',
    ],
    [
      'an output limit of zero',
      (r) => {
        r.max_output_tokens = 0;
      },
      'max_output_tokens must be',
    ],
    [
      'a budget and an output that do not fit the window',
      (r) => {
        r.context_budget = 126_000;
      },
      'more than context_tokens',
    ],
    [
      'a language that is not one of the 19',
      (r) => {
        r.languages_ok = ['xx'];
      },
      'not one of the 19 locales',
    ],
    [
      'a language listed twice',
      (r) => {
        r.languages_ok = ['de', 'de'];
      },
      'lists de twice',
    ],
    [
      'languages that are not a list',
      (r) => {
        r.languages_ok = 'de';
      },
      'languages_ok must be a list',
    ],
    [
      'units of zero',
      (r) => {
        r.units_per_msg = 0;
      },
      'units_per_msg',
    ],
    [
      'units that are fractional',
      (r) => {
        r.units_per_msg = 1.5;
      },
      'units_per_msg',
    ],
    [
      'an evaluation run that is not an object',
      (r) => {
        r.eval_run = 'run-1';
      },
      'eval_run must be null or',
    ],
    [
      'an evaluation run with an extra key',
      (r) => {
        r.eval_run.note = 'x';
      },
      'exactly id and date',
    ],
    [
      'an evaluation run with no id',
      (r) => {
        r.eval_run.id = '';
      },
      'eval_run.id',
    ],
    [
      'an evaluation run with a long id',
      (r) => {
        r.eval_run.id = 'x'.repeat(65);
      },
      'eval_run.id',
    ],
    [
      'an evaluation run dated in February 30',
      (r) => {
        r.eval_run.date = '2026-02-30';
      },
      'eval_run.date',
    ],
    [
      'an unknown status',
      (r) => {
        r.status = 'live';
      },
      'status must be one of',
    ],
    [
      'a price in with no price out',
      (r) => {
        r.price_out = null;
      },
      'both be set or both be null',
    ],
    [
      'an input price with no output price and no date',
      (r) => {
        r.price_out = null;
        r.priced_at = null;
      },
      'a price without the date it was read',
    ],
    [
      'an output price with no input price and no date',
      (r) => {
        r.price_in = null;
        r.priced_at = null;
      },
      'a price without the date it was read',
    ],
    [
      'a negative price',
      (r) => {
        r.price_in = -1;
      },
      'price_in must be null or',
    ],
    [
      'a price with seven decimals',
      (r) => {
        r.price_in = 0.1234567;
      },
      'price_in must be null or',
    ],
    [
      'a price that is a typo',
      (r) => {
        r.price_out = MAX_PRICE_PER_MILLION + 1;
      },
      'price_out must be null or',
    ],
    [
      'a price that is a string',
      (r) => {
        r.price_in = '0.3';
      },
      'price_in must be null or',
    ],
    [
      'a price with no date',
      (r) => {
        r.priced_at = null;
      },
      'a price without the date it was read',
    ],
    [
      'a date with no price',
      (r) => {
        r.price_in = null;
        r.price_out = null;
        r.status = 'candidate';
        r.eval_run = null;
      },
      'priced_at is set but there is no price',
    ],
    [
      'a price date that is not a date',
      (r) => {
        r.priced_at = '14/10/2026';
      },
      'priced_at must be',
    ],
    [
      'a calibration that is not an object',
      (r) => {
        r.calibration = 3;
      },
      'calibration: the calibration must be an object',
    ],
    [
      'a calibration with a zero field',
      (r) => {
        r.calibration.digitsPerToken = 0;
      },
      'calibration: digitsPerToken',
    ],
    [
      'a calibration with an unknown field',
      (r) => {
        r.calibration.extra = 1;
      },
      'extra is not a calibration field',
    ],
    [
      'a calibration margin that is a typo',
      (r) => {
        r.calibration.marginBp = 20_000;
      },
      'marginBp',
    ],
    [
      'no roles',
      (r) => {
        r.roles = [];
      },
      'roles must be a non-empty list',
    ],
    [
      'an unknown role',
      (r) => {
        r.roles = ['answer', 'translate'];
      },
      'not one of understand, answer',
    ],
    [
      'a role listed twice',
      (r) => {
        r.roles = ['answer', 'answer'];
      },
      'lists answer twice',
    ],
    [
      'an empty provider allow-list',
      (r) => {
        r.provider_only = [];
      },
      'provider_only must be null or a non-empty list',
    ],
    [
      'a provider allow-list with a blank',
      (r) => {
        r.provider_only = ['Google', ' '];
      },
      'distinct, non-empty provider names',
    ],
    [
      'a provider allow-list with a duplicate',
      (r) => {
        r.provider_only = ['Google', 'Google'];
      },
      'distinct, non-empty provider names',
    ],
    [
      'no tier',
      (r) => {
        r.tier_access = [];
      },
      'tier_access must be a non-empty list',
    ],
    [
      'an unknown tier',
      (r) => {
        r.tier_access = ['ENTERPRISE'];
      },
      'not one of FREE, PRO',
    ],
    [
      'an unknown launch role',
      (r) => {
        r.launch_role = 'backup';
      },
      'launch_role must be null or one of',
    ],
    [
      'a verification date that is not a date',
      (r) => {
        r.verified_at = 'yesterday';
      },
      'verified_at must be',
    ],
    [
      'a passed model with no evaluation run',
      (r) => {
        r.eval_run = null;
      },
      'needs an evaluation run',
    ],
    [
      'a passed model with no verification date',
      (r) => {
        r.verified_at = null;
      },
      'needs a verification date',
    ],
    [
      'a passed model with no price',
      (r) => {
        r.price_in = null;
        r.price_out = null;
        r.priced_at = null;
      },
      'needs a dated price pair',
    ],
    [
      'a passed model with no input price',
      (r) => {
        r.price_in = null;
      },
      'needs a dated price pair',
    ],
    [
      'a passed model with no output price',
      (r) => {
        r.price_out = null;
      },
      'needs a dated price pair',
    ],
    [
      'a passed model with no price date',
      (r) => {
        r.priced_at = null;
      },
      'needs a dated price pair',
    ],
    [
      'a retired model that holds a launch role',
      (r) => {
        r.status = 'retired';
        r.launch_role = 'default';
      },
      'retired model cannot hold a launch role',
    ],
  ];

  it.each(DAMAGE)('refuses %s', (_name, damage, word) => {
    const row = copy(registryRow());
    damage(row);
    const problems = validateRegistry([row]);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join(' | ')).toContain(word);
  });

  it('names the row and the slug in every problem', () => {
    const row = copy(registryRow());
    row.price_in = -1;
    const [problem] = validateRegistry([
      registryRow({ slug: 'vendor-b/two' }),
      row,
    ]);
    expect(problem).toMatch(/^models\[1\] \(vendor-a\/model-one\): /);
  });

  it('refuses two rows with one slug', () => {
    expect(
      validateRegistry([passed('vendor-a/one'), passed('vendor-a/one')]).join()
    ).toContain('the slug vendor-a/one appears 2 times');
  });

  it('collects every problem of a row, not only the first', () => {
    const row = copy(registryRow());
    row.price_in = -1;
    row.status = 'live';
    row.vision = 'yes';
    expect(validateRegistry([row]).length).toBeGreaterThanOrEqual(3);
  });
});

describe('validateRegistry: an unverified row claims nothing', () => {
  const CLAIMS: [string, (row: Any) => void, string][] = [
    [
      'vision',
      (r) => {
        r.vision = true;
      },
      'must not claim vision',
    ],
    [
      'a JSON-schema mode',
      (r) => {
        r.json_schema = true;
      },
      'must not claim json_schema',
    ],
    [
      'prompt caching',
      (r) => {
        r.prompt_caching = 'AUTO';
      },
      'must not claim prompt caching',
    ],
    [
      'a price',
      (r) => {
        r.price_in = 1;
        r.price_out = 2;
        r.priced_at = '2026-10-14';
      },
      'must not carry a price',
    ],
    [
      'only an input price',
      (r) => {
        r.price_in = 1;
      },
      'must not carry a price',
    ],
    [
      'only an output price',
      (r) => {
        r.price_out = 2;
      },
      'must not carry a price',
    ],
    [
      'only a price date',
      (r) => {
        r.priced_at = '2026-10-14';
      },
      'must not carry a price',
    ],
    [
      'a language',
      (r) => {
        r.languages_ok = ['de'];
      },
      'must not claim a language',
    ],
    [
      'units per message',
      (r) => {
        r.units_per_msg = 100;
      },
      'must not carry units_per_msg',
    ],
    [
      'an evaluation run',
      (r) => {
        r.eval_run = { id: 'x', date: '2026-10-14' };
      },
      'must not carry an evaluation run',
    ],
    [
      'a launch role',
      (r) => {
        r.launch_role = 'default';
      },
      'must not hold a launch role',
    ],
    [
      'the status passed',
      (r) => {
        r.status = 'passed';
      },
      'must be a candidate',
    ],
    [
      'the status retired',
      (r) => {
        r.status = 'retired';
      },
      'must be a candidate',
    ],
    [
      'a big context window',
      (r) => {
        r.context_tokens = 32_769;
      },
      'at most 32768 tokens of context',
    ],
    [
      'a big output limit',
      (r) => {
        r.max_output_tokens = 2_049;
      },
      'at most 2048 tokens of output',
    ],
  ];

  it('accepts the shipped row as it is', () => {
    expect(validateRegistry([first()])).toEqual([]);
  });

  it.each(CLAIMS)(
    'refuses an unverified row that claims %s',
    (_name, claim, word) => {
      const row = first() as Any;
      claim(row);
      expect(validateRegistry([row]).join(' | ')).toContain(word);
    }
  );

  it('lets the floor itself through: exactly 32,768 and 2,048', () => {
    const row = first() as Any;
    row.context_tokens = 32_768;
    row.max_output_tokens = 2_048;
    row.context_budget = 30_720;
    expect(validateRegistry([row])).toEqual([]);
  });
});

describe('validateRegistry: the launch pair (ADR-055)', () => {
  it('accepts one default and one fallback of two vendors', () => {
    expect(validateRegistry(PAIR())).toEqual([]);
  });

  it('accepts no pair at all', () => {
    expect(
      validateRegistry([passed('vendor-a/one'), passed('vendor-b/two')])
    ).toEqual([]);
  });

  it('refuses two defaults', () => {
    const rows = [
      ...PAIR(),
      passed('vendor-c/three', { launch_role: 'default' }),
    ];
    expect(validateRegistry(rows).join()).toContain('names 2 default models');
  });

  it('refuses two fallbacks', () => {
    const rows = [
      ...PAIR(),
      passed('vendor-c/three', { launch_role: 'fallback' }),
    ];
    expect(validateRegistry(rows).join()).toContain('names 2 fallback models');
  });

  it('refuses a default with no fallback, and a fallback with no default', () => {
    expect(validateRegistry([PAIR()[0] as AiModel]).join()).toContain(
      'a default AND a fallback'
    );
    expect(validateRegistry([PAIR()[1] as AiModel]).join()).toContain(
      'a default AND a fallback'
    );
  });

  it('refuses a launch model that has not passed', () => {
    const rows = PAIR();
    rows[1] = passed('vendor-b/two', {
      launch_role: 'fallback',
      status: 'candidate',
    });
    expect(validateRegistry(rows).join()).toContain(
      'the fallback model vendor-b/two is not passed'
    );
  });

  it('refuses a launch model with no answer role', () => {
    const rows = PAIR();
    rows[0] = passed('vendor-a/one', {
      launch_role: 'default',
      roles: ['understand'],
    });
    expect(validateRegistry(rows).join()).toContain(
      'the default model vendor-a/one has no answer role'
    );
  });

  it('refuses a pair from one vendor: the fallback must come from another provider', () => {
    const rows = [
      passed('vendor-a/one', { launch_role: 'default' }),
      passed('vendor-a/two', { launch_role: 'fallback' }),
    ];
    expect(validateRegistry(rows).join()).toContain(
      'both vendor-a models: the fallback must come from another provider'
    );
  });
});

describe('validateRegistry: the limits are exactly where they are written', () => {
  // numbers written out here, not imported: a test that imports a limit cannot see it move
  const accepts = (damage: (row: Any) => void): void => {
    const row = copy(registryRow());
    damage(row);
    expect(validateRegistry([row])).toEqual([]);
  };
  const refuses = (damage: (row: Any) => void, word: string): void => {
    const row = copy(registryRow());
    damage(row);
    expect(validateRegistry([row]).join(' | ')).toContain(word);
  };

  it('takes a name of 60 characters and refuses one of 61 or none', () => {
    accepts((r) => {
      r.name = 'x'.repeat(60);
    });
    refuses((r) => {
      r.name = 'x'.repeat(61);
    }, 'name must be text of 1 to 60');
    refuses((r) => {
      r.name = '';
    }, 'name must be text');
  });

  it('takes a run id of 64 characters and refuses one of 65', () => {
    accepts((r) => {
      r.eval_run.id = 'x'.repeat(64);
    });
    refuses((r) => {
      r.eval_run.id = 'x'.repeat(65);
    }, 'eval_run.id must be text of 1 to 64');
    accepts((r) => {
      r.eval_run.id = 'x';
    });
  });

  it('takes a window of ten million tokens and refuses one more', () => {
    accepts((r) => {
      r.context_tokens = 10_000_000;
      r.context_budget = 9_000_000;
      r.max_output_tokens = 1_000_000;
    });
    refuses((r) => {
      r.context_tokens = 10_000_001;
      r.context_budget = 9_000_000;
      r.max_output_tokens = 1_000_000;
    }, 'context_tokens must be a whole number from 1 to 10000000');
  });

  it('takes a window, a budget and an output of one token each, and refuses zero', () => {
    accepts((r) => {
      r.context_tokens = 2;
      r.context_budget = 1;
      r.max_output_tokens = 1;
    });
    accepts((r) => {
      r.units_per_msg = 1;
    });
    refuses((r) => {
      r.context_tokens = 0;
    }, 'context_tokens');
  });

  it('takes prices of 0 and of 1,000, and refuses a price above 1,000', () => {
    accepts((r) => {
      r.price_in = 0;
      r.price_out = 0;
    });
    accepts((r) => {
      r.price_in = 1000;
      r.price_out = 1000;
    });
    refuses((r) => {
      r.price_in = 1000.000001;
    }, 'price_in must be null or a number from 0 to 1000');
    refuses((r) => {
      r.price_out = 1000.000001;
    }, 'price_out must be null or a number from 0 to 1000');
    refuses((r) => {
      r.price_in = -0.000001;
    }, 'price_in must be null or');
  });

  it('takes a price with six decimals and refuses one with seven', () => {
    accepts((r) => {
      r.price_in = 0.123456;
    });
    refuses((r) => {
      r.price_in = 0.1234567;
    }, 'six decimals');
  });
});

describe('validateRegistry: the caching modes', () => {
  it.each(['NONE', 'AUTO', 'EXPLICIT'])(
    'accepts %s on a verified row',
    (mode) => {
      const row = copy(registryRow()) as Any;
      row.prompt_caching = mode;
      expect(validateRegistry([row])).toEqual([]);
    }
  );
});

describe('loadRegistry', () => {
  it('throws for a table with exactly ONE problem, not only for several', () => {
    const bad = copy(registryRow()) as Any;
    bad.multiplier = 0;
    expect(validateRegistry([bad])).toHaveLength(1);
    expect(() => loadRegistry([bad])).toThrow(/multiplier/);
  });

  it('throws with every problem named when the table is damaged', () => {
    const bad = copy(registryRow()) as Any;
    bad.price_in = -1;
    bad.status = 'live';
    expect(() => loadRegistry([bad])).toThrow(
      /^config\/ai-models\.ts is not valid: /
    );
    expect(() => loadRegistry([bad])).toThrow(/price_in/);
    expect(() => loadRegistry([bad])).toThrow(/status must be one of/);
  });

  it('returns a frozen copy that later changes to the table do not reach', () => {
    const table = [registryRow()];
    const loaded = loadRegistry(table);
    table[0]!.name = 'Changed';
    (table[0]!.roles as Any).push('x');
    expect(loaded[0]?.name).toBe('Model One');
    expect(loaded[0]?.roles).toEqual(['understand', 'answer']);
    expect(Object.isFrozen(loaded)).toBe(true);
    expect(() => {
      (loaded[0] as Any).name = 'x';
    }).toThrow(TypeError);
  });
});

describe('isIsoDate and vendorOf', () => {
  it.each(['2026-10-14', '2028-02-29', '2026-12-31', '0001-01-01'])(
    'accepts %s',
    (d) => {
      expect(isIsoDate(d)).toBe(true);
    }
  );

  it.each([
    '2026-02-30',
    '2027-02-29',
    '2026-13-01',
    '2026-00-10',
    '2026-10-00',
    '2026-10-32',
    '26-10-14',
    '2026-1-14',
    '2026-10-14T00:00:00Z',
    ' 2026-10-14',
    '',
    null,
    20261014,
  ])('refuses %j', (d) => {
    expect(isIsoDate(d)).toBe(false);
  });

  it('gives an empty vendor for a slug that starts with a slash, and the whole slug when there is none', () => {
    expect(vendorOf('/model')).toBe('');
    expect(vendorOf('')).toBe('');
  });

  it('takes the vendor from before the slash', () => {
    expect(vendorOf('google/gemini-3.6-flash')).toBe('google');
    expect(vendorOf('z-ai/glm-5.2')).toBe('z-ai');
    expect(vendorOf('no-slash')).toBe('no-slash');
  });
});

describe('the kill switch (REPLY_DISABLED_MODELS)', () => {
  it('reads a comma-separated list, trimmed, lower-cased, blanks dropped', () => {
    expect([
      ...parseDisabledModels(' Vendor-A/One ,, vendor-b/two\n, '),
    ]).toEqual(['vendor-a/one', 'vendor-b/two']);
  });

  it('also splits on white space', () => {
    expect([...parseDisabledModels('a/b c/d\te/f')]).toEqual([
      'a/b',
      'c/d',
      'e/f',
    ]);
  });

  it.each([undefined, '', '   ', ',,,'])('is empty for %j', (value) => {
    expect(parseDisabledModels(value).size).toBe(0);
  });

  it('reads the variable from an env object it is given, and no other', () => {
    expect(DISABLED_MODELS_ENV).toBe('REPLY_DISABLED_MODELS');
    expect([
      ...disabledModelsFromEnv({ REPLY_DISABLED_MODELS: 'a/b' }),
    ]).toEqual(['a/b']);
    expect(disabledModelsFromEnv({ OTHER: 'a/b' }).size).toBe(0);
  });

  it('ignores a name that is not in the registry: a typo cannot make the switch throw', () => {
    const rows = loadRegistry(PAIR());
    const plan = planLaunch(
      parseDisabledModels('not/a-model, also-wrong'),
      rows
    );
    expect(plan.primary?.slug).toBe('vendor-a/one');
    expect(plan.fallback?.slug).toBe('vendor-b/two');
  });
});

describe('the picker', () => {
  const rows = loadRegistry([
    passed('vendor-a/one', { name: 'One', tier_access: ['FREE', 'PRO'] }),
    passed('vendor-b/two', { name: 'Two', tier_access: ['PRO'] }),
    passed('vendor-c/three', { name: 'Three', roles: ['understand'] }),
    first(),
    passed('vendor-d/four', { name: 'Four', status: 'retired' }),
  ]);

  it('lists only passed models that answer, for the tier', () => {
    expect(pickerModels('PRO', new Set(), rows).map((m) => m.name)).toEqual([
      'One',
      'Two',
    ]);
    expect(pickerModels('FREE', new Set(), rows).map((m) => m.name)).toEqual([
      'One',
    ]);
  });

  it('never lists a candidate or a retired model', () => {
    const names = pickerModels('PRO', new Set(), rows).map((m) => m.name);
    expect(names).not.toContain('Gemini 3.6 Flash');
    expect(names).not.toContain('Four');
  });

  it('drops a model the kill switch names', () => {
    expect(
      pickerModels('PRO', new Set(['vendor-a/one']), rows).map((m) => m.name)
    ).toEqual(['Two']);
  });
});

describe('planLaunch', () => {
  const rows = loadRegistry(PAIR());
  const slugs = (disabled: string[]) => {
    const plan = planLaunch(new Set(disabled), rows);
    return [plan.primary?.slug ?? null, plan.fallback?.slug ?? null];
  };

  it('asks the default first and keeps the fallback behind it', () => {
    expect(slugs([])).toEqual(['vendor-a/one', 'vendor-b/two']);
  });

  it('promotes the fallback when the default is switched off, with no fallback behind it', () => {
    expect(slugs(['vendor-a/one'])).toEqual(['vendor-b/two', null]);
  });

  it('keeps the default alone when the fallback is switched off', () => {
    expect(slugs(['vendor-b/two'])).toEqual(['vendor-a/one', null]);
  });

  it('names nobody when both are switched off', () => {
    expect(slugs(['vendor-a/one', 'vendor-b/two'])).toEqual([null, null]);
  });

  it('names nobody when no pair is named', () => {
    expect(
      planLaunch(new Set(), loadRegistry([passed('vendor-a/one')]))
    ).toEqual({
      primary: null,
      fallback: null,
    });
  });

  it('does not use a row that is not passed or cannot answer, even if it holds a launch role', () => {
    // a table that was not run through the validator: the planner does not trust it
    const raw: AiModel[] = [
      passed('vendor-a/one', { launch_role: 'default', status: 'candidate' }),
      passed('vendor-b/two', {
        launch_role: 'fallback',
        roles: ['understand'],
      }),
    ];
    expect(planLaunch(new Set(), raw)).toEqual({
      primary: null,
      fallback: null,
    });
    const half: AiModel[] = [
      passed('vendor-a/one', { launch_role: 'default', status: 'retired' }),
      passed('vendor-b/two', { launch_role: 'fallback' }),
    ];
    expect(planLaunch(new Set(), half).primary?.slug).toBe('vendor-b/two');
    expect(planLaunch(new Set(), half).fallback).toBeNull();
  });
});

describe('findModel and modelsForRole', () => {
  it('finds a model by its slug in the registry it is given, and by default in the shipped one', () => {
    expect(findModel('google/gemini-3.6-flash')?.name).toBe('Gemini 3.6 Flash');
    expect(findModel('nobody/nothing')).toBeUndefined();
    expect(findModel('vendor-a/one', loadRegistry(PAIR()))?.slug).toBe(
      'vendor-a/one'
    );
  });
});
