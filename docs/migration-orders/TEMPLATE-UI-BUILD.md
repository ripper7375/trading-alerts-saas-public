# Migration Order — UI-BUILD variant

> For sessions that **build or redesign frontend surfaces**: 3-3 (auth UI wiring),
> 6-2…6-8 (redesign surfaces). Read `00-SKELETON-AND-RULES.md` first — §4 applies with the
> dial at **High**: the contract constrains the DATA, not the DESIGN. Propose freely on
> layout, components, interaction, and state management; Davin reviews on staging.

**Session:** <P-N> · **Variant:** UI-BUILD · **Status:** PRE-DRAFT | DRAFT | APPROVED | CONFIRMED
**Generated:** <date> · **Flags touched:** <F-…> · **Estimated time:** <h>
**Surface:** <route group / pages> · **Feeds on:** <endpoints from the gap matrix / OpenAPI>

## Entry criteria

- [ ] Backend endpoints this surface consumes are live (or staging-live) and contract-tested
- [ ] Gap-matrix rows for this surface triaged by Davin (build / defer decisions made)
- [ ] Design-system primitives needed exist in `components/ui/*` (or step 1 adds them)

## Ordered steps

1. **Primitives first:** add/extend `components/ui/*` pieces the surface needs.
   _Verify:_ rendered in isolation; tokens from `tailwind.config.ts`, no hardcoded values.
2. **Data layer:** typed access via the interim OpenAPI-generated wrappers (Phase 6) or the
   unified client (Phase 7+), with the CC-C timeout/retry/fallback policy — one slow
   service dims one panel, never the page.
   _Verify:_ loading / empty / error states all reachable and designed, not accidental.
3. **Build the surface** behind its env flag; v16 idioms (Server Components by default,
   client components only where interaction demands; streaming where data is slow).
   _Verify:_ `__tests__/components/*` written/updated; flag-off = old behavior intact.
4. **Access control:** role/tier gating from JWT claims, never client-side-only trust.
   _Verify:_ wrong-role user gets the designed denial, not a crash or a data leak.
5. **Staging review with Davin** — his approval flips the flag.

## Rules specific to this variant

- Creativity is expected here — but record notable design decisions in Deviations anyway
  (they inform the next surface's order and keep the design system coherent).
- Never render money amounts/states from client math — display what the service returns.
- A11y from the start (labels, focus, contrast), not as a Phase 6-9 cleanup surprise.

## Done when

- [ ] Surface live behind completed flag on staging; component tests green
- [ ] Loading/empty/error/denial states verified; gap-matrix rows marked done

## Rollback

Flag off. (That's the point of building behind flags.)

## Deviations

_(design decisions + outline departures — what/why/impact)_

## Next-session handoff

_(DRAFT order for <next session>)_
