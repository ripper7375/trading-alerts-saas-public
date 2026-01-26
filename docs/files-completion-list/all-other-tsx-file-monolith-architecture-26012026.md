# Other TSX Files Inventory - Monolith Architecture

**Generated:** 2026-01-26
**Total Files:** 26 TSX files
**Architecture:** Next.js 14 App Router (Monolith)
**Scope:** `hooks/`, `prisma/`, `types/`, `oauth/`, `middleware/`, `emails/`, `__tests__/`

---

## Summary

| Directory | TSX Files | Description |
|-----------|-----------|-------------|
| `hooks/` | 0 | No TSX files (pure TypeScript hooks) |
| `prisma/` | 0 | No TSX files (schema, migrations, seed) |
| `types/` | 0 | No TSX files (type definitions only) |
| `oauth/` | 0 | No TSX files (documentation only) |
| `middleware/` | 0 | No TSX files (middleware logic) |
| `emails/` | 4 | React Email templates |
| `__tests__/` | 22 | Component test files |
| **Total** | **26** | |

---

## 1. Emails Directory (4 files)

### Email Templates (`emails/`) - React Email Components

| # | File Path | Description |
|---|-----------|-------------|
| 1 | `emails/payment-confirmation.tsx` | Payment successful confirmation email |
| 2 | `emails/payment-failure.tsx` | Payment failed notification email |
| 3 | `emails/renewal-reminder.tsx` | Subscription renewal reminder email |
| 4 | `emails/subscription-expired.tsx` | Subscription expired notification email |

---

## 2. Tests Directory (22 files)

### Component Tests (`__tests__/components/`)

#### Admin Component Tests (8 files)
| # | File Path | Tests For |
|---|-----------|-----------|
| 1 | `__tests__/components/admin/affiliate-filters.test.tsx` | `components/admin/affiliate-filters.tsx` |
| 2 | `__tests__/components/admin/affiliate-stats-banner.test.tsx` | `components/admin/affiliate-stats-banner.tsx` |
| 3 | `__tests__/components/admin/code-inventory-chart.test.tsx` | `components/admin/code-inventory-chart.tsx` |
| 4 | `__tests__/components/admin/fraud-alert-card.test.tsx` | `components/admin/FraudAlertCard.tsx` |
| 5 | `__tests__/components/admin/fraud-pattern-badge.test.tsx` | `components/admin/FraudPatternBadge.tsx` |
| 6 | `__tests__/components/admin/pnl-breakdown-table.test.tsx` | `components/admin/pnl-breakdown-table.tsx` |
| 7 | `__tests__/components/admin/pnl-summary-cards.test.tsx` | `components/admin/pnl-summary-cards.tsx` |
| 8 | `__tests__/components/admin/sales-performance-table.test.tsx` | `components/admin/sales-performance-table.tsx` |

#### Affiliate Component Tests (3 files)
| # | File Path | Tests For |
|---|-----------|-----------|
| 9 | `__tests__/components/affiliate/code-table.test.tsx` | `components/affiliate/code-table.tsx` |
| 10 | `__tests__/components/affiliate/commission-table.test.tsx` | `components/affiliate/commission-table.tsx` |
| 11 | `__tests__/components/affiliate/stats-card.test.tsx` | `components/affiliate/stats-card.tsx` |

#### Charts Component Tests (3 files)
| # | File Path | Tests For |
|---|-----------|-----------|
| 12 | `__tests__/components/charts/indicator-toggles.test.tsx` | `components/charts/indicator-toggles.tsx` |
| 13 | `__tests__/components/charts/pro-indicator-overlay.test.tsx` | `components/charts/pro-indicator-overlay.tsx` |
| 14 | `__tests__/components/charts/trading-chart.test.tsx` | `components/charts/trading-chart.tsx` |

#### Dashboard Component Tests (3 files)
| # | File Path | Tests For |
|---|-----------|-----------|
| 15 | `__tests__/components/dashboard/recent-alerts.test.tsx` | `components/dashboard/recent-alerts.tsx` |
| 16 | `__tests__/components/dashboard/stats-card.test.tsx` | `components/dashboard/stats-card.tsx` |
| 17 | `__tests__/components/dashboard/watchlist-widget.test.tsx` | `components/dashboard/watchlist-widget.tsx` |

#### Layout Component Tests (1 file)
| # | File Path | Tests For |
|---|-----------|-----------|
| 18 | `__tests__/components/layout/header.test.tsx` | `components/layout/header.tsx` |

#### Payment Component Tests (2 files)
| # | File Path | Tests For |
|---|-----------|-----------|
| 19 | `__tests__/components/payments/PlanSelector.test.tsx` | `components/payments/PlanSelector.tsx` |
| 20 | `__tests__/components/payments/PriceDisplay.test.tsx` | `components/payments/PriceDisplay.tsx` |

#### UI Component Tests (2 files)
| # | File Path | Tests For |
|---|-----------|-----------|
| 21 | `__tests__/components/ui/button.test.tsx` | `components/ui/button.tsx` |
| 22 | `__tests__/components/ui/card.test.tsx` | `components/ui/card.tsx` |

---

## 3. Empty Directories (No TSX Files)

### hooks/ - 0 TSX files
All files are `.ts` (pure TypeScript hooks without JSX):
- `use-alerts.ts`
- `use-auth.ts`
- `use-indicators.ts`
- `use-login-tracking.ts`
- `use-optimistic-mutation.ts`
- `use-toast.ts`
- `use-watchlist.ts`
- `use-websocket.ts`

### prisma/ - 0 TSX files
Contains database configuration files only:
- `schema.prisma` (Prisma schema)
- `seed.ts` (TypeScript seed script)
- `migrations/` (SQL migration files)

### types/ - 0 TSX files
Contains type definitions only:
- `*.ts` (TypeScript type files)
- `*.d.ts` (Declaration files)

### oauth/ - 0 TSX files
Contains documentation only:
- `*.md` (Markdown documentation)

### middleware/ - 0 TSX files
Contains middleware logic only:
- `tier-check.ts` (Tier validation middleware)

---

## Directory Structure

```
├── hooks/                        # 0 TSX files (8 .ts files)
│   ├── use-alerts.ts
│   ├── use-auth.ts
│   ├── use-indicators.ts
│   ├── use-login-tracking.ts
│   ├── use-optimistic-mutation.ts
│   ├── use-toast.ts
│   ├── use-watchlist.ts
│   └── use-websocket.ts
│
├── prisma/                       # 0 TSX files
│   ├── migrations/
│   ├── schema.prisma
│   └── seed.ts
│
├── types/                        # 0 TSX files (12 .ts/.d.ts files)
│   ├── alert.ts
│   ├── api.ts
│   ├── disbursement.ts
│   ├── dlocal.ts
│   ├── index.ts
│   ├── indicator.ts
│   ├── next-auth.d.ts
│   ├── payment.ts
│   ├── prisma-stubs.d.ts
│   ├── tier.ts
│   ├── user.ts
│   └── watchlist.ts
│
├── oauth/                        # 0 TSX files (3 .md files)
│   ├── claude-code-oauth-integration-task.md
│   ├── google-oauth-implementation-guide.md
│   └── oauth-decision-request.md
│
├── middleware/                   # 0 TSX files (1 .ts file)
│   └── tier-check.ts
│
├── emails/                       # 4 TSX files
│   ├── index.ts                  # (not TSX)
│   ├── payment-confirmation.tsx  # ✓
│   ├── payment-failure.tsx       # ✓
│   ├── renewal-reminder.tsx      # ✓
│   └── subscription-expired.tsx  # ✓
│
└── __tests__/                    # 22 TSX files (of 106 total test files)
    └── components/               # All TSX test files are here
        ├── admin/                # 8 files
        ├── affiliate/            # 3 files
        ├── charts/               # 3 files
        ├── dashboard/            # 3 files
        ├── layout/               # 1 file
        ├── payments/             # 2 files
        └── ui/                   # 2 files
```

---

## Summary by Category

### By Purpose
| Category | Files | Percentage |
|----------|-------|------------|
| Component Tests | 22 | 84.6% |
| Email Templates | 4 | 15.4% |
| **Total** | **26** | **100%** |

### Test Files by Component Category
| Category | Test Files |
|----------|------------|
| Admin | 8 |
| Affiliate | 3 |
| Charts | 3 |
| Dashboard | 3 |
| Payments | 2 |
| UI | 2 |
| Layout | 1 |
| **Total** | **22** |

---

## Complete TSX File Count (All Directories)

| Directory | TSX Files |
|-----------|-----------|
| `app/` | 74 |
| `components/` | 77 |
| `lib/` | 5 |
| `emails/` | 4 |
| `__tests__/` | 22 |
| `hooks/` | 0 |
| `prisma/` | 0 |
| `types/` | 0 |
| `oauth/` | 0 |
| `middleware/` | 0 |
| **Grand Total** | **182** |

---

## Notes

1. **Email Templates**: Use React Email library for transactional emails
2. **Component Tests**: All TSX test files are in `__tests__/components/` for testing React components
3. **Hooks**: Written as pure TypeScript (`.ts`) since they don't render JSX directly
4. **Types/Prisma/Middleware**: Configuration and type files don't use JSX
5. **Test Coverage**: 22 component tests cover admin, affiliate, charts, dashboard, layout, payments, and UI components

---

*This inventory was generated by examining the actual filesystem on 2026-01-26*
