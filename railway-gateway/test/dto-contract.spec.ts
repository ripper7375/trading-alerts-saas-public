import * as fs from 'fs';
import * as path from 'path';
import { MARKET_DATA_DTO_FIELDS } from '../src/gateway/dto/market-data.dto';

/**
 * Guards against the DTO silently drifting from
 * gateway_contract_market_data.schema.json — the single source of truth for
 * the payload shape (blueprint §14 step 3: "ideally with contract tests
 * generated from that schema file rather than hand-written fixtures that
 * can drift from it"). If this fails, re-run `npm run generate:dto` and
 * commit the regenerated DTO — do not hand-edit the DTO to make this pass.
 */
describe('MarketDataDto contract', () => {
  const schemaPath = path.join(
    __dirname,
    '..',
    '..',
    'backend-stack-c',
    '1_EA-and-backfill-worker-on-contabo-vps',
    'v2_29_data_pipeline_architecture',
    'gateway_contract_market_data.schema.json'
  );
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
  const schemaFields = new Set(
    Object.keys(schema.properties).filter((k) => k !== '_centroid_admin_note')
  );

  it('has exactly 87 fields in the schema', () => {
    expect(schemaFields.size).toBe(87);
  });

  it('DTO field set matches the schema field set exactly', () => {
    const dtoFields = new Set(MARKET_DATA_DTO_FIELDS);

    const missingFromDto = [...schemaFields].filter(
      (f) => !dtoFields.has(f as never)
    );
    const extraInDto = [...dtoFields].filter((f) => !schemaFields.has(f));

    expect(missingFromDto).toEqual([]);
    expect(extraInDto).toEqual([]);
    expect(dtoFields.size).toBe(schemaFields.size);
  });

  it('every required schema field is required (non-optional) in the DTO', () => {
    // A crude but effective check: the generated DTO source marks optional
    // fields with `?:` — required fields must NOT have that marker.
    const dtoSource = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'gateway', 'dto', 'market-data.dto.ts'),
      'utf-8'
    );
    for (const requiredField of schema.required as string[]) {
      const optionalPattern = new RegExp(`\\b${requiredField}\\?:`);
      expect(optionalPattern.test(dtoSource)).toBe(false);
    }
  });
});
