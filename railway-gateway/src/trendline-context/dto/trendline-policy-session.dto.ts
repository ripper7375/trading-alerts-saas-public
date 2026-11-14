import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * The body of POST /api/v1/trendline-context/policy: one analyst "Publish"
 * click, Layer 1 of TRENDLINE-CONTEXT-BLUEPRINT.md (in
 * backend-stack-c/.../mq5/new-market-context-synthesis-and-analysis-architecture/).
 *
 * WRITTEN BY HAND, like symbol-spec.dto.ts and for the same reason: `role`,
 * `bias_hint`, `regime_hint`, `parse_method` and `status`-shaped fields carry
 * real meaning for downstream rules (ADR-025) and must be refused at the
 * door if they are not one of the agreed words -- a generated DTO would only
 * check type and presence, not vocabulary.
 *
 * Every field is required unless the Blueprint names it optional. There is
 * no partial Publish: the VPS uploader sends the whole session every time.
 *
 * @module trendline-context/dto/trendline-policy-session
 */

/** The largest value the gateway's INTEGER columns hold. */
export const SQL_INT_MAX = 2147483647;

export const ROLE_VALUES = [
  'SUPPORT',
  'RESISTANCE',
  'TREND_UP',
  'TREND_DOWN',
  'CHANNEL_UPPER',
  'CHANNEL_LOWER',
  'PIVOT',
  'OTHER',
] as const;

export const BIAS_HINT_VALUES = ['BULLISH', 'BEARISH', 'NEUTRAL'] as const;

/**
 * Deliberately NOT the same words as MCD1's own regime_status
 * (TREND_ALIGNED_CONTINUATION, CONSOLIDATION, ...) -- see the Blueprint §4.3 --
 * so an analyst's session-level hint can never be mistaken for a sensor
 * reading just by looking at the value, without its source field.
 */
export const REGIME_HINT_VALUES = [
  'TREND_UP',
  'TREND_DOWN',
  'RANGE_BOUND',
  'TRANSITIONING',
  'UNCLEAR',
] as const;

export const PARSE_METHOD_VALUES = ['rule', 'model', 'manual'] as const;

export class TrendlinePolicyLineDto {
  /** "M15:TL3" -- stable identity across redraws; see the Blueprint §4.1 on slot vs slot_key. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  slot_key!: string;

  /** 1..12, unique only WITHIN source_timeframe -- NOT a global identity by itself. */
  @IsInt()
  @Min(1)
  @Max(99)
  slot!: number;

  /** M3 | M5 | M15 | M30 | H1 | H4, or a free label the analyst's tool was configured with. (M3 is the "Constellation" source -- fractal-based narrow channels -- its alias name, not a separate value.) */
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  source_timeframe!: string;

  @IsInt()
  @Min(1)
  @Max(SQL_INT_MAX)
  anchor1_time!: number;

  @IsNumber()
  anchor1_price!: number;

  @IsInt()
  @Min(1)
  @Max(SQL_INT_MAX)
  anchor2_time!: number;

  @IsNumber()
  anchor2_price!: number;

  @IsBoolean()
  ray_extends!: boolean;

  /** Exactly what the analyst typed. Never discarded, whatever parse_method says about the structured fields below. */
  @IsString()
  @MaxLength(2000)
  label_raw!: string;

  @IsIn(ROLE_VALUES)
  role!: (typeof ROLE_VALUES)[number];

  @IsOptional()
  @IsIn(BIAS_HINT_VALUES)
  bias_hint?: (typeof BIAS_HINT_VALUES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsIn(PARSE_METHOD_VALUES)
  parse_method!: (typeof PARSE_METHOD_VALUES)[number];
}

export class TrendlinePolicySessionDto {
  /** Letters, digits, '.', '_' and '-' -- the same shape symbol-spec.dto.ts requires, for the same reasons. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  symbol!: string;

  /** Unix seconds UTC: when "Publish / Lock" was clicked. The idempotency key together with symbol. */
  @IsInt()
  @Min(1)
  @Max(SQL_INT_MAX)
  published_at!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  overview_note?: string;

  @IsOptional()
  @IsIn(REGIME_HINT_VALUES)
  regime_hint?: (typeof REGIME_HINT_VALUES)[number];

  @IsArray()
  @IsString({ each: true })
  source_charts!: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrendlinePolicyLineDto)
  lines!: TrendlinePolicyLineDto[];
}
