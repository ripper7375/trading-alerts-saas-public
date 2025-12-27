import { useEffect, useCallback, useRef } from 'react';

/**
 * Hook for unsaved changes warning
 *
 * Provides functionality to:
 * - Warn users before leaving the page with unsaved changes
 * - Handle browser back/forward navigation
 * - Track dirty state for forms
 */

interface UseUnsavedChangesOptions {
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Optional custom warning message */
  message?: string;
  /** Callback when user confirms leaving */
  onConfirmLeave?: () => void;
}

interface UseUnsavedChangesReturn {
  /** Show confirmation dialog before navigating away */
  confirmLeave: () => boolean;
  /** Mark form as having unsaved changes */
  markDirty: () => void;
  /** Mark form as clean (changes saved) */
  markClean: () => void;
}

const DEFAULT_MESSAGE = 'You have unsaved changes. Are you sure you want to leave?';

/**
 * useUnsavedChanges hook
 *
 * @param options - Configuration options
 * @returns Methods to manage unsaved changes state
 *
 * @example
 * ```tsx
 * const [isDirty, setIsDirty] = useState(false);
 *
 * const { markDirty, markClean } = useUnsavedChanges({
 *   isDirty,
 *   message: 'You have unsaved profile changes.',
 * });
 *
 * const handleInputChange = (value: string) => {
 *   setFormData(value);
 *   markDirty();
 * };
 *
 * const handleSave = async () => {
 *   await saveData();
 *   markClean();
 * };
 * ```
 */
export function useUnsavedChanges(
  options: UseUnsavedChangesOptions
): UseUnsavedChangesReturn {
  const { isDirty, message = DEFAULT_MESSAGE, onConfirmLeave } = options;
  const isDirtyRef = useRef(isDirty);

  // Keep ref in sync with prop
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  // Handle browser beforeunload event
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent): void => {
      if (isDirtyRef.current) {
        e.preventDefault();
        // Modern browsers show their own message, but we set returnValue for older ones
        e.returnValue = message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [message]);

  // Confirm leave with custom dialog
  const confirmLeave = useCallback((): boolean => {
    if (!isDirtyRef.current) {
      return true;
    }

    const confirmed = window.confirm(message);
    if (confirmed && onConfirmLeave) {
      onConfirmLeave();
    }
    return confirmed;
  }, [message, onConfirmLeave]);

  // Mark form as dirty
  const markDirty = useCallback((): void => {
    isDirtyRef.current = true;
  }, []);

  // Mark form as clean
  const markClean = useCallback((): void => {
    isDirtyRef.current = false;
  }, []);

  return {
    confirmLeave,
    markDirty,
    markClean,
  };
}

/**
 * Simple hook that just adds beforeunload warning
 * Use this for simpler cases where you just need browser warning
 *
 * @param hasUnsavedChanges - Whether there are unsaved changes
 * @param message - Optional custom warning message
 */
export function useBeforeUnload(
  hasUnsavedChanges: boolean,
  message: string = DEFAULT_MESSAGE
): void {
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent): void => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, message]);
}
