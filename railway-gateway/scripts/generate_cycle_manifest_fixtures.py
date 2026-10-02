"""Generate the cycle-manifest fixtures for the gateway's specs.

    PYTHONIOENCODING=utf-8 python scripts/generate_cycle_manifest_fixtures.py

Writes into test/fixtures/:

  cycle-manifest-refresh-slot.json   a slot where M5 and M15 refresh (M5 needed two attempts)
  cycle-manifest-plain-slot.json     an M5-only slot
  cycle-manifest-closed-newest.json  newest row already closed, one quarantined M5 row
  cycle-manifest-validation-corpus.json
                                     valid and broken manifests, each with the verdict of
                                     Python's own jsonschema against the Stack C contract

WHY IT EXISTS. The gateway validates what the VPS sender produces. A manifest
written by hand in a TypeScript test proves the gateway accepts what its author
imagined; one produced by the real sender (build_manifest, over a full 3,000-bar
world built the way the collector leaves the database) proves it accepts what the
VPS will actually send. The corpus does the same for the validator: the gateway
runs the contract through Ajv, and the corpus pins Ajv's verdict to jsonschema's
on every case, so a keyword the two read differently cannot hide.

Needs Python 3 and the `jsonschema` package; it is a dev tool, not run in CI.
Re-run it after a change to the contract or to build_manifest, then Prettier.
"""
import copy
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
STACK_C = (REPO / 'backend-stack-c' / '1_EA-and-backfill-worker-on-contabo-vps'
           / 'v2_29_data_pipeline_architecture')
OUT = HERE.parent / 'test' / 'fixtures'
sys.path.insert(0, str(STACK_C))

import jsonschema  # noqa: E402

from cycle_test_support import (  # noqa: E402
    SLOT_PLAIN, SLOT_REFRESH, build_world, isolated_worker, worker)

CONTRACT = json.loads((STACK_C / 'gateway_contract_cycle_manifest.schema.json').read_text(encoding='utf-8'))
VALIDATOR = jsonschema.Draft202012Validator(CONTRACT)


def write(name, payload):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(json.dumps(payload, indent=1, sort_keys=True) + '\n', encoding='utf-8', newline='\n')
    print('wrote', name)


def manifest_of(slot, quarantined=None, **world):
    conn, _info = build_world(slot, **world)
    for (tf, count) in (quarantined or {}).items():
        worker._priority_quarantined[(slot, tf)] = count
    built = worker.build_manifest(conn, slot, slot + 60)
    assert built is not None
    return built


def edit(manifest, path, value=None, delete=False):
    m = copy.deepcopy(manifest)
    node = m
    for part in path[:-1]:
        node = node[part]
    if delete:
        del node[path[-1]]
    else:
        node[path[-1]] = value
    return m


def corpus(good):
    """(label, manifest) pairs; the verdict is computed, never typed in."""
    tf = ('timeframes', 'M5')
    cases = [
        ('the sender\'s own manifest', good),
        ('repush_rows_unsent zero', edit(good, ('repush_rows_unsent',), 0)),
        ('repush_rows_unsent absent', edit(good, ('repush_rows_unsent',), delete=True)),
        ('repush_rows_unsent a float', edit(good, ('repush_rows_unsent',), 1.5)),
        ('repush_rows_unsent a string', edit(good, ('repush_rows_unsent',), '0')),
        ('schema missing', edit(good, ('schema',), delete=True)),
        ('schema version 2', edit(good, ('schema',), 'cycle-manifest/2')),
        ('wrong symbol', edit(good, ('symbol',), 'EURUSD')),
        ('slot off the boundary', edit(good, ('slot',), good['slot'] + 1)),
        ('slot negative', edit(good, ('slot',), -300)),
        ('slot a float', edit(good, ('slot',), good['slot'] + 0.5)),
        ('slot a string', edit(good, ('slot',), str(good['slot']))),
        ('terminal missing', edit(good, ('mt5_terminal',), delete=True)),
        ('terminal empty', edit(good, ('mt5_terminal',), '')),
        ('built_at missing', edit(good, ('built_at',), delete=True)),
        ('backlog negative', edit(good, ('backlog_rows',), -1)),
        ('repush negative', edit(good, ('repush_rows_unsent',), -1)),
        ('M5 missing', edit(good, ('timeframes', 'M5'), delete=True)),
        ('timeframes empty', edit(good, ('timeframes',), {})),
        ('timeframes not an object', edit(good, ('timeframes',), [])),
        ('unknown timeframe', edit(good, ('timeframes', 'M30'), good['timeframes']['M5'])),
        ('attempts missing', edit(good, tf + ('attempts',), delete=True)),
        ('attempts zero', edit(good, tf + ('attempts',), 0)),
        ('attempts a string', edit(good, tf + ('attempts',), '2')),
        ('attempts a float', edit(good, tf + ('attempts',), 1.5)),
        ('collection cycle id zero', edit(good, tf + ('collection_cycle_id',), 0)),
        ('bar_count zero', edit(good, tf + ('bar_count',), 0)),
        ('export_mtime missing', edit(good, tf + ('export_mtime',), delete=True)),
        ('export_mtime a string', edit(good, tf + ('export_mtime',), '2026-09-18T21:00:00Z')),
        ('export_mtime negative', edit(good, tf + ('export_mtime',), -1)),
        ('newest_bar_ts missing', edit(good, tf + ('newest_bar_ts',), delete=True)),
        ('oldest_bar_ts missing', edit(good, tf + ('oldest_bar_ts',), delete=True)),
        ('quarantined negative', edit(good, tf + ('quarantined_rows',), -1)),
        ('statistics_count missing', edit(good, tf + ('statistics_count',), delete=True)),
        ('config_hashes empty', edit(good, tf + ('config_hashes',), {})),
        ('hash too short', edit(good, tf + ('config_hashes',), {'best_fit_a': 'abc'})),
        ('hash upper case', edit(good, tf + ('config_hashes',), {'best_fit_a': 'A' * 64})),
        ('hash not hex', edit(good, tf + ('config_hashes',), {'best_fit_a': 'g' * 64})),
        ('hash a number', edit(good, tf + ('config_hashes',), {'best_fit_a': 7})),
        ('unknown source', edit(good, tf + ('config_hashes',), {'made_up': 'a' * 64})),
        ('mode lower case', edit(good, tf + ('source_modes',), {'best_fit_a': 'frozen'})),
        ('unknown mode', edit(good, tf + ('source_modes',), {'best_fit_a': 'STANDBY'})),
        ('source_modes empty', edit(good, tf + ('source_modes',), {})),
        ('extra top-level field', edit(good, ('extra',), 1)),
        ('extra timeframe field', edit(good, tf + ('extra',), 1)),
        ('body is an array', [good]),
        ('body is a string', 'cycle-manifest/1'),
        ('body is null', None),
        ('body is empty', {}),
    ]
    if 'M15' in good['timeframes']:
        cases.append(('M15 attempts zero', edit(good, ('timeframes', 'M15', 'attempts'), 0)))
        cases.append(('M15 present and valid', good))
    return cases


def main():
    with isolated_worker():
        refresh = manifest_of(SLOT_REFRESH, m5_attempts=2, m15_attempts=1)
        plain = manifest_of(SLOT_PLAIN)
        closed = manifest_of(SLOT_REFRESH, quarantined={'M5': 1}, stub=False)
    write('cycle-manifest-refresh-slot.json', refresh)
    write('cycle-manifest-plain-slot.json', plain)
    write('cycle-manifest-closed-newest.json', closed)

    seen, rows = set(), []
    for base in (refresh, plain):
        for label, manifest in corpus(base):
            name = f"{label} [{'refresh' if base is refresh else 'plain'}]"
            if name in seen:
                continue
            seen.add(name)
            rows.append({'label': name, 'manifest': manifest, 'valid': VALIDATOR.is_valid(manifest)})
    write('cycle-manifest-validation-corpus.json', rows)
    valid = sum(1 for r in rows if r['valid'])
    print(f'corpus: {len(rows)} cases, {valid} valid, {len(rows) - valid} invalid')


if __name__ == '__main__':
    main()
