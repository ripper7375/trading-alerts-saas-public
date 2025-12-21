After review part18-tdd-complete.md, I found that Part 18 has 63 files for Claude Code (web) to build

These numerous number of files to build create issues related to Long running Agents which are Agents work in discrete sessions without memory of previous work. Each new context window is like a new engineer arriving with no knowledge of what happened before, leading to two main failures - trying to do too much at once and running out of context mid-task, or declaring victory prematurely when seeing partial progress.

I would like you to alleviate issues related to Long running Agents by dividing Part 18 into 3 smaller prompts; namely, Part 18A, Part 18B, and Part 18C as per Vertical Slices Approach

# Vertical Slices Approach

Part 18A: Payment Creation (end-to-end testable)
Part 18B: Subscription Lifecycle (end-to-end testable)
Part 18C: User Experience (end-to-end testable)

===========================================

Part 18A: Payment Creation Flow (Complete Feature)
Files: ~23 files

Database schema
Core services (currency, payment methods, country detection)
Payment creation API (can test end-to-end)
Basic webhook handler (minimal version)
Tests for all above

Deliverable: Can create a dLocal payment and process success webhook
Advantage : Testable end-to-end in ONE session

=======================================

Part 18B: Subscription Lifecycle (Complete Feature)
Files: ~20 files

3-day validator service
Complete webhook handler (with all business logic)
Cron jobs (expiring, downgrade)
Part 12 Integration - API Layer (subscription, invoices APIs)
Tests for all above

Deliverable: Can manage full subscription lifecycle
Advantage : Builds on 18A but adds complete subscription management

=========================================

Part 18C: User Experience & Admin (Complete Feature)
Files: ~20 files

Frontend components
Unified checkout page
Email templates
Admin fraud dashboard
Part 12 Integration - Frontend Layer (pricing page, subscription card)
E2E tests

Deliverable: Complete user-facing experience
Advantage : Frontend polish happens last, doesn't break if 18A/18B have minor bugs

=========================================

Critical Requirements for Division

For division into 18A, 18B, and 18C, Each part MUST include:

1. Handoff Section:
   What Part 18A Built (for Part 18B to know)
   - Database models: Payment, FraudAlert, User.hasUsedThreeDayPlan
   - Services: CurrencyConverter, PaymentMethods, CountryDetector
   - Service interfaces: [show TypeScript signatures]
   - Test coverage: 25% achieved

2. Validation Gate:
   Part 18A cannot be "complete" until services are demonstrably working
   Part 18B cannot be "complete" until APIs return correct data
   Part 18C cannot be "complete" until Part 12 integration doesn't break Stripe

3. Rollback Plan:
   What if Part 18B discovers a bug in 18A services?
   Need a way to document bugs for manual fixing

=============================================

These 3 parts must have seamless transition from parts to parts + maintain coherence of contexts across parts + allow Claude Code (web) to build code with smooth transition between parts. All the 3 prompts to Claude Code (web) must be fully self-contained context with full
mission,
dependencies (prerequisite check),
mutual integration with part 12,
essential files to read (reference documents),
critical business rules,
tdd methodology,
unified authentication,
affiliate business logic,
clear and systematic build sequence,
coverage target,
git workflow (commit strategy),
validation requirements,
critical tdd rules,
success criteria,
execution/validation checklist,
file count (reconciliation of number of files built in Part 18A, Part 18B, Part 18C with your previously created Part 18 to ensure that files to build in the 3 parts (18A, 18B, 18C) are not missing),
Troubleshooting Common Issues

Important : I will upload EACH prompt (18A, 18B, 18C) to Claude Code to EACH chat session therefore each prompt must be fully self contained contexts and contents as per requirements above.

Please create Part 18A, Part 18B, and Part 18C in the ARTIFACTS that could be downloaded as txt files (ASCII-only code blocks, Plain text formatting, AI-readable prompts, Copy-paste safe examples, Target: automated code generation).
