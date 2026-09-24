'use client';

/**
 * Client-side view of the admin "view as affiliate" mode (read-only).
 *
 * app/affiliate/dashboard/layout.tsx resolves the mode on the server
 * (lib/affiliate/view-as.ts) and passes the viewed affiliate down here, so
 * dashboard pages can hide their edit controls. Hiding is a courtesy: the
 * write API routes refuse an admin regardless.
 *
 * @module components/affiliate/view-as-context
 */

import React, { createContext, useContext } from 'react';

export interface AffiliateViewAsInfo {
  profileId: string;
  fullName: string;
  email: string | null;
  status: string;
}

const AffiliateViewAsContext = createContext<AffiliateViewAsInfo | null>(null);

export function AffiliateViewAsProvider({
  value,
  children,
}: {
  value: AffiliateViewAsInfo | null;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <AffiliateViewAsContext.Provider value={value}>
      {children}
    </AffiliateViewAsContext.Provider>
  );
}

/** The affiliate an admin is viewing, or `null` for a real affiliate. */
export function useAffiliateViewAs(): AffiliateViewAsInfo | null {
  return useContext(AffiliateViewAsContext);
}
