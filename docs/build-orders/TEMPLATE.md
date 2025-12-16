# Part [NUMBER]: [PART NAME] - Build Order

**From:** `docs/v5-structure-division.md` Part [NUMBER]
**Total Files:** [N] files
**Estimated Time:** [X] hours
**Priority:** ⭐⭐⭐ [High/Medium/Low]
**Complexity:** [High/Medium/Low]

---

## Overview

**Scope:** [Brief description of what this part does]

**Implementation Guide References:**

- `docs/implementation-guides/v5_part_[letter].md` - [Description of what this guide provides]
- `docs/[openapi-spec].yaml` - [Specific schemas or endpoints referenced]
- `docs/policies/[policy-file].md` - [Specific policies that apply]

**Key Changes from V4/V5:**

- ✅ [Change 1]
- ✅ [Change 2]
- ✅ [Change 3]

**Dependencies:**

- Requires Part [X] to be complete (for [reason])
- Requires Part [Y] to be complete (for [reason])

**Integration Points:**

- Integrates with Part [Z] via [mechanism]

---

## File Build Order

Build these files **in sequence** (dependencies flow top to bottom):

---

### File 1/[N]: `[path/to/file.ts]`

**Purpose:** [What this file does in 1-2 sentences]

**From v5-structure-division.md:**

> [Exact quote or description from v5-structure-division.md]

**Implementation Details:**

- **Reference Guide:** `docs/implementation-guides/v5_part_[letter].md` Section [X.X]
- **Pattern:** `docs/policies/05-coding-patterns.md` → **Pattern [N]: [Pattern Name]**
- **OpenAPI Reference:** `docs/[spec].yaml` → Schema: `[SchemaName]`
- **Seed Code Reference:** `seed-code/[path]/[file]` (lines [X-Y])

**Dependencies:**

- Requires: [File from earlier part or earlier in this part]
- Creates: [What this file provides for later files]

**Build Steps:**

1. **Read Requirements**

   ```
   - v5-structure-division.md Part [N] description
   - v5_part_[letter].md Section [X.X]
   - 05-coding-patterns.md Pattern [N]
   - [OpenAPI spec] [Schema name]
   - seed-code/[reference file]
   ```

2. **Plan Implementation**

   ```
   - Use Pattern [N] as base
   - Customize for [specific requirements]
   - Ensure [specific features]:
     • [Feature 1]
     • [Feature 2]
     • [Feature 3]
   ```

3. **Generate Code**

   ```
   - Start with Pattern [N] template
   - Add [specific customizations]
   - Include:
     • TypeScript types (no `any`)
     • Error handling (try/catch)
     • [Specific requirement 1]
     • [Specific requirement 2]
   ```

4. **Validate**

   ```
   Check against:
   - 00-tier-specifications.md: [Specific check]
   - 01-approval-policies.md: [Specific criteria]
   - 02-quality-standards.md: [Quality requirements]
   - 03-architecture-rules.md: [Architecture constraints]
   - OpenAPI compliance: Response matches [SchemaName]
   ```

5. **Approval Criteria**

   ```
   ✅ 0 Critical issues
   ✅ ≤2 High issues (auto-fixable)
   ✅ TypeScript types present
   ✅ Error handling present
   ✅ [Specific requirement met]
   ✅ OpenAPI schema compliance
   ```

6. **Commit**

   ```
   If approved:
     git add [file path]
     git commit -m "[type]([scope]): [description]

     - Validation: 0 Critical, X High, Y Medium, Z Low
     - Pattern used: Pattern [N]
     - Model: MiniMax M2"
   ```

**Validation Checklist:**

- [ ] TypeScript: No `any` types
- [ ] Error Handling: Try/catch present
- [ ] JSDoc: Function documented
- [ ] [Specific check 1]
- [ ] [Specific check 2]
- [ ] OpenAPI: Response matches schema
- [ ] Dependencies: All imports resolve

**Expected Output:**

```typescript
// Brief code snippet showing structure
[Example code structure]
```

**Known Issues / Edge Cases:**

- ⚠️ [Edge case 1]: [How to handle]
- ⚠️ [Edge case 2]: [How to handle]

---

### File 2/[N]: `[path/to/next/file.ts]`

[Repeat structure above]

---

## Testing After Part Complete

Once all [N] files are built, test:

1. **Unit Tests**

   ```bash
   pnpm test [test-file-pattern]
   ```

2. **Integration Tests**

   ```
   [Specific integration tests for this part]
   ```

3. **Manual Verification**
   ```
   [Steps to manually verify this part works]
   ```

---

## Success Criteria

Part [N] is complete when:

- ✅ All [N] files built and committed
- ✅ All tests passing
- ✅ No TypeScript errors
- ✅ All approval criteria met
- ✅ PROGRESS.md updated
- ✅ [Part-specific success criteria]

---

## Next Steps

After Part [N] complete:

- Ready for Part [N+1]: [Next part name]
- Unblocks: [What this enables]

---

## Escalation Scenarios

Expected escalations for this part:

1. **[Escalation Type 1]**
   - **Trigger:** [What causes this]
   - **Resolution:** [How to handle]

2. **[Escalation Type 2]**
   - **Trigger:** [What causes this]
   - **Resolution:** [How to handle]

Refer to: `docs/policies/04-escalation-triggers.md` for escalation format.

---

**Last Updated:** [Date]
**Maintained By:** Build order system
**Alignment:** (E) Phase 3 → (B) Part [N] → (C) This file
