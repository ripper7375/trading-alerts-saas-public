#!/usr/bin/env python3
"""Copy the two intake files the knowledge service reads into the service's own folder.

Build step 6, part 6 (plan section 4, part 6; decision D3 (A)). The knowledge service is built alone
on Railway: nothing outside `knowledge-service/` exists at image build time, as with `railway-gateway/`.
It still has to follow two files of the monolith:

  config/intake/dispatch-matrix.v1.json   which domains each intent searches and whether the D2 playbooks
                                          are scoped to M* (the service reads them, it never retypes them)
  config/intake/glossary.v1.json          only its `version` (a part of the index build id)

This tool writes the service's copies:

  knowledge-service/config/intake/dispatch-matrix.v1.json   a byte copy (line endings made LF)
  knowledge-service/config/intake/glossary-version.json     {"schema": "glossary-version/1", "version": ...}

Usage (from the repository root):

  python scripts/intake/sync_knowledge_config.py            write both files
  python scripts/intake/sync_knowledge_config.py --check    exit 1 if a file differs from a rebuild
                                                            (the parsed JSON is compared, so the line
                                                            endings of the checkout cannot make a
                                                            false difference)

Exit codes: 0 done / equal, 1 --check found a difference, 2 a source file is wrong.
"""

import argparse
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SOURCE_MATRIX = REPO / "config" / "intake" / "dispatch-matrix.v1.json"
SOURCE_GLOSSARY = REPO / "config" / "intake" / "glossary.v1.json"
TARGET_DIR = REPO / "knowledge-service" / "config" / "intake"
TARGET_MATRIX = TARGET_DIR / "dispatch-matrix.v1.json"
TARGET_GLOSSARY_VERSION = TARGET_DIR / "glossary-version.json"

GLOSSARY_VERSION_SCHEMA = "glossary-version/1"


class SourceError(Exception):
    """A source file is missing or is not what it must be."""


def read_json(path: Path) -> object:
    try:
        return json.loads(path.read_bytes().decode("utf-8"))
    except (OSError, ValueError) as error:
        raise SourceError(f"{path}: {error}") from error


def expected_files() -> dict[Path, bytes]:
    """The bytes each target must hold, built from the sources."""
    matrix = read_json(SOURCE_MATRIX)
    if not isinstance(matrix, dict) or matrix.get("schema") != "dispatch-matrix/1":
        raise SourceError(f"{SOURCE_MATRIX}: not a dispatch-matrix/1 file")
    glossary = read_json(SOURCE_GLOSSARY)
    if not isinstance(glossary, dict) or glossary.get("schema") != "glossary/1":
        raise SourceError(f"{SOURCE_GLOSSARY}: not a glossary/1 file")
    version = glossary.get("version")
    if not isinstance(version, str) or version == "":
        raise SourceError(f"{SOURCE_GLOSSARY}: no version")

    matrix_bytes = SOURCE_MATRIX.read_bytes().replace(b"\r\n", b"\n")
    version_text = (
        json.dumps(
            {"schema": GLOSSARY_VERSION_SCHEMA, "version": version},
            indent=2,
            ensure_ascii=False,
        )
        + "\n"
    )
    return {
        TARGET_MATRIX: matrix_bytes,
        TARGET_GLOSSARY_VERSION: version_text.encode("utf-8"),
    }


def same_json(path: Path, wanted: bytes) -> bool:
    try:
        return json.loads(path.read_bytes().decode("utf-8")) == json.loads(
            wanted.decode("utf-8")
        )
    except (OSError, ValueError):
        return False


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--check", action="store_true", help="exit 1 if a file differs from a rebuild"
    )
    args = parser.parse_args(argv)
    try:
        files = expected_files()
    except SourceError as error:
        sys.stderr.write(f"{error}\n")
        return 2

    if args.check:
        differing = [p for p, b in files.items() if not same_json(p, b)]
        for path in differing:
            sys.stdout.write(f"differs: {path.relative_to(REPO).as_posix()}\n")
        if differing:
            sys.stdout.write(
                "run: python scripts/intake/sync_knowledge_config.py\n"
            )
            return 1
        sys.stdout.write(f"equal: {len(files)} files\n")
        return 0

    TARGET_DIR.mkdir(parents=True, exist_ok=True)
    for path, data in files.items():
        path.write_bytes(data)
        sys.stdout.write(f"wrote {path.relative_to(REPO).as_posix()}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
