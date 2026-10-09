#!/usr/bin/env python3
"""Differential fixture for Engine 4's structure-level twin (build step 5, part 2).

`lib/engine4/{levels,stops,room}.ts` rebuild, from stored levels, two things the
zone builder (`mcd_worker/synthesis/zones.py`) decided: a zone's INVALIDATION and
its NEXT OPPOSING LEVEL. This script makes the evidence that the twin agrees with
the builder: it runs the REAL builder on random worlds and writes the levels it
was given and the zones it made. The TypeScript test rebuilds each zone's
invalidation and opposing level from the levels alone and demands the same,
down to the level named.

The worlds are the builder's own (`world()` of `test_zones_invariants`, the ones
its invariant tests use), made harder in four ways:
  * some prices get a sub-cent part (the builder works in cents and rounds half up);
  * some levels are copied to another name or timeframe at the same price (ties);
  * the first zone of some worlds gets a level exactly $12.50 behind its reference
    price (a stop $0.50 behind it is exactly $13.00 away: the floor is kept) and of
    others exactly $12.49 behind it (one cent short: the floor takes over). That
    level is made the nearest one past the zone by removing any level between it and
    the zone, and the world records where it put it (`edge`);
  * both biases are built for every world.

Run from the repository root:
    python scripts/engine4/structure_worlds.py            write the fixture
    python scripts/engine4/structure_worlds.py --check    rebuild and compare with the stored file
Then `npx prettier --write` the fixture (the pre-commit hook does). Every price is
text; nothing is a float except the zone figures the builder itself writes as floats.
The fixture records the SHA-256 of this script and of `zones.py` and
`zone_params.yaml`, and a test fails if the first changes without a rebuild.
"""

import argparse
import hashlib
import json
import random
import sys
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
ENGINE = REPO / "davintrade-stack-d-and-e" / "engine-1-5-new"
FIXTURE = REPO / "__tests__" / "lib" / "engine4" / "fixtures" / "structure-worlds.json"
SEED = 20261010
WORLDS = 160

sys.path.insert(0, str(ENGINE))
sys.dont_write_bytecode = True

from mcd_worker.synthesis.zones import (  # noqa: E402
    Level,
    build_entry_zones,
    load_zone_params,
)
from mcd_worker.tests.test_zones_invariants import world  # noqa: E402

D = Decimal
PARAMS = load_zone_params()
# the figures of a stored zone that Engine 4 reads; the level lists behind a zone are not needed
KEEP = (
    "zone_id",
    "rank",
    "bias",
    "low",
    "high",
    "reference_price",
    "invalidation_price",
    "invalidation_basis",
    "invalidation_level",
    "stop_distance",
    "next_opposing_level",
    "runway",
    "runway_ratio",
)


def text(price: Decimal) -> str:
    return format(price, "f")


def sub_cent(rng: random.Random, levels: list[Level]) -> list[Level]:
    out = []
    for level in levels:
        if rng.random() < 0.3:
            nudge = D(rng.randint(-60, 60)) / D(10000)
            level = Level(level.name, level.tf, level.price + nudge, level.origin)
        out.append(level)
    return out


def with_ties(rng: random.Random, levels: list[Level]) -> list[Level]:
    out = list(levels)
    if rng.random() < 0.4:
        for _ in range(rng.randint(1, 2)):
            source = rng.choice(levels)
            number = rng.randint(1, 16)
            tf = rng.choice(("M5", "M15"))
            out.append(Level(f"sr_{number}", tf, source.price, "sr_levels" if number <= 8 else "sr2_levels"))
    return out


def zones_of(bias: str, levels: list[Level], p_ref: Decimal) -> list[dict]:
    zone_set = build_entry_zones(bias, levels, p_ref, PARAMS)
    return [{key: zone[key] for key in KEEP} for zone in zone_set.to_dicts()]


def edge_world(levels: list[Level], p_ref: Decimal, bias: str, behind: str):
    """The world with one level `behind` dollars behind the first zone's reference price, and a note of where it went.

    Any level between that price and the zone is taken out, so that this level is the nearest one past the zone and decides
    the invalidation. Returns ``(levels, None)`` unchanged when there is no zone to put it behind.
    """
    zone_set = build_entry_zones(bias, levels, p_ref, PARAMS)
    if not zone_set.zones:
        return levels, None
    zone = zone_set.zones[0]
    long = bias == "LONG"
    price = zone.reference_price - D(behind) if long else zone.reference_price + D(behind)
    if price <= 0:
        return levels, None
    if long:
        kept = [lv for lv in levels if not (price < lv.price < zone.low)]
    else:
        kept = [lv for lv in levels if not (zone.high < lv.price < price)]
    free = next(n for n in range(1, 17) if not any(lv.name == f"sr_{n}" and lv.tf == "M15" for lv in kept))
    added = Level(f"sr_{free}", "M15", price, "sr_levels" if free <= 8 else "sr2_levels")
    note = {"bias": bias, "reference_price": text(zone.reference_price), "behind": behind, "level_price": text(price)}
    return kept + [added], note


def build_worlds() -> list[dict]:
    rng = random.Random(SEED)
    worlds = []
    for index in range(WORLDS):
        levels, p_ref = world(rng)
        levels = sub_cent(rng, levels)
        levels = with_ties(rng, levels)
        bias = rng.choice(("LONG", "SHORT"))
        edge = None
        if index % 4 == 1:
            levels, edge = edge_world(levels, p_ref, bias, "12.50")
        elif index % 4 == 2:
            levels, edge = edge_world(levels, p_ref, bias, "12.49")
        world_record = {
            "id": "world-%03d" % index,
            "p_ref": text(p_ref),
            "levels": [[lv.name, lv.tf, text(lv.price), lv.origin] for lv in levels],
            "zones": {b: zones_of(b, levels, p_ref) for b in ("LONG", "SHORT")},
        }
        if edge is not None:
            world_record["edge"] = edge
        worlds.append(world_record)
    return worlds


def sha256_of(path: Path) -> str:
    return hashlib.sha256(path.read_bytes().replace(b"\r\n", b"\n")).hexdigest()


def build() -> dict:
    worlds = build_worlds()
    zones = sum(len(w["zones"][b]) for w in worlds for b in ("LONG", "SHORT"))
    return {
        "generator": {
            "script": "scripts/engine4/structure_worlds.py",
            "script_sha256": sha256_of(Path(__file__).resolve()),
            "builder": "davintrade-stack-d-and-e/engine-1-5-new/mcd_worker/synthesis/zones.py",
            "builder_sha256": sha256_of(ENGINE / "mcd_worker" / "synthesis" / "zones.py"),
            "zone_params_version": PARAMS.version,
            "zone_params_sha256": PARAMS.sha256,
            "seed": SEED,
            "world_count": len(worlds),
            "zone_count": zones,
        },
        "worlds": worlds,
    }


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--check", action="store_true", help="compare with the stored fixture")
    args = parser.parse_args(argv)
    fixture = build()
    if args.check:
        if not FIXTURE.exists():
            print("no fixture at %s" % FIXTURE)
            return 1
        stored = json.loads(FIXTURE.read_bytes().decode("utf-8"))
        if stored == fixture:
            print(
                "structure worlds check: the stored fixture equals a rebuild (%d worlds, %d zones)"
                % (fixture["generator"]["world_count"], fixture["generator"]["zone_count"])
            )
            return 0
        print("structure worlds check: the stored fixture DIFFERS from a rebuild; run the script and prettier")
        return 1
    FIXTURE.parent.mkdir(parents=True, exist_ok=True)
    FIXTURE.write_bytes((json.dumps(fixture, indent=2, ensure_ascii=True) + "\n").encode("utf-8"))
    print("wrote %s (%d worlds, %d zones)" % (FIXTURE, fixture["generator"]["world_count"], fixture["generator"]["zone_count"]))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
