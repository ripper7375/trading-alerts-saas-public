/**
 * Affiliate Portal Layout
 *
 * Base layout for all affiliate routes.
 * Does NOT require authentication - individual child layouts/pages
 * handle their own auth requirements.
 *
 * Public routes (register, verify) render directly.
 * Protected routes (dashboard/*) are handled by dashboard/layout.tsx
 *
 * @module app/affiliate/layout
 */

import React from 'react';

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPE DEFINITIONS
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface AffiliateLayoutProps {
  children: React.ReactNode;
}

//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENT
//━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Affiliate Portal Base Layout
 * Simple passthrough layout - child routes handle their own auth
 */
export default function AffiliateLayout({
  children,
}: AffiliateLayoutProps): React.ReactElement {
  return <>{children}</>;
}
