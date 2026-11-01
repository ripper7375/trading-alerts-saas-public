import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Symbol, Timeframe, CandlestickData, FractalLevel } from '@/lib/types';
import { useAppearanceSettings } from '@/hooks/useAppearanceSettings';

interface MobileTradingChartProps {
  symbol: Symbol;
  timeframe: Timeframe;
  currentPrice: number;
  onPriceSelect?: (price: number) => void;
  showIndicators?: boolean;
}

// Generate realistic simulated candlestick data
function generateCandles(
  symbol: Symbol,
  basePrice: number,
  count: number = 30
): CandlestickData[] {
  const candles: CandlestickData[] = [];
  const now = Date.now();
  const step = 60 * 1000; // 1 min per candle
  let current = basePrice * 0.985;

  const volatility =
    symbol === 'BTCUSD'
      ? 150
      : symbol === 'XAUUSD'
        ? 2.5
        : symbol === 'US30'
          ? 45
          : 0.0012;

  for (let i = count; i >= 0; i--) {
    const time = now - i * step;
    const delta = (Math.random() - 0.48) * volatility;
    const open = current;
    const close = open + delta;
    const high = Math.max(open, close) + Math.random() * (volatility * 0.6);
    const low = Math.min(open, close) - Math.random() * (volatility * 0.6);
    const volume = Math.floor(Math.random() * 500) + 100;

    candles.push({
      time,
      open: Number(
        open.toFixed(
          symbol.includes('USD') &&
            !symbol.includes('XAU') &&
            !symbol.includes('BTC')
            ? 4
            : 2
        )
      ),
      high: Number(
        high.toFixed(
          symbol.includes('USD') &&
            !symbol.includes('XAU') &&
            !symbol.includes('BTC')
            ? 4
            : 2
        )
      ),
      low: Number(
        low.toFixed(
          symbol.includes('USD') &&
            !symbol.includes('XAU') &&
            !symbol.includes('BTC')
            ? 4
            : 2
        )
      ),
      close: Number(
        close.toFixed(
          symbol.includes('USD') &&
            !symbol.includes('XAU') &&
            !symbol.includes('BTC')
            ? 4
            : 2
        )
      ),
      volume,
    });

    current = close;
  }

  return candles;
}

export const MobileTradingChart: React.FC<MobileTradingChartProps> = ({
  symbol,
  timeframe,
  currentPrice,
  onPriceSelect,
  showIndicators = true,
}) => {
  const { settings } = useAppearanceSettings();
  const [candles, setCandles] = useState<CandlestickData[]>(() =>
    generateCandles(symbol, currentPrice, 32)
  );
  const [activeCrosshair, setActiveCrosshair] =
    useState<CandlestickData | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Regenerate candles when symbol changes
  useEffect(() => {
    setCandles(generateCandles(symbol, currentPrice, 32));
    setActiveCrosshair(null);
  }, [symbol, timeframe]);

  // Update latest candle on currentPrice tick
  useEffect(() => {
    setCandles((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      const updatedLast: CandlestickData = {
        ...last,
        close: currentPrice,
        high: Math.max(last.high, currentPrice),
        low: Math.min(last.low, currentPrice),
      };
      return [...prev.slice(0, -1), updatedLast];
    });
  }, [currentPrice]);

  // Calculate Chart Min / Max bounds
  const {
    minPrice,
    maxPrice,
    resistancePrice,
    supportPrice,
    edtUpper,
    edtLower,
  } = useMemo(() => {
    if (candles.length === 0) {
      return {
        minPrice: currentPrice * 0.99,
        maxPrice: currentPrice * 1.01,
        resistancePrice: currentPrice * 1.006,
        supportPrice: currentPrice * 0.994,
        edtUpper: currentPrice * 1.008,
        edtLower: currentPrice * 0.992,
      };
    }

    let min = Infinity;
    let max = -Infinity;
    candles.forEach((c) => {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
    });

    const padding = (max - min) * 0.12;
    const highMax = max + padding;
    const lowMin = min - padding;

    return {
      minPrice: lowMin,
      maxPrice: highMax,
      resistancePrice: max - padding * 0.4,
      supportPrice: min + padding * 0.4,
      edtUpper: highMax - padding * 0.2,
      edtLower: lowMin + padding * 0.2,
    };
  }, [candles, currentPrice]);

  // Coordinate scaling helpers
  const svgWidth = 360;
  const svgHeight = 220;

  const getY = (price: number) => {
    if (maxPrice === minPrice) return svgHeight / 2;
    return (
      svgHeight -
      ((price - minPrice) / (maxPrice - minPrice)) * (svgHeight - 30) -
      15
    );
  };

  const candleWidth = (svgWidth - 40) / candles.length;

  const isTraditional = settings.candleTheme === 'traditional';
  const bullColor = isTraditional ? '#10b981' : '#06b6d4'; // Emerald or Teal
  const bearColor = isTraditional ? '#f43f5e' : '#f43f5e'; // Rose

  return (
    <div
      ref={containerRef}
      className="relative flex h-full min-h-[340px] w-full select-none flex-col justify-between overflow-hidden"
    >
      {/* Active Candle Crosshair Info Bar */}
      <div className="flex items-center justify-between border-b border-border/60 bg-card/90 px-2 py-1 font-mono text-[10px]">
        {activeCrosshair ? (
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
            <span className="font-bold text-foreground">
              O: {activeCrosshair.open}
            </span>
            <span className="font-bold text-foreground">
              H: {activeCrosshair.high}
            </span>
            <span className="font-bold text-foreground">
              L: {activeCrosshair.low}
            </span>
            <span
              className={`font-bold ${
                activeCrosshair.close >= activeCrosshair.open
                  ? 'text-emerald-500'
                  : 'text-rose-500'
              }`}
            >
              C: {activeCrosshair.close}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="font-bold text-foreground">
              {symbol} ({timeframe})
            </span>
            <span>Touch chart to inspect candle values</span>
          </div>
        )}

        <div className="flex items-center gap-1 font-bold text-emerald-500">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          MT5 LIVE
        </div>
      </div>

      {/* Main SVG Candlestick Canvas */}
      <div className="relative w-full flex-1">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="h-full w-full"
          preserveAspectRatio="none"
          onTouchMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const touchX = e.touches[0].clientX - rect.left;
            const index = Math.floor((touchX / rect.width) * candles.length);
            if (index >= 0 && index < candles.length) {
              setActiveCrosshair(candles[index]);
            }
          }}
          onTouchEnd={() => setActiveCrosshair(null)}
        >
          {/* Background Grid Lines */}
          <line
            x1="0"
            y1={svgHeight * 0.25}
            x2={svgWidth}
            y2={svgHeight * 0.25}
            stroke="rgba(255,255,255,0.05)"
            strokeDasharray="3 3"
          />
          <line
            x1="0"
            y1={svgHeight * 0.5}
            x2={svgWidth}
            y2={svgHeight * 0.5}
            stroke="rgba(255,255,255,0.05)"
            strokeDasharray="3 3"
          />
          <line
            x1="0"
            y1={svgHeight * 0.75}
            x2={svgWidth}
            y2={svgHeight * 0.75}
            stroke="rgba(255,255,255,0.05)"
            strokeDasharray="3 3"
          />

          {showIndicators && (
            <>
              {/* SSA/EDT Upper Channel Band */}
              <line
                x1="0"
                y1={getY(edtUpper)}
                x2={svgWidth}
                y2={getY(edtUpper)}
                stroke="#f59e0b"
                strokeWidth="1.2"
                strokeDasharray="4 3"
                opacity="0.85"
              />
              <text
                x="6"
                y={getY(edtUpper) - 4}
                fill="#f59e0b"
                fontSize="8"
                fontWeight="bold"
                className="font-mono"
              >
                M15 RESISTANCE: ${resistancePrice.toFixed(2)}
              </text>

              {/* SSA/EDT Lower Channel Band */}
              <line
                x1="0"
                y1={getY(edtLower)}
                x2={svgWidth}
                y2={getY(edtLower)}
                stroke="#10b981"
                strokeWidth="1.2"
                strokeDasharray="4 3"
                opacity="0.85"
              />
              <text
                x="6"
                y={getY(edtLower) + 10}
                fill="#10b981"
                fontSize="8"
                fontWeight="bold"
                className="font-mono"
              >
                M15 EDT SUPPORT: ${supportPrice.toFixed(2)}
              </text>

              {/* Midline Equilibrium */}
              <line
                x1="0"
                y1={getY((edtUpper + edtLower) / 2)}
                x2={svgWidth}
                y2={getY((edtUpper + edtLower) / 2)}
                stroke="rgba(148, 163, 184, 0.4)"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
            </>
          )}

          {/* Render Candlesticks */}
          {candles.map((c, i) => {
            const isBull = c.close >= c.open;
            const color = isBull ? bullColor : bearColor;
            const x = 10 + i * candleWidth;
            const openY = getY(c.open);
            const closeY = getY(c.close);
            const highY = getY(c.high);
            const lowY = getY(c.low);
            const bodyY = Math.min(openY, closeY);
            const bodyHeight = Math.max(Math.abs(openY - closeY), 2);
            const isLast = i === candles.length - 1;

            return (
              <g key={c.time} className={isLast ? 'animate-pulse' : ''}>
                {/* Wick */}
                <line
                  x1={x + candleWidth / 2}
                  y1={highY}
                  x2={x + candleWidth / 2}
                  y2={lowY}
                  stroke={color}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />

                {/* Candle Body */}
                <rect
                  x={x + 1}
                  y={bodyY}
                  width={Math.max(candleWidth - 2, 2)}
                  height={bodyHeight}
                  fill={color}
                  rx="1.5"
                />

                {/* Volume Bar at bottom */}
                <rect
                  x={x + 1}
                  y={svgHeight - (c.volume / 500) * 20}
                  width={Math.max(candleWidth - 2, 2)}
                  height={(c.volume / 500) * 20}
                  fill={color}
                  opacity="0.3"
                />
              </g>
            );
          })}

          {/* Current Live Price Line & Badge */}
          <line
            x1="0"
            y1={getY(currentPrice)}
            x2={svgWidth - 55}
            y2={getY(currentPrice)}
            stroke="#f59e0b"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          <rect
            x={svgWidth - 55}
            y={getY(currentPrice) - 7}
            width="55"
            height="14"
            fill="#f59e0b"
            rx="3"
          />
          <text
            x={svgWidth - 50}
            y={getY(currentPrice) + 3}
            fill="#090d16"
            fontSize="8"
            fontWeight="900"
            className="font-mono"
          >
            {currentPrice.toFixed(
              symbol.includes('USD') &&
                !symbol.includes('XAU') &&
                !symbol.includes('BTC')
                ? 4
                : 2
            )}
          </text>
        </svg>
      </div>

      {/* Bottom Chart Indicator Tags */}
      <div className="flex items-center justify-between border-t border-border/60 bg-card/60 px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>SSA EDT: Bullish Channel</span>
          <span>•</span>
          <span>R2: 78%</span>
        </div>
        <span className="font-bold text-amber-500">Peak-to-Peak Fractal</span>
      </div>
    </div>
  );
};
