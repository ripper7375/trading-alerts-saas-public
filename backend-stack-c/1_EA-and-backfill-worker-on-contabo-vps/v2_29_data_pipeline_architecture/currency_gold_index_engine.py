#!/usr/bin/env python3
"""
DavinTrade Currency & Gold Index Engine (Lane 4)

Computes 8 equal-weighted G8 currency indices (USDX, EURX, JPYX, GBPX, AUDX, NZDX,
CADX, CHFX) and 1 gold basket index (XAUX) from raw M5 OHLCV exports, and pushes
them to the Railway API Gateway every 5 minutes.

ISOLATION (Lane 4 per DATA_COLLECTION_PIPELINE_BLUEPRINT_v2_29.md's isolation
doctrine): a FULLY SEPARATE process from export_collector_validator_v2.py /
backfill_worker_api_gateway_v5.py -- its own script, own NSSM service, own SQLite
outbox file, own gateway endpoint. It never opens xauusd.db and never reads a file
any of the 13 alert indicators write. This is deliberately the strongest available
isolation guarantee for "Lane 4 must never block or delay Lane 1 (XAUUSD alerts)":
zero shared process, zero shared database file, zero shared source file. It also
sidesteps a real, previously-hit hazard in this exact repo -- a read-only consumer
pointed at a writer's database path caused a schema-landmine incident (see CLAUDE.md's
2026-09-11 fixture-database entry): "a renderer, a test harness or any read-only
consumer must never be pointed at a writer's database path, even to read."

MATH GROUND TRUTH: all 8 currency-index formulas (exponent signs, weights) were read
directly from and verified byte-exact against the authoritative MQL5 indicator files
in mql5-indicators/interesting-indicators/currency-and-gold-index/{USDX,EURX,GBPX,
JPYX,CADX,AUDX,NZDX,CHFX}.mq5 -- see CURRENCY_INDEX_TERMS below.

XAUX is NOT a simple rebase of XAUUSD -- an earlier version of this engine computed
it that way (a plain XAUUSD(t)/XAUUSD(inception) ratio), which is mathematically
incapable of ever diverging from USD-denominated gold and is misleading marketing
copy for a "genuine gold strength" index. The correct formula, read directly from
the authoritative mql5-indicators/interesting-indicators/currency-and-gold-index/
XAUX.mq5 (CalculateXAUX()/TranslateToGoldPairs()), is an equal-weighted (0.20 each)
geometric basket of gold priced in 5 currencies -- XAUUSD, XAUEUR, XAUJPY, XAUGBP,
XAUAUD -- NOT a basket of currency pairs. XAUEUR/XAUGBP/XAUAUD are XAUUSD divided by
the respective USD-quoted pair (more EUR/GBP/AUD needed to buy the same gold as the
quote currency weakens against USD raises the ratio); XAUJPY is XAUUSD multiplied by
USDJPY (JPY is quoted USD-per-JPY-flipped, so more JPY per USD directly scales up
gold's JPY price). See gold_leg_rate()/xaux_value() below -- this engine rebases the
raw 5-currency product to 100.00 at gold's own daily session open using the exact
same ratio-based construction as index_value() (no basket "0.2*4" collapsing to a
1-currency answer; every leg's own inception-to-now ratio contributes independently).

INPUT: 8 independent OHLCV_{SYMBOL}_M5.txt files (EURUSD, USDJPY, GBPUSD, AUDUSD,
NZDUSD, USDCAD, USDCHF, XAUUSD), all written by the SAME generic, already-compiled
ohlcvexportlightweight_v2_29.mq5 exporter, attached to 8 independent MT5 charts --
including a dedicated XAUUSD chart separate from the alert pipeline's own XAUUSD
export, precisely to avoid any cross-lane file dependency. Format: tab-separated,
newest-bar-last is NOT assumed -- see parse_ohlcv_file(). Header (verified against
the live exporter source, NOT the architecture doc's stale section 3.3 contract,
which claims a different column order):
    ohlcv_timestamp  ohlcv_symbol  ohlcv_timeframe  ohlcv_close  ohlcv_open  ohlcv_high  ohlcv_low  ohlcv_volume
Timestamps are already UTC-normalized by the exporter's own TimeTradeServer()-based
fix (2026-09-09, the same timestamp_adj fix applied to the 13 alert indicators), so
this module does no further timezone adjustment on bar_time itself -- only on
determining WHICH bar is today's session-open bar (see eightcap_utc_offset_hours).

INDEX OHLC (added 2026-09-13 for the Currency Index Comparison PRO page's OHLC and
Heiken Ashi candles): `value` is, and always was, the index CLOSE. Each row now also
carries the index OPEN/HIGH/LOW of the same M5 bar, following the rule in the
authoritative per-series MQL5 references
(davintrade-currency-index-comparison-pro-stack/{usdx,eurx,...,xaux}/*_H1_{Open,High,
Low,Close}.mq5): Open/Close use the pairs' own opens/closes; High takes, for every
input, whichever extreme RAISES the index -- the pair's High where the index carries
that pair with a positive exponent ("direct"), its Low where the exponent is negative
("inverse") -- and Low takes the opposite. This engine only reads the 7 USD-quoted
primary pairs (+ XAUUSD) and triangulates the 21 crosses, so the rule is applied to
each index's NET exponent per primary symbol (see symbol_exponents()) -- the same
bound the MQL5 per-term rule produces, since every G8 index reduces to
u_X / PRODUCT(u_Y ^ W) with each primary pair mapping to exactly one currency (no
symbol ever needs its High in one term and its Low in another).

OUTPUT: a dedicated SQLite outbox (currency_gold_indices.db -- never xauusd.db)
drained to POST {API_GATEWAY_URL}/api/v1/currency-gold-indices, batched as a plain
JSON array (up to 9 rows/cycle, ~1.5KB -- see
gateway_contract_currency_gold_indices.schema.json), matching the indicator-statistics
lane's array-POST convention rather than inventing a new wrapper shape.

NOT YET BUILT (Phase 1 scope -- see davintrade-currency-index-stack/ plan): the
gateway endpoint itself, the Postgres tables, the Redis cache, and the frontend
widget. Until Phase 2 ships the endpoint, every push here fails closed (logged,
retried next cycle) and rows simply accumulate with synced_at IS NULL -- the same
"outbox absorbs downtime" behavior every other lane already relies on.
"""

import json
import logging
import os
import signal
import sqlite3
import time
from datetime import date, datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ============================================================
# CONFIGURATION
# ============================================================
API_GATEWAY_URL = os.environ.get('API_GATEWAY_URL', 'https://your-api.railway.app')
API_KEY = os.environ.get('BACKFILL_API_KEY', 'your_api_key_here')
TERMINAL_ID = 'currency_gold_index_engine_v1'

# Independent of the alert pipeline's own export/database paths (see module
# docstring's ISOLATION section) -- these have their own env vars so they can
# never accidentally be pointed at xauusd.db or C:/MT5/MQL5/Files by a copy-pasted
# service config.
EXPORT_DIR = Path(os.environ.get('CGI_EXPORT_DIR', 'C:/MT5/MQL5/Files'))
DB_PATH = Path(os.environ.get('CGI_DB_PATH', 'C:/Scripts/database/currency_gold_indices.db'))
LOG_DIR = Path(os.environ.get('CGI_LOG_DIR', 'C:/Scripts/logs'))
REJECTED_FILE = DB_PATH.parent / 'rejected_currency_gold_indices.jsonl'

CYCLE_TRIGGER_SECOND = 5          # fire at :05, after the :59 export has landed (spec section 4.1)
CYCLE_TRIGGER_MINUTE_STEP = 5     # every 5 minutes: :00, :05, :10, ...
RETRY_WAIT_SEC = 65               # one bounded retry if an export file is missing/empty (section 4.1)
HTTP_TIMEOUT_SEC = 8
MAX_ROWS_PER_PUSH = 9             # 8 currency indices + XAUX; one push drains a whole cycle

FX_PAIRS = ('EURUSD', 'USDJPY', 'GBPUSD', 'AUDUSD', 'NZDUSD', 'USDCAD', 'USDCHF')
GOLD_SYMBOL = 'XAUUSD'
ALL_SYMBOLS = FX_PAIRS + (GOLD_SYMBOL,)

W = 1.0 / 7.0  # equal weight, 0.142857... (spec section 5.1)

# XAUX ground truth: mql5-indicators/interesting-indicators/currency-and-gold-index/
# XAUX.mq5. All 5 legs equal-weighted at 0.20 (CalculateXAUX()'s Weights array).
# Only 4 of the 5 legs need their own FX rate (XAUUSD is the gold price itself,
# already read as GOLD_SYMBOL) -- and all 4 are already read as part of FX_PAIRS
# above, so XAUX needs no new input file.
GOLD_INDEX_WEIGHT = 0.20
GOLD_INDEX_LEGS = ('XAUUSD', 'XAUEUR', 'XAUJPY', 'XAUGBP', 'XAUAUD')
XAUX_FX_LEGS = ('EURUSD', 'USDJPY', 'GBPUSD', 'AUDUSD')

# Each entry: index_name -> [(pair, exponent_sign), ...], one pair per weight term.
# Verified byte-exact against MathPow() calls read directly from the 8 authoritative
# MQL5 files (mql5-indicators/interesting-indicators/currency-and-gold-index/*.mq5),
# not just transcribed from the architecture doc's own Formula Matrix -- both agree.
CURRENCY_INDEX_TERMS: Dict[str, List[Tuple[str, float]]] = {
    'USDX': [('EURUSD', -1), ('USDJPY', +1), ('GBPUSD', -1), ('AUDUSD', -1),
             ('NZDUSD', -1), ('USDCAD', +1), ('USDCHF', +1)],
    'EURX': [('EURUSD', +1), ('EURJPY', +1), ('EURGBP', +1), ('EURAUD', +1),
             ('EURNZD', +1), ('EURCAD', +1), ('EURCHF', +1)],
    'JPYX': [('USDJPY', -1), ('EURJPY', -1), ('GBPJPY', -1), ('AUDJPY', -1),
             ('NZDJPY', -1), ('CADJPY', -1), ('CHFJPY', -1)],
    'GBPX': [('GBPUSD', +1), ('EURGBP', -1), ('GBPJPY', +1), ('GBPAUD', +1),
             ('GBPNZD', +1), ('GBPCAD', +1), ('GBPCHF', +1)],
    'AUDX': [('AUDUSD', +1), ('EURAUD', -1), ('GBPAUD', -1), ('AUDJPY', +1),
             ('AUDNZD', +1), ('AUDCAD', +1), ('AUDCHF', +1)],
    'NZDX': [('NZDUSD', +1), ('EURNZD', -1), ('GBPNZD', -1), ('AUDNZD', -1),
             ('NZDJPY', +1), ('NZDCAD', +1), ('NZDCHF', +1)],
    'CADX': [('USDCAD', -1), ('EURCAD', -1), ('GBPCAD', -1), ('AUDCAD', -1),
             ('NZDCAD', -1), ('CADJPY', +1), ('CADCHF', +1)],
    'CHFX': [('USDCHF', -1), ('EURCHF', -1), ('GBPCHF', -1), ('AUDCHF', -1),
             ('NZDCHF', -1), ('CADCHF', -1), ('CHFJPY', +1)],
}

# Primary-symbol form of usd_per_unit(): usd_per_unit(ccy) == symbol ** power.
# Used only to derive each index's net per-symbol exponents (symbol_exponents()),
# which the OHLC High/Low rule needs -- the value itself still goes through
# index_value()/xaux_value(), unchanged.
USD_PER_UNIT_SYMBOL: Dict[str, Tuple[str, int]] = {
    'EUR': ('EURUSD', +1),
    'GBP': ('GBPUSD', +1),
    'AUD': ('AUDUSD', +1),
    'NZD': ('NZDUSD', +1),
    'JPY': ('USDJPY', -1),
    'CAD': ('USDCAD', -1),
    'CHF': ('USDCHF', -1),
}

# gold_leg_rate() in symbol form: each gold leg as {symbol: power}.
GOLD_LEG_SYMBOL_POWERS: Dict[str, Dict[str, int]] = {
    'XAUUSD': {'XAUUSD': +1},
    'XAUEUR': {'XAUUSD': +1, 'EURUSD': -1},
    'XAUJPY': {'XAUUSD': +1, 'USDJPY': +1},
    'XAUGBP': {'XAUUSD': +1, 'GBPUSD': -1},
    'XAUAUD': {'XAUUSD': +1, 'AUDUSD': -1},
}

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS currency_gold_indices (
    index_name             TEXT    NOT NULL,
    bar_time                INTEGER NOT NULL,
    value                    REAL    NOT NULL,
    change_pct               REAL    NOT NULL,
    session_open_bar_time    INTEGER NOT NULL,
    open                     REAL,
    high                     REAL,
    low                      REAL,
    synced_at                INTEGER,
    created_at               INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    PRIMARY KEY (index_name, bar_time)
);
CREATE INDEX IF NOT EXISTS idx_currency_gold_indices_unsynced
    ON currency_gold_indices (bar_time) WHERE synced_at IS NULL;
"""

# Columns added after the table first shipped. CREATE TABLE IF NOT EXISTS is a
# no-op against an existing outbox file, so these are added by
# migrate_outbox_columns() instead -- the same reason
# export_collector_validator_v2.py has migrate_raw_tables().
OHLC_COLUMNS = ('open', 'high', 'low')


# ============================================================
# LOGGING / SHUTDOWN
# ============================================================
def setup_logging() -> logging.Logger:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    lg = logging.getLogger('currency_gold_index_engine')
    lg.setLevel(logging.INFO)
    ch = logging.StreamHandler()
    ch.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    fh = RotatingFileHandler(LOG_DIR / 'currency_gold_index_engine.log',
                              maxBytes=10 * 1024 * 1024, backupCount=5, encoding='utf-8')
    fh.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
    lg.addHandler(ch)
    lg.addHandler(fh)
    return lg


logger = setup_logging()
shutdown_requested = False


def _signal_handler(signum, frame):
    global shutdown_requested
    logger.info("Shutdown requested...")
    shutdown_requested = True


signal.signal(signal.SIGINT, _signal_handler)
signal.signal(signal.SIGTERM, _signal_handler)


# ============================================================
# EIGHTCAP SERVER-TIME UTC OFFSET
#
# This engine has no live MT5 API access (it only reads exported files), so unlike
# the MQL5 indicators -- which measure TimeTradeServer() - TimeGMT() live, every
# cycle -- it must independently compute which whole-hour UTC offset applies today.
# The blueprint documents this as a FIXED, ZERO-VARIANCE broker policy (section 4.3:
# "UTC+2 (Winter) / UTC+3 (Summer / US DST)... zero broker variance in this
# deployment"), so this is a specified rule to implement precisely, not a guess.
# ============================================================
def _nth_sunday_of_month(year: int, month: int, n: int) -> date:
    """The n-th Sunday of (year, month), 1-indexed."""
    d = date(year, month, 1)
    days_until_sunday = (6 - d.weekday()) % 7  # date.weekday(): Monday=0 ... Sunday=6
    first_sunday = date.fromordinal(d.toordinal() + days_until_sunday)
    return date.fromordinal(first_sunday.toordinal() + (n - 1) * 7)


def us_dst_transitions_utc(year: int) -> Tuple[datetime, datetime]:
    """US DST rule (stable since the Energy Policy Act of 2005, which is what the
    blueprint's "Summer / US DST" phrasing points at -- Eightcap's server follows
    the US transition calendar, not the EU one): starts 2nd Sunday of March at
    2:00 AM local, ends 1st Sunday of November at 2:00 AM local. The exact UTC
    instant of the 2 AM local transition isn't needed here -- this function is only
    ever used to pick which of two whole-hour offsets (+2 / +3) applies to a given
    DATE, so a same-day approximation (07:00 UTC start, 06:00 UTC end) is sufficient;
    see the transition-day caveat on eightcap_utc_offset_hours.
    """
    start = _nth_sunday_of_month(year, 3, 2)
    end = _nth_sunday_of_month(year, 11, 1)
    return (
        datetime(start.year, start.month, start.day, 7, 0, tzinfo=timezone.utc),
        datetime(end.year, end.month, end.day, 6, 0, tzinfo=timezone.utc),
    )


def eightcap_utc_offset_hours(when: datetime) -> int:
    """+2 (winter) or +3 (summer/US DST) -- Eightcap's documented, fixed broker
    policy. NOTE: on the two transition days themselves there is an inherent few-hour
    ambiguity window (this picks one offset for the whole day rather than modeling
    the exact 2 AM instant), which is acceptable for a display-only marketing widget
    but would need tightening before any alert-critical use.
    """
    dst_start, dst_end = us_dst_transitions_utc(when.year)
    return 3 if dst_start <= when < dst_end else 2


def todays_session_open_utc(now_utc: datetime, server_hour: int, server_minute: int = 0) -> int:
    """UTC unix timestamp of today's session-open bar at (server_hour:server_minute)
    Eightcap server time, for the server-calendar-day containing `now_utc`.
    """
    offset_sec = eightcap_utc_offset_hours(now_utc) * 3600
    server_now = now_utc.timestamp() + offset_sec
    server_day_start = int(server_now // 86400) * 86400  # midnight, server time (shifted timeline)
    session_open_server = server_day_start + server_hour * 3600 + server_minute * 60
    return int(session_open_server - offset_sec)


# ============================================================
# CROSS-RATE TRIANGULATION
# ============================================================
def usd_per_unit(currency: str, primary_rates: Dict[str, float]) -> float:
    """How many USD one unit of `currency` buys, derived from the 7 primary
    USD-quoted pairs. EUR/GBP/AUD/NZD are quoted base-against-USD (the primary rate
    IS usd-per-unit directly); JPY/CAD/CHF are quoted USD-against-them (usd-per-unit
    is the reciprocal).
    """
    if currency == 'EUR':
        return primary_rates['EURUSD']
    if currency == 'GBP':
        return primary_rates['GBPUSD']
    if currency == 'AUD':
        return primary_rates['AUDUSD']
    if currency == 'NZD':
        return primary_rates['NZDUSD']
    if currency == 'JPY':
        return 1.0 / primary_rates['USDJPY']
    if currency == 'CAD':
        return 1.0 / primary_rates['USDCAD']
    if currency == 'CHF':
        return 1.0 / primary_rates['USDCHF']
    raise ValueError(f'Unknown currency: {currency}')


def get_rate(pair: str, primary_rates: Dict[str, float]) -> float:
    """Rate for any of the 7 primary pairs (direct passthrough) or any of the 21
    synthetic cross pairs the formula matrix needs, via triangulation:
    CROSS(A/B) = usd_per_unit(A) / usd_per_unit(B).

    Verified against the architecture doc's own worked examples (section 5.1) --
    all three reproduce exactly via this one general formula:
        EURJPY = EURUSD * USDJPY  ==  usd_per_unit(EUR) / usd_per_unit(JPY)
                                   ==  EURUSD / (1/USDJPY)  ==  EURUSD * USDJPY
        EURGBP = EURUSD / GBPUSD  ==  usd_per_unit(EUR) / usd_per_unit(GBP)
        AUDCAD = AUDUSD * USDCAD  ==  usd_per_unit(AUD) / usd_per_unit(CAD)
                                   ==  AUDUSD / (1/USDCAD)  ==  AUDUSD * USDCAD
    """
    if pair in primary_rates:
        return primary_rates[pair]
    base, quote = pair[:3], pair[3:]
    return usd_per_unit(base, primary_rates) / usd_per_unit(quote, primary_rates)


def index_value(index_name: str, rates_now: Dict[str, float],
                 rates_inception: Dict[str, float]) -> float:
    """Index(t) = 100 * PRODUCT_k (rate_k(t) / rate_k(inception)) ^ (sign_k * W)

    Algebraically identical to the MQL5 form C_i * PRODUCT(rate(t)^{+-}W) with
    C_i = 100 / PRODUCT(rate(inception)^{+-}W): substituting C_i in gives
    100 * PRODUCT((rate(t)/rate(inception))^{+-}W), which is exactly what this
    function computes. Expressing it as a ratio (rather than persisting C_i
    separately) makes this a pure, stateless recomputation from any two rate
    snapshots -- safe to restart the engine mid-day with no session-state file.
    """
    product = 1.0
    for pair, sign in CURRENCY_INDEX_TERMS[index_name]:
        r_now = get_rate(pair, rates_now)
        r_inc = get_rate(pair, rates_inception)
        product *= (r_now / r_inc) ** (sign * W)
    return 100.0 * product


def gold_leg_rate(leg: str, xauusd: float, fx_rates: Dict[str, float]) -> float:
    """One of the 5 gold-in-currency prices from TranslateToGoldPairs() in the
    authoritative XAUX.mq5. xauusd is the gold leg itself (passthrough); the other
    4 are XAUUSD triangulated through the matching USD-quoted FX pair -- EUR/GBP/AUD
    are quoted base-against-USD (dividing raises the ratio as the quote currency
    weakens against USD, correctly making gold "more expensive" in that currency);
    JPY is quoted USD-against-JPY, so multiplying (not dividing) does the same job.
    """
    if leg == 'XAUUSD':
        return xauusd
    if leg == 'XAUEUR':
        return xauusd / fx_rates['EURUSD']
    if leg == 'XAUJPY':
        return xauusd * fx_rates['USDJPY']
    if leg == 'XAUGBP':
        return xauusd / fx_rates['GBPUSD']
    if leg == 'XAUAUD':
        return xauusd / fx_rates['AUDUSD']
    raise ValueError(f'Unknown gold leg: {leg}')


def xaux_value(xauusd_now: float, fx_now: Dict[str, float],
                xauusd_inception: float, fx_inception: Dict[str, float]) -> float:
    """XAUX(t) = 100 * PRODUCT_leg (gold_leg(t) / gold_leg(inception)) ^ 0.20

    Same ratio-based construction as index_value() (no persisted normalization
    constant), applied to the 5 gold-priced-in-currency legs from
    CalculateXAUX()/TranslateToGoldPairs() in XAUX.mq5 instead of the 7 FX pairs.
    All 5 exponents are +0.20 (CalculateXAUX() takes no sign parameter -- it is a
    plain equal-weighted product, unlike the currency indices' +/- exponent terms).
    """
    product = 1.0
    for leg in GOLD_INDEX_LEGS:
        r_now = gold_leg_rate(leg, xauusd_now, fx_now)
        r_inc = gold_leg_rate(leg, xauusd_inception, fx_inception)
        product *= (r_now / r_inc) ** GOLD_INDEX_WEIGHT
    return 100.0 * product


# ============================================================
# INDEX OHLC (open/high/low of the same M5 bar -- see module docstring)
# ============================================================
def _add_power(acc: Dict[str, float], symbol: str, power: float) -> None:
    acc[symbol] = acc.get(symbol, 0.0) + power


def symbol_exponents(index_name: str) -> Dict[str, float]:
    """The index as PRODUCT(symbol ** exponent) over the raw input symbols.

    Derived mechanically from the SAME tables index_value()/xaux_value() use
    (CURRENCY_INDEX_TERMS + get_rate()'s triangulation, GOLD_INDEX_LEGS +
    gold_leg_rate()), not hand-transcribed -- test_currency_gold_index_ohlc.py
    pins that evaluating it on closes reproduces index_value()/xaux_value().
    Symbols whose exponents cancel to zero are dropped.
    """
    acc: Dict[str, float] = {}
    if index_name == 'XAUX':
        for leg in GOLD_INDEX_LEGS:
            for symbol, power in GOLD_LEG_SYMBOL_POWERS[leg].items():
                _add_power(acc, symbol, power * GOLD_INDEX_WEIGHT)
    else:
        for pair, sign in CURRENCY_INDEX_TERMS[index_name]:
            if pair in FX_PAIRS:
                # Primary pairs pass straight through get_rate().
                _add_power(acc, pair, sign * W)
                continue
            # Cross = usd_per_unit(base) / usd_per_unit(quote).
            base, quote = pair[:3], pair[3:]
            base_symbol, base_power = USD_PER_UNIT_SYMBOL[base]
            quote_symbol, quote_power = USD_PER_UNIT_SYMBOL[quote]
            _add_power(acc, base_symbol, sign * W * base_power)
            _add_power(acc, quote_symbol, -sign * W * quote_power)
    return {s: e for s, e in acc.items() if abs(e) > 1e-12}


def _index_from_symbol_prices(exponents: Dict[str, float], prices_now: Dict[str, float],
                              prices_inception: Dict[str, float]) -> float:
    product = 1.0
    for symbol, exponent in exponents.items():
        product *= (prices_now[symbol] / prices_inception[symbol]) ** exponent
    return 100.0 * product


def index_ohlc(index_name: str, bars_now: Dict[str, Tuple[float, float, float, float]],
               closes_inception: Dict[str, float], close_value: float
               ) -> Tuple[float, float, float]:
    """(open, high, low) of the index for one M5 bar.

    bars_now maps each input symbol to its (open, high, low, close) for that bar;
    closes_inception is the same session inception every index already uses.
    close_value is the row's `value` (the index close, from index_value()/
    xaux_value()) -- passed in rather than recomputed so close is byte-identical
    to `value`, and used to keep the candle well-formed.

    High uses each symbol's High where its exponent is positive and its Low where
    negative (MQL5 *_H1_High.mq5: "Direct pairs: use High price, Inverse pairs: use
    Low price"); Low is the mirror image. Because every symbol's High >= its open
    and close (and Low <= them), this is guaranteed to bracket open and close for
    well-formed input bars; the final max/min only guards a malformed export row
    (e.g. a High below its own Close) from ever producing an inverted candle.
    """
    exponents = symbol_exponents(index_name)
    opens = {s: bars_now[s][0] for s in exponents}
    highs_for_high = {s: bars_now[s][1] if e > 0 else bars_now[s][2] for s, e in exponents.items()}
    lows_for_low = {s: bars_now[s][2] if e > 0 else bars_now[s][1] for s, e in exponents.items()}

    open_value = _index_from_symbol_prices(exponents, opens, closes_inception)
    high_value = _index_from_symbol_prices(exponents, highs_for_high, closes_inception)
    low_value = _index_from_symbol_prices(exponents, lows_for_low, closes_inception)

    high_value = max(high_value, open_value, close_value)
    low_value = min(low_value, open_value, close_value)
    return open_value, high_value, low_value


# ============================================================
# OHLCV FILE PARSING
# ============================================================
class ExportNotReadyError(Exception):
    """An OHLCV export file is missing or empty -- worth one short bounded retry,
    since it usually means the exporter's own :59 write hasn't landed yet."""


# (timestamp_utc, open, high, low, close)
Bar = Tuple[int, float, float, float, float]


def parse_ohlcv_file(path: Path) -> List[Bar]:
    """Parse one OHLCV_{SYMBOL}_M5.txt export. Returns [(timestamp_utc, open, high,
    low, close), ...] sorted ascending by timestamp. Header/column order verified
    against the live ohlcvexportlightweight_v2_29.mq5 source and
    export_collector_validator_v2.py's own parser (module docstring) -- NOT the
    architecture doc's stale section 3.3 contract, which claims a different column
    order. Columns are located by header name, never by position.
    """
    rows: List[Bar] = []
    with open(path, encoding='utf-8') as f:
        header_line = f.readline().rstrip('\n').rstrip('\r')
        if not header_line.strip():
            raise ExportNotReadyError(f'{path.name}: empty header')
        headers = header_line.split('\t')
        try:
            ts_idx = headers.index('ohlcv_timestamp')
            open_idx = headers.index('ohlcv_open')
            high_idx = headers.index('ohlcv_high')
            low_idx = headers.index('ohlcv_low')
            close_idx = headers.index('ohlcv_close')
        except ValueError as e:
            raise ValueError(f'{path.name}: unexpected header {headers!r}') from e

        for lineno, line in enumerate(f, start=2):
            line = line.rstrip('\n').rstrip('\r')
            if not line.strip():
                continue
            parts = line.split('\t')
            try:
                ts = int(parts[ts_idx])
                o = float(parts[open_idx])
                h = float(parts[high_idx])
                lo = float(parts[low_idx])
                c = float(parts[close_idx])
            except (ValueError, IndexError):
                logger.warning(f'{path.name}:{lineno}: unparseable row, skipped')
                continue
            rows.append((ts, o, h, lo, c))

    if not rows:
        raise ExportNotReadyError(f'{path.name}: header present but zero data rows')
    rows.sort(key=lambda r: r[0])
    return rows


def close_at_or_before(series: List[Bar], ts: int) -> Optional[float]:
    """Forward-fill lookup: the most recent close at or before `ts` (spec section
    4.2's forward-fill rule, applied here as a point lookup rather than a
    materialized fill pass -- equivalent result, no need to build a synthetic
    5-minute grid). None if the series has no data that old.
    """
    result: Optional[float] = None
    for bar in series:
        if bar[0] > ts:
            break
        result = bar[4]
    return result


def ohlc_at(series: List[Bar], ts: int) -> Optional[Tuple[float, float, float, float]]:
    """(open, high, low, close) of the bar AT `ts`, for index_ohlc().

    Same forward-fill rule as close_at_or_before(): if this symbol has no bar at
    exactly `ts` (it did not trade in that 5 minutes), the bar is flat at the
    forward-filled close -- consistent with the close `value` already uses for that
    symbol, and the honest reading of "no price movement observed". None if the
    series has no data that old.
    """
    found: Optional[Bar] = None
    for bar in series:
        if bar[0] > ts:
            break
        found = bar
    if found is None:
        return None
    if found[0] == ts:
        return found[1], found[2], found[3], found[4]
    c = found[4]
    return c, c, c, c


def _load_all_series(export_dir: Path) -> Dict[str, List[Bar]]:
    series: Dict[str, List[Bar]] = {}
    for symbol in ALL_SYMBOLS:
        path = export_dir / f'OHLCV_{symbol}_M5.txt'
        if not path.exists():
            raise ExportNotReadyError(f'{path} not found')
        series[symbol] = parse_ohlcv_file(path)
    return series


# ============================================================
# PER-CYCLE COMPUTATION
# ============================================================
def compute_cycle(export_dir: Path, now_utc: datetime) -> List[dict]:
    """Read all 8 OHLCV files, compute the latest bar's value for each of the 9
    indices. Returns a row-dict list ready for the outbox (possibly fewer than 9
    if one family's session hasn't opened yet today -- e.g. during gold's
    23:59-01:01 rollover halt). Raises ExportNotReadyError if a file is missing or
    empty (the caller retries once).
    """
    series = _load_all_series(export_dir)
    rows: List[dict] = []

    # --- FX family: 8 currency indices share one inception (00:00 server time) ---
    fx_latest_ts = max(series[p][-1][0] for p in FX_PAIRS)
    fx_session_open_ts = todays_session_open_utc(now_utc, server_hour=0, server_minute=0)

    if fx_latest_ts >= fx_session_open_ts:
        rates_now = {p: close_at_or_before(series[p], fx_latest_ts) for p in FX_PAIRS}
        rates_inception = {p: close_at_or_before(series[p], fx_session_open_ts) for p in FX_PAIRS}
        bars_now = {p: ohlc_at(series[p], fx_latest_ts) for p in FX_PAIRS}
        if all(v is not None for v in rates_now.values()) and \
           all(v is not None for v in rates_inception.values()):
            for idx_name in CURRENCY_INDEX_TERMS:
                value = index_value(idx_name, rates_now, rates_inception)
                o, h, lo = index_ohlc(idx_name, bars_now, rates_inception, value)
                rows.append({
                    'index_name': idx_name,
                    'bar_time': fx_latest_ts,
                    'value': value,
                    'change_pct': value - 100.0,
                    'session_open_bar_time': fx_session_open_ts,
                    'open': o,
                    'high': h,
                    'low': lo,
                })
        else:
            logger.warning('FX cycle: missing inception or current rate(s) after '
                            'ffill lookup -- skipping the 8 currency indices this cycle')
    else:
        logger.debug('FX session has not opened yet today -- skipping currency indices')

    # --- Gold: independent inception (01:01 server time), 5-currency basket ---
    # XAUX is NOT a simple XAUUSD rebase -- see GOLD_INDEX_LEGS/xaux_value() and the
    # module docstring's MATH GROUND TRUTH section. Needs its own gold close plus the
    # 4 FX legs (EURUSD/USDJPY/GBPUSD/AUDUSD -- already read as part of FX_PAIRS) at
    # both gold's own latest bar and gold's own session-open bar.
    gold_latest_ts = series[GOLD_SYMBOL][-1][0]
    gold_latest_close = series[GOLD_SYMBOL][-1][4]
    gold_session_open_ts = todays_session_open_utc(now_utc, server_hour=1, server_minute=1)

    if gold_latest_ts >= gold_session_open_ts:
        gold_inception_close = close_at_or_before(series[GOLD_SYMBOL], gold_session_open_ts)
        fx_now = {p: close_at_or_before(series[p], gold_latest_ts) for p in XAUX_FX_LEGS}
        fx_inception = {p: close_at_or_before(series[p], gold_session_open_ts) for p in XAUX_FX_LEGS}
        if (gold_inception_close is not None and gold_inception_close > 0
                and all(v is not None for v in fx_now.values())
                and all(v is not None for v in fx_inception.values())):
            value = xaux_value(gold_latest_close, fx_now, gold_inception_close, fx_inception)
            gold_bars_now = {p: ohlc_at(series[p], gold_latest_ts) for p in XAUX_FX_LEGS}
            gold_bars_now[GOLD_SYMBOL] = ohlc_at(series[GOLD_SYMBOL], gold_latest_ts)
            gold_closes_inception = dict(fx_inception)
            gold_closes_inception[GOLD_SYMBOL] = gold_inception_close
            o, h, lo = index_ohlc('XAUX', gold_bars_now, gold_closes_inception, value)
            rows.append({
                'index_name': 'XAUX',
                'bar_time': gold_latest_ts,
                'value': value,
                'change_pct': value - 100.0,
                'session_open_bar_time': gold_session_open_ts,
                'open': o,
                'high': h,
                'low': lo,
            })
        else:
            logger.warning('Gold cycle: missing inception/current gold or FX-leg rate(s) '
                            'after ffill lookup -- skipping XAUX this cycle')
    else:
        logger.debug('Gold session has not opened yet today (rollover window) -- skipping XAUX')

    return rows


# ============================================================
# OUTBOX (SQLite -- dedicated file, never xauusd.db)
# ============================================================
def open_db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), timeout=10)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA_SQL)
    migrate_outbox_columns(conn)
    return conn


def migrate_outbox_columns(conn: sqlite3.Connection) -> List[str]:
    """Idempotently add OHLC_COLUMNS to an outbox created before they existed.

    Returns the columns actually added (empty on an up-to-date file). Nullable,
    no default: a row written before this change genuinely has no open/high/low,
    and is pushed without those keys (the gateway contract makes them optional).
    """
    existing = {row[1] for row in conn.execute("PRAGMA table_info(currency_gold_indices)")}
    added = []
    for column in OHLC_COLUMNS:
        if column not in existing:
            conn.execute(f"ALTER TABLE currency_gold_indices ADD COLUMN {column} REAL")
            added.append(column)
    if added:
        conn.commit()
    return added


def store_rows(conn: sqlite3.Connection, rows: List[dict]) -> int:
    """INSERT OR IGNORE, not REPLACE: a recompute of an already-pushed bar must
    never clear its synced_at stamp and cause a duplicate push."""
    if not rows:
        return 0
    before = conn.total_changes
    conn.executemany(
        """INSERT OR IGNORE INTO currency_gold_indices
           (index_name, bar_time, value, change_pct, session_open_bar_time, open, high, low)
           VALUES (:index_name, :bar_time, :value, :change_pct, :session_open_bar_time,
                   :open, :high, :low)""",
        [{'open': None, 'high': None, 'low': None, **row} for row in rows])
    conn.commit()
    return conn.total_changes - before


def build_push_payload(rows: List[sqlite3.Row]) -> List[dict]:
    """One contract object per outbox row. open/high/low are OPTIONAL in the
    contract and omitted (never sent as null) for a row that has none -- i.e. a
    row stored before the OHLC columns existed."""
    payload = []
    for r in rows:
        item = {
            'terminal_id': TERMINAL_ID,
            'index_name': r['index_name'],
            'bar_time': r['bar_time'],
            'value': r['value'],
            'change_pct': r['change_pct'],
            'session_open_bar_time': r['session_open_bar_time'],
        }
        for column in OHLC_COLUMNS:
            if r[column] is not None:
                item[column] = r[column]
        payload.append(item)
    return payload


# ============================================================
# PUSH (isolated drain loop -- mirrors push_statistics()'s pattern in
# backfill_worker_api_gateway_v5.py, adapted to this engine's own outbox)
# ============================================================
def create_http_session() -> requests.Session:
    session = requests.Session()
    retry = Retry(total=2, backoff_factor=0.5, status_forcelist=[502, 503, 504],
                   allowed_methods=["POST"], raise_on_status=False)
    adapter = HTTPAdapter(max_retries=retry, pool_connections=2, pool_maxsize=5)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    session.headers.update({
        'Authorization': f'Bearer {API_KEY}',
        'Content-Type': 'application/json',
    })
    return session


def push_indices(session: requests.Session, conn: sqlite3.Connection) -> int:
    """Drain the outbox to the gateway. Best-effort -- every exception here is
    caught so a push failure can never propagate out of this cycle, let alone into
    any other lane on this VPS.
    """
    try:
        cur = conn.execute(
            """SELECT index_name, bar_time, value, change_pct, session_open_bar_time,
                      open, high, low
               FROM currency_gold_indices WHERE synced_at IS NULL
               ORDER BY bar_time ASC LIMIT ?""",
            (MAX_ROWS_PER_PUSH,))
        rows = cur.fetchall()
        if not rows:
            return 0

        payload = build_push_payload(rows)

        resp = session.post(f'{API_GATEWAY_URL}/api/v1/currency-gold-indices',
                             json=payload, timeout=HTTP_TIMEOUT_SEC)

        if resp.status_code in (200, 201):
            now = int(time.time())
            conn.executemany(
                "UPDATE currency_gold_indices SET synced_at = ? "
                "WHERE index_name = ? AND bar_time = ?",
                [(now, r['index_name'], r['bar_time']) for r in rows])
            conn.commit()
            logger.info(f"Pushed {len(rows)} index value(s)")
            return len(rows)

        if resp.status_code == 400:
            # Poison-batch guard, mirroring the statistics/events lanes: quarantine
            # and stamp synced_at so one bad row can never wedge the outbox.
            try:
                with open(REJECTED_FILE, 'a', encoding='utf-8') as f:
                    f.write(json.dumps({
                        'quarantined_at': datetime.now().isoformat(),
                        'gateway_error': resp.text[:500],
                        'payload': payload,
                    }, default=str) + '\n')
            except OSError as e:
                logger.error(f"Failed to quarantine rejected indices: {e}")
            now = int(time.time())
            conn.executemany(
                "UPDATE currency_gold_indices SET synced_at = ? "
                "WHERE index_name = ? AND bar_time = ?",
                [(now, r['index_name'], r['bar_time']) for r in rows])
            conn.commit()
            logger.warning(f"Gateway rejected {len(rows)} index value(s) -- quarantined")
            return 0

        logger.warning(f"Push got HTTP {resp.status_code} -- will retry next cycle")
        return 0
    except Exception as e:                                      # noqa: BLE001
        # Never propagate: this must never affect anything else on the VPS.
        logger.warning(f"Push skipped: {e}")
        return 0


# ============================================================
# MAIN LOOP
# ============================================================
def run_cycle(session: requests.Session, conn: sqlite3.Connection) -> None:
    now_utc = datetime.now(timezone.utc)
    try:
        rows = compute_cycle(EXPORT_DIR, now_utc)
    except ExportNotReadyError as e:
        logger.warning(f"{e} -- waiting {RETRY_WAIT_SEC}s and retrying once")
        time.sleep(RETRY_WAIT_SEC)
        try:
            rows = compute_cycle(EXPORT_DIR, datetime.now(timezone.utc))
        except ExportNotReadyError as e2:
            logger.error(f"Still not ready after retry: {e2} -- skipping this cycle")
            rows = []

    stored = store_rows(conn, rows)
    if rows:
        logger.info(f"Computed {len(rows)} index value(s), {stored} new this cycle")
    push_indices(session, conn)


def main() -> None:
    logger.info("DavinTrade Currency & Gold Index Engine (Lane 4) starting")
    logger.info(f"Export dir: {EXPORT_DIR} | DB: {DB_PATH} | Gateway: {API_GATEWAY_URL}")
    conn = open_db()
    session = create_http_session()

    last_trigger_min = -1
    try:
        while not shutdown_requested:
            now = datetime.now(timezone.utc)
            if (now.second == CYCLE_TRIGGER_SECOND
                    and now.minute % CYCLE_TRIGGER_MINUTE_STEP == 0
                    and now.minute != last_trigger_min):
                last_trigger_min = now.minute
                try:
                    run_cycle(session, conn)
                except Exception as e:                          # noqa: BLE001
                    logger.error(f"Cycle failed: {e}", exc_info=True)
            time.sleep(1)
    finally:
        conn.close()
        logger.info("Shutdown complete")


if __name__ == '__main__':
    main()
