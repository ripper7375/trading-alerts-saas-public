'use client';

/**
 * Alert Loading States Hook
 *
 * Provides granular loading state management for alert operations.
 * Supports optimistic updates and loading indicators per operation.
 *
 * @module hooks/use-alert-loading
 */

import { useState, useCallback, useMemo } from 'react';

/**
 * Loading operation types
 */
export type AlertOperation =
  | 'fetch'
  | 'create'
  | 'update'
  | 'delete'
  | 'toggle'
  | 'refresh';

/**
 * Operation state
 */
export interface OperationState {
  isLoading: boolean;
  error: Error | null;
  startedAt: number | null;
  completedAt: number | null;
}

/**
 * Per-item operation state (for individual alert operations)
 */
export interface ItemOperationState {
  alertId: string;
  operation: AlertOperation;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Loading states return type
 */
export interface UseAlertLoadingReturn {
  // Global operation states
  operations: Record<AlertOperation, OperationState>;

  // Per-item states for specific alert operations
  itemOperations: Map<string, ItemOperationState>;

  // Check if any operation is loading
  isAnyLoading: boolean;

  // Check if a specific operation is loading
  isOperationLoading: (operation: AlertOperation) => boolean;

  // Check if a specific item has an operation in progress
  isItemLoading: (alertId: string) => boolean;

  // Get the current operation for an item
  getItemOperation: (alertId: string) => ItemOperationState | undefined;

  // Start an operation
  startOperation: (operation: AlertOperation) => void;

  // Complete an operation successfully
  completeOperation: (operation: AlertOperation) => void;

  // Fail an operation with an error
  failOperation: (operation: AlertOperation, error: Error) => void;

  // Start an item-specific operation
  startItemOperation: (alertId: string, operation: AlertOperation) => void;

  // Complete an item operation
  completeItemOperation: (alertId: string) => void;

  // Fail an item operation
  failItemOperation: (alertId: string, error: Error) => void;

  // Clear all errors
  clearErrors: () => void;

  // Get loading duration for an operation
  getOperationDuration: (operation: AlertOperation) => number | null;
}

/**
 * Initial operation state
 */
const createInitialState = (): OperationState => ({
  isLoading: false,
  error: null,
  startedAt: null,
  completedAt: null,
});

/**
 * useAlertLoading Hook
 *
 * Manages loading states for all alert operations with granular control.
 * Supports both global operations and per-item operations.
 */
export function useAlertLoading(): UseAlertLoadingReturn {
  // Global operation states
  const [operations, setOperations] = useState<
    Record<AlertOperation, OperationState>
  >({
    fetch: createInitialState(),
    create: createInitialState(),
    update: createInitialState(),
    delete: createInitialState(),
    toggle: createInitialState(),
    refresh: createInitialState(),
  });

  // Per-item operation states
  const [itemOperations, setItemOperations] = useState<
    Map<string, ItemOperationState>
  >(new Map());

  // Check if any operation is loading
  const isAnyLoading = useMemo(
    () => Object.values(operations).some((op) => op.isLoading),
    [operations]
  );

  // Check if a specific operation is loading
  const isOperationLoading = useCallback(
    (operation: AlertOperation): boolean => operations[operation].isLoading,
    [operations]
  );

  // Check if a specific item has an operation in progress
  const isItemLoading = useCallback(
    (alertId: string): boolean => {
      const itemOp = itemOperations.get(alertId);
      return itemOp?.isLoading ?? false;
    },
    [itemOperations]
  );

  // Get the current operation for an item
  const getItemOperation = useCallback(
    (alertId: string): ItemOperationState | undefined => {
      return itemOperations.get(alertId);
    },
    [itemOperations]
  );

  // Start a global operation
  const startOperation = useCallback((operation: AlertOperation): void => {
    setOperations((prev) => ({
      ...prev,
      [operation]: {
        isLoading: true,
        error: null,
        startedAt: Date.now(),
        completedAt: null,
      },
    }));
  }, []);

  // Complete a global operation successfully
  const completeOperation = useCallback((operation: AlertOperation): void => {
    setOperations((prev) => ({
      ...prev,
      [operation]: {
        ...prev[operation],
        isLoading: false,
        completedAt: Date.now(),
      },
    }));
  }, []);

  // Fail a global operation with an error
  const failOperation = useCallback(
    (operation: AlertOperation, error: Error): void => {
      setOperations((prev) => ({
        ...prev,
        [operation]: {
          ...prev[operation],
          isLoading: false,
          error,
          completedAt: Date.now(),
        },
      }));
    },
    []
  );

  // Start an item-specific operation
  const startItemOperation = useCallback(
    (alertId: string, operation: AlertOperation): void => {
      setItemOperations((prev) => {
        const newMap = new Map(prev);
        newMap.set(alertId, {
          alertId,
          operation,
          isLoading: true,
          error: null,
        });
        return newMap;
      });
    },
    []
  );

  // Complete an item operation
  const completeItemOperation = useCallback((alertId: string): void => {
    setItemOperations((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(alertId);
      if (current) {
        newMap.set(alertId, {
          ...current,
          isLoading: false,
        });
      }
      return newMap;
    });

    // Clean up after a short delay
    setTimeout(() => {
      setItemOperations((prev) => {
        const newMap = new Map(prev);
        newMap.delete(alertId);
        return newMap;
      });
    }, 300);
  }, []);

  // Fail an item operation
  const failItemOperation = useCallback(
    (alertId: string, error: Error): void => {
      setItemOperations((prev) => {
        const newMap = new Map(prev);
        const current = newMap.get(alertId);
        if (current) {
          newMap.set(alertId, {
            ...current,
            isLoading: false,
            error,
          });
        }
        return newMap;
      });
    },
    []
  );

  // Clear all errors
  const clearErrors = useCallback((): void => {
    setOperations((prev) => {
      const cleared = { ...prev };
      (Object.keys(cleared) as AlertOperation[]).forEach((key) => {
        cleared[key] = { ...cleared[key], error: null };
      });
      return cleared;
    });

    setItemOperations((prev) => {
      const newMap = new Map(prev);
      newMap.forEach((value, key) => {
        if (value.error) {
          newMap.set(key, { ...value, error: null });
        }
      });
      return newMap;
    });
  }, []);

  // Get loading duration for an operation
  const getOperationDuration = useCallback(
    (operation: AlertOperation): number | null => {
      const op = operations[operation];
      if (op.startedAt && op.completedAt) {
        return op.completedAt - op.startedAt;
      }
      if (op.startedAt && op.isLoading) {
        return Date.now() - op.startedAt;
      }
      return null;
    },
    [operations]
  );

  return {
    operations,
    itemOperations,
    isAnyLoading,
    isOperationLoading,
    isItemLoading,
    getItemOperation,
    startOperation,
    completeOperation,
    failOperation,
    startItemOperation,
    completeItemOperation,
    failItemOperation,
    clearErrors,
    getOperationDuration,
  };
}

/**
 * Hook for tracking a single alert's loading state
 */
export function useAlertItemLoading(alertId: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [operation, setOperation] = useState<AlertOperation | null>(null);

  const startLoading = useCallback((op: AlertOperation) => {
    setIsLoading(true);
    setError(null);
    setOperation(op);
  }, []);

  const completeLoading = useCallback(() => {
    setIsLoading(false);
    setOperation(null);
  }, []);

  const failLoading = useCallback((err: Error) => {
    setIsLoading(false);
    setError(err);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    alertId,
    isLoading,
    error,
    operation,
    startLoading,
    completeLoading,
    failLoading,
    clearError,
  };
}
