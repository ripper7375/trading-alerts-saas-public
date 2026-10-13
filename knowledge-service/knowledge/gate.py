"""The gate: the command that builds the index and the command that stops a deploy.

    python -m knowledge.gate fetch-model [--model-dir DIR]
    python -m knowledge.gate build --corpus DIR --output DIR [--require-real] [--model-dir DIR]
    python -m knowledge.gate check --index DIR [--model-dir DIR]

`build` reads the corpus, fails on any unknown tag, an out-of-bounds chunk or a wording-backstop match, builds the
index, loads it back under every pin and shows the fusion of 4.7 on it. `check` does the last two on an index that
already exists. Both exit 1 on any failure, so a Dockerfile step that runs them fails the image build: the index is
rebuilt on every deploy (ADR-005) and a failed gate is a failed build. Exit 2 is a usage error.

Part 9 adds the labelled question set to this gate (recall at 4); this part builds the commands and what they check.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Sequence

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
from .model import fetch_model, require_model
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
    _say(
        {
            "ok": True,
            "index_build_id": loaded.build_id,
            "corpus_kind": loaded.metadata["corpus_kind"],
            "chunks": len(loaded.chunks),
            "load_seconds": round(load_seconds, 2),
        }
    )
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
    build.add_argument("--model-dir")
    build.add_argument("--matrix", help=f"dispatch matrix (default {default_matrix_path()})")
    build.set_defaults(run=cmd_build)

    check = sub.add_parser("check", help="load an index under every pin and verify it")
    check.add_argument("--index", required=True)
    check.add_argument("--model-dir")
    check.add_argument("--matrix")
    check.set_defaults(run=cmd_check)

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
