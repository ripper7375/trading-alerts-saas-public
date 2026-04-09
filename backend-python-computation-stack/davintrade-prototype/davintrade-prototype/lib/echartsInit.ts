// lib/echartsInit.ts
// Tree-shaken ECharts registration — import echarts from here, never directly from 'echarts'
// Required charts: LineChart, CustomChart, ScatterChart, GaugeChart
// Required components: GridComponent, TooltipComponent, DataZoomComponent, GraphicComponent

import {
  LineChart,
  CustomChart,
  ScatterChart,
  GaugeChart,
} from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  GraphicComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  LineChart,
  CustomChart,
  ScatterChart,
  GaugeChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  GraphicComponent,
  CanvasRenderer,
]);

export { echarts };
export type { ECharts, EChartsOption } from 'echarts';
