'use client';

import React, { ViewTransition } from 'react';
import { usePathname } from 'next/navigation';

interface SettingsContentTransitionProps {
  children: React.ReactNode;
}

/**
 * SettingsContentTransition
 *
 * Wraps Settings sub-pages with React 19.3 `<ViewTransition>` keyed on `pathname`.
 * In Next.js App Router, layout shells persist across lateral tab navigations, so
 * enter/exit transitions do not fire without a dynamic key. Keying by `pathname` and
 * providing a named transition ensures that switching between any Settings tab (Profile,
 * Appearance, Account, Security, Language, Billing, etc.) triggers a smooth, native
 * browser cross-fade transition on every tab switch.
 */
export function SettingsContentTransition({
  children,
}: SettingsContentTransitionProps): React.ReactElement {
  const pathname = usePathname();

  return (
    <ViewTransition
      key={pathname}
      name="settings-subpage-content"
      enter="auto"
      exit="auto"
      default="auto"
    >
      {children}
    </ViewTransition>
  );
}
