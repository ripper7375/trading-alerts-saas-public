// constants/time.ts
// ECharts 'time' axis requires milliseconds.
// All API timestamps are Unix seconds. Convert at the boundary.

/** Converts Unix seconds → milliseconds for ECharts time axis */
export const toEChartsMs = (unixSeconds: number): number => unixSeconds * 1000;

/** Converts milliseconds → Unix seconds for LWC UTCTimestamp */
export const toLWCSeconds = (unixMs: number): number =>
  Math.floor(unixMs / 1000);
