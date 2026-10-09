#!/usr/bin/env python3
"""Independent oracle for Engine 4 sizing (build step 5, part 1).

It writes `__tests__/lib/engine4/fixtures/sizing-oracle.json`, the file the
TypeScript tests compare `lib/engine4` against, to the exact cent.

WHY IT EXISTS. The TypeScript engine does its arithmetic with fractions of two
BigInts. A test that used the same fractions to check itself would prove
nothing, so this file is a second implementation: Python's `decimal` module,
written from the specification (architecture 6.7 to 6.9 and the step 5 plan's
decisions D3, D4 and D5), sharing no code, no data structure and no formula
layout with `lib/engine4`.

HOW IT STAYS EXACT.
  * Every `Decimal` operation runs in a context with 400 digits and is checked
    afterwards: if the context says a result was rounded, the oracle stops.
    Adding and multiplying decimals never rounds at that precision; dividing
    by a power of two and five (a contract size of 100) does not either.
  * A quotient that is not a finite decimal (a lot worked out from a risk, a
    leverage used) is NEVER divided. It is kept as a numerator and a
    denominator, compared by cross-multiplication, rounded down to a lot step
    with integer division (`//` on integers held in a Decimal is exact), and
    written to the fixture as the text "numerator/denominator".
  * Display values (two decimals for money, three for leverage) are worked out
    with integer arithmetic only, half away from zero.

USAGE (from the repository root):
    python scripts/engine4/oracle.py            write the fixture
    python scripts/engine4/oracle.py --check    rebuild in memory and compare
                                                with the stored file
After writing, run `npx prettier --write` on the fixture (the pre-commit hook
does). Everything the fixture holds is text: no JSON number is ever a float.
The fixture records the SHA-256 of this file (line endings as LF), and a test
fails when the two disagree, so the oracle cannot change without a rebuild.
"""

import argparse
import hashlib
import json
import random
import sys
from decimal import (
    Context,
    Decimal,
    DivisionByZero,
    Inexact,
    InvalidOperation,
    Overflow,
    Rounded,
)
from pathlib import Path

SEED = 20261009
REPO = Path(__file__).resolve().parents[2]
FIXTURE = REPO / "__tests__" / "lib" / "engine4" / "fixtures" / "sizing-oracle.json"
GENERATED_CASES = 480

CTX = Context(
    prec=400,
    Emax=999999,
    Emin=-999999,
    traps=[InvalidOperation, DivisionByZero, Overflow],
)

ZERO = Decimal(0)
ONE = Decimal(1)
HUNDRED = Decimal(100)


# ---------------------------------------------------------------------------
# Exact decimal arithmetic: any rounding is a bug in the oracle
# ---------------------------------------------------------------------------


def _checked(operation, *args):
    CTX.clear_flags()
    result = operation(*args)
    if CTX.flags[Inexact] or CTX.flags[Rounded]:
        raise ArithmeticError("oracle arithmetic was not exact: %r" % (args,))
    return result


def dec(text):
    return _checked(CTX.create_decimal, text)


def add(a, b):
    return _checked(CTX.add, a, b)


def sub(a, b):
    return _checked(CTX.subtract, a, b)


def mul(a, b):
    return _checked(CTX.multiply, a, b)


def div_exact(a, b):
    """Division that must come out finite (by 100, by a contract size of 2^a5^b)."""
    return _checked(CTX.divide, a, b)


def floor_div(a, b):
    """floor(a / b) for positive a and b: the integer part, exact."""
    return CTX.divide_int(a, b)


def plain(x):
    return format(CTX.normalize(x), "f")


# A quotient is (numerator, denominator), denominator > 0, never reduced.


def q_text(x):
    n, d = x
    return plain(n) if d == ONE else "%s/%s" % (plain(n), plain(d))


def q_cmp(a, b):
    left, right = mul(a[0], b[1]), mul(b[0], a[1])
    return -1 if left < right else (1 if left > right else 0)


def q_display(x, places):
    """x rounded to `places` decimals, half away from zero, as text. x >= 0."""
    n, d = x
    scale = _checked(CTX.power, Decimal(10), Decimal(places))
    scaled = mul(n, scale)
    units = floor_div(add(mul(scaled, Decimal(2)), d), mul(d, Decimal(2)))
    return format(CTX.scaleb(units, -places), "f")


def q_ceil_to_hundredths(x):
    """The least multiple of 0.01 not below x (x >= 0), as a Decimal."""
    n, d = x
    scaled = mul(n, HUNDRED)
    units = floor_div(scaled, d)
    if mul(units, d) != scaled:
        units = add(units, ONE)
    return CTX.scaleb(units, -2)


def d_display(x, places):
    return q_display((x, ONE), places)


# ---------------------------------------------------------------------------
# The specification, as arithmetic on Decimals
# ---------------------------------------------------------------------------


def size(case):
    """6.7 steps 1 to 7 with the D3 spread, 6.8's causes. Returns a plain dict."""
    spec = case["spec"]
    contract = dec(spec["contract_size"])
    vmin = dec(spec["volume_min"])
    vstep = dec(spec["volume_step"])
    vmax = dec(spec["volume_max"])
    spread = mul(dec(spec["typical_spread"]), dec(spec["point"]))
    entry = dec(case["entry"])
    sld = dec(case["stop_distance"])
    equity = dec(case["equity"])
    risk_pct = dec(case["risk_pct"])
    leverage = dec(case["max_leverage"])
    commission = dec(case["commission"])
    buy = case["side"] == "BUY"

    fill = add(entry, spread) if buy else entry
    loss_oz = add(sld, spread) if buy else sld
    loss_lot = add(mul(loss_oz, contract), commission)

    lev_lot = (mul(leverage, equity), mul(fill, contract))
    risk_lot = (mul(risk_pct, equity), mul(HUNDRED, loss_lot))
    broker_lot = (vmax, ONE)
    vmin_q = (vmin, ONE)

    # the smallest of the three; on a tie the earlier of RISK, LEVERAGE wins
    tagged = [("RISK", risk_lot), ("LEVERAGE", lev_lot), ("BROKER_MAX", broker_lot)]
    limited_by, raw = tagged[0]
    for tag, candidate in tagged[1:]:
        if q_cmp(candidate, raw) < 0:
            limited_by, raw = tag, candidate

    steps = floor_div(raw[0], mul(raw[1], vstep))
    lot = mul(steps, vstep)

    causes = []
    if q_cmp(risk_lot, vmin_q) < 0:
        causes.append("RISK")
    if q_cmp(lev_lot, vmin_q) < 0:
        causes.append("LEVERAGE")

    stop_price = sub(entry, sld) if buy else add(entry, sld)
    stop_chart = stop_price if buy else sub(stop_price, spread)

    state = {
        "buy": buy,
        "contract": contract,
        "commission": commission,
        "entry": entry,
        "equity": equity,
        "spread": spread,
        "fill": fill,
        "loss_oz": loss_oz,
        "loss_lot": loss_lot,
        "vmin": vmin,
        "lot": lot,
        "status": "OK" if lot >= vmin else "UNDERFLOW",
        "causes": causes,
        "limited_by": limited_by,
        "lev_lot": lev_lot,
        "risk_lot": risk_lot,
        "raw": raw,
        "stop_price": stop_price,
        "stop_chart": stop_chart,
        "declared_risk": div_exact(mul(risk_pct, equity), HUNDRED),
        "risk_pct": risk_pct,
    }
    if state["status"] == "OK":
        actual = mul(lot, loss_lot)
        state["actual_risk"] = actual
        state["actual_risk_pct"] = (mul(actual, HUNDRED), equity)
        state["leverage_used"] = (mul(mul(lot, contract), fill), equity)
    return state


def target(state, rrr):
    """6.7 steps 8 to 10 for one RRR, with the D3 spread."""
    contract = state["contract"]
    gain_numerator = add(
        mul(mul(rrr, state["loss_oz"]), contract),
        mul(state["commission"], add(rrr, ONE)),
    )
    gain_oz = (gain_numerator, contract)
    spread = state["spread"]
    if state["buy"]:
        distance = (add(gain_numerator, mul(spread, contract)), contract)
        price = (add(mul(state["entry"], contract), distance[0]), contract)
        chart = price
    else:
        distance = gain_oz
        price = (sub(mul(state["entry"], contract), distance[0]), contract)
        chart = (sub(price[0], mul(spread, contract)), contract)
    out = {
        "rrr": plain(rrr),
        "gain_per_ounce": q_text(gain_oz),
        "target_distance": q_text(distance),
        "target_distance_2dp": q_display(distance, 2),
        "target_price": q_text(price),
        "target_price_2dp": q_display(price, 2),
        "target_chart_level": q_text(chart),
        "target_chart_level_2dp": q_display(chart, 2),
    }
    if state["status"] == "OK":
        # lot x (contract x gain per ounce - commission): gain_numerator = contract x gain
        net = mul(state["lot"], sub(gain_numerator, state["commission"]))
        out["net_profit"] = plain(net)
        out["net_profit_2dp"] = d_display(net, 2)
    else:
        out["net_profit"] = None
        out["net_profit_2dp"] = None
    return out


def scenario_set(state, profile_rrr, counter_trend):
    low, high, cap, notch = dec("1.5"), dec("3.5"), dec("2.5"), dec("0.25")
    capped = counter_trend and profile_rrr > cap
    normal = cap if capped else profile_rrr
    chosen, left_out = [], []
    for name, rrr in (
        ("CONSERVATIVE", sub(normal, notch)),
        ("NORMAL", normal),
        ("AGGRESSIVE", add(normal, notch)),
    ):
        if rrr < low:
            left_out.append({"name": name, "rrr": plain(rrr), "reason": "BELOW_MIN_RRR"})
        elif counter_trend and rrr > cap:
            left_out.append(
                {"name": name, "rrr": plain(rrr), "reason": "ABOVE_COUNTER_TREND_CAP"}
            )
        elif rrr > high:
            left_out.append({"name": name, "rrr": plain(rrr), "reason": "ABOVE_MAX_RRR"})
        else:
            entry = target(state, rrr)
            entry["name"] = name
            chosen.append(entry)
    return {
        "normal_rrr": plain(normal),
        "normal_capped": capped,
        "scenarios": chosen,
        "omitted": left_out,
    }


def underflow(case, state):
    """6.8 and D4: the offers and the facts for a lot below the broker minimum."""
    max_risk = dec(case["max_risk_pct"])
    min_sld = dec(case["min_sld"])
    equity = state["equity"]
    vmin = state["vmin"]
    by_risk = "RISK" in state["causes"]
    by_leverage = "LEVERAGE" in state["causes"]
    min_lot_loss = mul(vmin, state["loss_lot"])
    min_lot_risk_pct = (mul(min_lot_loss, HUNDRED), equity)

    options = []
    if by_risk and not by_leverage:
        needed = q_ceil_to_hundredths(min_lot_risk_pct)
        if needed <= max_risk:
            again = size(dict(case, risk_pct=plain(needed)))
            if again["status"] == "OK":
                options.append(
                    {
                        "kind": "RAISE_RISK",
                        "risk_pct": plain(needed),
                        "risk_pct_exact": q_text(min_lot_risk_pct),
                        "lot": plain(again["lot"]),
                        "actual_risk": plain(again["actual_risk"]),
                    }
                )
        distances = sorted({dec(text) for text in case["structural_stops"]})
        for distance in distances:
            if distance < min_sld or distance >= dec(case["stop_distance"]):
                continue
            nearer = size(dict(case, stop_distance=plain(distance)))
            if nearer["status"] == "OK":
                options.append(
                    {
                        "kind": "NEARER_STRUCTURAL_STOP",
                        "stop_distance": plain(distance),
                        "lot": plain(nearer["lot"]),
                        "actual_risk": plain(nearer["actual_risk"]),
                        "actual_risk_pct": q_text(nearer["actual_risk_pct"]),
                    }
                )
    options.append({"kind": "DECLINE"})

    facts = []
    if by_risk:
        facts.append(
            {
                "kind": "EQUITY_NEEDED_FOR_RISK",
                "equity": q_text((mul(min_lot_loss, HUNDRED), state["risk_pct"])),
                "at_risk_pct": plain(state["risk_pct"]),
            }
        )
    if by_leverage:
        leverage = dec(case["max_leverage"])
        facts.append(
            {
                "kind": "EQUITY_NEEDED_FOR_LEVERAGE",
                "equity": q_text(
                    (mul(mul(vmin, state["fill"]), state["contract"]), leverage)
                ),
                "at_max_leverage": plain(leverage),
            }
        )
    return {
        "causes": state["causes"],
        "min_lot_loss": plain(min_lot_loss),
        "min_lot_risk_pct": q_text(min_lot_risk_pct),
        "options": options,
        "facts": facts,
    }


def solve(case):
    state = size(case)
    sizing = {
        "status": state["status"],
        "causes": state["causes"],
        "limited_by": state["limited_by"],
        "fill_price": plain(state["fill"]),
        "spread_price": plain(state["spread"]),
        "loss_per_ounce": plain(state["loss_oz"]),
        "loss_per_lot": plain(state["loss_lot"]),
        "max_lot_by_leverage": q_text(state["lev_lot"]),
        "lot_at_stop": q_text(state["risk_lot"]),
        "raw_lot": q_text(state["raw"]),
        "declared_risk": plain(state["declared_risk"]),
        "declared_risk_2dp": d_display(state["declared_risk"], 2),
        "stop_price": plain(state["stop_price"]),
        "stop_price_2dp": d_display(state["stop_price"], 2),
        "stop_chart_level": plain(state["stop_chart"]),
        "stop_chart_level_2dp": d_display(state["stop_chart"], 2),
    }
    if state["status"] == "OK":
        sizing.update(
            {
                "lot": plain(state["lot"]),
                "actual_risk": plain(state["actual_risk"]),
                "actual_risk_2dp": d_display(state["actual_risk"], 2),
                "actual_risk_pct": q_text(state["actual_risk_pct"]),
                "actual_risk_pct_2dp": q_display(state["actual_risk_pct"], 2),
                "leverage_used": q_text(state["leverage_used"]),
                "leverage_used_3dp": q_display(state["leverage_used"], 3),
            }
        )
    else:
        sizing["lot"] = None
    profile_rrr = dec(case["target_rrr"])
    out = {
        "id": case["id"],
        "kind": case["kind"],
        "note": case.get("note", ""),
        "input": {
            key: case[key]
            for key in (
                "side",
                "entry",
                "stop_distance",
                "equity",
                "risk_pct",
                "max_leverage",
                "commission",
                "spec",
                "target_rrr",
                "max_risk_pct",
                "min_sld",
                "structural_stops",
            )
        },
        "sizing": sizing,
        "with_trend": scenario_set(state, profile_rrr, False),
        "counter_trend": scenario_set(state, profile_rrr, True),
        "underflow": underflow(case, state) if state["status"] == "UNDERFLOW" else None,
    }
    return out


# ---------------------------------------------------------------------------
# The cases
# ---------------------------------------------------------------------------

GOLD = {
    "contract_size": "100",
    "volume_min": "0.01",
    "volume_step": "0.01",
    "volume_max": "100",
    "typical_spread": "0",
    "point": "0.01",
}


def spec_with(**changes):
    return dict(GOLD, **changes)


def make_case(case_id, kind, note="", **fields):
    case = {
        "id": case_id,
        "kind": kind,
        "note": note,
        "side": "BUY",
        "entry": "2545.00",
        "stop_distance": "15.00",
        "equity": "10000",
        "risk_pct": "1.00",
        "max_leverage": "5",
        "commission": "4",
        "spec": dict(GOLD),
        "target_rrr": "1.75",
        "max_risk_pct": "2",
        "min_sld": "13",
        "structural_stops": [],
    }
    case.update(fields)
    return case


def special_cases():
    d = []
    # -- architecture 6.7's corrected worked example ---------------------------
    d.append(make_case("doc-6.7-buy", "doc", "6.7 worked example (file G inputs, corrected), BUY"))
    d.append(make_case("doc-6.7-sell", "doc", "the same inputs as a SELL", side="SELL"))
    d.append(
        make_case(
            "doc-6.7-default-leverage",
            "doc",
            "6.7's own note: at the default 1:1.5 the leverage cap clamps this example to 0.05 lot",
            max_leverage="1.5",
        )
    )
    d.append(
        make_case(
            "doc-6.7-spread",
            "doc",
            "6.7 example with a typical spread of 25 points (0.25) for a BUY",
            spec=spec_with(typical_spread="25"),
        )
    )
    d.append(
        make_case(
            "doc-6.7-spread-sell",
            "doc",
            "the same with a SELL: the spread moves the trigger levels, not the risk",
            side="SELL",
            spec=spec_with(typical_spread="25"),
        )
    )
    # -- 6.8 (file G's underflow case) and its leverage twin (D4) ----------------
    d.append(
        make_case(
            "doc-6.8-risk-underflow",
            "doc",
            "6.8: $500, 0.50% risk, $15 stop, $4 commission; needs 3.008% (> Max RPT 2%), $3,008 of equity. "
            "Entry 1800 so the 1:5 ceiling does not also block a minimum lot",
            entry="1800.00",
            equity="500",
            risk_pct="0.50",
        )
    )
    d.append(
        make_case(
            "doc-6.8-at-2545",
            "doc",
            "6.8 at gold 2,545: a minimum lot also breaks the 1:5 ceiling, so both causes",
            equity="500",
            risk_pct="0.50",
        )
    )
    d.append(
        make_case(
            "d4-leverage-underflow",
            "doc",
            "D4: default profile, equity $2,800 at 4367.20: risk would allow 0.025 lot, 1:1.5 allows 0.0096",
            entry="4367.20",
            stop_distance="16.78",
            equity="2800",
            risk_pct="1.50",
            max_leverage="1.5",
        )
    )
    d.append(
        make_case(
            "f6-default-profile-18-sep",
            "doc",
            "plan F6: default profile at the 18 Sep price, the leverage limit sets a 0.01 lot",
            entry="4367.20",
            stop_distance="16.78",
            equity="5000",
            risk_pct="1.50",
            max_leverage="1.5",
            target_rrr="1.75",
        )
    )
    d.append(
        make_case(
            "f6-default-at-ceiling",
            "doc",
            "plan F6: the same at the 1:5 ceiling",
            entry="4367.20",
            stop_distance="16.78",
            equity="5000",
            risk_pct="1.50",
            max_leverage="5",
        )
    )
    d.append(
        make_case(
            "f6-m15-uoedt-underflow",
            "doc",
            "plan F6: the 18 Sep M15 UOEDT stop ($88.24) sizes to nothing; the risk can be raised, nearer stops exist",
            entry="4367.20",
            stop_distance="88.24",
            equity="5000",
            risk_pct="1.50",
            max_leverage="1.5",
            structural_stops=["16.78", "17.54", "33.14", "88.24", "153.53", "241.46"],
            min_sld="13",
        )
    )
    # -- limits and ties ---------------------------------------------------------
    d.append(
        make_case(
            "tie-risk-equals-leverage",
            "special",
            "risk lot and leverage lot are both exactly 0.05: RISK is reported",
            entry="2000.00",
            stop_distance="20.00",
            equity="10000",
            risk_pct="1.00",
            max_leverage="1",
            commission="0",
        )
    )
    d.append(
        make_case(
            "broker-max-binds",
            "special",
            "a large account against a small broker maximum",
            equity="5000000",
            spec=spec_with(volume_max="2"),
        )
    )
    d.append(
        make_case(
            "zero-commission",
            "special",
            "no commission",
            commission="0",
        )
    )
    d.append(
        make_case(
            "exact-step-multiple",
            "special",
            "the raw lot is exactly a multiple of the step: it is kept, not stepped down",
            entry="2000.00",
            stop_distance="25.00",
            equity="5000",
            risk_pct="1.00",
            commission="0",
        )
    )
    # -- broker figures that change the lot with no code change (6.14 item 7) ---
    for name, spec in (
        ("contract-100", spec_with()),
        ("contract-10", spec_with(contract_size="10")),
        ("contract-1000", spec_with(contract_size="1000", point="0.001")),
        ("step-0.05", spec_with(volume_min="0.05", volume_step="0.05")),
        ("step-0.1", spec_with(volume_min="0.1", volume_step="0.1")),
        ("step-1", spec_with(volume_min="1", volume_step="1", volume_max="500")),
    ):
        d.append(
            make_case(
                "spec-change-" + name,
                "spec-change",
                "the 6.7 example with another broker row",
                spec=spec,
            )
        )
    # -- scenarios at the edges of the RRR range and the counter-trend cap ------
    for rrr in ("1.5", "1.6", "2.25", "2.5", "2.6", "3", "3.25", "3.4", "3.5"):
        d.append(
            make_case(
                "rrr-" + rrr,
                "scenario-edge",
                "target RRR %s with and without the counter-trend cap" % rrr,
                target_rrr=rrr,
            )
        )
    return d


def money(units, places):
    scale = 10**places
    return "%d.%0*d" % (units // scale, places, units % scale)


def generated_cases(rng):
    # (contract, volume min, step, max, spread in points, point)
    specs = [
        ("100", "0.01", "0.01", "100", ["0", "8", "25", "40", "120"], "0.01"),
        ("100", "0.01", "0.01", "50", ["15"], "0.01"),
        ("100", "0.10", "0.10", "100", ["20"], "0.01"),
        ("100", "0.05", "0.05", "30", ["10"], "0.01"),
        ("10", "0.01", "0.01", "500", ["30"], "0.01"),
        ("1000", "0.01", "0.01", "100", ["5"], "0.001"),
        ("5000", "0.10", "0.10", "50", ["3"], "0.001"),
        ("1", "1", "1", "10000", ["0"], "0.01"),
    ]
    cases = []
    for index in range(GENERATED_CASES):
        contract, vmin, vstep, vmax, spreads, point = rng.choice(specs)
        side = rng.choice(["BUY", "SELL"])
        entry = money(rng.randrange(100000, 550000), 2)
        # at most 150 so that even a SELL's 3.75x target stays above zero at the lowest entry
        stop_distance = money(rng.randrange(300, 15001), 2)
        # gold at 4,000 x 100 ounces is a 400,000 notional per lot: most accounts that
        # size to a real lot are large, and a share must be small enough to underflow
        band = rng.randrange(10)
        if band < 2:
            equity = money(rng.randrange(100000, 1000000), 2)
        elif band < 6:
            equity = money(rng.randrange(1000000, 10000000), 2)
        else:
            equity = money(rng.randrange(10000000, 100000000), 2)
        max_risk = rng.choice(["0.5", "0.75", "1", "1.25", "1.5", "1.75", "2"])
        max_risk_units = int(Decimal(max_risk) * 100)
        risk_units = rng.randrange(50, max_risk_units + 1) if max_risk_units > 50 else 50
        risk_pct = money(risk_units, 2)
        sld_units = int(Decimal(stop_distance) * 100)
        min_sld = rng.choice(["5", "8", "13", "20"])
        stops = []
        stops_from = int(Decimal(min_sld) * 100)
        stops_to = max(2 * sld_units, stops_from + 1000)
        for _ in range(rng.randrange(0, 5)):
            stops.append(money(rng.randrange(stops_from, stops_to + 1), 2))
        cases.append(
            make_case(
                "generated-%03d" % index,
                "generated",
                "",
                side=side,
                entry=entry,
                stop_distance=stop_distance,
                equity=equity,
                risk_pct=risk_pct,
                max_leverage=rng.choice(["0.75", "1", "1.5", "2", "2.5", "3", "4.2", "5"]),
                commission=rng.choice(["0", "2", "3.5", "4", "7.25", "10"]),
                spec={
                    "contract_size": contract,
                    "volume_min": vmin,
                    "volume_step": vstep,
                    "volume_max": vmax,
                    "typical_spread": rng.choice(spreads),
                    "point": point,
                },
                target_rrr=money(rng.randrange(150, 351, 5), 2),
                max_risk_pct=max_risk,
                min_sld=min_sld,
                structural_stops=stops,
            )
        )
    return cases


# ---------------------------------------------------------------------------
# The fixture
# ---------------------------------------------------------------------------


def script_sha256():
    data = Path(__file__).resolve().read_bytes().replace(b"\r\n", b"\n")
    return hashlib.sha256(data).hexdigest()


def build():
    rng = random.Random(SEED)
    cases = special_cases() + generated_cases(rng)
    ids = [case["id"] for case in cases]
    assert len(ids) == len(set(ids)), "case ids must be unique"
    return {
        "generator": {
            "script": "scripts/engine4/oracle.py",
            "script_sha256": script_sha256(),
            "seed": SEED,
            "arithmetic": "python decimal, 400 digits, every operation checked exact; "
            "quotients kept as numerator/denominator",
            "case_count": len(cases),
            "format": "every figure is text; 'a/b' is a quotient of two decimals; "
            "'*_2dp' and '*_3dp' are rounded half away from zero",
        },
        "cases": [solve(case) for case in cases],
    }


def main(argv):
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
                "oracle check: the stored fixture equals a rebuild (%d cases, script sha256 %s)"
                % (len(fixture["cases"]), fixture["generator"]["script_sha256"][:16])
            )
            return 0
        print("oracle check: the stored fixture DIFFERS from a rebuild; run the oracle and prettier")
        return 1

    FIXTURE.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(fixture, indent=2, ensure_ascii=True) + "\n"
    FIXTURE.write_bytes(text.encode("utf-8"))
    print("wrote %s (%d cases)" % (FIXTURE, len(fixture["cases"])))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
