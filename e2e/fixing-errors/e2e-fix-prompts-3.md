## Prompt 3: Add data-testid Attributes to Alert Form

**Priority:** High
**Files:** 1 file
**Estimated Tests Fixed:** 25 (form-related tests)

```
Please add data-testid attributes to the alert form component for E2E testing.

File to modify: components/alerts/alert-form.tsx

Add the following data-testid attributes:

1. Line ~171 - Form element:
   Add: data-testid="alert-form"

2. Line ~184 - Symbol Select trigger:
   Add: data-testid="symbol-select"

3. Line ~194 - Each Symbol SelectItem:
   Add: data-testid="symbol-option"

4. Line ~210 - Timeframe Select trigger:
   Add: data-testid="timeframe-select"

5. Line ~220 - Each Timeframe SelectItem:
   Add: data-testid="timeframe-option"

6. Line ~234 - Condition selector container (radio buttons):
   Add: data-testid="condition-select" on the container div

7. Line ~272 - Price/Target value Input:
   Add: data-testid="price-input"

8. Line ~294 - Alert name Input:
   Add: data-testid="alert-name-input"

9. Line ~309 - Cancel Button:
   Add: data-testid="cancel-button"

10. Line ~318 - Submit Button:
    Add: data-testid="submit-alert-button"

11. Line ~174 - Error message div:
    Add: data-testid="error-message"

12. Add a success message element (if not exists) with:
    data-testid="success-message"

Example for Select components:
<Select>
  <SelectTrigger data-testid="symbol-select">
    <SelectValue placeholder="Select a symbol" />
  </SelectTrigger>
  <SelectContent>
    {availableSymbols.map((s) => (
      <SelectItem key={s} value={s} data-testid="symbol-option">
        {s}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

---
