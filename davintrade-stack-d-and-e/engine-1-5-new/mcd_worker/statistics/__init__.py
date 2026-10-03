"""State statistics: forward outcomes of a state and their summary (build step 3, part 6; architecture section 2.8, ADR-022).

``outcomes`` measures what price did after ONE occurrence of a state, at one horizon. ``aggregate`` turns the outcomes of many
occurrences into the numbers a ``state_statistics`` row holds, and refuses to produce a number below ``MIN_SAMPLE`` outcomes.

Both are pure functions over plain values: standard library only, no file, no network, no clock, no randomness. The gateway's
writer (``state-statistics.writer.ts``) stores what they return; its reader is the only code that may hand a number to a prompt.

Run from ``davintrade-stack-d-and-e/engine-1-5-new/``, never from inside ``mcd_worker/``: this folder is named ``statistics`` and a
working directory of ``mcd_worker/`` would put it ahead of the standard library's module of that name.
"""

from .aggregate import (
    HORIZONS,
    MIN_SAMPLE,
    ROW_FIELDS,
    SampleTooSmall,
    StatisticsError,
    aggregate_outcomes,
    compute_state_statistics,
    measured_metrics,
    quantile,
)
from .outcomes import (
    BAR_SECONDS,
    BIASES,
    HORIZON_BARS,
    BarSeries,
    BarsError,
    Outcome,
    Unavailable,
    outcome_at,
)

__all__ = [
    "BAR_SECONDS",
    "BIASES",
    "HORIZONS",
    "HORIZON_BARS",
    "MIN_SAMPLE",
    "ROW_FIELDS",
    "BarSeries",
    "BarsError",
    "Outcome",
    "SampleTooSmall",
    "StatisticsError",
    "Unavailable",
    "aggregate_outcomes",
    "compute_state_statistics",
    "measured_metrics",
    "outcome_at",
    "quantile",
]
