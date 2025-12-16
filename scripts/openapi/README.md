# OpenAPI Type Generation Scripts

## Overview

These scripts automatically generate TypeScript types from your OpenAPI specification files. This ensures **type safety** throughout your application and keeps your code in sync with your API contracts.

## Why Use These Scripts?

**For Beginners:** Think of these scripts as "automatic translators" that read your API documentation (OpenAPI files) and create TypeScript type definitions. This means:

1. ✅ **Catch errors early** - TypeScript will warn you if you use the wrong data types
2. ✅ **Auto-complete in your IDE** - Your code editor will suggest valid fields and methods
3. ✅ **No manual typing** - Don't manually write types that can be auto-generated
4. ✅ **Always in sync** - When API changes, regenerate types to stay updated

## Scripts

### 1. `generate-nextjs-types.sh`

**Purpose:** Generate TypeScript types for the Next.js API (main application backend)

**Input:** `docs/trading_alerts_openapi.yaml`

**Output:** `lib/api-client/` directory with TypeScript types

**Usage:**

```bash
sh scripts/openapi/generate-nextjs-types.sh
```

**Generated Types Include:**

- `UserProfile` - User account data
- `Alert` - Trading alert object
- `CreateAlertRequest` - Request to create new alert
- `TierType` - FREE or PRO tier enum
- And 30+ more types...

### 2. `generate-flask-types.sh`

**Purpose:** Generate TypeScript types for the Flask MT5 Service

**Input:** `docs/flask_mt5_openapi.yaml`

**Output:** `lib/mt5-client/` directory with TypeScript types

**Usage:**

```bash
sh scripts/openapi/generate-flask-types.sh
```

**Generated Types Include:**

- `IndicatorData` - Technical indicator values
- `MarketData` - Real-time market data
- `SymbolInfo` - Trading symbol information
- And 15+ more types...

## Prerequisites

**Before running these scripts, you need:**

1. **Node.js and npm installed** (check with `node --version`)
2. **OpenAPI Generator CLI** (auto-installed by scripts if missing)

The scripts will automatically install `@openapitools/openapi-generator-cli` if it's not already installed.

## When to Run These Scripts

Run these scripts in **Phase 3** when:

1. ✅ You've created the Next.js project structure
2. ✅ You're about to start building API routes or components
3. ✅ You've updated the OpenAPI specification files

## Example Workflow

### Phase 3 - Building Your Application

```bash
# Step 1: Generate types for Next.js API
cd /path/to/trading-alerts-saas-v7
sh scripts/openapi/generate-nextjs-types.sh

# Step 2: Generate types for Flask MT5 API
sh scripts/openapi/generate-flask-types.sh

# Step 3: Use the generated types in your code
```

### In Your Code (Next.js Component)

```typescript
// Import auto-generated types
import { Alert, CreateAlertRequest, TierType } from '@/lib/api-client';

// Use types in your component
const createAlert = async (data: CreateAlertRequest): Promise<Alert> => {
  const response = await fetch('/api/alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  return response.json() as Alert;
};
```

### In Your Code (API Route)

```typescript
// Import auto-generated types
import { Alert, CreateAlertRequest } from '@/lib/api-client';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body: CreateAlertRequest = await request.json();

  // TypeScript now knows exactly what fields are in CreateAlertRequest!
  // Your IDE will auto-complete: body.symbol, body.timeframe, body.condition, etc.

  // ... your logic here ...

  const alert: Alert = {
    id: '123',
    userId: 'user-456',
    symbol: body.symbol,
    timeframe: body.timeframe,
    // TypeScript ensures you include all required fields!
  };

  return NextResponse.json(alert);
}
```

## Troubleshooting

### Error: "openapi-generator-cli: command not found"

**Solution:** The script will auto-install it, but if it fails:

```bash
npm install -g @openapitools/openapi-generator-cli
```

### Error: "docs/trading_alerts_openapi.yaml not found"

**Solution:** Ensure you're running the script from the project root:

```bash
cd /path/to/trading-alerts-saas-v7
sh scripts/openapi/generate-nextjs-types.sh
```

### Error: "Type generation failed! lib/api-client not found"

**Solution:** This is **expected** in Phase 1! You haven't created the Next.js project yet. Run these scripts in **Phase 3** after creating the application structure.

### Generated files have errors

**Solution:** Check your OpenAPI spec file for syntax errors:

```bash
# Validate the OpenAPI spec
npx @apidevtools/swagger-cli validate docs/trading_alerts_openapi.yaml
```

## Benefits for AI Development (Aider with MiniMax M2)

When Aider builds your application using MiniMax M2:

1. ✅ **Aider uses these generated types** - ensuring type-safe code
2. ✅ **Reduces errors** - MiniMax M2 generates code that matches your API contracts
3. ✅ **Saves tokens** - Aider doesn't need to infer types; they're already defined
4. ✅ **Consistent patterns** - All code follows the same type definitions

## Cost Efficiency

Using these scripts with MiniMax M2:

- **Without type generation:** Aider might make 5-10 attempts to get types right → Higher cost
- **With type generation:** Aider gets it right the first time → Lower cost and faster development

## Next Steps

For now, these scripts are **ready but not yet runnable** because you haven't built the Next.js application. They're documented and committed to your repository.

**In Phase 3**, you'll:

1. Create the Next.js project structure
2. Run these scripts to generate types
3. Use the types throughout your application

---

**💡 Beginner Tip:** These scripts are like having a robot assistant that keeps your TypeScript types synchronized with your API documentation. You'll appreciate this automation when you need to update your API!
