"""Registry of the overlays that can be drawn on a chart panel.

Every column name below is spelled out in full, on purpose. The previous version
of this module derived them by interpolating a variant name into
``f"{variant}_uoedt"``, which is exactly how the 2026-09-03 ``best_fit`` ->
``best_fit_a`` / ``best_fit_b`` split went unnoticed: the code kept happily
generating SQL for a column that no longer existed, and the only test coverage
ran against a fixture that invented the old columns for itself.

Two shapes in ``market_data`` defeat any naming convention, so a literal map is
not merely defensive here, it is required:

  * ``fractal_edt``'s middle line is ``fractal_best_fl`` -- not ``*_base_fl``,
    which is what the seven centroid variants use.
  * ``resistance`` and ``support`` are single lines. There is no upper or lower
    band to draw.

The pipeline blueprint (SS3.1) states plainly that the exported header naming is
not uniform and must not be tidied. This registry is where that irregularity is
absorbed once, so nothing downstream has to know about it.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Optional

OverlayKind = Literal["channel", "line"]


@dataclass(frozen=True)
class OverlaySpec:
    """One drawable overlay: either a three-line channel or a single line."""

    key: str
    label: str
    kind: OverlayKind
    mid: str
    upper: Optional[str] = None
    lower: Optional[str] = None

    @property
    def columns(self) -> tuple[str, ...]:
        """The real ``market_data`` columns this overlay reads, in draw order."""
        cols: list[str] = []
        if self.upper is not None:
            cols.append(self.upper)
        cols.append(self.mid)
        if self.lower is not None:
            cols.append(self.lower)
        return tuple(cols)

    @property
    def line_roles(self) -> tuple[str, ...]:
        """Canonical role names, parallel to :attr:`columns`."""
        roles: list[str] = []
        if self.upper is not None:
            roles.append("upper")
        roles.append("mid")
        if self.lower is not None:
            roles.append("lower")
        return tuple(roles)


# The seven centroid-regression variants. Each exposes a parallel three-line
# equal-distance channel. Written out rather than generated -- see module docstring.
_CENTROIDS: tuple[OverlaySpec, ...] = (
    OverlaySpec(
        key="best_fit_a",
        label="Best Fit A",
        kind="channel",
        upper="best_fit_a_uoedt",
        mid="best_fit_a_base_fl",
        lower="best_fit_a_loedt",
    ),
    OverlaySpec(
        key="best_fit_b",
        label="Best Fit B",
        kind="channel",
        upper="best_fit_b_uoedt",
        mid="best_fit_b_base_fl",
        lower="best_fit_b_loedt",
    ),
    OverlaySpec(
        key="cherry_a",
        label="Cherry Pick A",
        kind="channel",
        upper="cherry_a_uoedt",
        mid="cherry_a_base_fl",
        lower="cherry_a_loedt",
    ),
    OverlaySpec(
        key="cherry_b",
        label="Cherry Pick B",
        kind="channel",
        upper="cherry_b_uoedt",
        mid="cherry_b_base_fl",
        lower="cherry_b_loedt",
    ),
    OverlaySpec(
        key="most_recent",
        label="Most Recent",
        kind="channel",
        upper="most_recent_uoedt",
        mid="most_recent_base_fl",
        lower="most_recent_loedt",
    ),
    OverlaySpec(
        key="non_a",
        label="Non-Recent A",
        kind="channel",
        upper="non_a_uoedt",
        mid="non_a_base_fl",
        lower="non_a_loedt",
    ),
    OverlaySpec(
        key="non_b",
        label="Non-Recent B",
        kind="channel",
        upper="non_b_uoedt",
        mid="non_b_base_fl",
        lower="non_b_loedt",
    ),
)

_OTHERS: tuple[OverlaySpec, ...] = (
    OverlaySpec(
        key="fractal_edt",
        label="Fractal EDT",
        kind="channel",
        upper="fractal_uoedt",
        # Not fractal_base_fl. The indicator exports Fractal_Best_FL.
        mid="fractal_best_fl",
        lower="fractal_loedt",
    ),
    OverlaySpec(
        key="resistance",
        label="Best Resistance",
        kind="line",
        mid="best_resistance",
    ),
    OverlaySpec(
        key="support",
        label="Best Support",
        kind="line",
        mid="best_support",
    ),
)

OVERLAYS: dict[str, OverlaySpec] = {
    spec.key: spec for spec in (*_CENTROIDS, *_OTHERS)
}

CENTROID_KEYS: tuple[str, ...] = tuple(spec.key for spec in _CENTROIDS)
OVERLAY_KEYS: tuple[str, ...] = tuple(OVERLAYS)

# D3: one centroid variant only. Every other overlay stays selectable.
DEFAULT_OVERLAY_KEYS: tuple[str, ...] = ("best_fit_a",)


def resolve(keys: object) -> tuple[OverlaySpec, ...]:
    """Turn overlay keys into specs, rejecting unknown ones loudly.

    Accepts an iterable of keys or a comma-separated string, so the CLI and
    library callers share one validation path.
    """
    if isinstance(keys, str):
        candidates = [part.strip() for part in keys.split(",") if part.strip()]
    else:
        candidates = [str(key).strip() for key in keys]  # type: ignore[union-attr]

    if not candidates:
        raise ValueError("no overlays requested")

    unknown = [key for key in candidates if key not in OVERLAYS]
    if unknown:
        raise ValueError(
            f"unknown overlay(s) {unknown}; choose from {list(OVERLAY_KEYS)}"
        )

    # Preserve caller order, drop duplicates.
    seen: set[str] = set()
    ordered: list[OverlaySpec] = []
    for key in candidates:
        if key not in seen:
            seen.add(key)
            ordered.append(OVERLAYS[key])
    return tuple(ordered)


def all_columns() -> tuple[str, ...]:
    """Every column the registry can read. Used by the schema-parity test."""
    cols: list[str] = []
    for spec in OVERLAYS.values():
        cols.extend(spec.columns)
    return tuple(cols)
