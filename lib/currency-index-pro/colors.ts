/**
 * Currency Index PRO Plan — Phase 3 categorical color palette for the 8
 * G8 currency-strength lines.
 *
 * Values are the `dataviz` skill's own validated default 8-slot categorical
 * theme (fixed hue order, never cycled) -- this repo has no pre-existing
 * brand categorical palette to substitute, so the reference instance is
 * used as-is. Re-validated against this app's OWN chart surfaces (not the
 * skill's own default `#fcfcfb`/`#1a1a19`), matching `trading-chart.tsx`'s
 * real `chartChromeColors()` background values:
 *
 *   node scripts/validate_palette.js "<8 light hex>" --mode light --surface "#ffffff"
 *   node scripts/validate_palette.js "<8 dark hex>"  --mode dark  --surface "#0a0e17"
 *
 * Both passed every hard gate (lightness band, chroma floor, CVD separation,
 * normal-vision floor). Light mode carries a contrast WARN on 3 slots
 * (aqua/yellow/magenta, all < 3:1 against a white surface) -- the skill's
 * own documented "relief rule": every line ships a visible direct label
 * (lightweight-charts' `title`/`lastValueVisible`) rather than relying on
 * hue alone, which is exactly what `relative-strength-chart.tsx` does.
 *
 * The slot ORDER is the CVD-safety mechanism (not cosmetic) -- currencies
 * are assigned to slots in a fixed, arbitrary-but-stable order (no
 * currency has an inherent "rank"), never reassigned based on which
 * currencies happen to be strongest/weakest today.
 *
 * @module lib/currency-index-pro/colors
 */

import type { CurrencyCode } from './pairs';

export interface ThemedColor {
  light: string;
  dark: string;
}

export const CURRENCY_COLORS: Record<CurrencyCode, ThemedColor> = {
  USD: { light: '#2a78d6', dark: '#3987e5' }, // slot 1: blue
  EUR: { light: '#eb6834', dark: '#d95926' }, // slot 2: orange
  GBP: { light: '#1baf7a', dark: '#199e70' }, // slot 3: aqua
  JPY: { light: '#eda100', dark: '#c98500' }, // slot 4: yellow
  AUD: { light: '#e87ba4', dark: '#d55181' }, // slot 5: magenta
  CAD: { light: '#008300', dark: '#008300' }, // slot 6: green
  CHF: { light: '#4a3aa7', dark: '#9085e9' }, // slot 7: violet
  NZD: { light: '#e34948', dark: '#e66767' }, // slot 8: red
};

export function currencyColor(
  currency: CurrencyCode,
  theme: 'light' | 'dark'
): string {
  return CURRENCY_COLORS[currency][theme];
}
