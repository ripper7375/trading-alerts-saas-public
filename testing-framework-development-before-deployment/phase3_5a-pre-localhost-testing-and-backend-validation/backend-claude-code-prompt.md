# Backend/Infrastructure Validation Execution Request

## 🚨 CRITICAL: Read This First

### **DIRECTORY STRUCTURE - ABSOLUTELY NO CHANGES ALLOWED**

```
✅ CORRECT (Next.js Route Group):
app/(marketing)/pricing/page.tsx → URL: /pricing
app/(dashboard)/alerts/page.tsx → URL: /alerts
app/(dashboard)/admin/page.tsx → URL: /admin

❌ FORBIDDEN - DO NOT CREATE:
app/marketing/pricing/page.tsx
app/dashboard/alerts/page.tsx
app/dashboard/admin/page.tsx
```

**YOU MUST:**

- ✅ ONLY validate files INSIDE `app/(dashboard)/` and `app/(marketing)/`
- ✅ Keep the parentheses: `(dashboard)` and `(marketing)` - Next.js route group syntax
- ✅ NEVER suggest creating `app/dashboard/` or `app/marketing/` directories
- ✅ NEVER suggest deleting existing files
- ✅ This is VALIDATION ONLY - do NOT modify directory structure

**IF YOU FIND `app/dashboard/` → FLAG AS CRITICAL ERROR**
**IF YOU SUGGEST CREATING `app/dashboard/` → YOU FAILED**

---

I have uploaded 2-3 documents for Part [XX] validation:

1. **Backend & Infrastructure Pre-Localhost Testing Guide** - Validation methodology
2. **Part [XX] Files Completion List** - All files for this part
3. **Part [XX] OpenAPI Specification** - API reference (if applicable - Parts 6, 7 only)

## Part Type

This is **Part [XX]: [Part Name]** - [Configuration/Database/Types/Business Logic/Python Service/API Routes]

## Your Task

Execute the complete **Backend & Infrastructure Validation** following the guide exactly:

### Phase 1: Static Validation (Steps 1-10)

Execute steps relevant to this part:

**All Parts:**

- Steps 1-2: File inventory and categorization

**Part-Specific Steps:**

- **Part 1 (Foundation):** Step 4 - Configuration validation
- **Part 2 (Database):** Step 5 - Database schema validation
- **Part 3 (Types):** Step 6 - Type system validation
- **Part 4 (Tier System):** Step 7 - Business logic validation
- **Part 6 (Flask MT5):** Step 8 - Python service validation
- **Part 7 (Indicators API):** Step 9 - API routes validation

**If OpenAPI exists (Parts 6, 7):**

- Step 10: OpenAPI comparison (informational only)

### Phase 2: Automated Pre-Flight Checks (Steps 11-13)

- TypeScript compilation analysis (Parts 1-4, 7)
- Linting validation (all parts)
- Build test validation (all parts)

## Critical Reminders

**✅ DO:**

- Focus on code quality, type safety, and security
- Validate configurations are complete and correct
- Check database schema relationships and indexes
- Ensure no 'any' types in critical paths
- Validate error handling is comprehensive
- For Python (Part 6): Check PEP 8 compliance and proper exception handling

**❌ DON'T:**

- Validate UI/styling concerns (this is backend only)
- Treat OpenAPI as strict requirement (reference only)
- Skip part-specific validation steps

## Required Outputs

Generate all required outputs:

1. Master Validation Report (with part-specific health score)
2. Part-Specific Detailed Report:
   - Configuration Validation Report (Part 1)
   - Database Schema Validation Report (Part 2)
   - Type System Validation Report (Part 3)
   - Business Logic Validation Report (Part 4)
   - Python Service Validation Report (Part 6)
   - API Routes Validation Report (Part 7)
3. OpenAPI vs Reality Comparison (Parts 6, 7 only - informational)
4. TypeScript Validation Report (if applicable)
5. Linting Validation Report
6. Build Validation Report
7. **Actionable Fixes & Next Steps Document** (with ready-to-use prompts)

## Deliverable Format

Provide:

- Overall health score (0-100)
- Localhost readiness decision (READY / NEEDS FIXES / BLOCKED)
- Prioritized issues (🔴 Blockers, 🟡 Warnings, 🟢 Enhancements, ℹ️ Informational)
- Part-specific readiness checklist
- Ready-to-use fix prompts

---

## 📁 SAVE ALL VALIDATION REPORTS

**CRITICAL: After completing validation, save ALL reports to `docs/validation-reports/` directory.**

### Step 1: Create Directory (if needed)

```bash
mkdir -p docs/validation-reports
```

### Step 2: Save Reports with Proper Naming

**Primary Report:**

- File: `docs/validation-reports/part-[XX]-validation-report.md`
- Example: `docs/validation-reports/part-02-validation-report.md`
- Content: Master Validation Report with all sections

**Additional Reports (Optional - if very large):**

- `docs/validation-reports/part-[XX]-[type]-detailed.md`
- Example: `docs/validation-reports/part-02-database-schema-detailed.md`
- Example: `docs/validation-reports/part-06-python-service-detailed.md`
- `docs/validation-reports/part-[XX]-actionable-fixes.md`

### Step 3: File Structure

```markdown
# Part [XX] - [Part Name] Backend Validation Report

**Generated:** [Timestamp]
**Status:** [PASS/FAIL/PARTIAL]
**Part Type:** [Configuration/Database/Types/Library/Python Service/API]
**Health Score:** [X]/100

[... Full validation report content ...]

---

_Report saved to: docs/validation-reports/part-[XX]-validation-report.md_
```

### Step 4: Verify File Creation

After saving:

```bash
# Verify file exists
ls -lh docs/validation-reports/part-[XX]-validation-report.md

# Show file size
du -h docs/validation-reports/part-[XX]-validation-report.md
```

### Step 5: Confirm to User

Provide confirmation message:

```
✅ Validation Complete

Reports saved to:
- docs/validation-reports/part-[XX]-validation-report.md (Main report)
- docs/validation-reports/part-[XX]-actionable-fixes.md (Fix prompts)

Total size: [X] KB
Files ready for review.
```

---

**Please begin the validation now.**
