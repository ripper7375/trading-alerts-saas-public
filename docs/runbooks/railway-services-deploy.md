# Runbook — Deploying the Railway services (money, operation, gateway)

**Applies to:** `money-service`, `operation-service`, `railway-gateway` (Railway project `trading-alerts`,
Nixpacks builder, GitHub source on `main`). **Owner:** Davin (dashboard, approvals) / the agent that is
deploying (everything it can verify from the repository and from build logs).

Read this before any deploy, or before drafting a deploy prompt or walkthrough, for any of the three
services. The monolith (Vercel) and the VPS pipeline have their own runbooks; see
[infrastructure.md](../../.claude/architecture/infrastructure.md).

## Who does what

| Marker           | Meaning                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **AGENT**        | The agent can do and verify this from the repository, the git history or a pasted build log.                                         |
| **DAVIN (gate)** | Needs the Railway dashboard or an approval. The agent cannot see it: **stop, ask, and wait for the answer.** Never assume it passed. |

An agent that cannot reach the Railway dashboard must not report a DAVIN step as done. It asks Davin to
paste what the dashboard shows.

## A. Before the deploy

1. **AGENT: the commits are on the branch Railway deploys.** Railway builds from GitHub `main`. Check
   `git status`, `git log origin/main..main` and that the intended commits are pushed (push only when
   Davin asks).
2. **AGENT: the pins say the Node major you expect.** `engines.node` in each service's `package.json`
   is `24.x` (since 2026-10-31, commit `cf830f3a`). Nixpacks maps the range to a **major only**, so the
   patch comes from the nixpkgs snapshot compiled into Nixpacks and the repository cannot force it.
3. **DAVIN (gate): no Railway variable overrides the Node version.** In each service's Variables, look for
   `NIXPACKS_NODE_VERSION` or `RAILPACK_NODE_VERSION`. A value there beats `engines` and keeps the
   service on the old major. Delete it or set it to `24`.
4. **DAVIN (gate): Railway deploys may be paused.** Davin paused them on 2026-10-22; confirm they are
   resumed before expecting a build.
5. **AGENT: the services build on the target Node.** `npm run build` in the service folder (`nest build`)
   and its tests pass on Node 24 locally. Verification commands: the
   [verification checklist](../../.claude/protocols/verification-checklist.md).
6. **DAVIN (gate): approval for `money-service`.** It handles payments (Stripe, dLocal). A runtime change
   there needs Davin's explicit sign-off; the general approval of a task does not cover it.

## B. During the deploy

One service at a time, lowest risk first: **`operation-service` -> `railway-gateway` -> `money-service`**.
Exception: a change that ships with a migration or a cross-service event follows the order written in
[infrastructure.md](../../.claude/architecture/infrastructure.md) (for example the Manage Subscription
orders) and that order wins.

For each service:

1. **AGENT (from a pasted log):** the build log prints the Node version. Read `node -v` or the setup line
   and confirm the major is 24. Record the exact version in the session report.
2. **AGENT (from a pasted log or a URL):** the deployment reaches Active and the health check passes.
   Do not start the next service until it does.
3. **`railway-gateway` only, AGENT (from a pasted log):** the install phase creates `/opt/venv` with
   Python 3.11 and pip installs `python-requirements.txt` without compiling (`--only-binary`). If the
   venv step fails, the build fails and the previous deployment keeps running.
4. **`money-service` only, DAVIN:** deploy at low traffic. Afterwards watch the logs for one or two real
   Stripe and dLocal webhook deliveries (2xx, no 5xx, no retries piling up) before calling it done.

## C. If something goes wrong

- **Fastest:** in Railway, open the previous deployment of that service and use Redeploy. This restores
  the old image, including its old Node major, without a code change. DAVIN does this.
- **Code rollback:** `git revert cf830f3a` puts `engines.node` back to `22.x` for the three services (and
  the monolith, frontend and CI pins with it). A revert is a new commit and deploys like any other change.
- After a rollback, record the failing log lines in the session report so the next attempt starts from
  evidence.

## After the deploy

- Update the open item in [waiting-on.md](../../.claude/state/waiting-on.md) (Node 24 rollout): which
  services run which exact version, and what is still open. Move it to
  `history/resolved-waiting-on.md` only when all three services are verified.
- Do not write the narrative of the deploy into `CLAUDE.md` or `AGENTS.md`.
