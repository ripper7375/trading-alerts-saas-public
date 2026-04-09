'use client';

// hooks/useChartSync.ts
// Cross-panel state synchronization: carries LWC crosshair position to ECharts axisPointer.

import type { UTCTimestamp } from 'lightweight-charts';
import { useState, useCallback } from 'react';

export function useChartSync() {
  const [crosshairTime, setCrosshairTime] = useState<UTCTimestamp | null>(null);
  const [crosshairPrice, setCrosshairPrice] = useState<number | null>(null);

  const handleCrosshairMove = useCallback(
    (time: UTCTimestamp | null, price: number | null) => {
      setCrosshairTime(time);
      setCrosshairPrice(price);
    },
    []
  );

  return { crosshairTime, crosshairPrice, handleCrosshairMove };
}
