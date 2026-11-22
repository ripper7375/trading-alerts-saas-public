# Runbook: Security incident playbooks

**Scope:** what to do, in the first 30 minutes and after, when the private security pipeline or a person raises one of seven kinds of incident.
**Written:** 2026-11-22 (Phase 4 of the security monitoring architecture, v3.0, section 8).
**For:** Davin (owner and approver) and the Executor (Claude Code).
**Privacy:** this file is public. It names no address, port, token or advisory. Infrastructure appears only by alias: `<PROD_DB>`, `<PROD_REDIS>`, `<STAGING_DB>`, `<STAGING_REDIS>`, `<CHAT_VPS_IP>`, `<MT5_VPS_IP>` (non-negotiable 9). The details of an incident go to the gitignored folder named below, never here, never into an issue, a PR or a CI log.

---

## How to use this runbook

The private sweep (`node scripts\security\run-security-pipeline.mjs --with-dependabot --with-posture --with-behaviour`) alerts on LINE with counts and a priority only. The alert says what kind of thing happened; this runbook says what to do. Find the trigger in the table, open its playbook, and work the first 30 minutes in order.

| What raised it                                                                                | Rule or signal | Playbook                                                                                      |
| :-------------------------------------------------------------------------------------------- | :------------- | :-------------------------------------------------------------------------------------------- |
| A secret exposed: a push-protection bypass, a secret-scanning alert, a token in a log         | R-3            | [PB-1](#pb-1-secret-exposure)                                                                 |
| `Malicious-package record`, or an exploitable advisory in a runtime dependency                | R-3, R-5, R-6  | [PB-2](#pb-2-exploitable-dependency-or-malicious-package)                                     |
| `Live posture breach` for an unexpected public endpoint on Postgres, Redis or PgBouncer       | R-9            | [PB-3](#pb-3-exposed-data-store)                                                              |
| `Behaviour signal breach` on a webhook route                                                  | BS-1           | [PB-4](#pb-4-webhook-or-payment-anomaly)                                                      |
| `Behaviour signal breach` for a commit on `main` that did not come from a merged pull request | BS-6           | [PB-5](#pb-5-suspicious-change-on-main)                                                       |
| `Live posture breach` for a DNS record or a certificate nobody expected                       | R-9            | [PB-6](#pb-6-dns-or-certificate-anomaly)                                                      |
| `check-vps-drift.sh` fails, or something answers where pgAdmin should not exist, on a VPS     | none           | [PB-7](#pb-7-vps-compromise-suspected)                                                        |
| `Behaviour signal breach` for failed logins, the 5xx or 429 rate, the LLM spend or the queue  | BS-2 to BS-5   | [Behaviour signals without their own playbook](#behaviour-signals-without-their-own-playbook) |

**Who does what.** The pipeline proposes; Davin decides. Davin revokes and rotates credentials, merges, deploys, and approves every Rule 5 change (money, auth, secrets, CORS). The Executor reads, drafts the steps and writes the `fix(security): ...` pull request; it never enters a credential, deploys or applies a production migration.

**The order inside the first 30 minutes.** Stop the harm, then find the scope, then clean up. A deleted commit or a closed alert is not a fix.

---

## Standing rules for every incident

1. **A dated private note.** Write `davintrade-security-monitoring-pipeline/reports/incidents/YYYY-MM-DD-<short-slug>.md` (gitignored). It holds what was seen and by whom, the playbook used, each action with its time, the secrets rotated (by name, never by value), whether money was touched, and what to change so the next one is caught earlier. Names, addresses and identifiers belong there and nowhere public.
2. **A one-line, counts-only entry in `.claude/state/waiting-on.md`** while the incident is open, for example: `Security incident 2026-11-22 (PB-4): OPEN (Davin). 1 webhook route paused, 0 secrets rotated, reconciliation pending.` No route names, no addresses, no identifiers. Move it to `history/resolved-waiting-on.md` when it is closed.
3. **Evidence first.** Do not delete the commit, the log line or the alert before it is copied into the private note.
4. **Public surfaces stay clean.** A pull request, an issue, a commit message and a CI log carry counts only.
5. **Close the loop.** Every incident ends with one question: which gate or check would have caught this earlier? Add it to the pipeline (a rule, a probe, a test) in a follow-up PR.
6. **Rehearse.** Once a year run the tabletop exercise, and every quarter the Postgres restore drill (both at the end of this file).

---

## PB-1: Secret exposure

**Triggers:** R-3 (secret exposure confirmed); the LINE alert `Secret scanning breach` (the sweep reads the open GitHub secret-scanning alerts, one per alert; the alert carries a count only, so the detail is in the repository's Security tab); a push-protection bypass; a token or key in a log, an artifact or a pull request.
**Threat:** T2. **Clock:** P0, less than 4 hours (rotate or remove first). **Owner:** Davin for credentials; the Executor drafts the steps.

### First 30 minutes

1. **Scope it without copying it.** Which provider issued it, where it appeared (a commit, a log, an artifact, a message), and since when. Never paste the secret into chat, a ticket or a note.
2. **Revoke and rotate at the provider first.** Money and authentication first (the payment providers, the signing secrets, `NEXTAUTH_SECRET` only if forged sessions are suspected), then the platform tokens (GitHub, Railway, Vercel), then the rest (e-mail, storage, LLM keys, the LINE channel token).
3. **Update every copy.** Railway and Vercel variables (a variable that is a reference follows the source; a copy does not), the GitHub Actions secrets, and local `.env*` files. The database password has four copies: use [rotate-postgres-credentials.md](rotate-postgres-credentials.md) for it, and do not forget the Actions copy.
4. **Redeploy what reads it** and check the live service answers (Vercel redeploy; each Railway service; services that deploy by hand need the hand).
5. **Look for use.** At the provider, read the usage or event log for the whole window between the exposure and the revocation: unknown IP addresses, unusual calls, anything that moved money or data. Record counts only.

### Then

6. **History clean-up comes last.** The secret is already burned: removing it from Git history does not un-expose it. Do it only to stop a scanner from re-alerting, and never as a replacement for step 2.
7. **Close the alert** in GitHub secret scanning as revoked, only after step 2 is done and checked.
8. If the window shows use of the secret, treat the incident as the playbook of what it reached (for example [PB-3](#pb-3-exposed-data-store) for a database credential, [PB-4](#pb-4-webhook-or-payment-anomaly) for a payment key).

### Do not

- Force-push or delete the commit to "make it go away".
- Keep using the old value "until the weekend".

---

## PB-2: Exploitable dependency or malicious package

**Triggers:** R-3 (a `MAL-` record on any lockfile); R-5 (a runtime package in CISA KEV, or EPSS of 0.10 or more, on a tier 1 or 2 asset); R-6 (a critical RCE, auth bypass or SQL injection on a tier 1 asset).
**Threat:** T4, T5. **Clock:** R-3 less than 4 hours; R-5 and R-6 less than 24 hours (R-6 is a Rule 5 escalation). **Owner:** the Executor writes the pull request; Davin merges and deploys.

### First 30 minutes

1. **Confirm reachability.** Which asset, which lockfile, runtime or build-only, which exposure tier. The private report (`reports/latest-security-posture.md`) has the details; the alert has none.
2. **A `MAL-` hit is P0 whatever the scope.** A malicious install script runs at build time, so assume every secret the build or a developer machine could read is exposed, and start [PB-1](#pb-1-secret-exposure) for them. Do not run `pnpm install` or `npm ci` on a machine until the version is removed.
3. **Mitigate now, fix properly next.** A feature flag, a Vercel Firewall or rate-limit rule, or taking the route offline. For a `MAL-` package: pin the previous version or remove the package.
4. **Rule 5.** When the asset handles money, grants, secrets or auth, Davin approves the mitigation and the fix before anything changes.

### Then

5. **A dedicated `fix(security): ...` pull request** on `main` (see `.claude/rules/security-overrides.md`): dependency and VEX changes are never made on a feature branch. A change to `overrides`, `pnpm.auditConfig` or `security/**` needs the `security-override` label (close and reopen the pull request once if the label was added after it opened, so the check sees it).
6. **Merge, deploy, verify the live runtime.** A merged fix is not a deployed fix. Read the deployed commit and the runtime patch level, update `reports/runtime-state.json`, and run the sweep again: the finding must be gone.
7. If a VEX statement is the right answer (the code path is not reachable), it goes into the private overlay first and is reviewed; it never silences a `MAL-` record.

### Do not

- Edit overrides on a feature branch, or add the advisory to the ignore list to turn the gate green.
- Stop at the merge: the clock runs until the fix is live.

---

## PB-3: Exposed data store

**Triggers:** R-9 for a public endpoint on `<PROD_DB>`, `<PROD_REDIS>` or the PgBouncer service that is not in the expected list of `security/security-inventory.yaml`.
**Threat:** T3. **Clock:** P1, less than 72 hours to remove or justify; start the same day. **Owner:** Davin.

The two existing TCP proxies on `<PROD_DB>` and `<PROD_REDIS>` are expected (owner decision of 2026-11-21: current consumers need them). R-9 is about any other proxy or domain on a data store.

### First 30 minutes

1. **Identify the endpoint** in the Railway dashboard: which service, which proxy or domain, when it was created and by whom. Keep the address in the private note only.
2. **Remove it, or restrict it,** unless a named need exists. If a person created it on purpose, ask why and write the answer into the inventory in a `security-override` pull request, with a removal date.
3. **Rotate the credentials of the exposed store** whether or not anyone connected: [rotate-postgres-credentials.md](rotate-postgres-credentials.md) for Postgres (mind the PgBouncer user list for the other two roles), and the Redis password and every service that holds it.

### Then

4. **Inspect.** Postgres: the roles that exist, the current and recent connections (application name, client address), and changes to the sensitive tables (users, subscriptions, grants, the money ledger). Redis: the connected clients, the command statistics, and the queues and sessions it holds.
5. **Unexplained access** means [PB-1](#pb-1-secret-exposure) for every secret that lives in that store, and a Rule 5 decision by Davin on users and money. If integrity is in doubt, restore from the last good backup into a scratch database first and compare (see the restore drill).
6. Re-run the sweep: the endpoint must be gone from the expected-versus-actual diff.

### Do not

- Remove one of the two expected proxies as part of this playbook: its consumers (the Vercel app, the migration check, laptop tooling) would break. That is a separate, explicit decision.

---

## PB-4: Webhook or payment anomaly

**Triggers:** BS-1 (any 5xx, or more than 5 signature failures an hour, on a provider webhook route of `money-service` or the monolith); a difference between the provider dashboard and the ledger; the webhook watch of runbook B.4.
**Threat:** T6. **Clock:** P1, less than 72 hours, but look the same day. **Owner:** Davin (Rule 5: money).

### First 30 minutes

1. **Read what the sweep saw** in `reports/latest-behaviour-signals.md`: which route, how many 5xx, how many signature failures, over which window.
2. **Compare with the provider dashboard** (the payment providers show delivered, failed and retried webhooks and recent events): are the failures the provider's own deliveries, or requests the provider never sent?
3. **Decide which case it is.**
   - _5xx only:_ a fault in the service. Read the service log for the route, confirm the handler is idempotent, and let the provider retry. No data change.
   - _Signature failures right after a secret was rotated:_ a mismatch between the provider's signing secret and the service's. Fix the configuration.
   - _Signature failures from an unknown source:_ forged traffic. Go to step 4.
4. **If forgery is confirmed (Davin decides):** pause the route, or rotate the webhook signing secret at the provider and in the service (the steps of [PB-1](#pb-1-secret-exposure)), then watch the next deliveries.

### Then

5. **Reconcile the ledger** against the provider: payments, subscriptions, grants and commissions that exist on one side only. Correct only what Davin approves, one decision at a time; never grant or revoke access by hand to "fix" a count.
6. Record counts only (routes, failures, payments compared, differences found).

### Do not

- Re-send or replay webhooks to see what happens.
- Disable signature verification, even briefly.

---

## PB-5: Suspicious change on main

**Triggers:** BS-6 (a commit on the first-parent line of `main` that did not arrive through a merged pull request).
**Threat:** T1. **Clock:** P1, less than 72 hours; look the same day. **Owner:** Davin.

A direct push is a finding even when it is yours: the point is that you decide it was fine, then acknowledge it.

### First 30 minutes

1. **Look at the commit** (`reports/latest-behaviour-signals.md` names it): author, committer, files changed, time, and whether the message claims a pull request that does not exist. Was it you, or an agent working for you?
2. **If it is explained and fine,** acknowledge it: add its hash (seven or more characters) to `acknowledged_shas` in `davintrade-security-monitoring-pipeline/behaviour-settings.json`, or move the baseline forward. The finding then clears on the next sweep.
3. **If it is not explained, freeze deploys** first: pause automatic deploys on Vercel and Railway, because the push may already be building.
4. **Revert through a pull request.** Branch, `git revert`, pull request, merge. A force-push is blocked by the ruleset on purpose.

### Then

5. **Rotate whatever pushed.** The token, key or app that made the push (a personal access token, an SSH key, a deploy key, a GitHub App or an Actions token). Read the GitHub audit log and the security log for the actor, and the list of authorised apps and deploy keys.
6. **Review what deployed from that commit** (the Vercel deployments and the Railway deployments built from it). If it reached production, treat every secret that code could read as exposed ([PB-1](#pb-1-secret-exposure)).
7. **Raise ruleset Stage 2 again** (a pull request and the required checks before merge) with Davin: this playbook is the case for it.

### Know the limit

A baseline set by time can be missed by a commit that carries a forged, old date. For a stronger check set `baseline_sha` (a commit you have verified) in `behaviour-settings.json`: everything after it on the first-parent line is examined whatever its dates say.

---

## PB-6: DNS or certificate anomaly

**Triggers:** R-9 for a DNS record that resolves where nothing should (for example a record for a paused asset), or a certificate for one of our names that nobody ordered (a Certificate Transparency diff).
**Threat:** T9. **Clock:** P1, less than 72 hours. **Owner:** Davin.

### First 30 minutes

1. **Identify it** in the private note: the name, the record type and target, and for a certificate the issuer and serial from the Certificate Transparency log.
2. **A dangling or unexpected record:** remove it at the DNS provider. When infrastructure is paused its records go too (the chat API record was removed on 2026-11-21 while the chat VPS is paused). Also remove the name from any platform that could claim it (Vercel, Railway), so nobody else can.
3. **A certificate we did not order:** revoke it through its issuer, and check that a CAA record limits who may issue for our names. Add one if there is none.

### Then

4. **Check for phishing or takeover:** does the name serve anything, to whom, since when? If it served content, treat the incident as a possible takeover and look for cookies scoped to the parent domain.
5. Re-run the posture sweep: the DNS guard and the TLS check must both pass.

---

## PB-7: VPS compromise suspected

**Triggers:** `scripts/security/check-vps-drift.sh` fails on the chat VPS (`<CHAT_VPS_IP>`) before traffic is switched on or at any later check; a hit for pgAdmin or another database console on `<CHAT_VPS_IP>` or `<MT5_VPS_IP>`; unexplained listening ports or containers.
**Threat:** T10. **Clock:** act the same day. **Owner:** Davin.

### First 30 minutes

1. **Stop traffic by DNS,** not by logging in and stopping things: remove the record that points at the host. Keep the host itself, because it is the evidence.
2. **Take a forensic snapshot** of the whole host at the VPS provider before anything is changed or rebuilt.
3. **Treat everything that lived on the host as exposed:** the secrets in its files and containers, the keys it held, and any tokens it used. Start [PB-1](#pb-1-secret-exposure) for each.

### Then

4. **Rebuild clean from `main`** with [the post-snapshot rebuild runbook](../../davintrade-webchat-stack/POST-SNAPSHOT-CHAT-VPS-REBUILD-RUNBOOK.md) (the Compose files and the Dockerfiles come from `main`, not from the old host).
5. **Run the drift check before any traffic:** `check-vps-drift.sh` is section 5.0 of the same rebuild runbook, and the restore gate named in `security/security-inventory.yaml`. "No traffic before checks."
6. **Re-snapshot only after the checks pass,** so the new snapshot is the clean one.
7. For the MT5 host (`<MT5_VPS_IP>`), which is handled by hand, the same order applies: stop what reaches the outside world, snapshot, rotate what it held, rebuild.

### Do not

- Restore the old snapshot and switch traffic on: the snapshot of 2026-09-10 is the reason the drift check exists.

---

## Behaviour signals without their own playbook

The architecture has seven playbooks. These four signals have a response in its threat table but no playbook of their own yet. Each is a candidate for the next tabletop exercise; until then:

### BS-2: failed logins, resets and 2FA failures (T7)

More than 20 failures an hour from one address bucket, or more than 5 for one account. **Rule 5: Davin decides.**

1. Lock the account or force re-authentication for the accounts named in the private report. Block or rate-limit the source (Vercel Firewall rules).
2. Check the reset and 2FA flows for the same window: were any completed?
3. Rotate `NEXTAUTH_SECRET` only if forged sessions are suspected. It signs everyone out, so it is a Rule 5 decision.

### BS-3: the 5xx and 429 rate (T8)

5xx above 1 % (P1) or 429 above 5 % (P2) of the requests of a 15 minute window.

1. Find the route that fails or is throttled in the platform logs. Tighten the limits, block the sources, or pause the feature behind its flag.
2. A 5xx rate after a deploy is a regression: roll back first, investigate second.

### BS-4: LLM spend and request count (T8)

More than twice the median of the last 7 days.

1. Read the provider dashboard: who or what is calling, and from where.
2. Pause the feature or cap it. If a key may have leaked, rotate it ([PB-1](#pb-1-secret-exposure)).

### BS-5: queue failed or waiting jobs (T8, T10)

`failed` above zero for 15 minutes or more (P1), or `waiting` growing for 15 minutes or more (P2).

1. Read the gateway log for why the jobs fail. A failed job stays in the queue until it is removed, so after the cause is fixed, clear the failed jobs, or the signal stays red.
2. If the jobs come from the Stack C VPS and the host looks wrong, go to [PB-7](#pb-7-vps-compromise-suspected).

---

## Annual tabletop exercise

**When:** once a year, in November. The first ran on 2026-11-22; the next is due by 2027-11-22.

1. Run the automated rehearsal. It builds two synthetic scenarios in memory (it reads no live system and does not touch the alert state), checks that the scoring engine gives the exact tier and rule, that the LINE message is counts only, and that every alert maps to a section of this file, then writes a dated private report:

   ```powershell
   node scripts\security\run-tabletop-drill.mjs
   ```

   The report is `davintrade-security-monitoring-pipeline/reports/incidents/YYYY-MM-DD-tabletop-exercise-report.md`.

2. Then walk the two scenarios out loud with the owner: who would do each step, what is missing, how long each would really take. Write the gaps into the report's last section.
3. Turn each gap into a follow-up: a rule, a probe, a test or a line in this runbook.

The two scenarios: **A** a secret exposure and a malicious package (PB-1 and PB-2, rule R-3, under 4 hours); **B** an unexpected data-store endpoint and a webhook signature spike (PB-3 and PB-4, rule R-9 and signal BS-1).

---

## Quarterly Postgres restore drill

**When:** every quarter (February, May, August and November). The first is due by 2027-02-22. A backup that has never been restored is not a backup.

- [ ] **Pick the backup:** the provider's latest automatic backup, or a fresh dump taken from `<PROD_DB>` with the provider's own tool.
- [ ] **Restore into a scratch database** that is not `<PROD_DB>`: a throwaway local container or a new scratch service. Never restore over production.
- [ ] **Time it.** Note the start and the end: that is the recovery time you can count on.
- [ ] **Check it:** the latest migration is present; the row counts of the main tables are close to production; a few real queries answer (a login lookup, an active subscription, the last ledger entry).
- [ ] **Check what a restore does not carry:** roles, extensions, sequences, and the PgBouncer user list (it lives outside the database).
- [ ] **Record counts only** in `davintrade-security-monitoring-pipeline/reports/incidents/YYYY-MM-DD-restore-drill.md`: tables checked, minutes taken, pass or fail.
- [ ] **Destroy the scratch database.**
- [ ] **If a step failed,** add a counts-only line to `.claude/state/waiting-on.md` and fix the cause before the next quarter.
