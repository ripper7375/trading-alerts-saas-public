'use client';

/**
 * CurrencyIndexComparisonWorkspace -- the /pro/currency-index/compare page body.
 *
 * Owns all view state; nothing here is persisted (periods, plot type and
 * rebase reset on reload, same as the public /xaux-vs-usdx page and the PRO
 * HRMA/SMMA detail modal's what-if sliders). Every control except the index
 * pickers and the timeframe toggle is applied in the browser with no request.
 *
 * @module components/currency-index-comparison/currency-index-comparison-workspace
 */

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ArrowLeft, LineChart } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useChartAppearance } from '@/components/providers/appearance-provider';
import { useLocale } from '@/lib/context/locale-context';
import { CURRENCY_GOLD_INDEX_METADATA } from '@/lib/currency-gold-indices/metadata';
import {
  DEFAULT_HRMA_PERIOD,
  DEFAULT_SMMA_PERIOD,
  HRMA_PERIOD_MAX,
  HRMA_PERIOD_MIN,
  SMMA_PERIOD_MAX,
  SMMA_PERIOD_MIN,
} from '@/lib/currency-index-comparison/indicators';
import {
  COMPARISON_INDEX_NAMES,
  type ComparisonIndexName,
  type ComparisonTimeframe,
} from '@/lib/currency-index-comparison/series';

import {
  CurrencyIndexComparisonChart,
  REBASE_DEFAULT,
  SLOT_IDS,
  slotColor,
  type ChartSlot,
  type PlotType,
  type SlotId,
} from './currency-index-comparison-chart';
import { useCurrencyIndexComparison } from './use-currency-index-comparison';

const TIMEFRAMES: ComparisonTimeframe[] = ['M5', 'M15'];
const NONE = 'NONE';
const REBASE_MIN = 50;
const REBASE_MAX = 150;

const PLOT_TYPES: { value: PlotType; label: string }[] = [
  { value: 'line', label: 'Line' },
  { value: 'ohlc', label: 'OHLC Candles' },
  { value: 'heikin-ashi', label: 'Heiken Ashi' },
];

interface LineToggles {
  hrma: boolean;
  smma: boolean;
}

function SegmentedButtons<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}): React.JSX.Element {
  return (
    <div
      role="group"
      aria-label={label}
      className="bg-muted/40 flex items-center rounded-lg border border-border p-1 text-xs"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 font-semibold transition-colors ${
            value === o.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function CurrencyIndexComparisonWorkspace(): React.JSX.Element {
  const { t } = useLocale();
  const { resolvedTheme } = useChartAppearance();

  const [timeframe, setTimeframe] = useState<ComparisonTimeframe>('M15');
  // Defaults mirror the public page: XAUX vs USDX.
  const [symbolA, setSymbolA] = useState<ComparisonIndexName>('XAUX');
  const [symbolB, setSymbolB] = useState<ComparisonIndexName | null>('USDX');
  const [plotType, setPlotType] = useState<PlotType>('line');
  const [hrmaPeriod, setHrmaPeriod] = useState(DEFAULT_HRMA_PERIOD);
  const [smmaPeriod, setSmmaPeriod] = useState(DEFAULT_SMMA_PERIOD);
  const [bases, setBases] = useState<Record<SlotId, number>>({
    A: REBASE_DEFAULT,
    B: REBASE_DEFAULT,
  });
  const [toggles, setToggles] = useState<Record<SlotId, LineToggles>>({
    A: { hrma: true, smma: true },
    B: { hrma: true, smma: true },
  });

  const selected = useMemo(
    () => (symbolB ? [symbolA, symbolB] : [symbolA]),
    [symbolA, symbolB]
  );
  const { series, isLoading } = useCurrencyIndexComparison(selected, timeframe);

  const symbols: Record<SlotId, ComparisonIndexName | null> = {
    A: symbolA,
    B: symbolB,
  };

  const slots = useMemo<Record<SlotId, ChartSlot | null>>(() => {
    const build = (slot: SlotId, symbol: ComparisonIndexName | null) => {
      if (!symbol) return null;
      return {
        symbol,
        candles: series.find((s) => s.symbol === symbol)?.candles ?? [],
        base: bases[slot],
        showHrma: toggles[slot].hrma,
        showSmma: toggles[slot].smma,
      };
    };
    return { A: build('A', symbolA), B: build('B', symbolB) };
  }, [series, symbolA, symbolB, bases, toggles]);

  const hasData = SLOT_IDS.some((id) => (slots[id]?.candles.length ?? 0) > 0);
  const isRebased = SLOT_IDS.some((id) => bases[id] !== REBASE_DEFAULT);

  const toggleLine = (slot: SlotId, line: keyof LineToggles): void =>
    setToggles((prev) => ({
      ...prev,
      [slot]: { ...prev[slot], [line]: !prev[slot][line] },
    }));

  const pickers: {
    slot: SlotId;
    label: string;
    value: ComparisonIndexName | null;
    onChange: (v: string) => void;
    allowNone: boolean;
  }[] = [
    {
      slot: 'A',
      label: t('Index A'),
      value: symbolA,
      onChange: (v) => setSymbolA(v as ComparisonIndexName),
      allowNone: false,
    },
    {
      slot: 'B',
      label: t('Index B'),
      value: symbolB,
      onChange: (v) =>
        setSymbolB(v === NONE ? null : (v as ComparisonIndexName)),
      allowNone: true,
    },
  ];

  return (
    <div className="container mx-auto space-y-6 px-4 py-8 md:px-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-amber-500/40 bg-amber-500/15 font-semibold text-amber-600 dark:text-amber-400">
              <LineChart className="mr-1 h-3.5 w-3.5" />
              {t('Currency & Gold Index Suite')}
            </Badge>
            <Badge variant="outline" className="font-mono text-[10px]">
              PRO
            </Badge>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {t('Currency Index Comparison')}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t(
              'Compare any 2 of the 8 currency indices and the Gold Index (XAUX) over up to 3,000 bars, as a line, OHLC candles or Heiken Ashi candles, with HRMA and SMMA.'
            )}
          </p>
          <Link
            href="/pro/currency-index"
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            {t('28-pair relative-strength screener')}
          </Link>
        </div>
        <SegmentedButtons
          label={t('Timeframe')}
          options={TIMEFRAMES.map((tf) => ({ value: tf, label: tf }))}
          value={timeframe}
          onChange={setTimeframe}
        />
      </div>

      {/* Chart settings */}
      <div className="grid gap-4 rounded-2xl border border-border bg-card p-4 shadow-xl shadow-black/5 md:grid-cols-2 md:p-6 xl:grid-cols-4">
        {pickers.map((p) => (
          <div key={p.slot} className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: slotColor(p.slot, resolvedTheme) }}
              />
              {p.label}
            </p>
            <Select value={p.value ?? NONE} onValueChange={p.onChange}>
              <SelectTrigger aria-label={p.label}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {p.allowNone && (
                  <SelectItem value={NONE}>{t('None')}</SelectItem>
                )}
                {COMPARISON_INDEX_NAMES.map((name) => {
                  const other = symbols[p.slot === 'A' ? 'B' : 'A'];
                  const meta = CURRENCY_GOLD_INDEX_METADATA[name];
                  return (
                    <SelectItem
                      key={name}
                      value={name}
                      disabled={name === other}
                    >
                      {name}
                      {meta ? ` -- ${t(meta.name)}` : ''}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        ))}

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            {t('Plot type')}
          </p>
          <SegmentedButtons
            label={t('Plot type')}
            options={PLOT_TYPES.map((o) => ({ ...o, label: t(o.label) }))}
            value={plotType}
            onChange={setPlotType}
          />
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">
                {t('HRMA period')}
              </span>
              <span className="font-mono tabular-nums text-foreground">
                {hrmaPeriod}
              </span>
            </div>
            <Slider
              aria-label={t('HRMA period')}
              value={[hrmaPeriod]}
              min={HRMA_PERIOD_MIN}
              max={HRMA_PERIOD_MAX}
              step={1}
              onValueChange={(v) => setHrmaPeriod(v[0] ?? hrmaPeriod)}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">
                {t('SMMA period')}
              </span>
              <span className="font-mono tabular-nums text-foreground">
                {smmaPeriod}
              </span>
            </div>
            <Slider
              aria-label={t('SMMA period')}
              value={[smmaPeriod]}
              min={SMMA_PERIOD_MIN}
              max={SMMA_PERIOD_MAX}
              step={1}
              onValueChange={(v) => setSmmaPeriod(v[0] ?? smmaPeriod)}
            />
          </div>
        </div>
      </div>

      {/* Rebase controls -- identical behaviour to the public page. */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xl shadow-black/5 md:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">
            {t('Rebase for display')}
          </p>
          <button
            type="button"
            disabled={!isRebased}
            onClick={() => setBases({ A: REBASE_DEFAULT, B: REBASE_DEFAULT })}
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t('Reset')}
          </button>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
          {t(
            'Rebasing shifts a line or candle set up or down for easier reading. It is display-only and never changes the real index values.'
          )}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {SLOT_IDS.map((slot) => {
            const symbol = symbols[slot];
            if (!symbol) return null;
            return (
              <div key={slot} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: slotColor(slot, resolvedTheme),
                      }}
                    />
                    {symbol} {t('base')}
                  </span>
                  <span className="font-mono tabular-nums text-foreground">
                    {bases[slot]}
                  </span>
                </div>
                <Slider
                  aria-label={`${symbol} ${t('base')}`}
                  value={[bases[slot]]}
                  min={REBASE_MIN}
                  max={REBASE_MAX}
                  step={1}
                  onValueChange={(v) =>
                    setBases((prev) => ({
                      ...prev,
                      [slot]: v[0] ?? prev[slot],
                    }))
                  }
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      <div className="relative space-y-3 rounded-2xl border border-border bg-card p-4 shadow-xl shadow-black/5 md:p-6">
        {/* Legend: click an indicator to hide or show it. */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          {SLOT_IDS.map((slot) => {
            const symbol = symbols[slot];
            if (!symbol) return null;
            const color = slotColor(slot, resolvedTheme);
            return (
              <div key={slot} className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  {symbol}
                </span>
                {(
                  [
                    ['hrma', `HRMA(${hrmaPeriod})`, 'dashed', hrmaPeriod],
                    ['smma', `SMMA(${smmaPeriod})`, 'dotted', smmaPeriod],
                  ] as const
                ).map(([line, label, style, period]) => {
                  const on = toggles[slot][line];
                  const barCount = slots[slot]?.candles.length ?? 0;
                  // Both indicators draw nothing until there are `period`
                  // bars (HRMA per its MQL5 `rates_total < len_hrma` guard,
                  // SMMA by its seed). Say so, rather than leave an "on"
                  // chip with no line and no explanation.
                  const tooFewBars = on && barCount > 0 && barCount < period;
                  return (
                    <button
                      key={line}
                      type="button"
                      aria-pressed={on}
                      title={on ? t('Click to hide') : t('Click to show')}
                      onClick={() => toggleLine(slot, line)}
                      className={`flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono transition-colors ${
                        on
                          ? 'border-border text-foreground'
                          : 'border-dashed border-border text-muted-foreground line-through opacity-60'
                      }`}
                    >
                      <span
                        className="inline-block w-4"
                        style={{ borderTop: `2px ${style} ${color}` }}
                      />
                      {label}
                      {tooFewBars && (
                        <span className="font-sans text-muted-foreground">
                          {t('needs {count} bars').replace(
                            '{count}',
                            String(period)
                          )}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
          {plotType !== 'line' && (
            <span className="text-muted-foreground">
              {t('Hollow candle = rising, filled = falling')}
            </span>
          )}
        </div>

        <CurrencyIndexComparisonChart
          slots={slots}
          plotType={plotType}
          hrmaPeriod={hrmaPeriod}
          smmaPeriod={smmaPeriod}
          fitKey={timeframe}
        />
        {!isLoading && !hasData && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <p className="rounded-md border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-sm font-semibold text-amber-600 shadow-md dark:text-amber-400">
              {t('No data available yet.')}
            </p>
          </div>
        )}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        {t(
          'Each index resets to 100 at its own daily session open. This chart links those days into one continuous series so candles, Heiken Ashi, HRMA and SMMA run unbroken across days: the latest session shows its real values, and earlier sessions are scaled to join it. Gaps between sessions (such as the gold rollover halt or a weekend) are treated as no movement.'
        )}
      </p>

      {/* Definitions */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {SLOT_IDS.map((slot) => {
          const symbol = symbols[slot];
          const meta = symbol ? CURRENCY_GOLD_INDEX_METADATA[symbol] : null;
          if (!symbol || !meta) return null;
          return (
            <div
              key={slot}
              className="rounded-xl border border-border bg-card p-4"
            >
              <p className="flex items-center gap-2 font-semibold text-foreground">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: slotColor(slot, resolvedTheme) }}
                />
                {t(meta.name)} ({symbol})
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {t(meta.definition)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
