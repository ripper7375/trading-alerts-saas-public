"""Fractal trend lines — literal Python port of the line-fitting layer of:
  - Single-Best-Resistance-Line-v3.mq5   (upper fractals only)
  - Single-Best-Support-Line-v3.mq5      (lower fractals only)
  - 2EDT-Fractal-Best-Fit-v5.mq5         (mixed flip line + symmetrical EDTs)

MQL5 keeps fractal *display*; Python detects fractals from OHLC history and
fits the lines with user-configurable parameters (window, touches, tolerance).

Port fidelity notes (MQL5 source references):
- Fractal rules are ASYMMETRIC about the center bar (IsUpper/IsLowerFractal):
  an equal extreme on the OLDER side still qualifies, on the NEWER side it
  disqualifies. (MQL5 arrays are as-series: index-i = newer, index+i = older.)
- Candidate pairs need >= 10 bars distance (hardcoded in MQL5; exposed here
  as min_pair_distance_bars with the same default).
- Angle filter: normalized slope = (%change between the pair / bar distance)
  compared against tan(max_line_angle°); 0 or >=90 disables the filter.
- Touch tolerance per fractal: price * tolerance_percent/100, or
  ATR * multiplier in ATR mode (ATR value supplied by caller).
- Score = touches * 10000 + pair bar distance; highest wins (strict >).
- Flip check (best-fit only, require_both_sides): the touching set must
  contain at least one peak AND one bottom.
- EDTs (best-fit only): for every fractal, the parallel line through it is an
  EDT candidate; candidates with >= edt_min_touches touches contribute the
  max intercept strictly above and the min intercept strictly below the base.
- The secondary 119-marker fractal set in the indicators is display-only;
  line fitting uses only the primary set — same here.
"""

import math
from dataclasses import dataclass
from typing import List, Optional, Tuple


@dataclass
class FractalPoint:
    bar: int          # chronological bar index (0 = oldest)
    price: float
    is_peak: bool


@dataclass
class FractalLinesParams:
    """User-configurable parameters (MQL5 inputs)."""
    fractal_bars: int = 13              # InpFractalBars (35 in Fractal-Best-Fit, 13 in single lines)
    min_touches: int = 2                # InpMinTouches (3 in Fractal-Best-Fit)
    max_line_angle: float = 3.0         # InpMaxLineAngle degrees (0 disables)
    tolerance_type: str = 'percent'     # InpToleranceType: 'percent' | 'atr'
    tolerance_percent: float = 0.50     # InpTolerancePercent
    tolerance_atr_multiplier: float = 1.0  # InpToleranceATRMultiplier
    edt_min_touches: int = 3            # InpEDTMinTouches (Fractal-Best-Fit only)
    require_both_sides: bool = True     # InpRequireBothSides (Fractal-Best-Fit only)
    min_pair_distance_bars: int = 10    # hardcoded `dist_bars < 10` in MQL5

    @property
    def side_bars(self) -> int:
        return (self.fractal_bars - 1) // 2


@dataclass
class TrendLine:
    slope: float        # price per chronological bar
    intercept: float    # price at bar 0
    bar_start: int      # chrono bar of the older pair point (line starts here)
    touches: int
    score: float

    def price_at(self, bar: int) -> float:
        return self.slope * bar + self.intercept


@dataclass
class FlipLineResult:
    base: TrendLine
    uoedt_intercept: Optional[float]    # upper outermost EDT (None if not found)
    loedt_intercept: Optional[float]    # lower outermost EDT

    def uoedt_at(self, bar: int) -> Optional[float]:
        return None if self.uoedt_intercept is None else self.base.slope * bar + self.uoedt_intercept

    def loedt_at(self, bar: int) -> Optional[float]:
        return None if self.loedt_intercept is None else self.base.slope * bar + self.loedt_intercept


# ============================================================
# Fractal detection (IsUpperFractal / IsLowerFractal)
# ============================================================
def detect_upper_fractals(highs: List[float], side_bars: int) -> List[FractalPoint]:
    """Chrono-order port: newer = larger index. Reject if center <= any NEWER
    high (ties lose) or center < any OLDER high (ties allowed)."""
    out = []
    for idx in range(side_bars, len(highs) - side_bars):
        center = highs[idx]
        ok = True
        for i in range(1, side_bars + 1):
            if center <= highs[idx + i] or center < highs[idx - i]:
                ok = False
                break
        if ok:
            out.append(FractalPoint(bar=idx, price=center, is_peak=True))
    return out


def detect_lower_fractals(lows: List[float], side_bars: int) -> List[FractalPoint]:
    """Mirror rules: reject if center >= any NEWER low or center > any OLDER low."""
    out = []
    for idx in range(side_bars, len(lows) - side_bars):
        center = lows[idx]
        ok = True
        for i in range(1, side_bars + 1):
            if center >= lows[idx + i] or center > lows[idx - i]:
                ok = False
                break
        if ok:
            out.append(FractalPoint(bar=idx, price=center, is_peak=False))
    return out


# ============================================================
# Shared helpers (CalculateToleranceFast / BuildBestFlipLine stage 1)
# ============================================================
def _tolerance(reference_price: float, p: FractalLinesParams, atr: float) -> float:
    if p.tolerance_type == 'atr' and atr > 0:
        return atr * p.tolerance_atr_multiplier
    return reference_price * (p.tolerance_percent / 100.0)


def _in_window(points: List[FractalPoint],
               window: Optional[Tuple[int, int]]) -> List[FractalPoint]:
    if window is None:
        pts = list(points)
    else:
        lo, hi = window
        pts = [f for f in points if lo <= f.bar <= hi]
    return sorted(pts, key=lambda f: f.bar)


def best_fit_line(fractals: List[FractalPoint], p: FractalLinesParams,
                  atr: float = 0.0, require_flip: bool = False) -> Optional[TrendLine]:
    """Stage 1 of BuildBestFlipLine: best-scoring line through fractal pairs."""
    if len(fractals) < p.min_touches:
        return None

    max_allowed_slope = 0.0
    if 0 < p.max_line_angle < 90.0:
        max_allowed_slope = math.tan(p.max_line_angle * math.pi / 180.0)

    best: Optional[TrendLine] = None
    n = len(fractals)
    for i in range(n - 1):
        for j in range(i + 1, n):
            dist_bars = fractals[j].bar - fractals[i].bar
            if dist_bars < p.min_pair_distance_bars:
                continue

            slope = (fractals[j].price - fractals[i].price) / float(dist_bars)
            price_mid = (fractals[i].price + fractals[j].price) / 2.0
            percent_change = (fractals[j].price - fractals[i].price) / price_mid * 100.0
            normalized_slope = percent_change / dist_bars
            if max_allowed_slope > 0 and abs(normalized_slope) > max_allowed_slope:
                continue

            y_intercept = fractals[i].price - slope * fractals[i].bar
            has_peak = fractals[i].is_peak or fractals[j].is_peak
            has_bottom = (not fractals[i].is_peak) or (not fractals[j].is_peak)
            touches = 2
            for k in range(n):
                if k == i or k == j:
                    continue
                expected = slope * fractals[k].bar + y_intercept
                if abs(fractals[k].price - expected) <= _tolerance(fractals[k].price, p, atr):
                    touches += 1
                    if fractals[k].is_peak:
                        has_peak = True
                    else:
                        has_bottom = True

            pass_flip = (has_peak and has_bottom) if require_flip else True
            if touches >= p.min_touches and pass_flip:
                score = touches * 10000.0 + dist_bars
                if best is None or score > best.score:
                    best = TrendLine(slope=slope, intercept=y_intercept,
                                     bar_start=fractals[i].bar,
                                     touches=touches, score=score)
    return best


# ============================================================
# Public entry points (one per indicator)
# ============================================================
def single_best_resistance(highs: List[float], p: Optional[FractalLinesParams] = None,
                           window: Optional[Tuple[int, int]] = None,
                           atr: float = 0.0) -> Optional[TrendLine]:
    """Single-Best-Resistance-Line-v3: best line through upper fractals."""
    p = p or FractalLinesParams()
    fr = _in_window(detect_upper_fractals(highs, p.side_bars), window)
    return best_fit_line(fr, p, atr, require_flip=False)


def single_best_support(lows: List[float], p: Optional[FractalLinesParams] = None,
                        window: Optional[Tuple[int, int]] = None,
                        atr: float = 0.0) -> Optional[TrendLine]:
    """Single-Best-Support-Line-v3: best line through lower fractals."""
    p = p or FractalLinesParams()
    fr = _in_window(detect_lower_fractals(lows, p.side_bars), window)
    return best_fit_line(fr, p, atr, require_flip=False)


def flip_line_with_edts(highs: List[float], lows: List[float],
                        p: Optional[FractalLinesParams] = None,
                        window: Optional[Tuple[int, int]] = None,
                        atr: float = 0.0) -> Optional[FlipLineResult]:
    """2EDT-Fractal-Best-Fit-v5: mixed flip line + symmetrical outermost EDTs."""
    p = p or FractalLinesParams(fractal_bars=35, min_touches=3)
    fr = _in_window(detect_upper_fractals(highs, p.side_bars)
                    + detect_lower_fractals(lows, p.side_bars), window)
    base = best_fit_line(fr, p, atr, require_flip=p.require_both_sides)
    if base is None:
        return None

    # Stage 2: symmetrical EDTs — extreme qualifying parallel intercepts
    max_above = None
    min_below = None
    for f in fr:
        test_intercept = f.price - base.slope * f.bar
        touches = 0
        for k in fr:
            expected = base.slope * k.bar + test_intercept
            if abs(k.price - expected) <= _tolerance(k.price, p, atr):
                touches += 1
        if touches >= p.edt_min_touches:
            if test_intercept > base.intercept:
                if max_above is None or test_intercept > max_above:
                    max_above = test_intercept
            elif test_intercept < base.intercept:
                if min_below is None or test_intercept < min_below:
                    min_below = test_intercept

    return FlipLineResult(base=base, uoedt_intercept=max_above, loedt_intercept=min_below)
