import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

/**
 * One element of the POST /api/v1/symbol-specs body: the broker's figures for a
 * symbol at one moment (ADR-066, STACK-D-ARCHITECTURE.md section 6.9).
 *
 * Contract: gateway_contract_symbol_specs.schema.json, copied into this package
 * as src/symbol-specs/symbol-specs.schema.json. Unlike the other lane DTOs this
 * one is WRITTEN BY HAND, not generated: scripts/generate-market-data-dto.js
 * emits only type, enum and required, and these figures are used to size a lot,
 * so "a contract size of 0 or -100" must be refused at the door. The price of
 * hand-writing is drift, and test/symbol-specs-contract.spec.ts pays it: it
 * runs one corpus through the schema (Ajv) and through this class and fails on
 * any case where they disagree, and on any field one has and the other lacks.
 *
 * Every field is required. There is no "not published" here: a missing figure
 * is never a zero.
 */

/** The largest value the gateway's INTEGER columns hold (and the schema's bound). */
export const SQL_INT_MAX = 2147483647;

export class SymbolSpecDto {
  /** The MT5 terminal the figures were read from (the folder holding its MQL5 directory). */
  @IsString()
  @IsNotEmpty()
  terminal_id!: string;

  /**
   * Letters, digits, '.', '_' and '-': it becomes part of a job id and a database
   * key. No @IsString() beside it: class-validator's @Matches already refuses
   * anything that is not a string (a mutation check showed the extra decorator
   * could never be the one that decides).
   */
  @Matches(/^[A-Za-z0-9._-]{1,32}$/)
  symbol!: string;

  /** Unix seconds UTC at which the exporter read the terminal. */
  @IsInt()
  @Min(1)
  @Max(SQL_INT_MAX)
  captured_at!: number;

  @IsNumber()
  @IsPositive()
  contract_size!: number;

  @IsNumber()
  @IsPositive()
  volume_min!: number;

  @IsNumber()
  @IsPositive()
  volume_step!: number;

  @IsNumber()
  @IsPositive()
  volume_max!: number;

  @IsNumber()
  @IsPositive()
  tick_size!: number;

  /** In points. Zero is allowed (a quote with no spread is data), a negative spread is not. */
  @IsNumber()
  @Min(0)
  typical_spread!: number;

  /** Either sign, in the unit swap_mode names. */
  @IsNumber()
  swap_long!: number;

  @IsNumber()
  swap_short!: number;

  @IsNumber()
  @IsPositive()
  point!: number;

  @IsInt()
  @Min(0)
  @Max(SQL_INT_MAX)
  digits!: number;

  /** The raw ENUM_SYMBOL_SWAP_MODE value. */
  @IsInt()
  @Min(0)
  @Max(SQL_INT_MAX)
  swap_mode!: number;
}

/**
 * Field-name list, kept beside the class so test/symbol-specs-contract.spec.ts
 * can check for drift without reflecting into class-validator internals (the
 * same device the generated DTOs carry).
 */
export const SYMBOL_SPEC_DTO_FIELDS = [
  'terminal_id',
  'symbol',
  'captured_at',
  'contract_size',
  'volume_min',
  'volume_step',
  'volume_max',
  'tick_size',
  'typical_spread',
  'swap_long',
  'swap_short',
  'point',
  'digits',
  'swap_mode',
] as const;
