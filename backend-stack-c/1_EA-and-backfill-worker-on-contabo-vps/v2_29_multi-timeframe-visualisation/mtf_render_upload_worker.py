"""Render the multi-timeframe charts and publish them to Cloudflare R2.

Runs on the Contabo VPS as the ``MT5Renderer`` NSSM service, alongside
``MT5Collector`` and ``MT5PushWorker``. Follows the same shape as the push
worker: a long-running loop with a sleep, not a scheduled one-shot, so NSSM's
restart-on-exit policy is the only supervision needed.

Every cycle it:

  1. renders BOTH variants from one read of ``xauusd.db``,
  2. uploads them to a PRIVATE R2 bucket, and
  3. prunes objects older than the retention window.

Two properties are deliberate:

**Read-only with respect to the pipeline.** This process opens ``xauusd.db``
to render and never writes to it -- it must never touch ``synced_at`` or any
collector state. A rendering failure is allowed to lose a picture; it is never
allowed to affect price ingestion. Same isolation rule the statistics lane
follows.

**Both variants come from one snapshot.** ``--both-variants`` renders the pair
in a single invocation, so the ``overlay`` and ``standard`` images can never
depict two different reads five minutes apart.

The bucket is private on purpose: object names are deterministic, so a public
bucket would make the download route's PRO gate cosmetic. The app mints
short-lived presigned URLs instead.

Environment (set via ``nssm set MT5Renderer AppEnvironmentExtra``):

    R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
    MTF_DB_PATH             path to xauusd.db
    RENDER_INTERVAL_SEC     default 300 (matches the M5 cadence)
    RENDER_RETENTION_HOURS  default 48 (Stack D V2 section 9)
    RENDER_OVERLAYS         default best_fit_a
"""

from __future__ import annotations

import logging
import os
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    import boto3
    from botocore.config import Config as BotoConfig
except ImportError:  # pragma: no cover - surfaced at service start
    print(
        "boto3 is required: pip install boto3",
        file=sys.stderr,
    )
    raise

R2_ACCOUNT_ID = os.environ.get('R2_ACCOUNT_ID', '')
R2_ACCESS_KEY_ID = os.environ.get('R2_ACCESS_KEY_ID', '')
R2_SECRET_ACCESS_KEY = os.environ.get('R2_SECRET_ACCESS_KEY', '')
R2_BUCKET = os.environ.get('R2_BUCKET', 'davintrade-renders')

DB_PATH = os.environ.get('MTF_DB_PATH', r'C:\Scripts\data\xauusd.db')
RENDER_INTERVAL_SEC = int(os.environ.get('RENDER_INTERVAL_SEC', '300'))
RETENTION_HOURS = int(os.environ.get('RENDER_RETENTION_HOURS', '48'))
OVERLAYS = os.environ.get('RENDER_OVERLAYS', 'best_fit_a')

# Must match lib/storage/chart-keys.ts's chartObjectKey(). A test pins the
# monolith side against the renderer's filenames; this prefix is the third
# place the name appears, so keep all three in step.
KEY_PREFIX = 'xauusd'
OUT_STEM = 'mtf_render_xauusd_m5_m15'
VARIANTS = ('overlay', 'standard')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',
)
logger = logging.getLogger('mtf_render_upload')


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


def render_both(out_dir: Path) -> dict[str, Path]:
    """Render both variants from ONE read of the database."""
    stem = out_dir / f'{OUT_STEM}.png'
    subprocess.run(
        [
            sys.executable,
            '-m',
            'mtf_render',
            '--db',
            DB_PATH,
            '--overlays',
            OVERLAYS,
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
        if not path.exists():
            raise FileNotFoundError(f'renderer did not produce {path.name}')
        rendered[variant] = path
    return rendered


def upload(client, rendered: dict[str, Path]) -> None:
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
            },
        )
        logger.info('uploaded %s (%d bytes)', key, path.stat().st_size)


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


def run_cycle(client) -> None:
    with tempfile.TemporaryDirectory(prefix='mtf_render_') as tmp:
        rendered = render_both(Path(tmp))
        upload(client, rendered)
    prune(client)


def main() -> int:
    logger.info('MT5Renderer starting')
    logger.info('   db:       %s', DB_PATH)
    logger.info('   bucket:   %s (private)', R2_BUCKET)
    logger.info('   overlays: %s', OVERLAYS)
    logger.info('   interval: %ds, retention: %dh', RENDER_INTERVAL_SEC, RETENTION_HOURS)

    try:
        client = make_client()
    except Exception as exc:
        logger.error('cannot start: %s', exc)
        return 1

    while True:
        started = time.time()
        try:
            run_cycle(client)
        except subprocess.CalledProcessError as exc:
            # The renderer's own stderr is the useful part here.
            logger.error('render failed (exit %s): %s', exc.returncode, exc.stderr)
        except Exception as exc:
            # Never exit the loop on a cycle failure: a lost picture must not
            # take the service down, and NSSM restarting would not help anyway.
            logger.error('cycle failed: %s', exc)

        elapsed = time.time() - started
        time.sleep(max(1.0, RENDER_INTERVAL_SEC - elapsed))


if __name__ == '__main__':
    raise SystemExit(main())
