/**
 * The filter presets of the economic-calendar page. No `'use client'`: the
 * server page reads the labels to translate them, and the client toolbar reads
 * the filters to apply them.
 *
 * @module components/marketing/econ-news-presets
 */

export const REGION_PRESETS = {
  all: {
    labelKey: 'econNews.region.all',
    label: 'Global (All)',
    filter: undefined as string | undefined,
  },
  majors: {
    labelKey: 'econNews.region.majors',
    label: 'Forex Majors',
    filter: 'us,eu,gb,jp,ca,au,ch,nz',
  },
  us: {
    labelKey: 'econNews.region.us',
    label: 'US Only',
    filter: 'us',
  },
  asia: {
    labelKey: 'econNews.region.asia',
    label: 'Asia-Pacific',
    filter: 'cn,jp,au,nz,in,sg',
  },
} as const;

export type RegionKey = keyof typeof REGION_PRESETS;

export const REGION_KEYS = Object.keys(REGION_PRESETS) as RegionKey[];

/** TradingView's importance filter: -1 low, 0 medium, 1 high. */
export const IMPORTANCE_ALL = '-1,0,1';
export const IMPORTANCE_MEDIUM_HIGH = '0,1';
export const IMPORTANCE_HIGH = '1';
