'use client';

/**
 * Client-side view of the admin "view as user" mode (read-only).
 *
 * app/settings/layout.tsx resolves the mode on the server
 * (lib/admin/user-view-as.ts) and passes the viewed user down here, so the
 * settings pages can read that user's data (by adding `?view_as=user` to
 * their GETs) and hide every control that would change an account.
 *
 * @module components/admin/user-view-as/user-view-as-context
 */

import React, { createContext, useContext } from 'react';

export interface UserViewAsInfo {
  id: string;
  name: string | null;
  email: string;
  tier: string;
  role: string;
}

const UserViewAsContext = createContext<UserViewAsInfo | null>(null);

export function UserViewAsProvider({
  value,
  children,
}: {
  value: UserViewAsInfo | null;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <UserViewAsContext.Provider value={value}>
      {children}
    </UserViewAsContext.Provider>
  );
}

/** The user an admin is viewing, or `null` on the normal settings pages. */
export function useUserViewAs(): UserViewAsInfo | null {
  return useContext(UserViewAsContext);
}
