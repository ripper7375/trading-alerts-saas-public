import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import Ajv2020 from 'ajv/dist/2020';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import mirror from '../src/symbol-specs/symbol-specs.schema.json';
import {
  SQL_INT_MAX,
  SYMBOL_SPEC_DTO_FIELDS,
  SymbolSpecDto,
} from '../src/gateway/dto/symbol-spec.dto';
import {
  SYMBOL_SPECS_JOB,
  SYMBOL_SPECS_QUEUE,
  symbolSpecJobId,
} from '../src/symbol-specs/symbol-specs.keys';

/**
 * The symbol-specs contract (ADR-066, STACK-D-ARCHITECTURE.md section 6.9) on
 * the gateway side. Five things can go wrong without anything failing loudly,
 * and each has a block below:
 *
 *   1. The gateway keeps a COPY of the contract (Railway builds from this
 *      directory only). A stale copy means the gateway checks the wrong rules.
 *   2. The DTO is written by hand (the generator emits no min/max, and these
 *      figures size a lot). A hand-written restatement of a schema is the thing
 *      that drifts, so one corpus is run through BOTH, and any case where they
 *      disagree fails.
 *   3. The sender (the push worker) and the receiver (the controller) must agree
 *      on the path and the fields, and the collector's columns must be the
 *      contract's.
 *   4. The DTO must fit the table it is written to (Int against Float).
 *   5. The queue, job and job-id names the controller and processor share.
 */

const STACK_C = path.join(
  __dirname,
  '../../backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/v2_29_data_pipeline_architecture'
);
const CONTRACT_SOURCE = path.join(
  STACK_C,
  'gateway_contract_symbol_specs.schema.json'
);

function read(p: string): string {
  return fs.readFileSync(p, 'utf8');
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateSchema = ajv.compile(mirror as object);

function schemaAccepts(body: unknown): boolean {
  return validateSchema(body) === true;
}

/** The way the controller's ParseArrayPipe validates an element. */
function dtoAccepts(body: unknown): boolean {
  const instance = plainToInstance(SymbolSpecDto, body as object);
  return (
    validateSync(instance, { whitelist: true, forbidNonWhitelisted: true })
      .length === 0
  );
}

describe("the gateway's copy of the contract", () => {
  it('is identical to the contract the sender is tested against', () => {
    // If this fails the copy is stale: run `npm run sync:symbol-specs-contract`.
    expect(mirror).toEqual(JSON.parse(read(CONTRACT_SOURCE)));
  });

  it('is byte-identical too, so a diff between the two is always real', () => {
    const copy = fs.readFileSync(
      path.join(__dirname, '../src/symbol-specs/symbol-specs.schema.json')
    );
    expect(copy.equals(fs.readFileSync(CONTRACT_SOURCE))).toBe(true);
  });

  it('is a valid draft 2020-12 schema that Ajv accepts in strict mode', () => {
    expect(() => new Ajv2020({ strict: true }).compile(mirror)).not.toThrow();
    expect(mirror.additionalProperties).toBe(false);
  });
});

describe('the DTO against the schema: field sets', () => {
  const props = Object.keys(mirror.properties);

  it('has the schema field set exactly, and nothing else', () => {
    expect([...SYMBOL_SPEC_DTO_FIELDS].sort()).toEqual([...props].sort());
    expect(props).toHaveLength(14);
  });

  it('requires every field (a missing figure is never a zero)', () => {
    expect([...mirror.required].sort()).toEqual([...props].sort());
  });

  it('declares a decorator on every field (a field with none would accept anything)', () => {
    const body = read(
      path.join(__dirname, '../src/gateway/dto/symbol-spec.dto.ts')
    );
    for (const field of SYMBOL_SPEC_DTO_FIELDS) {
      const declaration = new RegExp(`@\\w+\\([^)]*\\)\\s*\\n\\s*${field}!:`);
      expect(body).toMatch(declaration);
      expect(body).not.toMatch(new RegExp(`\\b${field}\\?:`));
    }
  });
});

describe('one corpus, two validators: the schema and the DTO must agree', () => {
  const valid: Record<string, unknown> = {
    terminal_id: 'MT5-A',
    symbol: 'XAUUSD',
    captured_at: 1789000000,
    contract_size: 100,
    volume_min: 0.01,
    volume_step: 0.01,
    volume_max: 100,
    tick_size: 0.01,
    typical_spread: 18,
    swap_long: -25.3,
    swap_short: 8.1,
    point: 0.01,
    digits: 2,
    swap_mode: 1,
  };

  interface Case {
    label: string;
    body: unknown;
    ok: boolean;
  }
  const corpus: Case[] = [];
  const add = (label: string, body: unknown, ok: boolean) =>
    corpus.push({ label, body, ok });
  const with_ = (overrides: Record<string, unknown>) => ({
    ...valid,
    ...overrides,
  });
  const without = (field: string) => {
    const { [field]: _dropped, ...rest } = valid;
    return rest;
  };

  add('the baseline', valid, true);

  // boundaries that must be ACCEPTED
  add('a swap of exactly 0', with_({ swap_long: 0, swap_short: 0 }), true);
  add(
    'a negative swap on both sides',
    with_({ swap_long: -3, swap_short: -4 }),
    true
  );
  add(
    'a positive swap on both sides',
    with_({ swap_long: 3, swap_short: 4 }),
    true
  );
  add('a typical spread of exactly 0', with_({ typical_spread: 0 }), true);
  add(
    'a fractional typical spread (a median of two)',
    with_({ typical_spread: 17.5 }),
    true
  );
  add('captured_at of exactly 1', with_({ captured_at: 1 }), true);
  add(
    'captured_at at the INTEGER limit',
    with_({ captured_at: SQL_INT_MAX }),
    true
  );
  add('digits of 0', with_({ digits: 0 }), true);
  add('digits at the INTEGER limit', with_({ digits: SQL_INT_MAX }), true);
  add('swap_mode of 0', with_({ swap_mode: 0 }), true);
  add(
    'swap_mode at the INTEGER limit',
    with_({ swap_mode: SQL_INT_MAX }),
    true
  );
  add('a tiny positive volume step', with_({ volume_step: 1e-9 }), true);
  add('a huge contract size', with_({ contract_size: 1e12 }), true);
  add(
    'a whole number written as a float',
    with_({ digits: 2.0, captured_at: 1789000000.0 }),
    true
  );
  add('a broker-suffixed symbol', with_({ symbol: 'XAUUSD.i' }), true);
  add('a one-character symbol', with_({ symbol: 'X' }), true);
  add('a 32-character symbol', with_({ symbol: 'A'.repeat(32) }), true);
  add('every allowed symbol character', with_({ symbol: 'aZ09._-' }), true);
  add('a terminal path-style name', with_({ terminal_id: 'C:/MT5-A' }), true);

  // the symbol, which becomes a job id and a database key
  for (const symbol of [
    '',
    ' ',
    'XAU USD',
    'XAU:USD',
    'XAUUSD\n',
    '\nXAUUSD',
    'A'.repeat(33),
    'XAU/USD',
    'ÉUR',
    'XAUUSD;',
  ]) {
    add(`symbol ${JSON.stringify(symbol)}`, with_({ symbol }), false);
  }
  add('an empty terminal_id', with_({ terminal_id: '' }), false);

  // figures that must be positive
  for (const field of [
    'contract_size',
    'volume_min',
    'volume_step',
    'volume_max',
    'tick_size',
    'point',
  ]) {
    for (const bad of [0, -1, -0.0001]) {
      add(`${field} = ${bad}`, with_({ [field]: bad }), false);
    }
  }
  add('a negative typical spread', with_({ typical_spread: -0.0001 }), false);

  // integers
  for (const field of ['captured_at', 'digits', 'swap_mode']) {
    add(`${field} = 1.5`, with_({ [field]: 1.5 }), false);
    add(
      `${field} above the INTEGER limit`,
      with_({ [field]: SQL_INT_MAX + 1 }),
      false
    );
    add(`${field} = 1e30`, with_({ [field]: 1e30 }), false);
  }
  for (const field of ['digits', 'swap_mode']) {
    add(`${field} = -1`, with_({ [field]: -1 }), false);
  }
  add('captured_at = 0', with_({ captured_at: 0 }), false);
  add('captured_at = -1', with_({ captured_at: -1 }), false);

  // every field missing, null, or the wrong type
  const wrongForString = [5, true, null, [], {}, ['XAUUSD']];
  const wrongForNumber = ['1', '', true, null, [], {}, [1]];
  for (const field of Object.keys(valid)) {
    add(`${field} missing`, without(field), false);
    const stringField = field === 'terminal_id' || field === 'symbol';
    for (const bad of stringField ? wrongForString : wrongForNumber) {
      add(`${field} = ${JSON.stringify(bad)}`, with_({ [field]: bad }), false);
    }
  }

  // the shape of the object itself
  add('an extra property', with_({ extra: 1 }), false);
  add(
    'commission (not part of this contract)',
    with_({ commission: 7 }),
    false
  );
  add('spread under its section 6.9 spelling', with_({ spread: 18 }), false);
  add('the empty object', {}, false);

  it('is a real corpus: many cases, both verdicts', () => {
    expect(corpus.length).toBeGreaterThanOrEqual(150);
    expect(corpus.filter((c) => c.ok).length).toBeGreaterThanOrEqual(15);
    expect(corpus.filter((c) => !c.ok).length).toBeGreaterThanOrEqual(120);
  });

  it('the schema gives the verdict the case says', () => {
    const wrong = corpus
      .filter((c) => schemaAccepts(c.body) !== c.ok)
      .map((c) => `${c.label}: expected ${c.ok ? 'valid' : 'invalid'}`);
    expect(wrong).toEqual([]);
  });

  it('the DTO gives the verdict the case says', () => {
    const wrong = corpus
      .filter((c) => dtoAccepts(c.body) !== c.ok)
      .map((c) => `${c.label}: expected ${c.ok ? 'valid' : 'invalid'}`);
    expect(wrong).toEqual([]);
  });

  it('gives the same verdict, case by case (the drift guard)', () => {
    const disagreements = corpus
      .filter((c) => schemaAccepts(c.body) !== dtoAccepts(c.body))
      .map(
        (c) =>
          `${c.label}: schema says ${schemaAccepts(c.body) ? 'valid' : 'invalid'}`
      );
    expect(disagreements).toEqual([]);
  });
});

describe('sender and receiver agree', () => {
  const worker = read(path.join(STACK_C, 'backfill_worker_api_gateway_v5.py'));
  const collector = read(
    path.join(STACK_C, 'export_collector_validator_v2.py')
  );

  function pythonList(source: string, name: string): string {
    const match = new RegExp(`${name}[^=]*=\\s*\\[([\\s\\S]*?)\\n\\]`).exec(
      source
    );
    if (!match) throw new Error(`${name} not found`);
    return match[1];
  }

  it("the push worker posts exactly the DTO's fields", () => {
    const columns = [...pythonList(worker, 'SPEC_COLUMNS').matchAll(/'(\w+)'/g)]
      .map((m) => m[1])
      .sort();
    expect(columns).toEqual([...SYMBOL_SPEC_DTO_FIELDS].sort());
  });

  it("the push worker's path is the controller's route", () => {
    const endpoint = /SPECS_ENDPOINT\s*=\s*'([^']+)'/.exec(worker);
    const route = /@Controller\('([^']+)'\)/.exec(
      read(path.join(__dirname, '../src/gateway/symbol-specs.controller.ts'))
    );
    expect(endpoint).not.toBeNull();
    expect(route).not.toBeNull();
    expect(endpoint![1]).toBe(`/${route![1]}`);
  });

  it("the collector's columns are the contract's, with the same types, plus the terminal", () => {
    const columns = [
      ...pythonList(collector, 'SYMBOL_SPECS_COLUMNS').matchAll(
        /\('(\w+)',\s*'(int|real|text)'\)/g
      ),
    ].map((m) => [m[1], m[2]] as const);
    expect([...columns.map(([name]) => name), 'terminal_id'].sort()).toEqual(
      [...SYMBOL_SPEC_DTO_FIELDS].sort()
    );
    const schemaType: Record<string, string> = {
      int: 'integer',
      real: 'number',
      text: 'string',
    };
    const props = mirror.properties as Record<string, { type: string }>;
    for (const [name, type] of columns) {
      expect([name, props[name].type]).toEqual([name, schemaType[type]]);
    }
  });

  it('the sender batches in numbers the controller can take in one request', () => {
    const cap = /SPEC_MAX_ROWS_PER_CYCLE\s*=\s*(\d+)/.exec(worker);
    expect(cap).not.toBeNull();
    // each element is a few hundred bytes; the body-parser limit is 100 kb
    expect(Number(cap![1]) * 600).toBeLessThan(100 * 1024);
  });
});

describe('the DTO fits the table it is written to', () => {
  const schema = read(path.join(__dirname, '../prisma/schema.prisma'));
  const model = /model\s+SymbolSpec\s*\{([\s\S]*?)\n\}/.exec(schema);

  it('finds the model', () => {
    expect(model).not.toBeNull();
  });

  const prismaType = new Map<string, string>();
  for (const line of (model ? model[1] : '').split('\n')) {
    const m = /^\s*(\w+)\s+(String|Int|Float|DateTime)\b/.exec(line);
    if (m) prismaType.set(m[1], m[2]);
  }
  const expected: Record<string, string> = {
    string: 'String',
    integer: 'Int',
    number: 'Float',
  };
  const props = mirror.properties as Record<string, { type: string }>;

  it.each(SYMBOL_SPEC_DTO_FIELDS)(
    'field %s has the column type the schema implies',
    (field) => {
      expect([field, prismaType.get(field)]).toEqual([
        field,
        expected[props[field].type],
      ]);
    }
  );

  it('keeps version server-side: the table has it, the contract does not', () => {
    expect(prismaType.get('version')).toBe('Int');
    expect(Object.keys(props)).not.toContain('version');
  });

  it('bounds every Int column at what a 32-bit INTEGER holds', () => {
    expect(SQL_INT_MAX).toBe(2 ** 31 - 1);
    const p = mirror.properties as Record<string, { maximum?: number }>;
    for (const field of ['captured_at', 'digits', 'swap_mode']) {
      expect([field, p[field].maximum]).toEqual([field, SQL_INT_MAX]);
    }
  });
});

describe('names the controller and the processor share', () => {
  it('uses the documented queue and a named job', () => {
    expect(SYMBOL_SPECS_QUEUE).toBe('symbol-specs-sync');
    expect(SYMBOL_SPECS_JOB).toBe('process');
  });

  it('keys a job by symbol and capture time, and never by an integer', () => {
    expect(symbolSpecJobId('XAUUSD', 1789000000)).toBe('XAUUSD_1789000000');
    expect(symbolSpecJobId('XAUUSD', 1789000000)).not.toMatch(/^\d+$/);
    expect(symbolSpecJobId('XAUUSD', 1789000000)).not.toBe(
      symbolSpecJobId('XAUUSD', 1789000300)
    );
    expect(symbolSpecJobId('XAUUSD', 1789000000)).not.toBe(
      symbolSpecJobId('XAUUSD.i', 1789000000)
    );
  });

  it('the controller and the module use the shared names, not their own spelling', () => {
    for (const file of [
      '../src/gateway/symbol-specs.controller.ts',
      '../src/worker/symbol-specs.processor.ts',
      '../src/gateway/gateway.module.ts',
      '../src/worker/worker.module.ts',
    ]) {
      const source = read(path.join(__dirname, file));
      expect(source).not.toContain("'symbol-specs-sync'");
      expect(source).toContain('symbol-specs.keys');
    }
  });

  it('both modules register the queue by the shared name, as every lane is registered in both', () => {
    // Either registration alone is enough for Nest to find the queue in this
    // one app, so no behaviour test can tell a wrong name in one of them from a
    // right one. The convention is checked where it is written.
    for (const file of [
      '../src/gateway/gateway.module.ts',
      '../src/worker/worker.module.ts',
    ]) {
      expect(read(path.join(__dirname, file))).toMatch(
        /registerQueue\(\{\s*name: SYMBOL_SPECS_QUEUE\b/
      );
    }
  });
});
