# ADR-093: Exact rational arithmetic for the money maths

- **Status:** Settled (approved by Davin, 2026-10-09, decision D2 of the build step 5 plan; written down in part 8)
- **Date:** 2026-10-09
- **Section:** 6 · Engine 4 & Report 2
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §6.7, §6.8, §6.10; [ADR-065](065-rrr-definition.md)

## Decision

Everything in Engine 4 that is money, a lot, a leverage or a price is exact. `lib/engine4/exact.ts` is a small `Rational` (a fraction of two `BigInt`s plus the readers of decimal text; the plan guessed 100 lines, it is under 400; no dependency). An input is decimal text; a JavaScript number is read by its shortest round-trip decimal text (the double 0.01 is the decimal 0.01), so a result of float arithmetic must never be passed in. A quotient stays a fraction until it is shown: the lot is rounded **down** to the lot step, never up; a display figure is rounded half away from zero (two decimals for money, three for leverage); an amount of equity that is a minimum ("at least") is rounded up. Nothing in `lib/engine4` computes with `Math`, `Number`, `parseFloat`, `toFixed` or a float literal: `__tests__/lib/engine4/exactness-guard.test.ts` reads the source and fails on any of them, with a rule for each folder (`read/`, `store/`, `server/`, `templates/`) and self-tests in both directions. The profile's eight figures are stored as canonical decimal text, not as numbers.

The engine is held to an independent oracle. `scripts/engine4/oracle.py` is a second implementation in Python's `decimal` module (400 digits, every operation checked exact, a quotient kept as a numerator and a denominator), written from the architecture and sharing no code with the engine. The engine equals it on every one of 510 cases to the cent, and the ten worked examples of part 8 are made by it and approved by Davin one by one.

## Alternative not chosen

(b) `Prisma.Decimal`, which ships inside `@prisma/client`; (c) a new dependency such as `decimal.js`, which the overrides rule would put to Davin; (d) ordinary floating point with a rounding step at the end.

## Why

The number the trader acts on is a lot rounded down to a step, a risk compared with a limit, and a leverage compared with a ceiling. A float that is one unit in the last place wrong can round a lot up past a limit, or make `actual risk <= declared risk` false by a cent. The document this chapter corrects had its worked example wrong twice (file G), so "the code agrees with the document" has to be proved by a second implementation. The helper is small, has no new dependency, and its exact answers are what a consent record can store and a hash can cover. The cost is that every figure passes through text or a fraction, which the guard makes impossible to forget.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; any change to `exact.ts` or to a rounding rule re-runs the oracle (`python scripts/engine4/oracle.py --check` and `python scripts/engine4/worked_examples.py check`) and returns the worked examples to PENDING; update STACK-D-ARCHITECTURE.md §6.7 in the same change.
