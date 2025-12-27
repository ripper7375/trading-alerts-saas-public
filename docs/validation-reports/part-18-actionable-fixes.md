# Part 18 - Actionable Fixes & Ready-to-Use Prompts

**Generated:** 2025-12-26
**Related Report:** part-18-validation-report.md

---

## Quick Reference

| Priority         | Count | Action Required                         |
| ---------------- | ----- | --------------------------------------- |
| 🔴 Blockers      | 0     | None                                    |
| 🟡 Warnings      | 0     | All resolved                            |
| ✅ Fixed         | 2     | Full fraud detection system implemented |
| 🟢 Enhancements  | 3     | Optional                                |
| ℹ️ Informational | 4     | No action                               |

---

## ✅ Warnings (All Resolved)

### ✅ Warning 1: Replace Mock Data in Fraud Alerts (FIXED)

**Location:** `app/(dashboard)/admin/fraud-alerts/page.tsx`

**Issue:** ~~The fraud alerts page uses `MOCK_ALERTS` constant instead of real API data.~~

**Status:** FIXED on 2025-12-26

**What was implemented:**

1. **Prisma Schema Update** (`prisma/schema.prisma`):
   - Added `FraudAlertStatus` enum (PENDING, REVIEWED, DISMISSED, BLOCKED)
   - Added `FraudAlertSeverity` enum (LOW, MEDIUM, HIGH, CRITICAL)
   - Updated `FraudAlert` model with proper types, status field, and payment context fields

2. **Fraud Detection Service** (`lib/fraud/fraud-detection.service.ts`):
   - Created comprehensive fraud detection logic
   - Detects: Multiple 3-day attempts, Velocity limits, Failed payments, IP mismatches
   - Functions: `runFraudChecks()`, `createFraudAlerts()`, `detectAndAlertFraud()`
   - Admin functions: `getFraudAlerts()`, `getFraudAlertStats()`, `updateFraudAlertStatus()`, `blockUserFromFraudAlert()`

3. **Admin API Endpoints**:
   - `app/api/admin/fraud-alerts/route.ts` - GET with pagination and filters
   - `app/api/admin/fraud-alerts/[id]/route.ts` - GET single, PATCH to update status

4. **Frontend Updates**:
   - Removed `MOCK_ALERTS` constant
   - Updated `fetchAlerts` to call real API with server-side filtering
   - Added proper loading states and error handling
   - Updated `FraudAlertCard` component to handle nullable fields

---

### ✅ Warning 2: Add User-Facing Error Toast for Fraud Alerts (FIXED)

**Location:** `app/(dashboard)/admin/fraud-alerts/page.tsx`

**Issue:** ~~Fetch errors only log to console, no user feedback.~~

**Status:** FIXED on 2025-12-26

**What was implemented:**

- Added `useToast` hook import from `@/hooks/use-toast`
- Added `ToastContainer` component import from `@/components/ui/toast-container`
- Added toast notification in catch block: `showError('Failed to load fraud alerts', 'Please try again later.')`
- Added `ToastContainer` component at the end of the JSX to display toasts

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

- [x] Replace mock data in fraud alerts page (DONE - 2025-12-26)
- [x] Add error toasts for failed API calls (DONE - 2025-12-26)
- [x] Implement fraud detection service (DONE - 2025-12-26)
- [x] Create fraud alerts API endpoints (DONE - 2025-12-26)
- [ ] Run `npx prisma migrate dev` to apply schema changes
- [ ] Verify all environment variables are set
- [ ] Test webhook signature verification
- [ ] Test 3-day plan eligibility flow
- [ ] Test discount code validation
- [ ] Test exchange rate API and fallback
- [ ] Review admin access controls

---

_Document saved to: docs/validation-reports/part-18-actionable-fixes.md_
