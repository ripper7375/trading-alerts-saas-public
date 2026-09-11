'use client';

import { useId } from 'react';

/**
 * Zero-dependency pure SVG sparkline with a floating baseline reference line.
 *
 * The baseline floats dynamically in Y-space rather than sitting fixed at
 * the bottom: at the top if the index fell all session, the bottom if it
 * rose all session, or in the middle if it oscillated -- because the
 * baseline itself is a real data point (previousClose), not a chart axis
 * convention, exactly per the architecture doc's section 7.2 spec.
 *
 * @module components/market/floating-sparkline
 */

interface FloatingSparklineProps {
  data: number[];
  previousClose: number;
  width?: number;
  height?: number;
}

export function FloatingSparkline({
  data,
  previousClose,
  width = 110,
  height = 38,
}: FloatingSparklineProps) {
  const gradientId = useId();

  if (!data || data.length < 2) {
    return (
      <div
        style={{ width, height }}
        className="bg-muted/10 rounded"
        aria-hidden="true"
      />
    );
  }

  const allValues = [...data, previousClose];
  let minVal = Math.min(...allValues);
  let maxVal = Math.max(...allValues);
  const diff = maxVal - minVal || 1;
  minVal -= diff * 0.08;
  maxVal += diff * 0.08;
  const range = maxVal - minVal;

  const padX = 4;
  const padY = 3;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const getY = (val: number) =>
    height - padY - ((val - minVal) / range) * chartH;
  const getX = (idx: number) => padX + (idx / (data.length - 1)) * chartW;

  const baselineY = getY(previousClose);
  const lastPrice = data[data.length - 1] as number;
  const isGain = lastPrice >= previousClose;

  const strokeColor = isGain ? '#06b6d4' : '#f43f5e';
  const points = data.map((val, idx) => ({ x: getX(idx), y: getY(val) }));
  const linePath = `M ${points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')}`;
  const lastPoint = points[points.length - 1] as { x: number; y: number };
  const firstPoint = points[0] as { x: number; y: number };
  const areaPath = `${linePath} L ${lastPoint.x.toFixed(1)},${height} L ${firstPoint.x.toFixed(1)},${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      className="inline-block select-none overflow-visible"
      role="img"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
        </linearGradient>
      </defs>
      <line
        x1={0}
        y1={baselineY}
        x2={width}
        y2={baselineY}
        stroke="#94a3b8"
        strokeWidth="1"
        strokeDasharray="2,2.5"
        strokeOpacity="0.4"
      />
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={lastPoint.x}
        cy={lastPoint.y}
        r="2.5"
        fill={strokeColor}
        stroke="#ffffff"
        strokeWidth="0.8"
      />
    </svg>
  );
}
