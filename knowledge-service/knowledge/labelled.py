"""The labelled question set and the retrieval half of the release gate (build step 6 part 9; architecture 4.8, 4.11).

The set lives in `labelled/` beside the corpus:

    base.en-US.json         40 hand-labelled English questions (five per intent for eight intents, eight of them noisy)
                            and the adversarial slice, which is judged apart from the percentages
    locales/<locale>.json   the 40 questions translated into each of the other 18 locales (labels are inherited)
    approval.json           PENDING until Davin has read review.md; only a person writes APPROVED
    review.md               generated: the tables Davin reads
    current-run.json        names the recorded run that counts
    runs/<fingerprint>/     one recorded run: manifest.json and one file per locale

The gate has two halves, because the model, the router and the index live in different places:

  * the TypeScript half (`__tests__/lib/intake/labelled-gate.test.ts`) replays the real intake pipeline over the recorded
    answers: intent and M* against the hand labels, the scope outcome, the warnings that must always be present;
  * this half searches the REAL index with the retrieval request that replay produced for every question (it is stored in
    the run file, and the TypeScript half proves it is current) and measures recall@4: at least one of the chunks a
    complete answer needs is in the first four hits.

What a recorded run is. `provenance` in its manifest is LIVE (a real model answered) or STAND_IN (the hand labels answered,
no model was called). A STAND_IN run proves the mechanism and measures nothing about the model or about translation: every
locale gets the same English pivot, so the per-locale comparison is equal by construction. `replay` says which it ran on,
and `--require-live-run` refuses a STAND_IN run.

A recording is current only if its fingerprint is: `sha256(model_id:prompt_version:glossary_version:base_set_sha256)`, cut
to 32 characters. This half checks what it can see (the glossary version, the base set and each locale file by their
canonical hash, the fingerprint against the manifest, the questions the recording holds against the set); the prompt version
lives in the TypeScript code and is checked by the TypeScript half.
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence

from .canonical import normalize_text, sha256_json
from .errors import Problem
from .search import Retriever, SearchRequest, plan_search

BASE_FILE = "base.en-US.json"
LOCALES_DIR = "locales"
APPROVAL_FILE = "approval.json"
REVIEW_FILE = "review.md"
POINTER_FILE = "current-run.json"
RUNS_DIR = "runs"
MANIFEST_FILE = "manifest.json"

BASE_SCHEMA = "labelled-base/1"
LOCALE_SCHEMA = "labelled-locale/1"
RUN_SCHEMA = "labelled-run/1"
MANIFEST_SCHEMA = "labelled-run-manifest/1"
POINTER_SCHEMA = "labelled-run-pointer/1"
APPROVAL_SCHEMA = "labelled-approval/1"

#: The 19 interface locales, in the order of `lib/i18n/languages.ts`. The English base is the reference.
ENGLISH = "en-US"
LOCALES: tuple[str, ...] = (
    "en-US", "en-GB", "es", "de", "pt", "pt-BR", "it", "ja", "ar", "fr",
    "ko", "zh", "zh-TW", "ur", "hi", "vi", "id", "th", "tr",
)  # fmt: skip
TRANSLATED = tuple(locale for locale in LOCALES if locale != ENGLISH)

#: The eight intents the set covers, five questions each.
INTENTS = (
    "DIRECTION", "ENTRY_TIMING", "EXIT_TARGETS", "RISK_SIZING", "EXPLAIN", "NEWS", "REPORT_2", "OUT_OF_SCOPE",
)  # fmt: skip
#: Intents that retrieve knowledge. Report 2 reads the pinned cycle and Out of scope runs nothing.
RETRIEVING = ("DIRECTION", "ENTRY_TIMING", "EXIT_TARGETS", "RISK_SIZING", "EXPLAIN", "NEWS")
PER_INTENT = 5
NOISY_COUNT = 8
TRADER_TYPES = ("DAY_TRADER", "SCALPER")
SENSORS = ("MCD1", "MCD2", "MCD3")
SCENARIO_RE = re.compile(r"^golden-(0[1-9]|1[0-6])$")
QUESTION_ID_RE = re.compile(r"^q-(\d\d)$")
ADVERSARIAL_ID_RE = re.compile(r"^adv-(\d\d)$")
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
FINGERPRINT_RE = re.compile(r"^[0-9a-f]{32}$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

#: The bars (ADR-044 starting values and plan decision D15). The routing bars are the TypeScript half's.
RECALL_BAR = 0.80
WITHIN_ENGLISH = 0.05
EPSILON = 1e-9  # 0.05 must not fail on binary rounding of a difference of two fractions

PROVENANCES = ("LIVE", "STAND_IN")


def _fail(where: str, code: str, message: str) -> Problem:
    return Problem(where, code, message)


def canonical_sha(value: Any) -> str:
    """The hash of a parsed JSON value: the same on every line ending and every machine."""
    return sha256_json(value)


def _read_json(path: Path) -> Any:
    return json.loads(normalize_text(path.read_bytes().decode("utf-8")))


# ---------------------------------------------------------------------------
# loading the set
# ---------------------------------------------------------------------------


@dataclass
class LabelledSet:
    base: dict[str, Any]
    locales: dict[str, dict[str, Any]]  # the 18 translations, by locale
    problems: list[Problem] = field(default_factory=list)

    @property
    def questions(self) -> list[dict[str, Any]]:
        return self.base["questions"]

    def text(self, locale: str, question_id: str) -> str | None:
        """The question as typed in a locale."""
        if locale == ENGLISH:
            return next((q["question"] for q in self.questions if q["id"] == question_id), None)
        file = self.locales.get(locale)
        if file is None:
            return None
        return next((q["question"] for q in file["questions"] if q["id"] == question_id), None)


def load_set(directory: Path) -> LabelledSet:
    """Read the base and the locale files. A file that cannot be read is a problem, never an exception."""
    problems: list[Problem] = []
    base: dict[str, Any] = {"questions": [], "adversarial": []}
    path = directory / BASE_FILE
    try:
        loaded = _read_json(path)
        if isinstance(loaded, dict):
            base = loaded
        else:
            problems.append(_fail(BASE_FILE, "SET_INVALID", "the file must hold a JSON object"))
    except (OSError, UnicodeDecodeError, ValueError) as error:
        problems.append(_fail(BASE_FILE, "SET_INVALID", f"not readable JSON: {error}"))
    locales: dict[str, dict[str, Any]] = {}
    for locale in TRANSLATED:
        where = f"{LOCALES_DIR}/{locale}.json"
        try:
            loaded = _read_json(directory / LOCALES_DIR / f"{locale}.json")
        except FileNotFoundError:
            continue  # `check_set` reports a locale that has no file
        except (OSError, UnicodeDecodeError, ValueError) as error:
            problems.append(_fail(where, "SET_INVALID", f"not readable JSON: {error}"))
            continue
        if isinstance(loaded, dict):
            locales[locale] = loaded
        else:
            problems.append(_fail(where, "SET_INVALID", "the file must hold a JSON object"))
    return LabelledSet(base=base, locales=locales, problems=problems)


# ---------------------------------------------------------------------------
# the set's own integrity
# ---------------------------------------------------------------------------

QUESTION_FIELDS = (
    "id", "slice", "question", "expected_intent", "trader_type", "scenario_id", "expected_m_star", "expected_warnings",
    "expected_symbols", "expected_timeframes", "expected_chunk_ids", "label_note",
)  # fmt: skip


def _string_list(value: Any) -> bool:
    return isinstance(value, list) and all(isinstance(item, str) for item in value)


def check_set(labelled: LabelledSet, known_chunk_ids: set[str] | None = None) -> list[Problem]:
    """Every way the set is not what the plan says. Empty when it is sound.

    `known_chunk_ids` are the ids of the chunks of the real index; with them every expected chunk must exist.
    """
    problems = list(labelled.problems)
    base = labelled.base

    def bad(where: str, code: str, message: str) -> None:
        problems.append(_fail(where, code, message))

    if base.get("schema") != BASE_SCHEMA:
        bad(BASE_FILE, "SET_INVALID", f"schema must be {BASE_SCHEMA}")
    if base.get("locale") != ENGLISH:
        bad(BASE_FILE, "SET_INVALID", f"locale must be {ENGLISH}")
    questions = base.get("questions")
    if not isinstance(questions, list):
        bad(BASE_FILE, "SET_INVALID", "questions must be a list")
        return problems

    seen: set[str] = set()
    per_intent: dict[str, int] = {}
    noisy = 0
    for index, q in enumerate(questions):
        where = f"{BASE_FILE}#{q.get('id', index) if isinstance(q, dict) else index}"
        if not isinstance(q, dict):
            bad(where, "QUESTION_INVALID", "a question must be an object")
            continue
        for name in q:
            if name not in QUESTION_FIELDS:
                bad(where, "QUESTION_INVALID", f"unknown field {name!r}")
        for name in QUESTION_FIELDS:
            if name not in q:
                bad(where, "QUESTION_INVALID", f"{name} is missing")
        if any(name not in q for name in QUESTION_FIELDS):
            continue
        qid = q["id"]
        match = QUESTION_ID_RE.match(qid) if isinstance(qid, str) else None
        if match is None or int(match.group(1)) != index + 1:
            bad(where, "QUESTION_ID", f"the id of question {index + 1} must be q-{index + 1:02d}")
        if qid in seen:
            bad(where, "QUESTION_ID", "duplicate id")
        seen.add(str(qid))
        if not isinstance(q["question"], str) or not q["question"].strip():
            bad(where, "QUESTION_INVALID", "question must be non-empty text")
        if q["slice"] not in ("core", "noisy"):
            bad(where, "QUESTION_INVALID", "slice must be core or noisy")
        noisy += q["slice"] == "noisy"
        intent = q["expected_intent"]
        if intent not in INTENTS:
            bad(where, "QUESTION_INVALID", f"expected_intent must be one of {', '.join(INTENTS)}")
        per_intent[str(intent)] = per_intent.get(str(intent), 0) + 1
        if q["trader_type"] not in TRADER_TYPES:
            bad(where, "QUESTION_INVALID", "trader_type must be DAY_TRADER or SCALPER")
        if not isinstance(q["scenario_id"], str) or not SCENARIO_RE.match(q["scenario_id"]):
            bad(where, "QUESTION_INVALID", "scenario_id must be golden-01 to golden-16")
        for name in ("expected_m_star", "expected_warnings", "expected_symbols", "expected_timeframes", "expected_chunk_ids"):
            if not _string_list(q[name]):
                bad(where, "QUESTION_INVALID", f"{name} must be a list of text")
        if not all(_string_list(q[name]) for name in ("expected_m_star", "expected_warnings", "expected_chunk_ids")):
            continue
        if any(sensor not in SENSORS for sensor in q["expected_m_star"] + q["expected_warnings"]):
            bad(where, "QUESTION_INVALID", "sensors are MCD1, MCD2 and MCD3")
        if not set(q["expected_warnings"]) <= set(q["expected_m_star"]):
            bad(where, "QUESTION_INVALID", "a warning sensor is always in M*")
        if len(set(q["expected_m_star"])) != len(q["expected_m_star"]):
            bad(where, "QUESTION_INVALID", "expected_m_star repeats a sensor")
        chunks = q["expected_chunk_ids"]
        if intent in RETRIEVING:
            if not 1 <= len(chunks) <= 4:
                bad(where, "CHUNKS_COUNT", f"a {intent} question needs 1 to 4 expected chunks, not {len(chunks)}")
            if not q["expected_m_star"]:
                bad(where, "QUESTION_INVALID", "a question that reads sensors has a non-empty expected_m_star")
        elif chunks or q["expected_m_star"] or q["expected_warnings"]:
            bad(where, "QUESTION_INVALID", f"{intent} gives no knowledge and no readings: chunks, M* and warnings stay empty")
        if len(set(chunks)) != len(chunks):
            bad(where, "CHUNKS_COUNT", "expected_chunk_ids repeats a chunk")
        if known_chunk_ids is not None:
            for chunk in chunks:
                if chunk not in known_chunk_ids:
                    bad(where, "CHUNK_UNKNOWN", f"{chunk} is not a chunk of the corpus")

    for intent in INTENTS:
        if per_intent.get(intent, 0) != PER_INTENT:
            bad(BASE_FILE, "INTENT_COUNT", f"{intent} has {per_intent.get(intent, 0)} questions, not {PER_INTENT}")
    if len(questions) != PER_INTENT * len(INTENTS):
        bad(BASE_FILE, "INTENT_COUNT", f"the base holds {len(questions)} questions, not {PER_INTENT * len(INTENTS)}")
    if noisy != NOISY_COUNT:
        bad(BASE_FILE, "NOISY_COUNT", f"{noisy} noisy questions, not {NOISY_COUNT}")

    problems += _check_adversarial(base.get("adversarial"), {str(q.get("id")) for q in questions if isinstance(q, dict)})
    problems += _check_locales(labelled, [q["id"] for q in questions if isinstance(q, dict) and "id" in q])
    return problems


def _check_adversarial(items: Any, question_ids: set[str]) -> list[Problem]:
    problems: list[Problem] = []
    if not isinstance(items, list) or not 10 <= len(items) <= 15:
        return [_fail(BASE_FILE, "ADVERSARIAL", "the adversarial slice holds about a dozen cases (10 to 15)")]
    seen: set[str] = set()
    for index, adv in enumerate(items):
        where = f"{BASE_FILE}#{adv.get('id', index) if isinstance(adv, dict) else index}"
        if not isinstance(adv, dict):
            problems.append(_fail(where, "ADVERSARIAL", "a case must be an object"))
            continue
        aid = adv.get("id")
        if not isinstance(aid, str) or not ADVERSARIAL_ID_RE.match(aid) or aid in seen:
            problems.append(_fail(where, "ADVERSARIAL", "ids are adv-01, adv-02, ... without repeats"))
        seen.add(str(aid))
        if not isinstance(adv.get("question"), str):
            problems.append(_fail(where, "ADVERSARIAL", "question must be text (it may be empty)"))
        expect = adv.get("expect")
        if expect == "REFUSED":
            if not _string_list(adv.get("refusal_codes")) or not adv.get("refusal_codes"):
                problems.append(_fail(where, "ADVERSARIAL", "a REFUSED case names the refusal codes it may end with"))
        elif expect == "NEUTRALISED":
            if adv.get("same_as") not in question_ids:
                problems.append(_fail(where, "ADVERSARIAL", "a NEUTRALISED case names the clean question it wraps (same_as)"))
        else:
            problems.append(_fail(where, "ADVERSARIAL", "expect must be REFUSED or NEUTRALISED"))
        stand_in = adv.get("stand_in", "__missing__")
        if stand_in == "__missing__" or not (stand_in is None or isinstance(stand_in, dict)):
            problems.append(_fail(where, "ADVERSARIAL", "stand_in must be null (refused at the door) or an object"))
    return problems


def _check_locales(labelled: LabelledSet, ids: list[str]) -> list[Problem]:
    problems: list[Problem] = []
    for locale in TRANSLATED:
        file = labelled.locales.get(locale)
        where = f"{LOCALES_DIR}/{locale}.json"
        if file is None:
            problems.append(_fail(where, "LOCALE_MISSING", f"no translation file for {locale}"))
            continue
        if file.get("schema") != LOCALE_SCHEMA:
            problems.append(_fail(where, "LOCALE_INVALID", f"schema must be {LOCALE_SCHEMA}"))
        if file.get("locale") != locale:
            problems.append(_fail(where, "LOCALE_INVALID", f"locale must be {locale}"))
        if file.get("translation_status") not in ("DRAFT", "REVIEWED"):
            problems.append(_fail(where, "LOCALE_INVALID", "translation_status must be DRAFT or REVIEWED"))
        extra = set(file) - {"schema", "locale", "translation_status", "note", "questions"}
        if extra:
            problems.append(_fail(where, "LOCALE_INVALID", f"unknown field(s) {sorted(extra)}"))
        questions = file.get("questions")
        if not isinstance(questions, list):
            problems.append(_fail(where, "LOCALE_INVALID", "questions must be a list"))
            continue
        got = [q.get("id") if isinstance(q, dict) else None for q in questions]
        if got != ids:
            problems.append(_fail(where, "LOCALE_COVERAGE", f"the file must hold exactly {ids[0]} to {ids[-1]} in order"))
        for q in questions:
            if not isinstance(q, dict) or set(q) != {"id", "question"}:
                problems.append(_fail(where, "LABELS_INHERITED", "a translated question has an id and a question and nothing else: labels come from the base"))
                continue
            if not isinstance(q["question"], str) or not q["question"].strip():
                problems.append(_fail(where, "LOCALE_INVALID", f"{q['id']}: the translation is empty"))
    return problems


# ---------------------------------------------------------------------------
# approval of the English base (only a person writes APPROVED)
# ---------------------------------------------------------------------------

APPROVAL_FIELDS = ("schema", "area", "status", "content_sha256", "approved_by", "approved_at")
STATUSES = ("PENDING", "APPROVED")


def approval_hash(labelled: LabelledSet) -> str:
    """What Davin approves is the English base: its questions, labels and adversarial slice."""
    return canonical_sha(labelled.base)


def approval_text(status: str, content_sha256: str, approved_by: str | None, approved_at: str | None) -> str:
    payload = {
        "schema": APPROVAL_SCHEMA,
        "area": "labelled",
        "status": status,
        "content_sha256": content_sha256,
        "approved_by": approved_by,
        "approved_at": approved_at,
    }
    return json.dumps(payload, indent=2, ensure_ascii=False) + "\n"


def check_approval(directory: Path, labelled: LabelledSet) -> list[Problem]:
    """Every reason the base is not approved: no file, a stale hash, PENDING. Empty when APPROVED and unchanged."""
    where = APPROVAL_FILE
    try:
        raw = _read_json(directory / APPROVAL_FILE)
    except FileNotFoundError:
        return [_fail(where, "APPROVAL_MISSING", "the labelled set has no approval file: run `gate labelled-review`")]
    except (OSError, UnicodeDecodeError, ValueError) as error:
        return [_fail(where, "APPROVAL_INVALID", f"not readable JSON: {error}")]
    if not isinstance(raw, dict) or set(raw) != set(APPROVAL_FIELDS):
        return [_fail(where, "APPROVAL_INVALID", f"the fields are exactly {', '.join(APPROVAL_FIELDS)}")]
    problems: list[Problem] = []
    if raw["schema"] != APPROVAL_SCHEMA or raw["area"] != "labelled":
        problems.append(_fail(where, "APPROVAL_INVALID", f"schema must be {APPROVAL_SCHEMA} and area labelled"))
    if raw["status"] not in STATUSES:
        problems.append(_fail(where, "APPROVAL_INVALID", "status must be PENDING or APPROVED"))
    if not isinstance(raw["content_sha256"], str) or not SHA256_RE.match(raw["content_sha256"]):
        problems.append(_fail(where, "APPROVAL_INVALID", "content_sha256 must be 64 lower-case hex digits"))
    if raw["status"] == "PENDING" and (raw["approved_by"] is not None or raw["approved_at"] is not None):
        problems.append(_fail(where, "APPROVAL_INVALID", "a PENDING approval has approved_by and approved_at null"))
    if raw["status"] == "APPROVED":
        if not isinstance(raw["approved_by"], str) or not raw["approved_by"].strip():
            problems.append(_fail(where, "APPROVAL_INVALID", "an APPROVED approval names who approved it"))
        if not isinstance(raw["approved_at"], str) or not DATE_RE.match(raw["approved_at"]):
            problems.append(_fail(where, "APPROVAL_INVALID", "an APPROVED approval has the date of approval (YYYY-MM-DD)"))
    if problems:
        return problems
    if raw["content_sha256"] != approval_hash(labelled):
        problems.append(
            _fail(where, "APPROVAL_STALE", "the English base changed after the approval was recorded: run `gate labelled-review` and read it again")
        )
    if raw["status"] != "APPROVED":
        problems.append(_fail(where, "APPROVAL_PENDING", f"the labelled set is {raw['status']}, not APPROVED"))
    return problems


# ---------------------------------------------------------------------------
# the recorded run: what this half can check about it
# ---------------------------------------------------------------------------


def fingerprint_of(model_id: str, prompt_version: str, glossary_version: str, base_set_sha256: str) -> str:
    text = f"{model_id}:{prompt_version}:{glossary_version}:{base_set_sha256}"
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:32]


@dataclass
class Run:
    pointer: dict[str, Any]
    manifest: dict[str, Any]
    locales: dict[str, dict[str, Any]]
    problems: list[Problem] = field(default_factory=list)

    @property
    def provenance(self) -> str:
        return str(self.manifest.get("provenance"))


def load_run(directory: Path) -> Run:
    """Read `current-run.json`, the manifest it names and the locale files. Unreadable files are problems."""
    problems: list[Problem] = []
    pointer: dict[str, Any] = {}
    manifest: dict[str, Any] = {}
    locales: dict[str, dict[str, Any]] = {}
    try:
        loaded = _read_json(directory / POINTER_FILE)
        pointer = loaded if isinstance(loaded, dict) else {}
        if not pointer:
            problems.append(_fail(POINTER_FILE, "RUN_INVALID", "the file must hold a JSON object"))
    except FileNotFoundError:
        return Run({}, {}, {}, [_fail(POINTER_FILE, "RUN_MISSING", "no recorded run: current-run.json does not exist")])
    except (OSError, UnicodeDecodeError, ValueError) as error:
        return Run({}, {}, {}, [_fail(POINTER_FILE, "RUN_INVALID", f"not readable JSON: {error}")])
    fingerprint = pointer.get("fingerprint")
    if not isinstance(fingerprint, str) or not FINGERPRINT_RE.match(fingerprint):
        return Run(pointer, {}, {}, problems + [_fail(POINTER_FILE, "RUN_INVALID", "fingerprint must be 32 lower-case hex digits")])
    folder = directory / RUNS_DIR / fingerprint
    try:
        loaded = _read_json(folder / MANIFEST_FILE)
        manifest = loaded if isinstance(loaded, dict) else {}
        if not manifest:
            problems.append(_fail(f"{RUNS_DIR}/{fingerprint}/{MANIFEST_FILE}", "RUN_INVALID", "the file must hold a JSON object"))
    except (OSError, UnicodeDecodeError, ValueError) as error:
        return Run(pointer, {}, {}, problems + [_fail(f"{RUNS_DIR}/{fingerprint}/{MANIFEST_FILE}", "RUN_MISSING", f"the manifest cannot be read: {error}")])
    for locale in manifest.get("locales", []) if isinstance(manifest.get("locales"), list) else []:
        where = f"{RUNS_DIR}/{fingerprint}/{locale}.json"
        try:
            loaded = _read_json(folder / f"{locale}.json")
        except FileNotFoundError:
            problems.append(_fail(where, "MISSING_LOCALE_RUN", f"no recording for {locale}"))
            continue
        except (OSError, UnicodeDecodeError, ValueError) as error:
            problems.append(_fail(where, "RUN_INVALID", f"not readable JSON: {error}"))
            continue
        if isinstance(loaded, dict):
            locales[str(locale)] = loaded
    return Run(pointer, manifest, locales, problems)


def check_run(run: Run, labelled: LabelledSet, *, glossary_version: str, routing_version: str) -> list[Problem]:
    """Every reason the recording is not the one for this set, this glossary and this routing. Empty when current."""
    problems = list(run.problems)
    manifest = run.manifest
    if not manifest:
        return problems
    where = f"{RUNS_DIR}/{run.pointer.get('fingerprint')}"
    if manifest.get("schema") != MANIFEST_SCHEMA:
        problems.append(_fail(where, "RUN_INVALID", f"the manifest schema must be {MANIFEST_SCHEMA}"))
    if manifest.get("provenance") not in PROVENANCES:
        problems.append(_fail(where, "RUN_INVALID", "provenance must be LIVE or STAND_IN"))
    for name in ("model_id", "prompt_version", "glossary_version", "base_set_sha256", "fingerprint"):
        if not isinstance(manifest.get(name), str) or not manifest.get(name):
            problems.append(_fail(where, "RUN_INVALID", f"the manifest has no {name}"))
    if problems:
        return problems

    if manifest["glossary_version"] != glossary_version:
        problems.append(
            _fail(where, "STALE_GLOSSARY", f"recorded with glossary {manifest['glossary_version']}, the glossary is {glossary_version}")
        )
    if manifest["base_set_sha256"] != canonical_sha(labelled.base):
        problems.append(_fail(where, "STALE_BASE_SET", "the English base changed after the run was recorded"))
    expected = fingerprint_of(manifest["model_id"], manifest["prompt_version"], manifest["glossary_version"], manifest["base_set_sha256"])
    if manifest["fingerprint"] != expected:
        problems.append(_fail(where, "FINGERPRINT_MISMATCH", "the manifest does not hash to its fingerprint"))
    if run.pointer.get("fingerprint") != manifest["fingerprint"]:
        problems.append(_fail(POINTER_FILE, "POINTER_MISMATCH", "current-run.json names another run than its manifest"))
    if manifest.get("routing_version") != routing_version:
        problems.append(_fail(where, "STALE_ROUTING", f"recorded under {manifest.get('routing_version')}, the matrix is {routing_version}"))
    if manifest.get("locales") != list(LOCALES):
        problems.append(_fail(where, "RUN_INVALID", "the run must cover the 19 locales in the order of the app"))
    shas = manifest.get("locale_sha256") if isinstance(manifest.get("locale_sha256"), dict) else {}
    for locale, file in labelled.locales.items():
        if shas.get(locale) != canonical_sha(file):
            problems.append(_fail(where, "STALE_LOCALE", f"{locale} changed after the run was recorded"))
    for locale in LOCALES:
        recorded = run.locales.get(locale)
        if recorded is None:
            continue  # reported as MISSING_LOCALE_RUN by the loader
        if recorded.get("fingerprint") != manifest["fingerprint"] or recorded.get("schema") != RUN_SCHEMA:
            problems.append(_fail(f"{where}/{locale}.json", "FILE_FINGERPRINT", f"{locale}.json belongs to another run"))
            continue
        asked = recorded.get("questions") if isinstance(recorded.get("questions"), list) else []
        for q in labelled.questions:
            row = next((r for r in asked if isinstance(r, dict) and r.get("id") == q["id"]), None)
            if row is None:
                problems.append(_fail(f"{where}/{locale}.json", "RUN_COVERAGE", f"no recording of {q['id']}"))
            elif row.get("question") != labelled.text(locale, q["id"]):
                problems.append(_fail(f"{where}/{locale}.json", "STALE_QUESTION", f"{q['id']} was recorded for other text than the set holds now"))
    return problems


# ---------------------------------------------------------------------------
# the replay: recall@4 on the real index
# ---------------------------------------------------------------------------


@dataclass
class LocaleRecall:
    locale: str
    hits: int
    total: int
    #: the mean share of the expected chunks that were found (information, not a bar)
    mean_share: float
    by_intent: dict[str, tuple[int, int]]
    misses: list[str]

    @property
    def recall(self) -> float:
        return 1.0 if self.total == 0 else self.hits / self.total


@dataclass
class ReplayReport:
    provenance: str
    fingerprint: str
    index_build_id: str
    locales: list[LocaleRecall]
    adversarial: list[tuple[str, bool, str]]
    problems: list[Problem]

    def as_dict(self) -> dict[str, Any]:
        return {
            "provenance": self.provenance,
            "fingerprint": self.fingerprint,
            "index_build_id": self.index_build_id,
            "recall_at_4": {
                r.locale: {"hits": r.hits, "total": r.total, "recall": round(r.recall, 4), "mean_share": round(r.mean_share, 4)}
                for r in self.locales
            },
            "by_intent": {r.locale: {k: list(v) for k, v in r.by_intent.items()} for r in self.locales if r.locale == ENGLISH},
            "adversarial": [{"id": i, "ok": ok, "why": why} for i, ok, why in self.adversarial],
            "problems": [str(p) for p in self.problems],
        }


def to_request(retrieval: Mapping[str, Any]) -> SearchRequest:
    return SearchRequest(
        intent=str(retrieval["intent"]),
        question_en=str(retrieval["question_en"]),
        m_star=tuple(retrieval["m_star"]),
        state_codes=tuple(retrieval["state_codes"]),
        routing_version=str(retrieval["routing_version"]),
    )


def _request_key(retrieval: Mapping[str, Any]) -> tuple:
    return (
        retrieval["intent"], retrieval["question_en"], tuple(retrieval["m_star"]),
        tuple(retrieval["state_codes"]), retrieval["routing_version"],
    )  # fmt: skip


SearchFn = Callable[[SearchRequest], list[str]]


def retriever_search(retriever: Retriever) -> SearchFn:
    """The first four chunk ids of a search (expansions are not part of recall@4)."""

    def search(request: SearchRequest) -> list[str]:
        return [chunk["id"] for chunk in retriever.search(request).chunks]

    return search


def recall_of_locale(locale: str, labelled: LabelledSet, recorded: Mapping[str, Any], search: SearchFn) -> LocaleRecall:
    """recall@4 of one locale: a question is found when one of the chunks it needs is in the first four hits."""
    rows = {r["id"]: r for r in recorded.get("questions", []) if isinstance(r, dict) and "id" in r}
    hits = total = 0
    shares: list[float] = []
    by_intent: dict[str, list[int]] = {}
    misses: list[str] = []
    for q in labelled.questions:
        if q["expected_intent"] not in RETRIEVING:
            continue
        total += 1
        wanted = set(q["expected_chunk_ids"])
        row = rows.get(q["id"])
        retrieval = row["replay"].get("retrieval") if row and isinstance(row.get("replay"), dict) else None
        found: list[str] = []
        if isinstance(retrieval, dict):
            found = search(to_request(retrieval))
        got = wanted & set(found)
        shares.append(len(got) / len(wanted))
        counted = by_intent.setdefault(q["expected_intent"], [0, 0])
        counted[1] += 1
        if got:
            hits += 1
            counted[0] += 1
        else:
            where = "no retrieval was made" if retrieval is None else "first four: " + ", ".join(found)
            misses.append(f"{q['id']} ({q['expected_intent']}): none of the expected chunks; {where}")
    return LocaleRecall(
        locale=locale,
        hits=hits,
        total=total,
        mean_share=sum(shares) / len(shares) if shares else 1.0,
        by_intent={k: (v[0], v[1]) for k, v in by_intent.items()},
        misses=misses,
    )


def judge_recall(recalls: Sequence[LocaleRecall]) -> list[Problem]:
    """recall@4 at or above the bar in every locale, and every locale within 5 points of English (4.11 item 3)."""
    problems: list[Problem] = []
    english = next((r for r in recalls if r.locale == ENGLISH), None)
    if english is None:
        problems.append(_fail("replay", "NO_ENGLISH", "the English recall is missing"))
    for r in recalls:
        if r.recall < RECALL_BAR - EPSILON:
            problems.append(
                _fail(f"recall[{r.locale}]", "RECALL_LOW", f"recall@4 is {r.recall:.3f} ({r.hits} of {r.total}), under {RECALL_BAR}")
            )
        if english is not None and r.locale != ENGLISH and english.recall - r.recall > WITHIN_ENGLISH + EPSILON:
            problems.append(
                _fail(
                    f"recall[{r.locale}]",
                    "BELOW_ENGLISH",
                    f"recall@4 is {r.recall:.3f}, {100 * (english.recall - r.recall):.1f} points under English {english.recall:.3f} (the limit is 5)",
                )
            )
    return problems


def check_adversarial_retrieval(
    labelled: LabelledSet, run: Run, retriever: Retriever
) -> list[tuple[str, bool, str]]:
    """Hostile text that reaches retrieval changes nothing about WHAT is searched.

    For each NEUTRALISED case that made a retrieval request: the search runs without error, every chunk it returns is inside
    the scope of the intent, and the SQL text and every bound value but the query string are those of the clean question it
    wraps. The hostile text is only ever the query string.
    """
    english = run.locales.get(ENGLISH, {})
    adversarial = {r["id"]: r for r in english.get("adversarial", []) if isinstance(r, dict) and "id" in r}
    clean = {r["id"]: r for r in english.get("questions", []) if isinstance(r, dict) and "id" in r}
    verdicts: list[tuple[str, bool, str]] = []
    for adv in labelled.base.get("adversarial", []):
        row = adversarial.get(adv["id"])
        retrieval = row["replay"].get("retrieval") if row and isinstance(row.get("replay"), dict) else None
        if not isinstance(retrieval, dict):
            continue  # refused before retrieval: nothing reached the index
        request = to_request(retrieval)
        plan = plan_search(request, matrix=retriever.matrix, tags=retriever.tags, config=retriever.config)
        try:
            result = retriever.search(request)
        except Exception as error:  # noqa: BLE001 - any failure of the search is the finding
            verdicts.append((adv["id"], False, f"the search raised {type(error).__name__}"))
            continue
        scope_ok = all(
            chunk["domain"] in plan.domains or (chunk["domain"] == "D2" and chunk["mcd_id"] in plan.playbook_ids)
            for chunk in result.chunks
        )
        if not scope_ok or len(result.chunks) > 4 or result.status not in ("OK", "EMPTY"):
            verdicts.append((adv["id"], False, "a chunk outside the scope of the intent came back"))
            continue
        sibling_row = clean.get(adv.get("same_as"))
        sibling_retrieval = sibling_row["replay"].get("retrieval") if sibling_row else None
        if not isinstance(sibling_retrieval, dict):
            verdicts.append((adv["id"], False, f"the clean question {adv.get('same_as')} made no retrieval to compare with"))
            continue
        clean_plan = plan_search(to_request(sibling_retrieval), matrix=retriever.matrix, tags=retriever.tags, config=retriever.config)
        same_sql = plan.sql == clean_plan.sql
        same_values = {k: v for k, v in plan.parameters.items() if k != "q"} == {
            k: v for k, v in clean_plan.parameters.items() if k != "q"
        }
        ok = same_sql and same_values
        verdicts.append(
            (adv["id"], ok, "the SQL and its bound values equal the clean question's; the text is only the query string" if ok else "the SQL or its bound values differ from the clean question's")
        )
    return verdicts


def replay(
    directory: Path,
    *,
    retriever: Retriever,
    known_chunk_ids: set[str],
    glossary_version: str,
    routing_version: str,
    require_approved: bool = False,
    require_live_run: bool = False,
    search: SearchFn | None = None,
) -> ReplayReport:
    """The retrieval half of the release gate. Never raises for a bad set or a bad run: they are problems in the report."""
    labelled = load_set(directory)
    run = load_run(directory)
    problems = check_set(labelled, known_chunk_ids)
    problems += check_run(run, labelled, glossary_version=glossary_version, routing_version=routing_version)
    if require_approved:
        problems += check_approval(directory, labelled)
    if require_live_run and run.provenance != "LIVE":
        problems.append(
            _fail(
                "replay",
                "RUN_NOT_LIVE",
                f"the recorded run is {run.provenance}: no model answered it, so the model-dependent bars were not measured (--require-live-run)",
            )
        )

    recalls: list[LocaleRecall] = []
    adversarial: list[tuple[str, bool, str]] = []
    # a stale or damaged recording is not searched: its numbers would be about something else
    if not problems:
        base_search = search or retriever_search(retriever)
        cache: dict[tuple, list[str]] = {}

        def cached(request: SearchRequest) -> list[str]:
            key = (request.intent, request.question_en, request.m_star, request.state_codes, request.routing_version)
            if key not in cache:
                cache[key] = base_search(request)
            return cache[key]

        for locale in LOCALES:
            recalls.append(recall_of_locale(locale, labelled, run.locales[locale], cached))
        problems += judge_recall(recalls)
        adversarial = check_adversarial_retrieval(labelled, run, retriever)
        for adv_id, ok, why in adversarial:
            if not ok:
                problems.append(_fail(f"adversarial[{adv_id}]", "ADVERSARIAL_RETRIEVAL", why))
    return ReplayReport(
        provenance=run.provenance,
        fingerprint=str(run.manifest.get("fingerprint")),
        index_build_id=retriever.build_id,
        locales=recalls,
        adversarial=adversarial,
        problems=sorted(problems),
    )
