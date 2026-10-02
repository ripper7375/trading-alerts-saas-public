import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  CHANNEL_SOURCES,
  MAX_REASON_LENGTH,
  MAX_SET_BY_LENGTH,
} from '../../cycle/active-indicator/channel-sources';

/**
 * Body of POST /api/v1/active-indicator. The shape is checked here (the global
 * ValidationPipe whitelists and forbids unknown fields); the RULES (a future slot
 * on a boundary, not too far ahead) are the service's, because they depend on the
 * clock and on the newest READY cycle.
 */
export class SetActiveIndicatorDto {
  @IsIn(['M5', 'M15'])
  timeframe!: 'M5' | 'M15';

  @IsIn([...CHANNEL_SOURCES])
  source!: (typeof CHANNEL_SOURCES)[number];

  @IsInt()
  effectiveSlot!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_SET_BY_LENGTH)
  setBy!: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_REASON_LENGTH)
  reason?: string;
}
