"""The statistics lane's four layers must agree on one field set.

Run:  python test_statistics_schema_sync.py

SQLite DDL -> collector STAT_FIELDS -> push worker STAT_COLUMNS -> gateway
contract -> both Prisma mirrors. A disagreement anywhere is silent: the
collector stores NULL for a label it cannot match, and the gateway rejects an
unknown field with 400, which the statistics push worker quarantines AND stamps
synced_at on -- recoverable only by hand.

Both modules are IMPORTED, not read as text. An earlier draft of this check
scraped STAT_COLUMNS with a regex and happily passed while the file had a
syntax error in that very list, because a regex does not care whether Python
can parse what it matched.
"""
import importlib.util
import json
import pathlib
import re
import sqlite3
import tempfile
import sys

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parents[2]
failures = []


def check(cond, msg):
    print(("  PASS  " if cond else "  FAIL  ") + msg)
    if not cond:
        failures.append(msg)


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


col = load("col", HERE / "export_collector_validator_v2.py")
push = load("push", HERE / "backfill_worker_api_gateway_v5.py")

conn = sqlite3.connect(":memory:")
conn.executescript((HERE / "sqlite_schema_v6_xauusd.sql").read_text(encoding="utf-8"))
stat_cols = [r[1] for r in conn.execute("PRAGMA table_info(indicator_statistics)")]
md_cols = [r[1] for r in conn.execute("PRAGMA table_info(market_data)")]

print("\nSQLite")
check(len(md_cols) == 103, f"market_data at 103 columns (got {len(md_cols)})")
check(len(stat_cols) == len(set(stat_cols)), "no duplicate indicator_statistics columns")

print("\ncollector")
targets = [c for _l, _s, c, _t in col.STAT_FIELDS]
check(len(targets) == len(set(targets)), "no two STAT_FIELDS rules write the same column")
missing = [c for c in targets if c not in stat_cols]
check(not missing, f"every STAT_FIELDS target exists in the DDL (missing: {missing})")
dead = [c for c, _ in col.STAT_EXTENDED_COLUMNS if c not in targets]
check(not dead, f"no STAT_EXTENDED_COLUMNS entry without a STAT_FIELDS rule ({dead})")
absent = [c for c, _ in col.STAT_EXTENDED_COLUMNS if c not in stat_cols]
check(not absent, f"every migrated column is in the DDL ({absent})")

print("\npush worker")
check(len(push.STAT_COLUMNS) == len(set(push.STAT_COLUMNS)), "no duplicate STAT_COLUMNS")
bad = [c for c in push.STAT_COLUMNS if c not in stat_cols]
check(not bad, f"every pushed column exists in the DDL ({bad})")
stranded = [c for c, _ in col.STAT_EXTENDED_COLUMNS if c not in push.STAT_COLUMNS]
check(not stranded, f"nothing captured but never pushed ({stranded})")

print("\ngateway contract")
contract = json.loads((HERE / "gateway_contract_indicator_statistics.schema.json")
                      .read_text(encoding="utf-8"))
props = set(contract["properties"])
sent = set(push.STAT_COLUMNS) | {"terminal_id"}
check(sent <= props, f"contract covers every pushed field (missing: {sorted(sent - props)})")
check(contract.get("additionalProperties") is False,
      "additionalProperties still false (an unknown field must 400, not slip through)")
for c, _ in col.STAT_EXTENDED_COLUMNS:
    if c in props and "null" not in (contract["properties"][c].get("type") or []):
        check(False, f"{c} must be nullable in the contract")
        break
else:
    check(True, "every extended field is nullable in the contract")


print("\nPrisma mirrors")
def model(p):
    t = pathlib.Path(p).read_text(encoding="utf-8")
    m = re.search(r"^model IndicatorStatistic \{.*?^\}", t, re.S | re.M)
    return m.group(0) if m else ""


a = model(REPO / "prisma/market-data/schema.prisma")
b = model(REPO / "railway-gateway/prisma/schema.prisma")
check(a and a == b, "both IndicatorStatistic models byte-identical")
pfields = set(re.findall(r"^\s{2}([a-z_][a-z0-9_]*)\s+(?:Int|Float|String|Boolean|DateTime)",
                         a, re.M))
gap = sorted(set(push.STAT_COLUMNS) - pfields - {"config_params"})
check(not gap, f"Prisma covers every pushed field (missing: {gap})")

mig = REPO / "prisma/migrations/20260920000000_add_indicator_statistics_extended/migration.sql"
check(mig.exists(), "migration file present")
if mig.exists():
    sql = mig.read_text(encoding="utf-8")
    declared = set(re.findall(r'ADD COLUMN\s+"([a-z_0-9]+)"', sql))
    want = {c for c, _ in col.STAT_EXTENDED_COLUMNS}
    check(declared == want, f"migration adds exactly the extended columns "
                            f"(missing: {sorted(want - declared)}, extra: {sorted(declared - want)})")
    # Strip -- comments first. The header explains WHY sr_levels' file used to
    # be dropped, and an earlier draft of this check read that prose as SQL and
    # failed. A check that a comment can trip is a check nobody will trust.
    stmts = " ".join(ln.split("--")[0] for ln in sql.splitlines()).upper()
    check("DROP" not in stmts and "NOT NULL" not in stmts,
          "migration is additive only: no DROP, no NOT NULL")
    check(stmts.count("ADD COLUMN") == len(want),
          f"every statement is an ADD COLUMN ({stmts.count('ADD COLUMN')} vs {len(want)})")

# ---------------------------------------------------------------------------
# migrate_statistics_table() against a database that predates the new columns.
#
# This is the failure the function exists to prevent, and it is worth
# REPRODUCING rather than reasoning about, because of HOW it fails: CREATE
# TABLE IF NOT EXISTS is a silent no-op on a deployed xauusd.db, so widening
# the DDL does not widen the file. stage_statistics() then names a column
# SQLite does not have and raises OperationalError -- and its caller wraps it
# best-effort, because a statistics failure must never reject a price cycle.
# So the exception is swallowed and the whole statistics lane goes SILENTLY
# dark while every other part of the pipeline keeps reporting success.
#
# The "old" DDL is derived by stripping the extended columns out of the current
# one rather than read from git, so this runs on the VPS too and tests exactly
# the columns the migration is responsible for.
print("\ndeployed-database migration")

ddl = (HERE / "sqlite_schema_v6_xauusd.sql").read_text(encoding="utf-8")
ext = {c for c, _ in col.STAT_EXTENDED_COLUMNS}
old_ddl = "\n".join(ln for ln in ddl.splitlines()
                    if ln.strip().split(" ")[0] not in ext)
check(all(f"    {c} " not in old_ddl for c in ext),
      "built an 'old' DDL that genuinely lacks the new columns")

td = tempfile.mkdtemp()


def _fresh(path):
    c = sqlite3.connect(path)
    c.executescript(old_ddl)
    c.commit()
    c.close()


def _cols(path):
    c = sqlite3.connect(path)
    out = [r[1] for r in c.execute("PRAGMA table_info(indicator_statistics)")]
    c.close()
    return out


dbp = str(pathlib.Path(td) / "xauusd.db")
_fresh(dbp)
before = _cols(dbp)
check(not (ext & set(before)), f"old DB lacks them ({len(before)} columns)")

conn2 = col.open_db(dbp)
after = _cols(dbp)
check(ext <= set(after), f"open_db() widened it ({len(before)} -> {len(after)} columns)")
conn2.close()
conn2 = col.open_db(dbp)
check(len(_cols(dbp)) == len(after), "re-opening is a no-op (idempotent)")

row = {c: 1 for c in ext}
row.update(cycle_id=1, symbol="XAUUSD", timeframe="M5", source="non_b",
           captured_at=1789764300, live_bar_ts=1789764300,
           config_hash="x" * 64, config_params="{}")
conn2.execute("INSERT INTO collection_cycles (cycle_id, cycle_time, timeframe, attempt,"
              " status, created_at) VALUES (1, 1789764300, 'M5', 1, 'validated', 1789764300)")
_c = list(row)
_sql = (f"INSERT INTO indicator_statistics ({', '.join(_c)}) "
        f"VALUES ({', '.join('?' * len(_c))})")
conn2.execute(_sql, [row[k] for k in _c])
conn2.commit()
check(conn2.execute("SELECT channel_width FROM indicator_statistics").fetchone() == (1,),
      "a row using every extended column inserts and reads back")
conn2.close()

# mutation: neuter the migration and the same insert must fail
_real = col.migrate_statistics_table
col.migrate_statistics_table = lambda c: 0
try:
    db2 = str(pathlib.Path(td) / "mutant.db")
    _fresh(db2)
    c3 = col.open_db(db2)
    try:
        c3.execute(_sql, [row[k] for k in _c])
        check(False, "MUTATION SURVIVED: the insert succeeded without the migration")
    except sqlite3.OperationalError as e:
        check("no column named" in str(e) or "no such column" in str(e),
              "mutation killed: without the migration the insert raises")
    c3.close()
finally:
    col.migrate_statistics_table = _real
    check(col.migrate_statistics_table is _real, "migration function restored")

print(f"\nfield counts  sqlite={len(stat_cols)}  stat_fields={len(col.STAT_FIELDS)}  "
      f"push={len(push.STAT_COLUMNS)}  contract={len(props)}  prisma={len(pfields)}")
print("\n" + ("ALL PASS" if not failures else f"{len(failures)} FAILURE(S)"))
for f in failures:
    print("   -", f)
sys.exit(1 if failures else 0)
