# Runbook — Deploying the Railway services (money, operation, gateway)

**Applies to:** `money-service`, `operation-service`, `railway-gateway` (Railway project `trading-alerts`,
Nixpacks builder, GitHub source on `main`). **Owner:** Davin (dashboard, approvals) / the agent that is
making the change (everything it can verify from the repository, GitHub and build logs).

Read this before any push to `main`, and before drafting a deploy prompt or walkthrough for any of the three
services: while Railway deploys on every push (next section), a push is a deploy. The monolith (Vercel) and
the VPS pipeline have their own runbooks; see [infrastructure.md](../../.claude/architecture/infrastructure.md).

## How deploys happen today (read first)

**Railway deploys the three services on every push to `main`.** There is no separate deploy step and no
watch path narrows it: `1f680cfb` touched only docs, a monolith test and an `operation-service` spec, and
`money-service`, `railway-gateway` and `operation-service` all redeployed. They finish within about a minute
of each other (2026-10-31: `money-service` 06:40:51Z, `railway-gateway` 06:41:21Z, `operation-service`
06:41:34Z). So **a push to `main` is a production deploy** of the three services and, through Vercel, of the
monolith. The gates below apply **before the push**.

- **History, read from the GitHub deployment history on 2026-10-31:** deployments through 2026-10-20, none
  from 2026-10-20 to 2026-10-27 (Davin recorded a pause on 2026-10-22), deployments on pushes again since
  2026-10-27. The earlier note that deploys were still paused was stale. One failure so far: `operation-service`
  on `82b1fb56`.
- **Re-check it, do not assume it.** The Railway dashboard is the authority. An agent can read what Railway
  did for a commit from GitHub:

  ```bash
  gh api repos/ripper7375/trading-alerts-saas-public/commits/<sha>/statuses --jq '.[] | "\(.created_at) \(.context) \(.state) \(.description)"'
  ```

  `success` means the build and the health check passed. It does not say which Node major runs.

- A second Railway project, `prisma-migration`, also builds this repository on every push and has failed
  every time. Davin should check what it is for.

## Who does what

| Marker           | Meaning                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **AGENT**        | The agent can do and verify this from the repository, the git history, GitHub or a pasted build log.                                 |
| **DAVIN (gate)** | Needs the Railway dashboard or an approval. The agent cannot see it: **stop, ask, and wait for the answer.** Never assume it passed. |

An agent that cannot reach the Railway dashboard must not report a DAVIN step as done. It asks Davin to
paste what the dashboard shows.

## A. Before the push

1. **AGENT: the commits are the intended ones.** Railway builds from GitHub `main`. Check `git status` and
   `git log origin/main..main`. Push only when Davin asks; pushing is deploying.
2. **AGENT: the pins say the Node major you expect.** `engines.node` in each service's `package.json`
   is `24.x` (since 2026-10-31, commit `cf830f3a`). Nixpacks maps the range to a **major only**, so the
   patch comes from the nixpkgs snapshot compiled into Nixpacks and the repository cannot force it.
3. **DAVIN (gate): no Railway variable overrides the Node version.** In each service's Variables, look for
   `NIXPACKS_NODE_VERSION` or `RAILPACK_NODE_VERSION`. A value there beats `engines` and keeps the
   service on the old major. Delete it or set it to `24`.
4. **DAVIN (gate): which services may deploy with this push.** Ask whether any service must be held back,
   `money-service` above all. Nothing enforces item 6 today: it holds only if Davin holds that service's
   deployments in Railway before the push (service settings such as watch paths, wait for CI or automatic
   deployments; which of these the plan offers was not checked). Do not push a change to `money-service`
   until he has answered.
5. **AGENT: the services build on the target Node.** `npm run build` in the service folder (`nest build`)
   and its tests pass on Node 24 locally. Verification commands: the
   [verification checklist](../../.claude/protocols/verification-checklist.md).
6. **DAVIN (gate): approval for `money-service`.** It handles payments (Stripe, dLocal). A runtime change
   there needs Davin's explicit sign-off **before the push**; the general approval of a task does not cover it.
7. **DAVIN (gate): the production database matches the code.** If the push carries a Prisma migration, or
   code that reads a column or table added since production was last verified, Davin applies the migration
   to production first and confirms `prisma migrate status` is clean, using `prisma.production.config.ts`
   (see [database-traps](../../.claude/architecture/database-traps.md); the agent never applies production
   migrations). The CI job _Check Production Migration Status_ normally shows this, but it has failed with
   `P1000` since 2026-09-09, so it shows nothing until its secret is fixed.
8. **DAVIN (gate): the outbox publisher.** For about a minute after a push the services run different
   versions. `operation-service` skips, without retrying, an outbox event it cannot read (an event type it
   does not know, or `TIER_UPGRADED` / `PAYMENT_FAILED` with no `priceUsd`), so the matching e-mail is lost.
   If the push changes event types or payloads, ask whether `OUTBOX_PUBLISHER_ENABLED` is `true` on
   `money-service` and, if so, whether to switch it off until all three services are Active. Whether it is
   enabled in production was not checked (waiting-on, 2026-10-20).

## B. After the push (the deploy happens by itself)

The three services build in parallel, so the order is not yours to choose unless Davin has held some of
them. Where order matters (a migration, a cross-service event), the order written for that change in
[infrastructure.md](../../.claude/architecture/infrastructure.md) wins, and it needs Davin to hold the later
services until the earlier one is Active. Every push redeploys all three, docs-only pushes included, so
batch small commits into one push where you can.

For each service:

1. **AGENT (from a pasted log):** the build log prints the Node version. Read `node -v` or the setup line
   and confirm the major is 24. Record the exact version in the session report.
2. **AGENT (from a pasted log, a URL or the commit statuses above):** the deployment reaches Active and the
   health check passes.
3. **`railway-gateway` only, AGENT (from a pasted log):** the install phase creates `/opt/venv` with
   Python 3.11 and pip installs `python-requirements.txt` without compiling (`--only-binary`). If the
   venv step fails, the build fails and the previous deployment keeps running.
4. **`money-service` only, DAVIN:** push at low traffic. Afterwards watch the logs for one or two real
   Stripe and dLocal webhook deliveries (2xx, no 5xx, no retries piling up) before calling it done.

## C. If something goes wrong

- **Fastest:** in Railway, open the previous deployment of that service and use Redeploy. This restores
  the old image, including its old Node major, without a code change. DAVIN does this. While deploys run
  on every push, the next push puts the newer code back, so hold that service first.
- **Code rollback:** `git revert <commit>` is a new commit and deploys like any other push. For example
  `git revert cf830f3a` puts `engines.node` back to `22.x` for the three services (and the monolith,
  frontend and CI pins with it).
- After a rollback, record the failing log lines in the session report so the next attempt starts from
  evidence.

## After the deploy

- Update the open item in [waiting-on.md](../../.claude/state/waiting-on.md) (Node 24 rollout): which
  services run which exact version, and what is still open. Move it to
  `history/resolved-waiting-on.md` only when all three services are verified.
- Do not write the narrative of the deploy into `CLAUDE.md` or `AGENTS.md`.
