# Architecture Design Document

## DBSCAN-seeded K-Means Fractal Cluster Analysis Pipeline

### DavinTrade Platform — Python Celery Worker Module

**Version:** 1.0  
**Date:** 2026-04-12  
**Status:** Implementation Blueprint for Claude Code

---

## 1. Executive Summary

This document defines the complete architecture for implementing a **DBSCAN-seeded K-Means clustering pipeline** within the DavinTrade platform's Python Celery Worker. The pipeline consumes fractal indicator values exported from MT5 terminals, performs density-based clustering via DBSCAN, applies a two-track noise classification (extreme levels vs. true noise), refines cluster centroids via K-Means, and writes two distinct Redis cache outputs: per-cluster zone results (centroid fair value, support price, resistance price, hull polygon points) and per-symbol extreme level rays (isolated spike fractals that represent key untested S/R levels). Both outputs are served to the NestJS Controller and rendered in the frontend chart components (Apache EChart + TradingView Lightweight Charts).

---

## 2. Rationale — Why DBSCAN First, Then K-Means

This section explains the development context and reasoning behind the two-stage algorithm design. Understanding this rationale is essential for implementing the pipeline correctly and avoiding re-introduction of the weaknesses it was designed to eliminate.

### 2.1 The Problem with Pure K-Means on Fractal Data

The original `Fractal-Cluster-Analysis-v5.mq5` MQL5 indicator uses a standalone K-Means algorithm. While functional, this approach has two fundamental weaknesses when applied to fractal price data:

**Weakness 1 — Forced-K: You must decide how many S/R zones exist before looking at the data.**

K-Means requires the user to pre-specify the number of clusters `K` before the algorithm runs. This is structurally wrong for market S/R analysis because:

- The number of meaningful S/R zones in the market changes constantly as price evolves
- If the market genuinely has 3 active S/R zones but K=4 is set, K-Means will _manufacture_ a 4th cluster by splitting one of the real zones into two artificial sub-zones
- Conversely, if K=2 but 5 real zones exist, two real zones get collapsed together and their individual S/R levels are averaged into meaningless values
- The user has no objective basis for choosing K — it is a subjective guess, not a data-driven decision

This means the S/R levels produced by pure K-Means are partly an artifact of the user's parameter choice, not purely a reflection of what price structure actually exists.

**Weakness 2 — No True Noise Rejection: Isolated fractals are forced into clusters.**

K-Means assigns _every single fractal point_ to the nearest centroid — there is no concept of "this fractal belongs to no cluster." An isolated fractal that occurred during a one-off spike, a news event, or a thin liquidity period gets force-assigned to whichever cluster centroid happens to be nearest. This pollutes the cluster with an irrelevant data point, distorts the centroid position, and can shift support/resistance levels away from the true structural price zone.

The original MQL5 indicator attempted to compensate for this with the `InpOutlierDistanceMultiplier` parameter, which manually filters out points beyond a distance threshold. However this is still subjective — the multiplier value has no principled relationship to the actual data distribution.

### 2.2 Why DBSCAN Solves Both Problems

DBSCAN (Density-Based Spatial Clustering of Applications with Noise) answers a fundamentally different question than K-Means. Instead of asking _"how do I divide these points into K groups?"_, DBSCAN asks _"which points are naturally dense enough to belong to a group, and which points are genuinely isolated?"_

**DBSCAN solves Weakness 1 — Automatic cluster count discovery:**

DBSCAN does not require `K` to be specified. It scans the entire fractal point set and identifies regions of density organically. If the market has 3 natural S/R zones, DBSCAN finds 3 clusters. If it has 6, it finds 6. The cluster count is an _output_ of the algorithm derived from the data, not an _input_ decided by the user. This makes the S/R zone count a true reflection of price structure.

**DBSCAN solves Weakness 2 — Principled noise labeling:**

Any fractal point that does not meet the minimum density threshold (controlled by `min_samples` and `eps`) is labeled as **noise** (label = -1) and permanently discarded. These noise points never enter the centroid calculation, never distort the convex hull, and never corrupt the support/resistance levels. The rejection is automatic and data-driven — no manual multiplier required.

### 2.3 Why K-Means Is Still Needed After DBSCAN

If DBSCAN already identifies the clusters, why run K-Means at all?

Because DBSCAN and K-Means have complementary strengths that make the hybrid superior to either alone:

**DBSCAN is excellent at discovery but produces irregular centroid geometry.**

DBSCAN's cluster assignments are based on density reachability, not on minimizing distance to a geometric center. The "mean" of a DBSCAN cluster can be unstable — especially when a cluster has an asymmetric shape or uneven point distribution. This makes DBSCAN centroids unsuitable as precise equilibrium price lines on a chart.

**K-Means is excellent at centroid geometry but terrible at discovery.**

K-Means minimizes within-cluster variance, which means its centroids are geometrically optimal — they represent the true mean position of their assigned points. This is exactly what is needed for a precise, stable centroid equilibrium line and for correctly anchoring the support/resistance ray computation.

**The hybrid gets the best of both:**

- DBSCAN does the hard work: discovers how many clusters exist, which points belong to each, and which points are noise
- The DBSCAN cluster means are used as pre-placed seed centroids for K-Means, bypassing K-Means' weakness of random/poor initialization
- K-Means runs a short refinement pass (1–3 iterations, not the usual 100+) on the clean, noise-free point set to produce geometrically optimal centroids
- All subsequent outputs — centroid fair value line, support ray, resistance ray, convex hull polygon — are computed from K-Means refined positions on DBSCAN-filtered data

### 2.4 Why DBSCAN Noise Must Not Be Permanently Discarded

A critical design insight that distinguishes this pipeline from a naive DBSCAN implementation: **DBSCAN noise in fractal price data is not random measurement error — it is the market's record of exceptional price extremes.**

DBSCAN labels a fractal as noise when it has fewer than `min_samples` neighbors within radius ε. In normalized price-time space, this means the fractal occurred at a price level that very few other fractals visited. From a pure machine learning perspective, that is an outlier to discard. From a trading perspective, that is often the most important fractal on the chart:

- **Single-touch reversal** — price reached that level once and reversed sharply, precisely because it was so extreme it never returned to cluster with others
- **Liquidity pool** — isolated spike highs/lows are where stop orders accumulate; institutional players actively target these levels
- **Absolute extremes** — the all-time high or low within the lookback window will almost always be DBSCAN noise by definition, having no neighbors
- **Untested levels** — a level price has only visited once carries more structural weight than levels revisited many times (which become cluster centroids instead)
- **News/event spikes** — sharp one-candle moves create isolated fractals that become magnetic price levels on the next approach

The invariant that must be preserved: **noise points discarded by DBSCAN must never re-enter the K-Means stage**, but they must be re-classified through a secondary track rather than silently dropped. This preserves the integrity of the K-Means geometry while retaining the trading significance of extreme price levels.

### 2.5 Summary: Role of Each Algorithm and the Noise Track

| Component                      | Role in Pipeline       | What It Provides                                 |
| ------------------------------ | ---------------------- | ------------------------------------------------ |
| **DBSCAN**                     | Stage 1 — Discovery    | Automatic cluster count, noise separation        |
| **Noise Secondary Classifier** | Stage 2 — Noise Triage | Extreme levels vs. true noise separation         |
| **K-Means**                    | Stage 3 — Geometry     | Optimal centroid positions, stable S/R anchoring |
| **Extreme Level Track**        | Parallel output        | Isolated spike fractals as key untested S/R rays |

---

## 3. System Context

### 3.1 Position in DavinTrade Architecture

```
MT5 Terminals (Contabo VPS)
  └── Export Advisor (MQL5 EA)
        reads fractal indicator values via iCustom / CopyBuffer
        exports: bar_index, time, price, symbol, timeframe, fractal_type
        ↓
BullMQ (NestJS Worker — TypeScript + NestJS 11 + Railway)
        ↓
PostgreSQL (Railway)
        stores fractal points: bar_index, time, price, symbol, timeframe, fractal_type
        ↓
Redis Job Queue (Celery broker — Railway)
        async job handoff
        ↓
[THIS MODULE] Python Celery Worker (Railway)
        sklearn: DBSCAN → noise secondary classification → K-Means
        ↓
        ┌─────────────────────────────────────────┐
        ▼                                         ▼
Redis Cache: clusters:{symbol}:{tf}    Redis Cache: extremes:{symbol}:{tf}
per-cluster centroid, S/R, hull        extreme level rays from noise fractals
        └─────────────────────────────────────────┘
                          ↓
        NestJS Controller (TypeScript + NestJS 11 — Railway)
        reads Redis — single API surface
                          ↓
        ┌─────────────────────────────────────────┐
        ▼                                         ▼
Apache EChart                         TradingView Lightweight Charts
(Next.js 16 + Vercel)                 (Next.js 16 + Vercel)
Polygon + Centroid overlay            Cluster S/R + Extreme Level rays
```

### 3.2 Data Boundaries

| Boundary                     | Rule                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------- |
| **Input to this module**     | Fractal points only — `bar_index, time, price, symbol, timeframe, fractal_type` |
| **OHLCV data**               | NOT required — stays in MT5/Contabo VPS, never reaches Railway                  |
| **Output persistence**       | Redis cache ONLY — no computed data stored in PostgreSQL                        |
| **Cluster output key**       | `clusters:{symbol}:{tf}` — centroid, hull polygon, cluster S/R                  |
| **Extreme level output key** | `extremes:{symbol}:{tf}` — isolated spike fractals as key S/R rays              |
| **Output consumers**         | NestJS Controller → Apache EChart + TradingView Lightweight Charts              |

---

## 4. Algorithm Design

### 4.1 Revised Pipeline Summary Diagram

```
All Fractals (raw)
  │  bar_index, time, price, symbol, timeframe, fractal_type
  │  (both HIGH and LOW fractals in single point set)
  ▼
┌─────────────────────────────────────────────────────┐
│  Stage 1: Data Preparation                          │
│  • Query PostgreSQL for symbol + timeframe          │
│  • Filter to rolling lookback window (1000 bars)    │
│  • Normalize: bar_index → norm_x, price → norm_y   │
│    both axes scaled to [0, 1]                       │
└─────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────┐
│  Stage 2: DBSCAN — Discovery & Separation           │
│  • Auto-estimate ε via k-NN distance elbow          │
│  • DBSCAN(eps=ε_auto, min_samples=MIN_PTS)          │
│  • Output: cluster labels 0..N  +  noise label -1   │
│  • Derive K = count of valid cluster labels         │
│  • Compute DBSCAN cluster means → K-Means seeds     │
└─────────────────────────────────────────────────────┘
  │                              │
  ▼                              ▼
Cluster Points              Noise Points
(label >= 0)                (label == -1)
  │                              │
  │                              ▼
  │              ┌───────────────────────────────────┐
  │              │  Stage 3: Noise Secondary          │
  │              │  Classification                    │
  │              │  • Compute z-score vs cluster      │
  │              │    price distribution              │
  │              │  • z >= 2.0 std → EXTREME LEVEL   │
  │              │  • z <  2.0 std → TRUE NOISE      │
  │              └───────────────────────────────────┘
  │                         │              │
  │                         ▼              ▼
  │                   Extreme Levels   True Noise
  │                   (preserved)      (discarded)
  │                         │
  ▼                         │
┌──────────────────────────┐│
│  Stage 4: K-Means        ││
│  Geometry Refinement     ││
│  • Seed centroids from   ││
│    DBSCAN cluster means  ││
│  • Refine in 1–3 iters   ││
│  • Clean data only —     ││
│    noise NEVER enters    ││
│    K-Means               ││
└──────────────────────────┘│
  │                         │
  ▼                         ▼
Per Cluster Output:      Per Extreme Level Output:
• cluster_id             • price (Extreme High / Low)
• centroid_price         • time
• support_price          • fractal_type (HIGH / LOW)
• resistance_price       • z_score
• hull_polygon[]         • label ("Extreme High" /
• point_count              "Extreme Low")
  │                         │
  ▼                         ▼
Redis: clusters:           Redis: extremes:
{symbol}:{tf}              {symbol}:{tf}
  │                         │
  └──────────┬──────────────┘
             ▼
     NestJS Controller
     (single API surface)
             │
     ┌───────┴───────────────┐
     ▼                       ▼
Apache EChart         TradingView Lightweight
• Cluster polygons    • Cluster S/R rays
• Centroid lines      • Extreme High/Low rays
• Extreme ray labels    (distinct color + label)
```

### 4.2 Overview: Why DBSCAN-seeded K-Means

The original `Fractal-Cluster-Analysis-v5.mq5` MQL5 indicator uses a pure K-Means approach with two structural weaknesses:

1. **Forced-K problem** — user must pre-specify cluster count `K`. If the market has 3 natural S/R zones, K=4 manufactures an artificial 4th cluster by splitting a real zone.
2. **Manual outlier multiplier** — the `InpOutlierDistanceMultiplier` parameter is a subjective threshold. Isolated fractals are force-assigned to the nearest cluster instead of being labeled noise.

The hybrid DBSCAN-seeded K-Means approach resolves both weaknesses, and critically introduces a **two-track noise handling system** that preserves the trading significance of extreme fractal levels rather than discarding them.

### 4.3 Algorithm Pipeline

```
Stage 1: Data Preparation
  ├── Query fractal points from PostgreSQL for given symbol + timeframe
  ├── Filter to rolling lookback window (configurable, default 1000 bars)
  ├── Include both fractal highs AND fractal lows in single point set
  └── Normalize to [0, 1] on both axes (bar_index → norm_x, price → norm_y)

Stage 2: DBSCAN — Discovery & Separation
  ├── Auto-estimate epsilon (ε) via k-NN distance elbow method
  ├── Run DBSCAN(eps=ε_auto, min_samples=MIN_PTS)
  ├── Extract cluster labels (0, 1, 2, ... N) and noise labels (-1)
  ├── Derive K = number of valid DBSCAN clusters found
  └── Compute DBSCAN cluster means → centroid seeds for Stage 4

Stage 3: Noise Secondary Classification
  ├── Compute cluster price distribution (mean + std dev across all cluster centroids)
  ├── For each noise point, compute z-score vs cluster price distribution
  ├── z >= STD_DEV_THRESHOLD (default 2.0) → EXTREME LEVEL (preserved)
  │     → fractal_type HIGH → Extreme Resistance candidate
  │     → fractal_type LOW  → Extreme Support candidate
  └── z <  STD_DEV_THRESHOLD → TRUE NOISE (discarded permanently)

Stage 4: K-Means — Centroid Geometry Refinement
  ├── Input: clean cluster points ONLY (noise points never enter this stage)
  ├── Initialize K centroids from DBSCAN cluster means (not random)
  ├── Run K-Means(n_clusters=K, init=dbscan_seeds, n_init=1, max_iter=10)
  ├── Convergence expected in 1–3 iterations (seeds are already well-placed)
  └── Final centroid positions used for equilibrium line placement

Stage 5: Per-Cluster Output Computation
  For each cluster k in 0..K-1:
    ├── De-normalize centroid → real price (fair value / equilibrium price)
    ├── Find highest price fractal in cluster → resistance price
    ├── Find lowest price fractal in cluster → support price
    ├── Compute convex hull of cluster points → hull polygon point array
    └── Assemble ClusterResult object

Stage 6: Extreme Level Output Computation
  For each extreme level point:
    ├── De-normalize price
    ├── Classify as "Extreme High" (fractal_type=HIGH) or "Extreme Low" (fractal_type=LOW)
    ├── Record z_score for frontend label display
    └── Assemble ExtremeLevel object

Stage 7: Redis Cache Write (two separate keys)
  ├── clusters:{symbol}:{tf}  → list of ClusterResult (JSON, TTL per timeframe)
  └── extremes:{symbol}:{tf}  → list of ExtremeLevel  (JSON, TTL per timeframe)
```

### 4.4 Epsilon Auto-Estimation

DBSCAN's ε parameter must be estimated from the data rather than hardcoded, as normalized fractal density varies by symbol and timeframe.

**Method: k-NN Distance Elbow**

```python
from sklearn.neighbors import NearestNeighbors
import numpy as np

def estimate_epsilon(X: np.ndarray, min_pts: int = 3) -> float:
    """
    Estimate optimal epsilon via k-NN distance elbow method.
    X: normalized fractal points array, shape (n, 2)
    min_pts: same value used as DBSCAN min_samples
    """
    nbrs = NearestNeighbors(n_neighbors=min_pts).fit(X)
    distances, _ = nbrs.kneighbors(X)
    k_distances = np.sort(distances[:, min_pts - 1])[::-1]

    # Detect elbow: maximum curvature point in sorted k-distances
    diffs = np.diff(k_distances)
    elbow_idx = np.argmax(np.abs(np.diff(diffs))) + 1
    epsilon = k_distances[elbow_idx]

    # Safety clamp: prevent degenerate epsilon values
    epsilon = max(epsilon, 0.01)
    epsilon = min(epsilon, 0.5)
    return float(epsilon)
```

**Fallback:** If auto-estimation produces 0 or 1 clusters, fall back to `ε = 0.05` with a logged warning. This handles edge cases where fractal density is extremely uniform.

### 4.5 Convex Hull Computation

Use `scipy.spatial.ConvexHull` for production-grade hull computation (replaces the custom Jarvis March implementation in the MQL5 original).

```python
from scipy.spatial import ConvexHull
import numpy as np

def compute_hull_polygon(cluster_points: list[dict]) -> list[dict]:
    """
    Returns hull polygon as list of {time, price} dicts in counter-clockwise order.
    Requires minimum 3 points. Returns original points if < 3.
    """
    if len(cluster_points) < 3:
        return [{"time": p["time"], "price": p["price"]} for p in cluster_points]

    coords = np.array([[p["norm_x"], p["norm_y"]] for p in cluster_points])
    hull = ConvexHull(coords)

    return [
        {"time": cluster_points[i]["time"], "price": cluster_points[i]["price"]}
        for i in hull.vertices
    ]
```

---

## 5. Data Structures

### 5.1 Input: Fractal Point (from PostgreSQL)

```typescript
// PostgreSQL table schema (existing — populated by NestJS Worker)
interface FractalPoint {
  bar_index: number; // absolute bar index
  time: Date; // bar open time (UTC)
  price: number; // fractal high or fractal low price
  symbol: string; // e.g. "XAUUSD"
  timeframe: string; // e.g. "H1", "H4", "D1"
  fractal_type: 'HIGH' | 'LOW'; // swing high or swing low
}
```

### 5.2 Internal: Normalized Fractal Point (Python)

```python
@dataclass
class NormalizedFractalPoint:
    bar_index: int
    time: datetime
    price: float
    symbol: str
    timeframe: str
    fractal_type: str       # "HIGH" or "LOW"
    norm_x: float           # bar_index normalized to [0, 1]
    norm_y: float           # price normalized to [0, 1]
```

### 5.3 Output: Cluster Result Object

```python
@dataclass
class ClusterResult:
    cluster_id: int                      # 0-indexed cluster number
    symbol: str                          # e.g. "XAUUSD"
    timeframe: str                       # e.g. "H1"
    centroid_price: float                # K-Means refined fair value / equilibrium price
    centroid_time: datetime              # temporal position of centroid
    support_price: float                 # lowest fractal price in cluster
    resistance_price: float              # highest fractal price in cluster
    support_time: datetime               # time of lowest fractal
    resistance_time: datetime            # time of highest fractal
    hull_polygon: list[HullPoint]        # convex hull vertices (time + price)
    point_count: int                     # number of fractals in this cluster
    computed_at: datetime                # UTC timestamp of computation

@dataclass
class HullPoint:
    time: datetime
    price: float
```

### 5.4 Output: Extreme Level Object

```python
@dataclass
class ExtremeLevel:
    price: float                         # de-normalized fractal price
    time: datetime                       # fractal bar time
    fractal_type: str                    # "HIGH" → Extreme Resistance / "LOW" → Extreme Support
    z_score: float                       # distance from cluster distribution in std devs
    label: str                           # "Extreme High" or "Extreme Low"
    symbol: str
    timeframe: str
    computed_at: datetime
```

### 5.5 Redis Cache Schema

**Two separate keys per symbol/timeframe pair:**

| Key                      | Contains                               | Written by             |
| ------------------------ | -------------------------------------- | ---------------------- |
| `clusters:{symbol}:{tf}` | Cluster zones — centroid, hull, S/R    | K-Means stage          |
| `extremes:{symbol}:{tf}` | Extreme level rays from noise fractals | Noise classifier stage |

**Cluster zones value (JSON):**

```json
{
  "computed_at": "2026-04-12T13:00:00Z",
  "symbol": "XAUUSD",
  "timeframe": "H1",
  "cluster_count": 3,
  "clusters": [
    {
      "cluster_id": 0,
      "centroid_price": 3318.45,
      "centroid_time": "2026-04-10T08:00:00Z",
      "support_price": 3312.1,
      "resistance_price": 3324.8,
      "support_time": "2026-04-08T14:00:00Z",
      "resistance_time": "2026-04-09T10:00:00Z",
      "hull_polygon": [
        { "time": "2026-04-08T14:00:00Z", "price": 3312.1 },
        { "time": "2026-04-09T10:00:00Z", "price": 3324.8 },
        { "time": "2026-04-10T08:00:00Z", "price": 3318.45 }
      ],
      "point_count": 12
    }
  ]
}
```

**Extreme levels value (JSON):**

```json
{
  "computed_at": "2026-04-12T13:00:00Z",
  "symbol": "XAUUSD",
  "timeframe": "H1",
  "extreme_count": 2,
  "extremes": [
    {
      "price": 3487.5,
      "time": "2026-03-15T10:00:00Z",
      "fractal_type": "HIGH",
      "z_score": 3.41,
      "label": "Extreme High"
    },
    {
      "price": 3198.2,
      "time": "2026-02-28T06:00:00Z",
      "fractal_type": "LOW",
      "z_score": 2.87,
      "label": "Extreme Low"
    }
  ]
}
```

**TTL:** 1 bar duration of the timeframe. Applied identically to both keys. Refreshed on every new bar computation.

---

## 6. Module File Structure

```
celery_worker/
├── tasks/
│   └── cluster_analysis/
│       ├── __init__.py
│       ├── task.py                    # Celery task entry point
│       ├── pipeline.py                # Main pipeline orchestrator
│       ├── dbscan_stage.py            # Stage 2: DBSCAN + epsilon estimation
│       ├── noise_classifier.py        # Stage 3: Noise secondary classification (extreme vs true noise)
│       ├── kmeans_stage.py            # Stage 4: K-Means refinement
│       ├── geometry.py                # Convex hull + de-normalization
│       ├── models.py                  # Dataclasses: NormalizedFractalPoint, ClusterResult, HullPoint, ExtremeLevel
│       └── cache.py                   # Redis serialization + write (clusters + extremes keys)
├── db/
│   └── fractal_repository.py          # PostgreSQL query for fractal points
└── config/
    └── cluster_config.py              # Configuration constants
```

---

## 7. Implementation Specifications

### 7.1 Configuration Constants (`cluster_config.py`)

```python
# Rolling lookback window (bars)
LOOKBACK_BARS = 1000

# DBSCAN parameters
DBSCAN_MIN_SAMPLES = 3          # minimum fractals to form a core point
DBSCAN_EPS_FALLBACK = 0.05      # fallback epsilon if auto-estimation fails
DBSCAN_EPS_MIN = 0.01           # safety floor for epsilon
DBSCAN_EPS_MAX = 0.50           # safety ceiling for epsilon

# Noise secondary classification
EXTREME_STD_DEV_THRESHOLD = 2.0 # z-score threshold: above → extreme level, below → true noise

# K-Means refinement parameters
KMEANS_MAX_ITER = 10            # low ceiling — seeds are pre-placed by DBSCAN
KMEANS_N_INIT = 1               # single initialization (seeded, not random)

# Minimum fractals required before running pipeline
MIN_FRACTAL_COUNT = 9           # must be >= DBSCAN_MIN_SAMPLES * 3

# Redis TTL per timeframe (seconds)
REDIS_TTL = {
    "M15": 900,
    "M30": 1800,
    "H1":  3600,
    "H4":  14400,
    "D1":  86400,
}
```

### 7.2 Celery Task Entry Point (`task.py`)

```python
from celery import shared_task
from .pipeline import run_cluster_pipeline

@shared_task(
    name="cluster_analysis.compute",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    soft_time_limit=60,
    time_limit=90
)
def compute_clusters(self, symbol: str, timeframe: str):
    """
    Celery task: triggered by Redis Job Queue on new bar event.
    Runs full DBSCAN → K-Means pipeline and writes to Redis cache.
    """
    try:
        run_cluster_pipeline(symbol=symbol, timeframe=timeframe)
    except Exception as exc:
        raise self.retry(exc=exc)
```

### 7.3 Pipeline Orchestrator (`pipeline.py`)

```python
from .dbscan_stage import run_dbscan
from .noise_classifier import classify_noise_points
from .kmeans_stage import run_kmeans_refinement
from .geometry import compute_hull_polygon
from .models import ClusterResult, ExtremeLevel
from .cache import write_clusters_to_redis, write_extremes_to_redis
from ..db.fractal_repository import fetch_fractal_points
from .cluster_config import MIN_FRACTAL_COUNT
import numpy as np
from datetime import datetime, timezone

def run_cluster_pipeline(symbol: str, timeframe: str):
    # 1. Fetch fractal points from PostgreSQL
    points = fetch_fractal_points(symbol=symbol, timeframe=timeframe)
    if len(points) < MIN_FRACTAL_COUNT:
        return  # Insufficient data — skip silently

    # 2. Normalize
    points = normalize_points(points)

    # 3. DBSCAN — discovery and separation
    labels, noise_mask, dbscan_seeds = run_dbscan(points)

    valid_labels = [l for l in set(labels) if l != -1]
    noise_points = [p for p, label in zip(points, labels) if label == -1]

    # 4. Noise secondary classification — NEVER discard all noise blindly
    #    Extreme levels (z >= threshold) are preserved as key S/R candidates
    #    True noise (z < threshold) is discarded permanently
    extreme_levels = []
    if noise_points and len(valid_labels) > 0:
        extreme_levels, _ = classify_noise_points(
            noise_points=noise_points,
            cluster_labels=valid_labels,
            dbscan_seeds=dbscan_seeds,
            symbol=symbol,
            timeframe=timeframe
        )

    # Handle all-noise edge case — still write extremes if found
    if len(valid_labels) == 0:
        if extreme_levels:
            write_extremes_to_redis(symbol=symbol, timeframe=timeframe, extremes=extreme_levels)
        return

    K = len(valid_labels)

    # 5. K-Means refinement on clean cluster points ONLY
    #    Noise points (both extreme and true noise) NEVER enter K-Means
    clean_points = [p for p, label in zip(points, labels) if label != -1]
    clean_labels = [l for l in labels if l != -1]
    refined_centroids = run_kmeans_refinement(
        clean_points, clean_labels, K, dbscan_seeds
    )

    # 6. Per-cluster output computation
    results = []
    min_price = min(p.price for p in points)
    max_price = max(p.price for p in points)
    min_bar   = min(p.bar_index for p in points)
    max_bar   = max(p.bar_index for p in points)

    for k_idx, k in enumerate(valid_labels):
        cluster_pts = [p for p, l in zip(clean_points, clean_labels) if l == k]
        if len(cluster_pts) < 2:
            continue

        centroid_norm_y = refined_centroids[k_idx][1]
        centroid_norm_x = refined_centroids[k_idx][0]
        centroid_price  = centroid_norm_y * (max_price - min_price) + min_price

        support_pt   = min(cluster_pts, key=lambda p: p.price)
        resist_pt    = max(cluster_pts, key=lambda p: p.price)
        hull_polygon = compute_hull_polygon(cluster_pts)

        results.append(ClusterResult(
            cluster_id=k_idx,
            symbol=symbol,
            timeframe=timeframe,
            centroid_price=round(centroid_price, 5),
            centroid_time=support_pt.time,
            support_price=round(support_pt.price, 5),
            resistance_price=round(resist_pt.price, 5),
            support_time=support_pt.time,
            resistance_time=resist_pt.time,
            hull_polygon=hull_polygon,
            point_count=len(cluster_pts),
            computed_at=datetime.now(timezone.utc)
        ))

    # 7. Write both outputs to Redis (two separate keys)
    write_clusters_to_redis(symbol=symbol, timeframe=timeframe, clusters=results)
    write_extremes_to_redis(symbol=symbol, timeframe=timeframe, extremes=extreme_levels)
```

### 7.4 DBSCAN Stage (`dbscan_stage.py`)

```python
from sklearn.cluster import DBSCAN
from sklearn.neighbors import NearestNeighbors
import numpy as np
from .cluster_config import (
    DBSCAN_MIN_SAMPLES, DBSCAN_EPS_MIN,
    DBSCAN_EPS_MAX, DBSCAN_EPS_FALLBACK
)

def estimate_epsilon(X: np.ndarray, min_pts: int) -> float:
    if len(X) < min_pts + 1:
        return DBSCAN_EPS_FALLBACK
    nbrs = NearestNeighbors(n_neighbors=min_pts).fit(X)
    distances, _ = nbrs.kneighbors(X)
    k_distances = np.sort(distances[:, min_pts - 1])[::-1]
    if len(k_distances) < 3:
        return DBSCAN_EPS_FALLBACK
    diffs = np.diff(k_distances)
    second_diffs = np.abs(np.diff(diffs))
    elbow_idx = np.argmax(second_diffs) + 1
    epsilon = float(k_distances[elbow_idx])
    return max(DBSCAN_EPS_MIN, min(DBSCAN_EPS_MAX, epsilon))

def run_dbscan(points: list) -> tuple[list, list, np.ndarray]:
    """
    Returns:
      labels: per-point cluster labels (-1 = noise)
      noise_mask: boolean list
      dbscan_seeds: array of shape (K, 2) — mean centroids per cluster
    """
    X = np.array([[p.norm_x, p.norm_y] for p in points])
    eps = estimate_epsilon(X, DBSCAN_MIN_SAMPLES)

    db = DBSCAN(eps=eps, min_samples=DBSCAN_MIN_SAMPLES, metric="euclidean")
    labels = db.fit_predict(X)

    noise_mask = [l == -1 for l in labels]
    unique_labels = sorted(set(labels) - {-1})

    # Compute cluster means as K-Means seeds
    seeds = []
    for k in unique_labels:
        mask = labels == k
        seeds.append(X[mask].mean(axis=0))

    dbscan_seeds = np.array(seeds) if seeds else np.empty((0, 2))
    return labels.tolist(), noise_mask, dbscan_seeds
```

### 7.5 K-Means Refinement Stage (`kmeans_stage.py`)

```python
from sklearn.cluster import KMeans
import numpy as np
from .cluster_config import KMEANS_MAX_ITER, KMEANS_N_INIT

def run_kmeans_refinement(
    clean_points: list,
    clean_labels: list,
    K: int,
    dbscan_seeds: np.ndarray
) -> np.ndarray:
    """
    Refines centroids on noise-free points using DBSCAN seeds as initialization.
    Returns refined centroid array of shape (K, 2).
    """
    if K == 0 or len(clean_points) < K:
        return dbscan_seeds

    X = np.array([[p.norm_x, p.norm_y] for p in clean_points])

    km = KMeans(
        n_clusters=K,
        init=dbscan_seeds,
        n_init=KMEANS_N_INIT,
        max_iter=KMEANS_MAX_ITER,
        random_state=42
    )
    km.fit(X)
    return km.cluster_centers_  # shape: (K, 2)
```

### 7.6 Noise Secondary Classifier (`noise_classifier.py`)

```python
import numpy as np
from datetime import datetime, timezone
from .models import ExtremeLevel, NormalizedFractalPoint
from .cluster_config import EXTREME_STD_DEV_THRESHOLD

def classify_noise_points(
    noise_points: list[NormalizedFractalPoint],
    cluster_labels: list[int],
    dbscan_seeds: np.ndarray,
    symbol: str,
    timeframe: str
) -> tuple[list[ExtremeLevel], list[NormalizedFractalPoint]]:
    """
    Separates DBSCAN noise into two tracks:
      - Extreme Levels: z_score >= EXTREME_STD_DEV_THRESHOLD → key S/R candidates
      - True Noise:     z_score <  EXTREME_STD_DEV_THRESHOLD → discarded

    Uses cluster centroid price distribution (mean + std) as the reference.
    Noise points NEVER enter K-Means regardless of classification.

    Returns:
      extreme_levels: list[ExtremeLevel] — preserved for Redis extremes key
      true_noise:     list[NormalizedFractalPoint] — discarded
    """
    if len(dbscan_seeds) == 0 or len(noise_points) == 0:
        return [], noise_points

    # Reference distribution: centroid prices from DBSCAN cluster means
    cluster_prices = dbscan_seeds[:, 1]  # norm_y column = price dimension
    cluster_mean = float(np.mean(cluster_prices))
    cluster_std  = float(np.std(cluster_prices))

    # Degenerate case: all clusters at same price (std = 0)
    if cluster_std < 1e-9:
        return [], noise_points

    extreme_levels = []
    true_noise     = []
    now = datetime.now(timezone.utc)

    for point in noise_points:
        z_score = abs(point.norm_y - cluster_mean) / cluster_std

        if z_score >= EXTREME_STD_DEV_THRESHOLD:
            label = "Extreme High" if point.fractal_type == "HIGH" else "Extreme Low"
            extreme_levels.append(ExtremeLevel(
                price=round(point.price, 5),
                time=point.time,
                fractal_type=point.fractal_type,
                z_score=round(z_score, 4),
                label=label,
                symbol=symbol,
                timeframe=timeframe,
                computed_at=now
            ))
        else:
            true_noise.append(point)

    return extreme_levels, true_noise
```

### 7.7 Redis Cache Write (`cache.py`)

```python
import json
import redis
from datetime import datetime
from .models import ClusterResult, ExtremeLevel
from .cluster_config import REDIS_TTL

redis_client = redis.Redis.from_url(REDIS_URL)  # from environment variable

def write_clusters_to_redis(symbol: str, timeframe: str, clusters: list[ClusterResult]):
    key = f"clusters:{symbol}:{timeframe}"
    ttl = REDIS_TTL.get(timeframe, 3600)
    payload = {
        "computed_at": datetime.utcnow().isoformat() + "Z",
        "symbol": symbol,
        "timeframe": timeframe,
        "cluster_count": len(clusters),
        "clusters": [_serialize_cluster(c) for c in clusters]
    }
    redis_client.setex(key, ttl, json.dumps(payload))

def write_extremes_to_redis(symbol: str, timeframe: str, extremes: list[ExtremeLevel]):
    key = f"extremes:{symbol}:{timeframe}"
    ttl = REDIS_TTL.get(timeframe, 3600)
    payload = {
        "computed_at": datetime.utcnow().isoformat() + "Z",
        "symbol": symbol,
        "timeframe": timeframe,
        "extreme_count": len(extremes),
        "extremes": [_serialize_extreme(e) for e in extremes]
    }
    redis_client.setex(key, ttl, json.dumps(payload))

def _serialize_cluster(c: ClusterResult) -> dict:
    return {
        "cluster_id": c.cluster_id,
        "centroid_price": c.centroid_price,
        "centroid_time": c.centroid_time.isoformat(),
        "support_price": c.support_price,
        "resistance_price": c.resistance_price,
        "support_time": c.support_time.isoformat(),
        "resistance_time": c.resistance_time.isoformat(),
        "hull_polygon": [
            {"time": pt.time.isoformat(), "price": pt.price}
            for pt in c.hull_polygon
        ],
        "point_count": c.point_count,
        "computed_at": c.computed_at.isoformat()
    }

def _serialize_extreme(e: ExtremeLevel) -> dict:
    return {
        "price": e.price,
        "time": e.time.isoformat(),
        "fractal_type": e.fractal_type,
        "z_score": e.z_score,
        "label": e.label,
        "computed_at": e.computed_at.isoformat()
    }
```

---

## 8. PostgreSQL Query

### 8.1 Fractal Points Table (existing schema context)

The fractal points are stored by the existing NestJS Worker pipeline. The Celery worker queries this table read-only.

```sql
-- Expected table structure (confirm against existing Prisma schema)
CREATE TABLE fractal_points (
    id           SERIAL PRIMARY KEY,
    symbol       VARCHAR(20)  NOT NULL,
    timeframe    VARCHAR(10)  NOT NULL,
    bar_index    INTEGER      NOT NULL,
    time         TIMESTAMPTZ  NOT NULL,
    price        DECIMAL(18, 5) NOT NULL,
    fractal_type VARCHAR(4)   NOT NULL,  -- 'HIGH' or 'LOW'
    created_at   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX idx_fractal_symbol_tf_time ON fractal_points(symbol, timeframe, time DESC);
```

### 8.2 Fetch Query (`fractal_repository.py`)

```python
def fetch_fractal_points(symbol: str, timeframe: str, lookback_bars: int = 1000) -> list:
    """
    Fetches the most recent N fractal points for given symbol + timeframe.
    Returns list of NormalizedFractalPoint (pre-normalization step handled in pipeline).
    """
    query = """
        SELECT bar_index, time, price, fractal_type
        FROM fractal_points
        WHERE symbol = %s AND timeframe = %s
        ORDER BY time DESC
        LIMIT %s
    """
    # Execute via psycopg2 / asyncpg connection pool
    # Return as list of dicts, pipeline converts to dataclass
```

---

## 9. NestJS Controller API Contract

The NestJS Controller reads both Redis keys and exposes them to the frontend via two endpoints under the same API surface.

### 9.1 Endpoints

```
GET /api/clusters/:symbol/:timeframe   → cluster zones (centroid, hull, S/R)
GET /api/extremes/:symbol/:timeframe   → extreme level rays from noise fractals
```

### 9.2 Cluster Zones Response Schema

```typescript
interface ClusterZonesResponse {
  computed_at: string;
  symbol: string;
  timeframe: string;
  cluster_count: number;
  clusters: ClusterZone[];
}

interface ClusterZone {
  cluster_id: number;
  centroid_price: number; // fair value / equilibrium line price
  centroid_time: string; // ISO 8601 UTC
  support_price: number; // lowest fractal in cluster
  resistance_price: number; // highest fractal in cluster
  support_time: string;
  resistance_time: string;
  hull_polygon: HullVertex[];
  point_count: number;
}

interface HullVertex {
  time: string;
  price: number;
}
```

### 9.3 Extreme Levels Response Schema

```typescript
interface ExtremeLevelsResponse {
  computed_at: string;
  symbol: string;
  timeframe: string;
  extreme_count: number;
  extremes: ExtremeLevel[];
}

interface ExtremeLevel {
  price: number; // key S/R price level
  time: string; // ISO 8601 UTC — when this extreme occurred
  fractal_type: 'HIGH' | 'LOW';
  z_score: number; // how many std devs beyond cluster distribution
  label: 'Extreme High' | 'Extreme Low';
}
```

---

## 10. Frontend Chart Rendering Guide

### 10.1 Apache EChart — Cluster Polygon Overlay

Each cluster renders as:

- **Convex hull polygon** — closed polygon connecting `hull_polygon` vertices, semi-transparent fill, solid border, color per cluster ID
- **Centroid dashed line** — horizontal line at `centroid_price`, dashed style, extends from `centroid_time` to present bar
- **Centroid star marker** — symbol marker at `(centroid_time, centroid_price)`

### 10.2 TradingView Lightweight Charts — S/R Ray Overlay

Each cluster renders as:

- **Resistance ray** — `createPriceLine({ price: resistance_price })` with cluster color, extending right
- **Support ray** — `createPriceLine({ price: support_price })` with cluster color, extending right

Each extreme level renders as:

- **Extreme High ray** — `createPriceLine({ price: extreme.price })` in distinct orange color (`#FF8C00`), labeled with `"Extreme High"` + z_score, extending right
- **Extreme Low ray** — `createPriceLine({ price: extreme.price })` in distinct orange color (`#FF8C00`), labeled with `"Extreme Low"` + z_score, extending right

Extreme level rays must be **visually distinct** from cluster S/R rays so traders can immediately differentiate between zone-derived S/R (fractal confluence) and extreme-derived S/R (isolated spike).

### 10.3 Visual Differentiation Summary

| Chart Element          | Color                            | Style                                      | Label                       |
| ---------------------- | -------------------------------- | ------------------------------------------ | --------------------------- |
| Cluster hull polygon   | Per cluster ID (6-color palette) | Semi-transparent fill + solid border       | —                           |
| Cluster centroid line  | Per cluster ID                   | Dashed horizontal ray                      | —                           |
| Cluster support ray    | Per cluster ID                   | Solid horizontal ray                       | —                           |
| Cluster resistance ray | Per cluster ID                   | Solid horizontal ray                       | —                           |
| **Extreme High ray**   | **Orange `#FF8C00`**             | **Solid horizontal ray, slightly thicker** | **"Extreme High (z=X.XX)"** |
| **Extreme Low ray**    | **Orange `#FF8C00`**             | **Solid horizontal ray, slightly thicker** | **"Extreme Low (z=X.XX)"**  |

### 10.4 Color Assignment

Assign colors per `cluster_id % 6` to match the MQL5 indicator's original 6-color palette:

```typescript
const CLUSTER_COLORS = [
  '#1E90FF', // DodgerBlue  — cluster 0
  '#32CD32', // LimeGreen   — cluster 1
  '#FF4444', // Red         — cluster 2
  '#FFD700', // Gold        — cluster 3
  '#FF00FF', // Magenta     — cluster 4
  '#00FFFF', // Aqua        — cluster 5
];

const EXTREME_LEVEL_COLOR = '#FF8C00'; // Orange — distinct from all cluster colors

const getClusterColor = (cluster_id: number) => CLUSTER_COLORS[cluster_id % 6];
```

---

## 11. Error Handling & Edge Cases

| Scenario                                            | Handling                                                                               |
| --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Fewer than `MIN_FRACTAL_COUNT` fractals             | Skip pipeline, do not write to Redis, log warning                                      |
| DBSCAN returns all noise (0 clusters)               | Run noise classifier on all points, write extremes key if any found, skip clusters key |
| DBSCAN returns only 1 cluster                       | Run K-Means with K=1, still compute hull + S/R; run noise classifier normally          |
| All fractals labeled noise, none qualify as extreme | Write empty extremes payload to Redis, log warning                                     |
| Noise classifier: cluster std dev = 0               | Skip z-score classification, treat all noise as true noise, log warning                |
| Hull computation with < 3 points                    | Return original points as polygon (no hull computed)                                   |
| Epsilon auto-estimation fails                       | Fall back to `DBSCAN_EPS_FALLBACK = 0.05`, log warning                                 |
| PostgreSQL query timeout                            | Celery task retry with exponential backoff (max 3 retries)                             |
| Redis write failure                                 | Log error, do not crash task — stale cache preferred over crash                        |
| All fractals in single cluster (0 noise)            | Valid result — empty extremes key written, single large cluster zone rendered          |

---

## 12. Python Dependencies

Add to `requirements.txt` (Celery Worker service):

```
scikit-learn>=1.4.0
scipy>=1.12.0
numpy>=1.26.0
pandas>=2.2.0          # already present for KDE/Heatmap pipeline
redis>=5.0.0           # already present
psycopg2-binary>=2.9.9 # already present
celery>=5.3.0          # already present
```

No new Railway services required — all dependencies are additive to the existing Celery Worker deployment.

---

## 13. Implementation Order for Claude Code

Implement in the following sequence to enable incremental testing at each step:

1. `models.py` — dataclasses only: `NormalizedFractalPoint`, `ClusterResult`, `HullPoint`, `ExtremeLevel`
2. `cluster_config.py` — constants only, including `EXTREME_STD_DEV_THRESHOLD`
3. `fractal_repository.py` — PostgreSQL query (mock with sample data for initial testing)
4. `dbscan_stage.py` — DBSCAN + epsilon estimation (unit testable in isolation)
5. `noise_classifier.py` — noise secondary classification: extreme levels vs true noise (unit testable in isolation)
6. `kmeans_stage.py` — K-Means refinement (unit testable in isolation)
7. `geometry.py` — convex hull computation + de-normalization utilities
8. `cache.py` — Redis serialization + write for both `clusters:` and `extremes:` keys
9. `pipeline.py` — orchestrator connecting all stages in correct order
10. `task.py` — Celery task wrapper
11. NestJS Controller — two endpoints: `/api/clusters/:symbol/:tf` and `/api/extremes/:symbol/:tf`
12. Frontend EChart component — polygon + centroid overlay
13. Frontend TradingView component — cluster S/R rays + extreme level rays (distinct orange color)

---

## 14. Reference: MQL5 Indicator Mapping

The following table maps the original `Fractal-Cluster-Analysis-v5.mq5` constructs to their Python backend equivalents, to ensure parity of computed outputs and highlight the new extreme levels capability that did not exist in the original indicator.

| MQL5 Construct                        | Python Equivalent                                                     |
| ------------------------------------- | --------------------------------------------------------------------- |
| `IsUpperFractal() / IsLowerFractal()` | Computed upstream by Export Advisor EA, stored in PostgreSQL          |
| `CustomKMeans()` — Lloyd's algorithm  | `sklearn.cluster.KMeans`                                              |
| `InpClusterCount` (forced K)          | `K = len(dbscan_valid_labels)` — data-driven, no user input           |
| `InpOutlierDistanceMultiplier`        | Replaced by DBSCAN `min_samples` + `eps` + noise secondary classifier |
| `GetConvexHull()` — Jarvis March      | `scipy.spatial.ConvexHull`                                            |
| `ExtUpperBuffer / ExtLowerBuffer`     | `fractal_type = "HIGH" / "LOW"` column in PostgreSQL                  |
| `InpLookbackBars`                     | `LOOKBACK_BARS = 1000` in `cluster_config.py`                         |
| `real_centroid_price`                 | `centroid_price` in `ClusterResult`                                   |
| Highest fractal in cluster            | `resistance_price` in `ClusterResult`                                 |
| Lowest fractal in cluster             | `support_price` in `ClusterResult`                                    |
| `ClusterHull_` chart objects          | `hull_polygon` array → EChart polygon series                          |
| `ClusterCentroid_` dashed line        | `centroid_price` → EChart markLine / TradingView priceLine            |
| `ClusterResist_` ray                  | `resistance_price` → TradingView createPriceLine (cluster color)      |
| `ClusterSupport_` ray                 | `support_price` → TradingView createPriceLine (cluster color)         |
| _(not in original — new capability)_  | `ExtremeLevel.price` → TradingView createPriceLine (orange, labeled)  |

---

_End of Architecture Design Document_  
_Version 1.1 — Updated to include noise secondary classification and extreme level S/R track_  
_Document prepared for DavinTrade Platform — Python Celery Worker Implementation_  
_To be used alongside: `Fractal-Cluster-Analysis-v5.mq5`, `python-backend-for-DBSCAN-and-KMEANS.png`, `DBSCAN-seeded_K-Means.png`_
