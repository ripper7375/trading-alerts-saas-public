# Shift-Left Testing KPIs - Tracking Dashboard

**Purpose:** Monitor effectiveness of shift-left testing implementation
**Updated:** Weekly (every Monday)
**Owner:** Development Team

---

## 📊 Current Metrics (Week of YYYY-MM-DD)

### 🎯 Primary KPIs

| Metric                            | Current  | Target  | Status   | Trend   |
| --------------------------------- | -------- | ------- | -------- | ------- |
| **First-Pass CI/CD Success Rate** | \_\_%    | 95%+    | 🟢/🟡/🔴 | ↗️/→/↘️ |
| **Average Time to Merge**         | \_\_ min | <30 min | 🟢/🟡/🔴 | ↗️/→/↘️ |
| **Layer 1 Catch Rate**            | \_\_%    | 90%+    | 🟢/🟡/🔴 | ↗️/→/↘️ |
| **Layer 2 Catch Rate**            | \_\_%    | 9%      | 🟢/🟡/🔴 | ↗️/→/↘️ |
| **Layer 3 Catch Rate**            | \_\_%    | 1%      | 🟢/🟡/🔴 | ↗️/→/↘️ |

**Status Legend:**

- 🟢 Green: Meeting or exceeding target
- 🟡 Yellow: Within 10% of target
- 🔴 Red: Below target by >10%

**Trend Legend:**

- ↗️ Improving
- → Stable
- ↘️ Declining

---

## 🔍 Detailed Metrics

### CI/CD Health

| Week       | Total PRs | First-Pass Success | ESLint Failures | Jest Failures | Type Errors | Other |
| ---------- | --------- | ------------------ | --------------- | ------------- | ----------- | ----- |
| 2025-11-18 | \_\_      | \_\_%              | \_\_            | \_\_          | \_\_        | \_\_  |
| 2025-11-25 | \_\_      | \_\_%              | \_\_            | \_\_          | \_\_        | \_\_  |
| 2025-12-02 | \_\_      | \_\_%              | \_\_            | \_\_          | \_\_        | \_\_  |
| 2025-12-09 | \_\_      | \_\_%              | \_\_            | \_\_          | \_\_        | \_\_  |

**How to Calculate:**

```bash
# Count PRs merged this week
gh pr list --state merged --search "merged:>=YYYY-MM-DD" --json number | jq '. | length'

# Count PRs that passed first try (no failed CI runs before merge)
gh pr list --state merged --search "merged:>=YYYY-MM-DD" --json number,statusCheckRollup
```

---

### Development Efficiency

| Week       | Avg Time to Merge | Rework Cycles | Token Usage | Phase 3 Time | Phase 3.5 Time |
| ---------- | ----------------- | ------------- | ----------- | ------------ | -------------- |
| 2025-11-18 | \_\_ min          | \_\_          | \_\_ tokens | \_\_ hrs     | \_\_ hrs       |
| 2025-11-25 | \_\_ min          | \_\_          | \_\_ tokens | \_\_ hrs     | \_\_ hrs       |
| 2025-12-02 | \_\_ min          | \_\_          | \_\_ tokens | \_\_ hrs     | \_\_ hrs       |
| 2025-12-09 | \_\_ min          | \_\_          | \_\_ tokens | \_\_ hrs     | \_\_ hrs       |

**How to Calculate:**

```bash
# Average time from PR creation to merge
gh pr list --state merged --search "merged:>=YYYY-MM-DD" --json createdAt,mergedAt

# Rework cycles = Number of pushes to PR before merge
gh pr view <PR-NUMBER> --json commits | jq '.commits | length'
```

---

### Code Quality

| Week       | TypeScript `any` Usage | Test Coverage | Console Statements | Package Collisions |
| ---------- | ---------------------- | ------------- | ------------------ | ------------------ |
| 2025-11-18 | \_\_%                  | \_\_%         | \_\_               | \_\_               |
| 2025-11-25 | \_\_%                  | \_\_%         | \_\_               | \_\_               |
| 2025-12-02 | \_\_%                  | \_\_%         | \_\_               | \_\_               |
| 2025-12-09 | \_\_%                  | \_\_%         | \_\_               | \_\_               |

**How to Calculate:**

```bash
# TypeScript 'any' usage
grep -r "any" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=__tests__ | wc -l

# Test coverage
npm run test:coverage | grep "All files"

# Console statements
grep -r "console.log" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=__tests__ | wc -l

# Package naming collisions
find . -name "package.json" -not -path "*/node_modules/*" -exec jq -r '.name' {} \; | sort | uniq -d
```

---

## 📈 Historical Trends

### First-Pass CI/CD Success Rate

```
100% │
 95% │                                    ●─────●
 90% │                          ●────●
 85% │                 ●────●
 80% │        ●────●
 75% │────●
     └───────────────────────────────────────────
       Week Week Week Week Week Week Week Week
        1    2    3    4    5    6    7    8
```

**Target:** 95%+ sustained for 4 consecutive weeks

---

### Average Time to Merge

```
60m │
50m │
40m │                                    ●
30m │                          ●────●────●────●
20m │        ●────●────●────●
10m │────●
    └───────────────────────────────────────────
       Week Week Week Week Week Week Week Week
        1    2    3    4    5    6    7    8
```

**Target:** <30 minutes sustained for 4 consecutive weeks

---

## 🎯 Goals and Milestones

### Short-Term Goals (1-2 Weeks)

- [ ] Achieve 85%+ first-pass CI/CD success rate
- [ ] Reduce average time to merge to <45 minutes
- [ ] Zero package naming collisions
- [ ] Zero console.log statements in production code

### Medium-Term Goals (1 Month)

- [ ] Achieve 95%+ first-pass CI/CD success rate
- [ ] Reduce average time to merge to <30 minutes
- [ ] Test coverage ≥60% across all files
- [ ] Zero TypeScript `any` types in production code

### Long-Term Goals (3 Months)

- [ ] Maintain 95%+ first-pass CI/CD success rate for 4 consecutive weeks
- [ ] Average time to merge <20 minutes
- [ ] Test coverage ≥75% across all files
- [ ] Complete elimination of rework cycles

---

## 🚨 Alert Thresholds

**Trigger action if:**

| Metric                   | Threshold           | Action                                |
| ------------------------ | ------------------- | ------------------------------------- |
| First-Pass Success Rate  | <80% for 2 weeks    | Review policies, update training      |
| Average Time to Merge    | >45 min for 2 weeks | Investigate bottlenecks               |
| Layer 1 Catch Rate       | <85%                | Review Aider context, update policies |
| Layer 2 Hook Bypass Rate | >10%                | Investigate why hooks bypassed        |
| ESLint Failures          | >3 per week         | Review ESLint rules, update training  |
| Jest Failures            | >3 per week         | Review test quality, update patterns  |

---

## 📊 Weekly Review Template

### Week of YYYY-MM-DD

**Summary:**

- Total PRs merged: \_\_
- First-pass success: \_\_%
- Avg time to merge: \_\_ minutes

**Highlights:**

- ✅ What went well this week
- ✅ Improvements noticed

**Challenges:**

- ⚠️ Issues encountered
- ⚠️ Bottlenecks identified

**Actions for Next Week:**

1. [ ] Action item 1
2. [ ] Action item 2
3. [ ] Action item 3

**Policy Updates Needed:**

- [ ] Update policy X based on pattern Y
- [ ] Clarify rule Z in documentation

---

## 🔗 Data Collection Scripts

### Automated Data Collection

Create `scripts/collect-metrics.sh`:

```bash
#!/bin/bash
# Collects shift-left testing metrics

echo "📊 Shift-Left Testing Metrics"
echo "Generated: $(date)"
echo ""

echo "🔍 Code Quality Metrics:"
echo "TypeScript 'any' usage:"
grep -r ": any" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=__tests__ | wc -l

echo ""
echo "console.log statements:"
grep -r "console.log" --include="*.ts" --include="*.tsx" --exclude-dir=node_modules --exclude-dir=__tests__ | wc -l

echo ""
echo "Test Coverage:"
npm run test:coverage 2>&1 | grep "All files"

echo ""
echo "Package naming:"
find . -name "package.json" -not -path "*/node_modules/*" -exec jq -r '.name' {} \; | sort | uniq -d
```

**Usage:**

```bash
chmod +x scripts/collect-metrics.sh
./scripts/collect-metrics.sh
```

---

## 📖 Related Documents

- [Shift-Left Testing Principles](../principles/shift-left-testing.md)
- [Phase 3 Completion Checklist](../checklists/phase-3-completion-checklist.md)
- [Testing Framework Compliance](../policies/09-testing-framework-compliance.md)
- [CI/CD Workflows](../../.github/workflows/README.md)

---

**Last Updated:** 2025-11-26
**Version:** 1.0
**Next Review:** Weekly (every Monday)
