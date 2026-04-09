# DavinTrade Heatmap Expansion Stack — The "Blob" Engine

### Version 2.2 — Updated Blueprint for Claude Code Implementation

---

## Important Usage Note

This document is the **extension phase** blueprint. It must be implemented **after** the Core Backend Stack
(`davintrade-python-backend-architecture-v2.md`) has been completed successfully.

**Prerequisite:** The Core Backend must be producing a validated array of Confluence Nodes
containing `[timestamp, price, weight]` as its Phase 3 output before this document is executed.

---

## Revision Notes (v1 → v2)

| #   | Change                                                                   | Type         |
| --- | ------------------------------------------------------------------------ | ------------ |
| 1   | Both FastAPI instances eliminated — replaced by Celery + Redis           | Architecture |
| 2   | Python Celery Worker confirmed as async compute layer                    | New          |
| 3   | NestJS Controller confirmed as the single API surface (not Python)       | Architecture |
| 4   | Redis-only storage rule documented — no PostgreSQL for heatmap data      | Storage Rule |
| 5   | Phase 6 config schema extended with `heatmap_blob` block                 | Config       |
| 6   | BullMQ specified as the NestJS-side job trigger                          | Worker       |
| 7   | Redis key naming convention defined explicitly                           | Convention   |
| 8   | API payload extended with `entropy` and `ssa_regime` fields              | API          |
| 9   | Frontend architecture clarified — dual-panel, ECharts is supplement only | Frontend     |
| 10  | ECharts version corrected to v6.0.0                                      | Frontend     |
| 11  | `density_threshold` parameter documented clearly (0–1 float)             | Code Clarity |
| 12  | `BACKEND_URL` corrected — Next.js calls NestJS, never Python directly    | Frontend     |

## Revision Notes (v2 → v2.1)

| #   | Change                                                                                                                                                                                    | Type       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 13  | Phase 6 config schema: `entropy_bins` removed from `ssa_entropy` block, `price_step_points` + `point_size` added — aligns with corrected `compute_shannon_entropy()` in core backend v2.1 | Config Fix |

## Revision Notes (v2.1 → v2.2)

| #   | Change                                                                                                               | Type     |
| --- | -------------------------------------------------------------------------------------------------------------------- | -------- |
| 14  | Section 6 completely rewritten — full dashboard layout spec with toolbar, left/right panel details                   | Frontend |
| 15  | HMI gauge chart added — `calculate_hmi_m5()` output displayed as third gauge alongside RPI + BPI                     | New      |
| 16  | ECharts heatmap chart: fractal markers (MQL5 108 down / 119 up) added as scatter series                              | Frontend |
| 17  | Sandwich price labels added — `upper_sandwich_price` + `lower_sandwich_price` as graphic text bottom-left of heatmap | Frontend |
| 18  | Three gauge implementations documented — `getGaugeOption()` + `EChartsGaugeChart.tsx` with Active Indication         | Frontend |
| 19  | Timeframe selector behaviour documented — controls both panels, M5/M15/M30/H1 only                                   | Frontend |
| 20  | Hide/unhide trendlines documented — left TradingView panel only                                                      | Frontend |
| 21  | Phase 6 config: `hmi_structural` block added to both XAUUSD and DEFAULT                                              | Config   |
| 22  | ECharts tree-shaken registration updated — `ScatterChart`, `GaugeChart`, `GraphicComponent` added                    | Frontend |

---

## 1. System Overview

built on top of the Core Python Backend. It consumes raw Confluence Nodes (trendline intersections)
produced by Phase 3 of the core engine, processes them into organic topological heat zones using
Kernel Density Estimation (KDE), calculates their geometric polygon boundaries, caches the output
in Redis, and serves it via the existing NestJS Controller API to the Next.js frontend utilizing
Apache ECharts (right supplement panel).

### Full Data Flow

```
MT5 terminals (Contabo VPS)
  → Export Advisor EA
  → BullMQ (NestJS, Railway)
  → NestJS Worker (Railway)
  → Redis Job Queue          ← Celery broker: async job handoff
  → Python Celery Worker     ← Pandas + NumPy + KDE + Shapely (Railway)
  → Redis heatmap cache      ← key: heatmap:zones:{symbol}:{timeframe}
  → NestJS Controller        ← reads Redis, single API surface (Railway)
  → Apache ECharts           ← TypeScript + Next.js 16 + Vercel (right panel)
```

### Critical Storage Rule

> **RPI, BPI, and Heatmap Polygon data are stored in Redis ONLY.**
> PostgreSQL stores OHLCV and indicator values from MT5 only.
> Claude Code must NOT create PostgreSQL tables or Prisma models for these outputs.

### Dual-Panel Frontend Context

The Next.js frontend uses two charting libraries on a single dashboard screen:

| Panel       | Library                             | Purpose                                                    |
| ----------- | ----------------------------------- | ---------------------------------------------------------- |
| Left panel  | TradingView Lightweight Charts v5.x | Primary chart: candlestick, bar, line, symbol/marker plots |
| Right panel | Apache ECharts v6.0.0               | Supplement: heatmap blob overlay, radar, gauge, matrix     |

The heatmap blob polygons rendered by ECharts are a **supplement** to the primary TradingView chart.
ECharts does not replace TradingView. The Next.js frontend calls **NestJS Controller** only — it
never calls Python directly.

---

## 2. Backend Architecture: The Python Celery Blob Engine

### How the Job Is Triggered

The NestJS Worker (existing BullMQ worker) writes a Celery job payload into Redis after completing
its standard data processing cycle. Python never receives HTTP requests — it consumes jobs from
the Redis queue via Celery.

```typescript
// NestJS Worker (existing BullMQ worker) — append this job dispatch
// after standard data processing is complete

import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

// Dispatch heatmap compute job to Redis Celery queue
await this.heatmapQueue.add('compute_heatmap', {
  symbol: 'XAUUSD',
  timeframe: 'M5',
  confluence_nodes: confluenceNodes, // [{timestamp, price, weight}, ...]
});
```

The Python Celery Worker picks this job up and runs the full blob computation pipeline described
in the sections below.

### Why Both FastAPI Instances Were Eliminated

| Original Design                           | Problem                                                                     | Replacement                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| FastAPI between NestJS Worker → Python    | Required a second HTTP server on Railway, port management, extra deployment | Redis Job Queue — Celery broker, pure async, no HTTP                           |
| FastAPI between Python → ECharts frontend | Python would need to serve HTTP; frontend would need to call two backends   | NestJS Controller reads Redis directly, serves ECharts as part of existing API |

---

## 3. Blob Engine Pipeline (Python — scipy + shapely + numpy)

### Step 3.1: Data Normalization (Critical Step)

**The Problem:** Unix timestamps are large integers (e.g., `1775028900`) while asset prices are
relatively small floats (e.g., `4720.50`). If fed directly into a KDE algorithm, bandwidth
calculation will skew entirely toward the time axis, ruining the density map.

**The Solution:** Both the time array and price array must be independently normalized to a `[0, 1]`
range using `MinMaxScaler` before applying KDE, then denormalized back to absolute values when
creating the final polygon output.

### Step 3.2: Kernel Density Estimation (SciPy)

- **Library:** `scipy.stats.gaussian_kde`
- **Formula:** `f(x) = (1/nh) * Σ K((x - Xᵢ) / h)` where `K` is the Gaussian kernel and `h` is
  the bandwidth (auto-selected by SciPy using Scott's rule by default, configurable per symbol
  via Phase 6 config schema)
- **Grid Evaluation:** Create a 2D grid over the normalized coordinate space (100×100 by default,
  configurable). Evaluate the KDE over this grid to assign a heat score to every coordinate.
- **Thresholding:** Filter grid points where the heat score exceeds the `density_threshold`
  percentile. `density_threshold` is a **0–1 float** representing the percentile cutoff
  (e.g., `0.85` = retain only the top 15% most dense points). Internally computed as
  `np.percentile(density, density_threshold * 100)`.

### Step 3.3: Geometric Boundary Generation (Shapely)

- **Library:** `shapely.geometry.MultiPoint`
- **Primary method:** `.convex_hull` — wraps a convex geometric boundary around the dense points
- **Alternative method:** Alpha Shape (Concave Hull) — use when `hull_type = "alpha"` in config.
  Allows the blob to contour more naturally around irregular data clusters.
- **Output:** Exterior coordinates of the resulting Shapely polygon, closed
  (first coordinate == last coordinate)

### Step 3.4: Output Caching (Redis)

- Heavy spatial geometry calculations must not occur on every API request
- The Python Celery Worker writes computed polygon payloads to Redis on a scheduled interval
  (default: every 5 minutes, configurable via `cache_ttl_seconds` in Phase 6 config schema)
- **Redis Key Convention:** `heatmap:zones:{symbol}:{timeframe}`
  - Example: `heatmap:zones:XAUUSD:M5`
  - Example: `heatmap:zones:XAUUSD:M15`
- **TTL:** Set Redis key TTL to `cache_ttl_seconds` so stale blobs expire automatically if the
  worker fails to refresh

### Complete Python Blob Pipeline

```python
import numpy as np
from scipy.stats import gaussian_kde
from shapely.geometry import MultiPoint
from sklearn.preprocessing import MinMaxScaler
import redis
import json
import celery

app = celery.Celery('heatmap_worker', broker='redis://localhost:6379/0')

@app.task
def compute_heatmap_zones(symbol: str, timeframe: str, confluence_nodes: list, symbol_config: dict):
    """
    Celery task: consumes Confluence Nodes from NestJS Worker via Redis job queue.
    Writes computed polygon JSON to Redis heatmap cache.
    Never serves HTTP — pure compute worker.

    Parameters:
        symbol          : e.g. 'XAUUSD'
        timeframe       : e.g. 'M5'
        confluence_nodes: list of {timestamp, price, weight} dicts
        symbol_config   : Phase 6 config dict containing 'heatmap_blob' block
    """
    cfg = symbol_config.get('heatmap_blob', {})

    time_array  = np.array([n['timestamp'] for n in confluence_nodes], dtype=float)
    price_array = np.array([n['price'] for n in confluence_nodes], dtype=float)
    weight_array = np.array([n['weight'] for n in confluence_nodes], dtype=float)

    if len(time_array) < 3:
        return  # insufficient points for polygon

    heat_zones = []

    # Group by intensity bands using weight percentiles
    for intensity, (low_pct, high_pct), color in [
        ('high',   (0.70, 1.00), 'rgba(255, 69,   0, 0.45)'),
        ('medium', (0.40, 0.70), 'rgba(255, 165,  0, 0.30)'),
        ('low',    (0.00, 0.40), 'rgba(255, 255,  0, 0.15)'),
    ]:
        mask = (weight_array >= np.percentile(weight_array, low_pct * 100)) & \
               (weight_array <  np.percentile(weight_array, high_pct * 100))

        t_band = time_array[mask]
        p_band = price_array[mask]

        if len(t_band) < 3:
            continue

        polygon_coords = generate_heat_polygon(
            t_band, p_band,
            density_threshold=cfg.get('density_threshold', 0.85),
            grid_resolution=cfg.get('grid_resolution', 100),
            bandwidth=cfg.get('kde_bandwidth', 'scott'),
            hull_type=cfg.get('hull_type', 'convex'),
            alpha_value=cfg.get('alpha_shape_value', 0.5),
        )

        if polygon_coords:
            heat_zones.append({
                'id': f'zone_{intensity}_{symbol}_{timeframe}',
                'intensity': intensity,
                'color': color,
                'polygon': polygon_coords,
            })

    # Write to Redis cache — NestJS Controller reads from here
    r = redis.Redis(host='localhost', port=6379, db=0)
    cache_key = f'heatmap:zones:{symbol}:{timeframe}'
    payload = {
        'status': 'success',
        'symbol': symbol,
        'timeframe': timeframe,
        'last_updated': int(time_array[-1]),
        'data': {'heat_zones': heat_zones},
    }
    ttl = cfg.get('cache_ttl_seconds', 300)
    r.setex(cache_key, ttl, json.dumps(payload))


def generate_heat_polygon(
    time_array: np.ndarray,
    price_array: np.ndarray,
    density_threshold: float = 0.85,
    grid_resolution: int = 100,
    bandwidth: str = 'scott',
    hull_type: str = 'convex',
    alpha_value: float = 0.5,
) -> list:
    """
    Generates a single heat zone polygon from a cluster of time/price points.

    Parameters:
        density_threshold : Float in [0, 1]. The percentile cutoff for high-density
                            points. 0.85 means retain only the top 15% densest grid
                            cells. Passed to np.percentile as (density_threshold * 100).
        grid_resolution   : Number of grid cells per axis (100 = 100x100 grid).
        bandwidth         : SciPy KDE bandwidth method ('scott', 'silverman', or float).
        hull_type         : 'convex' for ConvexHull, 'alpha' for Alpha Shape (ConcaveHull).
        alpha_value       : Alpha parameter for concave hull (lower = more concave).

    Returns:
        List of [timestamp, price] coordinate pairs (closed polygon).
        Empty list if insufficient points.
    """
    # Step 1: Normalize to [0, 1] — prevents time-axis bandwidth skew
    scaler_t = MinMaxScaler()
    scaler_p = MinMaxScaler()
    t_norm = scaler_t.fit_transform(time_array.reshape(-1, 1)).flatten()
    p_norm = scaler_p.fit_transform(price_array.reshape(-1, 1)).flatten()

    # Step 2: KDE on normalized space
    points_norm = np.vstack([t_norm, p_norm])
    kde = gaussian_kde(points_norm, bw_method=bandwidth)

    # Step 3: Evaluate KDE on grid
    t_grid, p_grid = np.mgrid[0:1:complex(0, grid_resolution),
                               0:1:complex(0, grid_resolution)]
    positions = np.vstack([t_grid.ravel(), p_grid.ravel()])
    density = kde(positions)

    # Step 4: Filter high-density points
    # density_threshold is a [0,1] float; multiply by 100 for np.percentile
    threshold_value = np.percentile(density, density_threshold * 100)
    dense_mask = density >= threshold_value
    dense_points_norm = positions[:, dense_mask].T

    if len(dense_points_norm) < 3:
        return []

    # Step 5: Denormalize back to raw Time/Price coordinates
    dense_t = scaler_t.inverse_transform(
        dense_points_norm[:, 0].reshape(-1, 1)
    ).flatten()
    dense_p = scaler_p.inverse_transform(
        dense_points_norm[:, 1].reshape(-1, 1)
    ).flatten()
    dense_points_raw = np.column_stack((dense_t, dense_p))

    # Step 6: Generate geometric boundary
    multi_point = MultiPoint(dense_points_raw)

    if hull_type == 'alpha':
        # Alpha Shape for more organic, concave blob boundaries
        # Requires alphashape library: pip install alphashape
        import alphashape
        hull = alphashape.alphashape(dense_points_raw, alpha_value)
    else:
        # Default: Convex Hull
        hull = multi_point.convex_hull

    # Step 7: Extract exterior coordinates (closed polygon guaranteed)
    if hull.geom_type == 'Polygon':
        coords = list(hull.exterior.coords)
        return [[float(c[0]), float(c[1])] for c in coords]

    return []
```

---

## 4. API Design Specification

### Endpoint

The heatmap endpoint is served by the **existing NestJS Controller** on Railway. Python never
serves HTTP. NestJS reads the Redis cache key and returns the payload directly.

```
GET /api/v1/heatmap/zones
```

### Query Parameters

| Parameter   | Type   | Example  | Description     |
| ----------- | ------ | -------- | --------------- |
| `symbol`    | string | `XAUUSD` | Trading symbol  |
| `timeframe` | string | `M5`     | Chart timeframe |

### NestJS Controller Implementation

```typescript
// heatmap/heatmap.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { HeatmapService } from './heatmap.service';

@Controller('api/v1/heatmap')
export class HeatmapController {
  constructor(private readonly heatmapService: HeatmapService) {}

  @Get('zones')
  async getHeatZones(
    @Query('symbol') symbol: string,
    @Query('timeframe') timeframe: string
  ) {
    return this.heatmapService.getZonesFromCache(symbol, timeframe);
  }
}

// heatmap/heatmap.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class HeatmapService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async getZonesFromCache(symbol: string, timeframe: string) {
    const cacheKey = `heatmap:zones:${symbol}:${timeframe}`;
    const cached = await this.redis.get(cacheKey);

    if (!cached) {
      return {
        status: 'pending',
        symbol,
        timeframe,
        message: 'Heatmap computation in progress. Retry shortly.',
        data: { heat_zones: [] },
      };
    }

    return JSON.parse(cached);
  }
}
```

### Full Response Payload Schema

The response payload from `GET /api/v1/heatmap/zones` includes both the heatmap polygon data
and the unified RPI/BPI/entropy fields from the core backend (v2 standard). The Next.js frontend
makes a **single API call** to NestJS Controller — NestJS assembles the complete payload by
reading multiple Redis keys.

```json
{
  "status": "success",
  "symbol": "XAUUSD",
  "timeframe": "M5",
  "last_updated": 1775030400,
  "active_rpi": 72.4,
  "active_rpi_type": "Resistance",
  "active_bpi": 61.8,
  "active_bpi_type": "Resistance Breakout",
  "distance_to_active": 4.25,
  "entropy": 0.42,
  "ssa_regime": "Transition",
  "data": {
    "heat_zones": [
      {
        "id": "zone_high_XAUUSD_M5",
        "intensity": "high",
        "color": "rgba(255, 69, 0, 0.45)",
        "polygon": [
          [1775028900, 4720.5],
          [1775030400, 4735.0],
          [1775034000, 4710.25],
          [1775028900, 4720.5]
        ]
      },
      {
        "id": "zone_medium_XAUUSD_M5",
        "intensity": "medium",
        "color": "rgba(255, 165, 0, 0.30)",
        "polygon": [
          [1775025000, 4695.0],
          [1775028900, 4715.5],
          [1775025000, 4695.0]
        ]
      }
    ]
  }
}
```

> **Polygon closure guarantee:** The first and last coordinate pair of every polygon array must
> be identical. The Python backend guarantees this via Shapely's `.exterior.coords` output.
> Claude Code must validate this in the NestJS service layer before caching.

---

## 5. Phase 6 Config Schema — Heatmap Extension

The following `heatmap_blob` and `hmi_structural` blocks must be added to the existing per-symbol
Phase 6 config schema alongside the existing `rpi_structural`, `bpi_kinetic`, and `ssa_entropy` blocks.

```json
{
  "XAUUSD": {
    "hmi_structural": {
      "note": "HMI uses Final_Score and global_max_score only. No sigma_pct — proximity decay intentionally absent."
    },
    "rpi_structural": {
      "sigma_pct": 0.001
    },
    "bpi_kinetic": {
      "htf_macro_lookback_bars": 96,
      "htf_strong_threshold": 0.7,
      "htf_weak_threshold": 0.3,
      "htf_strong_multiplier": 1.5,
      "htf_weak_multiplier": 0.5,
      "ltf_proximity_threshold": 0.0015,
      "ltf_crawl_window": 20,
      "ltf_crawl_max_score_crosses": 2.0,
      "ltf_ignition_bonus": 1.2
    },
    "ssa_entropy": {
      "entropy_window": 50,
      "price_step_points": 0.01,
      "point_size": 0.01,
      "entropy_trend_threshold": 0.35,
      "entropy_chaotic_threshold": 0.65,
      "ssa_rank": 6,
      "ssa_signal_period": 3,
      "ssa_window_trend": 40,
      "ssa_window_transition": 20,
      "ssa_window_chaotic": 10
    },
    "heatmap_blob": {
      "density_threshold": 0.85,
      "grid_resolution": 100,
      "kde_bandwidth": "scott",
      "cache_ttl_seconds": 300,
      "hull_type": "convex",
      "alpha_shape_value": 0.5
    }
  },
  "DEFAULT": {
    "hmi_structural": {
      "note": "HMI uses Final_Score and global_max_score only. No sigma_pct — proximity decay intentionally absent."
    },
    "rpi_structural": { "sigma_pct": 0.001 },
    "bpi_kinetic": {
      "htf_macro_lookback_bars": 96,
      "htf_strong_threshold": 0.7,
      "htf_weak_threshold": 0.3,
      "htf_strong_multiplier": 1.5,
      "htf_weak_multiplier": 0.5,
      "ltf_proximity_threshold": 0.0015,
      "ltf_crawl_window": 20,
      "ltf_crawl_max_score_crosses": 2.0,
      "ltf_ignition_bonus": 1.2
    },
    "ssa_entropy": {
      "entropy_window": 50,
      "price_step_points": 0.01,
      "point_size": 0.01,
      "entropy_trend_threshold": 0.35,
      "entropy_chaotic_threshold": 0.65,
      "ssa_rank": 6,
      "ssa_signal_period": 3,
      "ssa_window_trend": 40,
      "ssa_window_transition": 20,
      "ssa_window_chaotic": 10
    },
    "heatmap_blob": {
      "density_threshold": 0.85,
      "grid_resolution": 100,
      "kde_bandwidth": "scott",
      "cache_ttl_seconds": 300,
      "hull_type": "convex",
      "alpha_shape_value": 0.5
    }
  }
}
```

### Config Parameter Reference

| Parameter           | Type            | Default    | Description                                                                                                                  |
| ------------------- | --------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `density_threshold` | float [0–1]     | `0.85`     | Percentile cutoff for dense grid points. `0.85` retains top 15%. Passed as `np.percentile(density, density_threshold * 100)` |
| `grid_resolution`   | int             | `100`      | KDE grid cells per axis (100 = 100×100 = 10,000 evaluation points)                                                           |
| `kde_bandwidth`     | string or float | `"scott"`  | SciPy bandwidth method: `"scott"`, `"silverman"`, or a fixed float                                                           |
| `cache_ttl_seconds` | int             | `300`      | Redis key TTL in seconds (5 minutes default)                                                                                 |
| `hull_type`         | string          | `"convex"` | `"convex"` = ConvexHull (fast, rigid). `"alpha"` = Alpha Shape (organic, requires `alphashape` library)                      |
| `alpha_shape_value` | float           | `0.5`      | Alpha parameter for concave hull. Lower = more concave, more organic                                                         |

---

## 6. Frontend Integration: Full Dashboard Specification

### 6.1 Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TOP TOOLBAR (full width, shared controls)                                  │
│  [Line|Candle|Bar icon switcher]  [XAUUSD ▾]  [M5][M15][M30][H1]  [☀/☾]  │
├──────────────────────────────────┬──────────────────────────────────────────┤
│                                  │                                          │
│  LEFT PANEL                      │  RIGHT PANEL TOP                        │
│  TradingView Lightweight Charts  │  Apache ECharts — Heatmap Chart         │
│                                  │                                          │
│  • Candle / Bar / Line           │  • SSA line                             │
│    (switchable via toolbar)      │  • EMA-SSA line                         │
│  • Trendlines — golden plots     │  • Fractal up markers (MQL5 code 119)   │
│    (hide/unhide toggle)          │  • Fractal down markers (MQL5 code 108) │
│                                  │  • Trendlines — golden plots (always on)│
│                                  │  • Polygon color gradient blobs         │
│                                  │                                          │
│                                  │  [Upper Sandwich Price] bottom-left     │
│                                  │  [Lower Sandwich Price] bottom-left     │
├──────────────────────────────────┼─────────────┬─────────────┬─────────────┤
│                                  │  HMI gauge  │  RPI gauge  │  BPI gauge  │
│  (left panel spans full height)  │             │             │             │
│                                  │  Upper/Lower│  Upper/Lower│  Upper/Lower│
│                                  │  Sandwich   │  Sandwich   │  Sandwich   │
│                                  │  Active     │  Active     │  Active     │
└──────────────────────────────────┴─────────────┴─────────────┴─────────────┘
```

### 6.2 Top Toolbar Components

```typescript
// components/controls/DashboardToolbar.tsx
'use client';

interface ToolbarProps {
  symbol: string;
  timeframe: string;
  chartType: 'line' | 'candlestick' | 'bar';
  showTrendlines: boolean;
  onSymbolChange: (symbol: string) => void;
  onTimeframeChange: (tf: string) => void;
  onChartTypeChange: (type: 'line' | 'candlestick' | 'bar') => void;
  onToggleTrendlines: () => void;
  onToggleTheme: () => void;
}
```

**Timeframe selector behaviour:**

- Options: M5 | M15 | M30 | H1 (only these 4 are user-viewable on chart)
- Changing timeframe controls **both panels simultaneously**
- Trendlines are always calculated from all timeframes (M5, M15, M30, H1, H2, H3, H4, H6, H8, H12, D1) and filtered to Golden plots — the timeframe selector only changes which timeframe's OHLCV is displayed

**Chart type switcher:** Icon buttons (Line / Candle-Bar / OHLC / Waveform) — controls left panel only. Right ECharts panel always shows line (SSA/EMA-SSA).

**Hide/unhide trendlines toggle:** Controls left TradingView panel only. Right ECharts heatmap panel always displays trendlines.

**Light / Dark mode toggle:** Applies to entire dashboard. Both chart libraries must respond.

### 6.3 ECharts Heatmap Panel — Data Layers

The right panel top chart renders the following layers in z-order (bottom to top):

| Layer                     | z-order | Description                                          |
| ------------------------- | ------- | ---------------------------------------------------- |
| Heatmap polygon blobs     | 0       | KDE heat zones — color gradient by confluence weight |
| SSA trend line            | 1       | `ssa` column from Python pipeline                    |
| EMA-SSA signal line       | 2       | `ema_ssa` column from Python pipeline                |
| Trendlines (golden plots) | 3       | Filtered Golden S&R lines from Phase 3               |
| Fractal down markers      | 4       | MQL5 arrow code 108 — fractal lows (▼)               |
| Fractal up markers        | 5       | MQL5 arrow code 119 — fractal highs (▲)              |
| Sandwich price labels     | 6       | Upper + Lower price text, bottom-left of chart       |

**Fractal marker data source:** `horiz_high_map` (code 119 = fractal high, arrow up) and
`horiz_low_map` (code 108 = fractal low, arrow down) from the fractal trendline export file.
Rendered as ECharts `scatter` series with triangle symbols.

**Sandwich price labels:** Text graphic elements positioned bottom-left of the ECharts panel.
Show price level only (e.g. `▲ 4747.70` / `▼ 4666.96`). Color-coded to distinguish upper from
lower. Source: `upper_sandwich_price` and `lower_sandwich_price` from the unified API payload.

### 6.4 Timestamp Helpers

```typescript
// constants/time.ts
// CRITICAL: ECharts requires milliseconds. LWC requires seconds.
// All API timestamps are Unix seconds. Convert at the boundary, not inside components.
export const toEChartsMs = (unixSeconds: number): number => unixSeconds * 1000;
export const toLWCSeconds = (unixMs: number): number =>
  Math.floor(unixMs / 1000);
```

### 6.5 ECharts Heatmap Chart — Full Option

```typescript
// lib/charts/heatmapLineOption.ts
import type { EChartsOption } from 'echarts';
import { toEChartsMs } from '@/constants/time';

export interface HeatZone {
  id: string;
  intensity: 'high' | 'medium' | 'low' | string;
  color: string;
  polygon: [number, number][]; // [unix_seconds, price]
}

export interface SSADataPoint {
  timestamp: number;
  ssa: number;
  ema_ssa: number;
}
export interface FractalPoint {
  timestamp: number;
  price: number;
  type: 108 | 119;
}
export interface TrendlinePoint {
  startTime: number;
  startPrice: number;
  endTime: number;
  endPrice: number;
}
export interface SandwichPrices {
  upper: number;
  lower: number;
}

export const getHeatmapChartOption = (
  ssaData: SSADataPoint[],
  fractals: FractalPoint[],
  trendlines: TrendlinePoint[],
  heatZones: HeatZone[],
  sandwich: SandwichPrices
): EChartsOption => ({
  animation: false,
  xAxis: { type: 'time' },
  yAxis: { type: 'value', scale: true },
  dataZoom: [
    { type: 'inside', xAxisIndex: 0 },
    { type: 'slider', xAxisIndex: 0, height: 20 },
  ],
  graphic: [
    // Upper Sandwich price label — bottom-left of chart
    {
      type: 'text',
      z: 100,
      left: 8,
      bottom: 36,
      style: {
        text: `▲ ${sandwich.upper.toFixed(2)}`,
        fill: '#f59e0b', // amber — upper resistance
        fontSize: 12,
        fontWeight: 'bold',
      },
    },
    // Lower Sandwich price label
    {
      type: 'text',
      z: 100,
      left: 8,
      bottom: 16,
      style: {
        text: `▼ ${sandwich.lower.toFixed(2)}`,
        fill: '#3b82f6', // blue — lower support
        fontSize: 12,
        fontWeight: 'bold',
      },
    },
  ],
  series: [
    // Layer 0: Heatmap polygon blobs
    {
      name: 'HeatZones',
      type: 'custom',
      z: 0,
      renderItem: (_params, api) => {
        const rawPolygon = api.value(2) as [number, number][];
        const screenPoints = rawPolygon.map((c) =>
          api.coord([toEChartsMs(c[0]), c[1]])
        );
        return {
          type: 'polygon',
          shape: { points: screenPoints },
          style: api.style({ fill: api.value(3) as string, stroke: 'none' }),
        };
      },
      data: heatZones.map((z) => [0, 0, z.polygon, z.color]),
    },
    // Layer 1: SSA trend line
    {
      name: 'SSA',
      type: 'line',
      z: 1,
      symbol: 'none',
      lineStyle: { width: 2, color: '#a855f7' }, // purple
      data: ssaData.map((d) => [toEChartsMs(d.timestamp), d.ssa]),
    },
    // Layer 2: EMA-SSA signal line
    {
      name: 'EMA-SSA',
      type: 'line',
      z: 2,
      symbol: 'none',
      lineStyle: { width: 1.5, color: '#06b6d4', type: 'dashed' }, // cyan dashed
      data: ssaData.map((d) => [toEChartsMs(d.timestamp), d.ema_ssa]),
    },
    // Layer 4: Fractal down markers (MQL5 code 108 — fractal low ▼)
    {
      name: 'FractalDown',
      type: 'scatter',
      z: 4,
      symbol: 'triangle',
      symbolRotate: 180,
      symbolSize: 8,
      itemStyle: { color: '#ef4444' }, // red
      data: fractals
        .filter((f) => f.type === 108)
        .map((f) => [toEChartsMs(f.timestamp), f.price]),
    },
    // Layer 5: Fractal up markers (MQL5 code 119 — fractal high ▲)
    {
      name: 'FractalUp',
      type: 'scatter',
      z: 5,
      symbol: 'triangle',
      symbolSize: 8,
      itemStyle: { color: '#22c55e' }, // green
      data: fractals
        .filter((f) => f.type === 119)
        .map((f) => [toEChartsMs(f.timestamp), f.price]),
    },
  ],
});
```

> **Note on trendlines (golden plots) Layer 3:** Trendlines are diagonal lines spanning from
> `startTime/startPrice` to `endTime/endPrice`. Render as ECharts `markLine` within a dummy
> line series or as a `custom` series. Each trendline maps to one entry with its start/end
> coordinates converted to milliseconds via `toEChartsMs`.

### 6.6 Three Gauge Charts — HMI | RPI | BPI

All three gauges use the ECharts `gauge-simple` style confirmed by design. Same blue arc, same
needle, same 0–100 scale. Each gauge additionally shows an **Active Indication** text label
below the numeric value showing the active Sandwich trendline price.

```typescript
// lib/charts/gaugeOption.ts
import type { EChartsOption } from 'echarts';

export interface GaugeData {
  value: number; // active_hmi / active_rpi / active_bpi (0–99.9)
  indexType: string; // 'HMI' | 'RPI' | 'BPI'
  activeType: string; // e.g. 'Resistance' / 'Support Breakdown'
  sandwichPrice: number; // closest active sandwich price
  sandwichLabel: string; // 'Upper' | 'Lower'
}

export const getGaugeOption = (data: GaugeData): EChartsOption => ({
  tooltip: {
    formatter: '{a} <br/>{b} : {c}',
  },
  series: [
    {
      name: data.indexType,
      type: 'gauge',
      progress: { show: true },
      detail: {
        valueAnimation: true,
        // Show numeric value + active sandwich price below it
        formatter: (value: number) =>
          `{value|${Math.round(value)}}\n{active|${data.activeType}}\n{price|${data.sandwichLabel}: ${data.sandwichPrice.toFixed(2)}}`,
        rich: {
          value: { fontSize: 28, fontWeight: 'bold', color: '#1e40af' },
          active: { fontSize: 11, color: '#6b7280', lineHeight: 18 },
          price: { fontSize: 11, color: '#6b7280', lineHeight: 18 },
        },
        offsetCenter: [0, '60%'],
      },
      data: [
        {
          value: Math.round(data.value),
          name: data.indexType,
        },
      ],
    },
  ],
});
```

```typescript
// components/charts/echarts/EChartsGaugeChart.tsx
'use client';

import { useEffect, useRef, useMemo } from 'react';
import * as echarts from 'echarts/core';
import { GaugeChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { getGaugeOption, GaugeData } from '@/lib/charts/gaugeOption';

echarts.use([GaugeChart, TooltipComponent, CanvasRenderer]);

export function EChartsGaugeChart({ data }: { data: GaugeData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    chartRef.current = echarts.init(containerRef.current);
    const observer = new ResizeObserver(() => chartRef.current?.resize());
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  const option = useMemo(() => getGaugeOption(data), [data]);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: false });
  }, [option]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
```

### 6.7 Frontend API Call

```typescript
// app/dashboard/chart/page.tsx (Next.js Server Component)
// BACKEND_URL = NestJS Controller on Railway — never Python directly

const BACKEND_URL = process.env.BACKEND_URL;

const [heatmapRes, ohlcvRes] = await Promise.all([
  fetch(
    `${BACKEND_URL}/api/v1/heatmap/zones?symbol=${symbol}&timeframe=${timeframe}`,
    {
      next: { revalidate: 300 },
    }
  ),
  fetch(`${BACKEND_URL}/api/v1/ohlcv?symbol=${symbol}&timeframe=${timeframe}`, {
    next: { revalidate: 60 },
  }),
]);

// The heatmap response includes HMI + RPI + BPI + sandwich prices in one payload:
// {
//   active_hmi, active_hmi_type,
//   active_rpi, active_rpi_type,
//   active_bpi, active_bpi_type,
//   upper_sandwich_price, lower_sandwich_price,
//   entropy, ssa_regime,
//   data: { heat_zones: [...] }
// }
```

### 6.8 ECharts Registration (Tree-Shaken)

```typescript
// lib/echartsInit.ts — import from here, never from 'echarts' directly
import * as echarts from 'echarts/core';
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
```

---

## 7. Deployment Stack Summary

| Component                | Technology                                             | Deployment  | Notes                                           |
| ------------------------ | ------------------------------------------------------ | ----------- | ----------------------------------------------- |
| MT5 terminals            | MQL5 EAs                                               | Contabo VPS | 5–15 terminals                                  |
| Export Advisor           | MQL5 EA                                                | Contabo VPS | Reads via iCustom + CopyBuffer                  |
| BullMQ                   | NestJS 11 TypeScript                                   | Railway     | Existing job queue                              |
| NestJS Worker            | NestJS 11 TypeScript                                   | Railway     | Existing worker; dispatches Celery job to Redis |
| Redis Job Queue          | Redis                                                  | Railway     | Celery broker — async handoff to Python         |
| **Python Celery Worker** | **Python + Celery + Pandas + NumPy + SciPy + Shapely** | **Railway** | **New — blob computation**                      |
| **Redis heatmap cache**  | **Redis**                                              | **Railway** | **Key: `heatmap:zones:{symbol}:{tf}`**          |
| PostgreSQL               | PostgreSQL                                             | Railway     | OHLCV + indicator values only                   |
| NestJS Controller        | NestJS 11 TypeScript                                   | Railway     | Single API surface — reads Redis + PostgreSQL   |
| Apache ECharts           | TypeScript + Next.js 16                                | Vercel      | Right supplement panel only                     |
| TradingView LWC          | TypeScript + Next.js 16                                | Vercel      | Left primary chart                              |

---

## 8. Python Library Requirements

```txt
# requirements.txt additions for blob engine
scipy>=1.11.0           # gaussian_kde for KDE computation
shapely>=2.0.0          # MultiPoint, convex_hull, polygon geometry
scikit-learn>=1.3.0     # MinMaxScaler for time/price normalization
alphashape>=1.3.1       # Concave hull — only needed if hull_type = "alpha"
celery>=5.3.0           # Async task queue (Python equivalent of BullMQ)
redis>=5.0.0            # Redis client for cache writes and Celery broker
```

---

## 9. Core Architectural Principles

| Principle                       | Implementation                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| Python is compute-only          | Python Celery Worker never serves HTTP. All HTTP is NestJS only.                          |
| Single API surface              | Next.js frontend calls NestJS Controller only. Never calls Python directly.               |
| Redis-only for computed outputs | HMI, RPI, BPI, heatmap polygons stored in Redis. Never PostgreSQL.                        |
| Per-symbol configurability      | All KDE/blob parameters in `heatmap_blob` config block. Zero hardcoded constants.         |
| Hot-reloadable                  | Redis Pub/Sub cache invalidation applies to all config blocks.                            |
| Polygon closure guaranteed      | Python backend ensures `polygon[0] == polygon[-1]`. NestJS validates before caching.      |
| Timestamp consistency           | Python stores Unix seconds. ECharts ×1000 in `toEChartsMs()`. LWC always seconds.         |
| Blob z-ordering                 | Blobs z=0, SSA z=1, EMA-SSA z=2, trendlines z=3, fractals z=4–5, labels z=6.              |
| No SSR for chart components     | All ECharts and LWC components use `'use client'` directive.                              |
| Memory leak prevention          | ECharts `chart.dispose()` and LWC `chart.remove()` in `useEffect` cleanup.                |
| Fractal marker source clarity   | Code 108 = `horiz_low_map` (fractal low ▼). Code 119 = `horiz_high_map` (fractal high ▲). |
| Trendline toggle scope          | Hide/unhide applies to left TradingView panel only. ECharts trendlines always visible.    |
| Timeframe sync                  | M5/M15/M30/H1 selector controls both panels simultaneously.                               |
