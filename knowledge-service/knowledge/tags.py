"""The tag whitelist (architecture 4.6 item 2): `tags.yaml` plus the generated `registry-codes.json`.

Domains and timeframes are typed in `tags.yaml`. The MCD ids and the state codes are NOT typed anywhere in this
service: `scripts/intake/build_roster.py` writes them from the four MCD registries, and this module reads them. A
corpus file that names a value neither file lists fails the build (`check_tag_values`), and so does a request that
names a sensor the registry does not have (`search.py` drops it).
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from types import MappingProxyType
from typing import Mapping

import yaml

from .canonical import normalize_text, sha256_json
from .errors import ConfigError, Problem

TAGS_SCHEMA = "tags/1"
REGISTRY_SCHEMA = "registry-codes/1"

# The same shapes lib/intake/packet.ts holds a chunk to (STATE_CODE, MCD_ID_PATTERN): a code that fails them could
# never reach a packet, so the whitelist itself must not contain one.
MCD_ID_RE = re.compile(r"^MCD([0-9]|1[0-5])$")
STATE_CODE_RE = re.compile(r"^MCD([0-9]|1[0-5])_[A-Z0-9_]+$")
STATE_CODE_MAX_CHARS = 48
DOMAIN_RE = re.compile(r"^D[1-9]$")


@dataclass(frozen=True)
class Tags:
    domains: tuple[str, ...]  # in rank order: the first is answered first
    timeframes: tuple[str, ...]
    mcd_ids: tuple[str, ...]
    board_mcd_ids: tuple[str, ...]
    state_codes: Mapping[str, tuple[str, ...]]  # MCD id -> its state codes
    sha256: str  # of the whole whitelist, canonical: a part of the index build id

    @property
    def all_state_codes(self) -> frozenset[str]:
        return frozenset(c for codes in self.state_codes.values() for c in codes)

    def domain_rank(self, domain: str) -> int:
        return self.domains.index(domain)

    def mcd_of(self, state_code: str) -> str | None:
        for mcd, codes in self.state_codes.items():
            if state_code in codes:
                return mcd
        return None


def _load_yaml(path: Path) -> object:
    try:
        return yaml.safe_load(normalize_text(path.read_bytes().decode("utf-8")))
    except (OSError, UnicodeDecodeError, yaml.YAMLError) as error:
        raise ConfigError(f"{path.name}: {error}") from error


def _load_json(path: Path) -> object:
    try:
        return json.loads(normalize_text(path.read_bytes().decode("utf-8")))
    except (OSError, UnicodeDecodeError, ValueError) as error:
        raise ConfigError(f"{path.name}: {error}") from error


def load_tags(tags_path: Path, registry_path: Path | None = None) -> Tags:
    """Read the whitelist. Raises ConfigError listing every inconsistency found."""
    problems: list[Problem] = []

    def bad(where: str, code: str, message: str) -> None:
        problems.append(Problem(where, code, message))

    raw = _load_yaml(tags_path)
    if not isinstance(raw, dict) or raw.get("schema") != TAGS_SCHEMA:
        raise ConfigError(f"{tags_path.name}: schema must be {TAGS_SCHEMA}")

    domains = raw.get("domains")
    if (
        not isinstance(domains, list)
        or not domains
        or not all(isinstance(d, str) and DOMAIN_RE.match(d) for d in domains)
        or len(set(domains)) != len(domains)
    ):
        bad("tags.yaml:domains", "BAD_DOMAINS", "a non-empty list of distinct ids such as D1")
        domains = []
    timeframes = raw.get("timeframes")
    if (
        not isinstance(timeframes, list)
        or not timeframes
        or not all(isinstance(t, str) for t in timeframes)
        or len(set(timeframes)) != len(timeframes)
    ):
        bad("tags.yaml:timeframes", "BAD_TIMEFRAMES", "a non-empty list of distinct timeframes")
        timeframes = []

    registry_name = raw.get("registry_codes")
    if registry_path is None:
        if not isinstance(registry_name, str) or registry_name == "":
            raise ConfigError("tags.yaml: registry_codes must name the generated file")
        registry_path = tags_path.parent / registry_name
    registry = _load_json(registry_path)
    if not isinstance(registry, dict) or registry.get("schema") != REGISTRY_SCHEMA:
        raise ConfigError(f"{registry_path.name}: schema must be {REGISTRY_SCHEMA}")

    mcd_ids = registry.get("mcd_ids")
    board = registry.get("board_mcd_ids")
    codes = registry.get("state_codes")
    if not isinstance(mcd_ids, list) or not mcd_ids or not all(
        isinstance(m, str) and MCD_ID_RE.match(m) for m in mcd_ids
    ):
        raise ConfigError(f"{registry_path.name}: mcd_ids is not a list of MCD ids")
    if not isinstance(board, list) or not set(board) <= set(mcd_ids):
        raise ConfigError(f"{registry_path.name}: board_mcd_ids must be a subset of mcd_ids")
    if not isinstance(codes, dict) or set(codes) != set(mcd_ids):
        raise ConfigError(f"{registry_path.name}: state_codes must have one entry per MCD id")
    state_codes: dict[str, tuple[str, ...]] = {}
    seen: set[str] = set()
    for mcd in mcd_ids:
        listed = codes[mcd]
        if not isinstance(listed, list) or not all(isinstance(c, str) for c in listed):
            bad(f"{registry_path.name}:{mcd}", "BAD_STATE_CODES", "a list of strings")
            continue
        for code in listed:
            if not STATE_CODE_RE.match(code) or len(code) > STATE_CODE_MAX_CHARS:
                bad(f"{registry_path.name}:{code}", "BAD_STATE_CODE", "not a state code the packet accepts")
            elif not code.startswith(f"{mcd}_"):
                bad(f"{registry_path.name}:{code}", "STATE_CODE_OF_OTHER_MCD", f"listed under {mcd}")
            elif code in seen:
                bad(f"{registry_path.name}:{code}", "DUPLICATE_STATE_CODE", "listed twice")
            seen.add(code)
        state_codes[mcd] = tuple(listed)

    registry_timeframes = registry.get("timeframes")
    if registry_timeframes is not None and list(registry_timeframes) != list(timeframes):
        bad(
            "tags.yaml:timeframes",
            "TIMEFRAMES_DISAGREE",
            f"tags.yaml has {timeframes}, {registry_path.name} has {registry_timeframes}",
        )

    if problems:
        raise ConfigError(problems)

    fingerprint = sha256_json(
        {
            "domains": domains,
            "timeframes": timeframes,
            "mcd_ids": mcd_ids,
            "state_codes": {m: list(c) for m, c in state_codes.items()},
        }
    )
    return Tags(
        domains=tuple(domains),
        timeframes=tuple(timeframes),
        mcd_ids=tuple(mcd_ids),
        board_mcd_ids=tuple(board),
        state_codes=MappingProxyType(state_codes),
        sha256=fingerprint,
    )


def check_tag_values(
    tags: Tags,
    *,
    where: str,
    domain: object,
    mcd_id: object,
    state_codes: object,
    timeframe: object,
) -> list[Problem]:
    """Every tag value of one document against the whitelist. Unknown values fail fast, none is guessed."""
    problems: list[Problem] = []

    if not isinstance(domain, str) or domain not in tags.domains:
        problems.append(
            Problem(where, "UNKNOWN_DOMAIN", f"{domain!r} is not one of {', '.join(tags.domains)}")
        )

    mcd_known = False
    if mcd_id is not None:
        if not isinstance(mcd_id, str) or mcd_id not in tags.mcd_ids:
            problems.append(
                Problem(where, "UNKNOWN_MCD_ID", f"{mcd_id!r} is not in the registries ({', '.join(tags.mcd_ids)})")
            )
        else:
            mcd_known = True

    if isinstance(state_codes, (list, tuple)):
        listed = set()
        for code in state_codes:
            if not isinstance(code, str) or code not in tags.all_state_codes:
                problems.append(Problem(where, "UNKNOWN_STATE_CODE", f"{code!r} is not in the registries"))
                continue
            if code in listed:
                problems.append(Problem(where, "DUPLICATE_STATE_CODE", f"{code} is listed twice"))
            listed.add(code)
            if mcd_known and tags.mcd_of(code) != mcd_id:
                problems.append(
                    Problem(where, "STATE_CODE_NOT_OF_MCD", f"{code} belongs to {tags.mcd_of(code)}, not {mcd_id}")
                )

    if timeframe is not None and (not isinstance(timeframe, str) or timeframe not in tags.timeframes):
        problems.append(
            Problem(where, "UNKNOWN_TIMEFRAME", f"{timeframe!r} is not one of {', '.join(tags.timeframes)}")
        )
    return problems
