/**
 * TradingAdvisoryBanner — the mandatory risk disclaimer (spec Section 6.3).
 * Static; no props, no state.
 *
 * @module components/currency-index-pro/tables/trading-advisory-banner
 */

export function TradingAdvisoryBanner(): React.JSX.Element {
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
      <span className="font-bold">
        ⚠️ Professional Trading Advisory & Risk Protocol:
      </span>{' '}
      DavinTrade Currency Index Analysis is a relative-strength macro screener
      designed to highlight institutional capital flow anomalies. Before
      executing any order, traders MUST inspect the live candlestick chart of
      the target pair (evaluating Price Action, Key Support/Resistance
      structures, Order Blocks, and broker spread) to confirm exact execution
      timing and manage risk.
    </div>
  );
}
