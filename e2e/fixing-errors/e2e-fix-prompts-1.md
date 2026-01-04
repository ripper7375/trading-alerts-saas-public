## Prompt 1: Fix Billing Page - Cancel Modal & Resubscribe

**Priority:** High
**Files:** 1 file
**Estimated Tests Fixed:** 30 (CAN-003 to CAN-007, CAN-012)

```
Please fix the billing page to add a cancel confirmation modal and resubscribe functionality.

File to modify: app/(dashboard)/settings/billing/page.tsx

BUG #1 - Cancel Confirmation Modal Missing:
1. The "Cancel Plan" button (around line 179-184) currently triggers cancellation directly without confirmation
2. Add an AlertDialog component that wraps the cancel button
3. The dialog should show:
   - Title: "Cancel Subscription?"
   - Description warning about losing PRO features at end of billing period
   - "Keep My Plan" button to dismiss
   - "Yes, Cancel" button to confirm and proceed with cancellation
4. Only call the cancel API after user confirms in the modal

BUG #2 - No Resubscribe Option:
1. Check if subscription has cancelledAt set (meaning user cancelled but subscription hasn't expired)
2. For cancelled subscriptions, show:
   - "Cancelled" badge instead of "Active"
   - Expiration date ("Access until: [date]")
   - "Resubscribe" button instead of "Cancel Plan"
3. The Resubscribe button should call an API to reactivate the subscription

Use the AlertDialog component from @/components/ui/alert-dialog (shadcn/ui pattern).

After making changes, ensure the component properly handles all subscription states:
- ACTIVE: Show cancel button with confirmation modal
- CANCELLED (not expired): Show resubscribe button and expiry date
- EXPIRED: Show upgrade button
```

---
