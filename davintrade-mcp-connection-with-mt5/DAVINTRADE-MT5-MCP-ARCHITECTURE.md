# DavinTrade as an MT5 Wrapper — Architecture

**The MCP connection between DavinTrade and the trader's own MetaTrader 5 terminal**

|                           |                                                                                                                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Status**                | PROPOSED. Conceptual design, version 0.1, 17 October 2026. Not a build order: nothing here is settled until Davin approves it (§11)                                                                                            |
| **Owner**                 | Davin (approver of every change)                                                                                                                                                                                               |
| **BEFORE**                | [Stack D architecture](../docs/STACK-D-ARCHITECTURE.md): analysis, Report 1 and Report 2; "DavinTrade places no orders" ([ADR-069])                                                                                            |
| **AFTER (target)**        | [davintrade-app-as-mt5-wrapper.png](davintrade-app-as-mt5-wrapper.png)                                                                                                                                                         |
| **Enabler**               | MetaTrader 5 build 6060 (23 July 2026): native MCP support, AI Assistant, Passkey ([release notes](https://www.metatrader5.com/en/releasenotes/terminal/2447))                                                                 |
| **Reference app**         | [operational-steps-example/](operational-steps-example/): 22 screenshots of Alphasigs Desktop 0.6.8 connecting to MT5 over MCP (captions in Thai)                                                                              |
| **Replaces, if approved** | The transport in [DAVINTRADE-TRADE-EXECUTION-STACK.md](../mt5-execution-stack/DAVINTRADE-TRADE-EXECUTION-STACK.md) (April 2026: a Python bridge on a Windows VPS per trader). Its guardrail and rollout ideas are kept (§10.2) |

**In one sentence:** the trader's own MT5 terminal becomes DavinTrade's hands, Stack D stays the
brain, and MCP is the wiring between them.

## Contents

0. [In one page](#0-in-one-page)
1. [The enabler: MT5 build 6060](#1-the-enabler-mt5-build-6060)
2. [Lessons from the reference app](#2-lessons-from-the-reference-app)
3. [The AFTER at a glance](#3-the-after-at-a-glance)
4. [Components](#4-components)
5. [The four capabilities](#5-the-four-capabilities)
6. [The order path](#6-the-order-path)
7. [Safety model](#7-safety-model)
8. [Data, privacy and retention](#8-data-privacy-and-retention)
9. [Lane B: the DavinTrade MCP Server](#9-lane-b-the-davintrade-mcp-server)
10. [What changes in Stack D and in earlier plans](#10-what-changes-in-stack-d-and-in-earlier-plans)
11. [Proposed decisions](#11-proposed-decisions)
12. [Plan: phases M0 to M6](#12-plan-phases-m0-to-m6)
13. [Open questions to verify](#13-open-questions-to-verify)

- [Appendix A — Glossary](#appendix-a--glossary)
- [Appendix B — Sources](#appendix-b--sources)

---

## 0. In one page

### 0.1 Before and after

|                                      | BEFORE (Stack D)                                            | AFTER (this design)                                                                     |
| ------------------------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Where the trader places the order    | In MT5, by hand, retyping the Report 2 numbers              | From DavinTrade: one confirmed click sends the order to the trader's own MT5            |
| What DavinTrade knows of the account | What the trader types into the profile (equity, commission) | Account, positions and history read live from MT5, after consent                        |
| Broker figures used for sizing       | The feed broker's `symbol_specs` (§6.9)                     | The trader's own broker's symbol figures, read when the terminal connects               |
| MT5 terminals involved               | DavinTrade's feed terminals A, B and S on the Vultr VPS     | The same feed terminals for analysis, plus the trader's terminal for account and orders |
| Where the AI conversation happens    | In DavinTrade                                               | In DavinTrade, and DavinTrade's context is also available inside MT5's own AI Assistant |
| What is recorded                     | Consent records: accept, modify, decline                    | Also order intents, MT5 results and the trader's closed-trade history                   |
| Dashboard and reports                | None for the trader's own trades                            | A trade dashboard and reports from MT5 history, each trade linked to its setup          |

### 0.2 Five principles

1. **Analysis stays central.** The 5-minute Stack D cycle, fed by DavinTrade's own terminals, stays
   the only source of direction, zones and Report 2. The trader's terminal never feeds a sensor, so
   the same data still gives the same answer and every answer can still be replayed (Stack D §0.1).
2. **The model talks, Engine 4 calculates, the trader decides, the guard enforces, MT5 executes.**
   No language model writes a number into an order, and no model holds a "send order" tool.
3. **Local first.** The MT5 API key, the MCP connection and the order guard live on the trader's
   computer. Broker passwords and passkeys never reach DavinTrade.
4. **Confirmation happens on the trader's machine.** In the first release every order is confirmed
   in a native window that neither the web page nor the cloud can draw or click.
5. **Demo first; live by a separate consent.** A real-money account is a gate the trader opens on
   purpose, and that DavinTrade offers only after counsel has reviewed it.

### 0.3 The four capabilities in the AFTER picture

| #   | Capability                              | Built from                                 | New in this design                                                                                        |
| --- | --------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| 1   | Market context and trade setup analysis | Stack D §1–3 and §6, unchanged at the core | Sizing with the trader's broker figures; the price gap to the feed; MT5 positions on the DavinTrade chart |
| 2   | Conversational AI trade consultant      | Stack D §4–5                               | The trader's open position in the conversation (after consent); DavinTrade tools inside MT5 (Lane B)      |
| 3   | Trade execution agent                   | Report 2 (§6) as the only source of orders | Order intent, order guard, native confirmation, send, read-back, execution record                         |
| 4   | Trade data: dashboard and reports       | —                                          | Execution journal, MT5 history import, performance reports, setup outcomes                                |

---

## 1. The enabler: MT5 build 6060

### 1.1 What the terminal now offers

Source letters: **S** = seen in the reference screenshots (a terminal in October 2026);
**R** = the official release notes, read through search summaries (the release-notes page could not
be opened from the build environment); **T** = a third-party guide, unverified. Phase M0 (§12)
re-checks every R and T row on a real terminal before anything is built on it.

| Feature                   | What it is                                                                                                                                                                                                         | Source |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| Native MCP and agentic AI | MT5 speaks the Model Context Protocol; AI agents can analyse markets, trade, and develop and test Expert Advisors                                                                                                  | R      |
| Internal MCP server       | Tools → Options → MCP → "Enable internal server". Address `http://127.0.0.1:<port>/mcp`; an API key with "Copy" and "Generate"                                                                                     | S      |
| One port per terminal     | Several terminals on one PC each listen on their own port (22346 to 22349 seen). The same terminal's port changed between two screenshots (22347, then 22348)                                                      | S      |
| External MCP servers      | The same tab lists "Endpoint · API key — Add new MCP server": MT5's own assistant can call tools on outside MCP servers                                                                                            | S      |
| External MCP clients      | OpenAI Codex, Claude Code and other MCP clients can connect to the terminal                                                                                                                                        | R      |
| Tool coverage             | About 40 tools: charts, quotes, account history, order operations, Strategy Tester. Build 6090 (30 July) added methods; build 6230 added more                                                                      | T, R   |
| AI Assistant              | Tools → Options → AI Assistant: provider (MQL5.community by default; own keys for OpenAI, Anthropic, Gemini, DeepSeek, Ollama), model ("MQL5 Lite"), Web ("GET requests only"), "Dangerous shell operations" (off) | S, R   |
| Trading permission        | AI Assistant → Trading. AI-initiated trades can be allowed, prohibited, or require manual confirmation. With trading not allowed, MCP orders fail with "trading is not permitted"                                  | S, R   |
| Passkey                   | An optional, broker-enabled second sign-in factor for trading accounts; password login still works                                                                                                                 | R      |
| MetaEditor                | Code folding, highlight of all occurrences, new LAPACK/OpenBLAS matrix methods, code-management changes                                                                                                            | R      |

### 1.2 Why it changes the earlier execution plan

The April 2026 plan needed, for every trader: a Windows VPS, Python with the `MetaTrader5` package,
a FastAPI bridge, an inbound port open to Railway, and the broker password in the VPS's environment.
Build 6060 removes all five.

| April 2026 bridge design                | With build 6060                                                                        |
| --------------------------------------- | -------------------------------------------------------------------------------------- |
| Python `MetaTrader5` SDK (Windows only) | The terminal itself is the server; no SDK                                              |
| A FastAPI bridge per trader             | Not needed                                                                             |
| A Windows VPS per trader                | The trader's own PC (or the trader's own VPS, if they prefer one)                      |
| An inbound port open to the cloud       | Nothing inbound: the server listens on 127.0.0.1 only                                  |
| `MT5_PASSWORD` stored on the VPS        | Never handled: the trader signs in to MT5 (with a passkey where the broker offers one) |
| The cloud sends orders to the bridge    | A local client on the same PC sends the order; the cloud cannot reach the terminal     |

Passkey and the MetaEditor changes are not on this design's critical path. Passkey matters in one
place: a terminal that must sign in again needs the trader present, so anything unattended depends
on the MT5 session staying signed in (§7.6).

---

## 2. Lessons from the reference app

### 2.1 The flow the screenshots show

| Step | Screenshots | What happens                                                                                                                                                                                 |
| ---- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | 1, 16       | The desktop app's menu offers "Connect MT5… (Ctrl+Shift+M)" and "Stop sending orders now (kill switch)"                                                                                      |
| 2    | 3–7, 10     | In MT5: Tools → Options → MCP → "Enable internal server"; copy the address and the API key                                                                                                   |
| 3    | 4, 12       | In MT5: Options → AI Assistant → Trading: Enabled (otherwise every order is refused with "trading is not permitted")                                                                         |
| 4    | 2, 8, 9     | The app lists "MT5 open on this machine", each with its port and a "connect this" button; the address field accepts 127.0.0.1 only                                                           |
| 5    | 11–14       | The trader pastes the key and ticks the read consent (balance, open positions, history, EA logs; what a question needs is sent to the AI provider); "Test and save"                          |
| 6    | 15          | "Connected ✓ EBC 66125 (EBCFinancialGroupKY-Demo, demo, USD)"                                                                                                                                |
| 7    | 11–13       | Sending orders: at most 1 lot an order, a stop loss on every order, demo accounts only unless "Allow real account" is opened by a second consent; the account type is re-read on every order |
| 8    | 13          | Confirmation modes: Manual (ask every order, recommended), Auto (orders of 0.1 lot or less go at once, with a notice), Bypass (everything goes without asking)                               |
| 9    | 17–21       | Trade panel "Send to MT5 · demo · XAUUSD.s · 1 lot = 100 · min lot 0.01"; the MT5 positions are drawn on the app's chart with live P/L and a close button                                    |
| 10   | 13          | Footer: the key is stored encrypted on this machine and is not sent to the vendor's server                                                                                                   |

### 2.2 What DavinTrade adopts, and what it does differently

| Adopt                                                                          | Do differently, and why                                                                                                                            |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| A desktop app with a local MCP client; discovery of running terminals          | **Order numbers come only from Engine 4** (Report 2). In the example the AI proposes orders; in DavinTrade no model does (principle 2)             |
| The key stays on the PC, encrypted                                             | **No Bypass mode.** Manual only in the first release; Auto is a later decision with its own record (P-7)                                           |
| Separate consents for reading, for sending, and for real-money accounts        | **No money figures in prompts.** The example sends the balance to the AI provider; DavinTrade keeps [ADR-077]                                      |
| Demo by default; the account type re-read on every order                       | **The price gap is checked.** The example charts Binance PAXG data and executes on the broker's XAUUSD.s; DavinTrade measures the gap first (§6.4) |
| A kill switch in the app menu; a stop loss on every order; a per-order lot cap | **A setup's validity travels with its order:** a pending order expires or is cancelled when its setup does (§6.5)                                  |
| Positions drawn on the chart                                                   | **Terminals are re-discovered, never remembered by port:** the example's own port changed between two screenshots                                  |

---

## 3. The AFTER at a glance

### 3.1 Reading the picture: one arrow, two connections

The picture shows MT5 as an MCP **client** and one MCP **server** between DavinTrade and MT5, with
arrows both ways. An MCP call goes one way only: a client calls the tools of a server, and a server
cannot call the client's tools. Build 6060 lets MT5 play both roles, so "both ways" becomes two
connections, called **lanes** in this document:

| Lane                          | Client → server                                                         | Purpose                                                                                                | In the picture                                  |
| ----------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| **A · Account and execution** | DavinTrade Desktop (Local Connector) → MT5's internal server, 127.0.0.1 | Read the account, positions, history, symbol figures and quotes; send, modify, cancel and close orders | DavinTrade App ↔ MT5, inside "User's computer" |
| **B · Context**               | MT5's AI Assistant (or any MCP client) → DavinTrade MCP Server, cloud   | DavinTrade's market context and Report 1 inside MT5                                                    | The "MCP Server" box, with MT5 as its client    |

Lane A is what makes capabilities 3 and 4 possible: DavinTrade can act in the terminal only as a
client of the terminal's own server. Lane B is optional and read-only; it brings capabilities 1 and 2
into MT5.

### 3.2 System diagram

```
 TRADER'S COMPUTER (Windows)
 +-------------------------------------------------------------------------+
 |  DavinTrade Desktop                                                     |
 |  +-------------------------------------------------------------------+  |
 |  | Web UI (the DavinTrade web app): chart, chat, Report 1 and 2,     |  |
 |  | trade dashboard                                                   |  |
 |  +------------------------------+------------------------------------+  |
 |                                 | narrow IPC: no MCP session, no key    |
 |  +------------------------------v------------------------------------+  |
 |  | Local Connector: discovery, key vault, MT5 tool adapter,          |  |
 |  | ORDER GUARD, native confirm, kill switch, execution journal       |  |
 |  +----+-------------------------+------------------------------------+  |
 |       |                         | LANE A: MCP over 127.0.0.1            |
 |       |  +----------------------v------------------------------------+  |
 |       |  | MT5 terminal                                              |  |
 |       |  |   internal MCP server: http://127.0.0.1:<port>/mcp + key  |  |
 |       |  |   AI Assistant (MCP client), Trading permission           |  |
 |       |  +-----------+-----------------------------------+-----------+  |
 +-------|--------------|-----------------------------------|--------------+
         | HTTPS        | LANE B: MCP over HTTPS            | broker protocol
         | (signed in)  | (DavinTrade token)                v
 +-------v--------------v---------------------------+  +----------+
 | DAVINTRADE CLOUD                                 |  |  Broker  |
 |  Stack D core, unchanged: 5-minute cycle,        |  +----------+
 |  sensors, synthesis, zones, Report 1, Engine 4   |
 |  and Report 2, consent records, trace            |
 |  NEW: signed order intents, execution records,   |
 |  trader broker profiles, journal sync (opt-in)   |
 |  NEW: DavinTrade MCP Server (read-only tools)    |
 |  Feed terminals A, B and S on the Vultr VPS      |
 +--------------------------------------------------+
```

### 3.3 Who owns what

| Part              | Runs on                       | Owns                                                                           | Never does                                                                |
| ----------------- | ----------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| DavinTrade web UI | Browser, or the desktop shell | Screens: chart, chat, reports, dashboard                                       | Hold the MT5 key or speak MCP to the terminal                             |
| Local Connector   | The trader's PC               | Lane A, the order guard, the native confirmation, the kill switch, the journal | Send an order that did not come from a Report 2 setup the trader accepted |
| DavinTrade Cloud  | Vercel and Railway            | Analysis, Report 1 and 2, consent and execution records, Lane B                | Reach into the trader's terminal                                          |
| MT5 terminal      | The trader's PC               | The broker connection and the final AI trading permission                      | — (the trader's settings)                                                 |
| Broker            | The broker                    | Execution, margin, stops level, market hours                                   | —                                                                         |

---

## 4. Components

### 4.1 DavinTrade Desktop (the shell)

- **Why a desktop app.** A web page cannot use Lane A safely. MT5's server listens on 127.0.0.1 and
  is not built for browser calls (cross-origin rules; browsers now ask before a page may reach the
  local network), and the API key would sit in page JavaScript, one script injection away from
  theft. A desktop process can call localhost and keep the key out of the page.
- **What it is.** A shell that loads the existing DavinTrade web app (same sign-in, same pages) and
  adds the Local Connector as its main process. One code base for the screens; the desktop adds only
  the connection, the guard and the journal. Electron is recommended because its Node side runs the
  official TypeScript MCP SDK, the monorepo's own language; Tauri is the smaller alternative (P-2).
- **Windows first**, because MT5 is a Windows program. On macOS MT5 runs under a compatibility
  layer; whether its internal server is reachable there is checked in M0. Until then macOS traders
  use the web app.
- **The web app in a browser** keeps capabilities 1 and 2, and capability 4 from synced data. It has
  no Lane A. A later "hand-off" can let the web page pass an order ticket to a running Connector,
  which confirms it natively, without moving execution into the browser (§12, later).
- **Shell security.** A content security policy; only DavinTrade origins load; the page gets a narrow
  IPC interface (list accounts, read summaries, ask for an order ticket for setup X, read the
  journal), never the MCP session or the key; updates are signed.

### 4.2 Local Connector

| Function            | Behaviour                                                                                                                                                                                                                                                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Discovery           | Probes a small range of localhost ports (from 22346 upward; the range is confirmed in M0) for MCP servers and reads each terminal's identity: broker, server, login, demo or real, currency. Re-discovers at start and after any failed call, because ports change                                                                                       |
| Pairing             | The trader pastes the terminal's API key once per terminal. "Test and save" runs a harmless read and shows "Connected ✓ broker · login · demo/real · currency"                                                                                                                                                                                           |
| Key vault           | The key is encrypted with the operating system's keychain (Windows DPAPI / Credential Manager). It is never sent to the cloud, never shown to the page, never written to a log                                                                                                                                                                           |
| Tool adapter        | Calls `tools/list` on connect and maps the terminal's tools to the capabilities DavinTrade needs: read account, positions, orders, history, symbol, quote; send, modify, cancel, close. A missing capability switches its feature off with "update MT5 to build n or later". This shields DavinTrade from tool changes between builds (6060, 6090, 6230) |
| Account fingerprint | Server, login, trade mode and currency, re-read before every order. An order prepared for one account is never sent to another                                                                                                                                                                                                                           |
| Order guard         | Deterministic checks before every send (§7.2)                                                                                                                                                                                                                                                                                                            |
| Native confirmation | A window drawn by the Connector itself (§6.3)                                                                                                                                                                                                                                                                                                            |
| Kill switch         | Menu, tray icon and hotkey: stops every new DavinTrade order at once and cancels DavinTrade's pending orders. "Close DavinTrade positions" is a separate action with its own confirmation                                                                                                                                                                |
| Journal             | Local, append-only store of intents, results and imported history (§5.4, §8)                                                                                                                                                                                                                                                                             |
| Health              | A heartbeat per terminal: reachable, key accepted, trading permitted, broker connected, market open; shown as one status chip in the app                                                                                                                                                                                                                 |

### 4.3 Additions in DavinTrade Cloud

| Addition              | What                                                                                                                                                                                     | Notes                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Trader broker profile | Per connected account: the broker's name for XAUUSD (e.g. `XAUUSD.s`, `GOLD`), contract size, volume min/step/max, tick size, stops and freeze level, typical spread, server-time offset | Brings forward [ADR-066]'s "per-broker specs later". No money figures        |
| Signed order intents  | Each intent is signed by the cloud (user, setup, expiry); the Connector checks the signature with a public key shipped in the app                                                        | A forged or replayed intent is refused (§7.4)                                |
| Execution records     | One append-only row per intent and per MT5 result, for orders DavinTrade transmitted                                                                                                     | Linked to the consent record and the trace; kept like consent records (P-10) |
| Journal sync (opt-in) | Closed trades and open positions from MT5 history, all symbols, for the web and mobile dashboard                                                                                         | Off by default; the trader can delete it                                     |
| DavinTrade MCP Server | Lane B (§9)                                                                                                                                                                              | Read-only                                                                    |
| Entitlement rows      | Connector (read), execution, Lane B                                                                                                                                                      | Davin's values (P-11), in the one table of [ADR-074]                         |

### 4.4 The trader's own MT5 settings

| Setting                                | Needed for                | DavinTrade's guidance                                                                                                                                                                                                        |
| -------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Options → MCP → Enable internal server | Lane A at all             | Required                                                                                                                                                                                                                     |
| The API key ("Generate")               | Pairing                   | Generating a new key revokes DavinTrade's access (to confirm in M0)                                                                                                                                                          |
| Options → AI Assistant → Trading       | Lane A orders             | Not allowed = DavinTrade can only read. Confirmation required = a second confirmation inside MT5 (its behaviour for outside clients is checked in M0). Allowed = DavinTrade's guard and native confirmation are the controls |
| Options → MCP → external servers       | Lane B                    | Add DavinTrade's endpoint and the trader's DavinTrade MCP token                                                                                                                                                              |
| AI Assistant provider and model        | Lane B answers inside MT5 | The trader's choice; DavinTrade does not control that model (§9.3)                                                                                                                                                           |

---

## 5. The four capabilities

### 5.1 Market context and trade setup analysis

The core is unchanged: the Stack D cycle, sensors, synthesis, zones and Report 2. With Lane A:

- **Sizing with the trader's broker.** Engine 4 sizes with the trader's broker figures (contract
  size, lot step, minimum lot, stops level) instead of the feed broker's ([ADR-066], extended). The
  equity input can be pre-filled from the account; the trader still confirms the profile (§6.2).
- **The price gap (basis).** Zones are in the feed broker's prices. The Connector measures the gap
  between the trader's broker and the feed at the same moment, and shows zone prices in the trader's
  broker terms (§6.4).
- **Positions on the chart.** The trader's open XAUUSD positions and pending orders (entry, stop,
  target, volume) are drawn on the DavinTrade chart. Profit and loss are shown as distance and R;
  money only on the trader's own screen.
- **Exposure notice.** When Report 2 is offered, it says if the trader already holds a position in
  the same or the opposite direction.

### 5.2 Conversational AI trade consultant

- **In DavinTrade (Stack D §4–5).** After the read consent, the intake packet gains an optional
  _position block_: each open XAUUSD position as side, lots, entry, stop, target, and distance to the
  stop in dollars and in R. No balance, equity, money P/L or commission ([ADR-077]). One setting
  turns the block off.
- **Questions it opens:** "Does my open long still make sense?" (answered from the SYN reading and
  the zones, not from the model's opinion); "Where is my stop compared with the invalidation?". These
  need a new intent ("my position") in the dispatch matrix and new rows in the labelled set (Stack D
  §4.5, §4.8).
- **The consultant proposes only by pointing.** It can say "Report 2 for Z1 is available" and open
  the order ticket. It cannot send, modify or close an order.
- **Inside MT5**, through Lane B (§9).

### 5.3 Trade execution agent

"Agent" here means that DavinTrade carries the setup the trader accepted to the terminal and looks
after it (expiry, cancellation, read-back, records). It does not mean that a model trades. The full
path is in §6.

| Level | Name               | What happens                                                                            | When                                          |
| ----- | ------------------ | --------------------------------------------------------------------------------------- | --------------------------------------------- |
| 0     | Analysis only      | Stack D as today; the trader places the order by hand                                   | The default                                   |
| 1     | Assisted (Manual)  | Every order is confirmed in the native window                                           | First release: demo, then real money (M3, M4) |
| 2     | Auto within limits | Orders that pass the guard and stay under a small lot go without a click, with a notice | Later, by its own decision and counsel review |
| —     | Bypass             | Not offered                                                                             | Never                                         |

Practice is an MT5 demo account: there is no separate simulator to build.

### 5.4 Trade data: dashboard and reports

- **Source.** MT5 history (deals, orders, positions) read through Lane A and kept in the local
  journal. It reaches the cloud only when the trader turns on sync, for the web and mobile dashboard.
- **Link to DavinTrade.** Every DavinTrade order carries a DavinTrade magic number and a short
  comment tag such as `DT:<setup short id>` (MT5 comments are short; the length is confirmed in M0).
  Every deal can then be traced to its Report 2, cycle and consent record.
- **Dashboard.** Account summary (local); open positions; equity curve (local unless synced); trades
  by session (Asia, London, New York); trades by source (DavinTrade setup or manual).
- **Reports.** Win rate, average R, expectancy, profit factor, maximum drawdown in R and percent;
  stop discipline (stops moved or removed); **setup outcomes**: every offered Report 2 followed to its
  target, stop or expiry, measured from market data even when the trader did not trade it; a monthly
  summary to download.
- This delivers the roadmap item "memory of a trader's past setups and outcomes (G5)" (Stack D §7.10).

---

## 6. The order path

### 6.1 The steps

| Step | Name       | Where             | What happens                                                                                                                                                                   |
| ---- | ---------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | Accept     | Cloud             | The trader accepts (or modifies) Report 2: consent record ([ADR-069]); the `ValidatedSetup` is fixed ([ADR-097])                                                               |
| 2    | Intent     | Cloud → Connector | A signed order intent (`exec-intent/1`, §6.2) is built from the setup alone. No free text and no model output goes into it                                                     |
| 3    | Map        | Connector         | The broker's symbol; the lot checked against the broker's min, step and max; prices moved by the basis; stop and target outside the stops level                                |
| 4    | Guard      | Connector         | The checks of §7.2; any failure shows its reason and nothing is sent                                                                                                           |
| 5    | Confirm    | Connector         | Native window: the account (broker, login, DEMO or REAL in red), side, lot, order type, prices, risk in money and percent, expiry, "you are sending this order to your broker" |
| 6    | Re-check   | Connector         | Just before sending: account fingerprint, live quote, market open, kill switch, setup still valid (cycle and invalidation), no news blackout                                   |
| 7    | Send       | Connector → MT5   | One MCP call per intent, with the DavinTrade magic number and tag                                                                                                              |
| 8    | Read back  | Connector → MT5   | Orders and positions are read to confirm the result, even after a success reply                                                                                                |
| 9    | Record     | Connector → cloud | Execution record (intent, MT5 result code, ticket, fill price, slippage); the trace's execution group; the journal                                                             |
| 10   | Look after | Connector         | Expiry and cancellation of pending orders (§6.5); status shown in the app                                                                                                      |

### 6.2 The order intent (`exec-intent/1`)

```
intent_id     uuid, used once (the idempotency key)
setup_id      the ValidatedSetup behind Report 2      consent_id   its consent record
cycle_slot    "2026-09-18T20:55Z"                     versions     Engine 4, broker profile, guard
account       fingerprint hash · DEMO | REAL          (filled and re-checked by the Connector)
symbol        feed XAUUSD → the broker's symbol
side          BUY | SELL
order_type    LIMIT | STOP | MARKET                   (§6.4)
entry, stop, target   in the broker's prices, after the basis
lot           from Engine 4, with the broker's figures
expiry        from the setup's validity               (§6.5)
mode          MANUAL
signature     cloud signature over all of the above, with its own expiry
```

### 6.3 The native confirmation

- Drawn by the Connector, not by the web page, so a compromised page or a forged cloud reply cannot
  press it.
- REAL money is shown in red; the risk is shown in money and percent (on the trader's screen only).
- It times out (starting value 60 seconds) and cancels. If the price moves beyond tolerance while it
  is open, the trader confirms again at the new price.

### 6.4 Order type and the price gap

- **Order type.** Price outside the zone → a limit order at the zone's reference price (a BUY below
  the market is a buy limit; a SELL above it is a sell limit). Price already inside the zone → a
  market order, allowed only within a slippage tolerance of the setup's entry.
- **Basis.** The gap between the trader's broker and DavinTrade's feed, measured at the same moment.
  Within the tolerance (starting value $0.50, P-9) every price is moved by the gap. Above it, no
  order: "your broker's gold price differs from DavinTrade's feed by $x". The analysis is still shown.
- **Bid and ask.** Stack D charts are bid (§6.9). The Connector uses the broker's live bid and ask on
  the side where each price triggers, the same rule Engine 4 uses for the spread ([ADR-094]).

### 6.5 A setup's validity travels with its order

- Report 2 is pinned to its cycle ([ADR-059]). A pending order expires at the earlier of the trader
  type's holding window (2 hours Scalper, 12 hours Day Trader) and a set number of cycles (P-14).
- Before a fill, the Connector cancels it when price passes the zone's invalidation, or when a
  Tier-1 blackout window opens ([ADR-060]).
- The broker's own expiry (good-till-time) is used wherever the broker allows it, so the expiry holds
  even when the PC sleeps.
- A filled position belongs to the trader. In the first release DavinTrade does not move its stop or
  close it, except on the trader's own confirmed command.

### 6.6 When things fail

Each row becomes a test against a fake MT5 MCP server (M3).

| Failure                                             | Response                                                                                                   |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| MT5 not running, or its server switched off         | No ticket: "open MT5 and enable the internal server". The analysis is unaffected                           |
| Key refused                                         | Ask to pair again; nothing sent                                                                            |
| "Trading is not permitted" (MT5 setting)            | The reason, with the setting's path                                                                        |
| The terminal switched to another account            | The intent is refused (fingerprint mismatch); the trader confirms again on the new account                 |
| Market closed, or the symbol not tradable           | Not sent; the reason                                                                                       |
| Price moved beyond tolerance                        | Confirm again at the new price, or refuse                                                                  |
| The broker rejects (invalid stops, margin, requote) | The broker's code and text; no automatic retry                                                             |
| No reply, or the connection drops during a send     | Outcome unknown: read orders and positions by tag before anything else. **Never resend blind**             |
| Kill switch on                                      | Nothing sent; DavinTrade's pending orders cancelled                                                        |
| Cloud unreachable                                   | No new intents (they come from the cloud); the Connector still expires and cancels, and queues its records |
| PC asleep or offline                                | The broker-side expiry still holds; the Connector reconciles when it wakes                                 |

---

## 7. Safety model

### 7.1 Layers

| Layer                    | Owner                 | Stops                                                                  |
| ------------------------ | --------------------- | ---------------------------------------------------------------------- |
| 1 Offer check            | Stack D §6.4          | Unsafe moments: STALE data, blackout, price past invalidation, NEUTRAL |
| 2 Validator and sizing   | Engine 4, §6.7–6.10   | Wrong risk, leverage over the limit, a lot below the broker's minimum  |
| 3 Consent                | The trader, §6.11     | Setups the trader did not accept                                       |
| 4 Order guard            | Local Connector       | Limits, wrong account, price drift, kill switch, duplicates            |
| 5 Native confirmation    | The trader, on the PC | Anything the trader did not see                                        |
| 6 MT5 trading permission | The trader, in MT5    | All AI and MCP trading, when not allowed                               |
| 7 Broker                 | The broker            | Margin, stops level, market hours                                      |

### 7.2 Guard checks

Starting values are Davin's to set (P-8).

| #   | Check                                                                                     | Starting value                                    |
| --- | ----------------------------------------------------------------------------------------- | ------------------------------------------------- |
| G1  | The intent is signed, unexpired, for this user, and comes from an accepted Report 2 setup | Always                                            |
| G2  | The symbol is the broker's mapping of XAUUSD                                              | Stack D scope                                     |
| G3  | A stop loss is present and equals the setup's stop after the basis                        | Always                                            |
| G4  | Lot ≤ Engine 4's lot, and ≤ a per-order cap                                               | 1.00 lot                                          |
| G5  | The account type is allowed                                                               | Demo; real only after the live gate (§7.5)        |
| G6  | Open DavinTrade positions ≤ cap                                                           | 1 (Report 2 is single-order in scope, Stack D §6) |
| G7  | Today's realised DavinTrade loss ≤ cap                                                    | 3 R                                               |
| G8  | Price drift from the setup's entry ≤ tolerance (market orders)                            | $1.00                                             |
| G9  | Basis ≤ tolerance                                                                         | $0.50                                             |
| G10 | The setup is still valid: data status allows it, no blackout, price not past invalidation | Always                                            |
| G11 | Kill switch off; terminal health green                                                    | Always                                            |
| G12 | Not a duplicate: the intent id is unused and no live order carries this tag               | Always                                            |

A stop is never widened automatically. Tightening a stop is the trader's own command.

### 7.3 What the models can and cannot do

| Model                                 | Can                                                                   | Cannot                                                                                  |
| ------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| DavinTrade's reply model (Stack D §5) | Explain; point at a Report 2 setup; read the consented position block | Write order numbers; hold a send, modify or close tool; see the key or any money figure |
| MT5's AI Assistant, through Lane B    | Call DavinTrade's read-only tools                                     | Get a sized setup from DavinTrade, or pass through DavinTrade's guard                   |

Text read from MT5 (EA logs, symbol descriptions, order comments) is data, never instructions, and
never reaches a model that holds a tool able to change anything.

### 7.4 Threats and answers

| Threat                                                        | Answer                                                                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Another program on the PC steals the MT5 key                  | Operating-system keychain; never in files or logs; the trader can generate a new key in MT5 at any time      |
| A script injected into the web UI asks the Connector to trade | Narrow IPC; the Connector accepts only signed intents (G1); the native confirmation                          |
| The cloud is compromised and pushes orders to every Connector | Every order needs the trader's native confirmation; caps are enforced locally; Auto only within local limits |
| A fake MCP server on a localhost port                         | 127.0.0.1 only; the terminal's identity shown at pairing; the key bound to the account fingerprint           |
| A stale or replayed intent                                    | Signature expiry and one-time intent ids (G1, G12)                                                           |
| A leaked DavinTrade MCP token (Lane B)                        | Read-only scope, revocable, rate-limited, metered                                                            |

### 7.5 The live-account gate

- Off by default. Opening it takes a separate consent (counsel-reviewed, in all 19 languages), a
  typed confirmation and, if Davin chooses, a number of filled demo orders first (P-6).
- The Connector reads the account's trade mode before every order; REAL is red in every confirmation.
- Before the gate exists at all: counsel's review for each target market (§11, P-1).

### 7.6 Unattended running

- First release: no unattended orders (Manual only). Pending orders rely on the broker's expiry.
- Auto mode, later, needs the PC (or the trader's own VPS) switched on and MT5 signed in. With
  passkey brokers a fresh sign-in needs the trader.

---

## 8. Data, privacy and retention

### 8.1 Where each item lives

| Data                                       | On the trader's PC   | In DavinTrade Cloud                                                              | Seen by a model                           |
| ------------------------------------------ | -------------------- | -------------------------------------------------------------------------------- | ----------------------------------------- |
| MT5 API key                                | Encrypted (keychain) | Never                                                                            | Never                                     |
| Broker login, password, passkey            | In MT5 only          | Never (the login only as a hash inside the fingerprint)                          | Never                                     |
| Balance, equity, margin, money P/L         | Yes                  | Only the equity the trader confirms in the profile (as today), or synced journal | Never ([ADR-077])                         |
| Open XAUUSD positions (side, lots, prices) | Yes                  | In execution records for DavinTrade orders; in the journal if synced             | With the read consent, as distances and R |
| Broker symbol figures                      | Yes                  | Trader broker profile                                                            | No                                        |
| Intents and results of DavinTrade orders   | Journal              | Execution records, always                                                        | No                                        |
| Full trade history (all symbols)           | Journal              | Only if sync is on                                                               | No                                        |

### 8.2 Consents

| Consent   | Unlocks                                                                           | Default       |
| --------- | --------------------------------------------------------------------------------- | ------------- |
| C1 Read   | Account card, positions on the chart, local dashboard, the position block in chat | Off           |
| C2 Send   | Lane A orders on demo accounts                                                    | Off           |
| C3 Live   | Lane A orders on real-money accounts                                              | Off; needs C2 |
| C4 Sync   | Journal copied to the cloud, for the web and mobile dashboard                     | Off           |
| C5 Lane B | A DavinTrade MCP token for MT5's assistant or another MCP client                  | Off           |

Each consent is its own record (who, when, version and language of the text) and can be withdrawn.
Withdrawing C1 also stops C2 to C4.

### 8.3 Retention

Execution records are kept 7 years, with the consent records (proposed, P-10; Stack D §7.5). A synced
journal is kept until the trader deletes it or the account. Account deletion follows Stack D §7.5:
personal data is removed and audit rows keep the hashed id.

---

## 9. Lane B: the DavinTrade MCP Server

### 9.1 Tools (read-only, proposed)

| Tool                 | Returns                                                                                               | Cost                         |
| -------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------- |
| `get_market_context` | The latest complete cycle: slot, data status, the SYN reading per trader type, the sensor board lines | No model cost; rate-limited  |
| `get_entry_zones`    | Ranked zones with invalidation and runway                                                             | No model cost; rate-limited  |
| `get_news_window`    | The next Tier-1 releases, and whether a blackout is active                                            | No model cost; rate-limited  |
| `ask_davintrade`     | A checked Report 1 for a question, through the full Stack D path (§4–5)                               | Metered in units ([ADR-050]) |

Not exposed: Report 2 and any sizing (it needs the profile, the consent and DavinTrade's own screen),
anything that sends orders, any account data. Every result carries "data as of hh:mm UTC", the data
status and the disclaimer in the trader's language.

### 9.2 Access

- Pro only (P-11). One token per trader, created in DavinTrade's settings, shown once, stored hashed,
  revocable, read-only.
- One Streamable HTTP endpoint (for example `https://davintrade.app/api/mcp`). MT5's "Add new MCP
  server" takes the endpoint and the token; Claude Desktop, Claude Code or Codex connect the same way.
- One trace row per call (Stack D §7.4), marked as Lane B.

### 9.3 The limit of DavinTrade's control

The model inside MT5 writes its own words. Stack D's number and wording checks (§5.8, §5.9) cover
what `ask_davintrade` returns, not how that model retells it. And if the trader allows trading in
MT5, that assistant could act on DavinTrade's context outside DavinTrade's guard. The answers: no tool
returns a sized setup; every result says "context only, not an instruction to trade"; DavinTrade's
guide recommends MT5's "confirmation required" setting; counsel reviews the wording (P-5).

### 9.4 Where it runs

Recommended: a route in the monolith (`app/api/mcp`), because `lib/reply`, `lib/engine4` and
`lib/platform/entitlements` already live there. It can move to its own service later if load needs
it (P-4).

---

## 10. What changes in Stack D and in earlier plans

### 10.1 Stack D

- **Keep:** the 5-minute cycle and the feed terminals as the only analysis source; Report 2 as the
  only source of orders; the profile confirmation; [ADR-077] (no money figures in prompts).
- **Change [ADR-069]:** "DavinTrade places no orders" becomes "DavinTrade sends the order you confirm
  to your own MT5" when Lane A is on; web-only traders keep "you place the order with your broker".
  This is a new decision that supersedes ADR-069 in part, and it needs counsel (P-1).
- **Change [ADR-066]:** per-broker figures come forward from "later"; Engine 4 accepts the trader
  broker profile.
- **Add**, once approved: a Section 8 "Account and execution" in `docs/STACK-D-ARCHITECTURE.md`, with
  two new handoffs (11: order intent; 12: execution record); an execution group in the trace; the
  rows of §6.6 in the degraded-mode table; golden scenarios run against a fake MT5 MCP server; an
  "Execution" panel on the operations page (orders sent, refused by guard reason, broker rejects,
  unknown outcomes) and an alert on any unknown outcome; the new entitlement rows; safety texts in all
  19 languages (consents, confirmation window, live gate, kill switch, refusal reasons; Stack D §7.9).

### 10.2 The April 2026 execution plan

- **Replaced:** the Python bridge, the Windows VPS per trader, the inbound port, the vault of bridge
  addresses, and the stored broker password.
- **Kept:** the guardrails (lot cap, daily loss cap, concurrent-trade cap: G4, G6, G7), the
  circuit-breaker idea (G7) and the rollout idea, which becomes analysis only → demo with Manual →
  real money with Manual → Auto later.

---

## 11. Proposed decisions

None of these is settled. Each becomes an ADR (next free number: 100) once Davin decides.

| #    | Decision                    | Recommended                                                                        | Alternative                                             | Sign-off                                     |
| ---- | --------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------- |
| P-1  | DavinTrade transmits orders | Yes, through Lane A, orders the trader confirms; supersedes ADR-069 in part        | Stay analysis-only                                      | ⚠ NEEDS EXPLICIT SIGN-OFF (money) + counsel |
| P-2  | Desktop shell               | Electron, loading the web app, with the Local Connector; Windows first             | Tauri; or a tray-only Connector next to the browser     | Davin                                        |
| P-3  | Source of analysis          | The central feed only; the trader's terminal never feeds a sensor                  | Analysis from each trader's own terminal                | Davin                                        |
| P-4  | Lane B server               | Yes, read-only, as a monolith route, after Stack D's reply path is live            | No Lane B; or a separate service                        | Davin                                        |
| P-5  | Lane B scope                | Context and Report 1 only; no Report 2                                             | Include sized Report 2 numbers                          | Davin + counsel                              |
| P-6  | Live-account gate           | A separate consent, after N filled demo orders                                     | No real money in the first release                      | ⚠ NEEDS EXPLICIT SIGN-OFF + counsel         |
| P-7  | Confirmation modes          | Manual only at first; Auto later by its own decision; Bypass never                 | Auto at launch                                          | ⚠ NEEDS EXPLICIT SIGN-OFF                   |
| P-8  | Guard starting values       | As in §7.2                                                                         | —                                                       | Davin                                        |
| P-9  | Price-gap tolerance         | Move prices by the gap within $0.50; refuse above                                  | Refuse any gap                                          | Davin                                        |
| P-10 | Records and retention       | Execution records always, 7 years; full history only with sync                     | Sync everything                                         | Davin + counsel                              |
| P-11 | Tiers                       | Execution and Lane B: Pro. Read-only connector and dashboard: Davin's choice       | —                                                       | Davin                                        |
| P-12 | Position block in chat      | Positions as distances and R; no money figures (keeps ADR-077)                     | Include the balance, with consent (as the example does) | Davin                                        |
| P-13 | Order identity              | DavinTrade magic number plus a `DT:<id>` comment tag                               | Comment only                                            | Davin                                        |
| P-14 | Pending-order expiry        | The earlier of the holding window and N cycles; cancel on invalidation or blackout | Good till cancelled                                     | Davin                                        |

---

## 12. Plan: phases M0 to M6

M1 and M2 do not depend on Stack D being in production, so they can start while Stack D's production
steps finish. M3 cannot: it needs real cycles and Engine 4 live.

| Phase                            | Delivers                                                                                                                                                                                                                     | Depends on                                                        | Done when                                                                                                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M0 Spike**                     | Verified facts on a demo account: the tool catalog (a `tools/list` dump with schemas), discovery and ports, key behaviour, the three trading-permission settings seen from an outside client, error texts, the minimum build | A Windows PC with MT5 6060 or later; a demo account               | A dated tool-catalog file exists; every R and T row of §1.1 is marked verified or corrected; the P-decisions are revisited                                        |
| **M1 Connect and read**          | Desktop shell, Local Connector, pairing, consent C1, account card, positions on the chart, health chip                                                                                                                       | M0                                                                | Two terminals on one PC are found; a port change is survived; a test shows the key never leaves the keychain; reading works with MT5 trading not allowed          |
| **M2 Dashboard and reports**     | Journal, history import, reports, optional sync (C4), web dashboard                                                                                                                                                          | M1                                                                | The reports match MT5's own history totals on a fixture account                                                                                                   |
| **M3 Execution on demo**         | Signed intents, guard, native confirmation, send, read-back, records, expiry, kill switch, consent C2                                                                                                                        | M1; P-1; Stack D build steps 2 and 5 live (real cycles, Engine 4) | Every guard check has a test; a fake MT5 server covers every row of §6.6; the unknown-outcome test never sends twice; two weeks of demo orders are all reconciled |
| **M4 Real money**                | The live gate (C3)                                                                                                                                                                                                           | M3 on demo; P-6; counsel                                          | Counsel's sign-off is recorded; the live texts exist in all 19 languages                                                                                          |
| **M5 Lane B**                    | DavinTrade MCP Server, tokens (C5)                                                                                                                                                                                           | Stack D's reply path and metering live (build step 7)             | MT5's own assistant answers "what is the M15 context?" from DavinTrade's tools on a demo terminal; every call is traced and metered                               |
| **M6 Consultant with positions** | The position block in the intake packet; the "my position" intent                                                                                                                                                            | M1; Stack D §4                                                    | The labelled set is extended and passes; a test shows no money figure ever reaches a prompt                                                                       |
| **Later**                        | Auto mode (its own decision), the browser-to-Connector hand-off, mobile notifications, macOS, position management by command                                                                                                 | —                                                                 | —                                                                                                                                                                 |

How the phases run follows the Stack D build rules (Stack D §7.10): a plan session, Davin's approval,
build sessions by part, a fresh check session, and a hand-off report after every session.

---

## 13. Open questions to verify

To answer in M0, on a real terminal, before anything is built on the answer:

1. The exact tool names, inputs and outputs in builds 6060, 6090 and 6230, and the first build with
   the order tools DavinTrade needs.
2. How terminals are found: a fixed first port (22346) and then the next free one? Does a terminal
   keep its port across restarts?
3. Does an MCP order need MT5's "Algo Trading" button on as well?
4. What "confirmation required" looks like to an outside client: a dialog inside MT5, a waiting
   call, or an error?
5. Can an MCP order set a magic number, a comment and a good-till-time expiry? How long may the
   comment be?
6. Does the server expose symbol properties (stops level, freeze level) and the economic calendar?
7. Does "Generate" revoke the old key at once? Can there be one key per client?
8. Does the internal server work under the macOS compatibility layers?
9. Does the internal server limit call rates or concurrent clients?
10. For counsel: does sending confirmed orders change DavinTrade's position in each target market?
    (`davintrade-law-and-regulation-compliance-stack/` holds the earlier compliance work.)

---

## Appendix A — Glossary

| Term                  | Meaning                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| Lane A                | DavinTrade Desktop as an MCP client of the trader's MT5 terminal: account, positions, history, orders         |
| Lane B                | Any MCP client (first of all MT5's own AI Assistant) calling DavinTrade's read-only MCP Server                |
| Local Connector       | The desktop app's main process: discovery, key vault, tool adapter, guard, confirmation, kill switch, journal |
| Order intent          | `exec-intent/1`: the signed, one-time description of one order, built only from an accepted Report 2 setup    |
| Order guard           | The deterministic checks G1 to G12 the Connector runs before every send                                       |
| Native confirmation   | The confirmation window the Connector draws itself, outside the web page                                      |
| Basis                 | The price gap between the trader's broker and DavinTrade's feed, measured at the same moment                  |
| Account fingerprint   | Server, login (hashed), trade mode and currency, re-read before every order                                   |
| Kill switch           | Stops every new DavinTrade order and cancels DavinTrade's pending orders at once                              |
| Trader broker profile | The trader's broker's figures for XAUUSD, used by Engine 4 instead of the feed broker's                       |
| Execution record      | The append-only cloud row for each intent and its MT5 result                                                  |
| Journal               | The local, append-only store of intents, results and imported MT5 history                                     |

## Appendix B — Sources

- MetaQuotes, [MetaTrader 5 Build 6060: AI Integration, Passkey, and Code Management Improvements in MetaEditor](https://www.metatrader5.com/en/releasenotes/terminal/2447)
  (also as [MetaQuotes news 5538](https://www.metaquotes.net/en/metatrader5/news/5538) and the
  [MQL5 forum thread](https://www.mql5.com/en/forum/512830)). Not opened directly; read through
  search summaries (§1.1, source R).
- Third-party guides on the MT5 MCP server (default endpoint, tool count; source T):
  [Switch Markets](https://www.switchmarkets.com/learn/mt5-mcp-server),
  [ForexVPS](https://www.forexvps.net/resources/mt5-mcp-use-cases-with-forex-vps/),
  [PineConnector](https://www.pineconnector.com/blogs/pico-blog/metatrader-5-updates-automated-trading).
- The reference app: [operational-steps-example/1.png to 22.png](operational-steps-example/)
  (Alphasigs Desktop 0.6.8; a terminal API key is visible in screenshots 5, 7 and 10 and is not
  copied here).
- [Stack D architecture](../docs/STACK-D-ARCHITECTURE.md) and its decisions in [`docs/adr/`](../docs/adr/README.md).
- [The April 2026 trade execution plan](../mt5-execution-stack/DAVINTRADE-TRADE-EXECUTION-STACK.md).

<!-- decision links -->

[ADR-050]: ../docs/adr/050-metering-from-actual-cost.md
[ADR-059]: ../docs/adr/059-setup-pinned-to-its-cycle.md
[ADR-060]: ../docs/adr/060-news-blackout.md
[ADR-066]: ../docs/adr/066-broker-figures-from-mt5.md
[ADR-069]: ../docs/adr/069-consent-record.md
[ADR-074]: ../docs/adr/074-one-entitlement-table.md
[ADR-077]: ../docs/adr/077-prompt-privacy.md
[ADR-094]: ../docs/adr/094-spread-and-the-fill-price-in-the-sizing.md
[ADR-097]: ../docs/adr/097-report-2-is-a-fixed-template-over-one-validated-setup.md
