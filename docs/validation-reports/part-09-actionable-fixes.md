# Part 09 - Actionable Fixes & Ready-to-Use Prompts

**Generated:** 2025-12-26
**Part:** Charts & Visualization
**Priority Issues:** 2 (Low Priority)

---

## Summary

Part 09 passed validation with a **92/100** health score. The following 2 issues are **optional improvements** - they do not block localhost testing.

---

## Issue 1: Add ARIA Accessibility Attributes

**Priority:** Low
**Severity:** Medium
**Files Affected:**
- `components/charts/chart-controls.tsx`
- `components/charts/timeframe-selector.tsx`
- `components/charts/indicator-toggles.tsx`

### Ready-to-Use Prompt

```
Please add ARIA accessibility attributes to the chart components for better screen reader support:

1. In `components/charts/chart-controls.tsx`:
   - Add `aria-label="Select trading symbol"` to the symbol dropdown button
   - Add `aria-expanded={isSymbolDropdownOpen}` to the symbol dropdown button
   - Add `aria-haspopup="listbox"` to the symbol dropdown button
   - Add `role="listbox"` to the dropdown menu container
   - Add `role="option"` to each symbol option

2. In `components/charts/timeframe-selector.tsx`:
   - Add `aria-label="Select timeframe"` to the timeframe dropdown button
   - Add `aria-expanded={isOpen}` to the trigger button
   - Add `aria-haspopup="listbox"` to the trigger button
   - Add `role="listbox"` to the dropdown container

3. In `components/charts/indicator-toggles.tsx`:
   - Add `aria-expanded={isBasicExpanded}` to the Basic section header
   - Add `aria-expanded={isProExpanded}` to the PRO section header
   - Add `aria-controls` linking headers to their content sections

Focus on the main interactive elements only. Do not modify any other functionality.
```

---

## Issue 2: Add Focus Ring Styles

**Priority:** Low
**Severity:** Low
**Files Affected:**
- `components/charts/chart-controls.tsx`
- `components/charts/timeframe-selector.tsx`

### Ready-to-Use Prompt

```
Please add focus ring styles to improve keyboard navigation visibility in the chart controls:

1. In `components/charts/chart-controls.tsx`:
   - Add `focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2` to the symbol selector button (line ~120)
   - Add the same focus classes to symbol option buttons in the dropdown

2. In `components/charts/timeframe-selector.tsx`:
   - Add `focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2` to the trigger button (line ~78)
   - Add the same focus classes to each timeframe button in the grid

The focus ring should use the blue-500 color to match the existing button styling.
Do not modify any other button behavior or styling.
```

---

## No Critical Fixes Required

Part 09 has **no blockers** and is ready for localhost testing.

---

## Build Environment Fix (Not a Code Issue)

If you encounter Prisma engine download failures:

```bash
# Option 1: Set environment variable
export PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
npm install

# Option 2: Use offline engines (if available)
PRISMA_BINARIES_FROM_PATH=true npx prisma generate

# Option 3: Check network/proxy settings
# Ensure access to https://binaries.prisma.sh is not blocked
```

This is a network/environment issue, not a code quality issue.

---

## Verification Commands

After applying fixes, run these commands to verify:

```bash
# TypeScript check
npx tsc --noEmit 2>&1 | grep -E "components/charts"

# ESLint check
npx next lint

# Manual accessibility test
# Open /charts in browser with screen reader
```

---

*Report saved to: `docs/validation-reports/part-09-actionable-fixes.md`*
