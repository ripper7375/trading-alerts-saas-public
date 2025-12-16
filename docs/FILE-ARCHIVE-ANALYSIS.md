# File Usage Analysis - Archive Recommendations

**Date:** 2025-11-18
**Purpose:** Identify files that can be archived after build-order system implementation

---

## ✅ **ACTIVELY USED FILES (Keep in Main Docs)**

### **1. Core Framework (In .aider.conf.yml)**

```
✅ docs/policies/* (9 files) - Constitutions
✅ docs/build-orders/* (20 files) - Build sequences
✅ docs/implementation-guides/* (11 files) - Reference material
✅ docs/v5-structure-division.md - Part definitions
✅ docs/decisions/google-oauth-decisions.md - OAuth decisions
✅ docs/OAUTH_IMPLEMENTATION_READY.md - OAuth handoff
```

### **2. Feature-Specific Documentation (Referenced)**

```
✅ docs/AFFILIATE-MARKETING-DESIGN.md - Loaded by Aider
✅ docs/SUBSCRIPTION-MODEL-CLARIFICATION.md - Loaded by Aider
✅ docs/SYSTEMCONFIG-USAGE-GUIDE.md - Loaded by Aider
✅ docs/admin-mt5-dashboard-implementation.md - Loaded by Aider
✅ docs/flask-multi-mt5-implementation.md - Loaded by Aider
✅ docs/google-oauth-integration-summary.md - Loaded by Aider
✅ docs/ui-components-map.md - Loaded by Aider
```

### **3. OpenAPI Specifications**

```
✅ docs/trading_alerts_openapi.yaml
✅ docs/flask_mt5_openapi.yaml
✅ docs/dlocal-openapi-endpoints.yaml
```

### **4. Phase Documentation**

```
✅ docs/v7/v7_overview.md
✅ docs/v7/v7_phase_0_setup.md
✅ docs/v7/v7_phase_1_policies.md
✅ docs/v7/v7_phase_2_foundation.md
✅ docs/v7/v7_phase_3_building.md
✅ docs/v7/v7_phase_4_deployment.md
✅ docs/v7/v7_phase_5_maintenance.md
```

---

## 📦 **ARCHIVABLE FILES (Historical/Completed Work)**

### **1. Planning Documents (Completed)**

```
📦 docs/AIDER-AUTONOMY-IMPROVEMENT-PLAN.md
   Reason: This was the PLAN for autonomy improvement
   Status: NOW IMPLEMENTED in docs/BUILD-ORDER-SYSTEM-SUMMARY.md
   Action: Archive - historical planning document
```

### **2. Review Documents (One-Time)**

```
📦 docs/POLICY_COHERENCE_REVIEW.md
   Reason: One-time review of policy coherence
   Status: Review complete, policies now coherent
   Action: Archive - historical review document
```

### **3. Checklist Documents (If Completed)**

```
📦 docs/AFFILIATE-MARKETING-INTEGRATION-CHECKLIST.md
   Reason: Checklist for affiliate integration
   Status: If integration complete, this is historical
   Action: Archive if all items checked off

📦 docs/DLOCAL-DOCUMENTATION-UPDATE-CHECKLIST.md
   Reason: Checklist for dLocal docs update
   Status: If docs updated, this is historical
   Action: Archive if all items checked off
```

### **4. Redundant Summaries (Multiple Docs for Same Feature)**

**Affiliate Marketing (6 documents - can consolidate):**

```
📦 docs/AFFILIATE-ADMIN-JOURNEY.md
📦 docs/AFFILIATE-SYSTEM-COMPREHENSIVE-UPDATE-SUMMARY.md
📦 docs/AFFILIATE-SYSTEM-SETTINGS-DESIGN.md
📦 docs/AFFILIATE-SYSTEM-UPDATES-NEEDED.md
   Keep: docs/AFFILIATE-MARKETING-DESIGN.md (loaded by Aider)
   Action: Archive the 4 redundant summary/design docs
```

**dLocal Payment (3 documents - can consolidate):**

```
📦 docs/DISCOUNT-CODE-CORRECTION-SUMMARY.md
   Reason: Specific correction made - historical
   Action: Archive

📦 docs/DLOCAL-INTEGRATION-SUMMARY.md
   Reason: May be redundant with policy 07
   Status: Check if superseded by 07-dlocal-integration-rules.md
   Action: Archive if redundant
```

### **5. Comprehension Test Documents (If Testing Complete)**

```
📦 docs/v7/AIDER-COMPREHENSION-TESTS.md
   Reason: Testing document
   Status: If tests passed, this is historical
   Action: Archive if testing phase complete

📦 docs/v7/PHASE-1-READINESS-CHECK.md
   Reason: Phase 1 readiness check
   Status: If Phase 1 complete, this is historical
   Action: Archive if already past Phase 1
```

### **6. Setup Guides (May Merge)**

```
📦 docs/setup/google-oauth-setup.md
   Status: Could be merged into main OAuth docs
   Action: Consider merging into OAUTH_IMPLEMENTATION_READY.md
           Then archive standalone setup guide
```

### **7. SystemConfig Guides (Consolidate?)**

```
📦 docs/V0DEV-SYSTEMCONFIG-INTEGRATION-GUIDE.md
   Keep: docs/SYSTEMCONFIG-USAGE-GUIDE.md (loaded by Aider)
   Action: Check if V0DEV guide is redundant
           Archive if superseded by SYSTEMCONFIG-USAGE-GUIDE.md
```

### **8. New Summary Document (Keep or Archive?)**

```
✅ docs/BUILD-ORDER-SYSTEM-SUMMARY.md
   Reason: Documents the new build-order system
   Status: KEEP - important reference for system we just built
   Action: Keep in main docs
```

---

## 📊 **Summary Statistics**

```
Total Documentation Files: ~74
Active (Keep): ~52 files
Archivable: ~22 files

Breakdown of Archivable:
  - Planning docs (completed): 1
  - Review docs (one-time): 1
  - Checklists (if complete): 2
  - Redundant summaries: 4 (affiliate) + 2 (dlocal) = 6
  - Test docs (if complete): 2
  - Setup guides (consolidate): 1
  - SystemConfig (consolidate): 1
  - Other summaries: 2-4
```

---

## 🗂️ **Recommended Archive Structure**

Create this structure:

```
docs/archive/
├── README.md (explains what's archived and why)
├── planning/
│   ├── AIDER-AUTONOMY-IMPROVEMENT-PLAN.md
│   └── POLICY_COHERENCE_REVIEW.md
├── checklists/
│   ├── AFFILIATE-MARKETING-INTEGRATION-CHECKLIST.md
│   └── DLOCAL-DOCUMENTATION-UPDATE-CHECKLIST.md
├── summaries/
│   ├── affiliate/
│   │   ├── AFFILIATE-ADMIN-JOURNEY.md
│   │   ├── AFFILIATE-SYSTEM-COMPREHENSIVE-UPDATE-SUMMARY.md
│   │   ├── AFFILIATE-SYSTEM-SETTINGS-DESIGN.md
│   │   └── AFFILIATE-SYSTEM-UPDATES-NEEDED.md
│   └── dlocal/
│       ├── DISCOUNT-CODE-CORRECTION-SUMMARY.md
│       └── DLOCAL-INTEGRATION-SUMMARY.md
├── testing/
│   ├── AIDER-COMPREHENSION-TESTS.md
│   └── PHASE-1-READINESS-CHECK.md
└── setup-guides/
    ├── google-oauth-setup.md
    └── V0DEV-SYSTEMCONFIG-INTEGRATION-GUIDE.md
```

---

## ✅ **Recommended Actions**

### **Immediate (High Confidence):**

1. ✅ Create `docs/archive/` directory
2. ✅ Move planning docs:
   - AIDER-AUTONOMY-IMPROVEMENT-PLAN.md → archive/planning/
   - POLICY_COHERENCE_REVIEW.md → archive/planning/

### **After Verification (Check First):**

3. ⚠️ Check checklists - if all items complete:
   - Move AFFILIATE-MARKETING-INTEGRATION-CHECKLIST.md → archive/checklists/
   - Move DLOCAL-DOCUMENTATION-UPDATE-CHECKLIST.md → archive/checklists/

4. ⚠️ Consolidate affiliate docs - keep AFFILIATE-MARKETING-DESIGN.md, archive:
   - AFFILIATE-ADMIN-JOURNEY.md → archive/summaries/affiliate/
   - AFFILIATE-SYSTEM-COMPREHENSIVE-UPDATE-SUMMARY.md → archive/summaries/affiliate/
   - AFFILIATE-SYSTEM-SETTINGS-DESIGN.md → archive/summaries/affiliate/
   - AFFILIATE-SYSTEM-UPDATES-NEEDED.md → archive/summaries/affiliate/

5. ⚠️ Archive dLocal summaries:
   - DISCOUNT-CODE-CORRECTION-SUMMARY.md → archive/summaries/dlocal/
   - Check if DLOCAL-INTEGRATION-SUMMARY.md redundant with policy 07

6. ⚠️ Check test docs - if testing complete:
   - AIDER-COMPREHENSION-TESTS.md → archive/testing/
   - PHASE-1-READINESS-CHECK.md → archive/testing/

---

## 🎯 **Benefits of Archiving**

1. **Cleaner Documentation Structure**
   - Main docs contain only active, current files
   - Easier to navigate

2. **Preserved History**
   - Nothing is deleted, just moved to archive
   - Can reference historical decisions if needed

3. **Better Aider Performance**
   - Fewer irrelevant files in docs/
   - Clearer signal-to-noise ratio

4. **Easier Maintenance**
   - Clear which docs are current vs historical
   - Easier to update active docs

---

## ⚠️ **Before Archiving - Verify These Questions:**

1. ✅ Are all checklist items completed?
2. ✅ Are the affiliate summary docs redundant?
3. ✅ Is DLOCAL-INTEGRATION-SUMMARY.md superseded by policy 07?
4. ✅ Is Phase 1 testing complete?
5. ✅ Can setup guides be merged into main docs?

**Recommendation:** Review each file in the "archivable" list before moving.

---

**Last Updated:** 2025-11-18
**Next Action:** Create archive structure and move files with high confidence
