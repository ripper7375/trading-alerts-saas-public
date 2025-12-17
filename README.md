# Trading Alerts SaaS V7 - MiniMax M2 Edition

**Professional Trading Alerts Platform with AI-Driven Development**

[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-blue)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-blue)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

### 🔄 CI/CD Status

| Workflow              | Status     | Phase | Purpose                     |
| --------------------- | ---------- | ----- | --------------------------- |
| OpenAPI Validation    | ✅ Active  | 1-4   | Validate API specifications |
| Dependencies Security | ✅ Active  | 1-4   | Scan for vulnerabilities    |
| Flask CI              | ✅ Active  | 1-4   | Flask app validation        |
| Next.js CI            | ⏭️ Standby | 3-4   | Next.js app validation      |
| API Tests             | ⏭️ Standby | 3-4   | Integration tests           |

**Current Phase:** 1-2 (Planning/Documentation) | **Success Rate:** 100%
📖 [View detailed workflow documentation](.github/workflows/README.md)

---

## 📋 **Project Overview**

A commercial SaaS platform providing real-time trading alerts and chart visualization with MT5 integration. Built using modern web technologies and cost-effective AI-driven autonomous development with MiniMax M2.

### **Key Features**

- 🔄 Real-time market data from centralized MT5 terminal
- 📊 Interactive charts with TradingView Lightweight Charts
- 🔔 Price alerts with notifications
- 👁️ Watchlists for multiple symbols and timeframes
- 💳 Dual payment integration (Stripe + dLocal for emerging markets)
- 🌍 Local payment methods for 8 countries (India, Nigeria, Pakistan, Vietnam, Indonesia, Thailand, South Africa, Turkey)
- 🤝 Affiliate marketing platform (2-sided marketplace)
- 🎨 Modern UI with shadcn/ui components
- 🔒 Secure authentication with NextAuth.js
- 📱 Responsive design for desktop and mobile

### **Technical Highlights**

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes + Flask Microservice
- **Database:** PostgreSQL 15+ with Prisma ORM
- **MT5 Integration:** Custom Python service reading from centralized MT5 terminal
- **Payments:** Stripe (international cards) + dLocal (local payment methods for emerging markets)
- **Affiliate System:** 2-sided marketplace with commission tracking
- **Deployment:** Vercel (frontend) + Railway (database + Flask)
- **AI Development:** MiniMax M2 for cost-effective autonomous building

---

## 🏗️ **Architecture**

```
┌─────────────────────────────────────────┐
│       YOUR MT5 TERMINAL                 │
│  (Centralized Data Source)              │
│  - Fractal Horizontal Line_V5.mq5 ✓     │
│  - Fractal Diagonal Line_V4.mq5 ✓       │
│  - OHLC Download_V4.mq5 (utility) ℹ️     │
└──────────────┬──────────────────────────┘
               │
               │ Indicator Buffers (2 indicators)
               ▼
┌─────────────────────────────────────────┐
│       FLASK MT5 SERVICE                 │
│  (Python 3.11+ Microservice)            │
│  - Read indicator buffers               │
│  - Validate tier access                 │
│  - Expose REST API                      │
└──────────────┬──────────────────────────┘
               │
               │ HTTP/JSON
               ▼
┌─────────────────────────────────────────┐
│       NEXT.JS 15 APPLICATION            │
│  (TypeScript - Frontend + Backend)      │
│  - 38 API endpoints                     │
│  - Real-time charts                     │
│  - User authentication                  │
│  - Subscription management              │
└─────────────────────────────────────────┘
```

**Users subscribe to YOUR data** - they cannot connect their own MT5 terminals.

---

## 📚 **Documentation Structure**

### **V7 Development Guide** (Step-by-Step)

Phase-by-phase guide for building with MiniMax M2:

- 📖 [`docs/v7/v7_overview.md`](docs/v7/v7_overview.md) - Project philosophy and overview
- ⚙️ [`docs/v7/v7_phase_0_setup.md`](docs/v7/v7_phase_0_setup.md) - Development environment setup (4 hours)
- 📋 [`docs/v7/v7_phase_1_policies.md`](docs/v7/v7_phase_1_policies.md) - **MOST IMPORTANT** - Policy creation (14 hours)
- 🏗️ [`docs/v7/v7_phase_2_foundation.md`](docs/v7/v7_phase_2_foundation.md) - CI/CD and database foundation (5 hours)
- 🚀 [`docs/v7/v7_phase_3_building.md`](docs/v7/v7_phase_3_building.md) - Autonomous building with MiniMax M2 (38 hours)
- 🌐 [`docs/v7/v7_phase_4_deployment.md`](docs/v7/v7_phase_4_deployment.md) - Production deployment (6 hours)
- 🔧 [`docs/v7/v7_phase_5_maintenance.md`](docs/v7/v7_phase_5_maintenance.md) - Ongoing development

**Total Timeline:** 67 hours over 11 weeks

### **V5 Implementation Details**

Detailed implementation guides for each part:

- [`docs/implementation-guides/v5_part_a.md`](docs/implementation-guides/v5_part_a.md) through `v5_part_j.md`

### **API Specifications**

OpenAPI 3.0 specifications for all endpoints:

- [`docs/trading_alerts_openapi.yaml`](docs/trading_alerts_openapi.yaml) - Next.js API (38+ endpoints)
- [`docs/flask_mt5_openapi.yaml`](docs/flask_mt5_openapi.yaml) - Flask MT5 service (4 endpoints)
- [`docs/dlocal-openapi-endpoints.yaml`](docs/dlocal-openapi-endpoints.yaml) - dLocal payment endpoints (7 endpoints)

### **Project Structure**

- [`docs/v5-structure-division.md`](docs/v5-structure-division.md) - 18 parts, 289 files breakdown (includes affiliate + dLocal)

### **Testing & Policies**

- [`docs/mvp-manual-testing-checklist.md`](docs/mvp-manual-testing-checklist.md) - Complete testing checklist
- [`docs/policies/00-tier-specifications.md`](docs/policies/00-tier-specifications.md) - Tier system rules
- [`docs/policies/03-architecture-rule.md`](docs/policies/03-architecture-rule.md) - Architecture patterns

### **Diagrams**

12 Mermaid diagrams visualizing system architecture:

- `docs/diagrams/diagram-01-system-overview.mermaid`
- `docs/diagrams/diagram-02-components.mermaid`
- ... through `diagram-12-implementation-phases.mermaid`

---

## 🌱 **Seed Code** (Reference Implementations)

The `seed-code/` folder contains reference implementations for Aider to learn patterns from:

### **1. Flask/MT5 Service Pattern**

```
seed-code/market_ai_engine.py
```

- Flask route structure
- MT5 connection patterns
- Indicator data fetching logic
- **Used in:** Part 6 (Flask MT5 Service)

### **2. Next.js Backend Patterns**

```
seed-code/saas-starter/
├── app/api/          # API route patterns
├── lib/stripe.ts     # Stripe integration
├── middleware.ts     # NextAuth patterns
└── prisma/           # Database patterns
```

- NextAuth.js configuration
- Prisma database patterns
- Stripe payment integration
- **Used in:** Parts 5, 7, 12 (Auth, API Routes, E-commerce)

### **3. Frontend UI Patterns**

```
seed-code/next-shadcn-dashboard-starter/
├── app/dashboard/    # Dashboard layouts
├── components/ui/    # shadcn/ui components
├── components/charts/ # Chart patterns
└── lib/utils.ts      # Utility functions
```

- Dashboard layout structure
- shadcn/ui component usage
- Chart components
- Responsive design patterns
- **Used in:** Parts 8-14 (All UI components)

### **4. MQL5 Indicators**

```
seed-code/mlq5-indicator/
├── Fractal Horizontal Line_V5.mq5  (used by Flask - horizontal support/resistance)
├── Fractal Diagonal Line_V4.mq5    (used by Flask - diagonal trend lines)
└── OHLC Download_V4.mq5            (utility tool - data export to files)
```

- **Active Indicators (2):** Fractal Horizontal & Diagonal provide real-time data via buffers
- **Utility Tool (1):** OHLC Download exports historical data to files (not used by Flask service)
- Custom indicator source code for reference
- Buffer index mappings documented in flask_mt5_openapi.yaml
- **Used in:** Part 6 (Flask MT5 integration - reads buffers from 2 Fractal indicators)

**Important:** Seed code is for **reference only** - Aider adapts patterns to our specific requirements.

---

## 🎯 **Tier System**

### **FREE Tier**

- ✅ **5 symbols** (BTCUSD, EURUSD, USDJPY, US30, XAUUSD)
- ✅ **3 timeframes** (H1, H4, D1)
- ✅ **15 chart combinations** (5 symbols × 3 timeframes)
- ✅ **5 alerts** maximum
- ✅ **5 watchlist items** maximum
- ✅ **60 API requests/hour** (1 per minute average)
- 💰 **$0/month**

### **PRO Tier**

- 📊 **15 symbols** (AUDJPY, AUDUSD, BTCUSD, ETHUSD, EURUSD, GBPJPY, GBPUSD, NDX100, NZDUSD, US30, USDCAD, USDCHF, USDJPY, XAGUSD, XAUUSD)
- ⏱️ **9 timeframes** (M5, M15, M30, H1, H2, H4, H8, H12, D1)
- 📈 **135 chart combinations** (15 symbols × 9 timeframes)
- 🔔 **20 alerts** maximum
- 📝 **50 watchlist items** maximum
- 🚀 **300 API requests/hour** (5 per minute average)
- 💳 **$29/month**

---

## 🚀 **Quick Start**

### **Prerequisites**

- Node.js 18.18+
- Python 3.11+
- PostgreSQL 15+
- MetaTrader 5 terminal with demo/real account
- MiniMax M2 API key (for AI development)

### **Phase 0: Setup (4 hours)**

Follow the detailed setup guide:

```bash
# See complete instructions in:
docs/v7/v7_phase_0_setup.md
```

Key installations:

1. Git, Node.js 18.18+, Python 3.11+
2. VSCode + 6 required extensions
3. PostgreSQL 15+, Docker Desktop
4. Aider with MiniMax M2 configuration
5. MetaTrader 5 with custom indicators

### **Phase 1: Create Policies (14 hours)**

**MOST IMPORTANT PHASE** - Create the "AI constitution":

```bash
# See complete instructions in:
docs/v7/v7_phase_1_policies.md
```

Create 6 policy documents that guide autonomous development:

1. `01-approval-policies.md` - When to auto-approve, auto-fix, or escalate
2. `02-quality-standards.md` - Code quality requirements
3. `03-architecture-rules.md` - System design constraints
4. `04-escalation-triggers.md` - When to stop and ask
5. `05-coding-patterns.md` - Copy-paste ready examples
6. `06-aider-instructions.md` - How Aider should operate

### **Phase 2-5: Build & Deploy (49 hours)**

Follow remaining phases for autonomous building with MiniMax M2.

---

## 📊 **Project Statistics**

- **Total Parts:** 16 logical parts
- **Total Files:** 170+ files
- **API Endpoints:** 42 total (38 Next.js + 4 Flask)
- **Development Time:** 67 hours with MiniMax M2 (vs 163 hours manual)
- **Time Savings:** 96 hours (59% faster)
- **Cost Savings:** Significant with MiniMax M2 vs Anthropic API

---

## 🛠️ **Technology Stack**

### **Frontend**

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript 5.6+
- **Styling:** Tailwind CSS 3.4
- **UI Components:** shadcn/ui (Radix UI)
- **Charts:** TradingView Lightweight Charts
- **State Management:** React 19 hooks

### **Backend**

- **API:** Next.js 15 API Routes
- **Auth:** NextAuth.js 4.24+
- **Validation:** Zod schemas
- **Database ORM:** Prisma 5.20+
- **Database:** PostgreSQL 15+

### **MT5 Integration**

- **Language:** Python 3.11+
- **Framework:** Flask 3.0+
- **MT5 API:** MetaTrader5 Python library 5.0.45+
- **Deployment:** Docker containers

### **Payments**

- **Provider:** Stripe
- **SDK:** stripe-js + stripe (Node)

### **Development**

- **AI Coding:** Aider with MiniMax M2
- **Package Manager:** pnpm
- **Linting:** ESLint + Prettier
- **Type Checking:** TypeScript strict mode

### **Deployment**

- **Frontend:** Vercel (Next.js)
- **Database:** Railway (PostgreSQL)
- **Backend:** Railway (Flask Docker)
- **CI/CD:** GitHub Actions

---

## 📁 **Repository Structure**

```
trading-alerts-saas-v7/
├── docs/                          # All documentation
│   ├── v7/                        # V7 phase guides
│   ├── implementation-guides/     # V5 part details
│   ├── diagrams/                  # Mermaid diagrams
│   ├── policies/                  # AI development policies
│   ├── trading_alerts_openapi.yaml
│   ├── flask_mt5_openapi.yaml
│   ├── v5-structure-division.md
│   └── mvp-manual-testing-checklist.md
│
├── seed-code/                     # Reference implementations
│   ├── market_ai_engine.py        # Flask/MT5 pattern
│   ├── saas-starter/              # Next.js backend
│   ├── next-shadcn-dashboard-starter/  # Frontend UI
│   └── mlq5-indicator/            # MQL5 indicators
│       ├── Fractal Horizontal Line_V5.mq5
│       └── Fractal Diagonal Line_V4.mq5
│
├── trading-alerts-saas/          # ← Created in Phase 3
│   ├── app/                       # Next.js app directory
│   ├── components/                # React components
│   ├── lib/                       # Utilities & clients
│   ├── prisma/                    # Database schema
│   └── ...                        # (170+ files)
│
├── mt5-service/                   # ← Created in Phase 3
│   ├── app/                       # Flask application
│   ├── indicators/                # MQL5 indicators
│   ├── Dockerfile                 # Container config
│   └── requirements.txt           # Python dependencies
│
├── scripts/                       # Build scripts
│   └── openapi/                   # Type generation
│
├── postman/                       # API test collections
│
├── .aider.conf.yml                # Aider configuration
├── documents-fixing-v1.md         # Corrections reference
└── README.md                      # This file
```

---

## 🤖 **AI-Driven Development with MiniMax M2**

This project uses a **3-AI team** approach:

1. **Claude Chat (Anthropic)** - Your consultant for decisions and guidance
2. **Aider + MiniMax M2** - Your autonomous builder (cost-effective)
3. **Claude Code** - Your quality validator

### **Why MiniMax M2?**

- ✅ **Cost-effective:** Significantly cheaper than Anthropic API
- ✅ **Quality output:** Same professional code quality
- ✅ **Perfect for autonomous building:** Excellent for repetitive tasks
- ✅ **Lower total project cost:** 67 hours of development at reduced API cost

### **Development Workflow**

```
1. You define policies (rules for AI)
2. Aider builds autonomously with MiniMax M2
3. Claude Code validates quality
4. You handle escalations (exceptions only)
5. Test and deploy
```

**Your involvement:** ~20% (escalations + testing)
**Aider's work:** ~80% (autonomous building with MiniMax M2)

---

## 📖 **Getting Started Guide**

### **For Beginners**

Start here: [`docs/v7/v7_overview.md`](docs/v7/v7_overview.md)

This guide explains:

- ✅ What you're building (in simple terms)
- ✅ Why V7 approach is powerful
- ✅ How AI helps you build faster
- ✅ Step-by-step roadmap

### **For Developers**

Jump to: [`docs/v7/v7_phase_0_setup.md`](docs/v7/v7_phase_0_setup.md)

Then follow phases 0-5 sequentially.

### **For Reviewers**

Check out:

- OpenAPI specs: [`docs/trading_alerts_openapi.yaml`](docs/trading_alerts_openapi.yaml)
- Architecture: [`docs/v5-structure-division.md`](docs/v5-structure-division.md)
- Testing: [`docs/mvp-manual-testing-checklist.md`](docs/mvp-manual-testing-checklist.md)

---

## 🧪 **Testing**

### **Automated Testing** (Optional for MVP)

- Jest for unit tests
- React Testing Library for component tests
- Configured in Phase 2

### **Manual Testing** (Required)

Complete checklist available:

- [`docs/mvp-manual-testing-checklist.md`](docs/mvp-manual-testing-checklist.md)

Covers:

- Authentication flows
- Tier access control
- Watchlist & alerts CRUD
- Charts & real-time data
- Stripe payments (test mode)
- All 42 API endpoints

---

## 🔐 **Environment Variables**

Create `.env.local` in Next.js project root:

```bash
# Auth
NEXTAUTH_SECRET=                    # Generate with: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000  # Production: https://your-domain.com

# Database
DATABASE_URL=                       # PostgreSQL connection string

# MT5 Service
MT5_API_URL=http://localhost:5001  # Flask service URL
MT5_LOGIN=                          # Your MT5 login
MT5_PASSWORD=                       # Your MT5 password
MT5_SERVER=                         # Your MT5 server
MT5_API_KEY=                        # Generate with: openssl rand -hex 32

# Stripe (Optional - for payments)
STRIPE_SECRET_KEY=                  # From Stripe dashboard
STRIPE_WEBHOOK_SECRET=              # From Stripe webhook setup
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY= # Public key from Stripe

# Email (Optional - for notifications)
RESEND_API_KEY=                     # From resend.com

# MiniMax M2 (for AI development)
ANTHROPIC_API_KEY=                     # Your MiniMax API key
ANTHROPIC_API_BASE=https://api.minimaxi.com/v1
```

**Note:** During PMF period, Stripe and Resend are optional (no payments, basic notifications).

---

## 🤝 **Contributing**

This is a commercial project with AI-driven development approach.

For improvements to documentation or policies:

1. Fork the repository
2. Make your changes
3. Submit a pull request with clear description

---

## 📄 **License**

MIT License - See [LICENSE](LICENSE) file for details

---

## 🙏 **Acknowledgments**

**Seed Code Providers:**

- [nextjs/saas-starter](https://github.com/vercel/nextjs-subscription-payments) - Next.js SaaS patterns
- [Kiranism/next-shadcn-dashboard-starter](https://github.com/Kiranism/next-shadcn-dashboard-starter) - Dashboard UI patterns

**Technologies:**

- Next.js, React, TypeScript (Vercel)
- Prisma, PostgreSQL
- Stripe (payments)
- TradingView (Lightweight Charts)
- MetaTrader 5 (market data)
- MiniMax M2 (cost-effective AI development)

---

## 📞 **Support & Resources**

- **Documentation:** [`docs/v7/`](docs/v7/)
- **API Reference:** [`docs/trading_alerts_openapi.yaml`](docs/trading_alerts_openapi.yaml)
- **Testing Guide:** [`docs/mvp-manual-testing-checklist.md`](docs/mvp-manual-testing-checklist.md)
- **Corrections:** [`documents-fixing-v1.md`](documents-fixing-v1.md)

---

## 🎯 **Project Status**

- ✅ Documentation complete
- ✅ Seed code added
- ✅ OpenAPI specifications finalized
- 🔄 Ready for Phase 1: Policy creation
- ⏳ Phase 2-5: Pending

**Next Step:** Create 6 policy documents (14 hours)

---

**Built with ❤️ using AI-driven development**

**Time to Professional SaaS:** 67 hours
**Cost-Effective Development:** MiniMax M2
**Quality Assurance:** Claude Code validation

_Welcome to the future of SaaS development!_ 🚀

---

## Automated Validation System

**Status:** ✅ Fully Operational  
**Date:** 2025-11-24

This project uses a fully automated validation system powered by Aider for Phase 3 autonomous building.

### Validation Tools

Our multi-layer validation ensures high code quality:

1. **TypeScript** (`tsc --noEmit`) - Type checking
2. **ESLint** (`next lint`) - Code quality
3. **Prettier** (`prettier --check`) - Formatting
4. **Custom Policy Validator** (`scripts/validate-file.js`) - Policy compliance
5. **Jest** (`npm test`) - Unit tests

### Quick Start

```bash
# Run complete validation
npm run validate

# Auto-fix issues
npm run fix

# Run tests
npm test

# Individual validators
npm run validate:types      # TypeScript only
npm run validate:lint       # ESLint only
npm run validate:format     # Prettier only
npm run validate:policies   # Policy validator only
```

### Phase 3 Development Workflow

**Aider** serves as the autonomous builder and validator:

```
┌─────────────────────────────────────┐
│          AIDER (MiniMax M2)         │
├─────────────────────────────────────┤
│ 1. Read policies & requirements     │
│ 2. Generate code                    │
│ 3. Run validation                   │
│ 4. Make decision:                   │
│    - ✅ Approve → Commit           │
│    - 🔧 Auto-fix → Fix & retry     │
│    - 🚨 Escalate → Ask human       │
│ 5. Move to next file                │
└─────────────────────────────────────┘
```

**Success Metrics:**

- Target: 85-92% auto-approve rate
- Target: 6-12% auto-fix rate
- Target: 2-5% escalation rate

### Documentation

- **Complete Validation Guide:** `VALIDATION-SETUP-GUIDE.md`
- **Workflow Analysis:** `docs/CLAUDE-CODE-WORKFLOW-ANALYSIS.md`
- **Responsibility Checklist:** `docs/CLAUDE-CODE-VALIDATION-CHECKLIST.md`
- **Aider Instructions:** `docs/policies/06-aider-instructions.md`
- **Main Guide:** `CLAUDE.md`

### Starting Phase 3

```bash
# Start Aider
aider

# Load part build order
> /read docs/build-orders/part-01-foundation.md
> /read docs/implementation-guides/v5_part_a.md

# Build files
> "Build Part 1 following the build order file-by-file"

# Aider will autonomously:
# - Generate code
# - Run validation
# - Make decisions
# - Commit approved code
# - Handle escalations
```

**Ready to build 170+ files with automated quality assurance!** 🚀
