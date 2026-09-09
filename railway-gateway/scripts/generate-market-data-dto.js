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

function decoratorsFor(name, propSchema, isRequired) {
  const decorators = [];
  const primary = typesOf(propSchema)[0];

  if (name === 'symbol' && propSchema.const) {
    decorators.push(`@IsIn(['${propSchema.const}'])`);
  } else if (propSchema.enum) {
    const nonNullValues = propSchema.enum.filter((v) => v !== null);
    const rendered = nonNullValues
      .map((v) => (typeof v === 'string' ? `'${v}'` : String(v)))
      .join(', ');
    decorators.push(`@IsIn([${rendered}])`);
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
  lines.push('// Generated by railway-gateway/scripts/generate-market-data-dto.js from');
  lines.push(`// ${target.schema}. Re-run \`npm run generate:dto\``);
  lines.push('// after any change to that schema file.');
  lines.push(`import { ${imports.join(', ')} } from 'class-validator';`);
  lines.push('');
  lines.push(`export class ${target.className} {`);
  // Drop the loop's trailing separator so the closing brace sits directly
  // after the last field, matching the original generator's output exactly.
  while (body.length && body[body.length - 1] === '') body.pop();
  lines.push(...body);
  lines.push('}');
  lines.push('');
  lines.push(
    '// Field-name list, generated alongside the class above, so'
  );
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
