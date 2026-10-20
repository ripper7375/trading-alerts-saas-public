# Database Scaling — Saved Checkpoint

Saved: 2026-10-20, Asia/Bangkok, at Davin's request before credits expire.

## Current status

**The requested English architecture design is complete.** Read [database-scaling-second-wave-architecture.md](database-scaling-second-wave-architecture.md) first. Redis and Prisma/pool specialists reviewed it; their corrections are incorporated. Document formatting, 22 repository-local links, and saved-file byte equality passed.

Repository baseline: `main` at `de61737ebfba6d63345cffe4b000dec2ab55f588`.

Design SHA-256: `14357be675500206414c6233e1ed74c6f85436e595a0a16f6ce4603fc667984f`.

## Selected design

1. **Redis recovery:** remove only the root Redis retry-count cutoff; preserve the singleton lifecycle, 3-second command timeout, 5-second connect timeout, consumer policies, and existing offline/resend behavior. No ended-client replacement or new shutdown state machine.
2. **ID-only RETURNING:** add only `select: { id: true }` to the gateway live-row upsert. Keep full create/update payloads, `cycle_id`, PIT handling, and the existing row/manifest processing lane.
3. **Pool deadlines:** candidate `connectionTimeoutMillis` values are operation-service **2000 ms**, gateway **5000 ms**, money-service **2000 ms**. Keep pool maxima, idle eviction, URL/TLS/roles, transactions, and retries unchanged. Stage operation, gateway, then money independently.

The 2-second service candidates account for existing 5-second upstream read deadlines; they are not measured optimums. Pool waits do not bound SQL or whole requests. Money adoption requires explicit authorization covering the specific change and financial failure-path review, as detailed in the design.

## Status at original save time

At the original save time, no application code/test changes, migrations, live Redis/PostgreSQL access, application builds, client generation, dependency installation, commits, pushes, or deployments had been performed. No production performance improvement had been measured. Existing unrelated work was preserved.

The files were initially local and uncommitted. Davin subsequently authorized a documentation-only commit and push of the architecture design and this checkpoint to `origin/main`. Once that push is confirmed, Claude Code on another machine can obtain both documents through `git pull --ff-only origin main` from its local `main` checkout. Publishing these documents does not authorize application implementation or deployment.

## Resume point

No unfinished writing remains for the current request. The next step is Davin/Claude Code's review of the proposal. If implementation is later requested, revalidate the current checkout and follow the document's separate acceptance and rollback criteria; do not treat this checkpoint as implementation or deployment authorization.

To resume this conversation, say: **"Continue from the Database Scaling second-wave checkpoint dated 2026-10-20."**
