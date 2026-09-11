/**
 * Display copy for the 9 Lane 4 indices (Hero widget + tooltips).
 *
 * Deliberately NOT translated here -- these are the literal English source
 * strings this app's own convention uses directly as `t()` keys (see
 * lib/i18n/dictionaries/en-US.json's identity-mapped entries). The widget
 * calls t(entry.name) / t(entry.definition) / t(entry.tradingEdge) at render
 * time, so a dictionary with no translation for a given language degrades to
 * this English text rather than breaking.
 *
 * Content per the architecture doc's own tooltip dictionary (section 8).
 *
 * @module lib/currency-gold-indices/metadata
 */

export interface CurrencyGoldIndexMetadata {
  name: string;
  definition: string;
  tradingEdge: string;
}

export const CURRENCY_GOLD_INDEX_METADATA: Record<
  string,
  CurrencyGoldIndexMetadata
> = {
  XAUX: {
    name: 'Gold Index',
    definition:
      "Measures pure intrinsic gold purchasing power against an equally weighted basket of the world's 8 major currencies (G8).",
    tradingEdge:
      'Identifies true institutional gold demand. If XAUUSD is rising while XAUX is flat, gold is merely benefiting from a depreciating US Dollar. If XAUX is aggressively breaking above its baseline, gold is experiencing genuine global capital inflow across all fiat currencies.',
  },
  USDX: {
    name: 'USD Index',
    definition:
      'Equal-weighted US Dollar Index against EUR, JPY, GBP, AUD, NZD, CAD, and CHF. Free from the 57.6% Euro concentration bias of the legacy ICE DXY.',
    tradingEdge:
      'The primary adversary of Gold. An intraday downward divergence on USDX paired with a rising XAUX confirms the highest-probability Long setups on XAUUSD.',
  },
  EURX: {
    name: 'EUR Index',
    definition:
      'Broad-spectrum Euro valuation against the other 7 global currencies.',
    tradingEdge:
      'Measures European liquidity and macro sentiment. A surging EURX often pressures USDX lower, providing strong secondary momentum for Gold rallies.',
  },
  JPYX: {
    name: 'JPY Index',
    definition: 'Broad Yen valuation tracking global Carry Trade sentiment.',
    tradingEdge:
      'The premier Risk-Off sentiment barometer. When JPYX and XAUX rise together, global investors are aggressively seeking safe-haven shelter. Ideal for riding sustained breakout trends.',
  },
  GBPX: {
    name: 'GBP Index',
    definition:
      'Equal-weighted British Pound valuation reflecting European high-beta capital flows.',
    tradingEdge:
      'Reflects risk appetite in London sessions. Sharp divergences between GBPX and USDX signal impending London Fix volatility in Gold.',
  },
  AUDX: {
    name: 'AUD Index',
    definition:
      'The leading commodity currency index, heavily tied to raw material exports and Chinese industrial demand.',
    tradingEdge:
      'Gold and commodities proxy. When AUDX leads the currency board higher, physical commodities are in demand, confirming underlying macro support for Gold.',
  },
  NZDX: {
    name: 'NZD Index',
    definition:
      'High-beta global trade barometer sensitive to worldwide economic expansion and dairy/commodity cycles.',
    tradingEdge:
      'Measures global risk-on/risk-off sentiment. Useful for detecting Asian session momentum shifts before Europe opens.',
  },
  CADX: {
    name: 'CAD Index',
    definition: 'Energy and oil-correlated North American currency index.',
    tradingEdge:
      "Energy inflation indicator. Surging CADX points to rising energy prices, which typically boosts Gold's appeal as an inflation hedge.",
  },
  CHFX: {
    name: 'CHF Index',
    definition: 'European safe-haven and banking capital benchmark.',
    tradingEdge:
      'Geopolitical risk gauge. If Gold rises while CHFX surges, European geopolitical tensions or banking liquidity risks are escalating.',
  },
};
