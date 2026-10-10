# ADR-096: Profile history and the consent record are append-only, and the audit hash is keyed

- **Status:** Settled (approved by Davin, 2026-10-09: decisions D10 and D12 of the build step 5 plan; the readings of the part 5 hand-off approved as built on 2026-10-10; written down in part 8)
- **Date:** 2026-10-10
- **Section:** 6 · Engine 4 & Report 2
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §6.11, §7.5; refines [ADR-069](069-consent-record.md); uses [ADR-076](076-retention.md)

## Decision

Three tables, in one migration file (`prisma/migrations/20261010000000_add_engine4_tables`, not applied until Davin applies it):

- `user_trade_preferences`: the **current** profile, one row per user, the eight figures as canonical decimal text. It is personal data and goes with the account (`user_id NOT NULL UNIQUE`, `ON DELETE CASCADE`).
- `user_trade_preferences_history`: one append-only snapshot per change to the profile. Saving the profile the trader already has writes nothing.
- `trade_consent_records`: one append-only row per Accept, Modify or Decline. It holds the whole `ValidatedSetup` as the exact text that was hashed, its SHA-256 (the database re-derives the hash and checks that the JSONB copy is the same document), the profile snapshot it was validated against, the synthesis rule and version, the badge, and the versions of Engine 4, `symbol_specs`, the template and the disclaimer.

The two audit tables keep their rows when the account is deleted. `user_id` is a nullable foreign key with `ON DELETE SET NULL`, and **`user_id_hash` is written on every insert**: HMAC-SHA-256, hex, of the user id's UTF-8 bytes, keyed with `ENGINE4_AUDIT_HMAC_KEY` (at least 32 characters), with `ENGINE4_AUDIT_HMAC_KEY_VERSION` (a whole number, default 1) stored beside it. Deleting a `User` row makes the database itself replace the id by NULL; the hash and every other column stay. A trigger refuses UPDATE, DELETE and TRUNCATE of the audit rows with error 23001, except the one change `user_id` from a value to NULL with every other column equal (the foreign key's own act). Nothing cascades into an audit table, and a test fails if anything does. The CHECKs of the profile tables are the twin of `validateProfile` (a 756-profile corpus agrees).

The key is never in the repository and never seen by the Executor: a missing key stops every write, and only `NODE_ENV=test` falls back to a public test key. **A rotation never recomputes an old hash:** old rows keep the hash and the key version they were written with, and `verifyUserHash` answers `OTHER_KEY_VERSION` rather than guess; recognising an old hash needs the old key, which the operator keeps.

## Alternative not chosen

A single table for history and consent (the roadmap and the step hand-off merged them; §6.11 has two things: snapshots of the profile, and a record of each action naming a snapshot). A plain SHA-256 of the user id (ids are cuids; an unkeyed hash can be guessed and checked against the user table). `ON DELETE CASCADE` on the history, which deletes the audit trail with the account (file E §5). A deletion job that rewrites the audit rows (the account-deletion job does not exist yet; it is open elsewhere as F21). A published fallback key outside tests.

## Why

A consent record is worth more than the account it came from: it is what shows what a trader was told and what they accepted, for seven years (ADR-076). Putting the replacement of the id in the database itself means no deletion code has to remember it, and the append-only trigger means a bug in the application cannot rewrite history. A keyed hash lets the operator answer "is this record that person's" without the table naming them. Open: the seven-year retention has no job and the trigger forbids a DELETE, so removing expired rows needs a decision of its own.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; any change is a new migration (never an edit of the applied file), a new key version for the hash, and an update of STACK-D-ARCHITECTURE.md §6.11 and `.claude/architecture/database-traps.md` in the same change.
