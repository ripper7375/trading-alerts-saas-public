# Affiliate System Files - Updates Needed

**Date:** 2025-11-15
**Issue:** Multiple files need updates for correct affiliate discount logic

---

## Issues Found

### 1. Wrong Discount Percentage (10% → 20%)

Files with "10% discount" that should be "20%":

- docs/AFFILIATE-ADMIN-JOURNEY.md (8 instances)
- ui-frontend-user-journey/saas-user-journey-updated.md (1 instance)
- docs/policies/05-coding-patterns.md (4 instances)
- docs/policies/03-architecture-rules.md (3 instances)
- docs/policies/01-approval-policies.md (2 instances)
- docs/diagrams/diagram-06-db-schema.mermaid (2 instances)

### 2. Wrong Price Calculations

Need to update examples:

- Discount: $2.90 → $5.80
- Discounted price: $26.10 → $23.20

### 3. Missing Competitive Model Documentation

Need to add/clarify:

- PRO users CAN apply codes at renewal
- Users can switch affiliates monthly
- One-time use drives competition

---

## Files to Review (User's List)

### Core Documentation

- [ ] ARCHITECTURE.md - High-level, likely OK
- [ ] PROGRESS.md - Check for affiliate mentions

### Phase/Policy Files

- [ ] docs/v7/v7_phase_1_policies.md
- [ ] docs/v7/v7_phase_3_building.md
- [ ] docs/policies/01-approval-policies.md - FIX 10% → 20%
- [ ] docs/policies/03-architecture-rules.md - FIX 10% → 20%
- [ ] docs/policies/04-escalation-triggers.md
- [ ] docs/policies/05-coding-patterns.md - FIX 10% → 20%
- [ ] docs/policies/06-aider-instructions.md

### Schema/API Files

- [ ] docs/diagrams/diagram-06-db-schema.mermaid - FIX 10% → 20%
- [ ] docs/trading_alerts_openapi.yaml
- [ ] docs/v5-structure-division.md

### Affiliate Journey Files

- [ ] docs/AFFILIATE-ADMIN-JOURNEY.md - FIX 10% → 20% (8 instances)
- [ ] docs/AFFILIATE-MARKETING-INTEGRATION-CHECKLIST.md
- [ ] ui-frontend-user-journey/journey-4-affiliate-registration.mermaid
- [ ] ui-frontend-user-journey/journey-5-affiliate-dashboard.mermaid
- [ ] ui-frontend-user-journey/journey-6-admin-affiliate-management.mermaid

### User Journey Files

- [ ] ui-frontend-user-journey/saas-user-journey-updated.md - FIX 10% → 20%
- [ ] ui-frontend-user-journey/mermaid-diagrams/journey-2-upgrade-pro.mermaid

### Configuration

- [ ] .aider.conf.yml

---

## Update Strategy

1. Fix discount percentage (10% → 20%)
2. Fix price calculations
3. Add competitive model notes where relevant
4. Verify PRO user renewal logic documented
5. Commit all changes

---

**Status:** In Progress
