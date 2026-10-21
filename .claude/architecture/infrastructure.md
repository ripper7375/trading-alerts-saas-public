---
type: Concept/Infrastructure
status: active
updated_at: 2026-09-26
source: 'Standing facts recorded in CLAUDE.md session logs (Vultr notice 2026-09-11, Railway/Vercel findings 2026-08-31..09-09)'
tags: [deploy, vercel, railway, vps, vultr, r2, mt5]
related_docs:
  - ./database-traps.md
  - ../state/waiting-on.md
---

# Deployment topology and standing infrastructure facts

| Component                                                                                                                | Where it runs                                                                | Deploys by                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Next.js monolith (`davintrade.app`, apex 308 → `www`)                                                                    | Vercel                                                                       | push to `main` — **but a push is not proof of a deploy**; check the live build                                 |
| `money-service`, `operation-service` (NestJS 11)                                                                         | Railway, project `trading-alerts`                                            | GitHub source on `main`                                                                                        |
| `railway-gateway` (NestJS 11, MT5 ingest + Bull queues)                                                                  | Railway, project `trading-alerts`                                            | GitHub source, Root Directory `railway-gateway`; **Watch Paths still unset** (every monorepo push rebuilds it) |
| Postgres (production)                                                                                                    | Railway `trading-alerts`                                                     | see [database-traps](./database-traps.md)                                                                      |
| MT5 terminals, Stack C collector / push worker / renderer (NSSM services `MT5Collector`, `MT5PushWorker`, `MT5Renderer`) | **Vultr** Windows Server 2022 VPS                                            | manual; runbook `docs/runbooks/mt5-terminal-promote.md`                                                        |
| Chat stack (3 containers, `chat-api.davintrade.app`)                                                                     | Linux VPS, Docker Compose                                                    | runbook `docs/runbooks/contabo-chat-stack.md`                                                                  |
| Chart renders                                                                                                            | Cloudflare R2, **private** bucket `davintrade-renders`, ~60 s presigned URLs | `MT5Renderer` uploads                                                                                          |

## Standing facts

- **The MT5 VPS is Vultr. "Contabo" is a legacy name** (Davin, 2026-09-11). Paths such as
  `backend-stack-c/1_EA-and-backfill-worker-on-contabo-vps/` mean "the production Windows VPS".
  **Do not rename the folder** — historical orders reference it. Vultr is billed hourly with a
  snapshot-and-destroy workflow, so `xauusd.db` is a replay buffer, and an unsynced outbox row is
  the one thing a destroy genuinely loses.
- The Railway CLI here is authenticated as Davin and linked to `trading-alerts`. Root Directory
  and Watch Paths are web-UI only; the Railway UI **stages** changes until "Apply N changes →
  Deploy" is clicked. Re-probe after any CLI mutation — a CLI error can hide a failed change.
- A Railway service with a large `uptime` in its health response has not picked up a changed
  variable; redeploy it. Any redeploy can surface an unrelated latent build failure, so confirm a
  service can build before relying on a redeploy to carry a change.
- **Never enable public read on the R2 bucket** — object names are deterministic, so public read
  would make the PRO gate cosmetic. An unsigned GET on the S3 endpoint is refused even for a public
  bucket; public read lives on `pub-*.r2.dev` or a custom domain. Recheck with
  `scratch/verify-r2.ts` (gitignored; needs `CF_API_TOKEN` for a definitive answer).
- **Never point a read-only consumer (renderer, test harness) at a writer's database path**
  (`C:\Scripts\database\xauusd.db`) — a wrong-shaped table there silently stops the collector
  from promoting any cycle.
- `install_services.bat` must not be re-run wholesale on a live VPS: it re-sets service
  environments to placeholder credentials. Register one service at a time.
- **Putting build step 2 live** (migration, gateway, monolith with the flag off, VPS files, the symbol-specs
  exporter, verification, cutover) has one order: `docs/runbooks/deploy-stack-d-step2.md`. Nothing in it has
  been run against production yet.
- After an indicator rebuild, confirm a fresh `_Statistic.txt` contains `[EDT CHANNEL]` before
  trusting a green cycle — a stale `.ex5` fails silently (new fields just read as NULL).
- **The three NestJS services have CI** (`.github/workflows/nestjs-services-ci.yml`, Remediation Tier 0, 2026-10-16): one job each,
  Node 22 (Node 20 is past end of life), `npm ci`, `tsc --noEmit`, tests and `nest build`; the gateway also runs its e2e specs, `check:sensor-kit`
  and installs Python 3.11 with `pyyaml==6.0.2 jsonschema==4.25.0` (its sensor specs skip silently without them). It is **not run on GitHub yet**
  (first push will show). No `npm run lint` for the gateway: the script matches no files. Report: `docs/handoffs/2026-10-16-nestjs-tier0-tier2-execution.md`.
- **money-service refuses to guess its public URL or its dLocal key** (Remediation 6.5): Stripe checkout needs `NEXTAUTH_URL`, dLocal create-payment needs
  `DLOCAL_API_KEY` and `NEXTAUTH_URL`; without them they answer 503, and mock mode exists only under `NODE_ENV=test`.
- **Manage Subscription S2 deploy order: migration, then operation-service, then money-service, then the monolith** (2026-10-21). The migration
  `20261021000000_add_subscription_management_fields` first (database-traps.md). operation-service BEFORE money-service this time, the opposite of the
  price events: money-service's new `SUBSCRIPTION_RESUMED` outbox event reaching an operation-service that does not know it is answered `skipped`
  (`unrecognized-event-type`), and the publisher counts any 2xx as delivered, so the "your subscription will continue" e-mail is lost and never retried.
  The cancel-scheduled e-mail needs no new consumer code (it is `SUBSCRIPTION_CANCELLED` with `cancelAt`, as before).
- **Manage Subscription S3 deploy order: the same, migration (S2's), operation-service, money-service, the monolith** (2026-10-21). money-service's new
  `SUBSCRIPTION_UPGRADED` and `SUBSCRIPTION_DOWNGRADE_SCHEDULED` outbox events are `unrecognized-event-type` to an operation-service that does not know them: answered
  `skipped`, counted as delivered, lost. No migration and no new variable; a plan change needs `STRIPE_PRO_PRICE_ID` on both services (503 `PLAN_CHANGE_UNAVAILABLE` without it).
- **Manage Subscription S4 deploy: BOTH money-service and the monolith, no migration beyond S2's** (2026-10-21). dLocal calls whichever webhook its dashboard points at, so both
  dLocal webhooks and both `/payments/dlocal/create` guards changed and neither may be skipped; operation-service is unchanged.
- **A dLocal payment STACKS onto the days left, so the dLocal webhook must stay claim-guarded** (S4, 2026-10-21; [S4 report](../../docs/handoffs/2026-10-21-manage-subscription-s4.md) §2
  items 2 to 4). `expiresAt = max(now, current expiry) + duration`, taken only from a LIVE dLocal row (a Stripe row also stores `expiresAt`). The payment is claimed
  (`updateMany ... status: { not: 'COMPLETED' }`) inside the transaction in both stacks, so a replayed webhook adds nothing; remove that claim and every dLocal retry adds a period.
- **Stripe refuses `cancel_at_period_end` while a Subscription Schedule manages the subscription, and a schedule stays attached through its last phase** (verified in test mode,
  2026-10-21; [S3 report](../../docs/handoffs/2026-10-21-manage-subscription-s3.md) §3.2). After "switch to monthly at renewal" the schedule is still attached for the whole first
  monthly period, so anything that cancels or changes the subscription (cancel, upgrade) must release a live schedule first; the webhook releases it when phase 2 starts.
- **"Update card" needs `STRIPE_PORTAL_CONFIGURATION_ID` on BOTH the monolith and money-service** (Manage Subscription S1, 2026-10-21): `POST
/api/subscription/payment-method-session` answers 503 `PORTAL_NOT_CONFIGURED` without it or without `NEXTAUTH_URL`, and creates nothing. With
  `MIGRATE_WRITE_APIS_MONEY_STRIPE=true` (set in the local `.env.local`) the monolith route only forwards to money-service, so a local browser check also needs
  money-service running with the same variable. Use a test-mode ID with test keys, a live ID in production.
- **Two Stripe rule files are byte copies across the stacks** (a test fails on any difference): `lib/stripe/tier-rule.ts` and
  `lib/stripe/subscription-actions.ts` are mirrored in `money-service/src/stripe/`. Edit one, copy it over the other. `invoice-plan.ts` is also mirrored, by
  hand, with no test.
