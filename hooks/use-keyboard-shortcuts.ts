'use client';

import { useEffect, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Keyboard shortcut definition
 */
interface Shortcut {
  /** Key sequence (e.g., 'g d' for go to dashboard) */
  keys: string;
  /** Description of the shortcut */
  description: string;
  /** Handler function */
  action: () => void;
  /** Category for grouping in help modal */
  category?: 'navigation' | 'actions' | 'view';
}

/**
 * Keyboard shortcuts configuration
 */
interface UseKeyboardShortcutsOptions {
  /** Whether shortcuts are enabled */
  enabled?: boolean;
  /** Additional custom shortcuts */
  customShortcuts?: Shortcut[];
  /** Callback when help modal should be shown */
  onShowHelp?: () => void;
}

/**
 * Default navigation shortcuts
 */
const getDefaultShortcuts = (
  router: ReturnType<typeof useRouter>,
  onShowHelp?: () => void
): Shortcut[] => [
  {
    keys: 'g d',
    description: 'Go to Dashboard',
    category: 'navigation',
    action: () => router.push('/dashboard'),
  },
  {
    keys: 'g a',
    description: 'Go to Alerts',
    category: 'navigation',
    action: () => router.push('/alerts'),
  },
  {
    keys: 'g w',
    description: 'Go to Watchlist',
    category: 'navigation',
    action: () => router.push('/watchlist'),
  },
  {
    keys: 'g c',
    description: 'Go to Charts',
    category: 'navigation',
    action: () => router.push('/charts'),
  },
  {
    keys: 'g s',
    description: 'Go to Settings',
    category: 'navigation',
    action: () => router.push('/settings/account'),
  },
  {
    keys: '?',
    description: 'Show keyboard shortcuts',
    category: 'view',
    action: () => onShowHelp?.(),
  },
  {
    keys: 'Escape',
    description: 'Close modal / Cancel',
    category: 'actions',
    action: () => {
      // Close any open modal by dispatching a custom event
      document.dispatchEvent(new CustomEvent('keyboard-escape'));
    },
  },
];

/**
 * Hook for keyboard navigation shortcuts
 *
 * Supports vim-style two-key sequences (e.g., 'g d' for go to dashboard)
 * and single-key shortcuts (e.g., '?' for help).
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { shortcuts, showHelp, setShowHelp } = useKeyboardShortcuts({
 *     enabled: true,
 *     onShowHelp: () => setShowHelp(true),
 *   });
 *
 *   return (
 *     <>
 *       <KeyboardShortcutsModal
 *         open={showHelp}
 *         onClose={() => setShowHelp(false)}
 *         shortcuts={shortcuts}
 *       />
 *     </>
 *   );
 * }
 * ```
 */
export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const { enabled = true, customShortcuts = [], onShowHelp } = options;
  const router = useRouter();

  // Track key sequence for multi-key shortcuts
  const [keySequence, setKeySequence] = useState<string[]>([]);
  const [showHelp, setShowHelp] = useState(false);

  // Combine default and custom shortcuts
  const shortcuts = [
    ...getDefaultShortcuts(router, onShowHelp || (() => setShowHelp(true))),
    ...customShortcuts,
  ];

  // Reset key sequence after timeout
  useEffect(() => {
    if (keySequence.length === 0) return;

    const timeout = setTimeout(() => {
      setKeySequence([]);
    }, 1000); // Reset after 1 second

    return () => clearTimeout(timeout);
  }, [keySequence]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore if user is typing in an input or textarea
      const target = event.target as HTMLElement;
      const tagName = target.tagName.toLowerCase();
      const isContentEditable = target.isContentEditable;

      if (
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        isContentEditable
      ) {
        // Only allow Escape in inputs
        if (event.key !== 'Escape') {
          return;
        }
      }

      // Handle special keys
      const key = event.key;

      // Build the new sequence
      const newSequence = [...keySequence, key];

      // Check for matching shortcuts
      for (const shortcut of shortcuts) {
        const shortcutKeys = shortcut.keys.split(' ');

        // Check if current sequence matches
        if (
          shortcutKeys.length === newSequence.length &&
          shortcutKeys.every((k, i) => k === newSequence[i])
        ) {
          event.preventDefault();
          shortcut.action();
          setKeySequence([]);
          return;
        }

        // Check if this could be a partial match (for multi-key shortcuts)
        if (
          shortcutKeys.length > newSequence.length &&
          shortcutKeys.slice(0, newSequence.length).every((k, i) => k === newSequence[i])
        ) {
          // Partial match - keep building the sequence
          setKeySequence(newSequence);
          return;
        }
      }

      // Check for single-key shortcuts
      for (const shortcut of shortcuts) {
        if (shortcut.keys === key) {
          event.preventDefault();
          shortcut.action();
          setKeySequence([]);
          return;
        }
      }

      // No match found - reset if this key doesn't start a new sequence
      const startsNewSequence = shortcuts.some(
        (s) => s.keys.split(' ')[0] === key
      );

      if (startsNewSequence) {
        setKeySequence([key]);
      } else {
        setKeySequence([]);
      }
    },
    [enabled, keySequence, shortcuts]
  );

  // Add event listener
  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);

  return {
    shortcuts,
    keySequence,
    showHelp,
    setShowHelp,
    enabled,
  };
}

/**
 * Get shortcuts grouped by category
 */
export function getShortcutsByCategory(shortcuts: Shortcut[]) {
  return shortcuts.reduce(
    (acc, shortcut) => {
      const category = shortcut.category || 'actions';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(shortcut);
      return acc;
    },
    {} as Record<string, Shortcut[]>
  );
}
