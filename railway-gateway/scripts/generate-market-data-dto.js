#!/usr/bin/env node
/**
 * Generates src/gateway/dto/market-data.dto.ts mechanically from
 * gateway_contract_market_data.schema.json — the single source of truth for
 * the payload shape (per the Gateway build doc's §2.1: "should be generated
 * ... directly rather than hand-maintained"). Re-run this whenever the
 * schema file changes; do not hand-edit the generated DTO — the
 * test/dto-contract.spec.ts test fails if the two drift apart.
 *
 * Deliberately generates ONLY the constraints the schema file itself
 * declares (type/const/enum/required) — no invented min/max or sentinel
 * ranges beyond what gateway_contract_market_data.schema.json states, since
 * that file (not the architecture doc's illustrative snippet) is the
 * authoritative source for this payload shape.
 */
const fs = require('fs');
const path = require('path');

const CONTRACT_DIR = path.join(
  __dirname,
  '..',
  '..',
  'backend-stack-c',
  '1_EA-and-backfill-worker-on-contabo-vps',
  'v2_29_data_pipeline_architecture'
);
const DTO_DIR = path.join(__dirname, '..', 'src', 'gateway', 'dto');

// Each entry produces one DTO file. `skip` lists schema properties that are
// documentation-only notes rather than payload fields (the contracts use
// underscore-prefixed keys for those).
const TARGETS = [
  {
    schema: 'gateway_contract_market_data.schema.json',
    output: 'market-data.dto.ts',
    className: 'MarketDataDto',
    fieldsConst: 'MARKET_DATA_DTO_FIELDS',
    skip: ['_centroid_admin_note'],
  },
  {
    schema: 'gateway_contract_indicator_statistics.schema.json',
    output: 'indicator-statistic.dto.ts',
    className: 'IndicatorStatisticDto',
    fieldsConst: 'INDICATOR_STATISTIC_DTO_FIELDS',
    skip: [
      '_resolved_line_note',
      '_model_a_note',
      '_model_b_note',
      '_edt_note',
    ],
  },
  {
    schema: 'gateway_contract_economic_events.schema.json',
    output: 'economic-event.dto.ts',
    className: 'EconomicEventDto',
    fieldsConst: 'ECONOMIC_EVENT_DTO_FIELDS',
    // No documentation-only keys in this contract; every property is a field.
    skip: [],
  },
];

function typesOf(propSchema) {
  const t = propSchema.type;
  const arr = Array.isArray(t) ? t : [t];
  return arr.filter((x) => x !== 'null');
}

function isNullable(propSchema) {
  const t = propSchema.type;
  return Array.isArray(t) && t.includes('null');
}

// Prettier's printWidth, from the repo root's .prettierrc.
const PRINT_WIDTH = 80;

/**
 * Render `open` + a comma-separated list + `close`, wrapping the way Prettier
 * would if the one-line form would exceed printWidth.
 *
 * This exists because the generated DTOs sit under the repo root's lint-staged
 * `*.ts` glob: an over-width line here would be reformatted on commit and then
 * reverted by the next generator run, giving a diff that never settles. Rather
 * than add Prettier as a dependency of this service purely to format one
 * output file, the generator emits the already-wrapped form itself.
 *
 * `indent` is the indentation the CALLER will add to the first line (2 for a
 * decorator inside a class body, 0 for a top-level import), so continuation
 * lines have to carry their own absolute indentation.
 */
function wrapList(open, items, close, indent) {
  const oneLine = `${open}${items.join(', ')}${close}`;
  if (indent + oneLine.length <= PRINT_WIDTH) return oneLine;

  const pad = ' '.repeat(indent);
  const itemPad = ' '.repeat(indent + 2);
  const body = items.map((i) => `${itemPad}${i},`).join('\n');
  return `${open.trimEnd()}\n${body}\n${pad}${close.trimStart()}`;
}

function decoratorsFor(name, propSchema, isRequired) {
  const decorators = [];
  const primary = typesOf(propSchema)[0];

  if (name === 'symbol' && propSchema.const) {
    decorators.push(`@IsIn(['${propSchema.const}'])`);
  } else if (propSchema.enum) {
    const nonNullValues = propSchema.enum.filter((v) => v !== null);
    const items = nonNullValues.map((v) =>
      typeof v === 'string' ? `'${v}'` : String(v)
    );
    // Wrap long lists the way Prettier would. The output lives under the repo
    // root's lint-staged glob, so an over-width line here gets reformatted on
    // commit and then reverted by the next generator run - an endless diff.
    decorators.push(wrapList('@IsIn([', items, '])', 2));
  } else if (primary === 'string') {
    decorators.push('@IsString()');
  } else if (primary === 'integer') {
    decorators.push('@IsInt()');
  } else if (primary === 'number') {
    decorators.push('@IsNumber()');
  } else if (primary === 'boolean') {
    decorators.push('@IsBoolean()');
  } else if (primary === 'object') {
    decorators.push('@IsObject()');
  }

  if (!isRequired) decorators.push('@IsOptional()');
  return decorators;
}

function tsTypeFor(propSchema) {
  const primary = typesOf(propSchema)[0];
  if (primary === 'string') return 'string';
  if (primary === 'integer' || primary === 'number') return 'number';
  if (primary === 'boolean') return 'boolean';
  if (primary === 'object') return 'Record<string, unknown>';
  return 'unknown';
}

function generate(target) {
  const schema = JSON.parse(
    fs.readFileSync(path.join(CONTRACT_DIR, target.schema), 'utf-8')
  );
  const required = new Set(schema.required || []);
  const skip = new Set(target.skip || []);
  const fieldNames = Object.keys(schema.properties).filter((n) => !skip.has(n));

  // Build the body first so the import line can list ONLY the decorators this
  // particular contract actually uses — an unused import would fail lint, and
  // a fixed import list would gratuitously change the market-data DTO.
  const body = [];
  const used = new Set();

  for (const [name, propSchema] of Object.entries(schema.properties)) {
    if (skip.has(name)) continue;
    const isRequired = required.has(name);
    const decorators = decoratorsFor(name, propSchema, isRequired);
    const tsType = tsTypeFor(propSchema);
    // `!` (definite assignment) on required fields since class-validator DTOs
    // are populated by Nest's ValidationPipe, not a constructor.
    const fieldMarker = isRequired ? '!' : '?';
    const nullUnion = isNullable(propSchema) ? ' | null' : '';
    for (const d of decorators) {
      used.add(d.replace(/^@/, '').replace(/\(.*$/, ''));
      body.push(`  ${d}`);
    }
    body.push(`  ${name}${fieldMarker}: ${tsType}${nullUnion};`);
    body.push('');
  }

  // Stable order, matching the hand-written original.
  const IMPORT_ORDER = [
    'IsString',
    'IsNumber',
    'IsInt',
    'IsIn',
    'IsOptional',
    'IsBoolean',
    'IsObject',
  ];
  const imports = IMPORT_ORDER.filter((d) => used.has(d));

  const lines = [];
  lines.push('// AUTO-GENERATED — DO NOT EDIT BY HAND.');
  lines.push(
    '// Generated by railway-gateway/scripts/generate-market-data-dto.js from'
  );
  lines.push(`// ${target.schema}. Re-run \`npm run generate:dto\``);
  lines.push('// after any change to that schema file.');
  lines.push(wrapList('import { ', imports, " } from 'class-validator';", 0));
  lines.push('');
  lines.push(`export class ${target.className} {`);
  // Drop the loop's trailing separator so the closing brace sits directly
  // after the last field, matching the original generator's output exactly.
  while (body.length && body[body.length - 1] === '') body.pop();
  lines.push(...body);
  lines.push('}');
  lines.push('');
  lines.push('// Field-name list, generated alongside the class above, so');
  lines.push(
    '// test/dto-contract.spec.ts can check for drift without reflecting into'
  );
  lines.push('// class-validator internals.');
  lines.push(`export const ${target.fieldsConst} = [`);
  for (const name of fieldNames) {
    lines.push(`  '${name}',`);
  }
  lines.push('] as const;');
  lines.push('');

  const outputPath = path.join(DTO_DIR, target.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
  console.log(`Generated ${outputPath} (${fieldNames.length} fields)`);
}

for (const target of TARGETS) generate(target);
