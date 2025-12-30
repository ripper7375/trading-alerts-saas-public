I need you to implement Phase 0 bundle size reduction and optimization for Trading Alerts SaaS Public.

CONTEXT:
✅ All 7 critical paths E2E testing is COMPLETE (70 scenarios passing)
✅ All bugs found during testing have been FIXED
✅ Baseline established - now safe to optimize

ATTACHED DOCUMENTS:

1. Architecture Design Document (optimization strategy and principles)
2. Implementation Plan Document (step-by-step Phase 0 instructions)

YOUR TASK: Implement Phase 0 (Emergency Fix + Quick Wins)

Current bundle size: 380MB
Target: <340MB (under 370MB threshold)

STEPS (from Implementation Plan):

1. Install bundle analyzer (Step 0.1)
2. Setup bundle monitoring in CI/CD (Step 0.2)
3. Convert landing/pricing to SSG (Step 0.3)
4. Implement dynamic imports for heavy components (Step 0.4)
   - PRO-only symbols (10 components)
   - PRO-only indicators (6 components: momentum_candles, keltner_channels, tema, hrma, smma, zigzag)
   - Chart components
   - Payment modals
5. Remove unused dependencies (Step 0.5)
6. Validate Phase 0 completion (Step 0.6)

CRITICAL: After EACH optimization step:

- Run: npm run build
- Check bundle size: du -sm .next
- Run E2E tests: npm run test:e2e
- If tests fail → ROLLBACK and investigate
- If tests pass → Commit and proceed

Branch: optimization/phase-0-bundle-reduction

Start with Step 0.1: Install @next/bundle-analyzer
