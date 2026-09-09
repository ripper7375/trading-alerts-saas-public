# Runbook — Rotating the Production Postgres Password

**Scope:** the `postgres` superuser password on the `trading-alerts` Railway project's
`Postgres` service.
**Written:** 2026-09-09, immediately after performing it, so the gotchas below are the ones that
actually bit rather than the ones that seemed likely beforehand.
**Time:** ~20 minutes. **Expect a 2–5 minute window** where database-backed pages error.

---

## 0. Know what you are touching

There are **three** different database passwords in this project. Rotating one does not
affect the others:

| Password                                | Used by                                                                  | In pgbouncer userlist? |
| --------------------------------------- | ------------------------------------------------------------------------ | ---------------------- |
| `PGPASSWORD` (the `postgres` superuser) | railway-gateway, operation-service, operation-service-worker, **Vercel** | **no**                 |
| `CORE_APP_DB_PASSWORD` (`core_app`)     | provisioned, apparently unused                                           | yes                    |
| `MONEY_SVC_DB_PASSWORD` (`money_svc`)   | money-service, via pgbouncer                                             | yes                    |

**This runbook covers the first row only.** Because `postgres` is _not_ in the pgbouncer
userlist, rotating it does **not** require regenerating `PGBOUNCER_USERLIST_B64` and does
**not** affect `money-service`. Confirm that still holds before starting — the userlist's
usernames are plaintext inside the base64, so you can list them without exposing any hash.

Rotating `core_app` or `money_svc` is a **different and harder** operation: those _are_ in the
userlist, so the userlist must be regenerated in the same change or pgbouncer stops
authenticating and every service behind it fails.

---

## 1. Prerequisite: make services follow Postgres

Do this **before** rotating, ideally days before. It is safe and causes no downtime.

Every service that talks to Postgres should hold a **reference**, not a copy:

```
DATABASE_URL = ${{Postgres.DATABASE_URL}}
```

not

```
DATABASE_URL = postgresql://postgres:<password>@postgres.railway.internal:5432/railway
```

As of 2026-09-09 `railway-gateway`, `operation-service` and `operation-service-worker` are all
on references. `money-service` deliberately keeps its own literal — different user.

Change one service at a time and confirm it comes back Online before the next. The value a
reference resolves to is identical to the literal it replaces, so this is functionally a no-op —
but a typo in the service name resolves to empty and the service fails to connect on boot.

**Vercel can never be a reference.** It runs outside Railway and always needs the value pasted
by hand.

---

## 2. Generate the new password

In **your own terminal**, never in a shared console or chat:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

`base64url` deliberately: no `+`, `/` or `=`, so it needs no URL-encoding inside a connection
string. Save it to a password manager **before** you change anything.

---

## 3. Change the password

Railway → `trading-alerts` → **Postgres → Console**. You land at a container shell
(`root@...:/#`), not psql.

```bash
bind 'set enable-bracketed-paste off'
```

**Do this first.** The Railway web console does not strip bracketed-paste markers, so pasted
text arrives wrapped in `^[[200~` … `~` and the command fails in a confusing way. Worse, that
mangling inside a _hidden_ password prompt would silently set a password containing junk you
cannot see.

Then:

```bash
psql -U postgres -d railway
railway=# \password postgres
```

`\password` prompts twice with hidden input, so the password never appears on screen, in shell
history, or in a screenshot. **Use it — do not use `ALTER USER ... WITH PASSWORD '...'`**, which
puts the secret in plain view.

If the two entries disagree it says `Passwords didn't match` and changes nothing — just run
`\password postgres` again. Paste from the clipboard both times; typing one of them by hand is
the usual cause of a mismatch.

Then `\q`.

### Verify before going further

```bash
psql -U postgres -d railway -W
```

`-W` forces a hidden prompt and ignores the now-stale `PGPASSWORD` in the container's
environment. Reaching `railway=#` proves the password is what you think it is. `\q`.

Do not skip this. The password went in blind, twice, and every remaining step depends on
knowing it exactly.

### If you get locked out

`psql` in that console connects over **TCP** and reads `PGPASSWORD` from the container's
environment — which is stale the moment you change the password and before you update the
variables. Supply the current one explicitly:

```bash
PGPASSWORD='<the password that is actually live>' psql -U postgres -d railway
```

---

## 4. Update the Postgres service variables

Railway → **Postgres → Variables** (the Raw Editor edits all four in one save):

```
PGPASSWORD          = <new>
POSTGRES_PASSWORD   = <new>
DATABASE_URL        = postgresql://postgres:<new>@postgres.railway.internal:5432/railway
DATABASE_PUBLIC_URL = postgresql://postgres:<new>@maglev.proxy.rlwy.net:58290/railway
```

The two URLs differ **only** in host and port — internal for services inside Railway, the public
TCP proxy for anything outside it. Confirm both in the dashboard rather than trusting these
values: Railway proxy hostnames and ports can change, and the hostnames are **shared across many
services**, so the port is what identifies yours.

> Editing `PGPASSWORD`/`POSTGRES_PASSWORD` does **not** change the database password. The Postgres
> image reads those only on first initialisation. Step 3 is what actually changes it; this step
> just stops the variables lying about it.

---

## 5. Redeploy the referencing services — they do NOT restart on their own

**This is the step that is easy to miss, and it caused the only real outage during the
2026-09-09 rotation.**

Changing a variable on `Postgres` does **not** restart the services that reference it. Their
containers keep running with the old value injected at boot, so they carry on until their
connections cycle and then fail with:

```
password authentication failed for user "postgres"
```

Redeploy each one — Deployments → ⋮ → **Redeploy**, or:

```bash
railway redeploy --service railway-gateway --yes
```

for `railway-gateway`, `operation-service`, `operation-service-worker`.

**How to tell it worked:** the health endpoint's `uptime` resets to single digits. A service still
reporting a large uptime has not restarted, whatever its status says.

---

## 6. Vercel

Vercel → project → **Settings → Environment Variables**. Update **both**:

```
DATABASE_URL = postgresql://postgres:<new>@maglev.proxy.rlwy.net:58290/railway
DIRECT_URL   = postgresql://postgres:<new>@maglev.proxy.rlwy.net:58290/railway
```

- Use the **public** host. `postgres.railway.internal` never resolves from Vercel.
- Both variables: `DIRECT_URL` is what `prisma.config.ts` uses for migrations, `DATABASE_URL` is
  the runtime path.
- **Then redeploy.** Saving the values alone changes nothing for the running deployment.
- These are marked Sensitive, so `vercel env pull` returns `[SENSITIVE]` placeholders
  permanently. Dashboard only, by hand.
- Leave the environment **scope** alone during a rotation. Narrowing `DATABASE_URL` from
  All Environments to Production would break preview deployments — a separate change with its
  own blast radius.

---

## 7. Verify

```bash
curl -s https://railway-gateway-production-3796.up.railway.app/api/v1/health
curl -s https://operation-service-production.up.railway.app/health
railway logs --service operation-service-worker --deployment --lines 30
curl -sL -o /dev/null -w "%{http_code}\n" https://davintrade.app/affiliate/leaderboard
```

What good looks like:

- both health endpoints `healthy` with `database: up` **and a low uptime**
- worker logs show `watches loaded: N rows` — a real query — and no `AuthenticationFailed`
- **`/affiliate/leaderboard` returns 200.** This is the best single signal for the Vercel half:
  it queries Prisma on every request. `/` and `/academy` can return 200 from cache while the
  database is unreachable, so they prove nothing.

Finally, delete any local `.env.production.local` — it holds a live credential.

---

## Gotchas, ranked by how much time they cost on 2026-09-09

1. **Services do not auto-restart on a referenced-variable change** (§5). Cost: a real outage —
   three services with `database: down` until redeployed.
2. **The Railway console mangles pasted text** (§3). Cost: two failed commands and a confusing
   `not a valid URL`-class error.
3. **`psql` in that console reads a stale `PGPASSWORD`** mid-rotation (§3), so the obvious
   `psql -c "ALTER USER ..."` fails with an authentication error that looks alarming and is
   harmless.
4. **A placeholder in an instruction can be executed literally.** The password was briefly set to
   the literal string `NEW` because a runbook-style command used `'NEW'` as a stand-in. Write
   placeholders that _cannot_ be run by accident — `'PASTE_YOUR_PASSWORD_HERE'` — or better, use
   `\password`, which has no placeholder at all.
5. **Any redeploy can surface an unrelated latent build failure.** The same day, `railway-gateway`
   turned out to be unable to build at all (`NODE_ENV=production` stripping the devDependencies
   its TypeScript build needed). It had been broken for hours behind a warm cache. **Confirm the
   services can deploy successfully before you rotate** — otherwise they cannot pick up the new
   password.
