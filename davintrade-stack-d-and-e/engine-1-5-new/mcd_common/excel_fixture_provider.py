"""Builds a ``CycleInputs`` from a replica workbook for one slot. Test fixtures only (architecture 2.5).

The evaluators never see a workbook. This module turns one into the bundle the sensor worker
would build from PostgreSQL, and it enforces the rules evaluators must not be able to break:

* **Closed bars only** (rule 2). A bar is closed when ``open time + period <= slot``. At slot
  ``2026-09-18T20:55Z`` that keeps M5 bars up to 20:50 and M15 bars up to 20:30. The forming bar is
  left out unless a test asks for it (``include_forming_bar``, test T4).
* **Statistics at the slot** (rule 5). Never "latest available". ``stats_slot[tf]`` comes from
  ``cycle_inputs.stats_slot_for``; the strict rule (``captured_at == stats_slot[tf]``) is the
  PostgreSQL provider's and lives in the tier-4 check. **Replica tolerance (decision E1,
  2026-09-30), here and only here:** a replica workbook stamps every statistics row with its export
  slot, so a row is accepted when ``captured_at`` equals the export slot AND ``live_bar_ts`` equals
  ``stats_slot[tf]``; it is then recorded in the bundle as captured at ``stats_slot[tf]``. A row
  failing either condition is dropped, which the tier-4 check turns into STALE +
  ``NO_STATS_AT_SLOT``. The reason is written into each fixture's ``<slot>.source.md``.
* **No live-bar fields.** Statistics fields that describe the forming bar or are measured from the
  last price are dropped (``LIVE_BAR_STATISTICS_FIELDS``). Evaluators use the fit descriptors and
  take prices from the last closed bar.
* **Setting from a file** (rule 6). ``fixtures/settings_<workbook>.yaml`` names the active
  indicator per timeframe; nothing is detected from the data.
"""

from __future__ import annotations

import datetime as _dt
import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Sequence

from .cycle_inputs import (
    CANDIDATES,
    TF_SECONDS,
    TIMEFRAMES,
    CycleInputs,
    epoch_to_slot,
    is_number,
    slot_to_epoch,
    statistics_source,
    stats_slot_for,
)

DEFAULT_SYMBOL = "XAUUSD"
E1_DECISION_DATE = "2026-09-30"

# Bar columns that are storage or wall-clock provenance, not market data.
DROPPED_BAR_COLUMNS = (
    "id", "terminal_id", "createdAt", "updatedAt", "cycle_id", "collected_at", "calculated_at",
)

# Statistics fields dropped from the bundle. The first block describes the forming bar (walkthrough
# Part B2); the second is measured from the last price (``schema.prisma``: "closest level above the
# live close", distance "in POINTS"); the third is storage provenance.
LIVE_BAR_STATISTICS_FIELDS = (
    "live_bar_ts", "live_close", "baseline_value", "uoedt_value", "loedt_value",
    "dist_to_baseline", "dist_to_uoedt", "dist_to_loedt", "channel_position",
)
LAST_PRICE_STATISTICS_FIELDS = (
    "sr_nearest_resistance", "sr_nearest_support", "sr_dist_resistance_pts", "sr_dist_support_pts",
)
DROPPED_STATISTICS_FIELDS = (
    *LIVE_BAR_STATISTICS_FIELDS, *LAST_PRICE_STATISTICS_FIELDS, "id", "terminal_id", "createdAt", "cycle_id",
)

_TIME_COLUMNS_SUFFIX = ("_ts", "timestamp", "captured_at")
CHANNEL_SOURCES = frozenset(statistics_source(c) for cands in CANDIDATES.values() for c in cands)


# --------------------------------------------------------------------------- settings


@dataclass(frozen=True)
class Settings:
    """The active-indicator setting of one fixture (``fixtures/settings_<workbook>.yaml``)."""

    slot: str
    effective_from: str
    active_indicator: Mapping[str, str]
    workbook: str = ""
    note: str = ""


def settings_from_dict(data: Mapping[str, Any]) -> Settings:
    active = data.get("active_indicator")
    if not isinstance(active, Mapping):
        raise ValueError("settings: 'active_indicator' must map timeframe -> indicator")
    for tf in TIMEFRAMES:
        name = active.get(tf)
        if name not in CANDIDATES[tf]:
            raise ValueError(f"settings: {tf} indicator {name!r} is not one of {CANDIDATES[tf]}")
    slot = str(data["slot"])
    slot_to_epoch(slot)
    effective = str(data.get("effective_from", slot))
    slot_to_epoch(effective)
    return Settings(
        slot=slot,
        effective_from=effective,
        active_indicator=dict(active),
        workbook=str(data.get("workbook", "")),
        note=str(data.get("note", "")),
    )


def load_settings(path: str | Path) -> Settings:
    import yaml

    with open(path, "r", encoding="utf-8") as handle:
        return settings_from_dict(yaml.safe_load(handle))


# --------------------------------------------------------------------------- reading a workbook


@dataclass(frozen=True)
class WorkbookTables:
    """The rows of a replica workbook, as dictionaries keyed by column name."""

    path: str
    sha256: str
    bars: Mapping[str, list[dict[str, Any]]]
    statistics: list[dict[str, Any]]


def _norm_value(column: str, value: Any) -> Any:
    if isinstance(value, (_dt.datetime, _dt.date)):
        return value.isoformat()
    if isinstance(value, float) and value.is_integer() and column.endswith(_TIME_COLUMNS_SUFFIX):
        return int(value)
    return value


def _sheet_rows(sheet: Any) -> list[dict[str, Any]]:
    rows = sheet.iter_rows(values_only=True)
    header = next(rows, None)
    if header is None:
        return []
    names = [str(h) if h is not None else "" for h in header]
    out = []
    for row in rows:
        if all(v is None for v in row):
            continue
        out.append({n: _norm_value(n, v) for n, v in zip(names, row) if n})
    return out


def file_sha256(path: str | Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_workbook(path: str | Path) -> WorkbookTables:
    """Read the per-timeframe sheets (``market_data_v6_M5`` / ``_M15``) and ``indicator_statistics``.

    The combined ``market_data_v6`` sheet is not used: it is not sorted by time, and the two
    per-timeframe sheets hold exactly the same rows in ascending order.
    """
    import openpyxl

    workbook = openpyxl.load_workbook(str(path), read_only=True, data_only=True)
    try:
        bars = {tf: _sheet_rows(workbook[f"market_data_v6_{tf}"]) for tf in TIMEFRAMES}
        statistics = _sheet_rows(workbook["indicator_statistics"])
    finally:
        workbook.close()
    return WorkbookTables(path=str(path), sha256=file_sha256(path), bars=bars, statistics=statistics)


# --------------------------------------------------------------------------- report


@dataclass(frozen=True)
class StatisticsDecision:
    timeframe: str
    source: str
    captured_at: str | None
    live_bar_ts: str | None
    accepted: bool
    reason: str


@dataclass(frozen=True)
class BarCutoff:
    timeframe: str
    sheet_rows: int
    closed_bars: int
    kept_bars: int
    last_closed_bar: str | None
    forming_bar: str | None
    forming_bar_included: bool


@dataclass(frozen=True)
class ProviderReport:
    """What the provider did, for ``<slot>.source.md`` and for tests."""

    workbook_path: str
    workbook_sha256: str
    export_slot: str
    stats_slot: Mapping[str, str]
    settings: Settings
    cutoffs: tuple[BarCutoff, ...]
    decisions: tuple[StatisticsDecision, ...]
    dropped_bar_columns: tuple[str, ...]
    dropped_statistics_fields: tuple[str, ...]


# --------------------------------------------------------------------------- building the bundle


def _iso_or_none(epoch: Any) -> str | None:
    if not is_number(epoch):
        return None
    try:
        return epoch_to_slot(epoch)
    except ValueError:
        return str(epoch)


def _decide_statistics_row(
    row: Mapping[str, Any], export_slot: str, stats_slot: Mapping[str, str]
) -> StatisticsDecision:
    tf, source = row.get("timeframe"), row.get("source")
    captured, live = row.get("captured_at"), row.get("live_bar_ts")
    base = dict(timeframe=str(tf), source=str(source), captured_at=_iso_or_none(captured), live_bar_ts=_iso_or_none(live))
    export_epoch = slot_to_epoch(export_slot)
    if captured != export_epoch:
        return StatisticsDecision(
            **base, accepted=False,
            reason=f"dropped: captured_at {_iso_or_none(captured)} is not the export slot {export_slot}",
        )
    expected = stats_slot[str(tf)]
    if live != slot_to_epoch(expected):
        return StatisticsDecision(
            **base, accepted=False,
            reason=f"dropped: live_bar_ts {_iso_or_none(live)} is not stats_slot[{tf}] {expected}",
        )
    return StatisticsDecision(
        **base, accepted=True,
        reason=f"accepted: captured_at equals the export slot and live_bar_ts equals stats_slot[{tf}]; "
        f"recorded as captured at {expected}",
    )


def build_cycle_inputs_with_report(
    source: WorkbookTables | str | Path,
    settings: Settings | Mapping[str, Any] | str | Path,
    *,
    slot: str | None = None,
    columns: Sequence[str] | None = None,
    max_bars: int | Mapping[str, int] | None = None,
    include_forming_bar: bool = False,
    data_status: str = "FRESH",
    retuning: bool = False,
    channel_mode: Mapping[str, str] | None = None,
    symbol: str = DEFAULT_SYMBOL,
) -> tuple[CycleInputs, ProviderReport]:
    """Build the bundle for ``slot`` (default: the setting's slot) and report what was done.

    ``columns`` keeps only those bar columns (``timestamp`` is always kept) and ``max_bars`` only the
    newest N closed bars per timeframe (an int for both, or a mapping): a fixture then holds just
    what its MCD reads. ``include_forming_bar`` appends the still-open bar, for test T4 only.
    The workbook carries no ``indicator_configs``, so ``data_status``, ``retuning`` and
    ``channel_mode`` (default ``"dynamic"`` for every channel source) are parameters.
    """
    tables = source if isinstance(source, WorkbookTables) else read_workbook(source)
    if isinstance(settings, Settings):
        setting = settings
    elif isinstance(settings, Mapping):
        setting = settings_from_dict(settings)
    else:
        setting = load_settings(settings)
    cycle_slot = slot or setting.slot
    slot_epoch = slot_to_epoch(cycle_slot)
    stats_slot = {tf: stats_slot_for(cycle_slot, tf) for tf in TIMEFRAMES}

    keep = None if columns is None else {"timestamp", *columns}
    bars: dict[str, list[dict[str, Any]]] = {}
    cutoffs: list[BarCutoff] = []
    for tf in TIMEFRAMES:
        length = TF_SECONDS[tf]
        rows = [
            r for r in tables.bars[tf]
            if r.get("symbol", symbol) == symbol and r.get("timeframe", tf) == tf and is_number(r.get("timestamp"))
        ]
        rows.sort(key=lambda r: r["timestamp"])
        closed = [r for r in rows if r["timestamp"] + length <= slot_epoch]
        forming = [r for r in rows if r["timestamp"] <= slot_epoch < r["timestamp"] + length]
        limit = max_bars.get(tf) if isinstance(max_bars, Mapping) else max_bars
        kept = closed[-limit:] if limit else closed
        chosen = kept + (forming if include_forming_bar else [])

        def trim(row: Mapping[str, Any]) -> dict[str, Any]:
            return {
                k: v for k, v in row.items()
                if k not in DROPPED_BAR_COLUMNS and (keep is None or k in keep)
            }

        bars[tf] = [trim(r) for r in chosen]
        cutoffs.append(
            BarCutoff(
                timeframe=tf,
                sheet_rows=len(rows),
                closed_bars=len(closed),
                kept_bars=len(kept),
                last_closed_bar=_iso_or_none(closed[-1]["timestamp"]) if closed else None,
                forming_bar=_iso_or_none(forming[-1]["timestamp"]) if forming else None,
                forming_bar_included=bool(include_forming_bar and forming),
            )
        )

    statistics: dict[tuple[str, str], dict[str, Any]] = {}
    config_hash: dict[str, str] = {}
    decisions: list[StatisticsDecision] = []
    for row in tables.statistics:
        if row.get("symbol", symbol) != symbol or row.get("timeframe") not in TIMEFRAMES:
            continue
        decision = _decide_statistics_row(row, cycle_slot, stats_slot)
        decisions.append(decision)
        if not decision.accepted:
            continue
        key = (row["timeframe"], row["source"])
        if key in statistics:
            raise ValueError(f"two statistics rows accepted for {key} at slot {cycle_slot}: fixture is ambiguous")
        kept_row = {k: v for k, v in row.items() if k not in DROPPED_STATISTICS_FIELDS}
        kept_row["captured_at"] = slot_to_epoch(stats_slot[row["timeframe"]])
        statistics[key] = kept_row
        if row.get("config_hash") is not None:
            config_hash[row["source"]] = row["config_hash"]

    modes = {s: "dynamic" for (_tf, s) in statistics if s in CHANNEL_SOURCES}
    modes.update(channel_mode or {})

    inputs = CycleInputs(
        symbol=symbol,
        cycle_slot=cycle_slot,
        data_status=data_status,
        retuning=retuning,
        bars=bars,
        statistics=statistics,
        stats_slot=stats_slot,
        active_indicator=dict(setting.active_indicator),
        config_hash=config_hash,
        channel_mode=modes,
    )
    report = ProviderReport(
        workbook_path=tables.path,
        workbook_sha256=tables.sha256,
        export_slot=cycle_slot,
        stats_slot=stats_slot,
        settings=setting,
        cutoffs=tuple(cutoffs),
        decisions=tuple(decisions),
        dropped_bar_columns=DROPPED_BAR_COLUMNS,
        dropped_statistics_fields=DROPPED_STATISTICS_FIELDS,
    )
    return inputs, report


def build_cycle_inputs(source: WorkbookTables | str | Path, settings: Any, **kwargs: Any) -> CycleInputs:
    """``build_cycle_inputs_with_report`` without the report."""
    return build_cycle_inputs_with_report(source, settings, **kwargs)[0]


# --------------------------------------------------------------------------- fixture files


def slot_file_stem(slot: str) -> str:
    """``2026-09-18T20:55Z`` -> ``2026-09-18T2055Z`` (Windows forbids ':' in file names)."""
    return slot.replace(":", "")


def render_source_md(report: ProviderReport, *, base_dir: str | Path | None = None) -> str:
    """The text of ``<slot>.source.md``: workbook path and SHA-256, cut-offs, and the E1 reason."""
    path = report.workbook_path
    if base_dir is not None:
        try:
            path = Path(path).resolve().relative_to(Path(base_dir).resolve()).as_posix()
        except ValueError:
            path = Path(path).as_posix()
    else:
        path = Path(path).as_posix()
    lines = [
        f"# Fixture source: slot {report.export_slot}",
        "",
        f"- Workbook: `{path}`",
        f"- SHA-256: `{report.workbook_sha256}`",
        f"- Cycle slot (export slot): `{report.export_slot}`",
        f"- Statistics slot per timeframe: "
        + ", ".join(f"{tf} `{report.stats_slot[tf]}`" for tf in TIMEFRAMES),
        f"- Active indicator (setting, effective from `{report.settings.effective_from}`): "
        + ", ".join(f"{tf} `{report.settings.active_indicator[tf]}`" for tf in TIMEFRAMES),
        "",
        "## Closed-bar cut-off (rule 2)",
        "",
        "| Timeframe | Sheet rows | Closed bars | Kept in bundle | Last closed bar | Forming bar (excluded) |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for c in report.cutoffs:
        forming = (c.forming_bar or "none") + (" (included, test only)" if c.forming_bar_included else "")
        lines.append(
            f"| {c.timeframe} | {c.sheet_rows} | {c.closed_bars} | {c.kept_bars} | {c.last_closed_bar} | {forming} |"
        )
    lines += [
        "",
        "## Statistics rows (rule 5, decision E1)",
        "",
        f"Replica tolerance (Davin, decision E1, {E1_DECISION_DATE}; this provider only): a replica",
        "workbook stamps every statistics row with its export slot, not with the slot where the",
        "timeframe was last collected. A row is accepted when `captured_at` equals the export slot",
        "**and** `live_bar_ts` equals `stats_slot[tf]`; it is then recorded in the bundle as captured",
        "at `stats_slot[tf]`. A row failing either condition is dropped, which the tier-4 check",
        "reports as STALE with `NO_STATS_AT_SLOT`. The PostgreSQL provider has no such tolerance.",
        "",
        "| Timeframe | Source | captured_at in workbook | live_bar_ts in workbook | Decision |",
        "| --- | --- | --- | --- | --- |",
    ]
    for d in report.decisions:
        lines.append(f"| {d.timeframe} | {d.source} | {d.captured_at} | {d.live_bar_ts} | {d.reason} |")
    lines += [
        "",
        "## Dropped from the bundle",
        "",
        "- Bar columns (storage or wall-clock provenance): " + ", ".join(f"`{c}`" for c in report.dropped_bar_columns),
        "- Statistics fields (forming bar, measured from the last price, or storage): "
        + ", ".join(f"`{c}`" for c in report.dropped_statistics_fields),
        "",
    ]
    return "\n".join(lines)


def write_fixture_files(
    directory: str | Path,
    inputs: CycleInputs,
    report: ProviderReport,
    envelope: Mapping[str, Any] | None = None,
    *,
    base_dir: str | Path | None = None,
) -> list[Path]:
    """Write ``<slot>.inputs.json``, ``<slot>.source.md`` and, given one, ``<slot>.envelope.json``."""
    from .envelope import canonical_json

    folder = Path(directory)
    folder.mkdir(parents=True, exist_ok=True)
    stem = slot_file_stem(inputs.cycle_slot)
    written = []
    inputs_path = folder / f"{stem}.inputs.json"
    inputs_path.write_text(json.dumps(inputs.to_dict(), separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8", newline="\n")
    written.append(inputs_path)
    source_path = folder / f"{stem}.source.md"
    source_path.write_text(render_source_md(report, base_dir=base_dir), encoding="utf-8", newline="\n")
    written.append(source_path)
    if envelope is not None:
        envelope_path = folder / f"{stem}.envelope.json"
        envelope_path.write_text(canonical_json(envelope, pretty=True), encoding="utf-8", newline="\n")
        written.append(envelope_path)
    return written


def load_inputs(path: str | Path) -> CycleInputs:
    """Read a ``<slot>.inputs.json`` back (replay test T9 reads this, never the workbook)."""
    return CycleInputs.from_dict(json.loads(Path(path).read_text(encoding="utf-8")))
