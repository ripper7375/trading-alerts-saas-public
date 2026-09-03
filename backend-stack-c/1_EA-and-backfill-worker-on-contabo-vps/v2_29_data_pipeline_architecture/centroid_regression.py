"""Centroid Regression engine — literal Python port of the calculation layer of
the six 2EDT-Centroid-Regression-*.mq5 variants. ONE engine; the variants are
parameter presets (this removes the Non-A/Non-B/Cherry-A/Cherry-B redundancy).

MQL5 keeps (admin layer): SSA, ema_ssa, crossing detection, fractal maps.
Python receives the crossing points (bar, price) + OHLC history and computes:
Base_FL (baseline), UOEDT, LOEDT and the statistics buffers (slope, anchored
intercept, angle, R2/MSE/VarRatio/Skew/Kurt for crossings and closes).

Port fidelity notes (MQL5 source references — Best-Fit file unless noted):
- Normalization: min/max over crossing bars/prices; degenerate ranges padded
  (+1 bar / +0.00001 price)                          (PerformClusteringAndCFL)
- DBSCAN: hand-rolled RegionQuery/ExpandCluster, eps on normalized coords,
  border points adopt the cluster (assignments == -1 check)   (RunDBSCAN)
- K-means: DETERMINISTIC init centers at data[k * (n // K)], <=100 iters;
  post-filters drop clusters with < min_pts points or avg distance to center
  > max_avg_distance                                 (CustomKMeans + caller)
- Centroids: clusters with >= 3 points; mean of NORMALIZED coords, then
  denormalized; bar = MathRound (half away from zero); sorted newest-first
- Selection:
    most_recent   : the N newest centroids                      (Most-Recent)
    exclude_recent: skip K newest, take next N; shortage shrinks the
                    exclusion first (Non-A/Non-B/Best-Fit pre-step)
    cherry_pick   : walk newest->oldest skipping excluded chrono indices
                    (0 = newest) until N collected             (Cherry-A/B)
- Regression:
    ols           : plain least squares over selected centroids
    best_fit_wls  : exhaustive subset search (masks with >= 3 centroids) of
                    the selected centroids; per-mask WLS with time-decay
                    weights exp(-lambda * bars_from_live); candidate scored
                    by WEIGHTED R^2 of crossings inside the subset's cluster
                    span; best (strict >) wins                  (Best-Fit)
- Observation window: OLS variants bind leftmost to the oldest point of the
  OLDEST used cluster and rightmost to the newest point of the NEWEST used
  cluster; Best-Fit tracks min/max cluster extents over the mask.
- Stats: population moments (/n); skew = m3/var^1.5, kurt = m4/var^2 (not
  excess); var-ratio = sample variance of 2nd half residuals / 1st half
  ((half-1) divisors); angle = atan((slope/mean_close)*100 * 100) degrees;
  intercept anchored at the live bar.
- EDTs: identical outermost-parallel-intercept logic as Phase 2, applied to
  the 35-bar fractal set within [leftmost, rightmost].
"""

import math
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

from fractal_lines import FractalPoint, detect_upper_fractals, detect_lower_fractals


@dataclass
class CrossingPoint:
    bar: int        # chronological bar index
    price: float
    norm_x: float = 0.0
    norm_y: float = 0.0


@dataclass
class Centroid:
    bar_index: int
    price: float
    cluster_id: int


@dataclass
class CentroidRegressionParams:
    """User-configurable parameters (MQL5 inputs, unified across variants)."""
    # clustering
    algo: str = 'dbscan'                 # InpAlgo: 'dbscan' | 'kmeans'
    min_pts: int = 5                     # InpMinPts
    epsilon: float = 0.015               # InpEpsilon (DBSCAN, normalized units)
    points_per_cluster: int = 5          # InpPointsPerCluster (K-means)
    max_avg_distance: float = 0.015      # InpMaxAvgDistance (K-means filter)
    math_lookback: int = 3000            # InpSSAMathLookback (window of crossings)
    # selection + regression (the variant axis)
    selection: str = 'exclude_recent'    # 'most_recent' | 'exclude_recent' | 'cherry_pick'
    regression: str = 'ols'              # 'ols' | 'best_fit_wls'
    reg_centroids: int = 6               # InpRegCentroids (clamped 3..12)
    exclude_recent_centroids: int = 0    # InpExcludeRecentCentroids (clamped 0..9)
    excluded_centroids: List[int] = field(default_factory=list)  # InpExcludedCentroids (chrono idx, 0=newest)
    time_decay_lambda: float = 0.001     # InpTimeDecayLambda (Best-Fit WLS)
    # EDT
    edt_min_touches: int = 3             # InpEDTMinTouches
    fractal_bars: int = 35               # InpFractalBars (the 108 set feeding EDTs)
    tolerance_type: str = 'percent'      # InpToleranceType
    tolerance_percent: float = 0.25      # InpTolerancePercent
    tolerance_atr_multiplier: float = 1.0


# The seven MQL5 indicators as presets of the one engine.
# best_fit_a/best_fit_b: isolated-coexistence split of the former single
# 'best_fit' indicator (2026-09-03) — best_fit_a is config-identical to the
# old best_fit (same reg_centroids/exclusion), best_fit_b is a new preset
# (exclude_recent_centroids=3), mirroring the existing non_a/non_b pattern.
VARIANT_PRESETS = {
    'best_fit_a':  dict(selection='exclude_recent', regression='best_fit_wls',
                        reg_centroids=5, exclude_recent_centroids=0),
    'best_fit_b':  dict(selection='exclude_recent', regression='best_fit_wls',
                        reg_centroids=5, exclude_recent_centroids=3),
    'cherry_a':    dict(selection='cherry_pick', regression='ols', reg_centroids=6),
    'cherry_b':    dict(selection='cherry_pick', regression='ols', reg_centroids=6),
    'most_recent': dict(selection='most_recent', regression='ols', reg_centroids=6),
    'non_a':       dict(selection='exclude_recent', regression='ols',
                        reg_centroids=6, exclude_recent_centroids=0),
    'non_b':       dict(selection='exclude_recent', regression='ols',
                        reg_centroids=6, exclude_recent_centroids=3),
}


@dataclass
class CentroidRegressionResult:
    slope: float                       # base_m
    intercept: float                   # base_c (price at chrono bar 0)
    intercept_anchored: float          # value at the live bar (ExtIntercept)
    angle: float                       # ExtAngle (degrees)
    leftmost: int                      # observation window (chrono bars)
    rightmost: int
    centroid_prices: List[float]       # g_cen_prices feed (per export slots)
    centroids_used: int
    uoedt_intercept: Optional[float]
    loedt_intercept: Optional[float]
    # statistics (Model A = crossings, Model B = close)
    r2_cross: float = 0.0
    mse_cross: float = 0.0
    var_ratio_cross: float = 1.0
    skew_cross: float = 0.0
    kurt_cross: float = 0.0
    r2_close: float = 0.0
    mse_close: float = 0.0
    var_ratio_close: float = 1.0
    skew_close: float = 0.0
    kurt_close: float = 0.0

    def baseline_at(self, bar: int) -> float:
        return self.slope * bar + self.intercept

    def uoedt_at(self, bar: int) -> Optional[float]:
        return None if self.uoedt_intercept is None else self.slope * bar + self.uoedt_intercept

    def loedt_at(self, bar: int) -> Optional[float]:
        return None if self.loedt_intercept is None else self.slope * bar + self.loedt_intercept


def _math_round(x: float) -> int:
    """MQL5 MathRound: half away from zero (Python round() is banker's)."""
    return int(math.floor(x + 0.5)) if x >= 0 else int(math.ceil(x - 0.5))


# ============================================================
# Clustering (literal ports)
# ============================================================
def _region_query(data: List[CrossingPoint], p_idx: int, eps: float) -> List[int]:
    out = []
    for i, d in enumerate(data):
        dist = math.sqrt((data[p_idx].norm_x - d.norm_x) ** 2
                         + (data[p_idx].norm_y - d.norm_y) ** 2)
        if dist <= eps:
            out.append(i)
    return out


def run_dbscan(data: List[CrossingPoint], eps: float, min_pts: int) -> Tuple[List[int], int]:
    """Literal RunDBSCAN port. Returns (assignments, cluster_count); -1 = noise."""
    n = len(data)
    assignments = [-1] * n
    visited = [False] * n
    cluster_id = 0
    for i in range(n):
        if visited[i]:
            continue
        visited[i] = True
        neighbors = _region_query(data, i, eps)
        if len(neighbors) >= min_pts:
            # ExpandCluster
            assignments[i] = cluster_id
            k = 0
            while k < len(neighbors):
                n_idx = neighbors[k]
                if not visited[n_idx]:
                    visited[n_idx] = True
                    n_neighbors = _region_query(data, n_idx, eps)
                    if len(n_neighbors) >= min_pts:
                        for cand in n_neighbors:
                            if cand not in neighbors:
                                neighbors.append(cand)
                if assignments[n_idx] == -1:
                    assignments[n_idx] = cluster_id
                k += 1
            cluster_id += 1
    return assignments, cluster_id


def custom_kmeans(data: List[CrossingPoint], k_clusters: int) -> List[int]:
    """Literal CustomKMeans port — deterministic init at data[k * (n // K)]."""
    n = len(data)
    assignments = [0] * n
    centers = []
    for k in range(k_clusters):
        idx = min(k * (n // k_clusters), n - 1)
        centers.append([data[idx].norm_x, data[idx].norm_y])

    changed = True
    iterations = 0
    while changed and iterations < 100:
        changed = False
        iterations += 1
        for i, d in enumerate(data):
            best_k = 0
            min_dist = 99999999.0
            for k in range(k_clusters):
                dist = math.sqrt((d.norm_x - centers[k][0]) ** 2 + (d.norm_y - centers[k][1]) ** 2)
                if dist < min_dist:
                    min_dist = dist
                    best_k = k
            if assignments[i] != best_k:
                assignments[i] = best_k
                changed = True
        counts = [0] * k_clusters
        sums = [[0.0, 0.0] for _ in range(k_clusters)]
        for i, d in enumerate(data):
            k = assignments[i]
            sums[k][0] += d.norm_x
            sums[k][1] += d.norm_y
            counts[k] += 1
        for k in range(k_clusters):
            if counts[k] > 0:
                centers[k] = [sums[k][0] / counts[k], sums[k][1] / counts[k]]
    return assignments


# ============================================================
# Engine
# ============================================================
def _normalize(points: List[CrossingPoint]) -> Tuple[float, float, float, float]:
    min_bar = min(p.bar for p in points)
    max_bar = max(p.bar for p in points)
    min_price = min(p.price for p in points)
    max_price = max(p.price for p in points)
    if max_bar == min_bar:
        max_bar += 1
    if max_price == min_price:
        max_price += 0.00001
    for p in points:
        p.norm_x = (p.bar - min_bar) / (max_bar - min_bar)
        p.norm_y = (p.price - min_price) / (max_price - min_price)
    return min_bar, max_bar, min_price, max_price


def _cluster(points: List[CrossingPoint], p: CentroidRegressionParams) -> Tuple[List[int], int]:
    if p.algo == 'kmeans':
        total = max(2, len(points) // p.points_per_cluster)
        assignments = custom_kmeans(points, total)
        # post-filters: drop clusters with < min_pts points or too-spread points
        for k in range(total):
            members = [i for i, a in enumerate(assignments) if a == k]
            if len(members) < p.min_pts:
                for i in members:
                    assignments[i] = -1
                continue
            cx = sum(points[i].norm_x for i in members) / len(members)
            cy = sum(points[i].norm_y for i in members) / len(members)
            total_dist = sum(math.sqrt((points[i].norm_x - cx) ** 2 + (points[i].norm_y - cy) ** 2)
                             for i in members)
            if total_dist / len(members) > p.max_avg_distance:
                for i in members:
                    assignments[i] = -1
        return assignments, total
    assignments, total = run_dbscan(points, p.epsilon, p.min_pts)
    return assignments, total


def _build_centroids(points: List[CrossingPoint], assignments: List[int], total_clusters: int,
                     norm: Tuple[float, float, float, float]) -> List[Centroid]:
    min_bar, max_bar, min_price, max_price = norm
    centroids = []
    for k in range(total_clusters):
        members = [points[i] for i, a in enumerate(assignments) if a == k]
        if len(members) >= 3:
            cx = sum(m.norm_x for m in members) / len(members)
            cy = sum(m.norm_y for m in members) / len(members)
            centroids.append(Centroid(
                bar_index=_math_round(cx * (max_bar - min_bar) + min_bar),
                price=cy * (max_price - min_price) + min_price,
                cluster_id=k))
    centroids.sort(key=lambda c: -c.bar_index)   # newest first
    return centroids


def _select(centroids: List[Centroid], p: CentroidRegressionParams):
    """Returns (selected_indices_into_centroids, centroid_prices_export, actual_exclude)."""
    target = max(3, min(p.reg_centroids, 12))
    cen_prices = [0.0] * 12

    if p.selection == 'most_recent':
        if len(centroids) < target:
            return None, cen_prices, 0
        for c in range(min(12, len(centroids))):
            cen_prices[c] = centroids[c].price
        return list(range(target)), cen_prices, 0

    if p.selection == 'cherry_pick':
        excluded = set(p.excluded_centroids)
        selected = []
        chrono_idx = 0
        while len(selected) < target and chrono_idx < len(centroids):
            if chrono_idx not in excluded:
                selected.append(chrono_idx)
            chrono_idx += 1
        if len(selected) < target:
            return None, cen_prices, 0
        for c in range(min(12, chrono_idx)):
            if c not in excluded:
                cen_prices[c] = centroids[c].price
        return selected, cen_prices, 0

    # exclude_recent (Non-A/Non-B and the Best-Fit pre-step)
    user_exclude = max(0, min(p.exclude_recent_centroids, 9))
    actual_exclude = user_exclude
    n_reg = target
    if len(centroids) < target + user_exclude:
        actual_exclude = max(0, len(centroids) - target)
        n_reg = len(centroids) - actual_exclude
    min_needed = 3 if p.regression == 'best_fit_wls' else 2
    if n_reg < min_needed:
        return None, cen_prices, actual_exclude
    for c in range(min(12, n_reg)):
        cen_prices[c] = centroids[c + actual_exclude].price
    return [c + actual_exclude for c in range(n_reg)], cen_prices, actual_exclude


def _ols(xs: List[float], ys: List[float]) -> Tuple[float, float]:
    n = len(xs)
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    num = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    den = sum((x - mean_x) ** 2 for x in xs)
    if den != 0:
        m = num / den
        return m, mean_y - m * mean_x
    return 0.0, mean_y


def _window_from_clusters(points, assignments, cluster_ids) -> Tuple[int, int]:
    """OLS variants: leftmost = oldest point of oldest used cluster,
    rightmost = newest point of newest used cluster."""
    oldest_cid, newest_cid = cluster_ids
    leftmost = None
    rightmost = None
    for i, pt in enumerate(points):
        if assignments[i] == oldest_cid and (leftmost is None or pt.bar < leftmost):
            leftmost = pt.bar
        if assignments[i] == newest_cid and (rightmost is None or pt.bar > rightmost):
            rightmost = pt.bar
    return leftmost, rightmost


def _best_fit_wls(centroids, selected, points, assignments, p, live_bar):
    """Best-Fit: exhaustive subset search with time-decay WLS, weighted-R2 scored."""
    n_reg = len(selected)
    cen_w = [math.exp(-p.time_decay_lambda * (live_bar - centroids[s].bar_index)) for s in selected]
    pt_w = [math.exp(-p.time_decay_lambda * (live_bar - pt.bar)) for pt in points]

    cl_left = []
    cl_right = []
    for s in selected:
        cid = centroids[s].cluster_id
        bars = [pt.bar for i, pt in enumerate(points) if assignments[i] == cid]
        cl_left.append(min(bars) if bars else live_bar + 1)
        cl_right.append(max(bars) if bars else -1)

    best = None   # (r2, m, c, leftmost, rightmost, bits)
    for mask in range(1, 1 << n_reg):
        bits = bin(mask).count('1')
        if bits < 3:
            continue
        sw = swx = swy = swxy = swx2 = 0.0
        leftmost = live_bar + 1
        rightmost = -1
        for b in range(n_reg):
            if mask & (1 << b):
                w = cen_w[b]
                cx = float(centroids[selected[b]].bar_index)
                cy = centroids[selected[b]].price
                sw += w
                swx += w * cx
                swy += w * cy
                swxy += w * cx * cy
                swx2 += w * cx * cx
                leftmost = min(leftmost, cl_left[b])
                rightmost = max(rightmost, cl_right[b])
        if leftmost >= rightmost:
            continue
        d = sw * swx2 - swx * swx
        if d == 0:
            continue
        m = (sw * swxy - swx * swy) / d
        c = (swy - m * swx) / sw

        in_win = [(pt, pt_w[i]) for i, pt in enumerate(points) if leftmost <= pt.bar <= rightmost]
        if len(in_win) < 3:
            continue
        sum_w = sum(w for _, w in in_win)
        if sum_w == 0:
            continue
        w_mean = sum(pt.price * w for pt, w in in_win) / sum_w
        res_sq = sum(w * (pt.price - (m * pt.bar + c)) ** 2 for pt, w in in_win)
        tot_sq = sum(w * (pt.price - w_mean) ** 2 for pt, w in in_win)
        r2 = 1.0 - res_sq / tot_sq if tot_sq != 0 else 0.0
        if best is None or r2 > best[0]:
            best = (r2, m, c, leftmost, rightmost, bits)
    return best


def _stats(crossings_in_win, closes, leftmost, rightmost, base_m, base_c):
    """Shared stats back-end (population moments, var-ratio half split)."""
    out = dict(r2_cross=0.0, mse_cross=0.0, var_ratio_cross=1.0, skew_cross=0.0,
               kurt_cross=0.0, r2_close=0.0, mse_close=0.0, var_ratio_close=1.0,
               skew_close=0.0, kurt_close=0.0, angle=0.0)
    n_close = rightmost - leftmost + 1
    n_cross = len(crossings_in_win)
    close_win = closes[leftmost:rightmost + 1]
    mean_close = sum(close_win) / n_close if n_close > 0 else 0.0
    if mean_close != 0:
        out['angle'] = math.atan((base_m / mean_close) * 100.0 * 100.0) * 180.0 / math.pi
    if n_cross < 3 or n_close < 3:
        return out

    res_cross = [pt.price - (base_m * pt.bar + base_c) for pt in crossings_in_win]
    res_close = [c - (base_m * (leftmost + i) + base_c) for i, c in enumerate(close_win)]
    mean_cross = sum(pt.price for pt in crossings_in_win) / n_cross

    def model(res, actuals, mean_actual, n):
        mean_e = sum(res) / n
        m2 = sum(e * e for e in res) / n
        var = sum((e - mean_e) ** 2 for e in res) / n
        m3 = sum((e - mean_e) ** 3 for e in res) / n
        m4 = sum((e - mean_e) ** 4 for e in res) / n
        tot_sq = sum((a - mean_actual) ** 2 for a in actuals)
        r2 = 1.0 - (m2 * n) / tot_sq if tot_sq != 0 else 0.0
        skew = m3 / var ** 1.5 if var > 0 else 0.0
        kurt = m4 / var ** 2 if var > 0 else 0.0
        var_ratio = 1.0
        half = n // 2
        if half > 1:
            r1, r2h = res[:half], res[half:]
            mt1 = sum(r1) / half
            mt2 = sum(r2h) / (n - half)
            vt1 = sum((e - mt1) ** 2 for e in r1) / (half - 1)
            vt2 = sum((e - mt2) ** 2 for e in r2h) / (n - half - 1)
            if vt1 > 0:
                var_ratio = vt2 / vt1
        return m2, r2, skew, kurt, var_ratio

    out['mse_cross'], out['r2_cross'], out['skew_cross'], out['kurt_cross'], out['var_ratio_cross'] = \
        model(res_cross, [pt.price for pt in crossings_in_win], mean_cross, n_cross)
    out['mse_close'], out['r2_close'], out['skew_close'], out['kurt_close'], out['var_ratio_close'] = \
        model(res_close, close_win, mean_close, n_close)
    return out


def _edts(base_m, base_c, fractals, p: CentroidRegressionParams, atr: float):
    """BuildSymmetricalEDTs — outermost qualifying parallel intercepts."""
    def tol(ref):
        if p.tolerance_type == 'atr' and atr > 0:
            return atr * p.tolerance_atr_multiplier
        return ref * (p.tolerance_percent / 100.0)

    max_above = None
    min_below = None
    for f in fractals:
        test_c = f.price - base_m * f.bar
        touches = sum(1 for k in fractals
                      if abs(k.price - (base_m * k.bar + test_c)) <= tol(k.price))
        if touches >= p.edt_min_touches:
            if test_c > base_c and (max_above is None or test_c > max_above):
                max_above = test_c
            elif test_c < base_c and (min_below is None or test_c < min_below):
                min_below = test_c
    return max_above, min_below


def calculate(crossings: List[Tuple[int, float]], closes: List[float],
              highs: List[float], lows: List[float],
              params: Optional[CentroidRegressionParams] = None,
              atr: float = 0.0) -> Optional[CentroidRegressionResult]:
    """Run the full chain for one variant configuration.

    crossings: (chrono bar, crossing price) pairs from the MQL5 SSA export,
               in bar order. closes/highs/lows: full chrono OHLC arrays
               (bar index == array index, live bar = last element).
    """
    p = params or CentroidRegressionParams()
    live_bar = len(closes) - 1

    start = max(0, len(closes) - p.math_lookback)
    points = [CrossingPoint(bar=b, price=pr) for b, pr in crossings if b >= start]
    if len(points) < p.min_pts:
        return None

    norm = _normalize(points)
    assignments, total_clusters = _cluster(points, p)
    centroids = _build_centroids(points, assignments, total_clusters, norm)

    selected, cen_prices, _ = _select(centroids, p)
    if selected is None:
        return None

    if p.regression == 'best_fit_wls':
        best = _best_fit_wls(centroids, selected, points, assignments, p, live_bar)
        if best is None:
            return None
        _, base_m, base_c, leftmost, rightmost, used = best
    else:
        xs = [float(centroids[s].bar_index) for s in selected]
        ys = [centroids[s].price for s in selected]
        base_m, base_c = _ols(xs, ys)
        leftmost, rightmost = _window_from_clusters(
            points, assignments,
            (centroids[selected[-1]].cluster_id, centroids[selected[0]].cluster_id))
        used = len(selected)
        if leftmost is None or rightmost is None:
            return None

    crossings_in_win = [pt for pt in points if leftmost <= pt.bar <= rightmost]
    stats = _stats(crossings_in_win, closes, leftmost, rightmost, base_m, base_c)

    side = (p.fractal_bars - 1) // 2
    fractals = [f for f in detect_upper_fractals(highs, side) + detect_lower_fractals(lows, side)
                if leftmost <= f.bar <= rightmost]
    uoedt, loedt = _edts(base_m, base_c, fractals, p, atr)

    return CentroidRegressionResult(
        slope=base_m, intercept=base_c,
        intercept_anchored=base_m * live_bar + base_c,
        angle=stats.pop('angle'),
        leftmost=leftmost, rightmost=rightmost,
        centroid_prices=cen_prices, centroids_used=used,
        uoedt_intercept=uoedt, loedt_intercept=loedt, **stats)


def calculate_variant(variant: str, crossings, closes, highs, lows,
                      atr: float = 0.0, **overrides) -> Optional[CentroidRegressionResult]:
    """Convenience entry: run one of the six MQL5 variant presets (or override
    any parameter — this is the user-configurable surface)."""
    cfg = dict(VARIANT_PRESETS[variant])
    cfg.update(overrides)
    return calculate(crossings, closes, highs, lows, CentroidRegressionParams(**cfg), atr)
