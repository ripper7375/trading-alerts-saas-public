# Optimistic UI Pattern Implementation

**Last Updated:** 2024-12-31
**Purpose:** Document the optimistic UI pattern implementation for AI agents and developers

---

## Table of Contents

1. [Overview](#overview)
2. [Core Hook: useOptimisticMutation](#core-hook-useoptimisticmutation)
3. [Implementation by Component](#implementation-by-component)
4. [Common Patterns](#common-patterns)
5. [Undo Functionality](#undo-functionality)
6. [Error Handling & Rollback](#error-handling--rollback)
7. [Extending the Pattern](#extending-the-pattern)
8. [Troubleshooting](#troubleshooting)

---

## Overview

### What is Optimistic UI?

Optimistic UI is a pattern where the interface updates immediately as if an action succeeded, before the server confirms it. This provides instant feedback to users.

```
Traditional:  Click → Spinner → Wait for server → Update UI (500ms-2s delay)
Optimistic:   Click → Update UI immediately → Server call in background (instant)
```

### Files Modified/Created

| File | Type | Description |
|------|------|-------------|
| `hooks/use-optimistic-mutation.ts` | New | Reusable hook for optimistic mutations |
| `components/notifications/notification-list.tsx` | Modified | Optimistic mark read, delete, mark all |
| `app/(dashboard)/watchlist/watchlist-client.tsx` | Modified | Optimistic add/remove items |
| `app/(dashboard)/alerts/alerts-client.tsx` | Modified | Optimistic pause/resume, delete |
| `components/billing/subscription-card.tsx` | Modified | Optimistic cancel subscription |

---

## Core Hook: useOptimisticMutation

### Location
`hooks/use-optimistic-mutation.ts`

### API Reference

```typescript
interface OptimisticMutationOptions<TData, TVariables> {
  /** Function that performs the actual API mutation */
  mutationFn: (variables: TVariables) => Promise<TData>;

  /** Callback to optimistically update state before API call.
   *  Return a rollback function to revert on error. */
  onMutate?: (variables: TVariables) => void | (() => void);

  /** Callback when mutation succeeds */
  onSuccess?: (data: TData, variables: TVariables) => void;

  /** Callback when mutation fails - receives rollback function */
  onError?: (error: Error, variables: TVariables, rollback?: () => void) => void;

  /** Callback that runs after mutation completes (success or failure) */
  onSettled?: (data: TData | undefined, error: Error | undefined, variables: TVariables) => void;
}

interface OptimisticMutationResult<TData, TVariables> {
  mutate: (variables: TVariables) => Promise<TData | undefined>;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  data: TData | null;
  reset: () => void;
}
```

### Basic Usage

```typescript
const { mutate, isPending } = useOptimisticMutation({
  mutationFn: async (id: string) => {
    const response = await fetch(`/api/items/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed');
  },
  onMutate: (id) => {
    // 1. Store previous state
    const previousItems = items;

    // 2. Optimistically update UI
    setItems(items.filter(item => item.id !== id));

    // 3. Return rollback function
    return () => setItems(previousItems);
  },
  onError: (error, id, rollback) => {
    // 4. Rollback on failure
    rollback?.();
    toast.error('Failed to delete');
  },
});
```

### Helper Hooks

The file also exports specialized hooks:

- `useOptimisticDelete<T>` - For delete operations
- `useOptimisticToggle<T>` - For toggle operations (on/off states)

---

## Implementation by Component

### 1. Notification List

**File:** `components/notifications/notification-list.tsx`

**Operations Implemented:**

| Operation | Function | Pattern |
|-----------|----------|---------|
| Mark as Read | `handleMarkAsRead` | Uses `useOptimisticMutation` hook |
| Mark All as Read | `handleMarkAllAsRead` | Uses `useOptimisticMutation` hook |
| Delete | `handleDelete` | Uses `useOptimisticMutation` hook + Undo |

**Key State Variables:**
```typescript
const [deletedNotification, setDeletedNotification] = useState<Notification | null>(null);
const [showUndo, setShowUndo] = useState(false);
const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
```

**Mark as Read Implementation:**
```typescript
const markAsReadMutation = useOptimisticMutation<void, string>({
  mutationFn: async (id) => {
    const response = await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to mark as read');
  },
  onMutate: (id) => {
    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;
    const notification = notifications.find((n) => n.id === id);
    const wasUnread = notification && !notification.read;

    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n
      )
    );
    if (wasUnread) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    return () => {
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
    };
  },
  onError: (error, _id, rollback) => {
    rollback?.();
    console.error('Failed to mark notification as read:', error);
  },
});
```

---

### 2. Watchlist Client

**File:** `app/(dashboard)/watchlist/watchlist-client.tsx`

**Operations Implemented:**

| Operation | Function | Pattern |
|-----------|----------|---------|
| Add Item | `handleAddItem` | Inline optimistic logic + temp ID |
| Remove Item | `handleRemoveItem` | Inline optimistic logic + Undo |

**Key State Variables:**
```typescript
const [removedItem, setRemovedItem] = useState<WatchlistItem | null>(null);
const [showUndo, setShowUndo] = useState(false);
const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
const [pendingAddId, setPendingAddId] = useState<string | null>(null);
```

**Add Item with Temporary ID:**
```typescript
const handleAddItem = useCallback(async (): Promise<void> => {
  // Create optimistic item with temporary ID
  const tempId = `temp-${Date.now()}`;
  const optimisticItem: WatchlistItem = {
    id: tempId,
    symbol: selectedSymbol,
    timeframe: selectedTimeframe,
    order: items.length,
    createdAt: new Date(),
  };

  // Store previous state for rollback
  const previousItems = items;

  // Optimistically add item
  setItems((prev) => [...prev, optimisticItem]);
  setPendingAddId(tempId);

  try {
    const response = await fetch('/api/watchlist', { /* ... */ });
    const data = await response.json();

    // Replace temporary item with real item from server
    setItems((prev) =>
      prev.map((item) => (item.id === tempId ? data.item : item))
    );
  } catch (err) {
    // Rollback on error
    setItems(previousItems);
  } finally {
    setPendingAddId(null);
  }
}, [/* deps */]);
```

**Visual Pending State:**
```tsx
<Card className={`... ${isPending ? 'opacity-70' : ''}`}>
```

---

### 3. Alerts Client

**File:** `app/(dashboard)/alerts/alerts-client.tsx`

**Operations Implemented:**

| Operation | Function | Pattern |
|-----------|----------|---------|
| Pause/Resume | `handleTogglePause` | Inline optimistic with pending state |
| Delete | `handleDelete` | Inline optimistic + Undo |

**Key State Variables:**
```typescript
const [deletedAlert, setDeletedAlert] = useState<AlertWithStatus | null>(null);
const [showUndo, setShowUndo] = useState(false);
const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);
```

**Toggle with Visual Feedback:**
```typescript
const handleTogglePause = useCallback(async (alertId: string): Promise<void> => {
  const alert = alerts.find((a) => a.id === alertId);
  if (!alert) return;

  const previousAlerts = alerts;
  const newIsActive = !alert.isActive;

  setPendingToggleId(alertId);  // Show visual pending state

  // Optimistically update
  setAlerts((prev) =>
    prev.map((a) =>
      a.id === alertId
        ? { ...a, isActive: newIsActive, status: newIsActive ? 'active' : 'paused' }
        : a
    )
  );

  try {
    await fetch(`/api/alerts/${alertId}`, { /* ... */ });
  } catch (error) {
    setAlerts(previousAlerts);  // Rollback
  } finally {
    setPendingToggleId(null);
  }
}, [alerts]);
```

**Visual Pending State for Toggle:**
```tsx
<Card className={`... ${isTogglePending ? 'animate-pulse' : ''}`}>
```

---

### 4. Subscription Card

**File:** `components/billing/subscription-card.tsx`

**Operations Implemented:**

| Operation | Function | Pattern |
|-----------|----------|---------|
| Cancel Subscription | `handleOptimisticCancel` | Internal optimistic state + Undo |

**Key State Variables:**
```typescript
const [optimisticCancelPending, setOptimisticCancelPending] = useState(false);
const [showUndoCancel, setShowUndoCancel] = useState(false);
const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

// Combine prop state with optimistic state
const effectiveCancelAtPeriodEnd = cancelAtPeriodEnd || optimisticCancelPending;
```

**Pattern Notes:**
- This component receives `onCancel` as a prop from parent
- Internal state (`optimisticCancelPending`) combines with prop state
- Uses `effectiveCancelAtPeriodEnd` for all UI decisions

---

## Common Patterns

### 1. State Storage for Rollback

Always store previous state before optimistic update:

```typescript
const previousItems = items;  // Store BEFORE updating
setItems(/* new state */);

// In catch block:
setItems(previousItems);  // Rollback
```

### 2. Undo Timeout Management

Standard 5-second undo window:

```typescript
// State
const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

// Set timeout
if (undoTimeoutRef.current) {
  clearTimeout(undoTimeoutRef.current);
}
undoTimeoutRef.current = setTimeout(() => {
  setShowUndo(false);
  setDeletedItem(null);
}, 5000);

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }
  };
}, []);
```

### 3. Pending State Visual Indicators

```tsx
// Opacity for pending items
className={`... ${isPending ? 'opacity-70' : ''}`}

// Pulse animation for toggle actions
className={`... ${isTogglePending ? 'animate-pulse' : ''}`}
```

### 4. Undo Banner UI

Standard dark banner with Undo button:

```tsx
{showUndo && deletedItem && (
  <div className="mb-4 flex items-center justify-between bg-gray-800 text-white px-4 py-3 rounded-lg animate-in slide-in-from-top-2">
    <span className="text-sm">Item deleted</span>
    <Button
      variant="ghost"
      size="sm"
      onClick={handleUndo}
      className="text-white hover:text-white hover:bg-gray-700"
    >
      <Undo2 className="h-4 w-4 mr-2" />
      Undo
    </Button>
  </div>
)}
```

---

## Undo Functionality

### Implementation Pattern

1. **Store deleted item** before removing from state
2. **Show undo banner** with 5-second timeout
3. **On Undo click:**
   - Clear timeout
   - Restore item to state
   - Call API to recreate (best-effort)

### Undo Handler Template

```typescript
const handleUndo = useCallback((): void => {
  if (!deletedItem) return;

  // Clear timeout
  if (undoTimeoutRef.current) {
    clearTimeout(undoTimeoutRef.current);
  }

  // Restore item
  setItems((prev) => {
    const restored = [...prev, deletedItem].sort(/* sorting logic */);
    return restored;
  });

  // Update counts if applicable
  setTotal((prev) => prev + 1);

  // Clear undo state
  setShowUndo(false);
  setDeletedItem(null);

  // Re-create on server (best-effort)
  fetch('/api/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(deletedItem),
  }).catch(console.error);
}, [deletedItem]);
```

### Important Notes

- Undo is **client-side optimistic** - the server deletion still happens
- Re-creation on undo is **best-effort** - may create a new ID
- For production, consider a dedicated `/undo` endpoint that uses soft deletes

---

## Error Handling & Rollback

### Rollback Pattern

```typescript
try {
  // Optimistic update already done above
  const response = await fetch(/* ... */);
  if (!response.ok) throw new Error('Failed');
} catch (error) {
  // Rollback ALL state changes
  setItems(previousItems);
  setTotal(previousTotal);
  setUnreadCount(previousUnreadCount);

  // Clear undo state if set
  setShowUndo(false);
  setDeletedItem(null);
  if (undoTimeoutRef.current) {
    clearTimeout(undoTimeoutRef.current);
  }

  // Log error
  console.error('Operation failed:', error);

  // Optionally show error toast
  // toast.error('Failed to complete action');
}
```

### When to Rollback

- API returns non-2xx status
- Network error (fetch throws)
- Response parsing fails

---

## Extending the Pattern

### Adding Optimistic UI to a New Component

1. **Import the hook** (if using):
   ```typescript
   import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation';
   ```

2. **Add state variables**:
   ```typescript
   const [deletedItem, setDeletedItem] = useState<ItemType | null>(null);
   const [showUndo, setShowUndo] = useState(false);
   const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
   ```

3. **Add cleanup effect**:
   ```typescript
   useEffect(() => {
     return () => {
       if (undoTimeoutRef.current) {
         clearTimeout(undoTimeoutRef.current);
       }
     };
   }, []);
   ```

4. **Create mutation handler** following patterns above

5. **Add Undo banner** to JSX

6. **Add visual pending states** (opacity, animations)

### Checklist for New Implementations

- [ ] Store previous state before optimistic update
- [ ] Update UI immediately
- [ ] Handle API success (may need to update temp IDs)
- [ ] Handle API failure with rollback
- [ ] Add undo functionality for destructive actions
- [ ] Add cleanup for timeouts on unmount
- [ ] Add visual pending indicators
- [ ] Test rollback scenarios

---

## Troubleshooting

### Common Issues

**1. Undo doesn't restore item properly**
- Check that you're storing the complete item object
- Ensure sorting logic matches original order

**2. Multiple rapid actions cause state issues**
- Clear previous timeouts before setting new ones
- Use functional state updates: `setItems(prev => ...)`

**3. Rollback doesn't work**
- Ensure `previousState` is captured BEFORE optimistic update
- Check that rollback function restores ALL affected state

**4. Memory leak warnings**
- Add cleanup effect for timeouts
- Check that component unmount clears pending operations

### Debug Tips

```typescript
// Log state changes for debugging
console.log('Before optimistic update:', items);
console.log('After optimistic update:', newItems);
console.log('On rollback:', previousItems);
```

---

## API Endpoints Used

| Component | Endpoint | Method | Purpose |
|-----------|----------|--------|---------|
| Notifications | `/api/notifications/{id}/read` | POST | Mark as read |
| Notifications | `/api/notifications` | POST | Mark all as read |
| Notifications | `/api/notifications/{id}` | DELETE | Delete notification |
| Watchlist | `/api/watchlist` | POST | Add item |
| Watchlist | `/api/watchlist/{id}` | DELETE | Remove item |
| Alerts | `/api/alerts/{id}` | PATCH | Toggle pause/resume |
| Alerts | `/api/alerts/{id}` | DELETE | Delete alert |
| Subscription | (via `onCancel` prop) | - | Cancel subscription |

---

## References

- [React Patterns: Optimistic Updates](https://react.dev/learn/you-might-not-need-an-effect#fetching-data)
- [TanStack Query Optimistic Updates](https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates)

---

**Document Version:** 1.0
**Last Modified By:** Claude Code
**Commit:** feat: implement optimistic UI pattern across components
