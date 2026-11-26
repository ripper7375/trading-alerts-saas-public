# M5 switch to `most_recent` while the web flag is off: for decision

**From:** Claude Code (Executor, Computer 2) · **Date:** 2026-11-26 · **Code read:** `12f69ed3`
**State:** nothing changed. No setting written, no environment variable touched.

## 1. Fact

Davin read Vercel Production: `ACTIVE_INDICATOR_FROM_GATEWAY` is absent or not `true`. His condition "confirm it is `true` before the M5 switch" is therefore **not met**; the switch needs a new decision from him.

## 2. What the switch changes today

| Consumer                                              | Follows the gateway setting?                                                                                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Gateway sensors (MCD0 to MCD3, SYN)                   | **Yes**, from the effective slot (`sensors/inputs/database-inputs.source.ts`). `shadow` only. New MCD2 and MCD3 statistics series start (ADR-100)      |
| Web chart overlay (`/api/market-data/channel`)        | **No** while the flag is off: the route takes the request's `variant`, default `best_fit_a`                                                            |
| VPS renderer images (chart download)                  | **Yes, if** `MT5Renderer` runs the step 2 code with `API_GATEWAY_URL` and a key; otherwise `RENDER_OVERLAYS`. **Not verified**                         |
| Intake and Engine 4 readers                           | They ask the gateway for the current cycle; those features are recorded as switched off (not re-checked here)                                          |
| Admin route `/api/admin/active-indicator` (the write) | Not gated by the flag. Needs `MARKET_GATEWAY_URL` and `MARKET_GATEWAY_API_KEY` in Vercel (**not verified**), a signed-in administrator; it has no page |

## 3. Options

- **A (Executor's recommendation): switch now, leave the flag off.** The shadow calibration gets M5 `most_recent`, which is what the switch is for, and DavinTrade has not launched. Cost: the web overlay (default `best_fit_a`) and the sensors name different M5 indicators, and a rendered image may differ from the web overlay. Undo: write `best_fit_a` for a later slot (the table is append-only).
- **B: cut over first** ([step 2 runbook](../runbooks/deploy-stack-d-step2.md) §7). It requires the §6 verification and the write-key decision of §1.5 (today `POST /api/v1/active-indicator` accepts any gateway key, the push worker's included). Calibration on M5 `most_recent` waits for both.

## Decision and final scripts (2026-11-26)

**Davin chose A:** switch M5 only; the web flag stays unset. The commands actually handed to him are in [`2026-11-26-m5-switch/`](./2026-11-26-m5-switch/) and **replace section 4 below**: one guarded console command (it writes only from the expected state, effective slot = earliest + 300) and a read-only database check. Both were tested on this computer against a stand-in route (7 cases) and a temporary local PostgreSQL (6 cases; a write attempt was refused by the read-only option).

**Result (2026-11-26):** written; M5 `most_recent` from slot 1795704000 (14:40:00Z), M15 `non_b`. Database check at 15:43Z: 12 of 12 over 13 slots ([output](./2026-11-26-m5-switch/verify-result-2026-11-26T1543Z.txt)). The "State" line at the top describes the moment this note was written.

## 4. Procedure for A as first proposed

1. **Read only.** Signed in as administrator on production, open `/api/admin/active-indicator`. Expected: `status` `ok`, M5 `best_fit_a`, M15 `non_b`, an `earliestSettableSlot`. `not_configured` means the two variables are missing: stop.
2. **Write**, after step 1 is checked, in the browser console on the same site:

```js
const state = await (await fetch('/api/admin/active-indicator')).json();
const effectiveSlot = state.earliestSettableSlot + 600;
await (
  await fetch('/api/admin/active-indicator', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timeframe: 'M5',
      source: 'most_recent',
      effectiveSlot,
      reason: 'ADR-100: M5 most_recent for the shadow run; web flag off',
    }),
  })
).json();
```

Expected: `status` `set`. The answer and the gateway log name the administrator: do not copy that address into a tracked file.

3. **After the slot** the Executor reads the gateway log (cycles written, MCD statuses) and Davin repeats step 1.
