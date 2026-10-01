"""Shared test support: real replica bundles (read once) and small synthetic bundles."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

from mcd_common import excel_fixture_provider as provider
from mcd_common.cycle_inputs import CycleInputs, stats_slot_for

KIT_DIR = Path(__file__).resolve().parents[1]
ENGINE_DIR = KIT_DIR.parent
STACK_DIR = ENGINE_DIR.parent
REPO_DIR = STACK_DIR.parent

WORKBOOKS = {
    "v1": ENGINE_DIR / "market_data_v6_replicated.xlsx",
    "v4": STACK_DIR / "market_data_v6_replicated_v4.xlsx",
}
SETTINGS = {name: KIT_DIR / "fixtures" / f"settings_{name}.yaml" for name in WORKBOOKS}
SLOTS = {"v1": "2026-09-18T20:55Z", "v4": "2026-09-28T23:15Z"}


@lru_cache(maxsize=None)
def tables(name: str) -> provider.WorkbookTables:
    return provider.read_workbook(WORKBOOKS[name])


def real_inputs(name: str, **kwargs: Any) -> CycleInputs:
    kwargs.setdefault("max_bars", 300)
    return provider.build_cycle_inputs(tables(name), SETTINGS[name], **kwargs)


def real_inputs_with_report(name: str, **kwargs: Any):
    kwargs.setdefault("max_bars", 300)
    return provider.build_cycle_inputs_with_report(tables(name), SETTINGS[name], **kwargs)


# --------------------------------------------------------------------------- synthetic bundle

SLOT = "2026-09-18T20:55Z"


def synthetic_bars(tf: str, *, last_open: int, count: int, indicator: str = "best_fit_a", extra: dict | None = None) -> list[dict]:
    """``count`` ascending bars ending at open time ``last_open`` (epoch), channel 100 wide around 4000."""
    from mcd_common.cycle_inputs import TF_SECONDS, channel_columns

    cols = channel_columns(indicator)
    step = TF_SECONDS[tf]
    bars = []
    for i in range(count):
        ts = last_open - (count - 1 - i) * step
        bar = {
            "timestamp": ts, "open": 4000.0, "high": 4010.0, "low": 3990.0, "close": 4000.0,
            cols["upper"]: 4050.0, cols["lower"]: 3950.0, cols["baseline"]: 4000.0, cols["fit"]: 4000.5,
        }
        bar.update(extra or {})
        bars.append(bar)
    return bars


def synthetic_inputs(**overrides: Any) -> CycleInputs:
    """A valid M5-only bundle for slot 20:55: 60 closed bars, ``best_fit_a`` active and populated."""
    from mcd_common.cycle_inputs import slot_to_epoch

    slot_epoch = slot_to_epoch(SLOT)
    last_closed_open = slot_epoch - 300  # 20:50
    row = {
        "timeframe": "M5", "source": "best_fit_a", "captured_at": slot_epoch,
        "containment_rate": 60.0, "channel_width": 100.0,
    }
    fields: dict[str, Any] = dict(
        symbol="XAUUSD",
        cycle_slot=SLOT,
        data_status="FRESH",
        retuning=False,
        bars={"M5": synthetic_bars("M5", last_open=last_closed_open, count=60)},
        statistics={("M5", "best_fit_a"): row},
        stats_slot={"M5": stats_slot_for(SLOT, "M5"), "M15": stats_slot_for(SLOT, "M15")},
        active_indicator={"M5": "best_fit_a"},
        config_hash={"best_fit_a": "abc123"},
        channel_mode={"best_fit_a": "dynamic"},
    )
    fields.update(overrides)
    return CycleInputs(**fields)
