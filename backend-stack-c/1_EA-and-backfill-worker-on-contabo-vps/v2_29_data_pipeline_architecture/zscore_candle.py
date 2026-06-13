"""Z-Score OHLC Candle calculation — literal Python port of
mql5-indicators/mql5-indicator-export-selection/USE/mq5/zscore-ohlc-candle-export.mq5

Port fidelity notes (MQL5 source references):
- Body size        = MathAbs(close - open)                     (line ~429)
- Z-score          = rolling window of InpZScoreLength bars,
                     SAMPLE variance (n - 1 divisor)           (CalculateZScore)
- Classification   = signed z-score vs thresholds; bullish if
                     close >= open                             (ClassifyCandle)
- body_direction   = 1 / -1 / 0 (close > / < / == open)        (export section)
- Exported "body_size" column = MathAbs(z-score), NOT the raw
  body size                                                    (export section)

Classification codes (= MQL5 color-index enum order):
  0 UP_NORMAL, 1 UP_LARGE, 2 UP_EXTREME, 3 DOWN_NORMAL, 4 DOWN_LARGE, 5 DOWN_EXTREME
"""

import math
from dataclasses import dataclass
from typing import List, Optional


@dataclass
class ZScoreCandleParams:
    """User-configurable parameters (MQL5 inputs)."""
    zscore_length: int = 432    # InpZScoreLength
    threshold_z1: float = 1.5   # InpThresholdZ1 (Large)
    threshold_z2: float = 2.5   # InpThresholdZ2 (Extreme)


@dataclass
class ZScoreCandleResult:
    body_direction: int             # 1 bullish, -1 bearish, 0 doji
    body_size_raw: float            # |close - open| (internal buffer value)
    zscore: Optional[float]         # signed z-score; None during warm-up
    body_size_export: Optional[float]  # |z-score| — the exported "body_size" column
    classification: Optional[int]   # 0-5; None during warm-up


def _zscore_at(body_sizes: List[float], position: int, length: int) -> Optional[float]:
    """CalculateZScore(): rolling sample z-score over `length` bars ending at position."""
    if position - (length - 1) < 0:
        return None  # warm-up: MQL5 starts at start index >= length
    s = 0.0
    s2 = 0.0
    for j in range(length):
        v = body_sizes[position - j]
        s += v
        s2 += v * v
    mean = s / length
    variance = (s2 - s * mean) / (length - 1)
    std_dev = math.sqrt(variance) if variance > 0 else 0.0
    return (body_sizes[position] - mean) / std_dev if std_dev != 0 else 0.0


def _classify(zscore: float, is_bullish: bool, p: ZScoreCandleParams) -> int:
    """ClassifyCandle(): signed z-score vs thresholds (bullish = close >= open)."""
    if is_bullish:
        if zscore >= p.threshold_z2:
            return 2  # UP_EXTREME
        if zscore >= p.threshold_z1:
            return 1  # UP_LARGE
        return 0      # UP_NORMAL
    if zscore >= p.threshold_z2:
        return 5      # DOWN_EXTREME
    if zscore >= p.threshold_z1:
        return 4      # DOWN_LARGE
    return 3          # DOWN_NORMAL


def calculate(opens: List[float], closes: List[float],
              params: Optional[ZScoreCandleParams] = None) -> List[ZScoreCandleResult]:
    """Compute the full z-score candle series (oldest-first arrays, MQL5 buffer order).

    Bars earlier than `zscore_length - 1` are warm-up: direction/raw body size are
    produced, z-score/classification are None (MQL5 leaves those buffers empty).
    """
    p = params or ZScoreCandleParams()
    body_sizes = [abs(c - o) for o, c in zip(opens, closes)]
    results: List[ZScoreCandleResult] = []

    for i, (o, c) in enumerate(zip(opens, closes)):
        direction = 1 if c > o else (-1 if c < o else 0)
        z = _zscore_at(body_sizes, i, p.zscore_length)
        if z is None:
            results.append(ZScoreCandleResult(direction, body_sizes[i], None, None, None))
        else:
            cls = _classify(z, c >= o, p)
            results.append(ZScoreCandleResult(direction, body_sizes[i], z, abs(z), cls))
    return results
