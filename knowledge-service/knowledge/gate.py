"""The gate: the command that builds the index and the command that stops a deploy.

    python -m knowledge.gate fetch-model [--model-dir DIR]
    python -m knowledge.gate build --corpus DIR --output DIR [--require-real] [--require-approved] [--model-dir DIR]
    python -m knowledge.gate check --index DIR [--require-approved] [--model-dir DIR]
    python -m knowledge.gate review --corpus DIR [--check] [--model-dir DIR]
    python -m knowledge.gate replay --index DIR [--labelled DIR] [--require-approved] [--require-live-run] [--model-dir DIR]
    python -m knowledge.gate labelled-review --labelled DIR [--check]

`build` reads the corpus, fails on any unknown tag, an out-of-bounds chunk or a wording-backstop match, builds the
index, loads it back under every pin and shows the fusion of 4.7 on it. `check` does the last two on an index that
already exists. Both exit 1 on any failure, so a Dockerfile step that runs them fails the image build: the index is
rebuilt on every deploy (ADR-005) and a failed gate is a failed build. Exit 2 is a usage error.

`--require-approved` is the production gate (ADR-042): `build` fails when any area of the corpus is PENDING, has no approval
file, or has changed since it was approved; `check` fails when the index it reads was built that way. A development build
without the flag succeeds while the areas are PENDING and records their state in the index's metadata.

`review` writes the review tables and the PENDING approval files of the corpus, and with `--check` only reports whether
they are current (see `review.py`).

`replay` is the retrieval half of the release gate (build step 6 part 9; architecture 4.11 items 3 and 7). It loads the real index,
reads the labelled question set and the recorded run in `labelled/`, and searches the index with the retrieval request the
TypeScript replay stored for every question: recall@4 must be at least 0.80 in every locale and every locale within 5 points of
English. It exits 1 on a stale recording (the fingerprint is not the one of this set and this glossary), a set that fails its own
integrity checks, a chunk the set names that the index does not hold (a chunk removed from the corpus), or a recall under the bar.
`--require-approved` also refuses a base set that Davin has not approved; `--require-live-run` refuses a run no model answered
(the stand-in). `labelled-review` writes the review table and the PENDING approval of the labelled set (see `labelled_review.py`).
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Sequence

from .approval import check_recorded_approvals
from .build import build_index
from .config import (
    CONFIG_DIR,
    Settings,
    check_templates,
    default_matrix_path,
    load_glossary_version,
    load_index_config,
    load_matrix,
)
from .errors import BuildFailed, ConfigError, IndexUnavailable, Problem
from .index import load_index
from .labelled import replay as run_replay
from .labelled_review import run_labelled_review
from .model import TokenCounter, fetch_model, require_model
from .review import run_review
from .search import Retriever
from .tags import load_tags
from .verify import verify_index


def _say(payload: dict) -> None:
    sys.stdout.write(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")


def _fail(problems: Sequence[Problem | str], *, kind: str) -> int:
    for problem in problems:
        sys.stderr.write(f"{kind}: {problem}\n")
    return 1


def _model_dir(args: argparse.Namespace) -> Path:
    return Path(args.model_dir) if args.model_dir else Settings.from_env().model_dir


def cmd_fetch_model(args: argparse.Namespace) -> int:
    config = load_index_config(CONFIG_DIR / "index.yaml")
    started = time.perf_counter()
    path = fetch_model(config, _model_dir(args))
    _say({"ok": True, "model": config.model_repo, "revision": config.model_revision, "dir": str(path),
          "seconds": round(time.perf_counter() - started, 1)})
    return 0


def cmd_build(args: argparse.Namespace) -> int:
    tags = load_tags(CONFIG_DIR / "tags.yaml")
    config = load_index_config(CONFIG_DIR / "index.yaml")
    matrix = load_matrix(tags, Path(args.matrix) if args.matrix else None)
    check_templates(config, matrix)
    glossary_version = load_glossary_version()
    model_dir = _model_dir(args)
    require_model(config, model_dir)

    started = time.perf_counter()
    result = build_index(
        Path(args.corpus),
        Path(args.output),
        tags=tags,
        config=config,
        glossary_version=glossary_version,
        model_dir=model_dir,
        require_real=args.require_real,
        require_approved=args.require_approved,
    )
    built = time.perf_counter() - started

    loaded = load_index(result.output_dir, config, model_dir)
    problems = verify_index(loaded, config)
    loaded.embeddings.close()
    if problems:
        import shutil

        shutil.rmtree(result.output_dir, ignore_errors=True)
        return _fail(problems, kind="verify")
    _say(
        {
            "ok": True,
            "index_build_id": result.index_build_id,
            "corpus_kind": result.corpus_kind,
            "chunks": result.chunk_count,
            "domains": result.metadata["domains"],
            "approvals": {area: entry["status"] for area, entry in result.approvals.items()},
            "warnings": [f"{w}" for w in result.warnings],
            "build_seconds": round(built, 1),
            "output": str(result.output_dir),
        }
    )
    return 0


def cmd_check(args: argparse.Namespace) -> int:
    tags = load_tags(CONFIG_DIR / "tags.yaml")
    config = load_index_config(CONFIG_DIR / "index.yaml")
    matrix = load_matrix(tags, Path(args.matrix) if args.matrix else None)
    check_templates(config, matrix)
    model_dir = require_model(config, _model_dir(args))

    started = time.perf_counter()
    loaded = load_index(Path(args.index), config, model_dir)
    load_seconds = time.perf_counter() - started
    problems = verify_index(loaded, config)
    loaded.embeddings.close()
    if problems:
        return _fail(problems, kind="verify")
    approvals = loaded.metadata.get("approvals") or {}
    if args.require_approved:
        unapproved = check_recorded_approvals(loaded.metadata, loaded.chunks)
        if unapproved:
            return _fail(unapproved, kind="approval")
    _say(
        {
            "ok": True,
            "index_build_id": loaded.build_id,
            "corpus_kind": loaded.metadata["corpus_kind"],
            "chunks": len(loaded.chunks),
            "approvals": {area: entry.get("status") for area, entry in approvals.items()},
            "load_seconds": round(load_seconds, 2),
        }
    )
    return 0


def cmd_review(args: argparse.Namespace) -> int:
    tags = load_tags(CONFIG_DIR / "tags.yaml")
    config = load_index_config(CONFIG_DIR / "index.yaml")
    counter = TokenCounter(require_model(config, _model_dir(args)))
    result = run_review(
        Path(args.corpus), tags=tags, config=config, count=counter.count, window=counter.window, write=not args.check
    )
    if result.problems:
        return _fail(result.problems, kind="review")
    _say(
        {
            "ok": True,
            "mode": "check" if args.check else "record",
            "areas": result.areas,
            "written": result.written,
        }
    )
    return 0


def cmd_replay(args: argparse.Namespace) -> int:
    tags = load_tags(CONFIG_DIR / "tags.yaml")
    config = load_index_config(CONFIG_DIR / "index.yaml")
    matrix = load_matrix(tags, Path(args.matrix) if args.matrix else None)
    check_templates(config, matrix)
    model_dir = require_model(config, _model_dir(args))

    loaded = load_index(Path(args.index), config, model_dir)
    problems = verify_index(loaded, config)
    if problems:
        loaded.embeddings.close()
        return _fail(problems, kind="verify")
    started = time.perf_counter()
    try:
        report = run_replay(
            Path(args.labelled),
            retriever=Retriever(loaded, matrix, tags, config),
            known_chunk_ids=set(loaded.chunks),
            glossary_version=load_glossary_version(),
            routing_version=matrix.version,
            require_approved=args.require_approved,
            require_live_run=args.require_live_run,
        )
    finally:
        loaded.embeddings.close()
    payload = report.as_dict()
    payload["ok"] = not report.problems
    payload["seconds"] = round(time.perf_counter() - started, 1)
    if report.problems:
        _say(payload)
        return _fail(report.problems, kind="replay")
    _say(payload)
    return 0


def cmd_labelled_review(args: argparse.Namespace) -> int:
    result = run_labelled_review(Path(args.labelled), write=not args.check)
    if result.problems:
        return _fail(result.problems, kind="labelled-review")
    _say({"ok": True, "mode": "check" if args.check else "record", "status": result.status, "written": result.written})
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m knowledge.gate", description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="command", required=True)

    fetch = sub.add_parser("fetch-model", help="download the pinned model revision (needs the network)")
    fetch.add_argument("--model-dir")
    fetch.set_defaults(run=cmd_fetch_model)

    build = sub.add_parser("build", help="build the index of a corpus and verify it")
    build.add_argument("--corpus", required=True)
    build.add_argument("--output", required=True)
    build.add_argument("--require-real", action="store_true", help="refuse a corpus marked TEST_ONLY (production)")
    build.add_argument(
        "--require-approved",
        action="store_true",
        help="refuse a corpus with an area that is PENDING, unapproved or changed since it was approved (production)",
    )
    build.add_argument("--model-dir")
    build.add_argument("--matrix", help=f"dispatch matrix (default {default_matrix_path()})")
    build.set_defaults(run=cmd_build)

    check = sub.add_parser("check", help="load an index under every pin and verify it")
    check.add_argument("--index", required=True)
    check.add_argument(
        "--require-approved",
        action="store_true",
        help="fail unless the index was built with every area APPROVED and unchanged since (production)",
    )
    check.add_argument("--model-dir")
    check.add_argument("--matrix")
    check.set_defaults(run=cmd_check)

    review = sub.add_parser("review", help="write the review tables and PENDING approvals of a corpus (or --check them)")
    review.add_argument("--corpus", required=True)
    review.add_argument("--check", action="store_true", help="write nothing; exit 1 when a table or an approval is stale")
    review.add_argument("--model-dir")
    review.set_defaults(run=cmd_review)

    replay = sub.add_parser("replay", help="the retrieval half of the release gate: recall@4 on the labelled question set")
    replay.add_argument("--index", required=True)
    replay.add_argument("--labelled", default="labelled", help="the labelled folder (default: labelled)")
    replay.add_argument("--require-approved", action="store_true", help="refuse a base set that is PENDING or changed since it was approved")
    replay.add_argument("--require-live-run", action="store_true", help="refuse a recorded run that no model answered (the stand-in)")
    replay.add_argument("--model-dir")
    replay.add_argument("--matrix")
    replay.set_defaults(run=cmd_replay)

    labelled_review = sub.add_parser("labelled-review", help="write the review table and PENDING approval of the labelled set (or --check them)")
    labelled_review.add_argument("--labelled", required=True)
    labelled_review.add_argument("--check", action="store_true", help="write nothing; exit 1 when the table or the approval is stale")
    labelled_review.set_defaults(run=cmd_labelled_review)

    args = parser.parse_args(argv)
    try:
        return args.run(args)
    except BuildFailed as error:
        return _fail(error.problems, kind="build")
    except ConfigError as error:
        return _fail(error.problems, kind="config")
    except IndexUnavailable as error:
        return _fail([str(error)], kind="index")


if __name__ == "__main__":
    raise SystemExit(main())
