"""Render the multi-timeframe charts and publish them to Cloudflare R2.

Runs on the Contabo VPS as the ``MT5Renderer`` NSSM service, alongside
``MT5Collector`` and ``MT5PushWorker``. Follows the same shape as the push
worker: a long-running loop, not a scheduled one-shot, so NSSM's restart-on-exit
policy is the only supervision needed.

Driven by the CYCLE, not by the clock (rule 8, ADR-014). It polls ``xauusd.db``
for the newest validated M5 cycle and renders when a slot appears that it has not
rendered yet. The collector promotes a cycle's rows into ``market_data`` BEFORE it
marks the cycle ``validated``, so a validated slot always has its data in place.
Each image is drawn AS OF that slot and stamped with it: in its title and in the
R2 object metadata (see ``mtf_render/stamp.py``), so a picture from another slot
can be recognised and kept out of a prompt.

For every new slot it:

  1. resolves the active indicator of each timeframe from the gateway, for THAT
     slot (``GET /api/v1/cycles/current?slot=S``), falling back to ``RENDER_OVERLAYS``
     when the gateway cannot say;
  2. renders BOTH variants from one read of ``xauusd.db`` into a temporary
     directory and checks every file is a complete PNG;
  3. only then uploads them, with the stamp as object metadata; and
  4. prunes objects older than the retention window.

Three properties are deliberate:

**The last good image is kept.** Nothing is uploaded unless every variant was
rendered and verified. A failed render, a missing or truncated file, a slow
gateway: the objects already in R2 stay exactly as they were, and the next poll
tries again. (Uploads overwrite a fixed key, and an S3 PUT is atomic, so even a
failed upload leaves the previous object whole.)

**Read-only with respect to the pipeline.** This process opens ``xauusd.db``
read-only and never writes to it -- it must never touch ``synced_at`` or any
collector state. A rendering failure is allowed to lose a picture; it is never
allowed to affect price ingestion.

**Both variants come from one snapshot, as of one slot.** The renderer draws the
pair in a single invocation, with no bar newer than the slot, so the ``overlay``
and ``standard`` images can never depict two different moments.

The bucket is private on purpose: object names are deterministic, so a public
bucket would make the download route's PRO gate cosmetic. The app mints
short-lived presigned URLs instead.

Environment (set via ``nssm set MT5Renderer AppEnvironmentExtra``):

    R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
    MTF_DB_PATH             path to xauusd.db
    API_GATEWAY_URL         the gateway's base URL (same value as MT5PushWorker's)
    BACKFILL_API_KEY        a gateway API key (same as MT5PushWorker's); API_KEY is also read
    RENDER_OVERLAYS         default best_fit_a: used for BOTH timeframes when the gateway
                            is unconfigured or cannot answer
    RENDER_POLL_SEC         default 10: how often to look for a new validated slot
    RENDER_RETRY_SEC        default 30: wait before retrying a slot whose render failed
    RENDER_GATEWAY_TIMEOUT_SEC  default 5
    RENDER_RETENTION_HOURS  default 48 (Stack D V2 section 9)

``RENDER_INTERVAL_SEC`` (the old fixed 300 s sleep) is no longer read.
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable, Optional

try:
    import boto3
    from botocore.config import Config as BotoConfig
except ImportError:  # pragma: no cover - surfaced at service start
    print(
        "boto3 is required: pip install boto3",
        file=sys.stderr,
    )
    raise

from mtf_render.overlays import OVERLAY_KEYS
from mtf_render.stamp import VARIANTS, RenderStamp, normalize_overlays

R2_ACCOUNT_ID = os.environ.get('R2_ACCOUNT_ID', '')
R2_ACCESS_KEY_ID = os.environ.get('R2_ACCESS_KEY_ID', '')
R2_SECRET_ACCESS_KEY = os.environ.get('R2_SECRET_ACCESS_KEY', '')
R2_BUCKET = os.environ.get('R2_BUCKET', 'davintrade-renders')

DB_PATH = os.environ.get('MTF_DB_PATH', r'C:\Scripts\data\xauusd.db')
RETENTION_HOURS = int(os.environ.get('RENDER_RETENTION_HOURS', '48'))
OVERLAYS = os.environ.get('RENDER_OVERLAYS', 'best_fit_a')

# The gateway. The same two variables the push worker reads; unset or left at the
# push worker's placeholder values means "not configured" and the renderer uses
# RENDER_OVERLAYS.
API_GATEWAY_URL = os.environ.get('API_GATEWAY_URL', '')
GATEWAY_API_KEY = os.environ.get('BACKFILL_API_KEY') or os.environ.get('API_KEY', '')
GATEWAY_TIMEOUT_SEC = float(os.environ.get('RENDER_GATEWAY_TIMEOUT_SEC', '5'))

RENDER_POLL_SEC = int(os.environ.get('RENDER_POLL_SEC', '10'))
RENDER_RETRY_SEC = int(os.environ.get('RENDER_RETRY_SEC', '30'))

# Must match lib/storage/chart-keys.ts's chartObjectKey(). A test pins the
# monolith side against the renderer's filenames; this prefix is the third
# place the name appears, so keep all three in step.
KEY_PREFIX = 'xauusd'
OUT_STEM = 'mtf_render_xauusd_m5_m15'

# The push worker's placeholders: a value like these means nobody configured it.
_PLACEHOLDER_MARKERS = ('your-api.railway.app', 'your_api_key')

# The contract of GET /api/v1/cycles/current (railway-gateway).
GATEWAY_CONTRACT = 'cycles-current/1'

PNG_SIGNATURE = b'\x89PNG\r\n\x1a\n'
PNG_IEND = b'IEND\xaeB`\x82'
MIN_PNG_BYTES = 1024

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',
)
logger = logging.getLogger('mtf_render_upload')


class RenderError(RuntimeError):
    """A render that did not produce what the stamp promises. Nothing is uploaded."""


def object_key(variant: str) -> str:
    return f'{KEY_PREFIX}/{OUT_STEM}_{variant}.png'


def make_client():
    missing = [
        name
        for name, value in (
            ('R2_ACCOUNT_ID', R2_ACCOUNT_ID),
            ('R2_ACCESS_KEY_ID', R2_ACCESS_KEY_ID),
            ('R2_SECRET_ACCESS_KEY', R2_SECRET_ACCESS_KEY),
        )
        if not value
    ]
    if missing:
        raise RuntimeError(f'missing R2 credentials: {", ".join(missing)}')

    return boto3.client(
        's3',
        endpoint_url=f'https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com',
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        # R2 ignores region but botocore requires one.
        region_name='auto',
        config=BotoConfig(signature_version='s3v4', retries={'max_attempts': 3}),
    )


# --------------------------------------------------------------------- trigger

LATEST_VALIDATED_SQL = (
    "SELECT cycle_time FROM collection_cycles "
    "WHERE timeframe = 'M5' AND status = 'validated' "
    "ORDER BY cycle_time DESC LIMIT 1"
)


def latest_validated_slot(db_path: str) -> Optional[int]:
    """The slot of the newest validated M5 cycle, or None when there is none yet.

    Opens the database READ-ONLY (``mode=ro``): this process must never be able to
    write to the collector's database, not even by mistake.
    """
    uri = Path(db_path).resolve().as_uri() + '?mode=ro'
    conn = sqlite3.connect(uri, uri=True, timeout=5)
    try:
        row = conn.execute(LATEST_VALIDATED_SQL).fetchone()
    finally:
        conn.close()
    return None if row is None else int(row[0])


# ----------------------------------------------------------- active indicators


@dataclass(frozen=True)
class ChosenOverlays:
    """Which indicator each timeframe draws, and where that choice came from."""

    m5: str
    m15: str
    source: str  # 'setting' | 'default'


def default_overlays() -> ChosenOverlays:
    chosen = normalize_overlays(OVERLAYS)
    return ChosenOverlays(m5=chosen, m15=chosen, source='default')


def gateway_configured() -> bool:
    if not API_GATEWAY_URL or not GATEWAY_API_KEY:
        return False
    return not any(
        marker in API_GATEWAY_URL or marker in GATEWAY_API_KEY
        for marker in _PLACEHOLDER_MARKERS
    )


def fetch_active_indicators(
    slot: int,
    urlopen: Optional[Callable] = None,
) -> Optional[ChosenOverlays]:
    """The active indicator for each timeframe AT `slot`, or None when it cannot be known.

    Asks ``GET /api/v1/cycles/current?slot=<slot>``. The slot matters: the collector
    validates a slot about a minute before the gateway has it READY, so "the setting
    at the gateway's newest cycle" would be the PREVIOUS slot's, and a change that
    takes effect at this slot would reach the sensors a minute before the picture.

    Every way this can fail returns None (the caller falls back to RENDER_OVERLAYS and
    says so in the stamp): not configured, unreachable, a timeout, a non-200 answer,
    something that is not the contract, a timeframe with no setting, an indicator the
    renderer does not know, and an answer for a different slot (a gateway that predates
    the ``slot`` parameter ignores it and would otherwise be believed).
    """
    if not gateway_configured():
        logger.info('gateway not configured: using RENDER_OVERLAYS')
        return None

    # Looked up now, not bound at import: what is called is what is current.
    opener = urlopen if urlopen is not None else urllib.request.urlopen

    request = urllib.request.Request(
        f'{API_GATEWAY_URL.rstrip("/")}/api/v1/cycles/current?slot={int(slot)}',
        headers={
            'Authorization': f'Bearer {GATEWAY_API_KEY}',
            'Accept': 'application/json',
        },
        method='GET',
    )
    try:
        with opener(request, timeout=GATEWAY_TIMEOUT_SEC) as response:
            status = getattr(response, 'status', 200)
            body = response.read()
        if status != 200:
            logger.warning('gateway answered %s: using RENDER_OVERLAYS', status)
            return None
        data = json.loads(body)
    except urllib.error.HTTPError as exc:
        logger.warning('gateway answered %s: using RENDER_OVERLAYS', exc.code)
        return None
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        logger.warning('gateway unreachable (%s): using RENDER_OVERLAYS', exc)
        return None
    except (ValueError, TypeError) as exc:
        logger.warning('gateway answer is not JSON (%s): using RENDER_OVERLAYS', exc)
        return None

    try:
        if data['contract'] != GATEWAY_CONTRACT:
            logger.warning('gateway contract is %r: using RENDER_OVERLAYS', data['contract'])
            return None
        indicators = data['activeIndicators']
        if indicators['resolvedAtSlot'] != slot or indicators['basis'] != 'REQUESTED_SLOT':
            logger.warning(
                'gateway resolved the setting at slot %s (%s), not %s: it does not '
                'support ?slot= yet; using RENDER_OVERLAYS',
                indicators['resolvedAtSlot'],
                indicators['basis'],
                slot,
            )
            return None
        chosen = {}
        for timeframe in ('M5', 'M15'):
            record = indicators['byTimeframe'][timeframe]
            if record is None:
                logger.warning('gateway has no active indicator for %s: using RENDER_OVERLAYS', timeframe)
                return None
            source = record['source']
            if source not in OVERLAY_KEYS:
                logger.warning('gateway names an indicator the renderer does not know (%r)', source)
                return None
            chosen[timeframe] = source
    except (KeyError, TypeError) as exc:
        logger.warning('gateway answer is not the contract (%s): using RENDER_OVERLAYS', exc)
        return None

    return ChosenOverlays(m5=chosen['M5'], m15=chosen['M15'], source='setting')


def choose_overlays(slot: int) -> ChosenOverlays:
    """The setting's indicators for the slot when the gateway can say, else the default."""
    return fetch_active_indicators(slot) or default_overlays()


# ------------------------------------------------------------------- rendering


def build_stamps(
    slot: int, overlays: ChosenOverlays, rendered_at: int
) -> dict[str, RenderStamp]:
    return {
        variant: RenderStamp(
            slot=slot,
            variant=variant,
            overlay_m5=overlays.m5,
            overlay_m15=overlays.m15,
            overlay_source=overlays.source,
            rendered_at=rendered_at,
        )
        for variant in VARIANTS
    }


def verify_png(path: Path) -> None:
    """Raise RenderError unless the file is a complete PNG (signature and IEND trailer)."""
    if not path.exists():
        raise RenderError(f'renderer did not produce {path.name}')
    data = path.read_bytes()
    if len(data) < MIN_PNG_BYTES:
        raise RenderError(f'{path.name} is only {len(data)} bytes: not a chart')
    if not data.startswith(PNG_SIGNATURE):
        raise RenderError(f'{path.name} is not a PNG')
    if not data.endswith(PNG_IEND):
        raise RenderError(f'{path.name} is truncated (no PNG end marker)')


def render_both(
    out_dir: Path,
    slot: int,
    overlays: ChosenOverlays,
    rendered_at: int,
) -> dict[str, Path]:
    """Render both variants from ONE read of the database, as of `slot`.

    Raises (CalledProcessError, FileNotFoundError, RenderError) unless EVERY variant
    exists and is a complete PNG; the caller uploads nothing in that case.
    """
    stem = out_dir / f'{OUT_STEM}.png'
    subprocess.run(
        [
            sys.executable,
            '-m',
            'mtf_render',
            '--db',
            DB_PATH,
            '--overlays',
            overlays.m5,
            '--m5-overlays',
            overlays.m5,
            '--m15-overlays',
            overlays.m15,
            '--slot',
            str(slot),
            '--overlay-source',
            overlays.source,
            '--rendered-at',
            str(rendered_at),
            '--both-variants',
            '--out',
            str(stem),
        ],
        cwd=str(Path(__file__).resolve().parent),
        check=True,
        capture_output=True,
        text=True,
    )

    rendered: dict[str, Path] = {}
    for variant in VARIANTS:
        path = out_dir / f'{OUT_STEM}_{variant}.png'
        verify_png(path)
        rendered[variant] = path
    return rendered


# ---------------------------------------------------------------------- upload


def upload(client, rendered: dict[str, Path], stamps: dict[str, RenderStamp]) -> None:
    for variant, path in rendered.items():
        key = object_key(variant)
        client.upload_file(
            str(path),
            R2_BUCKET,
            key,
            ExtraArgs={
                'ContentType': 'image/png',
                # No public-read ACL, deliberately. Access is only ever via a
                # presigned URL minted by the tier-gated download route.
                'CacheControl': 'no-store',
                # The stamp: which cycle this image is for (rule 8). The
                # monolith reads it back with HeadObject, so a download can say
                # what it is and a prompt can refuse an image from another slot.
                'Metadata': stamps[variant].object_metadata(),
            },
        )
        logger.info(
            'uploaded %s (%d bytes) slot %d, overlay M5 %s / M15 %s (%s)',
            key,
            path.stat().st_size,
            stamps[variant].slot,
            stamps[variant].overlay_m5,
            stamps[variant].overlay_m15,
            stamps[variant].overlay_source,
        )


def prune(client) -> int:
    """Delete objects older than the retention window. Returns the count."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=RETENTION_HOURS)
    current = {object_key(v) for v in VARIANTS}
    deleted = 0

    paginator = client.get_paginator('list_objects_v2')
    for page in paginator.paginate(Bucket=R2_BUCKET, Prefix=f'{KEY_PREFIX}/'):
        for obj in page.get('Contents', []):
            # Never prune the keys just written, whatever the clock says.
            if obj['Key'] in current:
                continue
            if obj['LastModified'] < cutoff:
                client.delete_object(Bucket=R2_BUCKET, Key=obj['Key'])
                deleted += 1

    if deleted:
        logger.info('pruned %d object(s) older than %dh', deleted, RETENTION_HOURS)
    return deleted


# ------------------------------------------------------------------------ loop


@dataclass
class RenderState:
    """What the loop remembers. In memory on purpose: a restart renders the newest slot once."""

    last_rendered_slot: Optional[int] = None
    failed_slot: Optional[int] = None
    failed_at: float = 0.0


def publish_slot(
    client,
    slot: int,
    now: Callable[[], float] = time.time,
    choose: Callable[[int], ChosenOverlays] = choose_overlays,
    render: Callable[..., dict[str, Path]] = render_both,
) -> None:
    """Render slot `slot` and publish it. Uploads happen ONLY after a verified render."""
    overlays = choose(slot)
    rendered_at = int(now())
    stamps = build_stamps(slot, overlays, rendered_at)
    with tempfile.TemporaryDirectory(prefix='mtf_render_') as tmp:
        rendered = render(Path(tmp), slot, overlays, rendered_at)
        # Belt and braces behind render_both's own checks, and the guard for any
        # replacement renderer: every variant present and complete, or no upload.
        if set(rendered) != set(VARIANTS):
            raise RenderError(f'expected variants {VARIANTS}, got {sorted(rendered)}')
        for path in rendered.values():
            verify_png(path)
        upload(client, rendered, stamps)
    # The new pair is already published. Housekeeping failing now must not make the
    # loop treat the slot as failed and draw and upload the same pair again.
    try:
        prune(client)
    except Exception as exc:
        logger.warning('slot %d published, but pruning old objects failed: %s', slot, exc)


def poll_once(
    client,
    state: RenderState,
    now: Callable[[], float] = time.time,
    latest: Callable[[str], Optional[int]] = latest_validated_slot,
    publish: Callable[..., None] = publish_slot,
) -> str:
    """One look at the database. Returns what happened, for the log and the tests:

    ``no-cycle``  no validated M5 cycle yet
    ``idle``      the newest validated slot has been rendered already
    ``backoff``   its render failed a moment ago; waiting before trying again
    ``rendered``  a new slot was rendered, stamped and uploaded
    ``failed``    the render or the upload failed; the objects in R2 are untouched
    ``db-error``  the database could not be read
    """
    try:
        slot = latest(DB_PATH)
    except Exception as exc:  # a locked or missing database must not stop the service
        logger.error('cannot read %s: %s', DB_PATH, exc)
        return 'db-error'

    if slot is None:
        return 'no-cycle'
    if state.last_rendered_slot is not None and slot <= state.last_rendered_slot:
        return 'idle'
    if state.failed_slot == slot and now() - state.failed_at < RENDER_RETRY_SEC:
        return 'backoff'

    try:
        publish(client, slot)
    except subprocess.CalledProcessError as exc:
        # The renderer's own stderr is the useful part here.
        logger.error('render of slot %d failed (exit %s): %s', slot, exc.returncode, exc.stderr)
    except Exception as exc:
        # Never exit the loop on a cycle failure: a lost picture must not
        # take the service down, and NSSM restarting would not help anyway.
        logger.error('slot %d failed, the last good image is kept: %s', slot, exc)
    else:
        state.last_rendered_slot = slot
        state.failed_slot = None
        return 'rendered'

    state.failed_slot = slot
    state.failed_at = now()
    return 'failed'


def main() -> int:
    logger.info('MT5Renderer starting')
    logger.info('   db:       %s', DB_PATH)
    logger.info('   bucket:   %s (private)', R2_BUCKET)
    logger.info('   overlays: %s (default; the gateway decides when it can)', OVERLAYS)
    logger.info(
        '   gateway:  %s',
        API_GATEWAY_URL if gateway_configured() else 'not configured (using the default overlays)',
    )
    logger.info('   poll:     every %ds, retry %ds, retention %dh', RENDER_POLL_SEC, RENDER_RETRY_SEC, RETENTION_HOURS)

    try:
        client = make_client()
    except Exception as exc:
        logger.error('cannot start: %s', exc)
        return 1

    state = RenderState()
    while True:
        poll_once(client, state)
        time.sleep(RENDER_POLL_SEC)


if __name__ == '__main__':
    raise SystemExit(main())
