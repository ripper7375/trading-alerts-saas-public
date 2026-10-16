# ADR-056: Wording guide in 16 languages

- **Status:** Settled
- **Date:** 2026-09-29
- **Section:** 5 · Prompt & AI reply (deck decision 5.10: Wording)
- **Architecture:** [STACK-D-ARCHITECTURE.md](../STACK-D-ARCHITECTURE.md) §5.9
- **Amended by:** [ADR-098](098-intake-routing-and-knowledge-service.md): read "16 languages" as the 19 interface locales (17 languages); the decision below is unchanged and holds for all 19
- **Amended by:** [ADR-099](099-prompt-and-reply-as-built-in-step-7.md): the "always" rows are enforced structurally where a language-neutral rule exists (the invalidation line of each chosen zone, the stamp, the sample size, the stand-aside) and the conditional phrasing is measured, not enforced; the five "never" rows are checked lexically over 17 language files with a script-aware matcher and a three-tier direction guard, and every list is a draft until a native reader signs it (D12); the decision below is unchanged

## Decision

Guide and phrase lists in 16 languages; counsel review.

## Alternative not chosen

Disclaimer only.

## Why

Wording in several documents ("82% probability", "GRADE S", "100% accurate, hallucination-free trade advice") conflicted with execution-only decision support.

## Note

Needs review by counsel in each target market before launch.

## Changing this decision

Record a new decision that names this one; set this file's status to "Superseded by ADR-nnn"; update STACK-D-ARCHITECTURE.md in the same change.
