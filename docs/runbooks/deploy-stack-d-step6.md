# Runbook — Deploying build step 6 (intake, routing and knowledge, chapter 4)

**Scope:** the Railway `knowledge-service`, the seven environment variables of the monolith, the labelled gate, a first live
run of the Understand model, and the two flags, with the checks after each step and how to switch it all off again.
**Written:** 2026-10-14, at the close of build step 6 (parts 1 to 10), from the part hand-offs `docs/handoffs/2026-10-1*-step6-part*.md`, the plan
`2026-10-11-step6-plan.md`, `knowledge-service/README.md`, the Dockerfile and the code.
**Who:** Davin. The Executor never deploys, enters a sign-in, sets a variable in Vercel or Railway or touches production.

## ⛔ The rule: `INTAKE_ENABLED` stays `false` in production until step 7 meters

**Do not set `INTAKE_ENABLED=true` in production, in a Vercel preview or anywhere that reaches a real user or the production database, until step 7 has
built the quota meter.** The reason is in ADR-098 D5: units do not exist yet, so the quota pre-check is a port whose default adapter says "not metered,
allow" (`passThroughQuota` in `lib/intake/server/access.ts`). With the flag on and that adapter, **any signed-in Pro trader can call the route as
often as they like, and each call can become a paid model call** (the Understand step) with nothing to stop it. The gate, the refusal and the 19 replies
are tested against a fake quota that refuses; the real one does not exist.

Two things follow:

- `INTAKE_INSTANT_PROMPTS_ENABLED` has no use before it either: with it on and `INTAKE_ENABLED` off the Market Context badges become the instant prompts, and a Pro press gets the route's 404
  and shows "The AI analyst is not available yet" below the badge. With both on, the badges call a route that has no meter. Step 7 also renders the reply, which today nothing does.
- **A Vercel preview deployment reaches the production database** (see `waiting-on.md`, "Preview deployments hit the production DB"). Do not turn either flag on
  for a preview, for the same reason.

> **Update (build step 7 part 6, 2026-10-15): the rule STANDS.** `passThroughQuota` is gone: the gate's quota is now the floor check of the quota ledger
> (`lib/reply/meter/quota-port.ts` behind `lib/intake/server/access.ts`), and it refuses every request while `PRO_MONTHLY_UNITS` is unset (fail closed). But a floor
> check only reads the balance. **Nothing yet holds units around the Understand call or settles its cost**: that is the orchestrator of part 7 (`runMetered`), so
> until it is wired a Pro trader with a balance can still cause paid Understand calls that nothing charges. The ledger tables are a migration FILE, not applied
> (`20261014010000_add_ai_metering_tables`); with the tables missing the port throws and the gate answers `FEATURE_UNAVAILABLE`, which is safe but is not metering.

> **Update (build step 7 part 7, 2026-10-15): the rule is now enforced by the code.** The one metered front door is `POST /api/chat/message` (behind `REPLY_ENABLED`),
> which holds the worst case of the whole request, Understand call included, before the call is made. `/api/intake` and `/api/intake/instant` make the Understand call with
> no hold, so they are **dev-only tools (decision D8)**: `isIntakeEnabled` is false in any production build (`NODE_ENV=production`, which includes a Vercel preview) whatever
> `INTAKE_ENABLED` says. On a developer's machine `INTAKE_ENABLED=true` still turns them on. The throwaway `/api/test/ai-metering` route is deleted.

Both flags are **set nowhere today**, and a flag is on only when its value is exactly the text `true` (`TRUE`, `1` and ` true` are off).

> **Nothing here has been run against production.** Step 6 was built and tested on fixtures, the 16 golden cycles, a scratch PostgreSQL 18 and the real txtai on
> Windows. **The Docker image has never been built**, the Understand adapter and the knowledge client have never met a real endpoint, and nothing ran on Python
> 3.11 or Linux. Where a step says "expect", that is the expectation from the tests, not an observation.

## 0. What exists, what does not

| Piece                                                                                   | State after part 10                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/intake/` (gate, pipeline, board, router, packet, text, glossary), `app/api/intake` | Built and tested. **404 for everybody unless `INTAKE_ENABLED` is exactly `true`** (set nowhere)                                                                                                                            |
| Panel C badges (`components/charts/ask-ai-button.tsx`)                                  | Built. **The top-left Market Context badges are the instant prompts only when `INTAKE_INSTANT_PROMPTS_ENABLED` is exactly `true`** (set nowhere); nothing draws a reply (step 7); `/dev/intake/instant` shows them locally |
| `knowledge-service/` (Python, txtai 9.5.0)                                              | Built and tested (`pytest`: 1004 passed, 3 xfailed). **Not deployed. The image was never built**                                                                                                                           |
| The corpus (141 chunks), the glossary, the matrix                                       | Written and **APPROVED** by Davin (eight corpus areas, the English term list, `routing-v1`)                                                                                                                                |
| The labelled question set (40 questions × 19 locales, 13 adversarial)                   | Written. The English base is signed in part 10 (see its hand-off). **The 18 translations are my drafts**                                                                                                                   |
| The recorded run `knowledge-service/labelled/runs/…`                                    | A **STAND-IN**: the hand labels answered it, no model was called. It proves the mechanism and measures nothing about the model or translation (§4)                                                                         |
| The Understand model: key, model id, cost                                               | **None exists.** No key is set; the cost of a run is unmeasured                                                                                                                                                            |
| The quota                                                                               | **Not metered** (D5): the default adapter allows everything. Step 7's                                                                                                                                                      |
| Translations: native readers for 18 languages; counsel for the ten refusal replies      | **Not done** (D14). The flags stay off until they are read                                                                                                                                                                 |
| A chat that shows a reply, `request_traces`, Section 5                                  | **Not built** (step 7 and the platform chapter)                                                                                                                                                                            |

## The order at a glance

| #   | Step                                                        | What it proves                                                                                     | Waits on                           |
| --- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------- |
| S0  | Decide what is open                                         | The labelled base is signed; you know a live run costs money; D14 has an answer                    | Your decisions                     |
| S1  | Build the image once, locally or on Railway, and measure it | The Dockerfile builds on Python 3.11 / Linux; size, memory and load time are real figures          | S0 (the gate needs the signatures) |
| S2  | Create the Railway service and its variables                | `GET /healthz` answers with a build id; `POST /search` answers with the key and refuses without it | S1                                 |
| S3  | Set the monolith's variables (everything but the two flags) | The monolith can reach the service and, later, the model; both flags are still off                 | S2                                 |
| S4  | Record a live run of the Understand model                   | The model-dependent half of 4.11 item 3 is measured; the cost is written next to the run           | A key and your go                  |
| S5  | Look at it locally with the flags on (never in production)  | A request goes through gate, board, router and retrieval and comes back as a packet                | S2 to S4                           |
| S6  | Roll back                                                   | Both flags off hides everything; the service can be removed alone                                  | —                                  |
| S7  | Before any flag goes on in production                       | Step 7 meters; the translations are read; counsel has seen the ten replies                         | Step 7, D14                        |

**Stop conditions.** Stop, change nothing further, and tell the Advisor if: the image build fails at the gate for a reason you do not understand (§1); `/healthz`
does not answer `ok` with a `kb-` build id; `POST /search` answers anything but 401 without the key; the monolith answers anything but a 404 on `/api/intake` while the flag is
off; or a variable named here is already set to something.

---

## 1. S0 and S1 — The image

**S0, decide first.**

1. **The English labelled base** (`knowledge-service/labelled/approval.json`, with `review.md` beside it). The Dockerfile's last step, `gate replay --require-approved`,
   refuses a PENDING base (`APPROVAL_PENDING`) and one changed after the signature (`APPROVAL_STALE`). Signing is a person editing `status`, `approved_by` and
   `approved_at`; the hash stays.
2. **A live run** (S4) or not yet. Until one exists the image builds on a stand-in recording, and `gate replay` says so on every run. Add `--require-live-run` to the
   Dockerfile's last step once a live run is committed: then a stand-in stops the build.
3. **D14**, who reads which of the 18 languages and when, and counsel for the ten refusal replies (`INTAKE_COUNSEL_KEYS`). Nothing in S1 to S5 needs it; S7 does.

**S1, build it once.** From `knowledge-service/` (Docker installed, network for pip and for Hugging Face):

```bash
docker build -t knowledge-service .
docker image ls knowledge-service            # SIZE: the estimate is about 1.1 GB, never measured
docker run --rm -p 8000:8000 -e KNOWLEDGE_SERVICE_KEY=local-test knowledge-service
curl http://localhost:8000/healthz           # expect {"status":"ok","index_build_id":"kb-…"}
docker stats --no-stream                     # RESIDENT MEMORY: 548 MB measured on Windows, plan 1 GB or more
```

Write the measured size, the memory after a few requests and the time from `docker run` to a healthy `/healthz` (8.9 s was measured on Windows) into the next hand-off. If the build
stops, it stops in one of four places (the Dockerfile's comment numbers them): the model fetch (network, an unauthenticated Hugging Face rate limit), `pip install` of the
pins (proved by `pip download` for the target, never by an install), the corpus gate (a PENDING area, `--require-approved`), or the labelled replay (recall under 0.80, a locale
more than 5 points under English, a stale recording, a PENDING base). **A failed gate is the gate working**: read its code, it names the cause.

A corpus or glossary change later is a rebuild: `python scripts/intake/sync_knowledge_config.py` for a changed matrix or glossary version, `gate review` for a changed corpus
file (it puts the area back to PENDING; Davin signs it again), and, when the model, the prompt, the glossary or the base set changed, a new recorded run (the fingerprint says so).

## 2. S2 — The Railway service

A **new service** `knowledge-service` (ADR-098 D3), never a sidecar in `railway-gateway`.

| Setting                 | Value                                                                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root directory          | `knowledge-service`                                                                                                                                       |
| Watch paths             | `knowledge-service/**` (so a gateway or monolith push does not rebuild a 1 GB image; `railway-gateway`'s own Watch Paths are unset and stay Davin's call) |
| Builder                 | the `Dockerfile` in that folder                                                                                                                           |
| Health check path       | `/healthz`                                                                                                                                                |
| Port                    | Railway's `PORT` (the `CMD` listens on `${PORT:-8000}`)                                                                                                   |
| Memory                  | at least 1 GB (548 MB resident on Windows with the 15-chunk test index; the corpus adds little, torch is the cost)                                        |
| Replicas                | one: the index is in the image                                                                                                                            |
| `KNOWLEDGE_SERVICE_KEY` | a long random secret, **a service variable**, shared with the monolith (§3). Unset means every `/search` is refused (401), which is safe                  |

Nothing else is set: the index and the model are in the image (`KNOWLEDGE_INDEX_DIR`, `KNOWLEDGE_MODEL_DIR` are in the Dockerfile), and nothing is downloaded at start
(`HF_HUB_OFFLINE=1`).

**Check** (replace the host):

```bash
curl https://<service>.up.railway.app/healthz
# expect {"status":"ok","index_build_id":"kb-…"}; "index_build_id": null means the index did not load
curl -i -X POST https://<service>.up.railway.app/search -H 'Content-Type: application/json' -d '{}'
# expect 401 (no key). Then, with the key and a well-formed body (knowledge-service/README.md, "The contract"), expect 200 and status OK.
```

The service answers 503 with an unavailable pack when its index cannot load, and stays up: the monolith then builds a packet with `knowledge.status = UNAVAILABLE`. Latency from
Vercel to Railway is **unmeasured** (loopback p50 was 30 ms); the 0.2 s budget of §5.11 covers snapshot plus retrieval, so measure it once before step 7 relies on it.

## 3. S3 — The monolith's variables (Vercel)

All seven are set nowhere and none is in `.env.example`. Set them in Vercel → Settings → Environment Variables, **Production only** and not Preview, and only when you are ready for S5
(a variable that is not read costs nothing, but a flag that is on does).

| Variable                         | Value                                                              | Notes                                                                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `INTAKE_ENABLED`                 | `true` or unset                                                    | **KEEP IT UNSET OR `false` IN PRODUCTION until step 7 meters (the rule above).** Exactly `true` opens `/api/intake` and `/api/intake/instant`                            |
| `INTAKE_INSTANT_PROMPTS_ENABLED` | `true` or unset                                                    | The Panel C badges are instant prompts only on exactly `true`. Read on the server by `/terminal` and `/free`. Keep it off with the line above                            |
| `KNOWLEDGE_SERVICE_URL`          | `https://<service>.up.railway.app` (https, or `http://localhost…`) | The monolith's client refuses any other URL and does not follow redirects                                                                                                |
| `KNOWLEDGE_SERVICE_KEY`          | the same secret as the service's variable                          | Travels in the header `X-Knowledge-Service-Key`, never in the URL or the body, and appears in no log                                                                     |
| `INTAKE_UNDERSTAND_API_KEY`      | an OpenRouter key                                                  | **Secret.** It appears only in the `Authorization` header. Without it the Understand step fails with `NOT_CONFIGURED` and every typed question is `UNDERSTANDING_FAILED` |
| `INTAKE_UNDERSTAND_MODEL`        | the model id, one of the 1.0× models of §5.6                       | The code holds no id; the id is yours. A different model or prompt needs a new recorded run                                                                              |
| `INTAKE_UNDERSTAND_BASE_URL`     | optional; defaults to `https://openrouter.ai/api/v1`               | https, or http on this machine                                                                                                                                           |

Redeploy after a change (Next reads the environment at start, and `/terminal` and `/free` read the flag at request time on the server).

## 4. S4 — A live run of the Understand model

This is what makes 4.11 item 3 a measurement and not only a mechanism. **It costs money and needs your go and a key.** The estimate is about 770 calls (40 questions × 19 locales, plus the
adversarial slice); the adapter reports text only, so the cost is **not** measured by the tool: read it from the provider's usage page and write it into the run's manifest by hand.

```bash
export INTAKE_UNDERSTAND_API_KEY=…   INTAKE_UNDERSTAND_MODEL=…        # in your shell only, never in a file that is committed
npx tsx --tsconfig tsconfig.json scripts/intake/eval_understand.ts --live --write
( cd knowledge-service && python -m knowledge.gate replay --index index --labelled labelled --require-approved --require-live-run )
npx jest __tests__/lib/intake/labelled-gate.test.ts --coverage=false
```

Expect: a new folder under `knowledge-service/labelled/runs/<fingerprint>/` with `LIVE` in its manifest and the model id; both halves of the gate print their numbers per locale. **Read the
numbers before you commit the run**: a locale more than 5 points under English, an out-of-scope question the model did not label, or an in-scope question refused is a finding, not a
failure to hide. If a bar fails, the deploy stops by design; the fix is in the glossary, the prompt or the model, then a new run.

## 5. S5 — Looking at it, locally

Production is not the place to look until step 7. On your machine, with the service running (S1's `docker run`, or `uvicorn` from `knowledge-service/`) and a local `.env.local`:

```
INTAKE_ENABLED=true
INTAKE_INSTANT_PROMPTS_ENABLED=true
KNOWLEDGE_SERVICE_URL=http://localhost:8000
KNOWLEDGE_SERVICE_KEY=local-test
```

Then `npm run dev`, sign in as a Pro test user whose profile is confirmed, and open `/terminal`. Expect the Market Context badge at the top left of each chart pane (`XAUUSD · M15 Market Context` above, `XAUUSD · M5 Market Context` below) and **no button at the bottom left**; a press on a badge makes **one**
`POST /api/intake/instant` with the body `{"kind":"INSTANT_M5_INSPECT"}` (lower badge) or `{"kind":"INSTANT_M15_INSPECT"}` (upper badge) and nothing else; both badges are disabled and busy while it runs, with a spinner on the pressed one; the answer is a packet (HTTP 200) that nothing
draws yet, or a refusal that appears below the badge in your interface language. As a Free trader (`/free`) a press on a badge opens the upgrade modal and makes no request.
With the flag off the badges are the older ones (Pro only). Unset the two flags afterwards. `/dev/intake` (the packet, the board and the trace on the golden cycles)
and `/dev/intake/instant` (the badges in every state and language) need none of this and call nothing.

## 6. S6 — Roll back

Unset `INTAKE_INSTANT_PROMPTS_ENABLED` and `INTAKE_ENABLED` (or set them to anything but `true`) and redeploy: the badges go back to the older ones (Pro only, a canned prompt for the chat panel) and both routes answer 404 to everybody. The service can be
stopped or deleted on its own: the monolith then builds packets with an unavailable knowledge pack, and nothing else depends on it. No migration, table or row was added by step 6.

## 7. Before any flag goes on in production

1. **Step 7 has metered the quota**, and `passThroughQuota` is replaced behind the same `QuotaPort`. This is the rule at the top.
2. **The 18 translations have a native reader each** (glossary, fixed texts, the question sets) and **counsel has seen the ten refusal replies** (D14). The reasons are Engine 4's: a safety
   text in a language nobody read is a draft.
3. A live run is committed and its numbers are inside the bars (S4); the image was built and measured (S1); the Vercel to Railway latency is measured (S2).
4. The two `routing-v2` questions the labelled set raised (no D2 playbooks for Exit / targets, D3 to D5 for Explain) have an answer from you and the Advisor (architecture §4.5).
5. Something renders the reply: Section 5 and the chat are step 7's, and the instant prompts are useless before it.

## Where things are

| What                                  | Where                                                                   |
| ------------------------------------- | ----------------------------------------------------------------------- |
| The decisions                         | `docs/adr/098-intake-routing-and-knowledge-service.md`; architecture §4 |
| The "Done when" evidence              | `docs/STACK-D-ARCHITECTURE.md` §4.11                                    |
| The service, its contract, its gate   | `knowledge-service/README.md`                                           |
| The labelled set and the recorded run | `knowledge-service/labelled/README.md`                                  |
| The flags                             | `lib/intake/server/flags.ts` (exactly the text `true`)                  |
| The step's hand-offs                  | `docs/handoffs/2026-10-1*-step6-part*.md`                               |
