## Prompt 2: Add data-testid Attributes to Alerts Client

**Priority:** High
**Files:** 1 file
**Estimated Tests Fixed:** 40 (ALT-002 to ALT-007, ALT-014, ALT-025 to ALT-030)

```
Please add data-testid attributes to the alerts client component for E2E testing.

File to modify: app/(dashboard)/alerts/alerts-client.tsx

Add the following data-testid attributes:

1. Line ~454 - "Create New Alert" Button:
   Add: data-testid="create-alert-button"

2. Line ~333 - Each Alert Card container:
   Add: data-testid="alert-item"

3. Line ~353 - Symbol Badge inside alert card:
   Add: data-testid="alert-symbol"

4. Line ~354 - Timeframe span inside alert card:
   Add: data-testid="alert-timeframe"

5. Lines ~406, ~416 - Pause and Resume buttons:
   Add: data-testid="alert-toggle"

6. Line ~425 - Delete button:
   Add: data-testid="alert-delete-button"

7. Line ~517 - Status filter buttons container:
   Add: data-testid="status-filter" to the filter container

8. Line ~535 - Symbol filter Select:
   Add: data-testid="symbol-filter"

9. Line ~582 - Empty state Card (when no alerts):
   Add: data-testid="alerts-empty-state"

10. Line ~473 - Alert limit warning link:
    Add: data-testid="alert-limit-warning"

Example pattern:
// Before
<Button onClick={handleCreate}>+ Create New Alert</Button>

// After
<Button onClick={handleCreate} data-testid="create-alert-button">+ Create New Alert</Button>

// Before
<Card key={alert.id} className="...">

// After
<Card key={alert.id} className="..." data-testid="alert-item">

Ensure all interactive elements have test IDs so Playwright E2E tests can reliably select them.
```

---
