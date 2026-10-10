# ADR-097: Report 2 is a fixed template over one validated setup

- **Status:** Settled (approved by Davin, 2026-10-10: the readings of the part 4, part 6 and part 7 hand-offs, as built; written down in part 8). The disclaimer and consent wording stays a draft until counsel's text arrives (D14)
- **Date:** 2026-10-10
- **Section:** 6 · Engine 4 & Report 2
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §6.10, §6.11; refines [ADR-067](067-chat-typed-setups-pre-fill-the-modal.md) and [ADR-068](068-report-2-is-a-fixed-template.md)

## Decision

**One validator, one object.** `validateSetup` runs the eight checks of §6.10 and returns `ValidatedSetup` (schema `validated-setup/1`), plain JSON-safe data: the inputs in canonical text, the pinned cycle, the checks with their codes, the sizing, the scenarios, the underflow help, the override, the notices, the holding-window warnings and the versions of the broker row and the Tier-1 list. Every field is required (a missing one is a code, never a default), an entry is a zone price or a custom entry by its **value**, and the same setup entered through the modal or typed in chat gives byte-identical JSON. The badge is not in it (it needs the synthesis and the levels beyond the target) and is decided on the server.

**The server recomputes everything.** `app/api/engine4/{profile,offer,size,consent}` take the cycle slot, the zone and the trader's inputs and compute the offer, the setup, the badge and the record again; no number from the client is read (32 forged fields change nothing). The consent route requires the hash of the setup the trader was shown (`shownSetupSha256`) and refuses a different one (409 `SETUP_CHANGED`); one submit writes one record through a Redis guard that fails open (it cannot stop two racing presses while Redis is down, so a unique `submission_id` column in the part 5 migration is recommended before the flag goes live). The routes answer 404 to everybody unless `ENGINE4_REPORT2_ENABLED` is exactly `true` (set nowhere), then require a session and a Pro tier, in that order.

**The report is a fixed template.** `buildReport2` (`lib/engine4/templates/`) turns the server's setup, badge and offer into a document: numbers from Engine 4 only, declared and actual risk side by side, the three compulsory texts and the single-order notice on every report. Its words are one registry of 177 keys, English in en-GB and en-US and real translations in all 19 dictionaries; a coverage test holds every key to every dictionary. No model writes any number. The Trade Setup modal draws what the server answers and computes nothing: the browser's prechecks use the validator's own codes, save a round trip and never decide. Money is shown as unconverted US dollars through `formatChargedAmount`, because the trader's risk is a figure in the account's currency and `formatCurrency()` converts and drops decimals above 1,000. A figure inside a sentence is a placeholder, never a number written into 19 texts. The template and disclaimer versions are `report2-template/draft-1` and `disclaimer/draft-1`; a consent record keeps the string it was written with, and any change to the template's text or layout bumps the version. The nine texts of `DRAFT_TEXT_KEYS` (the three notices, the three buttons, the three outcomes) are counsel's to replace.

The component tests run against the real Engine 4, and `api-parity.test.ts` holds the routes and that stand-in to byte-identical answers on 16 inputs, so "the same numbers as the API for the same inputs" is a fact the suite checks.

## Alternative not chosen

A model-written report (ADR-068 rules it out); a modal that computes locally and sends its numbers; recording whatever the server computes at the press rather than the setup shown; showing money in the viewer's currency.

## Why

The numbers are the product: a trader is asked to accept a sized setup, and the record has to show exactly what was on the screen. One function, one object and a server that trusts nothing make "what the modal showed", "what chat said" and "what was recorded" the same bytes, and make a forged or stale request harmless.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; a change to the shape of `ValidatedSetup` changes its schema id and the consent record's reader; update the template version, the 19 dictionaries and STACK-D-ARCHITECTURE.md §6.10 in the same change.
