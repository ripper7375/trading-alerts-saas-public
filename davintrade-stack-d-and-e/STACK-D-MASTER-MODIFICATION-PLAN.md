# Stack D — Master Architecture & Implementation Modification Plan

## 1. End-to-End Conversational Workflow Overview

```
[ 1. User Inputs Query in Chat Panel ]
"What is the current XAUUSD M5 market structure, and where is the optimal entry zone?"
                                  │
                                  ▼
[ 2. Frontend & Gating Layer ]
• Verify PRO Tier subscription & token quota (Redis Token Metering from Phase 11)
• Identify active chat thread context (1 Instrument = 1 Thread e.g. `XAUUSD M5`)
• Retrieve active user preferences & confirmed constraints (Risk Profile, Trader Type, etc.)
                                  │
                                  ▼
[ 3. Parallel 7-Pillar Retrieval Engine ] (Dispatched concurrently via Promise.all in < 100ms)
┌───────────────────────────────────────────────────────────┬───────────────────────────────────────────────────────────┐
│              📊 QUANTITATIVE & NARRATIVE (POSTGRESQL)     │                 🧠 KNOWLEDGE, VISION & PROFILE            │
├─────────────────────────────┬─────────────────────────────┼─────────────────────────────┬─────────────────────────────┤
│ 🔢 1. Numeric Data          │ 📈 2. Signal Density        │ 📖 5. Strategy Rules        │ 🖼️ 6. Matplotlib Vision    │
│    (Engine 1: VANNA NL2SQL) │    (Engine 1.5A: MCD Count) │    (Engine 2: txtai/RAG)    │    (Engine 3: MTF PNG)      │
│ • Raw 79 indicator columns  │ • Occurrence counts of MCDs │ • Default platform rules    │ • High-resolution 3-panel   │
│ • Price, EDT bounds, SSA    │   over the fixed 54-bar     │ • User custom overrides     │   chart image from buffer   │
│   slope, Z-score, ZigZag    │   lookback window           │   (Personalized strategies) │ • Visual wick inspection    │
├─────────────────────────────┼─────────────────────────────┼─────────────────────────────┴─────────────────────────────┤
│ 📜 3. Context Storyline     │ 🎯 4. Quant Direction       │ 👤 7. User Constraints & Preferences                      │
│    (Engine 1.5B: JSONB54)   │    (Engine 1.5C: WACS54)    │    (Engine 4: Profile & Preferences)                      │
│ • Chronological deduplicated│ • Weighted momentum & bias  │ • Account equity, risk ceiling per trade (Max RPT 0.5-2%) │
│   narrative events over     │   confluence score          │ • Platform-wide Fixed 54-Bar Standard (M5: 4.5h, M15: 13h)│
│   54 bars (JSONB54)         │   (Range: -100 to +100)     │ • Maximum leverage ceiling (1:5.0x max institutional cap) │
└─────────────────────────────┴─────────────────────────────┴───────────────────────────────────────────────────────────┘
                                                            │
                                                            ▼
[ 4. Multimodal Context Assembly Layer (7-Pillar Super-Prompt Composition) ]
Assembles all 7 dimensions to provide 360-degree market context:
  ① Numeric Stats (79 columns)             ➔ Price $2,634.50, Lower EDT $2,628.43, Slope +0.32
  ② Signal Density (MCD Frequency Counts)  ➔ Test Lower EDT = 3 times, Z-score Expansion = 2 times
  ③ Context Storyline (JSONB54 Narrative) ➔ "Lower EDT tested 8 bars ago -> Bounced to form HL 3 bars ago"
  ④ Direction Confluence (WACS54: -100..+100)➔ WACS54 = +82 (Strong Bullish Confluence Index)
  ⑤ Personalized Strategy Rules            ➔ Institutional rules + User custom playbook constraints
  ⑥ Chart Vision PNG (Computer Vision)    ➔ [ 3-Panel high-res visual chart for candlestick geometric analysis ]
  ⑦ Risk & Account Bounds (Engine 4)      ➔ Equity $10,000 | Risk $200 (2.0%) | Lookback = 54 Bars (Fixed Standard)
                                                            │
                                                            ▼
[ 5. Multimodal LLM Router (Multi-Vision AI Brain) ]
Dispatched to LLMs :
• Synthesizes computer vision chart image against 79-column numeric data
• References Storyline, MCD counts, and WACS54 to generate deterministic, hallucination-free technical analysis
                                                            │
                                                            ▼
[ 6. Streaming Response & Dynamic Setup Card ]
• Real-time Server-Sent Events (SSE) streaming markdown response
• Renders interactive Dynamic Trade Setup Card (TradeSetupCard.tsx) directly in chat:
  ┌────────────────────────────────────────────────────────────────────────┐
  │ 🟢 TRADE SETUP CARD: XAUUSD M5                             [BUY LIMIT] │
  ├────────────────────────────────────────────────────────────────────────┤
  │ • Direction Signal: Strong Buy (WACS54: +82 | Triple Bottom @ Lower EDT│
  │ • Entry Price:      $2,634.50 (Lower Channel Rejection Support)        │
  │ • Take Profit (TP): $2,648.00 (Mid Base Line Target)                   │
  │ • Stop Loss (SL):   $2,627.00 (Below Structure Low)                    │
  │ • Risk / Reward:    1 : 3.2    | Position Size: 0.15 Lot (Risk 2%)     │
  └────────────────────────────────────────────────────────────────────────┘
```

## 2. 7-Pillar Retrieval Pipeline Summary

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        7-PILLAR SUPERCHARGED RETRIEVAL PIPELINE                        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Numeric Data (Engine 1)         : 79 Columns Raw Values (Price, Indicators, SSA)    │
│ 2. Signal Density (Engine 1.5A)    : MCD Occurrence Counts in Last 54 Bars (FREQ54_MCD)│
│ 3. Context Storyline (Engine 1.5B) : Deduplicated Event Timeline (JSONB54 Narrative)   │
│ 4. Quant Direction (Engine 1.5C)   : WACS54 Score (-100 to +100 Weighted Confluence)   │
│ 5. Strategy Rules (Engine 2)       : Default Playbooks + User Strategy Overrides       │
│ 6. Visual Vision (Engine 3)        : 3-Panel High-Res Chart Image (mtf_render PNG)     │
│ 7. User Constraints (Engine 4)     : Account Balance, Risk Bounds & Fixed 54-Bar Std   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

## 3. Database Schema Extension (`market_data_v6`)

```
======================================================================================================================================================================
                                                                         TABLE: market_data_v6
======================================================================================================================================================================
Col 1 - 79          | Col 80 - 89 | Col 90 - 99    | Col 100   | Col 101    | Col 102
Headers of 1 - 79   | MCD01 - 10  | FREQ54_MCD01-10| JSONB54   | Conf_Score | WACS54
--------------------+-------------+----------------+-----------+------------+-------
[OHLCV & Indicators]| [Active MCD]| [Freq in 54 b] | {JSON54}  |         65 |    55
[OHLCV & Indicators]| [Active MCD]| [Freq in 54 b] | {JSON54}  |         67 |    63
[OHLCV & Indicators]| [Active MCD]| [Freq in 54 b] | {JSON54}  |         71 |    65
======================================================================================================================================================================

[COLUMN DEFINITIONS & ANNOTATIONS]
----------------------------------------------------------------------------------------------------------------------------------------------------------------------
1. Columns 1 - 79    : Raw OHLCV + Primary Calculated Indicator Columns (6 Centroid Variants, SSA, Z-score, ZigZag, Fractals).
2. Columns 80 - 89   : MCD01 to MCD10_VALID (Instantaneous Market Circumstance flags on the current bar).
3. Columns 90 - 99   : FREQ54_MCD01 to FREQ54_MCD10 (Occurrence counts of each MCD state in the fixed 54-bar lookback window).
4. Column 100        : JSONB54 (Structured Narrative Payload & Context Timeline over 54 bars, deduplicated).
5. Column 101        : Conf_Score (Current bar instantaneous Confluence Score: -100 to +100).
6. Column 102        : WACS54 (Weighted Average Confluence Score of last 54 bars: -100 to +100).

[ARCHITECTURAL NOTES]
----------------------------------------------------------------------------------------------------------------------------------------------------------------------
* Note 1: MCD is not limited to MCD1 to MCD10. The total number of MCDs depends on the upcoming exhaustive architecture design (MCD1 to MCD_m).
* Note 2: Lookback window is permanently standardized and fixed at 54 bars (Fixed 54-Bar Standard) to optimize database indexing and ensure deterministic mathematical feature vectors for the LLM.
```
