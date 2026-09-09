"""ZigZag segment metrics — literal Python port of the derived-metric layer of
mql5-indicators/mql5-indicator-export-selection/USE/mq5/ZigZag-Export-v43.mq5

Pivot DETECTION stays in MQL5 (admin layer); this module computes the derived
metrics from the exported pivot sequence:
  CurrentPrChg, Current%Chg, Current%ChgClass, CurrentBars, CurrentBarsClass,
  CurrentPrPerBar, CurrentPrPerBarClass, CurrentSlope, CurrentCategory

Port fidelity notes (MQL5 source references):
- Metrics per pivot i use prev = i+1 and twoPrev = i+2 in the collected-points
  array (newest = index 0)                                  (export loop ~l.455)
- pct/bars/prperbar classifications: rolling z-score over up to
  zscore_length (default 50) trailing segments, SAMPLE variance (n-1),
  |values| for pct and pr/bar, signed bar-count for bars     (Get*Classification)
- Class codes: bullish 0/1/2 (normal/large/extreme), bearish 3/4/5
- slope = atan(prPerBar) in degrees                          (l.470)
- category: strict mode (enable_equal=False): Higher if current >= twoPrev;
  equal mode: threshold band of equal_threshold % around twoPrev (l.472+)
"""

import math
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class ZigZagPivot:
    """One confirmed pivot, as exported by ZigZag-Export-v43."""
    bar: int            # bar index (any monotonic per-bar counter works)
    price: float        # pivot price (CurrentPoint)
    is_peak: bool       # True = Peak, False = Bottom
    timestamp: int = 0  # unix (optional, carried through)
    close: float = 0.0  # bar close (optional, carried through)


@dataclass
class ZigZagMetricsParams:
    """User-configurable parameters (MQL5 inputs)."""
    zscore_length: int = 50        # InpZScoreLength (number of segments)
    threshold_z1: float = 1.41     # InpThresholdZ1 (Large)
    threshold_z2: float = 1.88     # InpThresholdZ2 (Extreme)
    enable_equal: bool = False     # xInpEnableEqual
    equal_threshold: float = 0.50  # xInpEqualThreshold (% of two-prev point)


@dataclass
class ZigZagSegmentMetrics:
    price_change: float
    pct_change: float
    pct_change_class: int
    bars: int
    bars_class: int
    price_per_bar: float
    price_per_bar_class: int
    slope: float
    category: str


def _classify_z(zscore: float, is_bullish: bool, p: ZigZagMetricsParams) -> int:
    if is_bullish:
        if zscore >= p.threshold_z2:
            return 2
        if zscore >= p.threshold_z1:
            return 1
        return 0
    if zscore >= p.threshold_z2:
        return 5
    if zscore >= p.threshold_z1:
        return 4
    return 3


def _rolling_sample_z(values_iter, current_value: float) -> float:
    """Shared tail of the three Get*Classification() functions: sample z-score
    of current_value against the trailing-segment population."""
    s = 0.0
    s2 = 0.0
    count = 0
    for v in values_iter:
        s += v
        s2 += v * v
        count += 1
    mean = 0.0
    std_dev = 0.0
    if count > 0:
        mean = s / count
        if count > 1:
            variance = (s2 - s * mean) / (count - 1)
            if variance > 0:
                std_dev = math.sqrt(variance)
    return (current_value - mean) / std_dev if std_dev != 0 else 0.0


def _trailing_segments(points: List[ZigZagPivot], start_idx: int, max_count: int):
    """Yield (curr, prev) pivot pairs walking backwards from start_idx,
    mirroring `for(j; count < InpZScoreLength && startIdx+j+1 < totalPoints; j++)`."""
    j = 0
    yielded = 0
    while yielded < max_count and (start_idx + j + 1) < len(points):
        yield points[start_idx + j], points[start_idx + j + 1]
        yielded += 1
        j += 1


def pct_change_class(points: List[ZigZagPivot], current_index: int,
                     current_pct_change: float, p: ZigZagMetricsParams) -> int:
    """GetPercentChangeClassification() — population uses |%change| of trailing segments."""
    def values():
        for curr, prev in _trailing_segments(points, current_index, p.zscore_length):
            if prev.price == 0:
                continue
            yield abs((curr.price - prev.price) / prev.price * 100.0)
    z = _rolling_sample_z(values(), abs(current_pct_change))
    return _classify_z(z, current_pct_change >= 0, p)


def bars_class(points: List[ZigZagPivot], current_index: int,
               current_bars: int, is_bullish: bool, p: ZigZagMetricsParams) -> int:
    """GetBarsClassification() — population uses segment bar counts (signed current)."""
    def values():
        for curr, prev in _trailing_segments(points, current_index, p.zscore_length):
            yield float(abs(curr.bar - prev.bar))
    z = _rolling_sample_z(values(), float(current_bars))
    return _classify_z(z, is_bullish, p)


def price_per_bar_class(points: List[ZigZagPivot], current_index: int,
                        current_pr_per_bar: float, p: ZigZagMetricsParams) -> int:
    """GetPrPerBarClassification() — population uses |price/bar| of trailing segments."""
    def values():
        for curr, prev in _trailing_segments(points, current_index, p.zscore_length):
            seg_bars = abs(curr.bar - prev.bar)
            if prev.price == 0 or seg_bars == 0:
                continue
            yield abs((curr.price - prev.price) / seg_bars)
    z = _rolling_sample_z(values(), abs(current_pr_per_bar))
    return _classify_z(z, current_pr_per_bar >= 0, p)


def _category(current: float, prev: float, two_prev: float, p: ZigZagMetricsParams) -> str:
    if p.enable_equal:
        upper = two_prev * (1 + p.equal_threshold / 100)
        lower = two_prev * (1 - p.equal_threshold / 100)
        first = 'Higher' if current > upper else ('Lower' if current < lower else 'Equal')
    else:
        first = 'Higher' if current >= two_prev else 'Lower'
    last = 'High' if current > prev else 'Low'
    return {('Higher', 'High'): 'HH', ('Lower', 'Low'): 'LL',
            ('Higher', 'Low'): 'HL', ('Lower', 'High'): 'LH',
            ('Equal', 'High'): 'EQH', ('Equal', 'Low'): 'EQL'}[(first, last)]


def segment_metrics(points: List[ZigZagPivot], current_index: int,
                    params: Optional[ZigZagMetricsParams] = None) -> ZigZagSegmentMetrics:
    """Full metric set for the pivot at current_index.

    `points` is NEWEST-FIRST (index 0 = most recent confirmed pivot), exactly
    like the MQL5 xcollectedPoints array. Needs current_index + 2 in range.
    """
    p = params or ZigZagMetricsParams()
    cur = points[current_index]
    prev = points[current_index + 1]
    two_prev = points[current_index + 2]

    price_change = cur.price - prev.price
    pct = (price_change / prev.price * 100.0) if prev.price != 0 else 0.0
    bar_count = cur.bar - prev.bar
    is_bullish = price_change >= 0
    pr_per_bar = price_change / bar_count if bar_count != 0 else 0.0

    return ZigZagSegmentMetrics(
        price_change=price_change,
        pct_change=pct,
        pct_change_class=pct_change_class(points, current_index, pct, p),
        bars=bar_count,
        bars_class=bars_class(points, current_index, bar_count, is_bullish, p),
        price_per_bar=pr_per_bar,
        price_per_bar_class=price_per_bar_class(points, current_index, pr_per_bar, p),
        slope=math.atan(pr_per_bar) * (180.0 / math.pi),
        category=_category(cur.price, prev.price, two_prev.price, p),
    )
