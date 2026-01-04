┌─────────────────────────────────────────────┐
│ E2E TEST VALIDATION FLOW │
├─────────────────────────────────────────────┤
│ │
│ 1. Do test files have technical errors? │
│ (wrong selectors, timing issues, etc.) │
│ │
│ YES → Fix test files → Re-test │
│ NO → Continue ↓ │
│ │
│ 2. Does production code align with docs? │
│ │
│ NO → Test FAIL + comment: │
│ "Fix production code to align │
│ with [specific document]" │
│ │
│ YES → Test PASS ✓ │
│ │
└────────────────────────────────────────────┘
