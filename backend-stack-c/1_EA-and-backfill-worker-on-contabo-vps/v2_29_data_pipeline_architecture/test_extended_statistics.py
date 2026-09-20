"""Extended statistic block: MQL5 -> collector contract tests.

Run:  python test_extended_statistics.py

This stack has no pytest infrastructure and pytest is not installed on the VPS,
so this follows the standalone pattern the other test_*.py files here use.

What it actually guards, and why each one earned a test:

  1. ALL 8 INDICATORS EMIT THE SAME SCHEMA. This is the defect that started the
     pass: Non-Recent-B's statistic file had no [EDT CHANNEL] block at all while
     Best_Fit_A's did, and the header lines were spelled differently in every
     variant. A consumer cannot write one parser against seven shapes.

  2. THE LABELS IN THE .mq5 MATCH THE LABELS THE COLLECTOR LOOKS FOR. The
     collector matches label text literally and silently stores NULL on a miss,
     so a rename on either side is invisible until someone notices a column has
     been empty for weeks. The expected labels are read OUT OF THE .mq5 SOURCE
     rather than hard-coded here, so this cannot pass by being updated in step
     with a mistake.

  3. THE SHARED BLOCK IS BYTE-IDENTICAL ACROSS THE 7 CENTROIDS. The 2026-09-18
     build failure came from a block that looked shared and was not.

  4. THE PARSER RECOVERS WHAT WAS WRITTEN, over a file built from REAL captured
     exports, with the values independently recomputed here.
"""
import hashlib
import json
import importlib.util
import pathlib
import re
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
MQ5 = HERE / "mq5"
REPO = HERE.parents[2]
CAPTURES = REPO / "davintrade-stack-d-and-e" / "engine-1-5-new"

_spec = importlib.util.spec_from_file_location("col", HERE / "export_collector_validator_v2.py")
col = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(col)

CENTROIDS = sorted(MQ5.glob("2EDTCentroidRegression*.mq5"))
FRACTAL = MQ5 / "2EDTFractalBestFitv5_v2_29.mq5"
LINES = [MQ5 / "SingleBestResistanceLinev3_v2_29.mq5",
         MQ5 / "SingleBestSupportLinev3_v2_29.mq5"]

# The writer function differs per family because the underlying buffers do:
# the centroids are chronologically indexed and have a channel; the fractal and
# the two single lines are series-indexed, and the single lines have no channel
# and no crossings. The emitted SCHEMA must be identical regardless -- that is
# the whole point, and it is what section 1 asserts.
WRITERS = ([(p, "WriteExtendedStatistics") for p in CENTROIDS]
           + [(FRACTAL, "WriteFractalExtendedStatistics")]
           + [(p, "WriteLineExtendedStatistics") for p in LINES])

NEW_SECTIONS = ["[FIT WINDOW]", "[PRICE CONTEXT]", "[CHANNEL GEOMETRY]",
                "[RESIDUAL DIAGNOSTICS; CROSSINGS]", "[RESIDUAL DIAGNOSTICS; CLOSE PRICE]"]

failures = []


def check(cond, msg):
    print(("  PASS  " if cond else "  FAIL  ") + msg)
    if not cond:
        failures.append(msg)


def emitted_labels(path: pathlib.Path, fn_name: str):
    """(section, label) pairs a function writes, in order, read from the source."""
    src = path.read_text(encoding="utf-8")
    start = src.index(f"void {fn_name}(")
    depth, i, body_start = 0, src.index("{", start), None
    for i in range(src.index("{", start), len(src)):
        if src[i] == "{":
            depth += 1
            if body_start is None:
                body_start = i
        elif src[i] == "}":
            depth -= 1
            if depth == 0:
                break
    body = src[body_start:i]
    body = re.sub(r"//[^\n]*", "", body)

    out, section = [], None
    for m in re.finditer(r'FileWrite\(\s*fh\s*,\s*"([^"]*)"', body):
        s = m.group(1)
        if s.startswith("["):
            section = s
        elif ":" in s:
            out.append((section, s.split(":", 1)[0].strip()))
    return out


# ---------------------------------------------------------------- 1. schema
print("\n1. every indicator emits the same section set")
ref = None
for p, fn in WRITERS:
    pairs = emitted_labels(p, fn)
    if ref is None:
        ref = pairs
    check(pairs == ref, f"{p.name[:46]:<48} identical (section, label) sequence")
    secs = [s for s, _ in pairs]
    check(all(x in secs for x in NEW_SECTIONS), f"{p.name[:46]:<48} all 5 new sections present")
check(len(WRITERS) == 10, f"all 10 statistic-emitting indicators covered (got {len(WRITERS)})")

# ------------------------------------------------- 2. labels match collector
print("\n2. .mq5 labels resolve against the collector's STAT_FIELDS")
wanted = {}
for label, sect, colname, typ in col.STAT_FIELDS:
    for lb in (label if isinstance(label, tuple) else (label,)):
        wanted.setdefault((sect, lb), colname)

unmatched = []
for sect, lb in ref:
    if sect not in NEW_SECTIONS:
        continue
    hit = any((s is None or sect.startswith(s)) and l == lb for (s, l) in wanted)
    if not hit:
        unmatched.append(f"{sect} / {lb}")
check(not unmatched, f"every new label has a STAT_FIELDS rule (orphans: {unmatched})")

# STAT_EXTENDED_COLUMNS holds every column migrate_statistics_table() adds, which
# is two different populations: the 40 UNIFORM columns the 10 regression-fit
# indicators all emit, and the 10 sr_* calibration columns that come only from
# SupportAndResistantAutoCalibration's own sections. Sections 2 and 4 are about
# the uniform schema, so they must not demand that the uniform writers emit
# sr_*; section 6 covers those separately. Splitting by prefix here rather than
# keeping a second hand-maintained list, so the two cannot drift.
UNIFORM_COLS = [(c, t) for c, t in col.STAT_EXTENDED_COLUMNS if not c.startswith("sr_")]
SR_COLS = [(c, t) for c, t in col.STAT_EXTENDED_COLUMNS if c.startswith("sr_")]
check(len(UNIFORM_COLS) == 40 and len(SR_COLS) == 10,
      f"column split is 40 uniform + 10 sr_* (got {len(UNIFORM_COLS)} + {len(SR_COLS)})")

# every uniform column the collector expects is actually written by the .mq5
emitted = {(s, l) for s, l in ref}
missing_cols = []
for colname, _t in UNIFORM_COLS:
    rules = [(s, l) for (s, l), c in wanted.items() if c == colname]
    if not any(any((s is None or es.startswith(s)) and el == l for es, el in emitted)
               for s, l in rules):
        missing_cols.append(colname)
check(not missing_cols, f"every uniform column is emitted by the .mq5 (missing: {missing_cols})")

# ------------------------------------------------- 3. shared block identical
print("\n3. the shared block is byte-identical across the 7 centroids")
digests = set()
for p in CENTROIDS:
    t = p.read_text(encoding="utf-8")
    s = t.index("//| Residual diagnostics shared by both models.")
    e = t.index("void ProjectFrozenChannel(")
    digests.add(hashlib.sha256(t[s:e].encode()).hexdigest())
check(len(digests) == 1, f"one sha256 across all 7 (got {len(digests)})")


# ----------------------------------------- 4. round-trip through the parser
def load_series(path):
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    head = lines[0].split("\t")
    out = []
    for ln in lines[1:]:
        f = (ln.split("\t") + [""] * len(head))[:len(head)]
        out.append(dict(zip(head, f)))
    return out


def num(v):
    v = (v or "").strip()
    return float(v) if v else None


def build_block(rows, pfx):
    """Recompute the block the MQL5 would write, from a real export."""
    base_n = bfirst = blast = None
    base_n = 0
    hi = lo = None
    res_c, res_x = [], []
    x_first = x_last = None
    up_n = dn_n = 0
    exc_up = exc_dn = 0.0
    for i, r in enumerate(rows):
        b = num(r[f"{pfx}_Base_FL"])
        c = num(r[f"{pfx}_close"])
        if b is None or b == 0.0 or c is None or c <= 0:
            continue
        if bfirst is None:
            bfirst = i
        blast = i
        hi = c if hi is None else max(hi, c)
        lo = c if lo is None else min(lo, c)
        res_c.append(c - b)
        base_n += 1
        if r[f"{pfx}_crossing"].strip() == "1":
            xv = num(r[f"{pfx}_ssa"])
            if xv:
                res_x.append(xv - b)
                if x_first is None:
                    x_first = int(r[f"{pfx}_timestamp"])
                x_last = int(r[f"{pfx}_timestamp"])
        u, d = num(r[f"{pfx}_UOEDT"]), num(r[f"{pfx}_LOEDT"])
        if u and d:
            if c > u:
                up_n += 1
                exc_up = max(exc_up, c - u)
            if c < d:
                dn_n += 1
                exc_dn = max(exc_dn, d - c)
    span = (blast - bfirst + 1) if bfirst is not None else 0
    last = rows[-1]
    u, d, b = (num(last[f"{pfx}_UOEDT"]), num(last[f"{pfx}_LOEDT"]),
               num(last[f"{pfx}_Base_FL"]))
    c = num(last[f"{pfx}_close"])
    width = (u - d) if (u and d) else None
    pos = (c - d) / width if (c and u and d and width) else None

    def diag(e):
        if not e:
            return {}
        n = len(e)
        mean = sum(e) / n
        mae = sum(abs(x) for x in e) / n
        mx = max(abs(x) for x in e)
        out = {"mean": mean, "mae": mae, "max": mx}
        if n > 1:
            var = sum((x - mean) ** 2 for x in e) / (n - 1)
            out["sd"] = var ** 0.5
            den = sum(x * x for x in e)
            out["dw"] = (sum((e[k] - e[k - 1]) ** 2 for k in range(1, n)) / den) if den else 0.0
        return out

    da, db = diag(res_x), diag(res_c)
    L = []
    L.append("[FIT WINDOW]")
    L.append(f"Window Start TS (UTC): {rows[0][f'{pfx}_timestamp']}")
    L.append(f"Window End TS (UTC): {last[f'{pfx}_timestamp']}")
    L.append(f"Window Bars: {len(rows)}")
    L.append(f"Observation Bars: {base_n}")
    L.append(f"Visual Window Bars: {span}")
    L.append(f"Math Window Bars: 3000")
    L.append(f"Bars Available: {len(rows)}")
    L.append(f"Leftmost Bar Index: {bfirst}")
    L.append(f"Line Span Bars: {span}")
    L.append(f"Baseline Coverage (n): {base_n}")
    L.append(f"Baseline Coverage Rate: {100.0 * base_n / span:.2f}")
    L.append(f"Centroids Used: 7")
    L.append(f"Crossings In Window (n): {len(res_x)}")
    L.append(f"First Crossing TS (UTC): {x_first if x_first else ''}")
    L.append(f"Last Crossing TS (UTC): {x_last if x_last else ''}")
    L.append("")
    L.append("[PRICE CONTEXT]")
    L.append(f"Live Bar TS (UTC): {last[f'{pfx}_timestamp']}")
    L.append(f"Live Close: {c:.2f}")
    L.append(f"Baseline Value: {b:.5f}")
    L.append(f"UOEDT Value: {u:.5f}")
    L.append(f"LOEDT Value: {d:.5f}")
    L.append(f"Distance To Baseline: {c - b:.5f}")
    L.append(f"Distance To UOEDT: {u - c:.5f}")
    L.append(f"Distance To LOEDT: {c - d:.5f}")
    L.append(f"Channel Position: {pos:.4f}")
    L.append(f"Window High: {hi:.2f}")
    L.append(f"Window Low: {lo:.2f}")
    L.append(f"Window Range: {hi - lo:.5f}")
    L.append("")
    L.append("[CHANNEL GEOMETRY]")
    L.append(f"Channel Width: {width:.5f}")
    L.append(f"Channel Asymmetry: {((u - b) + (d - b)) / width:.4f}")
    L.append(f"Above UOEDT Count: {up_n}")
    L.append(f"Below LOEDT Count: {dn_n}")
    L.append(f"Max Excursion Above: {exc_up:.5f}" if up_n else "Max Excursion Above: ")
    L.append(f"Max Excursion Below: {exc_dn:.5f}" if dn_n else "Max Excursion Below: ")
    L.append("")
    for tag, dd, e in (("CROSSINGS", da, res_x), ("CLOSE PRICE", db, res_c)):
        L.append(f"[RESIDUAL DIAGNOSTICS; {tag}]")
        L.append(f"Sample (n): {len(e)}")
        L.append(f"Mean Residual: {dd['mean']:.5f}" if dd else "Mean Residual: ")
        L.append(f"MAE: {dd['mae']:.5f}" if dd else "MAE: ")
        L.append(f"Residual StdDev: {dd['sd']:.5f}" if dd.get("sd") is not None else "Residual StdDev: ")
        L.append(f"Max Abs Residual: {dd['max']:.5f}" if dd else "Max Abs Residual: ")
        L.append(f"Durbin-Watson: {dd['dw']:.4f}" if dd.get("dw") is not None else "Durbin-Watson: ")
        L.append("")
    return "\n".join(L) + "\n", {
        "window_span_bars": len(rows), "window_bars": base_n,
        "visual_window_bars": span, "bars_available": len(rows),
        "leftmost_bar_index": bfirst, "line_span_bars": span,
        "baseline_coverage_n": base_n, "centroids_used": 7,
        "crossings_in_window_n": len(res_x), "breach_above_n": up_n,
        "breach_below_n": dn_n, "resid_a_n": len(res_x), "resid_b_n": base_n,
        "math_lookback": 3000,
    }


print("\n4. round-trip through the real collector parser, on real captured data")
ts = CAPTURES / "Non-Recent-B_XAUUSD_M15.txt"
st = CAPTURES / "Non-Recent-B_XAUUSD_M15_Statistic.txt"
if not (ts.exists() and st.exists()):
    print("  SKIP  captured exports not present at", CAPTURES)
else:
    rows = load_series(ts)
    block, expect = build_block(rows, "Non_B")
    with tempfile.TemporaryDirectory() as td:
        f = pathlib.Path(td) / "Non-Recent-B_XAUUSD_M15_Statistic.txt"
        f.write_text(st.read_text(encoding="utf-8", errors="replace").rstrip() + "\n\n" + block,
                     encoding="utf-8")
        row = col.parse_statistic_file(f)

    check(row is not None, "file parses")
    nulls = [c for c, _ in UNIFORM_COLS if row.get(c) is None]
    # Max Excursion is legitimately empty when nothing breached that side.
    allowed = {c for c in nulls if c.startswith("max_excursion") and expect[
        "breach_above_n" if c.endswith("above") else "breach_below_n"] == 0}
    check(set(nulls) <= allowed,
          f"every extended column captured (unexpected NULLs: {sorted(set(nulls) - allowed)})")
    bad = {k: (row.get(k), v) for k, v in expect.items() if row.get(k) != v}
    check(not bad, f"captured values match independent recomputation (mismatches: {bad})")
    check(row["window_bars"] == expect["window_bars"],
          "window_bars now populated for a variant whose legacy label the collector never matched")
    print(f"        parsed {len(UNIFORM_COLS) - len(nulls)}/{len(UNIFORM_COLS)}"
          f" uniform columns from a real export")

# ------------------------------- 5. the single lines: NULL, never a fake zero
#
# SingleBestResistance/Support have one line, no channel and no crossings. They
# still emit all five sections, but every channel field must come back NULL.
#
# Zero would be a lie of a specific and damaging kind: for a centroid,
# "Above UOEDT Count: 0" is a MEASUREMENT -- price never left the channel. For
# a single line there is no channel to leave, so a 0 in that column would make
# a support line look like a perfectly contained channel to anything that reads
# the table without knowing which source each row came from.
print("\n5. single-line indicators report NULL for channel fields, never 0")
CHANNEL_ONLY = ["channel_width", "channel_asymmetry", "breach_above_n",
                "breach_below_n", "max_excursion_above", "max_excursion_below",
                "uoedt_value", "loedt_value", "dist_to_uoedt", "dist_to_loedt",
                "channel_position", "centroids_used", "crossings_in_window_n",
                "first_crossing_ts", "last_crossing_ts", "resid_a_n"]
LINE_POPULATED = ["window_start_ts", "window_end_ts", "bars_available",
                  "line_span_bars", "baseline_coverage_n", "baseline_coverage_rate",
                  "live_close", "baseline_value", "dist_to_baseline",
                  "window_high", "window_low", "window_range",
                  "resid_b_n", "resid_b_mae", "resid_b_dw", "regression_angle"]

line_labels = emitted_labels(LINES[0], "WriteLineExtendedStatistics")
synth = []
sect = None
for s, lb in line_labels:
    if s != sect:
        synth.append("")
        synth.append(s)
        sect = s
    # values the line indicator genuinely computes, so the round trip has
    # something to recover; everything else stays empty exactly as emitted.
    val = {"Window Start TS (UTC)": "1789646400", "Window End TS (UTC)": "1789758600",
           "Window Bars": "323", "Observation Bars": "323", "Visual Window Bars": "323",
           "Math Window Bars": "3001", "Bars Available": "3001",
           "Leftmost Bar Index": "322", "Line Span Bars": "323",
           "Baseline Coverage (n)": "323", "Baseline Coverage Rate": "100.00",
           "Live Close": "4380.93", "Baseline Value": "4387.48209",
           "Distance To Baseline": "-6.55209", "Window High": "4400.10",
           "Window Low": "4300.55", "Window Range": "99.55000",
           "Sample (n)": "323" if s.startswith("[RESIDUAL DIAGNOSTICS; CLOSE") else "",
           "Mean Residual": "0.4210" if s.startswith("[RESIDUAL DIAGNOSTICS; CLOSE") else "",
           "MAE": "23.9010" if s.startswith("[RESIDUAL DIAGNOSTICS; CLOSE") else "",
           "Residual StdDev": "30.111" if s.startswith("[RESIDUAL DIAGNOSTICS; CLOSE") else "",
           "Max Abs Residual": "91.2" if s.startswith("[RESIDUAL DIAGNOSTICS; CLOSE") else "",
           "Durbin-Watson": "0.0241" if s.startswith("[RESIDUAL DIAGNOSTICS; CLOSE") else "",
           }.get(lb, "")
    synth.append(f"{lb}: {val}")

src = CAPTURES / "Resistance_Line_XAUUSD_M5_Statistic.txt"
if not src.exists():
    print("  SKIP  captured resistance export not present")
else:
    body = src.read_text(encoding="utf-8", errors="replace").rstrip()
    body += "\nRegression Angle: 3.85\n" + "\n".join(synth) + "\n"
    with tempfile.TemporaryDirectory() as td:
        f = pathlib.Path(td) / "Resistance_Line_XAUUSD_M5_Statistic.txt"
        f.write_text(body, encoding="utf-8")
        row = col.parse_statistic_file(f)
    check(row is not None, "file parses")
    wrong = {c: row.get(c) for c in CHANNEL_ONLY if row.get(c) is not None}
    check(not wrong, f"every channel-only column is NULL, not 0 (got: {wrong})")
    empty = [c for c in LINE_POPULATED if row.get(c) is None]
    check(not empty, f"every applicable column is populated (still NULL: {empty})")
    check(row["regression_angle"] == 3.85,
          f"regression_angle now captured for this source ({row['regression_angle']})")
    got = len([c for c, _ in UNIFORM_COLS if row.get(c) is not None])
    print(f"        {got}/{len(UNIFORM_COLS)} uniform columns populated "
          f"(was 0); the rest are NULL because this source has no channel")

# ------------------------------------------ 6. sr_levels calibration capture
#
# SupportAndResistantAutoCalibration's statistic file was dropped in FULL until
# 2026-09-20: sr_levels was not in STAT_SOURCES, so none of it reached the
# database. sr_1..sr_8 were never the loss -- those already reach Postgres via
# market_data's 95 columns. The loss was the PROVENANCE: which fractal sample,
# what dispersion, what bucket width every one of those levels came from.
#
# That file is deliberately NOT reshaped into the regression-fit schema the
# other 10 share. It measures bucket calibration, not residuals against a
# fitted line, so it keeps its own sections and the collector reaches them with
# section-scoped rules instead.
print("\n6. sr_levels calibration provenance")
SR_MQ5 = MQ5 / "SupportAndResistantAutoCalibration_v2_29.mq5"
sr_src = SR_MQ5.read_text(encoding="utf-8")

# The .mq5 half of the contract. A trailing parenthetical on an ingested field
# silently voids it -- asserted against the real coercion, not assumed.
check(col._stat_value("67 (Max Cap: 3000)", "int") is None,
      "a trailing parenthetical really does coerce to None")
check("(Max Cap: %d)" not in sr_src,
      "Window Bars no longer carries that parenthetical")
for lb in ("Max Window Bars", "Timeframe (Sec)", "Window Range", "Live Close"):
    check(f'"{lb}: "' in sr_src, f"{lb} emitted")

check("sr_levels" in col.STAT_SOURCES, "sr_levels is enrolled in STAT_SOURCES")
check(len(SR_COLS) == 10, f"10 sr_* columns defined (got {len(SR_COLS)})")

sr_cap = CAPTURES / "SR_Levels_XAUUSD_M15_Statistic.txt"
if not sr_cap.exists():
    print("  SKIP  captured SR export not present")
else:
    # The four .mq5 changes applied to the REAL captured file, exactly as the
    # rebuilt binary will write them -- real text, not a hand-made fixture.
    body = sr_cap.read_text(encoding="utf-8", errors="replace")
    body = body.replace("Window Bars: 67 (Max Cap: 3000)",
                        "Window Bars: 67\nMax Window Bars: 3000\nTimeframe (Sec): 900")
    body = body.replace("Lowest Low: 4323.43",
                        "Lowest Low: 4323.43\nWindow Range: 57.81\nLive Close: 4377.99")
    with tempfile.TemporaryDirectory() as td:
        f = pathlib.Path(td) / "SR_Levels_XAUUSD_M15_Statistic.txt"
        f.write_text(body, encoding="utf-8")
        row = col.parse_statistic_file(f)

    nulls = sorted(c for c, _ in SR_COLS if row.get(c) is None)
    check(not nulls, f"all 10 captured from the real file (NULL: {nulls})")
    for k, v in [("sr_q25", 4342.18), ("sr_q75", 4365.57), ("sr_iqr", 23.39),
                 ("sr_optimal_step", 16.96), ("sr_fractals_n", 21),
                 ("sr_macro_clusters", 4), ("sr_nearest_resistance", 4378.75),
                 ("sr_nearest_support", 4365.38),
                 ("sr_dist_resistance_pts", 76), ("sr_dist_support_pts", 1260)]:
        check(row[k] == v, f"{k} = {row[k]!r}")
    check(row["window_span_bars"] == 67,
          "Window Bars lands now the parenthetical is gone")
    check(row["math_lookback"] == 3000, "'Max Window Bars' aliases onto math_lookback")
    check(row["window_high"] == 4381.24 and row["window_low"] == 4323.43,
          "'Highest High'/'Lowest Low' alias onto window_high/window_low")
    check(row["window_range"] == 57.81 and row["live_close"] == 4377.99,
          "Window Range and Live Close captured")
    check(row["model_a_r2"] is None and row["containment_rate"] is None
          and row["resid_b_dw"] is None,
          "regression-fit columns stay NULL for this source, never zero-filled")
    cfg = json.loads(row["config_params"])
    check({"Calculation Mode", "Window Mode", "Min Touches Filter",
           "Max Window Bars", "Timeframe (Sec)"} <= set(cfg),
          f"calibration config captured: {sorted(cfg)}")
    filled = len([k for k, v in row.items()
                  if v is not None and k not in ("config_params", "config_hash")])
    print(f"        {filled} columns captured; before this pass the source "
          f"was not ingested at all")

# The enum is CLOSED and the POST is BATCHED, so a source the deployed gateway
# does not know 400s the whole request and quarantines every element in it.
_contract = json.loads((HERE / "gateway_contract_indicator_statistics.schema.json")
                       .read_text(encoding="utf-8"))
_enum = _contract["properties"]["source"]["enum"]
check("sr_levels" in _enum, "sr_levels is in the gateway contract's source enum")
check(len(_enum) == 11, f"enum widened to 11 (got {len(_enum)})")
check(sorted(_enum) == sorted(col.STAT_SOURCES),
      "the contract enum and STAT_SOURCES agree exactly")

print("\n" + ("ALL PASS" if not failures else f"{len(failures)} FAILURE(S)"))
for f in failures:
    print("   -", f)
sys.exit(1 if failures else 0)
