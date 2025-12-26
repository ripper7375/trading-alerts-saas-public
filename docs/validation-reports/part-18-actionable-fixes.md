# Part 18 - Actionable Fixes & Ready-to-Use Prompts

**Generated:** 2025-12-26
**Related Report:** part-18-validation-report.md

---

## Quick Reference

| Priority | Count | Action Required |
|----------|-------|-----------------|
| 🔴 Blockers | 0 | None |
| 🟡 Warnings | 2 | Before production |
| 🟢 Enhancements | 3 | Optional |
| ℹ️ Informational | 4 | No action |

---

## 🟡 Warnings (Fix Before Production)

### Warning 1: Replace Mock Data in Fraud Alerts

**Location:** `app/(dashboard)/admin/fraud-alerts/page.tsx`

**Issue:** The fraud alerts page uses `MOCK_ALERTS` constant instead of real API data.

**Ready-to-Use Prompt:**
```
In app/(dashboard)/admin/fraud-alerts/page.tsx:

1. Remove the MOCK_ALERTS constant (lines 56-99)

2. Update the fetchAlerts function to call the real API:

const fetchAlerts = async (): Promise<void> => {
  setLoading(true);
  try {
    const res = await fetch('/api/admin/fraud-alerts');
    if (!res.ok) {
      throw new Error('Failed to fetch alerts');
    }
    const data = await res.json();
    setAlerts(data.alerts || []);
  } catch (error) {
    console.error('Failed to fetch fraud alerts:', error);
    // Show error toast to user
    toast.error('Failed to load fraud alerts');
  } finally {
    setLoading(false);
  }
};

3. Ensure the API endpoint exists at app/api/admin/fraud-alerts/route.ts
```

**Verification:**
```bash
# Check if the API exists
cat app/api/admin/fraud-alerts/route.ts
```

---

### Warning 2: Add User-Facing Error Toast for Fraud Alerts

**Location:** `app/(dashboard)/admin/fraud-alerts/page.tsx`

**Issue:** Fetch errors only log to console, no user feedback.

**Ready-to-Use Prompt:**
```
In app/(dashboard)/admin/fraud-alerts/page.tsx:

1. Add toast import at the top:
import { toast } from 'sonner';

2. In the catch block of fetchAlerts, add user feedback:

} catch (error) {
  console.error('Failed to fetch fraud alerts:', error);
  toast.error('Failed to load fraud alerts. Please try again.');
} finally {

3. Also add an error state variable and display inline error:

const [error, setError] = useState<string | null>(null);

// In catch block:
setError('Unable to load fraud alerts');

// In JSX, above the alerts list:
{error && (
  <Card className="border-destructive">
    <CardContent className="p-4 text-center">
      <p className="text-destructive">{error}</p>
      <Button onClick={fetchAlerts} className="mt-2">
        Retry
      </Button>
    </CardContent>
  </Card>
)}
```

---

## 🟢 Enhancements (Optional Improvements)

### Enhancement 1: Add Pagination to Fraud Alerts

**Location:** `app/(dashboard)/admin/fraud-alerts/page.tsx`

**Benefit:** Handle large datasets efficiently

**Ready-to-Use Prompt:**
```
Add pagination to the fraud alerts page:

1. Add pagination state:
const [page, setPage] = useState(1);
const [totalPages, setTotalPages] = useState(1);
const PAGE_SIZE = 20;

2. Update fetch to include pagination:
const res = await fetch(`/api/admin/fraud-alerts?page=${page}&limit=${PAGE_SIZE}`);
const data = await res.json();
setAlerts(data.alerts);
setTotalPages(Math.ceil(data.total / PAGE_SIZE));

3. Add pagination controls after the alerts list:
<div className="flex items-center justify-between mt-6">
  <Button
    variant="outline"
    onClick={() => setPage(p => Math.max(1, p - 1))}
    disabled={page === 1}
  >
    Previous
  </Button>
  <span className="text-sm text-muted-foreground">
    Page {page} of {totalPages}
  </span>
  <Button
    variant="outline"
    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
    disabled={page === totalPages}
  >
    Next
  </Button>
</div>
```

---

### Enhancement 2: Add Export Functionality

**Location:** `app/(dashboard)/admin/fraud-alerts/page.tsx`

**Benefit:** Allow admins to export alerts for reporting

**Ready-to-Use Prompt:**
```
Add CSV export button to fraud alerts page:

1. Add export function:
const exportToCSV = () => {
  const headers = ['ID', 'Severity', 'Pattern', 'User', 'Country', 'Amount', 'Status', 'Created'];
  const rows = filteredAlerts.map(a => [
    a.id,
    a.severity,
    a.pattern,
    a.userEmail,
    a.country,
    `${a.currency} ${a.amount}`,
    a.status,
    new Date(a.createdAt).toISOString()
  ]);

  const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fraud-alerts-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
};

2. Add export button in the header:
<Button variant="outline" onClick={exportToCSV}>
  <Download className="mr-2 h-4 w-4" />
  Export CSV
</Button>
```

---

### Enhancement 3: Add Bulk Actions

**Location:** `app/(dashboard)/admin/fraud-alerts/page.tsx`

**Benefit:** Efficiently handle multiple alerts

**Ready-to-Use Prompt:**
```
Add bulk selection and actions to fraud alerts:

1. Add selection state:
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

2. Add select all checkbox in filters:
<Checkbox
  checked={selectedIds.size === filteredAlerts.length}
  onCheckedChange={(checked) => {
    if (checked) {
      setSelectedIds(new Set(filteredAlerts.map(a => a.id)));
    } else {
      setSelectedIds(new Set());
    }
  }}
/>

3. Add bulk action buttons when items selected:
{selectedIds.size > 0 && (
  <div className="flex items-center gap-2 bg-muted p-2 rounded">
    <span className="text-sm">{selectedIds.size} selected</span>
    <Button size="sm" variant="outline" onClick={bulkDismiss}>
      Dismiss Selected
    </Button>
    <Button size="sm" variant="destructive" onClick={bulkBlock}>
      Block Selected
    </Button>
  </div>
)}
```

---

## ℹ️ Informational Notes

### Note 1: 3-Day Plan Restriction Logic

**Location:** Multiple files

**How it works:**
- User table has `hasUsedThreeDayPlan` boolean
- `check-three-day-eligibility` API checks this flag
- On successful payment, webhook sets `hasUsedThreeDayPlan = true`
- PlanSelector disables 3-day option if not eligible

---

### Note 2: Discount Code Restrictions

**Location:** `components/payments/DiscountCodeInput.tsx`

**Behavior:**
- Discount codes only work for `MONTHLY` plan
- `THREE_DAY` plan shows "not available" message
- Real-time validation via `/api/payments/dlocal/validate-discount`

---

### Note 3: Exchange Rate Caching

**Location:** `lib/dlocal/currency-converter.service.ts`

**Cache Settings:**
```typescript
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
```

**Fallback Rates:**
- INR: 83.12
- NGN: 1505.5
- PKR: 278.45
- VND: 24750.0
- IDR: 15680.0
- THB: 35.25
- ZAR: 18.65
- TRY: 32.15

---

### Note 4: Webhook Signature Verification

**Location:** `lib/dlocal/dlocal-payment.service.ts`

**Implementation:**
```typescript
const expectedSignature = crypto
  .createHmac('sha256', webhookSecret)
  .update(payload)
  .digest('hex');
```

**Required Environment Variable:**
```
DLOCAL_WEBHOOK_SECRET=your-secret-here
```

---

## Pre-Production Checklist

Before deploying to production:

- [ ] Replace mock data in fraud alerts page
- [ ] Add error toasts for failed API calls
- [ ] Verify all environment variables are set
- [ ] Test webhook signature verification
- [ ] Test 3-day plan eligibility flow
- [ ] Test discount code validation
- [ ] Test exchange rate API and fallback
- [ ] Review admin access controls

---

*Document saved to: docs/validation-reports/part-18-actionable-fixes.md*
