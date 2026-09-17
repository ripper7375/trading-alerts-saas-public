"""Does every identifier the frozen-mode code references actually exist in that file?

Run:  python verify_mq5_frozen_identifiers.py

MQL5 cannot be compiled outside MetaEditor, so this stands in for the compiler's
own symbol resolution over the regions the 2026-09-18 frozen-baseline work added
to the 7 centroid indicators. Run it after ANY edit to those regions, before
handing the files to MetaEditor.


This is the check whose absence let 5 of 7 indicators fail to compile. The Step 1
and Step 3 verifiers proved the insertion POINTS were sound -- anchors unique,
braces balanced, blocks outside the certified routine. None of them asked whether
the identifiers the inserted code CONSUMES are declared in the file it landed in.

The 7 centroid variants look interchangeable and are not:

    InpCFLVisualLookback   exists only in BestFit A/B; the other 5 call it
                           InpEDTVisualLookback
    g_stat_excluded        absent from CherryPick A/B and MostRecent
    g_stat_lambda          absent from CherryPick B, MostRecent, NonRecent A/B

MQL5 cannot be compiled here, so this stands in for the compiler's own symbol
resolution over exactly the regions this session added.
"""
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent / "mq5"

# Regions this session inserted. Everything referenced inside them must resolve.
REGIONS = [
    ("ProjectFrozenChannel", r"void ProjectFrozenChannel\(", r"\nbool ExportData"),
    ("centroid capture", r"   // --- CENTROID DETAIL CAPTURE", r"\n   \}\n"),
    ("stat export", r"   // ---- FROZEN SNAPSHOT", r"   FileClose\(fh_stat\);"),
    ("OnInit preflight", r"   // --- FROZEN MODE PRE-FLIGHT", r"   return\(INIT_SUCCEEDED\);"),
    ("ResetCentroidDetail", r"void ResetCentroidDetail\(\)", r"\n//\+---"),
]

# MQL5 built-ins, keywords and this session's own additions. Anything NOT in here
# must be found declared in the file.
BUILTIN = set("""
int double bool string datetime long ulong short char uchar uint ushort color void
if else for while do return break continue switch case default const static input
true false sizeof new delete struct class enum typedef extern virtual override
MathPow MathArctan MathAbs MathSqrt MathExp MathRound MathMax MathMin MathLog
M_PI EMPTY_VALUE INT_MAX INT_MIN DBL_MAX WHOLE_ARRAY
PeriodSeconds TimeLocal TimeCurrent TimeGMT TimeTradeServer TimeToString
Print PrintFormat StringFormat IntegerToString DoubleToString StringSubstr
StringFind StringLen ArraySize ArrayResize ArrayInitialize ArraySetAsSeries
FileWrite FileOpen FileClose ObjectCreate ObjectDelete ObjectsDeleteAll
ObjectSetInteger ObjectSetString ObjectSetDouble ChartRedraw Comment
INIT_SUCCEEDED INIT_PARAMETERS_INCORRECT INIT_FAILED
_Symbol _Period _Digits _Point
rates_total prev_calculated time open high low close tick_volume volume spread
""".split())

# Declared by this session, in every file.
OURS = set("""
ProjectFrozenChannel ResetCentroidDetail
ENUM_PROJECTION_MODE MODE_DYNAMIC_AUTOFIT MODE_FROZEN_LINE
InpProjectionMode InpFrozenAnchorTime InpFrozenSlope InpFrozenAnchorPrice
InpFrozenUOEDTOffset InpFrozenLOEDTOffset SepFreeze
g_frozen_anchor_bar g_frozen_anchor_time g_frozen_bars_since
g_cen_detail_n g_cen_detail_total g_cen_detail_time g_cen_detail_price
g_cen_detail_points CEN_DETAIL_MAX
""".split())


def declared_in(text: str) -> set:
    """Everything the FILE declares: inputs, globals, functions, enum members,
    #defines, struct members and function parameters/locals."""
    names = set()
    names |= set(re.findall(r"^input\s+\S+\s+(\w+)", text, re.M))
    names |= set(re.findall(r"^(?:static\s+)?(?:int|double|bool|string|datetime|long|color|ulong|uint)\s+(\w+)",
                            text, re.M))
    names |= set(re.findall(r"^\s*(?:void|int|double|bool|string|datetime|color)\s+(\w+)\s*\(",
                            text, re.M))
    names |= set(re.findall(r"^#define\s+(\w+)", text, re.M))
    names |= set(re.findall(r"^enum\s+(\w+)", text, re.M))
    # enum members
    for body in re.findall(r"enum\s+\w+\s*\{(.*?)\}", text, re.S):
        names |= set(re.findall(r"(\w+)\s*(?:=|,|\})", body))
    names |= set(re.findall(r"^struct\s+(\w+)", text, re.M))
    # Struct-typed declarations, e.g. `ClusterCentroidInfo centroids[];` and
    # `CFLCandidate best_cfl;`. Without these, `centroids` reads as undeclared in
    # all 7 -- including the two that demonstrably compile, which is how a false
    # positive announces itself.
    for stype in re.findall(r"^struct\s+(\w+)", text, re.M):
        names |= set(re.findall(rf"\b{stype}\s+(\w+)\s*(?:\[\s*\]\s*)?[;=,]", text))
    # every declared local/parameter anywhere (coarse, deliberately permissive:
    # this check is for MISSING globals, not for scope violations)
    names |= set(re.findall(r"\b(?:int|double|bool|string|datetime|long|color)\s+(\w+)\s*[=;,\)\[]",
                            text))
    names |= set(re.findall(r"\b(?:int|double|bool|string|datetime|long|color)\s*&?\s*(\w+)\s*\[\s*\]",
                            text))
    names |= set(re.findall(r"^\s*(\w+)\s+(\w+)\s*\[\s*\]\s*;", text, re.M))
    # Array globals declared in a comma list: double ExtCen0[], ExtCen1[], ...
    #
    # This must take ONLY the declared name from each comma-separated element,
    # never the whole line. Sweeping up every word would treat the right-hand
    # side of `int drawStartIdx = rates_total - InpCFLVisualLookback;` as three
    # declarations -- which is exactly how an earlier draft of this checker
    # silently absolved the undeclared identifier it was written to catch.
    for line in text.splitlines():
        m = re.match(r"^\s*(?:int|double|bool|string|datetime|long|color)\s+(.+);\s*$", line)
        if not m:
            continue
        for part in m.group(1).split(","):
            lhs = part.split("=")[0].strip()
            d = re.match(r"^(\w+)\s*(?:\[\s*\w*\s*\])?$", lhs)
            if d:
                names.add(d.group(1))
    return {n for n in names if n}


def region_text(text: str, start_re: str, end_re: str):
    m = re.search(start_re, text)
    if not m:
        return None
    e = re.search(end_re, text[m.start():])
    return text[m.start(): m.start() + (e.end() if e else len(text) - m.start())]


fail = 0
for p in sorted(HERE.glob("2EDTCentroidRegression*.mq5")):
    text = p.read_text(encoding="utf-8")
    decl = declared_in(text) | BUILTIN | OURS
    missing = {}
    for name, s_re, e_re in REGIONS:
        body = region_text(text, s_re, e_re)
        if body is None:
            missing.setdefault("<region absent>", []).append(name)
            continue
        # strip comments and strings, then collect referenced identifiers
        body = re.sub(r"//[^\n]*", "", body)
        out, i, n, instr = [], 0, len(body), False
        while i < n:
            ch = body[i]
            if instr:
                if ch == chr(92):
                    i += 2
                    continue
                if ch == chr(34):
                    instr = False
            elif ch == chr(34):
                instr = True
            else:
                out.append(ch)
            i += 1
        code = "".join(out)
        for ident in set(re.findall(r"\b([A-Za-z_]\w*)\b", code)):
            if ident.isdigit() or ident in decl:
                continue
            missing.setdefault(ident, []).append(name)

    short = p.name[:44]
    if missing:
        fail += 1
        print(f"FAIL {short}")
        for ident, where in sorted(missing.items()):
            print(f"       undeclared: {ident}   (in {', '.join(sorted(set(where)))})")
    else:
        print(f"PASS {short}")

print("\nOK" if not fail else f"\n{fail} FILE(S) REFERENCE UNDECLARED IDENTIFIERS")
sys.exit(1 if fail else 0)
