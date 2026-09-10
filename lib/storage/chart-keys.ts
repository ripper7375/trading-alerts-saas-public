/**
 * Object naming for the multi-timeframe chart renders.
 *
 * Deliberately separate from `r2.ts` and free of any dependency. Two reasons:
 *
 *  - The route only needs `parseChartVariant` to read a query parameter; it
 *    should not drag the AWS SDK in to do that.
 *  - These names must be pinned by a test against the renderer's own output
 *    filenames, and that test has no business loading an S3 client. (The AWS
 *    SDK also ships ESM that Jest will not parse without loosening the shared
 *    `transformIgnorePatterns`, which is not worth doing for string handling.)
 *
 * @module lib/storage/chart-keys
 */

/** The two renders produced per cycle. Both are PRO-only artifacts. */
export type ChartVariant = 'overlay' | 'standard';

export const CHART_VARIANTS: readonly ChartVariant[] = [
  'overlay',
  'standard',
] as const;

/**
 * Object key for a variant.
 *
 * MUST stay in step with the renderer's own output filenames, which
 * `mtf_render/__main__.py` builds as `<stem>_<variant>.png` from
 * `DEFAULT_OUT = "mtf_render_xauusd_m5_m15.png"`. The two are maintained in
 * different languages with nothing linking them, so a test pins them together --
 * drift here would surface as a 404 on download rather than as an error, which
 * is the same quiet failure mode that hid the renderer's `best_fit` rename.
 */
export function chartObjectKey(variant: ChartVariant): string {
  return `xauusd/mtf_render_xauusd_m5_m15_${variant}.png`;
}
