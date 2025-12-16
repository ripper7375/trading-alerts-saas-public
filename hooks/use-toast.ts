'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPES
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration: number;
}

interface ToastOptions {
  type: ToastType;
  title: string;
  description?: string;
  /** Duration in ms before auto-dismiss (default: 5000, use 0 to disable) */
  duration?: number;
}

interface UseToastReturn {
  /** Array of currently visible toasts */
  toasts: Toast[];
  /** Add a new toast notification */
  addToast: (options: ToastOptions) => string;
  /** Remove a toast by ID */
  removeToast: (id: string) => void;
  /** Remove all toasts */
  clearToasts: () => void;
  /** Convenience: show success toast */
  success: (title: string, description?: string) => string;
  /** Convenience: show error toast */
  error: (title: string, description?: string) => string;
  /** Convenience: show warning toast */
  warning: (title: string, description?: string) => string;
  /** Convenience: show info toast */
  info: (title: string, description?: string) => string;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONSTANTS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const DEFAULT_DURATION = 5000; // 5 seconds
const MAX_TOASTS = 5; // Maximum number of visible toasts

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// USE TOAST HOOK
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * React hook for managing toast notifications
 *
 * Features:
 * - Multiple toast types (success, error, warning, info)
 * - Auto-dismiss with configurable duration
 * - Manual dismiss support
 * - Maximum toast limit (oldest removed when exceeded)
 * - Convenience methods for common toast types
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { success, error, toasts } = useToast();
 *
 *   const handleSave = async () => {
 *     try {
 *       await saveData();
 *       success('Saved successfully!', 'Your changes have been saved.');
 *     } catch (err) {
 *       error('Save failed', 'Please try again.');
 *     }
 *   };
 *
 *   return (
 *     <>
 *       <button onClick={handleSave}>Save</button>
 *       <ToastContainer toasts={toasts} />
 *     </>
 *   );
 * }
 * ```
 */
export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  /**
   * Generate a unique toast ID
   */
  const generateId = (): string => {
    return `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  };

  /**
   * Remove a toast by ID
   */
  const removeToast = useCallback((id: string): void => {
    // Clear the timeout if it exists
    const timeout = timeoutRefs.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutRefs.current.delete(id);
    }

    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /**
   * Add a new toast notification
   */
  const addToast = useCallback((options: ToastOptions): string => {
    const id = generateId();
    const duration = options.duration ?? DEFAULT_DURATION;

    const newToast: Toast = {
      id,
      type: options.type,
      title: options.title,
      description: options.description,
      duration,
    };

    setToasts((prev) => {
      // Remove oldest toasts if we exceed the max
      const updated = [...prev, newToast];
      if (updated.length > MAX_TOASTS) {
        const removed = updated.slice(0, updated.length - MAX_TOASTS);
        removed.forEach((t) => {
          const timeout = timeoutRefs.current.get(t.id);
          if (timeout) {
            clearTimeout(timeout);
            timeoutRefs.current.delete(t.id);
          }
        });
        return updated.slice(-MAX_TOASTS);
      }
      return updated;
    });

    // Set up auto-dismiss
    if (duration > 0) {
      const timeout = setTimeout(() => {
        removeToast(id);
      }, duration);
      timeoutRefs.current.set(id, timeout);
    }

    return id;
  }, [removeToast]);

  /**
   * Remove all toasts
   */
  const clearToasts = useCallback((): void => {
    // Clear all timeouts
    timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
    timeoutRefs.current.clear();

    setToasts([]);
  }, []);

  /**
   * Convenience: show success toast
   */
  const success = useCallback(
    (title: string, description?: string): string => {
      return addToast({ type: 'success', title, description });
    },
    [addToast]
  );

  /**
   * Convenience: show error toast
   */
  const error = useCallback(
    (title: string, description?: string): string => {
      return addToast({ type: 'error', title, description });
    },
    [addToast]
  );

  /**
   * Convenience: show warning toast
   */
  const warning = useCallback(
    (title: string, description?: string): string => {
      return addToast({ type: 'warning', title, description });
    },
    [addToast]
  );

  /**
   * Convenience: show info toast
   */
  const info = useCallback(
    (title: string, description?: string): string => {
      return addToast({ type: 'info', title, description });
    },
    [addToast]
  );

  // Clean up timeouts on unmount
  useEffect(() => {
    const timeouts = timeoutRefs.current;
    return (): void => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
      timeouts.clear();
    };
  }, []);

  return {
    toasts,
    addToast,
    removeToast,
    clearToasts,
    success,
    error,
    warning,
    info,
  };
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOAST STYLES (for reference in components)
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Toast style classes by type (for use in toast components)
 */
export const toastStyles: Record<ToastType, { bg: string; icon: string; border: string }> = {
  success: {
    bg: 'bg-green-50',
    icon: 'text-green-500',
    border: 'border-green-200',
  },
  error: {
    bg: 'bg-red-50',
    icon: 'text-red-500',
    border: 'border-red-200',
  },
  warning: {
    bg: 'bg-yellow-50',
    icon: 'text-yellow-500',
    border: 'border-yellow-200',
  },
  info: {
    bg: 'bg-blue-50',
    icon: 'text-blue-500',
    border: 'border-blue-200',
  },
};

/**
 * Get toast icon name by type (for lucide-react)
 */
export const toastIcons: Record<ToastType, string> = {
  success: 'CheckCircle',
  error: 'XCircle',
  warning: 'AlertTriangle',
  info: 'Info',
};

export default useToast;
