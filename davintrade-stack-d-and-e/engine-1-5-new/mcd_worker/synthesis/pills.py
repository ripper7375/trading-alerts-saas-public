"""The modal's price pills (architecture 3.6 step 6, ADR-033).

The pills are the reference prices of the zones, best first, one per zone. Fewer zones give fewer pills; no zones (stand-aside, no match, nothing on
the bias side) give none. There is no filler price and no evenly spaced ladder: the old fixed $2.50 steps are gone (3.8). The modal itself is built
in step 5 (Section 6); this is the data it reads, and the contract it must keep: a price in the modal is a price of a stored zone.

``pills`` takes zones as built (``Zone``), ``pills_from_rows`` takes them as ``entry_zones`` rows hold them (dicts), so the reader does not need the
builder. Both read the order from the rank, not from the position in the list.
"""

from __future__ import annotations

from typing import Any, Iterable, Mapping, Sequence

from .zones import Zone


def pills(zones: Sequence[Zone]) -> tuple[float, ...]:
    """The reference prices of ``zones`` in rank order."""
    return tuple(float(zone.reference_price) for zone in sorted(zones, key=lambda z: z.rank))


def pills_from_rows(rows: Iterable[Mapping[str, Any]]) -> tuple[float, ...]:
    """The reference prices of stored zone rows in rank order. A row with no usable rank or price is not a pill."""
    usable = [
        row
        for row in rows
        if isinstance(row, Mapping)
        and isinstance(row.get("rank"), int)
        and not isinstance(row.get("rank"), bool)
        and isinstance(row.get("reference_price"), (int, float))
        and not isinstance(row.get("reference_price"), bool)
    ]
    return tuple(float(row["reference_price"]) for row in sorted(usable, key=lambda r: r["rank"]))
