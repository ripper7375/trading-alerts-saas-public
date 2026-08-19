import { useMemo } from 'react';
import {
  ComposedChart,
  XAxis,
  YAxis,
  Bar,
  Cell,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface CandlestickData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  [key: string]: string | number;
}

interface CandlestickChartProps {
  data: CandlestickData[];
  precision?: number;
}

// Custom candlestick shape
const CandlestickBar = (props: {
  x: number;
  y: number;
  width: number;
  height: number;
  payload: CandlestickData;
  yAxisScale: (value: number) => number;
}) => {
  const { x, width, payload, yAxisScale } = props;

  const { open, high, low, close } = payload;
  const isGreen = close >= open;

  const bodyTop = yAxisScale(Math.max(open, close));
  const bodyBottom = yAxisScale(Math.min(open, close));
  const bodyHeight = Math.max(bodyBottom - bodyTop, 1);

  const wickX = x + width / 2;
  const wickTop = yAxisScale(high);
  const wickBottom = yAxisScale(low);

  const fillColor = isGreen ? 'hsl(142, 76%, 36%)' : 'hsl(0, 84%, 60%)';
  const strokeColor = isGreen ? 'hsl(142, 76%, 36%)' : 'hsl(0, 84%, 60%)';

  return (
    <g>
      {/* Upper wick */}
      <line
        x1={wickX}
        y1={wickTop}
        x2={wickX}
        y2={bodyTop}
        stroke={strokeColor}
        strokeWidth={1}
      />
      {/* Lower wick */}
      <line
        x1={wickX}
        y1={bodyBottom}
        x2={wickX}
        y2={wickBottom}
        stroke={strokeColor}
        strokeWidth={1}
      />
      {/* Body */}
      <rect
        x={x + 1}
        y={bodyTop}
        width={Math.max(width - 2, 3)}
        height={bodyHeight}
        fill={isGreen ? fillColor : fillColor}
        stroke={strokeColor}
        strokeWidth={1}
      />
    </g>
  );
};

// Custom tooltip for candlestick
const CandlestickTooltip = ({
  active,
  payload,
  precision = 4,
}: {
  active?: boolean;
  payload?: Array<{ payload: CandlestickData }>;
  precision?: number;
}) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const isGreen = data.close >= data.open;

  return (
    <div className="rounded-lg border border-border bg-popover p-3 shadow-lg">
      <p className="mb-2 text-xs text-muted-foreground">{data.date}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <span className="text-muted-foreground">Open:</span>
        <span className="font-medium text-foreground">
          {data.open.toFixed(precision)}
        </span>
        <span className="text-muted-foreground">High:</span>
        <span className="font-medium text-green-500">
          {data.high.toFixed(precision)}
        </span>
        <span className="text-muted-foreground">Low:</span>
        <span className="font-medium text-red-500">
          {data.low.toFixed(precision)}
        </span>
        <span className="text-muted-foreground">Close:</span>
        <span
          className={`font-medium ${isGreen ? 'text-green-500' : 'text-red-500'}`}
        >
          {data.close.toFixed(precision)}
        </span>
      </div>
    </div>
  );
};

const CandlestickChart = ({ data, precision = 4 }: CandlestickChartProps) => {
  // Calculate domain for Y axis
  const { minValue, maxValue } = useMemo(() => {
    const lows = data.map((d) => d.low);
    const highs = data.map((d) => d.high);
    const min = Math.min(...lows);
    const max = Math.max(...highs);
    const padding = (max - min) * 0.1;
    return { minValue: min - padding, maxValue: max + padding };
  }, [data]);

  // Prepare data with placeholder for bar chart
  const chartData = useMemo(() => {
    return data.map((item) => ({
      ...item,
      // Bar height placeholder - actual rendering is custom
      barHeight: item.high - item.low,
    }));
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={chartData}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <XAxis
          dataKey="date"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[minValue, maxValue]}
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          width={50}
          tickFormatter={(value) => value.toFixed(precision === 2 ? 0 : 3)}
        />
        <Tooltip content={<CandlestickTooltip precision={precision} />} />

        {/* Invisible bars to provide structure, custom shape handles rendering */}
        <Bar
          dataKey="barHeight"
          shape={(props) => {
            // Get the Y axis scale from the chart
            const yAxis = props.yAxis;
            if (!yAxis) return null;

            return (
              <CandlestickBar
                {...props}
                yAxisScale={(value: number) => yAxis.scale(value)}
              />
            );
          }}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill="transparent" />
          ))}
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  );
};

export default CandlestickChart;
