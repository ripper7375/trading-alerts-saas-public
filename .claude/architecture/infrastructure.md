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
- After an indicator rebuild, confirm a fresh `_Statistic.txt` contains `[EDT CHANNEL]` before
  trusting a green cycle — a stale `.ex5` fails silently (new fields just read as NULL).
