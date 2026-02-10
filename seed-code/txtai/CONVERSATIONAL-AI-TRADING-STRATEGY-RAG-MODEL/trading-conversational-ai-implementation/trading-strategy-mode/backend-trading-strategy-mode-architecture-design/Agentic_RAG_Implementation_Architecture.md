# Agentic RAG Implementation Architecture for Trading Conversational AI SaaS

**Document Type:** Implementation Architecture & Knowledge Base Design  
**Version:** 1.0  
**Companion To:** Agentic AI Trading Model Architecture Blueprint v2.1  
**Purpose:** Translate the trading workflow blueprint into a concrete LangChain-based agentic framework with VectorDB knowledge base, connecting pre-computed indicator data to conversational AI trade analysis  
**Target Stack:** Next.js 15 (Frontend) → LangChain/LangGraph (Agent Framework) → Flask MT5 Service (Data Pipeline) → PostgreSQL (Structured Data) → Vector Store (Knowledge Base) → Claude API (LLM)

---

## 1. System Overview

### 1.1 The Two Knowledge Systems

The agentic trading system operates on two fundamentally different types of knowledge that require different storage and retrieval mechanisms:

**Structured Knowledge (PostgreSQL) — "What is happening right now"**

This is the real-time and recent market data: OHLC candles, pre-computed trendline parameters, momentum Z-Scores, TEMA/HRMA values, S/R Zone clusters, structural density scores. This data changes every bar and must be queried with precision (exact prices, exact timeframes, exact instruments). It is stored in PostgreSQL relational tables and retrieved via direct SQL queries — not vector search.

This data corresponds to the right-side panels in DavinTrade: the XAUUSD H2 resistance at 2673.93, the H1 support at 2662.36, the M30 support at 2652.55, the slope values, Keltner zones, touch counts, and breakout percentages. These are computed numerical outputs that the agent consumes as structured inputs.

**Unstructured Knowledge (VectorDB) — "How to interpret what is happening"**

This is the trading methodology, decision logic, and analytical framework: the Blueprint v2.1 document, indicator interpretation guides, the convergence scoring system, the state machine specification, the LLM judgment principles, price pattern recognition rules. This knowledge is relatively static (updated when the methodology evolves, not every bar) and must be retrieved by semantic relevance when the agent needs guidance on how to interpret the structured data.

This is the "brain" that tells the agent: "When you see a trendline with slope -23.3° and 5 touches, within a counter-trend regime, with a developing double bottom at the zone, here is how to evaluate whether to enter."

**The agent bridges both systems:** It retrieves structured data from PostgreSQL to know the current market state, then retrieves unstructured knowledge from VectorDB to know how to analyze that state, then synthesizes both into a trade assessment that it presents conversationally to the user.

### 1.2 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DavinTrade Frontend (Next.js 15)                  │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────────────┐  │
│  │ Chat UI  │  │ TradingView  │  │  Multi-TF S/R Data Cards     │  │
│  │ (Claude) │  │ Chart Widget │  │  (H2, H1, M30 panels)        │  │
│  └────┬─────┘  └──────────────┘  └──────────────────────────────┘  │
│       │                                                             │
│       │  WebSocket / REST API                                       │
└───────┼─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────┐
│              LangGraph Agent Orchestrator (Python)                   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Agent State Machine                        │   │
│  │  IDLE → NAVIGATING → SCANNING → BREAKOUT_DETECTED →          │   │
│  │  AWAITING_PULLBACK → PULLBACK_TESTING → EXECUTING → ENTERED  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐      │
│  │  Tool:        │  │  Tool:        │  │  Tool:               │      │
│  │  Market Data  │  │  Knowledge    │  │  Trade Execution     │      │
│  │  Retriever    │  │  Retriever    │  │  Manager             │      │
│  │  (PostgreSQL) │  │  (VectorDB)   │  │  (State + Orders)    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘      │
│         │                  │                      │                  │
└─────────┼──────────────────┼──────────────────────┼──────────────────┘
          │                  │                      │
          ▼                  ▼                      ▼
┌──────────────┐  ┌──────────────────┐  ┌────────────────────────┐
│  PostgreSQL  │  │  Vector Store    │  │  Flask MT5 Service     │
│  (Railway)   │  │  (Pinecone /     │  │  (Data Pipeline +      │
│              │  │   Qdrant /       │  │   Order Execution)     │
│  - OHLC      │  │   Chroma)        │  │                        │
│  - Trendlines│  │                  │  │  - MT5 Connection      │
│  - Momentum  │  │  - Blueprint     │  │  - Bar Data Fetch      │
│  - TEMA/HRMA │  │  - Indicator     │  │  - Indicator Compute   │
│  - Zones     │  │    Guides        │  │  - Order Placement     │
│  - State     │  │  - Decision      │  │                        │
│  - Audit Log │  │    Logic         │  │                        │
│              │  │  - Patterns      │  │                        │
└──────────────┘  └──────────────────┘  └────────────────────────┘
```

### 1.3 Data Flow for a Single Evaluation Cycle

```
1. Trigger: New bar closes on primary Decision TF (e.g., H1)
       │
2. Flask MT5 Service fetches latest OHLC from MetaTrader 5
       │
3. Flask computes indicators (trendlines, momentum Z-scores, TEMA/HRMA)
       │
4. Flask writes computed data to PostgreSQL
       │
5. LangGraph Agent receives trigger (webhook or polling)
       │
6. Agent Tool: Market Data Retriever queries PostgreSQL
   → Fetches all 6 TF data: trendlines, momentum, MAs, zones
   → Constructs structured market state object
       │
7. Agent Tool: Knowledge Retriever queries VectorDB
   → Retrieves relevant blueprint sections based on current state
   → E.g., if state=PULLBACK_TESTING, retrieves Section 3.1 (pullback
     confirmation), Section 3.3 (price patterns), Section 8.3 (LLM
     principles for pullback evaluation)
       │
8. Agent constructs LLM evaluation prompt combining:
   → Structured market state (from PostgreSQL)
   → Methodology knowledge (from VectorDB)
   → State machine context (from state persistence)
       │
9. Claude API evaluates and produces:
   → Convergence score (5-factor breakdown)
   → State transition decision
   → Natural language reasoning
       │
10. Agent updates state machine, logs to audit table
        │
11. If state=EXECUTING → Agent Tool: Trade Execution Manager
    places orders via Flask MT5 Service
        │
12. Agent produces conversational response for Chat UI
    → "XAUUSD H1: Breakout confirmed above 2672 resistance.
       Pullback testing zone 2662-2672 with density score 7.
       Developing double bottom at zone. Convergence: +6.5.
       Placing pyramid lots..."
```

---

## 2. Knowledge Base Design — VectorDB

### 2.1 What Goes Into the VectorDB

The VectorDB stores the **methodology and decision framework** — the "how to think" knowledge. This is chunked from the Blueprint v2.1 document and supplemented with additional interpretive guides.

**Source documents to vectorize:**

| Document                                                                 | Purpose                                                                                                                                | Update Frequency                                  |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Blueprint v2.1 (Sections 1-10 + Appendices)                              | Core methodology: 2-3-2 architecture, indicator specs, strategy definition, convergence scoring, state machine, LLM judgment framework | When methodology evolves (weeks/months)           |
| Indicator Interpretation Guide (derived from Blueprint Sections 2.1-2.3) | Detailed rules for interpreting each indicator's output in context                                                                     | When indicator parameters change                  |
| Price Pattern Reference (derived from Blueprint Section 3.3)             | Recognition criteria for double bottom/top, higher low, hammer, engulfing patterns at S/R zones                                        | When new patterns are added                       |
| Instrument-Specific Profiles                                             | Per-instrument characteristics: typical volatility, session behavior, recommended TF config, historical trendline slope distributions  | As instruments are added or behavior changes      |
| Trade Examples (Annotated)                                               | Historical trade setups with full convergence score breakdowns, LLM reasoning, and outcomes — both successful and failed trades        | After each significant trade for ongoing learning |

### 2.2 Chunking Strategy

The Blueprint v2.1 is a 1,078-line document with dense, interconnected content. Naive chunking (e.g., splitting every 500 tokens) will break the logical structure and produce fragments that lack context. The chunking strategy must respect the document's semantic boundaries.

**Chunking approach: Section-based with cross-reference metadata**

Each chunk corresponds to a logically complete section or subsection of the Blueprint. Chunks are tagged with metadata that enables the retriever to pull related chunks when needed.

**Chunk inventory from Blueprint v2.1:**

| Chunk ID                     | Source Section                                 | Content Summary                                                                                | Tokens (approx) | Key Metadata Tags                                                     |
| ---------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------- |
| `arch-232`                   | 1.1 (2-3-2 Model)                              | Navigation/Decision/Execution layer definitions and roles                                      | ~800            | `architecture`, `layers`, `timeframe-mapping`                         |
| `arch-config`                | 1.2 (Configurable TF Mapping)                  | Config A/B tables, instrument defaults                                                         | ~500            | `architecture`, `configuration`, `instruments`                        |
| `ind-trendline`              | 2.1 (Fractal Trendline)                        | Trendline computation, scoring weights, tolerance zones, role reversal                         | ~900            | `indicator`, `trendline`, `fractal`, `support-resistance`             |
| `ind-momentum`               | 2.2 (Momentum Candles)                         | Z-Score computation, classification thresholds, invigorated vs exhausting framework            | ~800            | `indicator`, `momentum`, `z-score`, `candle-classification`           |
| `ind-momentum-pullback`      | 2.2 (Momentum Pullback Principle)              | Critical principle for momentum during pullback — bounce requirement, spring/shakeout          | ~400            | `indicator`, `momentum`, `pullback`, `bounce`, `spring-pattern`       |
| `ind-tema-hrma`              | 2.3 (TEMA/HRMA)                                | Computation formulas, gap analysis table, pullback nuance                                      | ~700            | `indicator`, `tema`, `hrma`, `moving-average`, `gap-analysis`         |
| `strategy-breakout`          | 3.1 (Breakout + Pullback)                      | Phase A/B definitions, breakout quality factors, pullback confirmation with bounce requirement | ~1000           | `strategy`, `breakout`, `pullback`, `confirmation`, `bounce`          |
| `strategy-zone`              | 3.2.1-3.2.2 (S/R Zone Collection + Clustering) | TF-agnostic collection, proximity clustering procedure                                         | ~600            | `strategy`, `zone`, `clustering`, `proximity`, `sr-levels`            |
| `strategy-density`           | 3.2.3 (Structural Density)                     | Density scoring factors, zone-level scoring, dynamic degradation                               | ~500            | `strategy`, `zone`, `density`, `structural-quality`                   |
| `strategy-pyramid`           | 3.2.4 (Pyramid Allocation)                     | Pyramid vs even allocation, lot sizing model                                                   | ~600            | `strategy`, `pyramid`, `lot-allocation`, `risk-management`            |
| `strategy-patterns`          | 3.3 (Price Pattern Confirmation)               | Double bottom/top, higher low, hammer, engulfing at S/R zones, pattern scoring                 | ~800            | `strategy`, `patterns`, `double-bottom`, `double-top`, `confirmation` |
| `nav-regime`                 | 4.1-4.2 (Navigation Regime)                    | Aggregate slope score computation, regime classification thresholds                            | ~700            | `navigation`, `regime`, `slope-score`, `classification`               |
| `nav-countertrend`           | 4.3 (Counter-Trend Modifier)                   | Modifier table, effect on entry threshold                                                      | ~300            | `navigation`, `counter-trend`, `modifier`, `confidence`               |
| `nav-llm`                    | 4.4 (Navigation LLM Judgment)                  | Where rules vs LLM judgment apply in Navigation                                                | ~400            | `navigation`, `llm-judgment`, `regime-transition`                     |
| `decision-procedure`         | 5.1-5.2 (Decision Outputs + Analysis)          | ENTER/WAIT/NO TRADE/INVALIDATED outputs, three-TF analysis procedure                           | ~600            | `decision`, `outputs`, `analysis`, `convergence`                      |
| `decision-convergence`       | 5.3 (Convergence Assessment)                   | 5-factor scoring table, thresholds, LLM overlay descriptions                                   | ~1200           | `decision`, `convergence`, `scoring`, `thresholds`, `llm-overlay`     |
| `decision-zone-construction` | 5.4 (Entry Zone Construction)                  | Zone construction procedure referencing Sections 3.2-3.3                                       | ~500            | `decision`, `zone`, `construction`, `density`, `pyramid`              |
| `decision-disqualifying`     | 5.5 (Disqualifying Conditions)                 | Hard invalidation rules + non-disqualifying conditions with LLM evaluation                     | ~500            | `decision`, `invalidation`, `disqualifying`, `hard-rules`             |
| `execution-principles`       | 6.1-6.2 (Execution Principles)                 | Minimal criteria, active rejection evaluation, what's NOT required                             | ~700            | `execution`, `principles`, `rejection`, `bounce`, `timing`            |
| `execution-orders`           | 6.3-6.4 (Order Placement + LLM)                | Limit/market order logic, pace assessment, zone adjustment, urgency                            | ~500            | `execution`, `orders`, `limit`, `market`, `llm-judgment`              |
| `state-machine`              | 7.1-7.2 (States + Transitions)                 | Full state definitions and transition map                                                      | ~1200           | `state-machine`, `states`, `transitions`, `workflow`                  |
| `state-persistence`          | 7.3 (Persistence Requirements)                 | Data persistence table across evaluation cycles                                                | ~400            | `state-machine`, `persistence`, `data-requirements`                   |
| `llm-rules-principles`       | 8.1-8.3 (Rule-Principle Spectrum)              | Hard rules list, soft principles list, graceful fallback hierarchy                             | ~1200           | `llm-framework`, `rules`, `principles`, `fallback`, `override`        |
| `llm-prompt-template`        | 8.5 (Evaluation Prompt Template)               | Context structure and expected LLM output format                                               | ~400            | `llm-framework`, `prompt`, `template`, `evaluation`                   |
| `params-reference`           | Appendix A                                     | All indicator parameters with defaults and DB column suggestions                               | ~500            | `reference`, `parameters`, `configuration`                            |
| `convergence-quickref`       | Appendix C                                     | 5-factor scoring quick reference table                                                         | ~400            | `reference`, `convergence`, `scoring`, `quick-reference`              |

**Total: ~26 chunks, averaging ~600 tokens each.**

### 2.3 Metadata Schema

Each chunk in the VectorDB is stored with structured metadata that enables filtered retrieval:

```json
{
  "chunk_id": "strategy-breakout",
  "source_document": "blueprint_v2.1",
  "section_number": "3.1",
  "section_title": "Core Trading Strategy: Breakout + Pullback Confirmation",
  "layer": "decision", // navigation | decision | execution | framework | reference
  "topic_tags": ["strategy", "breakout", "pullback", "confirmation", "bounce"],
  "state_relevance": [
    "SCANNING",
    "BREAKOUT_DETECTED",
    "AWAITING_PULLBACK",
    "PULLBACK_TESTING"
  ],
  "indicator_relevance": ["trendline", "momentum", "tema-hrma"],
  "version": "2.1",
  "last_updated": "2026-02-07"
}
```

**Key metadata fields for filtered retrieval:**

| Field                 | Purpose                                        | Example Query Use                                                                         |
| --------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `layer`               | Filter by architectural layer                  | "I'm in the Decision Layer — only retrieve decision-relevant chunks"                      |
| `topic_tags`          | Semantic topic filtering                       | "I need info about pullback confirmation — match on 'pullback', 'bounce', 'confirmation'" |
| `state_relevance`     | Filter by current state machine state          | "Current state is PULLBACK_TESTING — only retrieve chunks relevant to this state"         |
| `indicator_relevance` | Filter by which indicators are being evaluated | "I'm evaluating a momentum candle at support — retrieve momentum interpretation chunks"   |

### 2.4 Retrieval Strategy — Hybrid Search

The VectorDB retriever uses a **hybrid approach** combining semantic similarity with metadata filtering:

**Step 1: State-based pre-filter**
Based on the current state machine state, narrow the candidate chunks to those tagged with the current state in `state_relevance`. This eliminates chunks about order placement when the agent is in SCANNING state, and eliminates chunks about breakout detection when the agent is in EXECUTING state.

**Step 2: Query-based semantic search**
Within the pre-filtered set, perform semantic similarity search using a query constructed from the current evaluation context. The query is not the user's chat message — it is a structured analytical query generated by the agent.

Example constructed queries by state:

| State             | Constructed Retrieval Query                                                                                           |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| NAVIGATING        | "How to compute aggregate regime classification from trendline slopes across navigation timeframes"                   |
| SCANNING          | "How to evaluate breakout potential when price approaches resistance trendline with momentum candle"                  |
| BREAKOUT_DETECTED | "How to assess breakout quality: body close, momentum context, TEMA/HRMA state, navigation alignment"                 |
| PULLBACK_TESTING  | "How to evaluate whether S/R zone is holding with active bounce, price pattern confirmation, zone structural density" |
| EXECUTING         | "How to optimize entry timing within approved zone, pace assessment, active rejection criteria"                       |

**Step 3: Top-K retrieval with cross-reference expansion**
Retrieve top 3-5 chunks by semantic similarity. Then check their `topic_tags` for cross-references — if a retrieved chunk references concepts covered in other chunks (e.g., the breakout chunk references "convergence scoring"), pull the related chunk as supplementary context.

**Step 4: Context assembly**
Assemble the retrieved chunks into a coherent knowledge context block that is injected into the LLM evaluation prompt. Order by structural relevance: framework/principle chunks first, then specific technical chunks, then reference/parameter chunks.

### 2.5 VectorDB Implementation Options

| Option                              | Pros                                                                  | Cons                                                                              | Recommendation                                        |
| ----------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Pinecone**                        | Managed, scalable, good metadata filtering, serverless tier available | External dependency, cost at scale                                                | Good for production SaaS                              |
| **Qdrant**                          | Self-hostable, excellent metadata filtering, good hybrid search       | Requires hosting management                                                       | Good if you want full control                         |
| **ChromaDB**                        | Simple, Python-native, local-first, easy dev setup                    | Less mature at scale, limited metadata filtering                                  | Good for development/prototyping                      |
| **pgvector (PostgreSQL extension)** | Keeps everything in one DB, no additional service                     | Less sophisticated search, no native metadata filtering like dedicated vector DBs | Good for simplicity if chunk count stays small (<100) |

**Recommendation for DavinTrade:** Start with **ChromaDB** for development (it runs locally, zero configuration, integrates cleanly with LangChain). Migrate to **Pinecone or Qdrant** for production deployment when the knowledge base grows beyond the initial Blueprint chunks to include trade examples and instrument profiles.

Given the current knowledge base size (~26 chunks from Blueprint + future growth to maybe 100-200 chunks with trade examples), even pgvector would work. The key factor is metadata filtering quality — Pinecone and Qdrant handle the state-based pre-filtering much better than pgvector.

---

## 3. LangGraph Agent Framework Design

### 3.1 Why LangGraph over Basic LangChain

The trading agent requires **stateful, multi-step reasoning** with conditional branching — the state machine from Blueprint Section 7 maps directly to a LangGraph graph. Basic LangChain chains are linear (prompt → LLM → output). LangGraph provides:

- **Graph-based execution flow** — Each state machine state becomes a node. Transitions become edges with conditions.
- **Persistent state** — The agent's state (current trading state, breakout bar info, zone map, etc.) persists across evaluation cycles.
- **Conditional routing** — After each LLM evaluation, the agent routes to the appropriate next state based on the LLM's output.
- **Tool integration** — Each node can invoke tools (Market Data Retriever, Knowledge Retriever, Trade Execution Manager).
- **Human-in-the-loop** — The conversational interface allows the user to override or guide the agent's decisions.

### 3.2 Agent Graph Architecture

```
                    ┌──────────────────┐
                    │   TRIGGER NODE   │
                    │  (New bar close   │
                    │   or user query)  │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  FETCH DATA NODE │
                    │  Tool: Market    │
                    │  Data Retriever  │
                    │  → PostgreSQL    │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  FETCH KNOWLEDGE │
                    │  NODE            │
                    │  Tool: Knowledge │
                    │  Retriever       │
                    │  → VectorDB      │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │   NAVIGATE NODE  │
                    │  Compute regime, │
                    │  slope score,    │
                    │  counter-trend   │
                    │  modifier        │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  EVALUATE NODE   │     ┌─────────────┐
                    │  (Core LLM Call) │────►│ NO TRADE /  │
                    │  Convergence     │     │ INVALIDATED │──► END
                    │  scoring + LLM   │     └─────────────┘
                    │  judgment        │
                    └────────┬─────────┘
                             │ WAIT or ENTER
                    ┌────────▼─────────┐
                    │  ZONE BUILD NODE │
                    │  Construct S/R   │
                    │  zone, density,  │
                    │  pyramid alloc   │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  EXECUTE NODE    │
                    │  Tool: Trade     │
                    │  Execution Mgr   │
                    │  → Flask MT5     │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  RESPOND NODE    │
                    │  Generate chat   │
                    │  response for    │
                    │  user            │
                    └──────────────────┘
```

### 3.3 Agent State Schema

The LangGraph agent maintains a persistent state object that carries all context across nodes and across evaluation cycles:

```python
from typing import TypedDict, Optional, Literal
from datetime import datetime

class TrendlineData(TypedDict):
    timeframe: str                    # "H2", "H1", "M30", etc.
    line_type: str                    # "resistance" or "support"
    projected_price: float            # Price at current bar
    slope_degrees: float              # Slope angle
    touch_count: int                  # Number of fractal touches
    score: float                      # Fractal V5 composite score
    status: str                       # "intact", "broken", "role_reversed"
    distance_to_price_pct: float      # Distance from current price as %

class MomentumData(TypedDict):
    timeframe: str
    z_score: float
    classification: str               # "normal", "large", "extreme"
    direction: str                    # "bullish" or "bearish"
    bar_index: int                    # Which bar (0 = current)

class TEMAHRMAData(TypedDict):
    timeframe: str
    tema_value: float
    hrma_value: float
    gap_absolute: float
    gap_pct: float
    gap_state: str                    # "wide_bullish", "narrow_bullish", "crossover_bullish",
                                      # "intertwined", "crossover_bearish", "narrow_bearish",
                                      # "wide_bearish"

class SRLevel(TypedDict):
    price: float
    source_timeframe: str
    trendline_type: str               # "resistance_broken" (now support), "support_intact", etc.
    touch_count: int
    density_contribution: float

class SRZone(TypedDict):
    upper_boundary: float
    lower_boundary: float
    midpoint: float
    levels: list[SRLevel]
    density_score: float
    broken_levels: list[str]          # IDs of levels that have broken during testing
    width_pct: float                  # Zone width as % of price

class LotAllocation(TypedDict):
    level_price: float
    lot_pct: float                    # % of total position
    source_timeframe: str
    fill_status: str                  # "pending", "filled", "cancelled"
    fill_price: Optional[float]
    fill_time: Optional[datetime]

class ConvergenceScore(TypedDict):
    trendline: int                    # -2 to +2
    momentum: int                     # -2 to +2
    tema_hrma: int                    # -2 to +2
    navigation: int                   # -2 to +2
    price_pattern: int                # -2 to +2
    raw_total: int                    # Sum, -10 to +10
    counter_trend_modifier: float     # 0.6 to 1.0
    adjusted_total: float             # raw × modifier
    llm_adjustment: float             # LLM override amount
    final_score: float                # adjusted + llm_adjustment

class PricePatternState(TypedDict):
    pattern_type: Optional[str]       # "double_bottom", "higher_low", "hammer", "engulfing", None
    development_status: str           # "none", "forming", "completed"
    first_test_price: Optional[float]
    second_test_price: Optional[float]
    neckline_price: Optional[float]
    evidence_notes: str

class AgentState(TypedDict):
    # === Identity ===
    instrument: str                   # "XAUUSD", "BTCUSD", etc.
    tf_config: str                    # "A" or "B"
    trade_direction: str              # "long" or "short"

    # === State Machine ===
    current_state: str                # IDLE, NAVIGATING, SCANNING, etc.
    previous_state: str
    state_entered_at: datetime
    bars_in_state: int
    cooldown_remaining: int           # Bars remaining if in cooldown

    # === Navigation Layer ===
    aggregate_slope_score: float
    regime_classification: str        # "strong_bearish", "bearish", "neutral", "bullish", "strong_bullish"
    counter_trend_flag: bool
    counter_trend_modifier: float
    navigation_trendlines: list[TrendlineData]

    # === Decision Layer — Market Data ===
    decision_trendlines: list[TrendlineData]
    decision_momentum: list[MomentumData]
    decision_tema_hrma: list[TEMAHRMAData]
    current_price: float
    current_bar_time: datetime

    # === Decision Layer — Zone ===
    sr_zone: Optional[SRZone]
    lot_allocations: list[LotAllocation]
    pyramid_mode: str                 # "pyramid" or "even"

    # === Decision Layer — Scoring ===
    convergence: Optional[ConvergenceScore]
    convergence_history: list[ConvergenceScore]  # Last 10

    # === Decision Layer — Price Pattern ===
    price_pattern: PricePatternState

    # === Breakout Context ===
    breakout_bar_index: Optional[int]
    breakout_bar_price: Optional[float]
    breakout_trendline: Optional[TrendlineData]

    # === Execution Layer ===
    execution_trendlines: list[TrendlineData]
    execution_tema_hrma: list[TEMAHRMAData]

    # === Knowledge Context (from VectorDB) ===
    retrieved_knowledge: str          # Assembled knowledge chunks for current evaluation

    # === LLM Outputs ===
    llm_assessment: str               # Latest LLM reasoning text
    llm_confidence: str               # "high", "medium", "low"
    llm_override_flag: bool
    llm_override_reason: Optional[str]

    # === Chat ===
    chat_history: list[dict]          # Conversation history
    pending_response: str             # Response to send to user

    # === Audit ===
    audit_log_entry: dict             # Current cycle's log entry
```

### 3.4 Node Implementations

#### 3.4.1 TRIGGER NODE

```python
# Determines what triggered this cycle and what the agent should do
def trigger_node(state: AgentState) -> AgentState:
    """
    Entry point for each evaluation cycle.
    Triggers:
    1. New bar close (periodic) — run full evaluation pipeline
    2. User chat message — respond conversationally, may also trigger evaluation
    3. State timeout — check if current state has exceeded time limits
    """
    # Determine trigger type from incoming event
    # If periodic: set evaluation_mode = "full_cycle"
    # If user message: set evaluation_mode = "conversational" (may include evaluation)
    # If timeout: set evaluation_mode = "timeout_check"
    return state
```

#### 3.4.2 FETCH DATA NODE

```python
# Tool: Market Data Retriever
def fetch_data_node(state: AgentState) -> AgentState:
    """
    Queries PostgreSQL for all market data needed for current evaluation.
    Uses the instrument and tf_config to determine which timeframes to fetch.
    """
    instrument = state["instrument"]
    config = TIMEFRAME_CONFIGS[state["tf_config"]]

    # Fetch Navigation TF data
    nav_data = fetch_navigation_data(instrument, config["nav_upper"], config["nav_lower"])
    state["navigation_trendlines"] = nav_data["trendlines"]
    state["aggregate_slope_score"] = compute_aggregate_slope(nav_data)
    state["regime_classification"] = classify_regime(state["aggregate_slope_score"])

    # Fetch Decision TF data
    dec_data = fetch_decision_data(
        instrument,
        config["decision_upper"],
        config["decision_primary"],
        config["decision_lower"]
    )
    state["decision_trendlines"] = dec_data["trendlines"]
    state["decision_momentum"] = dec_data["momentum_candles"]
    state["decision_tema_hrma"] = dec_data["tema_hrma"]
    state["current_price"] = dec_data["current_price"]

    # Fetch Execution TF data (if in EXECUTING state)
    if state["current_state"] in ["EXECUTING", "PULLBACK_TESTING"]:
        exec_data = fetch_execution_data(
            instrument, config["exec_upper"], config["exec_lower"]
        )
        state["execution_trendlines"] = exec_data["trendlines"]
        state["execution_tema_hrma"] = exec_data["tema_hrma"]

    # Construct S/R Zone from collected trendlines (Section 3.2)
    state["sr_zone"] = construct_sr_zone(
        state["decision_trendlines"],
        state["current_price"]
    )

    # Detect price patterns at zone (Section 3.3)
    state["price_pattern"] = detect_price_patterns(
        dec_data["recent_swings"],
        state["sr_zone"]
    )

    return state
```

#### 3.4.3 FETCH KNOWLEDGE NODE

```python
# Tool: Knowledge Retriever
def fetch_knowledge_node(state: AgentState) -> AgentState:
    """
    Retrieves relevant methodology chunks from VectorDB
    based on current state and evaluation context.
    """
    # Step 1: State-based pre-filter
    state_filter = {"state_relevance": {"$in": [state["current_state"]]}}

    # Step 2: Construct analytical query based on what the agent needs to evaluate
    query = construct_retrieval_query(state)
    # E.g., for PULLBACK_TESTING:
    # "pullback confirmation active bounce zone density price pattern
    #  convergence scoring LLM judgment principles"

    # Step 3: Hybrid search — metadata filter + semantic similarity
    chunks = vector_store.similarity_search(
        query=query,
        k=5,
        filter=state_filter
    )

    # Step 4: Cross-reference expansion
    expanded_chunks = expand_cross_references(chunks)

    # Step 5: Assemble into knowledge context
    state["retrieved_knowledge"] = assemble_knowledge_context(expanded_chunks)

    return state
```

#### 3.4.4 EVALUATE NODE (Core LLM Call)

```python
def evaluate_node(state: AgentState) -> AgentState:
    """
    The core evaluation node. Combines structured market data
    with retrieved knowledge to produce a trading assessment.
    This is where the Claude API is called.
    """
    # Compute rule-based convergence score (deterministic)
    convergence = compute_convergence_score(state)
    state["convergence"] = convergence

    # Construct the LLM evaluation prompt (Section 8.5 template)
    prompt = construct_evaluation_prompt(
        state_machine_state=state["current_state"],
        navigation_output={
            "regime": state["regime_classification"],
            "modifier": state["counter_trend_modifier"],
            "slope_score": state["aggregate_slope_score"]
        },
        convergence_breakdown=convergence,
        trendline_context=state["decision_trendlines"],
        sr_zone=state["sr_zone"],
        momentum_context=state["decision_momentum"],
        tema_hrma_context=state["decision_tema_hrma"],
        price_pattern=state["price_pattern"],
        breakout_context={
            "bar_index": state["breakout_bar_index"],
            "price": state["breakout_bar_price"],
            "trendline": state["breakout_trendline"]
        },
        knowledge_context=state["retrieved_knowledge"],
        convergence_history=state["convergence_history"]
    )

    # Call Claude API
    response = claude_client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=2000,
        system=TRADING_AGENT_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}]
    )

    # Parse LLM output into structured fields
    parsed = parse_llm_evaluation(response.content[0].text)
    state["llm_assessment"] = parsed["assessment"]
    state["llm_confidence"] = parsed["confidence"]
    state["convergence"]["llm_adjustment"] = parsed["score_adjustment"]
    state["convergence"]["final_score"] = (
        convergence["adjusted_total"] + parsed["score_adjustment"]
    )

    # Determine state transition based on final score + current state
    new_state = determine_state_transition(state)
    state["previous_state"] = state["current_state"]
    state["current_state"] = new_state

    return state
```

#### 3.4.5 RESPOND NODE

```python
def respond_node(state: AgentState) -> AgentState:
    """
    Generates the conversational response for the Chat UI.
    Translates the agent's internal assessment into a natural
    language message the user can understand and act on.
    """
    response_prompt = f"""
    Based on the following trading analysis, generate a clear conversational
    response for the trader. Include:
    1. Current assessment (1-2 sentences: what's happening)
    2. State machine status (what the system is watching for)
    3. Key data points (convergence score, zone details, pattern if present)
    4. Action recommendation (if any)

    Analysis:
    - Instrument: {state['instrument']}
    - State: {state['previous_state']} → {state['current_state']}
    - Regime: {state['regime_classification']}
    - Convergence: {state['convergence']['final_score']:.1f}
      (Trendline: {state['convergence']['trendline']},
       Momentum: {state['convergence']['momentum']},
       TEMA/HRMA: {state['convergence']['tema_hrma']},
       Navigation: {state['convergence']['navigation']},
       Pattern: {state['convergence']['price_pattern']})
    - Zone: {state['sr_zone']['upper_boundary']:.2f} - {state['sr_zone']['lower_boundary']:.2f}
      (Density: {state['sr_zone']['density_score']:.1f})
    - LLM Assessment: {state['llm_assessment']}
    - LLM Confidence: {state['llm_confidence']}
    """

    response = claude_client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=500,
        messages=[{"role": "user", "content": response_prompt}]
    )

    state["pending_response"] = response.content[0].text
    return state
```

### 3.5 Graph Definition

```python
from langgraph.graph import StateGraph, END

# Define the graph
workflow = StateGraph(AgentState)

# Add nodes
workflow.add_node("trigger", trigger_node)
workflow.add_node("fetch_data", fetch_data_node)
workflow.add_node("fetch_knowledge", fetch_knowledge_node)
workflow.add_node("navigate", navigate_node)
workflow.add_node("evaluate", evaluate_node)
workflow.add_node("build_zone", zone_build_node)
workflow.add_node("execute", execute_node)
workflow.add_node("respond", respond_node)
workflow.add_node("log_audit", audit_log_node)

# Define edges
workflow.set_entry_point("trigger")
workflow.add_edge("trigger", "fetch_data")
workflow.add_edge("fetch_data", "fetch_knowledge")
workflow.add_edge("fetch_knowledge", "navigate")
workflow.add_edge("navigate", "evaluate")

# Conditional routing after evaluation
workflow.add_conditional_edges(
    "evaluate",
    route_after_evaluation,     # Function that returns next node name
    {
        "build_zone": "build_zone",      # Score >= WAIT threshold, zone needed
        "respond": "respond",             # NO_TRADE or WAIT without zone
        "invalidated": "respond",         # INVALIDATED → respond with reason
    }
)

workflow.add_conditional_edges(
    "build_zone",
    route_after_zone_build,
    {
        "execute": "execute",             # Score >= ENTER and zone constructed
        "respond": "respond",             # Zone built but score is WAIT
    }
)

workflow.add_edge("execute", "respond")
workflow.add_edge("respond", "log_audit")
workflow.add_edge("log_audit", END)

# Compile
app = workflow.compile(checkpointer=MemorySaver())
```

### 3.6 Conditional Router Functions

```python
def route_after_evaluation(state: AgentState) -> str:
    """Route based on evaluation outcome and state transition."""
    new_state = state["current_state"]

    # States that require zone construction
    if new_state in ["PULLBACK_TESTING", "EXECUTING", "AWAITING_PULLBACK"]:
        return "build_zone"

    # States that go directly to response
    if new_state in ["IDLE", "SCANNING", "MISSED", "INVALIDATED"]:
        return "respond"

    # BREAKOUT_DETECTED also needs zone construction prep
    if new_state == "BREAKOUT_DETECTED":
        return "build_zone"

    return "respond"  # Default fallback


def route_after_zone_build(state: AgentState) -> str:
    """Route based on whether to execute or wait."""
    score = state["convergence"]["final_score"]

    if state["current_state"] == "EXECUTING" and score >= 5.0:
        return "execute"

    return "respond"
```

---

## 4. Tool Definitions

### 4.1 Market Data Retriever Tool

```python
from langchain.tools import tool

@tool
def market_data_retriever(
    instrument: str,
    timeframes: list[str],
    data_types: list[str]
) -> dict:
    """
    Retrieves pre-computed market data from PostgreSQL.

    Args:
        instrument: Trading instrument (e.g., "XAUUSD")
        timeframes: List of timeframes to fetch (e.g., ["H4", "H2", "H1", "M30"])
        data_types: Types of data needed (e.g., ["trendlines", "momentum", "tema_hrma"])

    Returns:
        Dictionary with market data organized by timeframe and data type.
    """
    results = {}
    for tf in timeframes:
        results[tf] = {}
        if "trendlines" in data_types:
            results[tf]["trendlines"] = query_trendlines(instrument, tf)
        if "momentum" in data_types:
            results[tf]["momentum"] = query_momentum_candles(instrument, tf, lookback=30)
        if "tema_hrma" in data_types:
            results[tf]["tema_hrma"] = query_tema_hrma(instrument, tf)
        if "ohlc" in data_types:
            results[tf]["ohlc"] = query_ohlc(instrument, tf, lookback=50)
    return results
```

### 4.2 Knowledge Retriever Tool

```python
@tool
def knowledge_retriever(
    query: str,
    current_state: str,
    topic_filter: list[str] = None
) -> str:
    """
    Retrieves relevant trading methodology knowledge from VectorDB.

    Args:
        query: Analytical query describing what knowledge is needed
        current_state: Current state machine state for pre-filtering
        topic_filter: Optional additional topic tags to filter by

    Returns:
        Assembled knowledge context string ready for LLM prompt injection.
    """
    filters = {"state_relevance": {"$in": [current_state]}}
    if topic_filter:
        filters["topic_tags"] = {"$in": topic_filter}

    chunks = vector_store.similarity_search(
        query=query,
        k=5,
        filter=filters
    )

    # Cross-reference expansion
    expanded = expand_cross_references(chunks, vector_store)

    return assemble_knowledge_context(expanded)
```

### 4.3 Trade Execution Manager Tool

```python
@tool
def trade_execution_manager(
    action: str,
    instrument: str,
    orders: list[dict] = None
) -> dict:
    """
    Manages trade execution via Flask MT5 Service.

    Args:
        action: "place_orders", "check_fills", "cancel_unfilled", "get_position"
        instrument: Trading instrument
        orders: List of order dicts with price, lot_size, order_type

    Returns:
        Execution result with fill status, prices, and any errors.
    """
    if action == "place_orders":
        return flask_mt5_client.place_pyramid_orders(instrument, orders)
    elif action == "check_fills":
        return flask_mt5_client.check_fill_status(instrument)
    elif action == "cancel_unfilled":
        return flask_mt5_client.cancel_pending_orders(instrument)
    elif action == "get_position":
        return flask_mt5_client.get_open_position(instrument)
```

---

## 5. Knowledge Base Ingestion Pipeline

### 5.1 Document Processing Workflow

```python
# Ingestion script for loading Blueprint v2.1 into VectorDB

from langchain.text_splitter import MarkdownHeaderTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
# Or: from langchain_openai import OpenAIEmbeddings

def ingest_blueprint(filepath: str, vector_store):
    """
    Process Blueprint v2.1 into semantically meaningful chunks
    and store in VectorDB with metadata.
    """

    # Step 1: Load document
    with open(filepath, 'r') as f:
        content = f.read()

    # Step 2: Split by markdown headers (respects document structure)
    headers_to_split_on = [
        ("##", "section"),
        ("###", "subsection"),
        ("####", "subsubsection"),
    ]
    splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=headers_to_split_on
    )
    chunks = splitter.split_text(content)

    # Step 3: Post-process chunks — merge very small chunks,
    # split very large chunks, and add metadata
    processed_chunks = []
    for chunk in chunks:
        metadata = generate_chunk_metadata(chunk)
        # Merge chunks under 200 tokens with their parent section
        # Split chunks over 1500 tokens at paragraph boundaries
        processed = size_normalize(chunk, min_tokens=200, max_tokens=1500)
        for p in processed:
            p.metadata.update(metadata)
            processed_chunks.append(p)

    # Step 4: Store in VectorDB
    vector_store.add_documents(processed_chunks)

    return len(processed_chunks)


def generate_chunk_metadata(chunk) -> dict:
    """
    Generate metadata tags for a chunk based on its content and headers.
    Uses keyword matching and section number mapping.
    """
    section = chunk.metadata.get("section", "")
    subsection = chunk.metadata.get("subsection", "")
    content = chunk.page_content.lower()

    metadata = {
        "source_document": "blueprint_v2.1",
        "section_title": f"{section} — {subsection}",
        "version": "2.1",
    }

    # Layer classification
    if any(kw in content for kw in ["navigation layer", "regime", "aggregate slope"]):
        metadata["layer"] = "navigation"
    elif any(kw in content for kw in ["decision layer", "convergence", "breakout"]):
        metadata["layer"] = "decision"
    elif any(kw in content for kw in ["execution layer", "order placement", "fill"]):
        metadata["layer"] = "execution"
    elif any(kw in content for kw in ["llm judgment", "principle", "fallback", "override"]):
        metadata["layer"] = "framework"
    else:
        metadata["layer"] = "reference"

    # Topic tags (keyword-based extraction)
    topic_tags = extract_topic_tags(content)
    metadata["topic_tags"] = topic_tags

    # State relevance (maps content to applicable states)
    metadata["state_relevance"] = infer_state_relevance(content)

    # Indicator relevance
    metadata["indicator_relevance"] = infer_indicator_relevance(content)

    return metadata


# Topic tag extraction rules
TOPIC_TAG_RULES = {
    "trendline": ["trendline", "fractal", "resistance", "support", "slope"],
    "momentum": ["momentum", "z-score", "body size", "invigorated", "exhausting"],
    "tema-hrma": ["tema", "hrma", "moving average", "gap analysis"],
    "breakout": ["breakout", "phase a", "break through"],
    "pullback": ["pullback", "throwback", "phase b", "retrace"],
    "bounce": ["bounce", "active rejection", "absorption", "lingering"],
    "zone": ["s/r zone", "proximity cluster", "zone construction"],
    "density": ["structural density", "density score", "density weighting"],
    "pyramid": ["pyramid", "lot allocation", "split-lot"],
    "patterns": ["double bottom", "double top", "higher low", "hammer", "engulfing"],
    "convergence": ["convergence", "scoring", "threshold", "factor"],
    "state-machine": ["state machine", "state transition", "idle", "scanning"],
    "risk-management": ["risk", "position sizing", "lot size"],
}

def extract_topic_tags(content: str) -> list[str]:
    tags = []
    for tag, keywords in TOPIC_TAG_RULES.items():
        if any(kw in content for kw in keywords):
            tags.append(tag)
    return tags


# State relevance inference
STATE_CONTENT_MAP = {
    "IDLE": ["idle", "trigger", "new bar", "cooldown"],
    "NAVIGATING": ["regime", "navigation", "aggregate slope", "counter-trend"],
    "SCANNING": ["scanning", "watching", "setup developing", "breakout potential"],
    "BREAKOUT_DETECTED": ["breakout detected", "breakout quality", "body close beyond"],
    "AWAITING_PULLBACK": ["awaiting pullback", "waiting for retrace", "pullback window"],
    "PULLBACK_TESTING": ["pullback testing", "level holding", "bounce", "zone testing",
                          "price pattern", "double bottom", "density"],
    "EXECUTING": ["executing", "order placement", "limit order", "market order",
                   "fill status", "pace assessment"],
    "ENTERED": ["entered", "position live", "trade management", "handoff"],
}

def infer_state_relevance(content: str) -> list[str]:
    relevant_states = []
    for state, keywords in STATE_CONTENT_MAP.items():
        if any(kw in content for kw in keywords):
            relevant_states.append(state)
    # Universal chunks (principles, scoring) apply to most states
    if not relevant_states:
        relevant_states = ["SCANNING", "BREAKOUT_DETECTED",
                           "PULLBACK_TESTING", "EXECUTING"]
    return relevant_states
```

### 5.2 Embedding Model Selection

| Option                            | Dimensions | Performance                  | Cost            | Recommendation                   |
| --------------------------------- | ---------- | ---------------------------- | --------------- | -------------------------------- |
| `text-embedding-3-small` (OpenAI) | 1536       | Good semantic quality        | $0.02/1M tokens | Best balance of quality and cost |
| `text-embedding-3-large` (OpenAI) | 3072       | Best semantic quality        | $0.13/1M tokens | Overkill for ~26 chunks          |
| `all-MiniLM-L6-v2` (HuggingFace)  | 384        | Good, runs locally           | Free            | Best for dev, no API dependency  |
| Voyage AI `voyage-3`              | 1024       | Excellent for code/technical | $0.06/1M tokens | Good for mixed technical content |

**Recommendation:** Use `all-MiniLM-L6-v2` for development (free, local, fast). Switch to `text-embedding-3-small` for production (better semantic quality at low cost).

For the DavinTrade use case, the chunk count is small enough that embedding quality matters less than metadata filtering quality — the metadata-based pre-filtering does most of the heavy lifting, and the semantic search only needs to rank 5-10 candidate chunks.

---

## 6. Conversational AI Integration

### 6.1 Chat Modes

The Chat UI supports two interaction modes:

**Mode 1: User-Initiated Query**
The user types a question or instruction. The agent processes the message, potentially triggers an evaluation cycle, and responds conversationally.

Examples:

- "Analyze XAUUSD for a long entry" → Triggers full evaluation pipeline
- "What's the current regime for BTCUSD?" → Fetches Navigation data only, responds
- "Show me the convergence score breakdown" → Reads from state, responds
- "Override to WAIT — I don't trust this bounce" → Human-in-the-loop override, updates state

**Mode 2: Agent-Initiated Alert**
New bar closes, the agent runs its evaluation cycle automatically, and pushes a message to the chat if the state changes or a significant event occurs.

Alert triggers:

- State transition (e.g., SCANNING → BREAKOUT_DETECTED)
- Convergence score crossing a threshold
- Zone density degradation (level broke)
- Price pattern completion (double bottom confirmed)
- Order fill notification

### 6.2 System Prompt for Trading Agent

```python
TRADING_AGENT_SYSTEM_PROMPT = """
You are the trading analysis engine for DavinTrade, a professional trading
alerts SaaS platform. You analyze multi-timeframe market data using a
structured methodology based on three indicator systems (Fractal Trendlines,
Momentum Candles, TEMA/HRMA) across a 2-3-2 layered architecture
(Navigation → Decision → Execution).

Your analysis methodology is retrieved from the knowledge base for each
evaluation. Follow the methodology precisely for rule-based calculations
(convergence scoring, regime classification, state transitions). Apply
your judgment at the defined discretion points (breakout quality, pullback
evaluation, momentum interpretation, conflicting signals).

When responding to users:
- Lead with the conclusion (ENTER/WAIT/NO TRADE and why)
- Support with key data (convergence score, regime, zone density)
- Note any LLM judgment calls you made and why
- Be direct — traders need actionable information, not hedged language
- If you override a rule-based output, flag it prominently

When evaluating market state:
- Follow the 5-level graceful fallback hierarchy
- Overrides can only increase caution, never aggression
- Default to WAIT when uncertain
- Active bounce from S/R zone is required for pullback confirmation —
  passive holding is NOT sufficient
- Zone structural density modulates position sizing confidence
- Price patterns are bonus confirmation, not requirements

Current instrument: {instrument}
Current TF config: {tf_config}
Current state: {current_state}
"""
```

### 6.3 Mapping Chat UI to DavinTrade Dashboard

Based on the DavinTrade dashboard screenshot, the integration points are:

| Dashboard Element                           | Data Source                  | Agent Integration                                                                              |
| ------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------- |
| **Chat Panel** (left)                       | Agent response text          | RESPOND NODE output → WebSocket push to frontend                                               |
| **PINNED/RECENT chats** (left sidebar)      | Chat history in DB           | Saved conversations per instrument/trade                                                       |
| **TradingView Chart** (center)              | TradingView widget API       | Agent can reference specific price levels; chart overlays for trendlines and zones             |
| **XAUUSD H2 card** (right, top)             | PostgreSQL (Navigation data) | Navigation regime + slope displayed; color-coded red/green for resistance/support              |
| **XAUUSD H1 Resistant card** (right)        | PostgreSQL (Decision data)   | Primary Decision TF trendline data — Keltner Zone, S&R Zone, Slope, Trend, Touches, % Breakout |
| **XAUUSD H1 Support card** (right)          | PostgreSQL (Decision data)   | Same structure, support side                                                                   |
| **XAUUSD M30 Support card** (right, bottom) | PostgreSQL (Decision data)   | Lower Decision TF data                                                                         |
| **Timeframe tabs** (M5–D1)                  | UI routing                   | Switches which TF data is displayed on chart and cards                                         |
| **"H1 Based Timeframe" label**              | TF Config setting            | Indicates Config A (H1 primary). Would show "H2 Based Timeframe" for Config B                  |

### 6.4 Real-Time Data Flow (Frontend ↔ Agent)

```
Frontend → Agent:
  POST /api/chat/message
  {
    "instrument": "XAUUSD",
    "message": "Analyze for long entry",
    "tf_config": "A"
  }

Agent → Frontend (WebSocket):
  {
    "type": "analysis_response",
    "state": "SCANNING",
    "convergence": {
      "trendline": 0, "momentum": 0, "tema_hrma": 1,
      "navigation": -1, "price_pattern": 0,
      "final_score": 0.0
    },
    "regime": "bearish",
    "zone": null,
    "message": "XAUUSD H1: Currently in SCANNING state. Price approaching
                H1 resistance cluster at 2672-2674. No breakout detected yet.
                Regime is Bearish (slope -23.3°) — any long entry would be
                counter-trend with 0.75x modifier. Watching for breakout
                above 2672.08 with momentum confirmation.",
    "alerts": []
  }

Agent → Frontend (WebSocket, auto-alert):
  {
    "type": "state_change_alert",
    "previous_state": "SCANNING",
    "new_state": "BREAKOUT_DETECTED",
    "instrument": "XAUUSD",
    "message": "⚡ BREAKOUT DETECTED: XAUUSD H1 closed above 2672.08
                resistance with Large bullish candle (Z=1.8). TEMA crossing
                above HRMA. Monitoring breakout quality for 1-3 bars.",
    "urgency": "high"
  }
```

---

## 7. Data Pipeline — Flask MT5 Service Integration

### 7.1 Pipeline Architecture

```
MetaTrader 5 Terminal
       │
       │ MT5 Python API (market_ai_engine.py)
       │
       ▼
┌──────────────────────────────────┐
│       Flask MT5 Service          │
│                                  │
│  /api/bars/fetch                 │  ← Fetches OHLC data
│  /api/indicators/compute         │  ← Runs indicator computations
│  /api/orders/place               │  ← Places orders via MT5
│  /api/orders/status              │  ← Checks fill status
│  /api/alerts/trigger             │  ← Webhook for new bar events
│                                  │
│  Cron/Scheduler:                 │
│  - On H1 bar close: compute all  │
│  - On M5 bar close: compute exec │
│  - Push webhook to Agent         │
│                                  │
└──────────┬───────────────────────┘
           │
           │ SQLAlchemy ORM
           │
           ▼
┌──────────────────────────────────┐
│         PostgreSQL (Railway)      │
│                                  │
│  Tables:                         │
│  - ohlc_data                     │
│  - trendline_data                │
│  - momentum_candles              │
│  - tema_hrma_values              │
│  - sr_zones                      │
│  - agent_state                   │
│  - trade_log                     │
│  - audit_log                     │
│                                  │
└──────────────────────────────────┘
```

### 7.2 Key Database Tables

```sql
-- Trendline data (pre-computed by Flask from Fractal V5 MQL5 indicator outputs)
CREATE TABLE trendline_data (
    id SERIAL PRIMARY KEY,
    instrument VARCHAR(20) NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    bar_time TIMESTAMP NOT NULL,
    line_type VARCHAR(20) NOT NULL,        -- 'peak' (resistance) or 'bottom' (support)
    slope_degrees FLOAT NOT NULL,
    intercept FLOAT NOT NULL,
    projected_price FLOAT NOT NULL,         -- Price at current bar
    score FLOAT NOT NULL,                   -- Fractal V5 composite score
    touch_count INT NOT NULL,
    line_length_bars INT,
    distance_to_price_pct FLOAT,
    status VARCHAR(20) DEFAULT 'intact',    -- 'intact', 'broken', 'role_reversed'
    rank INT,                               -- 1 = highest scored
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_trendline_lookup ON trendline_data (instrument, timeframe, bar_time);

-- S/R Zone clusters (computed by agent or Flask)
CREATE TABLE sr_zones (
    id SERIAL PRIMARY KEY,
    instrument VARCHAR(20) NOT NULL,
    tf_config VARCHAR(5) NOT NULL,
    bar_time TIMESTAMP NOT NULL,
    zone_upper FLOAT NOT NULL,
    zone_lower FLOAT NOT NULL,
    zone_midpoint FLOAT NOT NULL,
    width_pct FLOAT NOT NULL,
    density_score FLOAT NOT NULL,
    level_count INT NOT NULL,
    levels_json JSONB NOT NULL,             -- Array of {price, source_tf, touches, status}
    broken_levels_json JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Agent state persistence (one row per instrument+config, upserted each cycle)
CREATE TABLE agent_state (
    id SERIAL PRIMARY KEY,
    instrument VARCHAR(20) NOT NULL,
    tf_config VARCHAR(5) NOT NULL,
    current_state VARCHAR(30) NOT NULL,
    state_entered_at TIMESTAMP,
    bars_in_state INT DEFAULT 0,
    trade_direction VARCHAR(10),
    breakout_bar_time TIMESTAMP,
    breakout_price FLOAT,
    breakout_trendline_json JSONB,
    sr_zone_id INT REFERENCES sr_zones(id),
    lot_allocations_json JSONB,
    convergence_json JSONB,
    convergence_history_json JSONB,
    price_pattern_json JSONB,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(instrument, tf_config)
);

-- Audit log (append-only, one row per evaluation cycle)
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    instrument VARCHAR(20) NOT NULL,
    tf_config VARCHAR(5) NOT NULL,
    bar_time TIMESTAMP NOT NULL,
    state_from VARCHAR(30),
    state_to VARCHAR(30),
    trigger_type VARCHAR(30),
    convergence_json JSONB,
    llm_assessment TEXT,
    llm_confidence VARCHAR(10),
    llm_override_flag BOOLEAN DEFAULT FALSE,
    llm_override_reason TEXT,
    regime_classification VARCHAR(30),
    counter_trend_modifier FLOAT,
    zone_density_score FLOAT,
    price_pattern_type VARCHAR(30),
    sr_zone_json JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 8. Deployment Architecture

### 8.1 Service Map

```
┌─────────────────────────────────────────────────────────────┐
│                     Vercel (Frontend)                        │
│                     Next.js 15 App                           │
│                     DavinTrade Dashboard                     │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTPS / WebSocket
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                Railway / VPS (Backend Services)               │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │ Flask MT5 Service │  │ LangGraph Agent Service          │ │
│  │ (Python)          │  │ (Python)                         │ │
│  │                   │  │                                  │ │
│  │ - MT5 data fetch  │  │ - Agent orchestration            │ │
│  │ - Indicator calc   │  │ - State management               │ │
│  │ - Order execution │  │ - LLM calls (Claude API)         │ │
│  │                   │  │ - VectorDB queries               │ │
│  └─────────┬────────┘  └──────────┬───────────────────────┘ │
│            │                       │                         │
│            ▼                       ▼                         │
│  ┌──────────────────────────────────────────────────────────┐│
│  │              PostgreSQL (Railway Managed)                 ││
│  │              - Market data tables                        ││
│  │              - Agent state                               ││
│  │              - Audit log                                 ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │         Vector Store (Pinecone Cloud / Qdrant)           ││
│  │         - Blueprint knowledge chunks                     ││
│  │         - Trade example embeddings                       ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
└──────────────────────────────────────────────────────────────┘
                        │
                        ▼
            ┌──────────────────────┐
            │ Claude API           │
            │ (Anthropic)          │
            │ Model: claude-sonnet │
            └──────────────────────┘
```

### 8.2 Cost Considerations

| Service                 | Estimated Monthly Cost | Notes                                                |
| ----------------------- | ---------------------- | ---------------------------------------------------- |
| Claude API (Sonnet)     | $20-50                 | ~500-1000 evaluation cycles/month at ~4K tokens each |
| Railway PostgreSQL      | Already provisioned    | Part of existing Trading SaaS infrastructure         |
| Pinecone (Starter)      | Free tier (1 index)    | Sufficient for <100K vectors                         |
| Vercel (Pro)            | $20                    | Already provisioned for Next.js frontend             |
| Railway (Agent Service) | $5-10                  | Small Python service, low compute                    |

**Total incremental cost for Agentic RAG: ~$25-60/month** on top of existing infrastructure.

### 8.3 Development Phases

| Phase                             | Scope                                                                                                                                   | Dependencies                                 | Estimated Effort |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ---------------- |
| **Phase A: Knowledge Base**       | Chunk Blueprint v2.1, set up ChromaDB locally, implement ingestion pipeline, test retrieval quality                                     | Blueprint v2.1 complete (done)               | 2-3 days         |
| **Phase B: Agent Skeleton**       | Implement LangGraph state machine, define AgentState schema, implement TRIGGER → FETCH_DATA → RESPOND pipeline (without LLM evaluation) | Phase A + PostgreSQL tables populated        | 3-5 days         |
| **Phase C: Evaluation Engine**    | Implement NAVIGATE and EVALUATE nodes with Claude API integration, rule-based convergence scoring, LLM judgment overlay                 | Phase B                                      | 5-7 days         |
| **Phase D: Execution Pipeline**   | Implement ZONE_BUILD and EXECUTE nodes, connect to Flask MT5 Service for order placement                                                | Phase C + Flask MT5 Service (Phase 3 Part 6) | 3-5 days         |
| **Phase E: Chat Integration**     | Connect agent to DavinTrade Chat UI via WebSocket, implement conversational response generation, user-initiated queries                 | Phase C + Frontend Chat UI                   | 3-5 days         |
| **Phase F: Testing & Refinement** | End-to-end testing with live market data, audit log analysis, retrieval quality tuning, convergence threshold calibration               | All phases                                   | Ongoing          |

---

## 9. Knowledge Base Maintenance & Evolution

### 9.1 Adding Trade Examples

After significant trades (both successful and failed), annotated examples should be added to the VectorDB:

```python
def ingest_trade_example(trade_data: dict, outcome: dict):
    """
    Create a knowledge chunk from a completed trade for ongoing learning.
    """
    chunk_text = f"""
    Trade Example: {trade_data['instrument']} {trade_data['direction'].upper()}
    Date: {trade_data['entry_time']}
    Config: {trade_data['tf_config']}

    Setup:
    - Regime: {trade_data['regime']} (modifier: {trade_data['modifier']})
    - Convergence at entry: {trade_data['convergence_score']}
      ({trade_data['convergence_breakdown']})
    - Zone: {trade_data['zone_upper']} - {trade_data['zone_lower']}
      (density: {trade_data['zone_density']})
    - Price pattern: {trade_data['price_pattern']}
    - LLM assessment: {trade_data['llm_assessment']}

    Outcome: {outcome['result']} ({outcome['pnl_r']:.1f}R)
    - Entry filled: {outcome['lots_filled']} / {outcome['lots_planned']}
    - Max adverse excursion: {outcome['max_adverse']}

    Lesson: {outcome['lesson']}
    """

    metadata = {
        "source_document": "trade_examples",
        "instrument": trade_data["instrument"],
        "direction": trade_data["direction"],
        "regime": trade_data["regime"],
        "outcome": outcome["result"],
        "topic_tags": extract_topic_tags(chunk_text),
        "state_relevance": ["PULLBACK_TESTING", "EXECUTING"],
    }

    vector_store.add_documents([Document(page_content=chunk_text, metadata=metadata)])
```

### 9.2 Blueprint Version Management

When the Blueprint methodology evolves (e.g., new indicator, refined scoring thresholds):

1. Update the Blueprint markdown document
2. Re-run the ingestion pipeline with the new version
3. Tag old chunks with `version: "2.1"` and new chunks with `version: "2.2"`
4. The retriever always prefers the latest version but retains older versions for audit trail consistency

### 9.3 Feedback Loop

```
Trade Outcome → Audit Log Analysis → Methodology Refinement
     │                                        │
     │    "Losing trades had convergence       │
     │     scores of +5.0-5.5 in counter-      │
     │     trend regime with thin zones"        │
     │                                        │
     └──── Adjust: Raise counter-trend ────────┘
           threshold or add density minimum
           for counter-trend trades
```

The audit log captures every decision the agent makes with full context. Periodic review of the audit log (especially for losing trades) reveals systematic weaknesses in the methodology, which feed back into Blueprint updates, which are re-ingested into the VectorDB, closing the learning loop.

---

## Appendix: Quick Reference — File & Service Inventory

| Component            | Location/Service                       | Language         | Purpose                                   |
| -------------------- | -------------------------------------- | ---------------- | ----------------------------------------- |
| Blueprint v2.1       | `/docs/blueprint_v2.1.md`              | Markdown         | Core methodology document                 |
| Knowledge ingestion  | `/scripts/ingest_blueprint.py`         | Python           | Chunks and embeds Blueprint into VectorDB |
| LangGraph agent      | `/services/agent/graph.py`             | Python           | Agent orchestration with state machine    |
| Agent state schema   | `/services/agent/state.py`             | Python           | TypedDict definitions for AgentState      |
| Market data tool     | `/services/agent/tools/market_data.py` | Python           | PostgreSQL retriever                      |
| Knowledge tool       | `/services/agent/tools/knowledge.py`   | Python           | VectorDB retriever                        |
| Execution tool       | `/services/agent/tools/execution.py`   | Python           | Flask MT5 integration                     |
| Node implementations | `/services/agent/nodes/`               | Python           | One file per graph node                   |
| Convergence scorer   | `/services/agent/scoring.py`           | Python           | Rule-based 5-factor scoring               |
| Zone constructor     | `/services/agent/zones.py`             | Python           | Proximity clustering, density scoring     |
| Pattern detector     | `/services/agent/patterns.py`          | Python           | Price pattern detection at zones          |
| Flask MT5 Service    | `/services/flask_mt5/`                 | Python           | MT5 data pipeline + order execution       |
| Database migrations  | `/services/flask_mt5/migrations/`      | SQL/Alembic      | PostgreSQL schema management              |
| Frontend Chat        | `/apps/web/src/components/Chat/`       | TypeScript/React | DavinTrade Chat UI component              |
| WebSocket handler    | `/apps/web/src/lib/ws/`                | TypeScript       | Real-time agent ↔ frontend communication  |

---

_End of Implementation Architecture — Version 1.0_
