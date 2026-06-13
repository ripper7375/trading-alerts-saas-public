#!/usr/bin/env python3
"""
replay_quarantine.py — re-POST gateway-rejected rows after a fix.

The push worker (backfill_worker_api_gateway_v5.py) quarantines every HTTP-400
row to rejected_rows.jsonl and stamps market_data.synced_at so the poison row
can't block the outbox. Once the gateway-side validation bug (or the data) is
fixed, this tool replays the quarantined rows.

Each JSONL line: {"quarantined_at","gateway_error","row":{...market_data...}}.
On a 200/201 the line is dropped from the file; rows that still fail stay
(rewritten back), so re-running is safe and idempotent.

Usage:
  python3 replay_quarantine.py                         # replay default file
  python3 replay_quarantine.py --file C:/Scripts/database/rejected_rows.jsonl
  python3 replay_quarantine.py --dry-run               # show, don't POST
  BACKFILL_API_KEY=... API_GATEWAY_URL=... python3 replay_quarantine.py
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

import requests

API_GATEWAY_URL = os.environ.get('API_GATEWAY_URL', 'https://your-api.railway.app')
API_KEY = os.environ.get('BACKFILL_API_KEY', 'your_api_key_here')
DEFAULT_FILE = Path('C:/Scripts/database/rejected_rows.jsonl')
HTTP_TIMEOUT_SEC = 8
INTER_ROW_DELAY_SEC = 0.05


def main():
    ap = argparse.ArgumentParser(description='Replay quarantined (HTTP-400) market_data rows')
    ap.add_argument('--file', default=str(DEFAULT_FILE))
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    path = Path(args.file)
    if not path.exists():
        print(f"No quarantine file at {path} — nothing to replay.")
        return 0

    lines = [ln for ln in path.read_text(encoding='utf-8').splitlines() if ln.strip()]
    if not lines:
        print("Quarantine file is empty — nothing to replay.")
        return 0

    if 'your-api' in API_GATEWAY_URL or 'your_api_key' in API_KEY:
        print("ERROR: set API_GATEWAY_URL and BACKFILL_API_KEY env vars first.")
        return 1

    session = requests.Session()
    session.headers.update({'Authorization': f'Bearer {API_KEY}',
                            'Content-Type': 'application/json',
                            'X-Terminal-ID': 'quarantine_replay'})

    replayed = 0
    still_failed = []
    for ln in lines:
        try:
            rec = json.loads(ln)
            row = rec['row']
        except (json.JSONDecodeError, KeyError) as e:
            print(f"Skipping unparseable line ({e})")
            still_failed.append(ln)
            continue

        if args.dry_run:
            print(f"[dry-run] would POST {row.get('symbol')} {row.get('timeframe')} {row.get('timestamp')}")
            still_failed.append(ln)
            continue

        try:
            resp = session.post(f'{API_GATEWAY_URL}/api/v1/market-data', json=row, timeout=HTTP_TIMEOUT_SEC)
        except requests.RequestException as e:
            print(f"Network error, keeping row: {e}")
            still_failed.append(ln)
            continue

        if resp.status_code in (200, 201):
            replayed += 1
        else:
            try:
                msg = resp.json().get('message', '')
            except (json.JSONDecodeError, ValueError):
                msg = resp.text[:160]
            print(f"Still rejected ({resp.status_code}) {row.get('timestamp')}/{row.get('timeframe')}: {msg}")
            still_failed.append(ln)
        time.sleep(INTER_ROW_DELAY_SEC)

    if not args.dry_run:
        if still_failed:
            path.write_text('\n'.join(still_failed) + '\n', encoding='utf-8')
        else:
            path.unlink()  # all cleared
        print(f"\nReplayed {replayed}; {len(still_failed)} still quarantined "
              f"{'(file removed)' if not still_failed else f'(kept in {path.name})'}.")
    return 0


if __name__ == '__main__':
    sys.exit(main())
