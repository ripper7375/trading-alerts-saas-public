// types/trendline.ts
import type { SeriesMarker, UTCTimestamp } from 'lightweight-charts';

export type TrendlineMarker = SeriesMarker<UTCTimestamp>;

export interface TrendlineSegment {
  startTime: number; // Unix seconds
  startPrice: number;
  endTime: number; // Unix seconds
  endPrice: number;
}
