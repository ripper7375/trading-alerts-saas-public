'use client';

/**
 * CurrencyIndexComparisonWorkspace -- the /pro/currency-index/compare page body.
 *
 * Owns all view state; nothing here is persisted (periods, plot type and
 * rebase reset on reload, same as the public /xaux-vs-usdx page and the PRO
 * HRMA/SMMA detail modal's what-if sliders). Every control except the index
 * pickers and the timeframe toggle is applied in the browser with no request.
 *
 * ZigZag and the Z-score candles ("MC") are drawn for each index and hidden or
 * shown per index, with their chips beside that index's HRMA/SMMA chips --
 * the same as HRMA/SMMA (Davin, 2026-09-14, replacing one shared chip each).
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
  DEFAULT_ZIGZAG_DEPTH,
  ZIGZAG_BACKSTEP,
  ZIGZAG_DEPTH_MAX,
  ZIGZAG_DEPTH_MIN,
  ZIGZAG_DEVIATION,
} from '@/lib/currency-index-comparison/zigzag';
import {
  DEFAULT_ZSCORE_LENGTH,
  DEFAULT_ZSCORE_THRESHOLD_1,
  DEFAULT_ZSCORE_THRESHOLD_2,
  ZSCORE_LENGTH_MAX,
  ZSCORE_LENGTH_MIN,
  ZSCORE_THRESHOLD_MAX,
  ZSCORE_THRESHOLD_MIN,
  zscoreBarsNeeded,
  type HighlightedZScoreClass,
} from '@/lib/currency-index-comparison/zscore-candle';

import {
  CurrencyIndexComparisonChart,
  REBASE_DEFAULT,
  SLOT_IDS,
  ZIGZAG_CLASSES,
  ZIGZAG_LINE_WIDTH,
  ZSCORE_HIGHLIGHT_CLASSES,
  slotColor,
  zscoreClassColors,
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
  { value: 'none', label: 'No Plot' },
  { value: 'line', label: 'Line' },
  { value: 'ohlc', label: 'OHLC Candles' },
  { value: 'heikin-ashi', label: 'Heiken Ashi' },
];

const ZIGZAG_CLASS_LABELS = {
  normal: 'Normal',
  large: 'Large',
  extreme: 'Extreme',
} as const;

const ZSCORE_CLASS_LABELS: Record<HighlightedZScoreClass, string> = {
  'up-large': 'Up Large',
  'up-extreme': 'Up Extreme',
  'down-large': 'Down Large',
  'down-extreme': 'Down Extreme',
};

/** Z-score thresholds move in steps of 0.1 and display with one decimal. */
const formatThreshold = (v: number): string => v.toFixed(1);

/** Per-index hide/show state for every indicator chip. */
interface LineToggles {
  hrma: boolean;
  smma: boolean;
  zigzag: boolean;
  zscore: boolean;
}

const ALL_SHOWN: LineToggles = {
  hrma: true,
  smma: true,
  zigzag: true,
  zscore: true,
};

function SliderRow({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display?: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums text-foreground">
          {display ?? value}
        </span>
      </div>
      <Slider
        aria-label={label}
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0] ?? value)}
      />
    </div>
  );
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
  const [zigzagDepth, setZigzagDepth] = useState(DEFAULT_ZIGZAG_DEPTH);
  const [zscoreLength, setZscoreLength] = useState(DEFAULT_ZSCORE_LENGTH);
  const [zscoreThreshold1, setZscoreThreshold1] = useState(
    DEFAULT_ZSCORE_THRESHOLD_1
  );
  const [zscoreThreshold2, setZscoreThreshold2] = useState(
    DEFAULT_ZSCORE_THRESHOLD_2
  );
  const [bases, setBases] = useState<Record<SlotId, number>>({
    A: REBASE_DEFAULT,
    B: REBASE_DEFAULT,
  });
  const [toggles, setToggles] = useState<Record<SlotId, LineToggles>>({
    A: ALL_SHOWN,
    B: ALL_SHOWN,
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
        showZigzag: toggles[slot].zigzag,
        showZscore: toggles[slot].zscore,
      };
    };
    return { A: build('A', symbolA), B: build('B', symbolB) };
  }, [series, symbolA, symbolB, bases, toggles]);

  const hasData = SLOT_IDS.some((id) => (slots[id]?.candles.length ?? 0) > 0);
  // The legend keys explain a mark while any index still draws it.
  const anyShown = (line: keyof LineToggles): boolean =>
    SLOT_IDS.some((id) => symbols[id] !== null && toggles[id][line]);
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
              'Compare any 2 of the 8 currency indices and the Gold Index (XAUX) over up to 3,000 bars, as a line, OHLC candles or Heiken Ashi candles, with HRMA, SMMA, ZigZag and Z-score candles.'
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
      <div className="grid gap-x-6 gap-y-5 rounded-2xl border border-border bg-card p-4 shadow-xl shadow-black/5 md:grid-cols-2 md:p-6 xl:grid-cols-3">
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
          <SliderRow
            label={t('HRMA period')}
            value={hrmaPeriod}
            min={HRMA_PERIOD_MIN}
            max={HRMA_PERIOD_MAX}
            step={1}
            onChange={setHrmaPeriod}
          />
          <SliderRow
            label={t('SMMA period')}
            value={smmaPeriod}
            min={SMMA_PERIOD_MIN}
            max={SMMA_PERIOD_MAX}
            step={1}
            onChange={setSmmaPeriod}
          />
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold text-foreground">{t('ZigZag')}</p>
          <SliderRow
            label={t('Depth')}
            value={zigzagDepth}
            min={ZIGZAG_DEPTH_MIN}
            max={ZIGZAG_DEPTH_MAX}
            step={1}
            onChange={setZigzagDepth}
          />
          {/* Fixed on purpose: ZigZagExportv43 never uses either value in its
              calculation (see lib/currency-index-comparison/zigzag.ts), so a
              slider would move without changing anything. */}
          <dl className="grid grid-cols-2 gap-2 text-xs">
            {(
              [
                ['Deviation', ZIGZAG_DEVIATION],
                ['Back Step', ZIGZAG_BACKSTEP],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-md border border-dashed border-border px-2 py-1"
              >
                <dt className="font-medium text-muted-foreground">
                  {t(label)}
                </dt>
                <dd className="font-mono tabular-nums text-foreground">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-[11px] leading-snug text-muted-foreground">
            {t(
              'Deviation and Back Step are fixed: MT5 ZigZag v43 does not use them, so only Depth changes the pivots.'
            )}
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold text-foreground">
            {t('Z-score candles (MC)')}
          </p>
          <SliderRow
            label={t('Z-Score MA Length')}
            value={zscoreLength}
            min={ZSCORE_LENGTH_MIN}
            max={ZSCORE_LENGTH_MAX}
            step={1}
            onChange={setZscoreLength}
          />
          <SliderRow
            label={t('First Threshold')}
            value={zscoreThreshold1}
            display={formatThreshold(zscoreThreshold1)}
            min={ZSCORE_THRESHOLD_MIN}
            max={ZSCORE_THRESHOLD_MAX}
            step={0.1}
            onChange={(v) => setZscoreThreshold1(Math.round(v * 10) / 10)}
          />
          <SliderRow
            label={t('Second Threshold')}
            value={zscoreThreshold2}
            display={formatThreshold(zscoreThreshold2)}
            min={ZSCORE_THRESHOLD_MIN}
            max={ZSCORE_THRESHOLD_MAX}
            step={0.1}
            onChange={(v) => setZscoreThreshold2(Math.round(v * 10) / 10)}
          />
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
              <div
                key={slot}
                role="group"
                aria-label={symbol}
                className="flex flex-wrap items-center gap-2"
              >
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  {symbol}
                </span>
                {(
                  [
                    {
                      line: 'hrma',
                      label: `HRMA(${hrmaPeriod})`,
                      needed: hrmaPeriod,
                    },
                    {
                      line: 'smma',
                      label: `SMMA(${smmaPeriod})`,
                      needed: smmaPeriod,
                    },
                    {
                      line: 'zigzag',
                      label: `ZigZag (${zigzagDepth},${ZIGZAG_DEVIATION},${ZIGZAG_BACKSTEP})`,
                      needed: zigzagDepth,
                    },
                    {
                      line: 'zscore',
                      label: `MC (${zscoreLength},${formatThreshold(zscoreThreshold1)},${formatThreshold(zscoreThreshold2)})`,
                      needed: zscoreBarsNeeded(zscoreLength),
                    },
                  ] as const
                ).map(({ line, label, needed }) => {
                  const on = toggles[slot][line];
                  const barCount = slots[slot]?.candles.length ?? 0;
                  // Every indicator draws nothing until there are enough
                  // bars (HRMA per its MQL5 `rates_total < len_hrma` guard,
                  // SMMA by its seed, ZigZag below depth, MC before its first
                  // full window). Say so, rather than leave an "on" chip with
                  // no mark and no explanation.
                  const tooFewBars = on && barCount > 0 && barCount < needed;
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
                      {line === 'hrma' || line === 'smma' ? (
                        <span
                          aria-hidden="true"
                          className="inline-block w-4"
                          style={{
                            borderTop: `2px ${line === 'hrma' ? 'dashed' : 'dotted'} ${color}`,
                          }}
                        />
                      ) : line === 'zigzag' ? (
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 16 10"
                          className="h-2.5 w-4"
                          fill="none"
                          stroke={color}
                          strokeWidth="1.5"
                        >
                          <polyline points="1,8 5,2 9,7 15,1" />
                        </svg>
                      ) : (
                        // MC candles are green/magenta on both indices; the
                        // chip sits in its index's group, which says whose.
                        <span
                          aria-hidden="true"
                          className="flex items-end gap-0.5"
                        >
                          {(['up-extreme', 'down-extreme'] as const).map(
                            (cls) => (
                              <span
                                key={cls}
                                className="inline-block h-2.5 w-1.5 rounded-[1px]"
                                style={{
                                  backgroundColor: zscoreClassColors(
                                    cls,
                                    resolvedTheme
                                  ).body,
                                }}
                              />
                            )
                          )}
                        </span>
                      )}
                      {label}
                      {tooFewBars && (
                        <span className="font-sans text-muted-foreground">
                          {t('needs {count} bars').replace(
                            '{count}',
                            String(needed)
                          )}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* How to read the marks. Text stays in ink colors; the sample next
            to each label carries the encoding. */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          {(plotType === 'ohlc' || plotType === 'heikin-ashi') && (
            <span>{t('Hollow candle = rising, filled = falling')}</span>
          )}
          {anyShown('zigzag') && (
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">
                {t('ZigZag move')}:
              </span>
              {ZIGZAG_CLASSES.map((cls) => (
                <span key={cls} className="flex items-center gap-1">
                  <span
                    aria-hidden="true"
                    className="inline-block w-4 bg-foreground"
                    style={{ height: ZIGZAG_LINE_WIDTH[cls] }}
                  />
                  {t(ZIGZAG_CLASS_LABELS[cls])}
                </span>
              ))}
            </span>
          )}
          {anyShown('zscore') && (
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">MC:</span>
              {ZSCORE_HIGHLIGHT_CLASSES.map((cls) => {
                const { body, outline } = zscoreClassColors(cls, resolvedTheme);
                return (
                  <span key={cls} className="flex items-center gap-1">
                    <span
                      aria-hidden="true"
                      className="inline-block h-3 w-2 rounded-[1px] border"
                      style={{ backgroundColor: body, borderColor: outline }}
                    />
                    {t(ZSCORE_CLASS_LABELS[cls])}
                  </span>
                );
              })}
            </span>
          )}
        </div>

        <CurrencyIndexComparisonChart
          slots={slots}
          plotType={plotType}
          hrmaPeriod={hrmaPeriod}
          smmaPeriod={smmaPeriod}
          zigzagDepth={zigzagDepth}
          zscoreLength={zscoreLength}
          zscoreThreshold1={zscoreThreshold1}
          zscoreThreshold2={zscoreThreshold2}
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
          'Each index resets to 100 at its own daily session open. This chart links those days into one continuous series so candles, Heiken Ashi and every indicator run unbroken across days: the latest session shows its real values, and earlier sessions are scaled to join it. Gaps between sessions (such as the gold rollover halt or a weekend) are treated as no movement.'
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
