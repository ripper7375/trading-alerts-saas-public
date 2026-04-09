// types/ohlcv.ts
import type { UTCTimestamp } from 'lightweight-charts';

export interface OHLCVBar {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}
