'use client';

import { useState, useCallback, useRef } from 'react';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface OptimisticMutationOptions<TData, TVariables> {
  /** Function that performs the actual API mutation */
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** Callback to optimistically update state before API call */
  onMutate?: (variables: TVariables) => void | (() => void);
  /** Callback when mutation succeeds */
  onSuccess?: (data: TData, variables: TVariables) => void;
  /** Callback when mutation fails - receives rollback function if provided by onMutate */
  onError?: (error: Error, variables: TVariables, rollback?: () => void) => void;
  /** Callback that runs after mutation completes (success or failure) */
  onSettled?: (
    data: TData | undefined,
    error: Error | undefined,
    variables: TVariables
  ) => void;
}

interface OptimisticMutationResult<TData, TVariables> {
  /** Execute the mutation */
  mutate: (variables: TVariables) => Promise<TData | undefined>;
  /** Whether mutation is in progress */
  isPending: boolean;
  /** Whether mutation succeeded */
  isSuccess: boolean;
  /** Whether mutation failed */
  isError: boolean;
  /** Error from the last mutation */
  error: Error | null;
  /** Data from the last successful mutation */
  data: TData | null;
  /** Reset the mutation state */
  reset: () => void;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HOOK
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Hook for optimistic mutations with automatic rollback on failure
 *
 * Pattern:
 * 1. onMutate is called first - update UI optimistically and return a rollback function
 * 2. mutationFn is called - perform the actual API request
 * 3. On success: onSuccess is called
 * 4. On error: rollback function is called, then onError
 * 5. onSettled is always called at the end
 *
 * @example
 * ```tsx
 * const { mutate, isPending } = useOptimisticMutation({
 *   mutationFn: async (id: string) => {
 *     await fetch(`/api/items/${id}`, { method: 'DELETE' });
 *   },
 *   onMutate: (id) => {
 *     const previousItems = items;
 *     setItems(items.filter(item => item.id !== id));
 *     return () => setItems(previousItems); // rollback function
 *   },
 *   onError: (error, id, rollback) => {
 *     rollback?.();
 *     toast.error('Failed to delete item');
 *   },
 *   onSuccess: () => {
 *     toast.success('Item deleted');
 *   },
 * });
 * ```
 */
export function useOptimisticMutation<TData = unknown, TVariables = void>(
  options: OptimisticMutationOptions<TData, TVariables>
): OptimisticMutationResult<TData, TVariables> {
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<TData | null>(null);

  // Use ref to always get latest options without re-creating mutate
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const reset = useCallback(() => {
    setIsPending(false);
    setIsSuccess(false);
    setIsError(false);
    setError(null);
    setData(null);
  }, []);

  const mutate = useCallback(
    async (variables: TVariables): Promise<TData | undefined> => {
      const { mutationFn, onMutate, onSuccess, onError, onSettled } =
        optionsRef.current;

      setIsPending(true);
      setIsSuccess(false);
      setIsError(false);
      setError(null);

      // Call onMutate for optimistic update, get rollback function
      let rollback: (() => void) | undefined;
      if (onMutate) {
        const result = onMutate(variables);
        if (typeof result === 'function') {
          rollback = result;
        }
      }

      let result: TData | undefined;
      let mutationError: Error | undefined;

      try {
        result = await mutationFn(variables);
        setData(result);
        setIsSuccess(true);
        onSuccess?.(result, variables);
      } catch (err) {
        mutationError = err instanceof Error ? err : new Error(String(err));
        setError(mutationError);
        setIsError(true);

        // Call rollback on error
        if (rollback) {
          rollback();
        }

        onError?.(mutationError, variables, rollback);
      } finally {
        setIsPending(false);
        onSettled?.(result, mutationError, variables);
      }

      return result;
    },
    []
  );

  return {
    mutate,
    isPending,
    isSuccess,
    isError,
    error,
    data,
    reset,
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER HOOK FOR DELETE OPERATIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface UseOptimisticDeleteOptions<T> {
  /** Current items array */
  items: T[];
  /** Setter for items */
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
  /** Function to get item ID */
  getId: (item: T) => string;
  /** API delete function */
  deleteFn: (id: string) => Promise<void>;
  /** Success callback */
  onSuccess?: (id: string) => void;
  /** Error callback */
  onError?: (error: Error, id: string) => void;
}

/**
 * Specialized hook for optimistic delete operations
 *
 * @example
 * ```tsx
 * const { deleteItem, isPending } = useOptimisticDelete({
 *   items: notifications,
 *   setItems: setNotifications,
 *   getId: (n) => n.id,
 *   deleteFn: async (id) => {
 *     await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
 *   },
 *   onError: () => toast.error('Failed to delete'),
 * });
 * ```
 */
export function useOptimisticDelete<T>(
  options: UseOptimisticDeleteOptions<T>
): {
  deleteItem: (id: string) => Promise<void>;
  isPending: boolean;
  pendingId: string | null;
} {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const deleteItem = useCallback(async (id: string): Promise<void> => {
    const { items, setItems, getId, deleteFn, onSuccess, onError } =
      optionsRef.current;

    setPendingId(id);

    // Store previous state for rollback
    const previousItems = items;

    // Optimistically remove item
    setItems((prev) => prev.filter((item) => getId(item) !== id));

    try {
      await deleteFn(id);
      onSuccess?.(id);
    } catch (err) {
      // Rollback on error
      setItems(previousItems);
      const error = err instanceof Error ? err : new Error(String(err));
      onError?.(error, id);
    } finally {
      setPendingId(null);
    }
  }, []);

  return {
    deleteItem,
    isPending: pendingId !== null,
    pendingId,
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER HOOK FOR TOGGLE OPERATIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface UseOptimisticToggleOptions<T> {
  /** Current items array */
  items: T[];
  /** Setter for items */
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
  /** Function to get item ID */
  getId: (item: T) => string;
  /** API toggle function */
  toggleFn: (id: string, newValue: boolean) => Promise<void>;
  /** Function to get current toggle value */
  getValue: (item: T) => boolean;
  /** Function to create updated item with new value */
  updateItem: (item: T, newValue: boolean) => T;
  /** Success callback */
  onSuccess?: (id: string, newValue: boolean) => void;
  /** Error callback */
  onError?: (error: Error, id: string) => void;
}

/**
 * Specialized hook for optimistic toggle operations
 *
 * @example
 * ```tsx
 * const { toggle, isPending } = useOptimisticToggle({
 *   items: alerts,
 *   setItems: setAlerts,
 *   getId: (a) => a.id,
 *   getValue: (a) => a.isActive,
 *   updateItem: (a, newValue) => ({ ...a, isActive: newValue, status: newValue ? 'active' : 'paused' }),
 *   toggleFn: async (id, newValue) => {
 *     await fetch(`/api/alerts/${id}`, {
 *       method: 'PATCH',
 *       body: JSON.stringify({ isActive: newValue }),
 *     });
 *   },
 * });
 * ```
 */
export function useOptimisticToggle<T>(
  options: UseOptimisticToggleOptions<T>
): {
  toggle: (id: string) => Promise<void>;
  isPending: boolean;
  pendingId: string | null;
} {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const toggle = useCallback(async (id: string): Promise<void> => {
    const {
      items,
      setItems,
      getId,
      getValue,
      updateItem,
      toggleFn,
      onSuccess,
      onError,
    } = optionsRef.current;

    setPendingId(id);

    // Find the item and its current value
    const item = items.find((i) => getId(i) === id);
    if (!item) {
      setPendingId(null);
      return;
    }

    const currentValue = getValue(item);
    const newValue = !currentValue;

    // Store previous state for rollback
    const previousItems = items;

    // Optimistically update item
    setItems((prev) =>
      prev.map((i) => (getId(i) === id ? updateItem(i, newValue) : i))
    );

    try {
      await toggleFn(id, newValue);
      onSuccess?.(id, newValue);
    } catch (err) {
      // Rollback on error
      setItems(previousItems);
      const error = err instanceof Error ? err : new Error(String(err));
      onError?.(error, id);
    } finally {
      setPendingId(null);
    }
  }, []);

  return {
    toggle,
    isPending: pendingId !== null,
    pendingId,
  };
}

export default useOptimisticMutation;
