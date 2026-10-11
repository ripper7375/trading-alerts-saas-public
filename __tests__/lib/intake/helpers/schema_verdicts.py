"""What a JSON Schema says about a list of documents (a test helper of lib/intake).

  python -B schema_verdicts.py <schema.json> <documents.json>

<documents.json> is a JSON list. The answer, on stdout, is a JSON list of the same length:
`{"ok": true}` or `{"ok": false, "errors": ["<path>: <message>", ...]}` (at most five). The
schema itself is checked first (exit 2 if it is not a valid Draft 2020-12 schema). The output is
ASCII only, so no console encoding can spoil it.
"""

import json
import sys
from pathlib import Path

import jsonschema


# The schemas carry a contract id as their `$id` ("intake-packet/1"), which is not a URI. The
# resolver of jsonschema up to 4.17 (the version Ubuntu's `python3-jsonschema` ships, which the
# CI image has) joins that id with itself and then cannot find its own `#/$defs/...`
# ("unknown url type: 'intake-packet/intake-packet/1'"); 4.18 and later do not. The copy that is
# validated against gets an absolute id, so every version reads it the same way. The file on
# disk is not changed.
BASE = "https://schemas.invalid/"


def main() -> int:
    schema = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    if isinstance(schema.get("$id"), str) and "://" not in schema["$id"]:
        schema["$id"] = BASE + schema["$id"]
    documents = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
    try:
        jsonschema.Draft202012Validator.check_schema(schema)
    except jsonschema.SchemaError as error:
        sys.stderr.write(f"the schema is not valid: {error.message}\n")
        return 2
    validator = jsonschema.Draft202012Validator(schema)
    verdicts = []
    for document in documents:
        errors = sorted(validator.iter_errors(document), key=lambda e: list(map(str, e.absolute_path)))
        if not errors:
            verdicts.append({"ok": True})
        else:
            verdicts.append(
                {
                    "ok": False,
                    "errors": [
                        ".".join(map(str, e.absolute_path)) + ": " + e.message[:160] for e in errors[:5]
                    ],
                }
            )
    sys.stdout.write(json.dumps(verdicts, ensure_ascii=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
