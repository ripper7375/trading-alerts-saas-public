# Hand-off prompt — paste into Antigravity chat

> **How to use this file:** copy everything in the fenced block below and
> paste it as your next message to Antigravity in the Antigravity Chat UI.
> It is self-contained — Antigravity does not need this conversation's
> history, only the file path it names (`docs/policies/08-locale-i18n-compliance.md`).
> That document already contains the complete, pre-compiled, re-audited
> file inventory (§6) sourced from all 5 stacks' own manifest docs — you do
> not need to separately paste a page/file list into this prompt.

---

```
Role reminder: in this chat you are Antigravity — Advisor & Architect per
CLAUDE.md's role split. Your job here is to plan and draft, not execute;
Claude Code (terminal Executor) will run the actual fix in a later session.

I want to hand you a bug to plan a fix for. Two distinct problems, one
root cause worse than the other:

1. CRITICAL: the Settings -> Language & Region page
   (app/settings/language/page.tsx) saves to the database via
   PUT /api/user/preferences and shows "Saved!" -- but nothing in the app
   ever reads that database row back. Traced end-to-end: the page never
   calls useLocale()/setLocalePreferences(), and the server-side resolver
   app/layout.tsx calls (resolvePreferences() in lib/i18n/locale-resolver.ts)
   has no database/session parameter at all -- it only ever reads a
   cookie and a URL-prefix header. This is very likely the literal, direct
   cause of what I personally observed: I change my language/region
   setting and nothing happens, anywhere, ever, through that page. The
   only file in the whole repo that actually writes into the live locale
   system (LocaleProvider, via setCountryCode/setLocalePreferences) is
   components/layout/app-header.tsx's header dropdown -- confirmed via a
   repo-wide grep, one match, no others.

2. SEPARATE AND SMALLER: the 5 most recently built feature stacks --
   Business Intelligence dashboards, VAT/tax invoicing, affiliate
   commission clawback fix, DavinTrade Academy, and (as a working
   counter-example, NOT a gap) UAE/dLocal/Arabic support -- mostly ship
   hardcoded English text, hand-rolled date/currency formatting, with zero
   connection to the locale system at all. This happens because these are
   ad-hoc sessions outside the numbered migration-order playbook, each
   verified only against its own feature (tsc, eslint, targeted tests) --
   none of which fails on hardcoded English, because hardcoded English is
   valid, passing code. The gap only shows up when a non-English/non-US
   user actually loads the page, which no past session's verification
   steps ever did.

I already had Claude Code investigate both problems directly against live
code (not guessed) and write up a single source of truth document with:
the full trace of problem 1 and both a low-risk immediate fix and a
larger flagged-not-built architectural fix for it; the two exact failure
modes behind problem 2 (Client Components skipping useLocale(), Server
Components skipping getServerLanguage()/getDictionary()) with a working
code example for each; a currency-conversion gotcha (formatCurrency()
expects a USD input -- it converts, not just formats -- so it needs a
per-stack check against the live data model before use); an audit
procedure; and -- this is the part that answers "how do you know which
pages to fix" -- a COMPLETE, pre-compiled, already-re-audited inventory
of every affected file, extracted directly from all 5 stacks' own
manifest-work-completion.md "Files changed" tables (the authoritative
build record for each stack) and individually grep-verified against live
code. You do not need me to separately hand you a page list; it's already
in the document, sourced and dated.

Read that document in full before drafting anything:
  docs/policies/08-locale-i18n-compliance.md

Also skim its two upstream references if useful context:
  davintrade-ui-design-stack/hand-off-to-claude-code-for-language-stack/language_timezone_regional_format_spec.md
  davintrade-ui-design-stack/hand-off-to-claude-code-for-language-stack/LANGUAGE_TIMEZONE_REGIONAL_FORMAT_COMPLETION_REPORT.md

What I want from you, per your own Advisor/Architect role and this repo's
"you decide from documents, Claude Code decides from live code" split
(CLAUDE.md non-negotiable #7): draft a migration-order-style plan (or a
scoped ad-hoc order, per EXECUTOR-PROTOCOL.md §6, since this sits outside
the numbered Phase playbook the same way the original language hand-off
did) for Claude Code to execute, that:

1. Makes the SSOT doc's §0 fix (the Settings page) its own first batch,
   before any of the 5-stacks work -- not because it's bigger, but because
   until it's fixed, there is no way to live-verify any other locale fix
   through the UI path a real user would actually use. Scope this batch to
   §0's "Part 1" fix only (wire handleSave() to call setLocalePreferences(),
   mirroring app-header.tsx's existing pattern, plus drop/fix the fr/zh
   options that have no backing dictionary) -- §0's "Part 2" (reading the
   stored DB preference back into app/layout.tsx's server resolution) is
   explicitly flagged in the SSOT doc as needing my own separate design
   sign-off, since it's a session/auth-adjacent data-flow change under
   CLAUDE.md non-negotiable #5. Don't bundle Part 2 into this batch;
   surface it to me as a distinct follow-up decision instead.
2. For the 5-stacks work, treats §6's file inventory as the batch scope
   but doesn't trust it blindly -- instruct Claude Code to re-run §5's
   audit procedure itself before each batch and treat the inventory as a
   verified floor, not a ceiling (this repo has a standing lesson,
   LESSONS-LEARNED.md L22, about exactly that mistake: a named list is
   never proof there's nothing else). Also have it resolve the 3 files
   §6 flags as "unverified" (components/payments/CountrySelector.tsx,
   PaymentMethodSelector.tsx, PriceDisplay.tsx) one way or the other before
   closing that batch.
3. Sequences the 5-stacks work in per-stack batches (BI dashboards, tax
   invoicing, affiliate commission, Academy -- UAE/Arabic excluded, it's
   already correct), each its own commit/checkpoint, gated on green
   tsc/tests before moving to the next -- matching how these stacks were
   themselves originally built (see their own manifest-work-completion.md
   files, paths listed in the SSOT doc's §7, if you want that precedent).
4. For each batch, makes explicit which fix pattern (Client useLocale()
   vs. Server getServerLanguage()/getDictionary()) applies to which file
   -- §6 already tags every file with its failure mode, don't make Claude
   Code re-derive that classification.
5. Carries forward §4's formatCurrency() USD-input gotcha as a per-batch
   verification step -- before wiring any money figure through
   formatCurrency(), confirm against the live data model (not assumed)
   that it's genuinely USD-denominated. §4 already has a first pass at
   this per stack; treat it as a starting judgment to confirm, not as
   settled.
6. Decides the dictionary-coverage strategy up front (full key parity vs.
   the curated-partial-dictionary approach the UAE/Arabic session used)
   so Claude Code isn't making that call unilaterally mid-execution -- my
   default preference is the curated-partial approach already proven safe
   in this codebase (t() degrades to English on a missing key, never
   breaks), but confirm or override that.
7. Ends every batch, including the Settings-page batch, with a live-
   browser verification step (not just tsc/eslint/unit tests): actually
   change the language/region setting through the UI and confirm the
   rendered output changes -- since that's the exact check every past
   session's own verification skipped, which is why this bug class exists
   at all.

Draft this as DRAFT status per this repo's order lifecycle
(PRE-DRAFT -> DRAFT -> APPROVED -> CONFIRMED) so I can review and approve
it before Claude Code executes anything.
```
