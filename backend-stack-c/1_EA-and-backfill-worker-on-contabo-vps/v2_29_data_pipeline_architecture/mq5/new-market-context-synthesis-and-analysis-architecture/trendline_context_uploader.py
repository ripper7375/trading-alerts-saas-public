#!/usr/bin/env python3
"""Ship TrendlineScreenshotAndLabelExport_v2_29.mq5's output off the VPS.

Watches the terminal's MQL5\\Files folder for new ``*.png.tsv`` sidecar
files, and for each one:

  1. Parses the sidecar into the Layer-1 JSON shape the gateway's
     POST /api/v1/trendline-context/policy expects
     (TRENDLINE-CONTEXT-BLUEPRINT.md section 3 and 5) and POSTs it, with the
     SAME auth header scheme backfill_worker_api_gateway_v5.py already uses
     against this gateway (``Authorization: Bearer <BACKFILL_API_KEY>``).
     A session whose (symbol, published_at) the gateway has already seen
     comes back as an accepted duplicate -- deliberate: every periodic
     capture between two Publishes carries the SAME published_at, so only
     the first upload after a Publish actually creates a new row; the rest
     are harmless repeats, exactly like a retry.
  2. Uploads the matching ``.png`` straight to Cloudflare R2, the same way
     ``mtf_render_upload_worker.py`` already does for the cycle-rendered
     charts (direct S3-compatible PUT, no file ever passes through the
     gateway's small-body JSON routes -- that gateway keeps every route
     under Express's ~100 KB limit on purpose; a 1920x1080 PNG is far
     larger than that).

Runs as a long-lived loop (an NSSM service, alongside MT5Collector,
MT5PushWorker and MT5Renderer), not a scheduled one-shot: DATA-PIPELINE-
ARCHITECTURE.md section 3 has the full picture of where this sits.

State: a small local JSON file remembers the newest sidecar filename
already handled, per (symbol, timeframe), so a restart does not re-walk the
whole folder -- the same shape of problem the collector's own `synced_at`
tracking solves, at this script's much smaller scale.

Environment:
    TL_EXPORT_DIR            folder to watch, default C:\\MT5\\MQL5\\Files
                              (DEFAULT_EXPORT_DIR in export_collector_validator_v2.py)
    TL_STATE_PATH             where the "already handled" marker file lives,
                              default <TL_EXPORT_DIR>\\trendline_uploader_state.json
    API_GATEWAY_URL           the gateway's base URL (same value as the push worker's)
    BACKFILL_API_KEY          a gateway API key (same as the push worker's); API_KEY also read
    R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY   as mtf_render_upload_worker.py
    R2_BUCKET                 default 'davintrade-renders' (same bucket, a different key prefix)
    TL_POLL_SEC               how often to look for new sidecars, default 30
    TL_GATEWAY_TIMEOUT_SEC    default 10
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Optional

try:
    import requests
except ImportError:  # pragma: no cover - surfaced at service start
    print("requests is required: pip install requests", file=sys.stderr)
    raise

try:
    import boto3
    from botocore.config import Config as BotoConfig
except ImportError:  # pragma: no cover - surfaced at service start
    print("boto3 is required: pip install boto3", file=sys.stderr)
    raise

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("trendline_context_uploader")

EXPORT_DIR = Path(os.environ.get("TL_EXPORT_DIR", r"C:\MT5\MQL5\Files"))
STATE_PATH = Path(
    os.environ.get("TL_STATE_PATH", str(EXPORT_DIR / "trendline_uploader_state.json"))
)

API_GATEWAY_URL = os.environ.get("API_GATEWAY_URL", "").rstrip("/")
API_KEY = os.environ.get("BACKFILL_API_KEY", os.environ.get("API_KEY", "your_api_key_here"))
GATEWAY_TIMEOUT_SEC = int(os.environ.get("TL_GATEWAY_TIMEOUT_SEC", "10"))

R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID", "")
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID", "")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY", "")
R2_BUCKET = os.environ.get("R2_BUCKET", "davintrade-renders")
R2_KEY_PREFIX = "trendline-context"  # object key: trendline-context/<filename>.png

POLL_SEC = int(os.environ.get("TL_POLL_SEC", "30"))

SIDECAR_SUFFIX = ".png.tsv"


# ---------------------------------------------------------------- HTTP session (gateway)

def make_session() -> "requests.Session":
    session = requests.Session()
    session.headers.update(
        {
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
        }
    )
    return session


# ---------------------------------------------------------------- R2 client

def make_r2_client():
    missing = [
        name
        for name, value in (
            ("R2_ACCOUNT_ID", R2_ACCOUNT_ID),
            ("R2_ACCESS_KEY_ID", R2_ACCESS_KEY_ID),
            ("R2_SECRET_ACCESS_KEY", R2_SECRET_ACCESS_KEY),
        )
        if not value
    ]
    if missing:
        raise RuntimeError(f"R2 upload not configured: missing {', '.join(missing)}")

    return boto3.client(
        "s3",
        endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name="auto",  # R2 ignores the region but botocore requires one.
        config=BotoConfig(signature_version="s3v4", retries={"max_attempts": 3}),
    )


# ---------------------------------------------------------------- sidecar parsing

class SidecarParseError(Exception):
    pass


def parse_sidecar(path: Path) -> dict:
    """Turn one *.png.tsv file into the gateway's TrendlinePolicySessionDto shape.

    The file-level block (key<TAB>value, one per line) comes first, then a
    header row and one row per detected line -- the exact format
    TrendlineScreenshotAndLabelExport_v2_29.mq5's WriteSidecar() writes
    (TRENDLINE-CONTEXT-BLUEPRINT.md section 3). Any cell the MQL5 side could
    not sanitise (it already turns an embedded tab/CR/LF into a space, see
    TLU_TsvSafe in TrendlineLabelUtils.mqh) is trusted as single-line here.
    """
    text = path.read_text(encoding="ascii", errors="replace")
    lines = text.splitlines()

    meta: dict[str, str] = {}
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("slot\tslot_key\t"):
            break
        if "\t" not in line:
            i += 1
            continue
        key, _, value = line.partition("\t")
        meta[key] = value
        i += 1
    else:
        raise SidecarParseError(f"{path}: no line-row header found")

    header_cols = lines[i].split("\t")
    expected = [
        "slot", "slot_key", "source_timeframe", "name", "value",
        "anchor1_time", "anchor1_price", "anchor2_time", "anchor2_price",
        "ray_extends", "label",
    ]
    if header_cols != expected:
        raise SidecarParseError(f"{path}: unexpected row header {header_cols!r}")

    required_meta = ("symbol", "timeframe", "captured_at_utc", "session_published_at_utc")
    for key in required_meta:
        if key not in meta:
            raise SidecarParseError(f"{path}: missing '{key}' in the file-level block")

    published_at_raw = meta.get("session_published_at_utc", "")
    if published_at_raw == "":
        # Never published yet (the analyst has not clicked Publish on this
        # chart). Nothing to send: Layer 1 only exists from a real Publish.
        return {}

    lines_out = []
    for row_line in lines[i + 1 :]:
        if row_line == "":
            continue
        cols = row_line.split("\t")
        if len(cols) != len(expected):
            raise SidecarParseError(f"{path}: row has {len(cols)} columns, expected {len(expected)}: {row_line!r}")
        row = dict(zip(expected, cols))
        lines_out.append(
            {
                "slot_key": row["slot_key"],
                "slot": int(row["slot"]),
                "source_timeframe": row["source_timeframe"],
                "anchor1_time": int(row["anchor1_time"]),
                "anchor1_price": float(row["anchor1_price"]),
                "anchor2_time": int(row["anchor2_time"]),
                "anchor2_price": float(row["anchor2_price"]),
                "ray_extends": row["ray_extends"] == "1",
                # label_raw / role / bias_hint / note / parse_method: see the
                # "NOT YET WIRED" note in __main__ -- this uploader ships the
                # label text as-is; the Blueprint §4.4 rule/model parser that
                # turns it into role/bias_hint/parse_method is separate,
                # not-yet-built work. Shipping with role=OTHER and
                # parse_method=manual keeps every row valid against the
                # gateway's contract in the meantime, never silently guesses
                # a role the analyst did not assert.
                "label_raw": row["label"],
                "role": "OTHER",
                "parse_method": "manual",
            }
        )

    source_charts = sorted({row["source_timeframe"] for row in lines_out}) or [meta["timeframe"]]

    return {
        "symbol": meta["symbol"],
        "published_at": int(published_at_raw),
        "overview_note": meta.get("session_overview") or None,
        "regime_hint": None,  # Blueprint §4.4 parser territory, not this uploader's job
        "source_charts": source_charts,
        "lines": lines_out,
    }


# ---------------------------------------------------------------- state (what was already handled)

def load_state() -> dict:
    if STATE_PATH.exists():
        try:
            return json.loads(STATE_PATH.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            logger.warning("state file unreadable (%s), starting fresh", exc)
    return {}


def save_state(state: dict) -> None:
    tmp = STATE_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2, sort_keys=True), encoding="utf-8")
    tmp.replace(STATE_PATH)


# ---------------------------------------------------------------- one pass

def process_one(session: "requests.Session", r2, sidecar_path: Path) -> bool:
    """Returns True on full success (gateway POST and R2 PUT both ok)."""
    png_path = sidecar_path.with_suffix("")  # "<name>.png.tsv" -> "<name>.png"
    if not png_path.exists():
        logger.warning("sidecar %s has no matching PNG (%s) -- skipped", sidecar_path.name, png_path.name)
        return False

    try:
        payload = parse_sidecar(sidecar_path)
    except SidecarParseError as exc:
        logger.error("parse failed for %s: %s", sidecar_path.name, exc)
        return False

    if not payload:
        logger.info("%s: never published yet -- PNG only, no policy POST", sidecar_path.name)
    elif not API_GATEWAY_URL:
        logger.warning("API_GATEWAY_URL not set -- skipping the policy POST for %s", sidecar_path.name)
    else:
        url = f"{API_GATEWAY_URL}/api/v1/trendline-context/policy"
        try:
            resp = session.post(url, json=payload, timeout=GATEWAY_TIMEOUT_SEC)
        except requests.RequestException as exc:
            logger.error("gateway POST failed for %s: %s", sidecar_path.name, exc)
            return False
        if resp.status_code == 401:
            logger.error("CRITICAL: authentication failed (check BACKFILL_API_KEY)")
            return False
        if resp.status_code >= 400:
            logger.error("gateway refused %s: %s %s", sidecar_path.name, resp.status_code, resp.text[:500])
            return False
        logger.info("policy POST ok for %s -> %s", sidecar_path.name, resp.status_code)

    try:
        r2.upload_file(
            str(png_path),
            R2_BUCKET,
            f"{R2_KEY_PREFIX}/{png_path.name}",
            ExtraArgs={"ContentType": "image/png"},  # no public-read ACL, deliberately
        )
    except Exception as exc:  # noqa: BLE001 - any boto3/network error, logged and retried next poll
        logger.error("R2 upload failed for %s: %s", png_path.name, exc)
        return False

    return True


def run_once(session: "requests.Session", r2, state: dict) -> dict:
    sidecars = sorted(EXPORT_DIR.glob(f"*{SIDECAR_SUFFIX}"))
    for sidecar_path in sidecars:
        key = sidecar_path.name.rsplit("_", 1)[0]  # strip the trailing _<yyyymmdd_hhmm>.png.tsv stamp
        last_done = state.get(key, "")
        if sidecar_path.name <= last_done:
            continue  # already handled (filenames sort lexicographically = chronologically)

        ok = process_one(session, r2, sidecar_path)
        if ok:
            state[key] = sidecar_path.name
    return state


def main() -> None:
    if "your_api_key" in API_KEY or len(API_KEY) < 20:
        logger.error("CRITICAL: configure BACKFILL_API_KEY before running this service")
    if not EXPORT_DIR.exists():
        logger.error("CRITICAL: TL_EXPORT_DIR does not exist: %s", EXPORT_DIR)
        sys.exit(1)

    session = make_session()
    r2 = make_r2_client()
    state = load_state()

    logger.info(
        "trendline_context_uploader starting: watching %s every %ss, gateway=%s, bucket=%s",
        EXPORT_DIR, POLL_SEC, API_GATEWAY_URL or "(unset)", R2_BUCKET,
    )

    while True:
        try:
            state = run_once(session, r2, state)
            save_state(state)
        except Exception:  # noqa: BLE001 - a long-lived service must never crash-loop on one bad file
            logger.exception("unexpected error in run_once(); continuing")
        time.sleep(POLL_SEC)


if __name__ == "__main__":
    main()
