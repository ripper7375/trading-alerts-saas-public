import Ajv2020, { ErrorObject } from 'ajv/dist/2020';
import contractSchema from './cycle-manifest.schema.json';
import { Timeframe } from './slot';

/**
 * The cycle manifest contract (STACK-D-ARCHITECTURE.md section 1.4 item 2,
 * ADR-009): the one message the push worker sends per 5-minute slot, after the
 * slot's newest bars, saying what it sent.
 *
 * The contract itself is gateway_contract_cycle_manifest.schema.json, owned by
 * the VPS side and copied into this package by `npm run sync:manifest-contract`
 * (test/cycle-manifest-contract.spec.ts fails if the copy drifts). Validation
 * runs the real schema through Ajv: it is not restated in decorators, because a
 * restatement is the thing that drifts. The interfaces below are for reading
 * the code; the schema is the authority.
 */

export type TimeframeMode = 'DYNAMIC' | 'FROZEN';

export interface TimeframeCycle {
  collection_cycle_id: number;
  attempts: number;
  /** First attempt's start for the slot, unix UTC, VPS clock. */
  started_at: number;
  /** When the validating attempt was promoted, unix UTC, VPS clock. */
  validated_at: number;
  /** OHLCV export file's modification time, unix UTC. */
  export_mtime: number;
  bar_count: number;
  oldest_bar_ts: number;
  newest_bar_ts: number;
  quarantined_rows: number;
  statistics_count: number;
  config_hashes: Record<string, string>;
  source_modes: Record<string, TimeframeMode>;
}

export interface CycleManifest {
  schema: 'cycle-manifest/1';
  symbol: 'XAUUSD';
  slot: number;
  mt5_terminal: string;
  built_at: number;
  backlog_rows: number;
  /** Absent until the promote work (part 9): absent means "not measured", never zero. */
  repush_rows_unsent?: number;
  timeframes: { M5: TimeframeCycle; M15?: TimeframeCycle };
}

export type ManifestValidation =
  | { valid: true; manifest: CycleManifest }
  | { valid: false; errors: string[] };

/** Timeframes a manifest can carry, in a fixed order (M5 always, M15 on refresh slots). */
export const MANIFEST_TIMEFRAMES: readonly Timeframe[] = ['M5', 'M15'];

// strict stays ON: an unknown keyword in the schema is a typo to hear about. The
// one extension the contract uses, x-gateway-requirements, is documentation for
// whoever builds the endpoint, so it is declared rather than tolerated.
const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.addKeyword({ keyword: 'x-gateway-requirements' });
const validate = ajv.compile(contractSchema as object);

/** Maximum number of messages returned, so a hostile body cannot make a huge 400. */
const MAX_ERRORS = 20;

function describe(error: ErrorObject): string {
  const where = error.instancePath === '' ? 'body' : error.instancePath;
  const detail =
    error.keyword === 'additionalProperties'
      ? `has an unexpected property "${String(error.params['additionalProperty'])}"`
      : error.keyword === 'required'
        ? `is missing "${String(error.params['missingProperty'])}"`
        : error.message;
  return `${where} ${detail}`;
}

/**
 * Validate an unknown request body against the contract. Never throws on a bad
 * body; a body that is not even an object is just another way to be invalid.
 */
export function validateCycleManifest(body: unknown): ManifestValidation {
  if (validate(body)) {
    return { valid: true, manifest: body as unknown as CycleManifest };
  }
  const errors = (validate.errors ?? []).slice(0, MAX_ERRORS).map(describe);
  return { valid: false, errors: errors.length > 0 ? errors : ['invalid'] };
}
