# Frontend Components Organization

This directory contains frontend components organized by interactivity level to optimize JavaScript bundle size.

## Directory Structure

```
components/
├── readable/           # Server Components (0 KB JS sent to client)
│   └── [display-only components]
│
├── interactive/        # Client Components (minimal JS bundle)
│   └── [components with hooks, events, browser APIs]
│
├── ui/                 # Shared UI components (can be either)
│   └── [buttons, inputs, cards, etc.]
│
└── [feature-folders]  # Feature-specific components
    └── [organized by feature]
```

## Component Classification

### Readable (Server Components)
✓ Display data only
✓ No event handlers
✓ No browser APIs
✓ Can fetch data directly
✓ Static content
→ **0 KB JavaScript sent to client**

Examples:
- Stats cards
- Metric displays
- Static headers/footers
- Navigation (non-interactive)
- Data tables (read-only)

### Interactive (Client Components)
✓ useState, useEffect
✓ onClick, onChange
✓ window, localStorage
✓ Real-time updates
✓ Form inputs
✓ Animations
→ **JS bundle required**

Examples:
- Forms with validation
- Charts with interactions
- Modals, dialogs
- Real-time updates
- Filter/search components

## Migration Status

Components are being migrated from Client to Server Components as part of Step 4 of the Modular Monolith Migration.

**Target:** >90% Server Components, <10% Client Components

## Usage Guidelines

1. **Default to Server Components** - Start with Server Component unless interactivity is needed
2. **Minimize Client Components** - Only use `'use client'` when absolutely necessary
3. **Separate Concerns** - Split pages into Server wrapper + Client islands
4. **Dynamic Imports** - Use `next/dynamic` for heavy Client Components
5. **Tier-Based Loading** - Load PRO features only for PRO users

## Examples

### Good: Server Component with Client Island
```tsx
// page.tsx (Server Component)
export default async function Page() {
  const data = await fetchData(); // Server-side fetch

  return (
    <div>
      <h1>Title (Server Rendered)</h1>  {/* 0 KB JS */}
      <ClientForm data={data} />         {/* Minimal JS */}
    </div>
  );
}
```

### Bad: Full Page Client Component
```tsx
// page.tsx (❌ Don't do this)
'use client';

export default function Page() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/data').then(setData);
  }, []);

  return <div>{/* Everything needs JS */}</div>;
}
```
