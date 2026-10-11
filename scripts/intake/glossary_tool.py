#!/usr/bin/env python3
"""Review tables and approvals for the trading glossary and the fixed texts (build step 6, part 3).

The glossary (`config/intake/glossary.v1.json`, contract `glossary/1`) and the `intake.*`
texts of the 19 dictionaries (`lib/i18n/dictionaries/`: the replies to refusals, the two
instant prompts and the reason texts) are DRAFTS until a person who reads the language has
read them. This tool makes that reading possible and records it. It follows the pattern of
`scripts/engine4/worked_examples.py`.

There are 20 REVIEW AREAS, one folder each under `config/intake/review/`:

  terms/       the English term list: id, English term, definition, the sensors or domains
               that explain it, whether it is never translated, other English wordings.
               Davin approves it; what it says reaches every other part of Stack D.
  <locale>/    one per locale (en-US, en-GB, es, ..., tr): how each term is written in that
               language (the canonical form and the accepted variants) and the translation
               of every `intake.*` text (and, for the six locales part 3 translated, the
               four "Ask AI about" labels). A native reader approves it.

and four files in each folder:

  review.md      the area as tables for a person to read. Written by `record`; compared by `check`.
  approval.json  the sign-off. `record` writes it PENDING and NEVER writes APPROVED: a person
                 edits `status`, `approved_by` and `approved_on`. It holds the SHA-256 of the
                 content as it was reviewed, so any later change to that content shows up as
                 "changed after approval" and `record` puts the area back to PENDING.

and `config/intake/review/INDEX.md`, the table of the 20 areas.

STATUS OF THE FORMS. Every form in the glossary carries `status: draft | approved`. It is
DERIVED: `record` writes `approved` for every form of a locale whose area is APPROVED and still
true, and `draft` for the rest. The status is not part of what is reviewed (it is not hashed),
so approving an area does not change the hash that approved it. `record` is the only writer of
the glossary file: it writes it in one fixed layout (short string lists on one line), and the
file is kept out of Prettier.

NO GENERATED FILE LISTS A STATUS. `review.md` and `INDEX.md` hold content only, so editing an
`approval.json` makes nothing stale and the gate (`check --require-approved`) opens the moment
the last area is signed. The form statuses in the glossary are the one place a status is
stored; `check` judges them in one direction: a form marked `approved` in an area that is not
approved is a PROBLEM (a claim nobody made), a form still `draft` in an approved area is a NOTE
(the safe direction; `record` marks it). `list` shows the statuses of the areas.

USAGE (from the repository root):
    python scripts/intake/glossary_tool.py list
    python scripts/intake/glossary_tool.py check [--require-approved] [--only AREA ...]
    python scripts/intake/glossary_tool.py record [--only AREA ...]

`check` writes nothing. It exits 1 when the glossary or the texts break a rule, a review file
differs from a fresh run, an approval is stale, or a form claims an approval that does not
exist; with `--require-approved` also while any area is still PENDING (the
release gate: the flags stay off until a native read, plan decision D14). `--root DIR` points
every command at another tree with the same layout (the tests do). Standard library only.

Exit codes: 0 fine, 1 a difference, a stale approval or (with the gate) a PENDING area, 2 a
file is unusable.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import unicodedata
from pathlib import Path
from typing import Any, Mapping, Sequence

REPO = Path(__file__).resolve().parents[2]

GLOSSARY_SCHEMA = "glossary/1"
APPROVAL_SCHEMA = "glossary-approval/1"
PENDING = "PENDING"
APPROVED = "APPROVED"
FORM_DRAFT = "draft"
FORM_APPROVED = "approved"

# The 19 interface locales, in the order of `lib/i18n/languages.ts`.
LOCALES = (
    "en-US", "en-GB", "es", "de", "pt", "pt-BR", "it", "ja", "ar", "fr",
    "ko", "zh", "zh-TW", "ur", "hi", "vi", "id", "th", "tr",
)
LOCALE_NAMES = {
    "en-US": "English (US)", "en-GB": "English (UK)", "es": "Spanish", "de": "German",
    "pt": "Portuguese (Portugal)", "pt-BR": "Portuguese (Brazil)", "it": "Italian",
    "ja": "Japanese", "ar": "Arabic", "fr": "French", "ko": "Korean",
    "zh": "Chinese (Simplified)", "zh-TW": "Chinese (Traditional)", "ur": "Urdu",
    "hi": "Hindi", "vi": "Vietnamese", "id": "Indonesian", "th": "Thai", "tr": "Turkish",
}
TERMS_AREA = "terms"
AREAS = (TERMS_AREA,) + LOCALES

TEXT_PREFIX = "intake."
# Existing Panel C labels that part 3 translated for six locales that still had the English.
LABEL_KEYS = (
    "Ask AI about M5 Chart",
    "Ask AI about M15 Chart",
    "Click to ask AI about M5 chart situation",
    "Click to ask AI about M15 chart situation",
)
LABEL_LOCALES = ("ar", "fr", "it", "ko", "zh", "zh-TW")

TERM_ID = re.compile(r"[a-z][a-z0-9_]{0,39}")
OWNER = re.compile(r"MCD(?:[0-9]|1[0-5])|SYN|D[1-5]")
VERSION = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,39}")
DATE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}")
PLACEHOLDER = re.compile(r"\{(\w+)\}")
HEX64 = re.compile(r"[0-9a-f]{64}")

MAX_TERMS = 400
FORM_MAX = 80
DEFINITION_MAX = 300
VARIANTS_MAX = 12
OWNERS_MAX = 4

OWNER_MEANING = {
    "MCD1": "sensor MCD1 (M15 primary trend), explained by its playbook",
    "MCD2": "sensor MCD2 (M5 trend and corridor), explained by its playbook",
    "MCD3": "sensor MCD3 (consolidated trend and stochastic), explained by its playbook",
    "SYN": "the synthesis reading",
    "D1": "domain D1, foundations (the chart, the channel, the data)",
    "D2": "domain D2, the sensor playbooks",
    "D3": "domain D3, the synthesis",
    "D4": "domain D4, the trade setup and sizing (Engine 4)",
    "D5": "domain D5, governance and the words of data status",
}

_HAN = r"\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff"
_LATIN = r"A-Za-z\u00c0-\u024f\u1e00-\u1eff"
SCRIPT = {
    "ja": re.compile("[\u3040-\u30ff" + _HAN + "]"),
    "zh": re.compile("[" + _HAN + "]"),
    "zh-TW": re.compile("[" + _HAN + "]"),
    "ko": re.compile("[\u1100-\u11ff\u3130-\u318f\uac00-\ud7a3]"),
    "ar": re.compile("[\u0600-\u06ff\u0750-\u077f\ufb50-\ufdff\ufe70-\ufeff]"),
    "ur": re.compile("[\u0600-\u06ff\u0750-\u077f\ufb50-\ufdff\ufe70-\ufeff]"),
    "hi": re.compile("[\u0900-\u097f]"),
    "th": re.compile("[\u0e00-\u0e7f]"),
}
LATIN = re.compile("[" + _LATIN + "]")


class ToolError(Exception):
    """A file or a request is not usable. `problems` lists every reason."""

    def __init__(self, problems: Sequence[str] | str) -> None:
        self.problems = [problems] if isinstance(problems, str) else list(problems)
        super().__init__("; ".join(self.problems))


# --------------------------------------------------------------------------- text and hashes


def lf(text: str) -> str:
    return text.replace("\r\n", "\n")


def text_sha256(text: str) -> str:
    return hashlib.sha256(lf(text).encode("utf-8")).hexdigest()


def read_text(path: Path) -> str:
    return lf(path.read_text(encoding="utf-8"))


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(lf(text).encode("utf-8"))  # LF on disk, whatever the platform


def dump_approval(data: Any) -> str:
    return json.dumps(data, indent=2, ensure_ascii=True, allow_nan=False) + "\n"


def content_sha256(content: Any) -> str:
    """The hash of what was reviewed: the content as sorted, compact, ASCII-only JSON. It never raises: content that breaks a rule is `check`'s to report (a NaN token hashes as NaN)."""
    text = json.dumps(content, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=True)
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _scalar(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, allow_nan=False)


def _dump_value(value: Any, level: int) -> str:
    pad = "  " * level
    if isinstance(value, dict):
        if not value:
            return "{}"
        inner = ",\n".join("%s  %s: %s" % (pad, _scalar(k), _dump_value(v, level + 1)) for k, v in value.items())
        return "{\n" + inner + "\n" + pad + "}"
    if isinstance(value, list):
        if not value:
            return "[]"
        if all(not isinstance(x, (dict, list)) for x in value):
            return "[" + ", ".join(_scalar(x) for x in value) + "]"
        inner = ",\n".join("%s  %s" % (pad, _dump_value(x, level + 1)) for x in value)
        return "[\n" + inner + "\n" + pad + "]"
    return _scalar(value)


def dump_glossary(glossary: Any) -> str:
    """The one layout of the glossary file: two-space objects, a list of strings on one line."""
    return _dump_value(glossary, 0) + "\n"


def first_difference(stored: str, built: str) -> str:
    a, b = stored.split("\n"), built.split("\n")
    for index in range(max(len(a), len(b))):
        left = a[index] if index < len(a) else "<end of file>"
        right = b[index] if index < len(b) else "<end of file>"
        if left != right:
            return "line %d: stored %r but a fresh run gives %r" % (index + 1, left[:100], right[:100])
    return "no difference found"


def _visible(char: str) -> bool:
    """False for what `normalizeQuestion` removes: format characters, control characters that are not white space, variation selectors."""
    category = unicodedata.category(char)
    if category == "Cf" or 0xFE00 <= ord(char) <= 0xFE0F:
        return False
    return not (category == "Cc" and not char.isspace())


def match_key(spelling: str) -> str:
    """What two spellings must share to count as the same form (as `matchKey` in glossary.ts): invisible characters out, NFKC, one space, lower case."""
    text = unicodedata.normalize("NFKC", "".join(c for c in spelling if _visible(c)))
    return " ".join(text.split()).lower()


# --------------------------------------------------------------------------- the files


class Tree:
    """Where the files are. `root` is the repository, or a copy of the same layout."""

    def __init__(self, root: Path) -> None:
        self.root = root
        self.glossary = root / "config" / "intake" / "glossary.v1.json"
        self.review = root / "config" / "intake" / "review"
        self.dictionaries = root / "lib" / "i18n" / "dictionaries"

    def folder(self, area: str) -> Path:
        return self.review / area


def load_json(path: Path) -> Any:
    if not path.is_file():
        raise ToolError("%s is missing" % path.as_posix())
    try:
        return json.loads(read_text(path))
    except json.JSONDecodeError as exc:
        raise ToolError("%s is not valid JSON (%s)" % (path.as_posix(), exc))


def load_glossary(tree: Tree) -> tuple[dict[str, Any], str]:
    data = load_json(tree.glossary)
    if not isinstance(data, dict) or not isinstance(data.get("terms"), list):
        raise ToolError("%s is not a glossary (an object with a list of terms)" % tree.glossary.as_posix())
    return data, read_text(tree.glossary)


def load_dictionaries(tree: Tree) -> dict[str, dict[str, str]]:
    out: dict[str, dict[str, str]] = {}
    for locale in LOCALES:
        data = load_json(tree.dictionaries / ("%s.json" % locale))
        if not isinstance(data, dict):
            raise ToolError("%s.json is not an object" % locale)
        out[locale] = data
    return out


def text_keys(dictionaries: Mapping[str, Mapping[str, str]]) -> list[str]:
    """The `intake.*` keys: those of the en-US dictionary, which is the registry's English."""
    return [key for key in dictionaries["en-US"] if key.startswith(TEXT_PREFIX)]


# --------------------------------------------------------------------------- what is reviewed


def term_rows(glossary: Mapping[str, Any]) -> list[dict[str, Any]]:
    rows = []
    for term in glossary["terms"]:
        rows.append({
            "id": term.get("id"),
            "en": term.get("en"),
            "en_variants": term.get("en_variants"),
            "definition": term.get("definition"),
            "owners": term.get("owners"),
            "never_translate": term.get("never_translate"),
        })
    return rows


def area_content(glossary: Mapping[str, Any], dictionaries: Mapping[str, Mapping[str, str]], area: str) -> dict[str, Any]:
    """Exactly what a reader sees and signs for an area. The `status` of a form is not in it."""
    if area == TERMS_AREA:
        return {"terms": term_rows(glossary)}
    forms = []
    for term in glossary["terms"]:
        form = (term.get("forms") or {}).get(area) or {}
        forms.append({"id": term.get("id"), "canonical": form.get("canonical"), "variants": form.get("variants")})
    dictionary = dictionaries[area]
    content: dict[str, Any] = {
        "forms": forms,
        "texts": {key: dictionary.get(key) for key in text_keys(dictionaries)},
    }
    if area in LABEL_LOCALES:
        content["labels"] = {key: dictionary.get(key) for key in LABEL_KEYS}
    return content


# --------------------------------------------------------------------------- the rules


def _is_text(value: Any) -> bool:
    return isinstance(value, str)


def glossary_problems(glossary: Any) -> list[str]:
    """Every rule of `glossary/1` (the TypeScript validator's) plus the completeness part 3 adds: all 19 locales for every term."""
    problems: list[str] = []
    if not isinstance(glossary, dict):
        return ["the glossary is not an object"]
    extra = sorted(set(glossary) - {"schema", "version", "terms"})
    problems += ["glossary: unknown key %r" % key for key in extra]
    if glossary.get("schema") != GLOSSARY_SCHEMA:
        problems.append("glossary: schema must be %r" % GLOSSARY_SCHEMA)
    version = glossary.get("version")
    if not (_is_text(version) and VERSION.fullmatch(version)):
        problems.append("glossary: version %r is not a version" % (version,))
    terms = glossary.get("terms")
    if not isinstance(terms, list) or not 1 <= len(terms) <= MAX_TERMS:
        return problems + ["glossary: terms must be a list of 1 to %d" % MAX_TERMS]
    ids: set[str] = set()
    english: dict[str, str] = {}
    holders: dict[tuple[str, str], str] = {}
    for index, term in enumerate(terms):
        where = "terms[%d]" % index
        if not isinstance(term, dict):
            problems.append("%s: not an object" % where)
            continue
        keys = {"id", "en", "en_variants", "definition", "owners", "never_translate", "forms"}
        problems += ["%s: unknown key %r" % (where, key) for key in sorted(set(term) - keys)]
        problems += ["%s: missing key %r" % (where, key) for key in sorted(keys - set(term))]
        term_id = term.get("id")
        if _is_text(term_id) and TERM_ID.fullmatch(term_id):
            where = term_id
            if term_id in ids:
                problems.append("%s: the id appears twice" % where)
            ids.add(term_id)
        else:
            problems.append("%s: id %r is not a term id" % (where, term_id))
        en = term.get("en")
        if not (_is_text(en) and 2 <= len(match_key(en)) and len(en) <= FORM_MAX):
            problems.append("%s: en must be a text of 2 to %d characters" % (where, FORM_MAX))
        elif match_key(en) in english:
            problems.append("%s: en is the English form of %s" % (where, english[match_key(en)]))
        else:
            english[match_key(en)] = str(term_id)
        variants = term.get("en_variants")
        if not (isinstance(variants, list) and len(variants) <= VARIANTS_MAX and all(_is_text(v) and v.strip() and len(v) <= FORM_MAX for v in variants)):
            problems.append("%s: en_variants must be at most %d texts" % (where, VARIANTS_MAX))
        definition = term.get("definition")
        if not (_is_text(definition) and definition.strip() and len(definition) <= DEFINITION_MAX):
            problems.append("%s: definition must be a text of at most %d characters" % (where, DEFINITION_MAX))
        owners = term.get("owners")
        if not (isinstance(owners, list) and 1 <= len(owners) <= OWNERS_MAX and len(set(map(str, owners))) == len(owners)
                and all(_is_text(o) and OWNER.fullmatch(o) for o in owners)):
            problems.append("%s: owners must be 1 to %d distinct sensors or domains" % (where, OWNERS_MAX))
        never = term.get("never_translate")
        if not isinstance(never, bool):
            problems.append("%s: never_translate must be true or false" % where)
        forms = term.get("forms")
        if not isinstance(forms, dict):
            problems.append("%s: forms must be an object" % where)
            continue
        missing = [locale for locale in LOCALES if locale not in forms]
        if missing:
            problems.append("%s: no form for %s" % (where, ", ".join(missing)))
        problems += ["%s: %r is not a locale" % (where, locale) for locale in forms if locale not in LOCALES]
        for locale in LOCALES:
            form = forms.get(locale)
            if form is None:
                continue
            spot = "%s/%s" % (where, locale)
            if not isinstance(form, dict) or set(form) != {"canonical", "variants", "status"}:
                problems.append("%s: a form is exactly canonical, variants and status" % spot)
                continue
            if form["status"] not in (FORM_DRAFT, FORM_APPROVED):
                problems.append("%s: status must be %s or %s" % (spot, FORM_DRAFT, FORM_APPROVED))
            canonical, form_variants = form["canonical"], form["variants"]
            if not _is_text(canonical):
                problems.append("%s: canonical must be a text" % spot)
                continue
            if not (isinstance(form_variants, list) and len(form_variants) <= VARIANTS_MAX and all(_is_text(v) for v in form_variants)):
                problems.append("%s: variants must be at most %d texts" % (spot, VARIANTS_MAX))
                continue
            for spelling in [canonical, *form_variants]:
                key = match_key(spelling)
                if len(key) < 2 or len(spelling) > FORM_MAX:
                    problems.append("%s: %r must have 2 to %d characters once normalised" % (spot, spelling, FORM_MAX))
                    continue
                slot = (locale, key)
                if slot in holders:
                    same = holders[slot] == str(term_id)
                    problems.append("%s: %r is written twice for this term" % (spot, spelling) if same
                                    else "%s: %r is already a form of %s in this locale" % (spot, spelling, holders[slot]))
                else:
                    holders[slot] = str(term_id)
            if never is True:
                if canonical != en or form_variants:
                    problems.append("%s: a term that is never translated is its English form %r alone" % (spot, en))
            else:
                pattern = SCRIPT.get(locale, LATIN)
                if not pattern.search(canonical):
                    problems.append("%s: %r is not written in the script of this language" % (spot, canonical))
    return problems


def text_problems(dictionaries: Mapping[str, Mapping[str, str]]) -> list[str]:
    """The `intake.*` texts: every locale has every key, none is empty, `{name}` placeholders match the English."""
    problems: list[str] = []
    keys = text_keys(dictionaries)
    if not keys:
        return ["en-US has no %s* key" % TEXT_PREFIX]
    english = dictionaries["en-US"]
    for locale in LOCALES:
        dictionary = dictionaries[locale]
        extra = sorted(k for k in dictionary if k.startswith(TEXT_PREFIX) and k not in english)
        problems += ["%s: %s is not a key of en-US" % (locale, key) for key in extra]
        wanted = list(keys) + (list(LABEL_KEYS) if locale in LABEL_LOCALES else [])
        for key in wanted:
            value = dictionary.get(key)
            if not _is_text(value) or not value.strip():
                problems.append("%s: %s is missing or empty" % (locale, key))
                continue
            if value != value.strip():
                problems.append("%s: %s has spaces around it" % (locale, key))
            if key in keys and sorted(PLACEHOLDER.findall(value)) != sorted(PLACEHOLDER.findall(english[key])):
                problems.append("%s: %s has the placeholders %s, not %s" % (
                    locale, key, sorted(PLACEHOLDER.findall(value)), sorted(PLACEHOLDER.findall(english[key]))))
            if locale in LABEL_LOCALES and key in LABEL_KEYS and value == key:
                problems.append("%s: %s is still the English" % (locale, key))
    return problems


def require_valid(glossary: Any, dictionaries: Mapping[str, Mapping[str, str]] | None = None) -> None:
    """Refuse to go on with content that breaks a rule: an approval must never be minted over it, and the code that renders it assumes the shape the rules guarantee."""
    problems = glossary_problems(glossary) + (text_problems(dictionaries) if dictionaries is not None else [])
    if problems:
        shown = problems[:10]
        if len(problems) > 10:
            shown.append("... and %d more" % (len(problems) - 10))
        raise ToolError(["the content breaks %d rule(s), so nothing was written or listed (run check for the full list):" % len(problems)] + shown)


# --------------------------------------------------------------------------- approvals


def approval_keys() -> set[str]:
    return {"schema", "area", "status", "approved_by", "approved_on", "content_sha256", "note"}


def new_approval(area: str, digest: str, old: Mapping[str, Any] | None) -> dict[str, Any]:
    """PENDING unless an approval is still true of exactly this content. Never APPROVED on its own."""
    fresh = {
        "schema": APPROVAL_SCHEMA,
        "area": area,
        "status": PENDING,
        "approved_by": None,
        "approved_on": None,
        "content_sha256": digest,
        "note": "",
    }
    if not isinstance(old, Mapping):
        return fresh
    if old.get("status") == APPROVED and not approval_problems(old, area, digest):
        return dict(old)
    if old.get("status") == APPROVED:
        fresh["note"] = (
            "Reset by record: the content changed after %s approved it on %s. It needs a new approval."
            % (old.get("approved_by"), old.get("approved_on"))
        )
    elif isinstance(old.get("note"), str):
        fresh["note"] = old["note"]
    return fresh


def approval_problems(approval: Any, area: str, digest: str) -> list[str]:
    if not isinstance(approval, Mapping):
        return ["approval.json is not an object"]
    keys = approval_keys()
    problems = ["approval.json: unknown key %r" % key for key in sorted(set(approval) - keys)]
    problems += ["approval.json: missing key %r" % key for key in sorted(keys - set(approval))]
    if problems:
        return problems
    if approval["schema"] != APPROVAL_SCHEMA:
        problems.append("approval.json: schema must be %r" % APPROVAL_SCHEMA)
    if approval["area"] != area:
        problems.append("approval.json: area is %r, not %r" % (approval["area"], area))
    if not _is_text(approval["note"]):
        problems.append("approval.json: note must be a text")
    if approval["status"] not in (PENDING, APPROVED):
        return problems + ["approval.json: status must be %s or %s" % (PENDING, APPROVED)]
    if not (_is_text(approval["content_sha256"]) and HEX64.fullmatch(approval["content_sha256"])):
        problems.append("approval.json: content_sha256 is not a SHA-256")
    elif approval["content_sha256"] != digest:
        problems.append(
            "approval.json: content_sha256 is not the hash of the content"
            + (" (changed after approval)" if approval["status"] == APPROVED else "")
        )
    if approval["status"] == APPROVED:
        if not (_is_text(approval["approved_by"]) and approval["approved_by"].strip()):
            problems.append("approval.json: APPROVED needs approved_by")
        if not (_is_text(approval["approved_on"]) and DATE.fullmatch(approval["approved_on"])):
            problems.append("approval.json: APPROVED needs approved_on as YYYY-MM-DD")
    return problems


def read_approval(folder: Path) -> Any:
    path = folder / "approval.json"
    if not path.is_file():
        return None
    try:
        return json.loads(read_text(path))
    except json.JSONDecodeError:
        return None


def status_of(approval: Any, area: str, digest: str) -> str:
    """APPROVED only for an approval that is whole and true of the content now."""
    if isinstance(approval, Mapping) and approval.get("status") == APPROVED and not approval_problems(approval, area, digest):
        return APPROVED
    return PENDING


def with_statuses(glossary: Mapping[str, Any], approved: set[str]) -> dict[str, Any]:
    """A copy of the glossary whose form statuses follow the approvals: approved for an approved locale, draft otherwise."""
    out = json.loads(json.dumps(glossary))
    for term in out["terms"]:
        for locale, form in (term.get("forms") or {}).items():
            if isinstance(form, dict):
                form["status"] = FORM_APPROVED if locale in approved else FORM_DRAFT
    return out


# --------------------------------------------------------------------------- the tables


def cell(text: Any) -> str:
    out = "" if text is None else str(text)
    return out.replace("|", "\\|").replace("\n", " ")


def table(header: Sequence[str], rows: Sequence[Sequence[Any]]) -> str:
    lines = ["| " + " | ".join(header) + " |", "|" + "|".join(" --- " for _ in header) + "|"]
    lines += ["| " + " | ".join(cell(c) for c in row) + " |" for row in rows]
    return "\n".join(lines)


def footer(area: str) -> str:
    return (
        "## Sign-off\n\n"
        "Read the tables above, then edit `approval.json` in this folder: set `status` to `APPROVED`, "
        "`approved_by` to your name and `approved_on` to the date (YYYY-MM-DD). It holds the SHA-256 of "
        "the content you read, so a later change to it puts this area back to PENDING "
        "(`python scripts/intake/glossary_tool.py record`). Then run `record` once more so the forms "
        "of %s are marked `approved` in the glossary.\n" % ("the English term list" if area == TERMS_AREA else LOCALE_NAMES[area])
    )


def render_terms(glossary: Mapping[str, Any], dictionaries: Mapping[str, Mapping[str, str]]) -> str:
    rows = term_rows(glossary)
    english = dictionaries["en-US"]
    out = [
        "# Glossary review: the English term list",
        "",
        "*Written by `python scripts/intake/glossary_tool.py record`; `check` compares it with a fresh run. Do not edit it.*",
        "",
        "Glossary `%s`, version `%s`: **%d terms**, of which %d are never translated."
        % (glossary.get("schema"), glossary.get("version"), len(rows), sum(1 for r in rows if r["never_translate"])),
        "",
        "## What to check",
        "",
        "1. Is each term one a gold trader would meet in a question about the chart, and is anything missing?",
        "2. Is the one-sentence definition true, and in plain words?",
        "3. Is the owner right? It is the sensor or the domain whose explanation the Explain intent fetches for the term.",
        "4. Are the level names (UOEDT, LOEDT, baseline) the only terms that are never translated?",
        "5. Are the other English wordings words a trader might leave in a translated question? The term-preservation check accepts them as the English term.",
        "",
        "## Owners",
        "",
        table(["Owner", "Meaning"], [(o, OWNER_MEANING.get(o, "")) for o in sorted({o for r in rows for o in (r["owners"] or [])})]),
        "",
        "## The terms",
        "",
        table(
            ["#", "id", "English term", "Definition", "Owners", "Never translated", "Other English wordings"],
            [
                (i, "`%s`" % r["id"], r["en"], r["definition"], ", ".join(r["owners"] or []),
                 "yes" if r["never_translate"] else "", ", ".join(r["en_variants"] or []))
                for i, r in enumerate(rows, 1)
            ],
        ),
        "",
    ]
    texts = [(key, english[key]) for key in text_keys(dictionaries)]
    out += [
        "## The fixed English texts",
        "",
        "These are the English of the `intake.*` keys (`lib/intake/text.ts`). Each locale's own review shows its translation next to them.",
        "",
        table(["Key", "English"], texts),
        "",
        footer(TERMS_AREA),
    ]
    return "\n".join(out)


def render_locale(glossary: Mapping[str, Any], dictionaries: Mapping[str, Mapping[str, str]], locale: str) -> str:
    english = dictionaries["en-US"]
    dictionary = dictionaries[locale]
    rows = []
    for index, term in enumerate(glossary["terms"], 1):
        form = (term.get("forms") or {}).get(locale) or {}
        rows.append((
            index, "`%s`" % term.get("id"), term.get("en"), form.get("canonical"),
            " · ".join(form.get("variants") or []),
        ))
    out = [
        "# Glossary review: %s (`%s`)" % (LOCALE_NAMES[locale], locale),
        "",
        "*Written by `python scripts/intake/glossary_tool.py record`; `check` compares it with a fresh run. Do not edit it.*",
        "",
        "Glossary version `%s`. These are DRAFTS until you approve them." % glossary.get("version"),
        "",
        "## What to check",
        "",
        "1. Is the canonical form the word a trader of this language really uses for the term?",
        "2. Are the other accepted spellings words a trader would also type (a short form, a plural, a verb form)? A question that contains any of them is recognised as containing the term.",
        "3. Does any spelling also mean something else in this language? It would mark an unrelated question.",
        "4. Do the texts below read naturally, say what the English says, and keep each `{name}` placeholder?",
        "",
        "## Terms",
        "",
        table(["#", "id", "English term", "Canonical form", "Other accepted spellings"], rows),
        "",
        "## Fixed replies, instant prompts and reason texts",
        "",
        table(["Key", "English", "%s" % LOCALE_NAMES[locale]], [(k, english[k], dictionary.get(k)) for k in text_keys(dictionaries)]),
        "",
    ]
    if locale in LABEL_LOCALES:
        out += [
            "## The Panel C labels translated in part 3",
            "",
            table(["Key (the English)", "%s" % LOCALE_NAMES[locale]], [(k, dictionary.get(k)) for k in LABEL_KEYS]),
            "",
        ]
    out.append(footer(locale))
    return "\n".join(out)


def render_review(glossary: Mapping[str, Any], dictionaries: Mapping[str, Mapping[str, str]], area: str) -> str:
    return render_terms(glossary, dictionaries) if area == TERMS_AREA else render_locale(glossary, dictionaries, area)


def render_index(glossary: Mapping[str, Any], digests: Sequence[tuple[str, str]], text_count: int) -> str:
    """The table of the areas. It lists NO approval status: a status in a generated file goes stale the moment someone approves, and the gate would then fail on a generated file. `list` shows the statuses."""
    rows = []
    for area, digest in digests:
        what = "the English term list" if area == TERMS_AREA else "%s: %d forms, %d texts" % (
            LOCALE_NAMES[area], len(glossary["terms"]), text_count)
        rows.append((area, "`%s`" % digest[:12], what))
    return "\n".join([
        "# Glossary and fixed texts: review areas",
        "",
        "*Written by `python scripts/intake/glossary_tool.py record`; `check` compares it with a fresh run. Do not edit it.*",
        "",
        "Glossary version `%s`: %d review areas. Each has `review.md` (what to read) and `approval.json` (the sign-off) in its folder. "
        "`python scripts/intake/glossary_tool.py list` shows which areas are approved."
        % (glossary.get("version"), len(digests)),
        "",
        table(["Area", "Content hash", "What"], rows),
        "",
    ])


# --------------------------------------------------------------------------- record and check


class AreaState:
    def __init__(self, area: str, content: Mapping[str, Any]) -> None:
        self.area = area
        self.digest = content_sha256(content)
        self.approval: Any = None
        self.status = PENDING


def _states(tree: Tree, glossary: Mapping[str, Any], dictionaries: Mapping[str, Mapping[str, str]], only: Sequence[str]) -> list[AreaState]:
    unknown = sorted(set(only) - set(AREAS))
    if unknown:
        raise ToolError("no such area: %s (areas: %s)" % (", ".join(unknown), ", ".join(AREAS)))
    states = []
    for area in AREAS:
        if only and area not in only:
            continue
        state = AreaState(area, area_content(glossary, dictionaries, area))
        state.approval = read_approval(tree.folder(area))
        state.status = status_of(state.approval, area, state.digest)
        states.append(state)
    return states


def _index_text(glossary: Mapping[str, Any], dictionaries: Mapping[str, Mapping[str, str]]) -> str:
    digests = [(area, content_sha256(area_content(glossary, dictionaries, area))) for area in AREAS]
    return render_index(glossary, digests, len(text_keys(dictionaries)))


def record(tree: Tree, only: Sequence[str] = ()) -> list[str]:
    """Write review.md, a PENDING approval.json where the approval is not still true, INDEX.md and the glossary with its derived form statuses. Returns what was written."""
    glossary, _ = load_glossary(tree)
    dictionaries = load_dictionaries(tree)
    require_valid(glossary, dictionaries)
    written: list[str] = []
    approvals: dict[str, Any] = {}
    digests = {area: content_sha256(area_content(glossary, dictionaries, area)) for area in AREAS}
    for area in AREAS:
        old = read_approval(tree.folder(area))
        approvals[area] = old if (only and area not in only) else new_approval(area, digests[area], old)
    approved = {a for a in AREAS if status_of(approvals[a], a, digests[a]) == APPROVED}
    for area in AREAS:
        if only and area not in only:
            continue
        for name, text in (("review.md", render_review(glossary, dictionaries, area)), ("approval.json", dump_approval(approvals[area]))):
            path = tree.folder(area) / name
            if not path.is_file() or read_text(path) != text:
                write_text(path, text)
                written.append("%s/%s" % (area, name))
    text = dump_glossary(with_statuses(glossary, approved))
    if read_text(tree.glossary) != text:
        write_text(tree.glossary, text)
        written.append("config/intake/glossary.v1.json")
    index = _index_text(glossary, dictionaries)
    if not (tree.review / "INDEX.md").is_file() or read_text(tree.review / "INDEX.md") != index:
        write_text(tree.review / "INDEX.md", index)
        written.append("INDEX.md")
    return written


class Report:
    def __init__(self, area: str) -> None:
        self.area = area
        self.problems: list[str] = []
        self.status = PENDING


def status_findings(glossary: Mapping[str, Any], approved: set[str]) -> tuple[list[str], list[str]]:
    """The form statuses against the approvals. A form marked `approved` in an area that is not approved is a PROBLEM (it claims a reading nobody made). A form still `draft` in an approved area is only a NOTE: it is the safe direction, `record` marks it, and the gate must not fail on a file only `record` writes."""
    problems: list[str] = []
    notes: list[str] = []
    for locale in LOCALES:
        marked = still = 0
        for term in glossary["terms"]:
            form = (term.get("forms") or {}).get(locale)
            if not isinstance(form, dict):
                continue
            if form.get("status") == FORM_APPROVED and locale not in approved:
                marked += 1
            if form.get("status") == FORM_DRAFT and locale in approved:
                still += 1
        if marked:
            problems.append("%s: %d form(s) are marked approved but the area %s is not approved (run record)" % (locale, marked, locale))
        if still:
            notes.append("%s: %d form(s) are still draft though the area is approved (record marks them approved)" % (locale, still))
    return problems, notes


def check(tree: Tree, only: Sequence[str] = ()) -> tuple[list[Report], list[str], list[str]]:
    """Check the rules and compare every stored file with a fresh run. Returns one report per area, the problems of the set and the notes."""
    glossary, glossary_text = load_glossary(tree)
    dictionaries = load_dictionaries(tree)
    unknown = sorted(set(only) - set(AREAS))
    if unknown:
        raise ToolError("no such area: %s (areas: %s)" % (", ".join(unknown), ", ".join(AREAS)))
    broken = glossary_problems(glossary) + text_problems(dictionaries)
    if broken:
        # content that breaks its rules cannot be rendered or hashed: report the rules and stop
        return [], broken, ["the %d areas were not checked: the content breaks its rules" % len(AREAS)]
    reports: list[Report] = []
    states = _states(tree, glossary, dictionaries, only)
    for state in states:
        report = Report(state.area)
        folder = tree.folder(state.area)
        review_path = folder / "review.md"
        fresh = render_review(glossary, dictionaries, state.area)
        if not review_path.is_file():
            report.problems.append("review.md is missing (run record)")
        elif read_text(review_path) != fresh:
            report.problems.append("review.md differs from a fresh run: %s" % first_difference(read_text(review_path), fresh))
        path = folder / "approval.json"
        if not path.is_file():
            report.problems.append("approval.json is missing (run record)")
        else:
            try:
                approval = json.loads(read_text(path))
            except json.JSONDecodeError as exc:
                approval = None
                report.problems.append("approval.json is not valid JSON (%s)" % exc)
            if approval is not None:
                report.problems += approval_problems(approval, state.area, state.digest)
                report.status = state.status
        reports.append(report)
    set_problems: list[str] = []
    notes: list[str] = []
    if not only:
        # the layout is compared as the file stands: its statuses are judged below, not rewritten here
        expected = dump_glossary(glossary)
        if glossary_text != expected:
            set_problems.append("config/intake/glossary.v1.json is not in the layout record writes: %s" % first_difference(glossary_text, expected))
        found, notes = status_findings(glossary, {state.area for state in states if state.status == APPROVED})
        set_problems += found
        index = _index_text(glossary, dictionaries)
        index_path = tree.review / "INDEX.md"
        if not index_path.is_file():
            set_problems.append("INDEX.md is missing (run record)")
        elif read_text(index_path) != index:
            set_problems.append("INDEX.md differs from a fresh run: %s" % first_difference(read_text(index_path), index))
    return reports, set_problems, notes


def listing(tree: Tree) -> list[str]:
    glossary, _ = load_glossary(tree)
    dictionaries = load_dictionaries(tree)
    require_valid(glossary)
    lines = []
    for state in _states(tree, glossary, dictionaries, ()):
        what = ("%d terms" % len(glossary["terms"])) if state.area == TERMS_AREA else (
            "%d forms, %d texts" % (len(glossary["terms"]), len(text_keys(dictionaries))))
        lines.append("%-6s [%s]  %s" % (state.area, state.status, what))
    return lines


# --------------------------------------------------------------------------- command line


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="glossary_tool.py", description=__doc__.split("\n\n")[0])
    parser.add_argument("--root", default=str(REPO), help="the tree to work on (default: the repository)")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("list", help="the 20 review areas and their approval status")
    check_parser = sub.add_parser("check", help="check the rules and compare every stored file with a fresh run; write nothing")
    check_parser.add_argument("--require-approved", action="store_true", help="also fail while any area is still PENDING (the release gate)")
    check_parser.add_argument("--only", nargs="+", default=[], metavar="AREA")
    record_parser = sub.add_parser("record", help="write review.md, INDEX.md, the glossary statuses and (PENDING) approval.json; never writes APPROVED")
    record_parser.add_argument("--only", nargs="+", default=[], metavar="AREA")
    args = parser.parse_args(argv)
    tree = Tree(Path(args.root))
    try:
        if args.command == "list":
            for line in listing(tree):
                print(line)
            return 0
        if args.command == "record":
            written = record(tree, args.only)
            for name in written:
                print("wrote  %s" % name)
            print("%d file(s) written" % len(written) if written else "nothing to write: every file is already what a fresh run makes")
            return 0
        reports, set_problems, notes = check(tree, args.only)
    except ToolError as exc:
        for problem in exc.problems:
            print("ERROR  %s" % problem, file=sys.stderr)
        return 2
    failed = pending = 0
    for report in reports:
        if report.problems:
            failed += 1
            print("DIFFERENT  %s  (%s)" % (report.area, report.status))
            for problem in report.problems:
                print("    %s" % problem)
        else:
            print("same  %s  (%s)" % (report.area, report.status))
        pending += report.status != APPROVED
    for problem in set_problems:
        failed += 1
        print("DIFFERENT  %s" % problem)
    for note in notes:
        print("note  %s" % note)
    print("%d area(s), %d approved, %d pending approval, %d problem(s)" % (len(reports), len(reports) - pending, pending, failed))
    if failed:
        return 1
    if args.require_approved and pending:
        print("%d area(s) are not approved yet (--require-approved)" % pending, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
