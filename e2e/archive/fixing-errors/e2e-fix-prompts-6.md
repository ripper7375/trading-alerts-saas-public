## Prompt 6: Add data-testid to Alert Card and List Components

**Priority:** Medium
**Files:** 2 files
**Estimated Tests Fixed:** 10 (remaining alert tests)

```
Please add data-testid attributes to the alert card and list components.

Files to modify:
1. components/alerts/alert-card.tsx
2. components/alerts/alert-list.tsx

For alert-card.tsx:
1. The card container should have data-testid="alert-item"
2. Symbol display should have data-testid="alert-symbol"
3. Timeframe display should have data-testid="alert-timeframe"
4. Toggle/pause button should have data-testid="alert-toggle"
5. Delete button should have data-testid="alert-delete-button"
6. Edit button (if exists) should have data-testid="alert-edit-button"

For alert-list.tsx:
1. The list container should have data-testid="alerts-list"
2. Empty state should have data-testid="alerts-empty-state"
3. Confirm delete button in modal should have data-testid="confirm-delete"

Note: Check if these components are actually used or if alerts-client.tsx renders everything directly.
If alerts-client.tsx handles all rendering, focus only on that file (covered in Prompt 2).

Verify by checking how AlertCard and AlertList are imported and used in the codebase.
```

---
