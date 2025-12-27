import { expectType, expectError, expectAssignable } from 'tsd';
import type {
  IndicatorType,
  Candlestick,
  IndicatorPoint,
  IndicatorData,
  IndicatorRequest,
  ChartData,
  MomentumCandleType,
  MomentumCandleData,
  KeltnerChannelData,
  ZigZagPoint,
  ZigZagData,
  ProIndicatorData,
  ChartDataPoint,
  isValidChartDataPoint,
} from '../../types/indicator';
import type { Symbol, Timeframe } from '../../types/tier';

// Test IndicatorType union
const horizontalType: IndicatorType = 'FRACTAL_HORIZONTAL';
const diagonalType: IndicatorType = 'FRACTAL_DIAGONAL';
expectType<IndicatorType>(horizontalType);
expectType<IndicatorType>(diagonalType);

// Test invalid IndicatorType
expectError<IndicatorType>('INVALID_TYPE');

// Test Candlestick
const candle: Candlestick = {
  time: 1703980800,
  open: 1.095,
  high: 1.098,
  low: 1.092,
  close: 1.096,
};
expectType<number>(candle.time);
expectType<number | undefined>(candle.volume);

// Test IndicatorPoint
const point: IndicatorPoint = {
  time: 1703980800,
  value: 1.098,
  type: 'RESISTANCE',
};
expectType<number>(point.value);
expectType<'SUPPORT' | 'RESISTANCE' | undefined>(point.type);

// Test invalid point type
expectError<IndicatorPoint>({
  time: 1703980800,
  value: 1.098,
  type: 'INVALID', // Should be 'SUPPORT' | 'RESISTANCE'
});

// Test IndicatorRequest
const request: IndicatorRequest = {
  symbol: 'EURUSD' as Symbol,
  timeframe: 'H1' as Timeframe,
  indicatorType: 'FRACTAL_HORIZONTAL',
  bars: 100,
};
expectType<number | undefined>(request.bars);

// Test MomentumCandleType enum
const mcType = MomentumCandleType.UP_LARGE;
expectType<MomentumCandleType>(mcType);
expectType<number>(mcType);

// Test MomentumCandleData
const mcData: MomentumCandleData = {
  index: 0,
  type: MomentumCandleType.UP_EXTREME,
  zscore: 2.5,
};
expectType<number>(mcData.zscore);

// Test KeltnerChannelData with undefined values
const keltner: KeltnerChannelData = {
  ultraExtremeUpper: [1.1, undefined, 1.12],
  extremeUpper: [1.09, 1.095, undefined],
  upperMost: [],
  upper: [],
  upperMiddle: [],
  lowerMiddle: [],
  lower: [],
  lowerMost: [],
  extremeLower: [],
  ultraExtremeLower: [],
};
expectType<(number | undefined)[]>(keltner.ultraExtremeUpper);

// Test ZigZagPoint
const zigzagPoint: ZigZagPoint = {
  index: 10,
  price: 1.1,
  timestamp: 1703980800,
};
expectType<number>(zigzagPoint.price);
expectType<number | undefined>(zigzagPoint.timestamp);

// Test ZigZagData
const zigzag: ZigZagData = {
  peaks: [{ index: 10, price: 1.1 }],
  bottoms: [{ index: 5, price: 1.05 }],
};
expectType<ZigZagPoint[]>(zigzag.peaks);

// Test ProIndicatorData
const proData: ProIndicatorData = {
  momentumCandles: [],
  tema: [1.095, undefined, 1.097],
  hrma: [1.094],
  smma: [1.093],
};
expectType<MomentumCandleData[]>(proData.momentumCandles);
expectType<(number | undefined)[]>(proData.tema);
expectType<KeltnerChannelData | undefined>(proData.keltnerChannels);
expectType<ZigZagData | undefined>(proData.zigzag);

// Test ChartDataPoint (never undefined)
const chartPoint: ChartDataPoint = {
  time: 1703980800 as any, // Time from lightweight-charts
  value: 1.095,
};
expectType<number>(chartPoint.value);

// Test isValidChartDataPoint type guard
const maybePoint = { time: 1703980800, value: 1.095 };
if (isValidChartDataPoint(maybePoint)) {
  expectType<ChartDataPoint>(maybePoint);
}
