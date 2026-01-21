# Frontend UI Elements Conversion Guide

## Overview

This document tracks the conversion of pages from Client Components to Server Components as part of Step 4 of the Modular Monolith Migration.

## Conversion Progress

### ✅ Completed

- [x] Directory structure created (`frontend/`)
- [x] Configuration files set up
- [x] Loading skeletons created
- [x] Component organization structure

### 🚧 In Progress

- [ ] Admin pages conversion
- [ ] Auth pages conversion
- [ ] Dashboard & Charts conversion

### ⏳ Pending

- [ ] Tier-based optimization
- [ ] Bundle analysis
- [ ] Deployment documentation

## Conversion Pattern

### Before (Client Component)

```tsx
'use client';

import { useEffect, useState } from 'react';

export default function Page() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/data').then(setData);
  }, []);

  if (!data) return <Loading />;

  return <div>{/* render data */}</div>;
}
```

### After (Server Component + Client Island)

```tsx
// page.tsx (Server Component)
import { prisma } from '@/lib/db/prisma';
import { ClientInteractive } from './client-interactive';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const data = await prisma.model.findMany(); // Direct DB access

  return (
    <div>
      <h1>Server Rendered Header</h1> {/* 0 KB JS */}
      <StaticData data={data} /> {/* 0 KB JS */}
      <ClientInteractive /> {/* Minimal JS */}
    </div>
  );
}
```

```tsx
// client-interactive.tsx (Client Component)
'use client';

import { useRouter } from 'next/navigation';

export function ClientInteractive() {
  const router = useRouter();

  return <button onClick={() => router.refresh()}>Refresh</button>;
}
```

## Bundle Size Targets

| User Tier | Current | Target | Reduction |
| --------- | ------- | ------ | --------- |
| FREE      | ~150KB  | ~30KB  | 80%       |
| PRO       | ~200KB  | ~50KB  | 75%       |

## Key Principles

1. **Server-First**: Default to Server Components
2. **Client Islands**: Use 'use client' only when needed
3. **Direct DB Access**: Bypass API routes in Server Components
4. **Dynamic Imports**: Lazy load heavy components
5. **Tier-Based**: Load PRO features only for PRO users

## File Locations

- **Original files**: `app/` (unchanged)
- **Frontend files**: `frontend/app/` (converted)
- **Loading skeletons**: `frontend/app/(dashboard)/*/loading.tsx`
- **Client components**: `frontend/app/(dashboard)/*/*-client.tsx`

## Next Steps

1. Complete admin pages conversion
2. Convert auth pages with form separation
3. Implement dynamic imports for charts
4. Add tier-based loading
5. Run bundle analysis
6. Deploy to fresh Vercel project

## Resources

- Main guide: `../monolith-to-modular-monolith-migration/frontend-ui-deployment-step-4-claude-code-prompt.md`
- Bundle optimization: `../bundle-size-optimization/`
- Pages list: `../docs/files-completion-list/frontend-ui-pages.md`
