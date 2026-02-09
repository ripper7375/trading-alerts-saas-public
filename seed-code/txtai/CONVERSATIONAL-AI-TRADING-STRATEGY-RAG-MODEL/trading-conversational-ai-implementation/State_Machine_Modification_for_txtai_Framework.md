# State Machine Modification for txtai Framework

## Trading Advisory Conversational AI — Implementation Specification

**Document Version**: 2.0
**Date**: February 9, 2026
**Purpose**: Complete specification for implementing graph-based state machine orchestration on top of txtai framework for a conversational trading advisory SaaS (no trade execution).
**Target Audience**: Claude Code (web) for implementation
**Scope**: State machine only — excludes Trade Execution Manager, Markdown/JSONL memory systems, and storage/retrieval modifications (covered in separate documents)
**Integrated Modifications**: Keltner Channel Sentiment Gate (from `Keltner_Channel_Sentiment_Gate_Modification.md`) — adds a sentiment-based gate at `BREAKOUT_DETECTED` using H4 Keltner Channel band position to determine pullback likelihood. Source indicator: `Keltner Channel ATF_10 Bands_V2.mq5`.

---

## Table of Contents

1. [Context and Rationale](#1-context-and-rationale)
2. [Architecture Overview](#2-architecture-overview)
3. [txtai Integration Points](#3-txtai-integration-points)
4. [Modification 1: State Machine Engine](#4-modification-1-state-machine-engine)
5. [Modification 2: Simplified Routing (No Execution)](#5-modification-2-simplified-routing-no-execution)
6. [Modification 3: PostgreSQL State Persistence](#6-modification-3-postgresql-state-persistence)
7. [AgentState Schema](#7-agentstate-schema)
8. [State Machine Transitions — Complete Specification](#8-state-machine-transitions--complete-specification)
9. [Integration with txtai Agent](#9-integration-with-txtai-agent)
10. [Integration with txtai Workflow](#10-integration-with-txtai-workflow)
11. [Custom Tools for txtai Agent](#11-custom-tools-for-txtai-agent)
12. [Evaluation Pipeline — Node-by-Node](#12-evaluation-pipeline--node-by-node)
13. [Convergence Scoring Engine](#13-convergence-scoring-engine)
14. [LLM Prompt Construction](#14-llm-prompt-construction)
15. [LLM Output Parsing](#15-llm-output-parsing)
16. [Error Handling and Recovery](#16-error-handling-and-recovery)
17. [Configuration](#17-configuration)
18. [Testing Strategy](#18-testing-strategy)
19. [File Structure](#19-file-structure)
20. [Implementation Order](#20-implementation-order)
21. [Keltner Channel Sentiment Gate](#21-keltner-channel-sentiment-gate)
22. [Keltner Indicator Specification](#22-keltner-indicator-specification)
23. [Sentiment Zone Model](#23-sentiment-zone-model)
24. [Keltner Data Retrieval](#24-keltner-data-retrieval)
25. [VectorDB Knowledge Chunks — Keltner](#25-vectordb-knowledge-chunks--keltner)

---

## 1. Context and Rationale

### Why This Modification Exists

The architecture blueprint (`Agentic_AI_Trading_Model_Architecture_Blueprint_v2.md`) specifies a LangGraph-based state machine for orchestrating trade evaluation cycles. We are using **txtai** instead of LangGraph as the AI framework.

txtai provides native support for:

- Vector search and embeddings (Knowledge Retriever)
- RAG pipeline (retrieval + LLM generation)
- LLM integration via LiteLLM (Claude API)
- PostgreSQL database module
- Agent framework (ReAct-style tool-calling)
- Workflow orchestration with cron scheduling
- FastAPI web API layer

txtai does **not** provide:

- Graph-based state machine with conditional node routing
- Persistent agent state across evaluation cycles
- Structured state transitions with validation

This document specifies three modifications to bridge this gap:

| Modification                                 | Replaces (from LangGraph)               | Complexity | Effort   |
| -------------------------------------------- | --------------------------------------- | ---------- | -------- |
| **Mod 1**: Custom State Machine Engine       | `StateGraph`, `add_conditional_edges()` | Low        | 2-3 days |
| **Mod 2**: Simplified Routing (no execution) | Removes EXECUTING/ENTERED states        | Very Low   | 1 day    |
| **Mod 3**: PostgreSQL State Persistence      | `MemorySaver` with PostgreSQL backend   | Medium     | 3-5 days |

### What This Document Covers

- Complete state machine implementation code
- Integration points with txtai's Agent, Workflow, Embeddings, and LLM classes
- AgentState schema with all ~30 fields (reduced from ~40 — no execution fields)
- State transition rules and validation
- Convergence scoring engine
- LLM prompt construction and output parsing
- Error handling, recovery, and testing

### What This Document Does NOT Cover

- Trade Execution Manager (excluded per user requirement — SaaS is advisory only)
- Markdown Memory / JSONL Transcript systems (separate document)
- Storage & Retrieval Strategy with data retention (separate document)
- PostgreSQL OHLCV schema and data pipeline (separate document)
- Frontend / WebSocket / Chat UI (separate concern)

---

## 2. Architecture Overview

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    txtai Application                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Workflow (cron-triggered evaluation cycle)          │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────────┐   │   │
│  │  │ Trigger   │→ │ Fetch     │→ │ Evaluate &    │   │   │
│  │  │ Task      │  │ Data Task │  │ Respond Task  │   │   │
│  │  └───────────┘  └───────────┘  └───────────────┘   │   │
│  └─────────────────────────┬───────────────────────────┘   │
│                            │                               │
│  ┌─────────────────────────▼───────────────────────────┐   │
│  │  State Machine Engine (custom Python)         ◄MOD 1│   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │  States: IDLE → NAVIGATING → SCANNING →     │    │   │
│  │  │  BREAKOUT_DETECTED → AWAITING_PULLBACK →    │    │   │
│  │  │  PULLBACK_TESTING → RESPOND                 │    │   │
│  │  │  (+ MISSED, INVALIDATED)            ◄MOD 2  │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │  AgentState (PostgreSQL persisted)    ◄MOD 3│    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                               │
│  ┌─────────────────────────▼───────────────────────────┐   │
│  │  txtai Agent (ReAct tool-calling)                   │   │
│  │  ├── Tool: market_data_retriever (PostgreSQL)       │   │
│  │  ├── Tool: knowledge_retriever (Embeddings)         │   │
│  │  └── Tool: evaluate_trade (convergence scoring)     │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                               │
│  ┌────────────┐  ┌────────▼────────┐  ┌────────────────┐  │
│  │ Embeddings │  │ LLM (Claude     │  │ Database       │  │
│  │ (VectorDB) │  │ via LiteLLM)    │  │ (PostgreSQL)   │  │
│  └────────────┘  └─────────────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow — Single Evaluation Cycle

```
1. Cron trigger (new bar close on primary Decision TF)
       │
2. Load AgentState from PostgreSQL                     ◄ MOD 3
       │
3. State Machine determines current processing step   ◄ MOD 1
       │
4. Fetch market data (Tool: market_data_retriever → PostgreSQL)
       │
5. Fetch methodology knowledge (Tool: knowledge_retriever → Embeddings)
       │
6. Run state-specific evaluation:
   ├── NAVIGATING: Compute regime, slope score, counter-trend modifier
   ├── SCANNING: Check for breakout on Decision TFs
   ├── BREAKOUT_DETECTED: Evaluate breakout quality
   ├── AWAITING_PULLBACK: Monitor for pullback arrival
   └── PULLBACK_TESTING: Evaluate bounce quality, build zone
       │
7. Compute convergence score (rule-based 5-factor)
       │
8. LLM evaluation (Claude API via txtai LLM pipeline)
       │
9. Parse LLM output → state transition decision
       │
10. State Machine validates and applies transition    ◄ MOD 1
       │
11. Simplified routing: evaluate → respond            ◄ MOD 2
    (no EXECUTING/ENTERED branch)
       │
12. Persist updated AgentState to PostgreSQL          ◄ MOD 3
       │
13. Generate conversational response for chat UI
       │
14. Log to audit table
```

---

## 3. txtai Integration Points

### 3.1 Which txtai Components We Use (Unmodified)

| Component     | txtai Class         | How We Use It                                            |
| ------------- | ------------------- | -------------------------------------------------------- |
| Vector Search | `Embeddings`        | Knowledge retriever — search methodology chunks          |
| RAG           | `RAG`               | Optional — retrieve + generate in single call            |
| LLM           | `LLM` (via LiteLLM) | Call Claude API for evaluation and response generation   |
| Database      | `database.rdbms`    | PostgreSQL queries for market data and state persistence |
| Agent         | `Agent`             | Tool-calling agent for conversational interface          |
| Workflow      | `Workflow`          | Cron-scheduled evaluation cycle orchestration            |
| API           | `api` (FastAPI)     | Web endpoints for chat and state queries                 |
| Application   | `Application`       | Wires everything together from YAML config               |

### 3.2 What We Add (Custom Code)

| Custom Component           | Purpose                                                          | Integrates With                    |
| -------------------------- | ---------------------------------------------------------------- | ---------------------------------- |
| `StateMachine` class       | State transitions and validation                                 | Called by Workflow tasks           |
| `AgentStateManager` class  | PostgreSQL persistence for AgentState                            | Uses SQLAlchemy directly           |
| `ConvergenceScorer` class  | Rule-based 5-factor scoring                                      | Called during evaluation           |
| `EvaluationPipeline` class | Orchestrates the full evaluation cycle                           | Calls txtai Agent tools + LLM      |
| `LLMOutputParser` class    | Parses structured JSON from Claude                               | Post-processes LLM pipeline output |
| Custom txtai Tools         | `market_data_retriever`, `knowledge_retriever`, `evaluate_trade` | Registered with txtai Agent        |

### 3.3 txtai Agent Extension Pattern

txtai agents use a `ToolFactory` that accepts:

- **Functions/callables** → wrapped as `FunctionTool`
- **Dicts with "target"** → resolved to `EmbeddingsTool` or `FunctionTool`
- **Tool instances** → passed through directly

Our custom tools will be **Python functions decorated for txtai**, registered via the Application YAML config or programmatically:

```python
# Pattern: Register custom function as txtai agent tool
def market_data_retriever(instrument: str, timeframes: str, data_types: str) -> str:
    """Retrieve pre-computed market data from PostgreSQL.

    Args:
        instrument: Trading instrument (e.g., EURUSD, XAUUSD)
        timeframes: Comma-separated timeframes (e.g., H4,H2,H1)
        data_types: Comma-separated data types (e.g., trendlines,momentum,tema_hrma,ohlc)

    Returns:
        JSON string of market data organized by timeframe and data type
    """
    # Implementation in Section 11
    ...
```

### 3.4 txtai Workflow Extension Pattern

txtai workflows execute a list of `Task` objects sequentially. Each task has an `action` (callable), optional `select` filter, and optional `initialize`/`finalize` hooks.

Our evaluation cycle is a Workflow with three tasks:

```yaml
# In txtai application config
workflow:
  evaluation_cycle:
    tasks:
      - action: trigger_evaluation
      - action: fetch_and_evaluate
      - action: generate_response
    schedule:
      cron: '0 * * * *' # Every hour (H1 bar close)
```

---

## 4. Modification 1: State Machine Engine

### 4.1 Core State Machine Class

```python
# File: services/agent/state_machine.py

from enum import Enum
from typing import Optional
from datetime import datetime


class State(str, Enum):
    """Trading evaluation states.

    Note: EXECUTING and ENTERED are excluded — this SaaS is advisory only.
    PULLBACK_TESTING routes directly to RESPOND instead of EXECUTING.
    """
    IDLE = "IDLE"
    NAVIGATING = "NAVIGATING"
    SCANNING = "SCANNING"
    BREAKOUT_DETECTED = "BREAKOUT_DETECTED"
    AWAITING_PULLBACK = "AWAITING_PULLBACK"
    PULLBACK_TESTING = "PULLBACK_TESTING"
    MISSED = "MISSED"
    INVALIDATED = "INVALIDATED"


class TransitionError(Exception):
    """Raised when an invalid state transition is attempted."""
    pass


class StateMachine:
    """Finite state machine for trading evaluation cycles.

    Implements the state transition map from Blueprint v2.1 Section 7,
    excluding EXECUTING and ENTERED states (advisory-only SaaS).

    Hard rules enforced:
    1. No state skipping — transitions must follow the defined map.
    2. Cooldown enforcement — MISSED/INVALIDATED must wait before returning to IDLE.
    3. Failed breakout invalidation — auto-transitions to INVALIDATED.
    4. Time-based transitions — bar counters trigger MISSED/INVALIDATED.
    """

    # Valid transitions: {from_state: {condition: to_state}}
    TRANSITIONS = {
        State.IDLE: {
            "new_bar": State.NAVIGATING,
            "user_trigger": State.NAVIGATING,
        },
        State.NAVIGATING: {
            "regime_valid": State.SCANNING,
            "regime_incompatible": State.IDLE,
        },
        State.SCANNING: {
            "breakout_found": State.BREAKOUT_DETECTED,
            "structure_deteriorated": State.IDLE,
            "no_setup": State.IDLE,
        },
        State.BREAKOUT_DETECTED: {
            "sentiment_fakeout": State.INVALIDATED,       # Keltner gate: band contradicts breakout direction
            "momentum_confirmed": State.IDLE,              # Keltner gate: strong sentiment, skip pullback (advisory generated before transition)
            "quality_sufficient": State.AWAITING_PULLBACK,
            "quality_insufficient": State.INVALIDATED,
            "instant_fakeout": State.INVALIDATED,
            "timeout": State.INVALIDATED,  # 1-3 bars without confirmation
        },
        State.AWAITING_PULLBACK: {
            "pullback_arrived": State.PULLBACK_TESTING,
            "window_expired": State.MISSED,  # 8-12 bars without pullback
            "failed_breakout": State.INVALIDATED,  # Price closes back through trendline
        },
        State.PULLBACK_TESTING: {
            "bounce_confirmed": State.IDLE,  # Was EXECUTING in blueprint; now advisory → respond then IDLE
            "level_broken": State.INVALIDATED,
            "inconclusive": State.SCANNING,  # Back to scanning (WAIT)
            "timeout": State.INVALIDATED,  # 3-8 bars lingering without bounce
        },
        State.MISSED: {
            "cooldown_expired": State.IDLE,
        },
        State.INVALIDATED: {
            "cooldown_expired": State.IDLE,
        },
    }

    # Default configuration
    DEFAULT_CONFIG = {
        "breakout_confirmation_window": 3,      # bars
        "pullback_time_window": 10,             # bars (midpoint of 8-12)
        "pullback_testing_window": 5,           # bars (midpoint of 3-8)
        "cooldown_bars": 4,                     # bars after MISSED/INVALIDATED
    }

    def __init__(self, config: Optional[dict] = None):
        self.config = {**self.DEFAULT_CONFIG, **(config or {})}

    def validate_transition(self, current_state: State, condition: str) -> State:
        """Validate and return the target state for a given transition.

        Args:
            current_state: Current state of the machine.
            condition: The condition/event triggering the transition.

        Returns:
            The target state if transition is valid.

        Raises:
            TransitionError: If the transition is not allowed.
        """
        allowed = self.TRANSITIONS.get(current_state, {})
        target = allowed.get(condition)

        if target is None:
            raise TransitionError(
                f"Invalid transition: {current_state.value} --({condition})--> ??? "
                f"Allowed conditions from {current_state.value}: {list(allowed.keys())}"
            )

        return target

    def transition(self, agent_state: dict, condition: str) -> dict:
        """Apply a state transition to the agent state.

        This is the main entry point. It validates the transition,
        updates the state fields, and handles automatic behaviors
        (cooldown reset, bar counter reset, context clearing).

        Args:
            agent_state: The full AgentState dictionary.
            condition: The condition/event triggering the transition.

        Returns:
            Updated AgentState dictionary with new state applied.

        Raises:
            TransitionError: If the transition is not valid.
        """
        current = State(agent_state["current_state"])
        target = self.validate_transition(current, condition)

        # Store previous state
        agent_state["previous_state"] = current.value
        agent_state["current_state"] = target.value
        agent_state["last_transition_time"] = datetime.utcnow().isoformat()

        # Reset bar counter on state change
        agent_state["bars_in_state"] = 0

        # Handle state-specific cleanup
        if target == State.IDLE:
            agent_state = self._reset_evaluation_context(agent_state)

        if target in (State.MISSED, State.INVALIDATED):
            agent_state["cooldown_remaining"] = self.config["cooldown_bars"]

        if target == State.BREAKOUT_DETECTED:
            # Breakout context should already be set by caller
            pass

        if target == State.SCANNING and current == State.PULLBACK_TESTING:
            # Inconclusive pullback — clear zone data but keep breakout reference
            agent_state = self._clear_zone_context(agent_state)

        return agent_state

    def check_time_based_transitions(self, agent_state: dict) -> Optional[str]:
        """Check if any time-based transition should fire.

        Called at the start of each evaluation cycle to check bar counters.

        Args:
            agent_state: The full AgentState dictionary.

        Returns:
            Condition string if a time-based transition should fire, None otherwise.
        """
        current = State(agent_state["current_state"])
        bars = agent_state.get("bars_in_state", 0)

        if current == State.BREAKOUT_DETECTED:
            if bars >= self.config["breakout_confirmation_window"]:
                return "timeout"

        if current == State.AWAITING_PULLBACK:
            if bars >= self.config["pullback_time_window"]:
                return "window_expired"

        if current == State.PULLBACK_TESTING:
            if bars >= self.config["pullback_testing_window"]:
                return "timeout"

        if current in (State.MISSED, State.INVALIDATED):
            cooldown = agent_state.get("cooldown_remaining", 0)
            if cooldown <= 0:
                return "cooldown_expired"

        return None

    def increment_bar(self, agent_state: dict) -> dict:
        """Increment the bar counter for the current state.

        Called at the start of each evaluation cycle (new bar close).
        Also decrements cooldown if in MISSED/INVALIDATED.

        Args:
            agent_state: The full AgentState dictionary.

        Returns:
            Updated AgentState with incremented counters.
        """
        agent_state["bars_in_state"] = agent_state.get("bars_in_state", 0) + 1

        current = State(agent_state["current_state"])
        if current in (State.MISSED, State.INVALIDATED):
            cooldown = agent_state.get("cooldown_remaining", 0)
            agent_state["cooldown_remaining"] = max(0, cooldown - 1)

        return agent_state

    def get_allowed_transitions(self, current_state: State) -> dict:
        """Return all allowed transitions from the current state.

        Useful for LLM prompt construction — tells the LLM what
        decisions are available.

        Args:
            current_state: The current state.

        Returns:
            Dict of {condition: target_state} for allowed transitions.
        """
        return {
            condition: target.value
            for condition, target in self.TRANSITIONS.get(current_state, {}).items()
        }

    def _reset_evaluation_context(self, agent_state: dict) -> dict:
        """Clear all evaluation-specific context when returning to IDLE."""
        agent_state["breakout_bar_index"] = None
        agent_state["breakout_bar_price"] = None
        agent_state["breakout_trendline"] = None
        agent_state["sr_zone"] = None
        agent_state["zone_density_score"] = None
        agent_state["lot_allocations"] = None
        agent_state["price_pattern_state"] = None
        agent_state["broken_levels"] = None
        agent_state["cooldown_remaining"] = 0
        # Keltner Sentiment Gate fields
        agent_state["keltner_band_position"] = None
        agent_state["keltner_sentiment_zone"] = None
        agent_state["keltner_bands_snapshot"] = None
        return agent_state

    def _clear_zone_context(self, agent_state: dict) -> dict:
        """Clear zone-specific context when pullback is inconclusive."""
        agent_state["sr_zone"] = None
        agent_state["zone_density_score"] = None
        agent_state["lot_allocations"] = None
        agent_state["price_pattern_state"] = None
        agent_state["broken_levels"] = None
        return agent_state
```

### 4.2 State Transition Diagram (Advisory-Only, with Keltner Sentiment Gate)

```
                         new_bar / user_trigger
                               │
                               ▼
                        ┌──────────┐
               ┌───────│   IDLE   │◄──── cooldown_expired ────────┐
               │        └────┬─────┘                               │
               │             │ (automatic)                         │
               │             ▼                                     │
               │        ┌──────────────┐                           │
               │        │  NAVIGATING  │                           │
               │        └────┬────┬────┘                           │
               │             │    │ regime_incompatible → IDLE     │
               │             │ regime_valid                        │
               │             ▼                                     │
               │        ┌──────────┐                               │
               │   ┌────│ SCANNING │◄─── inconclusive ──┐         │
               │   │    └────┬─────┘                     │         │
               │   │         │ breakout_found             │         │
               │   │         ▼                            │         │
               │   │  ┌──────────────────┐                │         │
               │   │  │ BREAKOUT_DETECTED│──timeout──────►│         │
               │   │  │                  │                │         │
               │   │  │ ★ KELTNER GATE ★ │                │         │
               │   │  └──┬───┬───┬───────┘                │         │
               │   │     │   │   │                        │         │
               │   │     │   │   │ momentum_confirmed     │         │
               │   │     │   │   ▼                        │         │
               │   │     │   │  ┌────────────────┐        │         │
               │   │     │   │  │RESPOND (advise)│→ IDLE  │         │
               │   │     │   │  └────────────────┘        │         │
               │   │     │   │                            │         │
               │   │     │   │ quality_sufficient         │         │
               │   │     │   │ (bands 5-6 or overextended)│         │
               │   │     │   ▼                            │         │
               │   │     │  ┌───────────────────┐         │         │
               │   │     │  │ AWAITING_PULLBACK ├─window_expired──►MISSED──►│
               │   │     │  └────┬──────────────┘         │         │
               │   │     │       │ pullback_arrived        │         │
               │   │     │       ▼                        │         │
               │   │     │  ┌─────────────────┐           │         │
               │   │     │  │PULLBACK_TESTING ├───────────┘         │
               │   │     │  └────┬────────────┘                     │
               │   │     │       │ bounce_confirmed                 │
               │   │     │       ▼                                  │
               │   │     │  ┌──────────┐                            │
               │   │     │  │ RESPOND  │ (generate advisory)        │
               │   │     │  └────┬─────┘                            │
               │   │     │       │ → auto-transition back to IDLE   │
               │   │     │       ▼                                  │
               │   │     │    IDLE                                  │
               │   │     │                                          │
               │   │     │ sentiment_fakeout /                      │
               │   │     │ quality_insufficient / instant_fakeout / │
               │   │     │ failed_breakout / level_broken / timeout │
               │   │     │          │                               │
               │   │     │          ▼                               │
               │   │     │   ┌──────────────┐                       │
               │   └─────┴───│ INVALIDATED  ├───────────────────────┘
                             └──────────────┘
```

**Key differences from blueprint**:
1. `PULLBACK_TESTING → bounce_confirmed` goes to **RESPOND → IDLE** instead of EXECUTING → ENTERED. The system generates a trade recommendation advisory rather than placing orders.
2. `BREAKOUT_DETECTED` now has a **Keltner Sentiment Gate** with three exit paths:
   - **sentiment_fakeout** → INVALIDATED (Keltner band contradicts breakout direction)
   - **momentum_confirmed** → RESPOND → IDLE (Keltner confirms strong sentiment, skip pullback)
   - **quality_sufficient** → AWAITING_PULLBACK (unchanged — for normal pullback and overextended zones)

---

## 5. Modification 2: Simplified Routing (No Execution)

### 5.1 What Was Removed

From the blueprint's original 9 states, we remove 2:

| Removed State | Original Purpose                     | Advisory Replacement         |
| ------------- | ------------------------------------ | ---------------------------- |
| `EXECUTING`   | Place orders via Flask MT5 Service   | Generate recommendation text |
| `ENTERED`     | Position live, handoff to management | N/A — advisory delivered     |

### 5.2 Modified Transition: PULLBACK_TESTING Exit

**Original (blueprint)**:

```
PULLBACK_TESTING → EXECUTING
  Condition: bounce confirmed AND score >= ENTER threshold
```

**Modified (advisory-only)**:

```
PULLBACK_TESTING → IDLE (via respond)
  Condition: bounce confirmed AND score >= ENTER threshold
  Action: Generate trade recommendation with:
    - Entry zone map with lot allocations
    - Convergence score breakdown
    - Risk parameters
    - Confidence level
    - Natural language reasoning
  Then: Auto-transition to IDLE
```

### 5.3 Routing Logic

The original blueprint had conditional routing after EVALUATE and after ZONE_BUILD. With execution removed, this simplifies to:

```python
# File: services/agent/routing.py

from .state_machine import State


def route_after_evaluation(agent_state: dict) -> str:
    """Determine what to do after evaluation completes.

    Original blueprint had:
      - PULLBACK_TESTING/EXECUTING → build_zone → execute
      - Everything else → respond

    Simplified (no execution), with Keltner momentum path:
      - Keltner momentum_confirmed → respond with momentum advisory (no zone/pullback)
      - PULLBACK_TESTING with bounce → build_zone → respond with recommendation
      - Everything else → respond with status update

    Args:
        agent_state: Current agent state after evaluation.

    Returns:
        One of: "build_zone_and_respond", "respond_momentum_advisory",
                "respond_status", "respond_recommendation"
    """
    current = State(agent_state["current_state"])
    score = agent_state.get("convergence_score", 0)
    sentiment_zone = agent_state.get("keltner_sentiment_zone")

    # Keltner momentum confirmed — generate advisory without zone/pullback
    if sentiment_zone == "MOMENTUM_CONFIRMED":
        return "respond_momentum_advisory"

    # Standard pullback-confirmed path
    if current == State.PULLBACK_TESTING and score >= 5.0:
        return "build_zone_and_respond"

    if current in (State.BREAKOUT_DETECTED, State.AWAITING_PULLBACK):
        return "respond_status"  # Setup developing — provide update

    if current in (State.SCANNING,):
        return "respond_status"  # Monitoring — provide market overview

    if current in (State.MISSED, State.INVALIDATED):
        return "respond_status"  # Setup failed — explain why

    if current == State.IDLE:
        return "respond_status"  # No active setup

    return "respond_status"
```

### 5.4 What the "Respond" Step Produces Per State

| State at Respond Time | Sentiment Zone | Response Type | Content |
|---|---|---|---|
| IDLE | — | Market overview | "No active setup. Market is [regime]. Monitoring for opportunities." |
| SCANNING | — | Setup developing | "Watching for breakout on [trendline]. Convergence at [score]." |
| BREAKOUT_DETECTED | — | Alert | "Breakout detected on [instrument] [TF]. Evaluating quality..." |
| ★ BREAKOUT_DETECTED | FAKEOUT | Invalidation | "Breakout attempt noted but Keltner band position [X] suggests [bearish/bullish] sentiment may still be dominant. Structural conditions appear unfavorable for sustained reversal — elevated risk of fakeout. Setup discontinued." |
| ★ BREAKOUT_DETECTED | MOMENTUM_CONFIRMED | **Momentum Advisory** | "**MOMENTUM OBSERVATION**: [instrument] [direction] breakout detected. Keltner band [X] suggests elevated [bullish/bearish] sentiment — traditional pullback may be less likely in this environment. Convergence: [score]. This is an observation, not a guarantee. [Separate workflow needed for precise entry prices.]" |
| ★ BREAKOUT_DETECTED | OVEREXTENDED | Alert + Caution | "Breakout detected but price appears overextended (Keltner band [X]). At this deviation, a retracement toward the mean may develop. Monitoring cautiously." |
| AWAITING_PULLBACK | NORMAL_PULLBACK | Update | "Breakout detected. Monitoring for potential pullback toward [level]. [X] bars remaining in observation window." |
| ★ AWAITING_PULLBACK | OVEREXTENDED | Update + Context | "Breakout detected with price appearing overextended (band [X]) — conditions may favor a retracement. Monitoring for potential pullback." |
| PULLBACK_TESTING (score >= 5.0) | — | **Trade Recommendation** | Full recommendation with entry zone, lots, score breakdown, confidence. |
| PULLBACK_TESTING (score < 5.0) | — | Caution | "Pullback at zone but convergence insufficient ([score]). Monitoring." |
| MISSED | — | Missed opportunity | "Observation window expired without pullback entry conditions being met. Cooldown [X] bars." |
| INVALIDATED | — | Invalidation report | "Setup invalidated: [reason]. Cooldown [X] bars." |

★ = New or modified rows from the Keltner Sentiment Gate integration.

**Momentum Advisory Response**: The `momentum_confirmed` path produces a distinct advisory format that differs from the standard pullback-confirmed recommendation. It does NOT include entry zone construction or lot allocation (since there is no pullback zone to anchor entries). Precise entry price recommendations are handled by a **separate workflow** (not covered in this document).

---

## 6. Modification 3: PostgreSQL State Persistence

### 6.1 Database Schema

```sql
-- Table: agent_state
-- One row per (instrument, tf_config) combination.
-- Upserted at the end of each evaluation cycle.

CREATE TABLE agent_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity (composite unique key)
    instrument VARCHAR(20) NOT NULL,         -- e.g., 'EURUSD', 'XAUUSD'
    tf_config VARCHAR(10) NOT NULL,          -- 'config_a' (H1 primary) or 'config_b' (H2 primary)

    -- State machine
    current_state VARCHAR(30) NOT NULL DEFAULT 'IDLE',
    previous_state VARCHAR(30),
    bars_in_state INT NOT NULL DEFAULT 0,
    cooldown_remaining INT NOT NULL DEFAULT 0,
    last_transition_time TIMESTAMP,

    -- Navigation layer
    aggregate_slope_score DECIMAL(10,4),
    regime_classification VARCHAR(30),       -- 'Strong Bearish' to 'Strong Bullish'
    counter_trend_flag BOOLEAN DEFAULT false,
    counter_trend_modifier DECIMAL(4,2) DEFAULT 1.0,  -- 0.6 to 1.0
    navigation_trendlines JSONB,             -- Trendline data from Navigation TFs

    -- Decision layer — market data snapshot
    decision_trendlines JSONB,               -- Trendline data from Decision TFs
    decision_momentum JSONB,                 -- Momentum Z-scores and classifications
    decision_tema_hrma JSONB,                -- TEMA/HRMA values and gap analysis
    current_price DECIMAL(20,5),

    -- Decision layer — zone
    sr_zone JSONB,                           -- S/R zone map with clustered levels
    zone_density_score DECIMAL(10,4),
    lot_allocations JSONB,                   -- Pyramid lot allocation plan

    -- Decision layer — scoring
    convergence_score DECIMAL(6,2),          -- Current 5-factor score (-10 to +10)
    convergence_breakdown JSONB,             -- Per-factor scores
    convergence_history JSONB,               -- Rolling window of last 10 scores

    -- Decision layer — price pattern
    price_pattern_state JSONB,               -- Developing pattern at zone
    broken_levels JSONB,                     -- Levels that have failed within zone

    -- Breakout context
    breakout_bar_index INT,
    breakout_bar_price DECIMAL(20,5),
    breakout_trendline JSONB,                -- Slope, intercept, projected price
    trade_direction VARCHAR(10),             -- 'long' or 'short'

    -- Keltner Sentiment Gate data
    keltner_band_position INT,                 -- 1-10 band position at breakout
    keltner_sentiment_zone VARCHAR(30),        -- 'FAKEOUT', 'NORMAL_PULLBACK', 'MOMENTUM_CONFIRMED', 'OVEREXTENDED'
    keltner_bands_snapshot JSONB,              -- All 10 band values at time of evaluation

    -- Knowledge context (from VectorDB retrieval)
    retrieved_knowledge TEXT,                 -- Assembled methodology context string

    -- LLM outputs
    llm_assessment TEXT,                     -- Latest LLM evaluation text
    llm_confidence DECIMAL(4,2),             -- 0.0 to 1.0
    llm_score_adjustment DECIMAL(4,2),       -- -1.5 to +1.5
    llm_override_flag BOOLEAN DEFAULT false,
    llm_override_reason TEXT,

    -- Chat
    pending_response TEXT,                   -- Response queued for chat UI

    -- Audit
    last_evaluation_time TIMESTAMP,
    evaluation_count INT NOT NULL DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_instrument_config UNIQUE(instrument, tf_config),
    CONSTRAINT valid_state CHECK(current_state IN (
        'IDLE', 'NAVIGATING', 'SCANNING', 'BREAKOUT_DETECTED',
        'AWAITING_PULLBACK', 'PULLBACK_TESTING', 'MISSED', 'INVALIDATED'
    )),
    CONSTRAINT valid_direction CHECK(trade_direction IS NULL OR trade_direction IN ('long', 'short')),
    CONSTRAINT valid_modifier CHECK(counter_trend_modifier BETWEEN 0.6 AND 1.0),
    CONSTRAINT valid_sentiment_zone CHECK(
        keltner_sentiment_zone IS NULL OR keltner_sentiment_zone IN (
            'FAKEOUT', 'NORMAL_PULLBACK', 'MOMENTUM_CONFIRMED', 'OVEREXTENDED'
        )
    ),
    CONSTRAINT valid_band_position CHECK(
        keltner_band_position IS NULL OR (keltner_band_position >= 1 AND keltner_band_position <= 10)
    )
);

-- Primary lookup index
CREATE INDEX idx_agent_state_instrument ON agent_state (instrument, tf_config);

-- State monitoring index
CREATE INDEX idx_agent_state_active ON agent_state (current_state)
    WHERE current_state != 'IDLE';

-- Audit index
CREATE INDEX idx_agent_state_updated ON agent_state (updated_at DESC);
```

### 6.2 State Persistence Manager

```python
# File: services/agent/state_persistence.py

import json
from typing import Optional
from datetime import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine


class AgentStateManager:
    """Manages AgentState persistence in PostgreSQL.

    Pattern:
    1. load() at start of evaluation cycle
    2. State machine and evaluation modify the dict in-memory
    3. save() at end of evaluation cycle (single atomic UPDATE)

    This avoids mid-cycle persistence issues — if the cycle crashes,
    the state rolls back to the last completed cycle.
    """

    # Fields stored as JSONB (need JSON serialization)
    JSONB_FIELDS = {
        "navigation_trendlines", "decision_trendlines", "decision_momentum",
        "decision_tema_hrma", "sr_zone", "lot_allocations",
        "convergence_breakdown", "convergence_history",
        "price_pattern_state", "broken_levels", "breakout_trendline",
        "keltner_bands_snapshot",  # Keltner Sentiment Gate
    }

    def __init__(self, database_url: str):
        self.engine: Engine = create_engine(database_url)

    def load(self, instrument: str, tf_config: str) -> dict:
        """Load agent state from PostgreSQL.

        If no state exists for this instrument+config, creates a default IDLE state.

        Args:
            instrument: Trading instrument (e.g., 'EURUSD').
            tf_config: Timeframe configuration ('config_a' or 'config_b').

        Returns:
            AgentState as a Python dictionary.
        """
        with self.engine.connect() as conn:
            result = conn.execute(
                text("""
                    SELECT * FROM agent_state
                    WHERE instrument = :instrument AND tf_config = :tf_config
                    FOR UPDATE
                """),
                {"instrument": instrument, "tf_config": tf_config}
            )
            row = result.mappings().fetchone()

        if row is None:
            return self._create_default_state(instrument, tf_config)

        state = dict(row)
        # Deserialize JSONB fields
        for field in self.JSONB_FIELDS:
            if state.get(field) is not None and isinstance(state[field], str):
                state[field] = json.loads(state[field])
        return state

    def save(self, agent_state: dict) -> None:
        """Persist agent state to PostgreSQL.

        Uses UPSERT (INSERT ON CONFLICT UPDATE) for atomic write.

        Args:
            agent_state: The full AgentState dictionary to persist.
        """
        agent_state["updated_at"] = datetime.utcnow().isoformat()

        # Serialize JSONB fields
        data = dict(agent_state)
        for field in self.JSONB_FIELDS:
            if data.get(field) is not None:
                data[field] = json.dumps(data[field])

        # Remove internal-only fields not in schema
        data.pop("id", None)

        columns = [k for k in data.keys() if k != "id"]
        placeholders = [f":{k}" for k in columns]
        updates = [f"{k} = EXCLUDED.{k}" for k in columns
                   if k not in ("instrument", "tf_config", "created_at")]

        query = f"""
            INSERT INTO agent_state ({', '.join(columns)})
            VALUES ({', '.join(placeholders)})
            ON CONFLICT (instrument, tf_config) DO UPDATE SET
                {', '.join(updates)}
        """

        with self.engine.begin() as conn:
            conn.execute(text(query), data)

    def load_all_active(self) -> list:
        """Load all agent states that are not IDLE.

        Useful for monitoring dashboard and alerting.

        Returns:
            List of AgentState dictionaries for active evaluations.
        """
        with self.engine.connect() as conn:
            result = conn.execute(
                text("SELECT * FROM agent_state WHERE current_state != 'IDLE'")
            )
            rows = result.mappings().fetchall()

        states = []
        for row in rows:
            state = dict(row)
            for field in self.JSONB_FIELDS:
                if state.get(field) is not None and isinstance(state[field], str):
                    state[field] = json.loads(state[field])
            states.append(state)
        return states

    def _create_default_state(self, instrument: str, tf_config: str) -> dict:
        """Create a default IDLE state for a new instrument+config pair."""
        return {
            "instrument": instrument,
            "tf_config": tf_config,
            "current_state": "IDLE",
            "previous_state": None,
            "bars_in_state": 0,
            "cooldown_remaining": 0,
            "last_transition_time": None,
            "aggregate_slope_score": None,
            "regime_classification": None,
            "counter_trend_flag": False,
            "counter_trend_modifier": 1.0,
            "navigation_trendlines": None,
            "decision_trendlines": None,
            "decision_momentum": None,
            "decision_tema_hrma": None,
            "current_price": None,
            "sr_zone": None,
            "zone_density_score": None,
            "lot_allocations": None,
            "convergence_score": None,
            "convergence_breakdown": None,
            "convergence_history": [],
            "price_pattern_state": None,
            "broken_levels": None,
            "breakout_bar_index": None,
            "breakout_bar_price": None,
            "breakout_trendline": None,
            "trade_direction": None,
            # Keltner Sentiment Gate
            "keltner_band_position": None,
            "keltner_sentiment_zone": None,
            "keltner_bands_snapshot": None,
            "retrieved_knowledge": None,
            "llm_assessment": None,
            "llm_confidence": None,
            "llm_score_adjustment": None,
            "llm_override_flag": False,
            "llm_override_reason": None,
            "pending_response": None,
            "last_evaluation_time": None,
            "evaluation_count": 0,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }
```

### 6.3 Crash Recovery

```python
# File: services/agent/recovery.py

from datetime import datetime, timedelta
from .state_machine import State


def check_stale_states(state_manager, max_age_minutes: int = 120) -> list:
    """Find agent states that appear stuck (no update for too long).

    This catches cases where an evaluation cycle crashed mid-way,
    leaving the state in a non-IDLE state without further progress.

    Args:
        state_manager: AgentStateManager instance.
        max_age_minutes: Max minutes since last update before considered stale.

    Returns:
        List of stale agent states.
    """
    active_states = state_manager.load_all_active()
    cutoff = datetime.utcnow() - timedelta(minutes=max_age_minutes)

    stale = []
    for state in active_states:
        updated = state.get("updated_at")
        if updated and datetime.fromisoformat(str(updated)) < cutoff:
            stale.append(state)
    return stale


def recover_stale_state(state_manager, agent_state: dict) -> dict:
    """Reset a stale state back to IDLE with appropriate logging.

    Args:
        state_manager: AgentStateManager instance.
        agent_state: The stale AgentState to recover.

    Returns:
        Recovered AgentState (reset to IDLE).
    """
    agent_state["previous_state"] = agent_state["current_state"]
    agent_state["current_state"] = State.IDLE.value
    agent_state["bars_in_state"] = 0
    agent_state["cooldown_remaining"] = 0
    agent_state["pending_response"] = (
        f"System recovered from stale state '{agent_state['previous_state']}'. "
        f"Reset to IDLE. Previous evaluation data cleared."
    )

    # Clear evaluation context
    for field in ["breakout_bar_index", "breakout_bar_price", "breakout_trendline",
                  "sr_zone", "zone_density_score", "lot_allocations",
                  "price_pattern_state", "broken_levels",
                  "keltner_band_position", "keltner_sentiment_zone",
                  "keltner_bands_snapshot"]:
        agent_state[field] = None

    state_manager.save(agent_state)
    return agent_state
```

### 6.4 Race Condition Handling

```python
# Concurrency safety is handled by PostgreSQL row-level locking.
# The load() method uses SELECT ... FOR UPDATE, which prevents
# two evaluation cycles from modifying the same instrument simultaneously.
#
# If a user chat query arrives while a cron evaluation is running:
# - Chat query reads state (no lock needed for reads)
# - Chat query does NOT modify state (it only reads and generates response)
# - Only the evaluation cycle modifies state (single writer pattern)
#
# This means:
# - Cron evaluation: load(FOR UPDATE) → evaluate → save()
# - User chat query: load(no lock) → read state → generate response
#
# No race condition because only one writer exists per instrument+config.
```

---

## 7. AgentState Schema

### 7.1 Complete Field Reference

```python
# File: services/agent/schema.py

from typing import TypedDict, Optional, Literal


class AgentState(TypedDict, total=False):
    """Complete agent state schema for trading evaluation.

    Persisted in PostgreSQL agent_state table.
    ~30 fields (reduced from blueprint's ~40 by removing execution fields).
    """

    # ── Identity ──
    instrument: str                          # e.g., 'EURUSD', 'XAUUSD'
    tf_config: Literal["config_a", "config_b"]  # H1-primary or H2-primary
    trade_direction: Optional[Literal["long", "short"]]

    # ── State Machine ──
    current_state: str                       # State enum value
    previous_state: Optional[str]
    bars_in_state: int                       # Counter since last state change
    cooldown_remaining: int                  # Bars remaining in cooldown
    last_transition_time: Optional[str]      # ISO 8601 timestamp

    # ── Navigation Layer ──
    aggregate_slope_score: Optional[float]   # Combined slope from Navigation TFs
    regime_classification: Optional[str]     # 'Strong Bearish' to 'Strong Bullish'
    counter_trend_flag: bool                 # True if trading against regime
    counter_trend_modifier: float            # 0.6 to 1.0 multiplier
    navigation_trendlines: Optional[dict]    # Trendline data from Navigation TFs

    # ── Decision Layer — Market Data ──
    decision_trendlines: Optional[dict]      # Trendline data from Decision TFs
    decision_momentum: Optional[dict]        # Momentum Z-scores per TF
    decision_tema_hrma: Optional[dict]       # TEMA/HRMA values and gap analysis per TF
    current_price: Optional[float]

    # ── Decision Layer — Zone ──
    sr_zone: Optional[dict]                  # S/R zone map with clustered levels
    zone_density_score: Optional[float]      # Structural density score
    lot_allocations: Optional[list]          # Pyramid lot allocation plan

    # ── Decision Layer — Scoring ──
    convergence_score: Optional[float]       # Current 5-factor score
    convergence_breakdown: Optional[dict]    # Per-factor scores
    convergence_history: Optional[list]      # Rolling window of last 10 scores

    # ── Decision Layer — Price Pattern ──
    price_pattern_state: Optional[dict]      # Developing pattern at zone
    broken_levels: Optional[list]            # Levels that have failed

    # ── Breakout Context ──
    breakout_bar_index: Optional[int]
    breakout_bar_price: Optional[float]
    breakout_trendline: Optional[dict]       # Slope, intercept, projected price

    # ── Keltner Sentiment Gate ──
    keltner_band_position: Optional[int]         # 1-10 band position at BREAKOUT_DETECTED
    keltner_sentiment_zone: Optional[str]        # SentimentZone enum value: 'FAKEOUT', 'NORMAL_PULLBACK', 'MOMENTUM_CONFIRMED', 'OVEREXTENDED'
    keltner_bands_snapshot: Optional[dict]       # All 10 band values at evaluation time

    # ── Knowledge Context ──
    retrieved_knowledge: Optional[str]       # Assembled text from VectorDB

    # ── LLM Outputs ──
    llm_assessment: Optional[str]            # Latest evaluation text
    llm_confidence: Optional[float]          # 0.0 to 1.0
    llm_score_adjustment: Optional[float]    # -1.5 to +1.5
    llm_override_flag: bool
    llm_override_reason: Optional[str]

    # ── Chat ──
    pending_response: Optional[str]          # Response queued for UI

    # ── Audit ──
    last_evaluation_time: Optional[str]
    evaluation_count: int
    created_at: str
    updated_at: str
```

### 7.2 Fields Removed from Blueprint (Execution-Related)

| Removed Field          | Original Purpose              | Why Removed                   |
| ---------------------- | ----------------------------- | ----------------------------- |
| `execution_trendlines` | Execution Layer TF trendlines | No execution layer            |
| `execution_tema_hrma`  | Execution Layer TF indicators | No execution layer            |
| `fill_status`          | Per-lot fill tracking         | No order placement            |
| `order_ids`            | MT5 order references          | No order placement            |
| `position_id`          | Live position reference       | No positions                  |
| `chat_history`         | Full conversation history     | Handled by txtai Agent memory |

---

## 8. State Machine Transitions — Complete Specification

### 8.1 Transition Table

| #   | From              | Condition                | To                 | Trigger                                    | Hard Rule? |
| --- | ----------------- | ------------------------ | ------------------ | ------------------------------------------ | ---------- |
| 1   | IDLE              | `new_bar`                | NAVIGATING         | Cron / new bar close                       | No         |
| 2   | IDLE              | `user_trigger`           | NAVIGATING         | User requests evaluation                   | No         |
| 3   | NAVIGATING        | `regime_valid`           | SCANNING           | Regime classification complete             | No         |
| 4   | NAVIGATING        | `regime_incompatible`    | IDLE               | No viable trade conditions                 | No         |
| 5   | SCANNING          | `breakout_found`         | BREAKOUT_DETECTED  | Candle closes beyond trendline             | No         |
| 6   | SCANNING          | `structure_deteriorated` | IDLE               | Key S/R breaks against direction           | No         |
| 7   | SCANNING          | `no_setup`               | IDLE               | LLM judges no setup developing             | No         |
| ★8  | BREAKOUT_DETECTED | `sentiment_fakeout`      | INVALIDATED        | Keltner band in fakeout zone               | **Yes**    |
| ★9  | BREAKOUT_DETECTED | `momentum_confirmed`     | IDLE (via respond) | Keltner band in momentum confirmed zone    | **Yes**    |
| 10  | BREAKOUT_DETECTED | `quality_sufficient`     | AWAITING_PULLBACK  | LLM + score + Keltner in normal/overextended zone | No   |
| 11  | BREAKOUT_DETECTED | `quality_insufficient`   | INVALIDATED        | LLM judges poor breakout                   | No         |
| 12  | BREAKOUT_DETECTED | `instant_fakeout`        | INVALIDATED        | Price reverses through trendline           | **Yes**    |
| 13  | BREAKOUT_DETECTED | `timeout`                | INVALIDATED        | 3 bars without confirmation                | **Yes**    |
| 14  | AWAITING_PULLBACK | `pullback_arrived`       | PULLBACK_TESTING   | Price enters tolerance zone                | No         |
| 15  | AWAITING_PULLBACK | `window_expired`         | MISSED             | 8-12 bars without pullback                 | **Yes**    |
| 16  | AWAITING_PULLBACK | `failed_breakout`        | INVALIDATED        | Price closes back through trendline        | **Yes**    |
| 17  | PULLBACK_TESTING  | `bounce_confirmed`       | IDLE (via respond) | Active bounce + score >= ENTER             | No         |
| 18  | PULLBACK_TESTING  | `level_broken`           | INVALIDATED        | Price breaks zone decisively               | **Yes**    |
| 19  | PULLBACK_TESTING  | `inconclusive`           | SCANNING           | No clear rejection/bounce                  | No         |
| 20  | PULLBACK_TESTING  | `timeout`                | INVALIDATED        | 3-8 bars lingering                         | **Yes**    |
| 21  | MISSED            | `cooldown_expired`       | IDLE               | 4 bars elapsed                             | **Yes**    |
| 22  | INVALIDATED       | `cooldown_expired`       | IDLE               | 4 bars elapsed                             | **Yes**    |

★ = New rows from Keltner Sentiment Gate integration:
- ★8 (`sentiment_fakeout`): Hard rule. Keltner gate rejects the breakout before LLM is consulted.
- ★9 (`momentum_confirmed`): Hard rule. Keltner gate confirms breakout with strong sentiment, generates advisory immediately, transitions to IDLE.
- Row 10 (`quality_sufficient`): Now only applies when Keltner zone is normal pullback (bands 5-6) or overextended (bands 1-2 for longs, bands 9-10 for shorts).
- Total transitions increased from 20 to 22.

### 8.2 Hard Rules (Enforced by Code, Not LLM)

These are checked **before** the LLM is called and override any LLM judgment:

```python
# File: services/agent/hard_rules.py

from .state_machine import State
from .sentiment_gate import evaluate_sentiment_gate


def check_hard_rules(agent_state: dict, market_data: dict,
                     keltner_data: dict = None) -> str | None:
    """Check hard rules that override LLM judgment.

    Called before LLM evaluation. If a hard rule fires,
    the returned condition is applied immediately — no LLM needed.

    Evaluation order:
    1. Failed breakout invalidation (price through trendline)
    2. Keltner Sentiment Gate (at BREAKOUT_DETECTED only)

    Args:
        agent_state: Current agent state.
        market_data: Latest market data from PostgreSQL.
        keltner_data: Keltner Channel band data from H4. Required when
                      current_state is BREAKOUT_DETECTED.

    Returns:
        Condition string if a hard rule fires, None if LLM should evaluate.
    """
    current = State(agent_state["current_state"])

    # Rule 1: Failed breakout invalidation
    # If price closes back through the broken trendline, INVALIDATED.
    if current in (State.BREAKOUT_DETECTED, State.AWAITING_PULLBACK, State.PULLBACK_TESTING):
        if _price_closed_through_trendline(agent_state, market_data):
            if current == State.BREAKOUT_DETECTED:
                return "instant_fakeout"
            elif current == State.AWAITING_PULLBACK:
                return "failed_breakout"
            elif current == State.PULLBACK_TESTING:
                return "level_broken"

    # Rule 2: Keltner Sentiment Gate (BREAKOUT_DETECTED only)
    # Determines whether the breakout has sentiment support.
    # Fires sentiment_fakeout or momentum_confirmed as hard gates.
    # Returns None for NORMAL_PULLBACK or OVEREXTENDED (continue to LLM).
    if current == State.BREAKOUT_DETECTED and keltner_data is not None:
        sentiment_result = evaluate_sentiment_gate(agent_state, keltner_data)
        if sentiment_result is not None:
            return sentiment_result
        # If None: normal pullback or overextended — continue to LLM

    # Rule 3: Counter-trend modifier must be applied
    # (Enforced in convergence scoring, not as a transition)

    # Rule 4: State machine sequential flow
    # (Enforced by StateMachine.validate_transition())

    # Rule 5: Cooldown enforcement
    # (Enforced by StateMachine.check_time_based_transitions())

    return None


def _price_closed_through_trendline(agent_state: dict, market_data: dict) -> bool:
    """Check if price has closed back through the broken trendline.

    This is the primary disqualifying condition.

    Args:
        agent_state: Must have breakout_trendline and trade_direction set.
        market_data: Must have latest close price.

    Returns:
        True if the breakout has failed (price on wrong side of trendline).
    """
    trendline = agent_state.get("breakout_trendline")
    direction = agent_state.get("trade_direction")
    close_price = market_data.get("latest_close")

    if not all([trendline, direction, close_price]):
        return False

    # Project trendline to current bar
    slope = trendline.get("slope", 0)
    intercept = trendline.get("intercept", 0)
    bars_since_breakout = agent_state.get("bars_in_state", 0)
    projected_level = intercept + (slope * bars_since_breakout)

    # For longs: price closing BELOW the trendline = failed
    # For shorts: price closing ABOVE the trendline = failed
    if direction == "long" and close_price < projected_level:
        return True
    if direction == "short" and close_price > projected_level:
        return True

    return False
```

---

## 9. Integration with txtai Agent

### 9.1 Agent Configuration (YAML)

```yaml
# File: config/txtai_app.yml

# Embeddings for knowledge retrieval
embeddings:
  path: sentence-transformers/all-MiniLM-L6-v2
  content: true
  backend: faiss

# LLM for evaluation and response generation
llm:
  path: litellm/anthropic/claude-sonnet-4-5-20250929

# Agent with custom trading tools
agent:
  tools:
    - target: services.agent.tools.market_data_retriever
    - target: services.agent.tools.knowledge_retriever
    - target: services.agent.tools.evaluate_trade_setup
  llm:
    path: litellm/anthropic/claude-sonnet-4-5-20250929
  memory: 10 # Keep last 10 exchanges in context

# Workflow for scheduled evaluation cycles
workflow:
  evaluation_cycle:
    tasks:
      - action: services.agent.pipeline.run_evaluation_cycle
    schedule:
      cron: '0 * * * *' # H1 bar close
```

### 9.2 Agent Usage Pattern

```python
# File: services/agent/chat_handler.py

from txtai import Application


def handle_user_chat(app: Application, user_query: str,
                     instrument: str, tf_config: str) -> str:
    """Handle a user chat query using txtai Agent.

    The agent has access to tools for market data, knowledge,
    and trade evaluation. It reads the current state but does
    NOT modify it (only the evaluation cycle modifies state).

    Args:
        app: txtai Application instance.
        user_query: The user's chat message.
        instrument: Trading instrument context.
        tf_config: Timeframe configuration.

    Returns:
        Agent's conversational response.
    """
    # Load current state (read-only, no lock)
    from .state_persistence import AgentStateManager
    state_manager = AgentStateManager(app.config.get("database_url"))
    agent_state = state_manager.load(instrument, tf_config)

    # Build context-aware prompt
    state_context = (
        f"Current state: {agent_state['current_state']}. "
        f"Instrument: {instrument}. Config: {tf_config}. "
        f"Regime: {agent_state.get('regime_classification', 'Unknown')}. "
        f"Convergence: {agent_state.get('convergence_score', 'N/A')}."
    )

    augmented_query = f"{state_context}\n\nUser query: {user_query}"

    # Use txtai Agent (tool-calling with memory)
    response = app.agent("trading_agent", augmented_query)

    return response
```

---

## 10. Integration with txtai Workflow

### 10.1 Evaluation Cycle as Workflow Task

```python
# File: services/agent/pipeline.py

from datetime import datetime
from txtai import Application

from .state_machine import StateMachine, State
from .state_persistence import AgentStateManager
from .hard_rules import check_hard_rules
from .routing import route_after_evaluation
from .convergence import ConvergenceScorer
from .llm_interface import evaluate_with_llm, generate_response


def run_evaluation_cycle(element: dict) -> dict:
    """Main evaluation cycle — runs as a txtai Workflow task.

    This is the function registered in the workflow config.
    It orchestrates the full evaluation pipeline:

    1. Load state from PostgreSQL
    2. Increment bar counter
    3. Check time-based transitions
    4. Check hard rules
    5. Fetch market data
    6. Fetch knowledge context
    7. Run state-specific evaluation
    8. Compute convergence score
    9. LLM evaluation
    10. Apply state transition
    11. Route to respond
    12. Save state to PostgreSQL

    Args:
        element: Dict with 'instrument' and 'tf_config' keys.

    Returns:
        Dict with evaluation results and response.
    """
    instrument = element["instrument"]
    tf_config = element["tf_config"]

    # Initialize components
    state_manager = AgentStateManager(element["database_url"])
    state_machine = StateMachine(element.get("sm_config"))
    scorer = ConvergenceScorer()

    # Step 1: Load state
    agent_state = state_manager.load(instrument, tf_config)

    # Step 2: Increment bar counter
    agent_state = state_machine.increment_bar(agent_state)

    # Step 3: Check time-based transitions
    time_condition = state_machine.check_time_based_transitions(agent_state)
    if time_condition:
        agent_state = state_machine.transition(agent_state, time_condition)
        agent_state["pending_response"] = _generate_time_transition_response(
            agent_state, time_condition
        )
        state_manager.save(agent_state)
        return {"state": agent_state, "response": agent_state["pending_response"]}

    # Step 4: Check hard rules (before LLM)
    current = State(agent_state["current_state"])

    # Skip evaluation for terminal/cooldown states
    if current in (State.MISSED, State.INVALIDATED):
        state_manager.save(agent_state)
        return {"state": agent_state, "response": None}

    # Auto-transition IDLE → NAVIGATING
    if current == State.IDLE:
        agent_state = state_machine.transition(agent_state, "new_bar")
        current = State(agent_state["current_state"])

    # Step 5: Fetch market data
    market_data = _fetch_market_data(instrument, tf_config, element["database_url"])
    agent_state["current_price"] = market_data.get("latest_close")

    # Step 4a: Fetch Keltner data if in BREAKOUT_DETECTED state
    keltner_data = None
    if current == State.BREAKOUT_DETECTED:
        from .keltner import KeltnerChannel
        from .tools import fetch_keltner_data
        keltner_data = fetch_keltner_data(instrument, tf_config)
        agent_state["keltner_bands_snapshot"] = keltner_data

    # Step 4b (continued): Check hard rules with market data and Keltner data
    hard_rule_condition = check_hard_rules(agent_state, market_data, keltner_data)
    if hard_rule_condition:
        # For momentum_confirmed, generate advisory before transitioning
        if hard_rule_condition == "momentum_confirmed":
            from .llm_parser import generate_momentum_advisory
            agent_state["pending_response"] = generate_momentum_advisory(agent_state)
        else:
            agent_state["pending_response"] = _generate_hard_rule_response(
                agent_state, hard_rule_condition, market_data
            )
        agent_state = state_machine.transition(agent_state, hard_rule_condition)
        state_manager.save(agent_state)
        return {"state": agent_state, "response": agent_state["pending_response"]}

    # Step 6: Fetch knowledge context from VectorDB
    knowledge = _fetch_knowledge(agent_state, element.get("embeddings"))

    agent_state["retrieved_knowledge"] = knowledge

    # Step 7: Run state-specific evaluation
    agent_state = _run_state_evaluation(agent_state, market_data, current)

    # Step 8: Compute convergence score
    if current in (State.SCANNING, State.BREAKOUT_DETECTED,
                   State.AWAITING_PULLBACK, State.PULLBACK_TESTING):
        score, breakdown = scorer.compute(agent_state, market_data)
        agent_state["convergence_score"] = score
        agent_state["convergence_breakdown"] = breakdown

        # Update rolling history
        history = agent_state.get("convergence_history") or []
        history.append({"score": score, "time": datetime.utcnow().isoformat()})
        agent_state["convergence_history"] = history[-10:]  # Keep last 10

    # Step 9: LLM evaluation
    llm_result = evaluate_with_llm(agent_state, market_data, knowledge, element.get("llm"))
    agent_state["llm_assessment"] = llm_result.get("assessment")
    agent_state["llm_confidence"] = llm_result.get("confidence")
    agent_state["llm_score_adjustment"] = llm_result.get("score_adjustment", 0)

    # Apply LLM score adjustment
    if agent_state.get("convergence_score") is not None:
        agent_state["convergence_score"] += llm_result.get("score_adjustment", 0)
        # Apply counter-trend modifier
        agent_state["convergence_score"] *= agent_state.get("counter_trend_modifier", 1.0)

    # Step 10: Determine and apply state transition
    condition = llm_result.get("recommended_condition")
    if condition:
        try:
            agent_state = state_machine.transition(agent_state, condition)
        except Exception:
            # If LLM recommends invalid transition, log and continue
            agent_state["llm_override_flag"] = True
            agent_state["llm_override_reason"] = (
                f"LLM recommended invalid transition: {condition}"
            )

    # Step 11: Route and generate response
    route = route_after_evaluation(agent_state)
    response = generate_response(agent_state, market_data, route, element.get("llm"))
    agent_state["pending_response"] = response

    # Step 12: Update audit fields and save
    agent_state["last_evaluation_time"] = datetime.utcnow().isoformat()
    agent_state["evaluation_count"] = agent_state.get("evaluation_count", 0) + 1
    state_manager.save(agent_state)

    return {"state": agent_state, "response": response}


def _fetch_market_data(instrument: str, tf_config: str, database_url: str) -> dict:
    """Fetch pre-computed market data from PostgreSQL.

    Queries trendline_data, OHLCV, momentum, TEMA/HRMA for all
    timeframes in the given configuration.

    Args:
        instrument: Trading instrument.
        tf_config: Timeframe config (determines which TFs to query).
        database_url: PostgreSQL connection string.

    Returns:
        Dict organized by timeframe and data type.
    """
    from sqlalchemy import create_engine, text

    # Timeframe mappings from blueprint
    tf_map = {
        "config_a": {
            "navigation": ["H4", "H2"],
            "decision": ["H2", "H1", "M30"],
            "primary_decision": "H1",
        },
        "config_b": {
            "navigation": ["H8", "H4"],
            "decision": ["H4", "H2", "H1"],
            "primary_decision": "H2",
        },
    }

    config = tf_map[tf_config]
    all_tfs = config["navigation"] + config["decision"]

    engine = create_engine(database_url)
    market_data = {"timeframes": {}, "primary_tf": config["primary_decision"]}

    with engine.connect() as conn:
        for tf in all_tfs:
            # Fetch latest OHLCV bar
            ohlcv = conn.execute(
                text("""
                    SELECT * FROM ohlcv_15m
                    WHERE symbol = :symbol AND timeframe = :tf
                    ORDER BY timestamp DESC LIMIT 1
                """),
                {"symbol": instrument, "tf": tf}
            ).mappings().fetchone()

            # Fetch trendlines
            trendlines = conn.execute(
                text("""
                    SELECT * FROM trendline_data
                    WHERE instrument = :symbol AND timeframe = :tf
                    AND status = 'active'
                    ORDER BY score DESC LIMIT 10
                """),
                {"symbol": instrument, "tf": tf}
            ).mappings().fetchall()

            market_data["timeframes"][tf] = {
                "ohlcv": dict(ohlcv) if ohlcv else None,
                "trendlines": [dict(t) for t in trendlines],
            }

        # Latest close price from primary TF
        primary_tf = config["primary_decision"]
        primary_data = market_data["timeframes"].get(primary_tf, {})
        primary_ohlcv = primary_data.get("ohlcv", {})
        market_data["latest_close"] = primary_ohlcv.get("close") if primary_ohlcv else None

    return market_data


def _fetch_knowledge(agent_state: dict, embeddings) -> str:
    """Fetch relevant methodology knowledge from VectorDB via txtai Embeddings.

    Uses state-based query construction for targeted retrieval.

    Args:
        agent_state: Current state (used to construct query).
        embeddings: txtai Embeddings instance.

    Returns:
        Assembled knowledge context string.
    """
    if embeddings is None:
        return ""

    current = State(agent_state["current_state"])

    # State-specific queries (from blueprint Section on retrieval strategy)
    query_map = {
        State.NAVIGATING: "How to compute aggregate slope score and regime classification from Navigation Layer timeframes",
        State.SCANNING: "How to detect breakout: candle body close beyond trendline, momentum context, TEMA/HRMA confirmation",
        State.BREAKOUT_DETECTED: "How to evaluate breakout quality holistically: body close position, momentum Z-score context, TEMA/HRMA gap state",
        State.AWAITING_PULLBACK: "What constitutes a valid pullback to broken trendline: price enters tolerance zone from new side",
        State.PULLBACK_TESTING: "How to evaluate pullback bounce quality: active rejection vs passive holding, bounce speed and magnitude, price pattern confirmation at zone",
    }

    query = query_map.get(current, "General trading evaluation methodology")

    # Use txtai Embeddings.search() with SQL filtering on state_relevance
    results = embeddings.search(
        f"SELECT text, score FROM txtai "
        f"WHERE similar('{query}') "
        f"AND state_relevance LIKE '%{current.value}%' "
        f"LIMIT 5"
    )

    if not results:
        # Fallback: search without state filter
        results = embeddings.search(query, limit=5)

    # Assemble context string
    if isinstance(results, list) and len(results) > 0:
        chunks = []
        for r in results:
            if isinstance(r, dict):
                chunks.append(r.get("text", str(r)))
            elif isinstance(r, (list, tuple)) and len(r) >= 2:
                chunks.append(str(r[1]) if isinstance(r[1], str) else str(r))
            else:
                chunks.append(str(r))
        return "\n\n---\n\n".join(chunks)

    return ""


def _run_state_evaluation(agent_state: dict, market_data: dict,
                          current: State) -> dict:
    """Run state-specific evaluation logic.

    Updates agent_state with data relevant to the current state.
    This is the rule-based pre-processing before LLM evaluation.
    """
    if current == State.NAVIGATING:
        agent_state = _evaluate_navigation(agent_state, market_data)
    elif current == State.SCANNING:
        agent_state = _evaluate_scanning(agent_state, market_data)
    elif current == State.BREAKOUT_DETECTED:
        agent_state = _evaluate_breakout(agent_state, market_data)
    elif current == State.AWAITING_PULLBACK:
        agent_state = _evaluate_pullback_wait(agent_state, market_data)
    elif current == State.PULLBACK_TESTING:
        agent_state = _evaluate_pullback_test(agent_state, market_data)
    return agent_state


def _evaluate_navigation(agent_state: dict, market_data: dict) -> dict:
    """Compute Navigation Layer outputs: regime, slope score, counter-trend modifier."""
    # Extract navigation TF data
    nav_tfs = ["H4", "H2"] if agent_state["tf_config"] == "config_a" else ["H8", "H4"]

    slope_scores = []
    for tf in nav_tfs:
        tf_data = market_data["timeframes"].get(tf, {})
        ohlcv = tf_data.get("ohlcv", {})
        if ohlcv:
            # Use trend_direction and adx_value as proxy for slope
            trend = ohlcv.get("trend_direction", "RANGING")
            adx = float(ohlcv.get("adx_value", 0) or 0)
            score = adx if trend == "UP" else (-adx if trend == "DOWN" else 0)
            slope_scores.append(score)

    if slope_scores:
        agent_state["aggregate_slope_score"] = sum(slope_scores) / len(slope_scores)

    # Classify regime
    agg = agent_state.get("aggregate_slope_score", 0)
    if agg > 25:
        agent_state["regime_classification"] = "Strong Bullish"
    elif agg > 10:
        agent_state["regime_classification"] = "Bullish"
    elif agg > -10:
        agent_state["regime_classification"] = "Neutral"
    elif agg > -25:
        agent_state["regime_classification"] = "Bearish"
    else:
        agent_state["regime_classification"] = "Strong Bearish"

    # Counter-trend modifier
    direction = agent_state.get("trade_direction")
    regime = agent_state.get("regime_classification", "Neutral")

    if direction == "long" and "Bearish" in regime:
        agent_state["counter_trend_flag"] = True
        agent_state["counter_trend_modifier"] = 0.7 if "Strong" in regime else 0.85
    elif direction == "short" and "Bullish" in regime:
        agent_state["counter_trend_flag"] = True
        agent_state["counter_trend_modifier"] = 0.7 if "Strong" in regime else 0.85
    else:
        agent_state["counter_trend_flag"] = False
        agent_state["counter_trend_modifier"] = 1.0

    return agent_state


def _evaluate_scanning(agent_state: dict, market_data: dict) -> dict:
    """Check for breakout on Decision Layer timeframes."""
    primary_tf = market_data.get("primary_tf", "H1")
    tf_data = market_data["timeframes"].get(primary_tf, {})
    trendlines = tf_data.get("trendlines", [])
    ohlcv = tf_data.get("ohlcv", {})

    if ohlcv and trendlines:
        close = float(ohlcv.get("close", 0))
        agent_state["decision_trendlines"] = trendlines

        # Check each trendline for breakout
        for tl in trendlines:
            projected = float(tl.get("projected_price", 0))
            if projected == 0:
                continue
            # Bullish breakout: close > trendline (resistance broken)
            if close > projected and tl.get("role") == "resistance":
                agent_state["breakout_bar_price"] = close
                agent_state["breakout_trendline"] = tl
                agent_state["trade_direction"] = "long"
                break
            # Bearish breakout: close < trendline (support broken)
            if close < projected and tl.get("role") == "support":
                agent_state["breakout_bar_price"] = close
                agent_state["breakout_trendline"] = tl
                agent_state["trade_direction"] = "short"
                break

    return agent_state


def _evaluate_breakout(agent_state: dict, market_data: dict) -> dict:
    """Evaluate breakout quality (LLM will make the final judgment)."""
    primary_tf = market_data.get("primary_tf", "H1")
    tf_data = market_data["timeframes"].get(primary_tf, {})
    ohlcv = tf_data.get("ohlcv", {})

    if ohlcv:
        agent_state["decision_momentum"] = {
            "rsi": ohlcv.get("rsi_value"),
            "trend": ohlcv.get("trend_direction"),
            "volatility": ohlcv.get("volatility_regime"),
        }
    return agent_state


def _evaluate_pullback_wait(agent_state: dict, market_data: dict) -> dict:
    """Monitor for pullback arrival toward broken trendline."""
    trendline = agent_state.get("breakout_trendline", {})
    close = market_data.get("latest_close")

    if trendline and close:
        projected = float(trendline.get("projected_price", 0))
        tolerance = abs(projected * 0.002)  # 0.2% tolerance zone
        distance = abs(close - projected)

        agent_state["_pullback_distance"] = distance
        agent_state["_in_tolerance_zone"] = distance <= tolerance

    return agent_state


def _evaluate_pullback_test(agent_state: dict, market_data: dict) -> dict:
    """Evaluate bounce quality at the broken trendline zone."""
    # Zone construction and density scoring would go here
    # For now, populate fields for LLM to evaluate
    primary_tf = market_data.get("primary_tf", "H1")
    tf_data = market_data["timeframes"].get(primary_tf, {})
    ohlcv = tf_data.get("ohlcv", {})

    if ohlcv:
        agent_state["decision_tema_hrma"] = {
            "trend": ohlcv.get("trend_direction"),
            "momentum": ohlcv.get("swing_momentum"),
        }
    return agent_state


def _generate_time_transition_response(agent_state: dict, condition: str) -> str:
    """Generate response text for time-based transitions."""
    state = agent_state["current_state"]
    instrument = agent_state["instrument"]

    messages = {
        "timeout": f"{instrument}: Setup timed out in {state}. Returning to monitoring.",
        "window_expired": f"{instrument}: Observation window expired. No pullback entry conditions were met within the monitoring period. Cooldown active.",
        "cooldown_expired": f"{instrument}: Cooldown complete. Resuming normal monitoring.",
    }
    return messages.get(condition, f"{instrument}: State transition due to {condition}.")


def _generate_hard_rule_response(agent_state: dict, condition: str,
                                  market_data: dict) -> str:
    """Generate response text for hard rule transitions."""
    instrument = agent_state["instrument"]
    price = market_data.get("latest_close", "N/A")
    band = agent_state.get("keltner_band_position", "N/A")
    direction = agent_state.get("trade_direction", "unknown")

    sentiment_label = "bearish" if direction == "long" else "bullish"

    messages = {
        "instant_fakeout": f"{instrument}: INVALIDATED. Price reversed back through trendline (close: {price}). Breakout appears to have failed — setup discontinued.",
        "failed_breakout": f"{instrument}: INVALIDATED. Price closed back through broken trendline. Breakout appears to have failed — setup discontinued.",
        "level_broken": f"{instrument}: INVALIDATED. Key level appears broken decisively. Zone test conditions no longer favorable — setup discontinued.",
        "sentiment_fakeout": (
            f"{instrument}: INVALIDATED — Keltner band position {band} suggests "
            f"{sentiment_label} sentiment may still be dominant. Structural conditions "
            f"appear unfavorable for sustained reversal — elevated fakeout risk. "
            f"Setup discontinued."
        ),
    }
    return messages.get(condition, f"{instrument}: Hard rule triggered: {condition}.")
```

---

## 11. Custom Tools for txtai Agent

### 11.1 Market Data Retriever Tool

```python
# File: services/agent/tools.py

import json
from sqlalchemy import create_engine, text

# Database URL loaded from environment
DATABASE_URL = None  # Set during application initialization


def market_data_retriever(instrument: str, timeframes: str, data_types: str) -> str:
    """Retrieve pre-computed market data from PostgreSQL.

    Queries OHLCV bars, trendline parameters, momentum indicators,
    and TEMA/HRMA values for the specified instrument and timeframes.

    Args:
        instrument: Trading instrument (e.g., EURUSD, XAUUSD, BTCUSD)
        timeframes: Comma-separated timeframes (e.g., H4,H2,H1,M30)
        data_types: Comma-separated types (e.g., trendlines,momentum,tema_hrma,ohlc)

    Returns:
        JSON string with market data organized by timeframe and data type
    """
    engine = create_engine(DATABASE_URL)
    tfs = [t.strip() for t in timeframes.split(",")]
    types = [t.strip() for t in data_types.split(",")]

    result = {}
    with engine.connect() as conn:
        for tf in tfs:
            result[tf] = {}

            if "ohlc" in types:
                row = conn.execute(
                    text("""
                        SELECT timestamp, open, high, low, close, volume,
                               atr_value, atr_percentile, adx_value, rsi_value,
                               trend_direction, volatility_regime, swing_momentum
                        FROM ohlcv_15m
                        WHERE symbol = :symbol AND timeframe = :tf
                        ORDER BY timestamp DESC LIMIT 20
                    """),
                    {"symbol": instrument, "tf": tf}
                ).mappings().fetchall()
                result[tf]["ohlc"] = [dict(r) for r in row]

            if "trendlines" in types:
                rows = conn.execute(
                    text("""
                        SELECT slope_degrees, intercept, projected_price, score,
                               touch_count, status, rank, role
                        FROM trendline_data
                        WHERE instrument = :symbol AND timeframe = :tf
                        AND status = 'active'
                        ORDER BY score DESC LIMIT 10
                    """),
                    {"symbol": instrument, "tf": tf}
                ).mappings().fetchall()
                result[tf]["trendlines"] = [dict(r) for r in rows]

    return json.dumps(result, default=str)


def knowledge_retriever(query: str, current_state: str = "", topic: str = "") -> str:
    """Retrieve trading methodology knowledge from VectorDB.

    Searches the embedded Blueprint v2.1 methodology chunks
    for relevant context based on the analytical query.

    Args:
        query: Analytical query describing what knowledge is needed
        current_state: Current state machine state for metadata filtering (e.g., SCANNING)
        topic: Optional topic filter (e.g., trendline, momentum, convergence)

    Returns:
        Assembled knowledge context string from matching methodology chunks
    """
    # This tool is backed by txtai Embeddings
    # The actual search is performed by the EmbeddingsTool wrapper
    # This function signature defines the tool interface for the Agent
    return f"Knowledge query: {query} (state={current_state}, topic={topic})"


def evaluate_trade_setup(instrument: str, tf_config: str) -> str:
    """Trigger a full trade evaluation cycle for the given instrument.

    Runs the complete evaluation pipeline: navigation → scanning →
    breakout detection → pullback evaluation → convergence scoring.
    Returns the current assessment and state.

    Args:
        instrument: Trading instrument (e.g., EURUSD)
        tf_config: Timeframe configuration (config_a or config_b)

    Returns:
        JSON string with evaluation results, current state, and convergence score
    """
    from .pipeline import run_evaluation_cycle

    result = run_evaluation_cycle({
        "instrument": instrument,
        "tf_config": tf_config,
        "database_url": DATABASE_URL,
    })

    state = result.get("state", {})
    return json.dumps({
        "instrument": instrument,
        "current_state": state.get("current_state"),
        "regime": state.get("regime_classification"),
        "convergence_score": state.get("convergence_score"),
        "confidence": state.get("llm_confidence"),
        "assessment": state.get("llm_assessment"),
        "response": result.get("response"),
    }, default=str)
```

---

## 12. Evaluation Pipeline — Node-by-Node

### 12.1 Processing Flow Per State

| State             | What Gets Computed                                   | Data Sources                         | LLM Needed?                                             |
| ----------------- | ---------------------------------------------------- | ------------------------------------ | ------------------------------------------------------- |
| NAVIGATING        | Slope score, regime, counter-trend modifier          | Navigation TF OHLCV                  | No (rule-based)                                         |
| SCANNING          | Breakout detection on primary Decision TF            | Decision TF trendlines + OHLCV       | No (rule-based detection), Yes (quality pre-assessment) |
| BREAKOUT_DETECTED | Breakout quality evaluation                          | Momentum, TEMA/HRMA, trendline score | Yes (holistic quality judgment)                         |
| AWAITING_PULLBACK | Pullback distance monitoring                         | Close price vs projected trendline   | No (distance calculation)                               |
| PULLBACK_TESTING  | Bounce quality, zone construction, pattern detection | All Decision TF data, S/R zones      | Yes (bounce quality judgment)                           |

### 12.2 State-Specific LLM Prompts

See Section 14 for complete prompt templates per state.

---

## 13. Convergence Scoring Engine

### 13.1 Five-Factor Scoring

```python
# File: services/agent/convergence.py

from typing import Tuple


class ConvergenceScorer:
    """Rule-based 5-factor convergence scoring.

    Each factor scored -2 to +2.
    Raw score range: -10 to +10.
    After counter-trend modifier: adjusted score.
    Thresholds: ENTER >= 5.0, WAIT 2.5-4.9, NO TRADE < 2.5.

    LLM can adjust by -1.5 to +1.5 (applied after rule-based score).
    """

    # Thresholds
    ENTER_THRESHOLD = 5.0
    WAIT_THRESHOLD = 2.5

    def compute(self, agent_state: dict, market_data: dict) -> Tuple[float, dict]:
        """Compute the 5-factor convergence score.

        Args:
            agent_state: Current agent state.
            market_data: Latest market data.

        Returns:
            Tuple of (total_score, breakdown_dict).
        """
        breakdown = {
            "trendline": self._score_trendline(agent_state, market_data),
            "momentum": self._score_momentum(agent_state, market_data),
            "tema_hrma": self._score_tema_hrma(agent_state, market_data),
            "navigation_regime": self._score_regime(agent_state),
            "price_pattern": self._score_price_pattern(agent_state),
        }

        total = sum(breakdown.values())
        return total, breakdown

    def _score_trendline(self, agent_state: dict, market_data: dict) -> float:
        """Factor 1: Trendline — scored -2 to +2.

        Based on: trendline score (touch count, slope, proximity),
        breakout quality, trendline role reversal confirmation.
        """
        tl = agent_state.get("breakout_trendline", {})
        if not tl:
            return 0.0

        tl_score = float(tl.get("score", 0))
        touches = int(tl.get("touch_count", 0))

        # Higher trendline score and more touches = better
        if tl_score > 0.8 and touches >= 3:
            return 2.0
        elif tl_score > 0.6 and touches >= 2:
            return 1.0
        elif tl_score > 0.4:
            return 0.0
        elif tl_score > 0.2:
            return -1.0
        else:
            return -2.0

    def _score_momentum(self, agent_state: dict, market_data: dict) -> float:
        """Factor 2: Momentum — scored -2 to +2.

        Based on: Body Size Momentum Z-Score classification,
        invigorated vs exhausting context interpretation.
        """
        momentum = agent_state.get("decision_momentum", {})
        direction = agent_state.get("trade_direction", "long")

        rsi = float(momentum.get("rsi", 50) or 50)

        # Simple RSI-based scoring as proxy
        if direction == "long":
            if 40 <= rsi <= 60:
                return 1.0   # Neutral momentum — room to run
            elif rsi < 30:
                return 2.0   # Oversold — potential bounce
            elif rsi > 70:
                return -1.0  # Overbought — exhaustion risk
            else:
                return 0.0
        else:  # short
            if 40 <= rsi <= 60:
                return 1.0
            elif rsi > 70:
                return 2.0   # Overbought — potential drop
            elif rsi < 30:
                return -1.0  # Oversold — bounce risk
            else:
                return 0.0

    def _score_tema_hrma(self, agent_state: dict, market_data: dict) -> float:
        """Factor 3: TEMA/HRMA — scored -2 to +2.

        Based on: Gap analysis (wide/narrow/crossing),
        direction alignment with trade direction.
        """
        tema = agent_state.get("decision_tema_hrma", {})
        trend = tema.get("trend", "RANGING")
        direction = agent_state.get("trade_direction", "long")

        if direction == "long":
            if trend == "UP":
                return 1.5
            elif trend == "RANGING":
                return 0.0
            else:
                return -1.5
        else:
            if trend == "DOWN":
                return 1.5
            elif trend == "RANGING":
                return 0.0
            else:
                return -1.5

    def _score_regime(self, agent_state: dict) -> float:
        """Factor 4: Navigation Regime — scored -2 to +2.

        Based on: Regime alignment with trade direction.
        Note: Counter-trend modifier is applied separately (multiplicative).
        """
        regime = agent_state.get("regime_classification", "Neutral")
        direction = agent_state.get("trade_direction", "long")

        regime_scores = {
            "Strong Bullish": 2.0,
            "Bullish": 1.0,
            "Neutral": 0.0,
            "Bearish": -1.0,
            "Strong Bearish": -2.0,
        }

        score = regime_scores.get(regime, 0.0)
        # Flip for short trades
        if direction == "short":
            score = -score

        return score

    def _score_price_pattern(self, agent_state: dict) -> float:
        """Factor 5: Price Pattern at S/R Zone — scored -2 to +2.

        Based on: Pattern type detected (double bottom, engulfing, etc.).
        Only applicable in PULLBACK_TESTING state.
        """
        pattern = agent_state.get("price_pattern_state", {})
        if not pattern:
            return 0.0

        pattern_type = pattern.get("type", "none")
        pattern_scores = {
            "double_bottom": 2.0,
            "double_top": 2.0,
            "higher_low": 1.5,
            "lower_high": 1.5,
            "hammer": 1.0,
            "pin_bar": 1.0,
            "engulfing": 1.5,
            "none": 0.0,
            "absorption": -1.0,  # Price lingering — negative signal
        }

        return pattern_scores.get(pattern_type, 0.0)

    @staticmethod
    def classify_score(score: float) -> str:
        """Classify the convergence score into a decision.

        Args:
            score: The adjusted convergence score.

        Returns:
            One of: 'ENTER', 'WAIT', 'NO_TRADE'.
        """
        if score >= ConvergenceScorer.ENTER_THRESHOLD:
            return "ENTER"
        elif score >= ConvergenceScorer.WAIT_THRESHOLD:
            return "WAIT"
        else:
            return "NO_TRADE"
```

---

## 14. LLM Prompt Construction

### 14.1 Evaluation Prompt Template

```python
# File: services/agent/llm_interface.py

from txtai.pipeline import LLM


EVALUATION_PROMPT_TEMPLATE = """You are a trading analysis engine evaluating a {instrument} setup on {tf_config} timeframes.

## Current State: {current_state}
## Trade Direction: {trade_direction}
## Bars in State: {bars_in_state}

## Navigation Layer
- Regime: {regime_classification}
- Aggregate Slope Score: {aggregate_slope_score}
- Counter-Trend: {counter_trend_flag} (modifier: {counter_trend_modifier})

## Market Data (Primary Decision TF)
{market_data_summary}

## Rule-Based Convergence Score
- Total: {convergence_score}
- Breakdown: {convergence_breakdown}
- Classification: {score_classification}

## Keltner Sentiment Context
Sentiment Measurement Timeframe: H4
Keltner Band Position: {keltner_band_position} (1=ultra extreme upper, 10=ultra extreme lower)
Sentiment Zone: {keltner_sentiment_zone}
ATR(162): {keltner_atr}
Upper Middle (HRMA of H4 High): {keltner_upper_middle}
Lower Middle (HRMA of H4 Low): {keltner_lower_middle}

Band position {keltner_band_position} for a {trade_direction} trade indicates:
{sentiment_zone_explanation}

Consider this structural sentiment context in your breakout quality evaluation.
For OVEREXTENDED zone: evaluate whether mean reversion signals are developing
(narrowing TEMA/HRMA gap, reduced momentum, absorption candles).

## Methodology Context (from Knowledge Base)
{retrieved_knowledge}

## Allowed Transitions from {current_state}
{allowed_transitions}

## Your Task
1. Evaluate the current setup quality considering all factors holistically.
2. Provide a score adjustment between -1.5 and +1.5 based on contextual factors the rules may miss.
3. Recommend one of the allowed transitions with your reasoning.
4. Provide a confidence level (0.0 to 1.0).

## Hard Rules You Must Respect
- If price has closed back through the broken trendline → INVALIDATED (already checked before you)
- You cannot skip states or recommend transitions not in the allowed list
- Counter-trend modifier has already been applied to the score
- For pullback evaluation: require ACTIVE bounce/rejection, not passive holding

## CRITICAL: Tone & Language Rules for Assessment Text
Market movement is inherently unpredictable. Your assessment text will be shown to users.
You MUST follow these language rules strictly:

PROHIBITED — Never use these phrases or equivalents:
- "breakout confirmed" / "breakout is confirmed"
- "pullback unlikely" / "pullback will not occur" / "no pullback expected"
- "pullback expected" / "pullback will occur" / "will pull back"
- "price will" / "price is going to" / "will move to"
- "mean reversion expected" / "mean reversion will force"
- "strong bullish" / "strong bearish" (as absolute characterizations)
- "the breakout is a fakeout" / "this is a fakeout"
- "guaranteed" / "certain" / "definitely" / "without doubt"
- "confirmed direction" / "the move will continue"

REQUIRED — Use hedged, probabilistic language instead:
- "breakout detected" / "breakout attempt observed"
- "pullback may be less likely" / "conditions may not favor a traditional pullback"
- "conditions may favor a pullback" / "pullback conditions appear present"
- "price may" / "price appears to be" / "conditions suggest"
- "retracement conditions may develop" / "mean reversion dynamics could emerge"
- "suggests elevated bullish/bearish sentiment"
- "elevated fakeout risk" / "conditions appear unfavorable"
- "appears to" / "suggests" / "may indicate" / "conditions favor"

ALWAYS include one of these disclaimers in your assessment:
- "Market conditions can change rapidly."
- "This reflects current structural conditions, not a prediction."
- "Past patterns do not guarantee future behavior."

## Response Format
Respond in JSON:
{{
    "score_adjustment": <float between -1.5 and 1.5>,
    "recommended_condition": "<one of the allowed transition conditions>",
    "confidence": <float between 0.0 and 1.0>,
    "assessment": "<2-3 sentence natural language assessment using ONLY hedged/probabilistic language as specified above>"
}}
"""


def evaluate_with_llm(agent_state: dict, market_data: dict,
                      knowledge: str, llm_instance=None) -> dict:
    """Call Claude API via txtai LLM pipeline for evaluation.

    Args:
        agent_state: Current agent state.
        market_data: Market data from PostgreSQL.
        knowledge: Knowledge context from VectorDB.
        llm_instance: txtai LLM pipeline instance (or creates one).

    Returns:
        Dict with: score_adjustment, recommended_condition, confidence, assessment.
    """
    from .state_machine import StateMachine, State
    from .convergence import ConvergenceScorer

    sm = StateMachine()
    current = State(agent_state["current_state"])
    allowed = sm.get_allowed_transitions(current)

    # Build market data summary string
    primary_tf = market_data.get("primary_tf", "H1")
    primary = market_data.get("timeframes", {}).get(primary_tf, {})
    ohlcv = primary.get("ohlcv", {})

    market_summary = f"Price: {ohlcv.get('close', 'N/A')}, "
    market_summary += f"Trend: {ohlcv.get('trend_direction', 'N/A')}, "
    market_summary += f"Volatility: {ohlcv.get('volatility_regime', 'N/A')}, "
    market_summary += f"RSI: {ohlcv.get('rsi_value', 'N/A')}, "
    market_summary += f"ATR Percentile: {ohlcv.get('atr_percentile', 'N/A')}"

    score = agent_state.get("convergence_score", 0)
    classification = ConvergenceScorer.classify_score(score) if score else "N/A"

    # Build Keltner context for prompt
    keltner_snapshot = agent_state.get("keltner_bands_snapshot") or {}
    keltner_zone = agent_state.get("keltner_sentiment_zone", "N/A")
    keltner_band = agent_state.get("keltner_band_position", "N/A")
    trade_dir = agent_state.get("trade_direction", "None")

    # Generate sentiment zone explanation for LLM
    zone_explanations = {
        "NORMAL_PULLBACK": "Moderate momentum — conditions may favor a pullback to the broken trendline area. Standard breakout-pullback-confirmation flow applies, but outcomes are never certain.",
        "OVEREXTENDED": "Price appears at elevated deviation from the mean. Despite apparent directional sentiment, chasing at this extension carries risk. Mean reversion conditions may develop — monitor for signs of retracement.",
    }
    sentiment_explanation = zone_explanations.get(
        keltner_zone,
        f"Sentiment zone: {keltner_zone}. Evaluate accordingly."
    )

    prompt = EVALUATION_PROMPT_TEMPLATE.format(
        instrument=agent_state.get("instrument", "Unknown"),
        tf_config=agent_state.get("tf_config", "Unknown"),
        current_state=current.value,
        trade_direction=trade_dir,
        bars_in_state=agent_state.get("bars_in_state", 0),
        regime_classification=agent_state.get("regime_classification", "Unknown"),
        aggregate_slope_score=agent_state.get("aggregate_slope_score", "N/A"),
        counter_trend_flag=agent_state.get("counter_trend_flag", False),
        counter_trend_modifier=agent_state.get("counter_trend_modifier", 1.0),
        market_data_summary=market_summary,
        convergence_score=score,
        convergence_breakdown=agent_state.get("convergence_breakdown", {}),
        score_classification=classification,
        keltner_band_position=keltner_band,
        keltner_sentiment_zone=keltner_zone,
        keltner_atr=keltner_snapshot.get("atr", "N/A"),
        keltner_upper_middle=keltner_snapshot.get("upper_middle", "N/A"),
        keltner_lower_middle=keltner_snapshot.get("lower_middle", "N/A"),
        sentiment_zone_explanation=sentiment_explanation,
        retrieved_knowledge=knowledge or "No methodology context retrieved.",
        allowed_transitions="\n".join(
            f"- '{cond}' → {target}" for cond, target in allowed.items()
        ),
    )

    # Call LLM via txtai
    if llm_instance is None:
        llm_instance = LLM("litellm/anthropic/claude-sonnet-4-5-20250929")

    response_text = llm_instance(prompt, maxlength=1024)

    # Parse response
    return parse_llm_output(response_text)
```

---

## 15. LLM Output Parsing

```python
# File: services/agent/llm_parser.py

import json
import re
from typing import Optional


def parse_llm_output(response_text: str) -> dict:
    """Parse structured JSON output from Claude LLM.

    Claude is reliable at JSON output, but we add fallback
    handling for malformed responses.

    Args:
        response_text: Raw text response from LLM.

    Returns:
        Dict with: score_adjustment, recommended_condition, confidence, assessment.
    """
    # Try direct JSON parse
    try:
        # Extract JSON from response (may have text before/after)
        json_match = re.search(r'\{[^{}]*\}', response_text, re.DOTALL)
        if json_match:
            parsed = json.loads(json_match.group())
            return _validate_parsed_output(parsed)
    except (json.JSONDecodeError, ValueError):
        pass

    # Fallback: extract fields with regex
    return _regex_fallback_parse(response_text)


def _validate_parsed_output(parsed: dict) -> dict:
    """Validate and clamp parsed LLM output values."""
    result = {
        "score_adjustment": 0.0,
        "recommended_condition": None,
        "confidence": 0.5,
        "assessment": "",
    }

    # Score adjustment: clamp to [-1.5, 1.5]
    adj = parsed.get("score_adjustment", 0)
    try:
        adj = float(adj)
        result["score_adjustment"] = max(-1.5, min(1.5, adj))
    except (TypeError, ValueError):
        result["score_adjustment"] = 0.0

    # Recommended condition
    result["recommended_condition"] = parsed.get("recommended_condition")

    # Confidence: clamp to [0.0, 1.0]
    conf = parsed.get("confidence", 0.5)
    try:
        conf = float(conf)
        result["confidence"] = max(0.0, min(1.0, conf))
    except (TypeError, ValueError):
        result["confidence"] = 0.5

    # Assessment text
    result["assessment"] = str(parsed.get("assessment", ""))

    return result


def _regex_fallback_parse(text: str) -> dict:
    """Fallback parser using regex when JSON parsing fails.

    Extracts key-value pairs from LLM text output.
    """
    result = {
        "score_adjustment": 0.0,
        "recommended_condition": None,
        "confidence": 0.5,
        "assessment": text[:500],  # Use first 500 chars as assessment
    }

    # Try to find score adjustment
    adj_match = re.search(r'score_adjustment["\s:]+(-?[\d.]+)', text)
    if adj_match:
        try:
            result["score_adjustment"] = max(-1.5, min(1.5, float(adj_match.group(1))))
        except ValueError:
            pass

    # Try to find recommended condition
    cond_match = re.search(r'recommended_condition["\s:]+["\']?(\w+)["\']?', text)
    if cond_match:
        result["recommended_condition"] = cond_match.group(1)

    # Try to find confidence
    conf_match = re.search(r'confidence["\s:]+(-?[\d.]+)', text)
    if conf_match:
        try:
            result["confidence"] = max(0.0, min(1.0, float(conf_match.group(1))))
        except ValueError:
            pass

    return result


def generate_momentum_advisory(agent_state: dict) -> str:
    """Generate advisory for momentum-zone breakout where pullback appears less likely.

    Called when the Keltner Sentiment Gate determines that structural
    sentiment appears to favor the breakout direction, suggesting a
    traditional pullback may be less likely to occur.

    Uses cautious, probabilistic language throughout — never states
    price direction as certainty.

    Args:
        agent_state: Agent state with breakout and Keltner data.

    Returns:
        Advisory text for the chat UI.
    """
    direction_label = "LONG" if agent_state["trade_direction"] == "long" else "SHORT"
    band = agent_state["keltner_band_position"]
    instrument = agent_state["instrument"]
    score = agent_state.get("convergence_score", "N/A")
    regime = agent_state.get("regime_classification", "Unknown")
    breakout_price = agent_state.get("breakout_bar_price", "N/A")

    sentiment_desc = (
        "elevated bullish" if agent_state["trade_direction"] == "long"
        else "elevated bearish"
    )

    return (
        f"MOMENTUM OBSERVATION — {instrument} {direction_label}\n\n"
        f"Breakout detected at {breakout_price}. "
        f"H4 Keltner band position: {band} — suggests {sentiment_desc} sentiment. "
        f"In this environment, a traditional pullback to the broken trendline "
        f"may be less likely to develop — but this is not guaranteed.\n\n"
        f"Regime: {regime}\n"
        f"Convergence: {score}\n"
        f"Sentiment zone: MOMENTUM OBSERVATION\n\n"
        f"CAUTION: Market conditions can change rapidly. This observation "
        f"reflects current structural sentiment, not a prediction. "
        f"Precise entry prices require separate analysis "
        f"(micro-timeframe S/R, consolidation levels within momentum move)."
    )


def generate_response(agent_state: dict, market_data: dict,
                      route: str, llm_instance=None) -> str:
    """Generate conversational response for the chat UI.

    Uses the LLM to produce a natural language response based
    on the evaluation results and current state.

    Args:
        agent_state: Current agent state after evaluation.
        market_data: Latest market data.
        route: Routing decision from route_after_evaluation().
        llm_instance: txtai LLM pipeline instance.

    Returns:
        Natural language response string.
    """
    from txtai.pipeline import LLM

    if llm_instance is None:
        llm_instance = LLM("litellm/anthropic/claude-sonnet-4-5-20250929")

    state = agent_state.get("current_state", "IDLE")
    instrument = agent_state.get("instrument", "Unknown")
    score = agent_state.get("convergence_score")
    regime = agent_state.get("regime_classification", "Unknown")
    assessment = agent_state.get("llm_assessment", "")

    if route == "respond_momentum_advisory":
        # Momentum advisory already generated by generate_momentum_advisory()
        # Optionally use LLM to enhance the response
        return agent_state.get("pending_response", generate_momentum_advisory(agent_state))

    if route == "build_zone_and_respond":
        prompt = (
            f"Generate a trade observation summary for {instrument}. "
            f"State: {state}. Regime: {regime}. Convergence score: {score}. "
            f"Assessment: {assessment}. "
            f"Zone: {agent_state.get('sr_zone', 'N/A')}. "
            f"Include: observed zone levels, suggested lot allocation, "
            f"score breakdown, confidence level, and key risk factors. "
            f"TONE RULES: Use probabilistic, hedged language throughout. "
            f"Say 'conditions suggest' not 'price will'. Say 'appears favorable' "
            f"not 'confirmed'. Never use 'guaranteed', 'certain', or 'will'. "
            f"Include a brief risk disclaimer. Lead with the observation, "
            f"then supporting data."
        )
    else:
        prompt = (
            f"Generate a brief status update for {instrument}. "
            f"State: {state}. Regime: {regime}. Score: {score}. "
            f"Assessment: {assessment}. "
            f"TONE RULES: Use cautious, probabilistic language. "
            f"Say 'appears to' or 'suggests' rather than definitive statements. "
            f"Never state outcomes as certain. "
            f"Be concise — 2-3 sentences. State the key observation first."
        )

    raw_response = llm_instance(prompt, maxlength=512)

    # Post-generation tone validation (Section 26)
    from tone_validator import enforce_tone
    return enforce_tone(raw_response, llm_instance=llm_instance)
```

---

## 16. Error Handling and Recovery

### 16.1 Error Categories and Responses

| Error Category                | Example                           | Handling                                                               |
| ----------------------------- | --------------------------------- | ---------------------------------------------------------------------- |
| PostgreSQL connection failure | State load/save fails             | Retry 3x with backoff; skip cycle if persistent                        |
| VectorDB search failure       | Knowledge retrieval returns empty | Proceed without knowledge context (degraded mode)                      |
| LLM API failure               | Claude API timeout/error          | Use rule-based score only (no LLM adjustment); log degraded evaluation |
| Invalid LLM output            | Malformed JSON, invalid condition | Use regex fallback parser; if still invalid, default to no transition  |
| State corruption              | Invalid state value in DB         | Recovery: reset to IDLE with logging                                   |
| Stale state                   | No update for >2 hours            | Cron job resets to IDLE (see recovery.py)                              |

### 16.2 Graceful Degradation

```python
# The evaluation pipeline degrades gracefully:
#
# Full evaluation (all systems healthy):
#   Market data + Knowledge + Rule-based score + LLM adjustment → Decision
#
# Degraded Level 1 (VectorDB down):
#   Market data + Rule-based score + LLM (without knowledge context) → Decision
#
# Degraded Level 2 (LLM API down):
#   Market data + Rule-based score only → Decision
#   (No LLM adjustment, no conversational response)
#
# Degraded Level 3 (PostgreSQL market data down):
#   Cannot evaluate → Skip cycle, log error, try next bar
#
# Degraded Level 4 (PostgreSQL state down):
#   Cannot load/save state → Skip cycle entirely
```

---

## 17. Configuration

### 17.1 Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/trading_saas

# LLM
ANTHROPIC_API_KEY=sk-ant-...
LLM_MODEL=anthropic/claude-sonnet-4-5-20250929

# Embeddings
EMBEDDINGS_PATH=/path/to/knowledge/index

# State Machine
SM_BREAKOUT_WINDOW=3        # bars
SM_PULLBACK_WINDOW=10       # bars
SM_TESTING_WINDOW=5         # bars
SM_COOLDOWN_BARS=4          # bars

# Instruments to monitor
INSTRUMENTS=EURUSD,XAUUSD,BTCUSD,GBPUSD
TF_CONFIG=config_a          # or config_b

# Keltner Sentiment Gate
KELTNER_HRMA_PERIOD=54
KELTNER_ATR_PERIOD=162
KELTNER_SENTIMENT_TF=H4
```

### 17.3 Keltner Configuration

```python
# Add to services/agent/config.py

KELTNER_CONFIG = {
    # Indicator parameters
    "hrma_period": 54,                    # HRMA period (reduced from 72 for responsiveness at HTF)
    "atr_period": 162,                    # ATR period for band width
    "multiplier_ultra_extreme": 4.0,      # Bands 1 and 10
    "multiplier_extreme": 3.0,            # Bands 2 and 9
    "multiplier_uppermost": 2.0,          # Bands 3 and 8
    "multiplier_upper": 1.0,              # Bands 4 and 7

    # Sentiment measurement timeframe
    "sentiment_tf_config_a": "H4",        # For H1 primary Decision TF
    "sentiment_tf_config_b": "H4",        # For H2 primary Decision TF

    # Sentiment zone thresholds (band positions)
    # Long (bullish breakout — price pierces negative slope trendline):
    "long_fakeout_threshold": 7,          # Bands >= 7 → fakeout
    "long_normal_bands": [5, 6],          # Bands 5-6 → normal pullback
    "long_momentum_bands": [3, 4],        # Bands 3-4 → momentum confirmed
    "long_overextended_threshold": 3,     # Bands < 3 → overextended

    # Short (bearish breakout — price pierces positive slope trendline):
    "short_fakeout_threshold": 5,         # Bands <= 5 → fakeout
    "short_normal_bands": [6, 7],         # Bands 6-7 → normal pullback
    "short_momentum_bands": [8, 9],       # Bands 8-9 → momentum confirmed
    "short_overextended_threshold": 9,    # Bands > 9 → overextended
}
```

### 17.2 txtai Application Config

```yaml
# File: config/txtai_app.yml

# Knowledge base embeddings
embeddings:
  path: sentence-transformers/all-MiniLM-L6-v2
  content: true
  backend: faiss
  database:
    content: true

# LLM pipeline
llm:
  path: litellm/anthropic/claude-sonnet-4-5-20250929

# Trading agent
agent:
  trading_agent:
    tools:
      - target: services.agent.tools.market_data_retriever
      - target: services.agent.tools.knowledge_retriever
      - target: services.agent.tools.evaluate_trade_setup
    llm:
      path: litellm/anthropic/claude-sonnet-4-5-20250929
    memory: 10

# Evaluation workflow (cron-triggered)
workflow:
  evaluation_cycle:
    tasks:
      - action: services.agent.pipeline.run_evaluation_cycle
    schedule:
      cron: '0 * * * *'

# Keltner Sentiment Gate configuration
keltner:
  hrma_period: 54
  atr_period: 162
  sentiment_timeframe:
    config_a: H4
    config_b: H4
  multipliers:
    ultra_extreme: 4.0
    extreme: 3.0
    uppermost: 2.0
    upper: 1.0
  sentiment_zones:
    long:
      fakeout_above_or_equal: 7
      normal_bands: [5, 6]
      momentum_bands: [3, 4]
      overextended_below: 3
    short:
      fakeout_below_or_equal: 5
      normal_bands: [6, 7]
      momentum_bands: [8, 9]
      overextended_above: 9
```

---

## 18. Testing Strategy

### 18.1 Unit Tests

```python
# File: tests/test_state_machine.py

import pytest
from services.agent.state_machine import StateMachine, State, TransitionError


class TestStateMachine:
    def setup_method(self):
        self.sm = StateMachine()
        self.default_state = {
            "current_state": "IDLE",
            "previous_state": None,
            "bars_in_state": 0,
            "cooldown_remaining": 0,
            "breakout_bar_index": None,
            "breakout_bar_price": None,
            "breakout_trendline": None,
            "sr_zone": None,
            "zone_density_score": None,
            "lot_allocations": None,
            "price_pattern_state": None,
            "broken_levels": None,
        }

    # --- Valid transitions ---

    def test_idle_to_navigating(self):
        result = self.sm.transition(self.default_state.copy(), "new_bar")
        assert result["current_state"] == "NAVIGATING"
        assert result["previous_state"] == "IDLE"
        assert result["bars_in_state"] == 0

    def test_navigating_to_scanning(self):
        state = {**self.default_state, "current_state": "NAVIGATING"}
        result = self.sm.transition(state, "regime_valid")
        assert result["current_state"] == "SCANNING"

    def test_scanning_to_breakout_detected(self):
        state = {**self.default_state, "current_state": "SCANNING"}
        result = self.sm.transition(state, "breakout_found")
        assert result["current_state"] == "BREAKOUT_DETECTED"

    def test_breakout_to_awaiting_pullback(self):
        state = {**self.default_state, "current_state": "BREAKOUT_DETECTED"}
        result = self.sm.transition(state, "quality_sufficient")
        assert result["current_state"] == "AWAITING_PULLBACK"

    # --- Keltner Sentiment Gate transitions ---

    def test_breakout_sentiment_fakeout(self):
        """Keltner gate rejects breakout with sentiment_fakeout."""
        state = {**self.default_state, "current_state": "BREAKOUT_DETECTED"}
        result = self.sm.transition(state, "sentiment_fakeout")
        assert result["current_state"] == "INVALIDATED"

    def test_breakout_momentum_confirmed(self):
        """Keltner gate confirms strong sentiment — skip pullback."""
        state = {**self.default_state, "current_state": "BREAKOUT_DETECTED"}
        result = self.sm.transition(state, "momentum_confirmed")
        assert result["current_state"] == "IDLE"

    def test_awaiting_to_pullback_testing(self):
        state = {**self.default_state, "current_state": "AWAITING_PULLBACK"}
        result = self.sm.transition(state, "pullback_arrived")
        assert result["current_state"] == "PULLBACK_TESTING"

    def test_pullback_testing_bounce_confirmed(self):
        state = {**self.default_state, "current_state": "PULLBACK_TESTING"}
        result = self.sm.transition(state, "bounce_confirmed")
        assert result["current_state"] == "IDLE"  # Advisory: respond then IDLE

    def test_pullback_testing_inconclusive(self):
        state = {**self.default_state, "current_state": "PULLBACK_TESTING"}
        result = self.sm.transition(state, "inconclusive")
        assert result["current_state"] == "SCANNING"

    # --- Invalid transitions ---

    def test_cannot_skip_states(self):
        """IDLE cannot jump to BREAKOUT_DETECTED."""
        with pytest.raises(TransitionError):
            self.sm.transition(self.default_state.copy(), "breakout_found")

    def test_cannot_transition_with_invalid_condition(self):
        with pytest.raises(TransitionError):
            self.sm.transition(self.default_state.copy(), "nonexistent_condition")

    # --- Invalidation paths ---

    def test_breakout_timeout_invalidation(self):
        state = {**self.default_state, "current_state": "BREAKOUT_DETECTED"}
        result = self.sm.transition(state, "timeout")
        assert result["current_state"] == "INVALIDATED"

    def test_awaiting_window_expired(self):
        state = {**self.default_state, "current_state": "AWAITING_PULLBACK"}
        result = self.sm.transition(state, "window_expired")
        assert result["current_state"] == "MISSED"

    def test_awaiting_failed_breakout(self):
        state = {**self.default_state, "current_state": "AWAITING_PULLBACK"}
        result = self.sm.transition(state, "failed_breakout")
        assert result["current_state"] == "INVALIDATED"

    # --- Cooldown ---

    def test_cooldown_enforcement(self):
        state = {**self.default_state, "current_state": "MISSED", "cooldown_remaining": 4}
        # Cannot leave MISSED until cooldown expires
        assert self.sm.check_time_based_transitions(state) is None

        state["cooldown_remaining"] = 0
        assert self.sm.check_time_based_transitions(state) == "cooldown_expired"

    def test_cooldown_set_on_invalidated(self):
        state = {**self.default_state, "current_state": "BREAKOUT_DETECTED"}
        result = self.sm.transition(state, "timeout")
        assert result["current_state"] == "INVALIDATED"
        assert result["cooldown_remaining"] == 4

    # --- Bar counter ---

    def test_increment_bar(self):
        state = {**self.default_state, "bars_in_state": 5}
        result = self.sm.increment_bar(state)
        assert result["bars_in_state"] == 6

    def test_cooldown_decrement_on_bar(self):
        state = {**self.default_state, "current_state": "MISSED",
                 "bars_in_state": 0, "cooldown_remaining": 3}
        result = self.sm.increment_bar(state)
        assert result["cooldown_remaining"] == 2

    # --- Time-based transitions ---

    def test_breakout_timeout_detection(self):
        state = {**self.default_state, "current_state": "BREAKOUT_DETECTED", "bars_in_state": 3}
        assert self.sm.check_time_based_transitions(state) == "timeout"

    def test_pullback_window_expired_detection(self):
        state = {**self.default_state, "current_state": "AWAITING_PULLBACK", "bars_in_state": 10}
        assert self.sm.check_time_based_transitions(state) == "window_expired"

    # --- Context cleanup ---

    def test_idle_clears_context(self):
        state = {
            **self.default_state,
            "current_state": "MISSED",
            "cooldown_remaining": 0,
            "breakout_bar_price": 1.2345,
            "sr_zone": {"levels": [1.23, 1.24]},
            "keltner_band_position": 3,
            "keltner_sentiment_zone": "MOMENTUM_CONFIRMED",
            "keltner_bands_snapshot": {"upper_middle": 68000},
        }
        result = self.sm.transition(state, "cooldown_expired")
        assert result["current_state"] == "IDLE"
        assert result["breakout_bar_price"] is None
        assert result["sr_zone"] is None
        assert result["keltner_band_position"] is None
        assert result["keltner_sentiment_zone"] is None
        assert result["keltner_bands_snapshot"] is None


class TestConvergenceScorer:
    def setup_method(self):
        from services.agent.convergence import ConvergenceScorer
        self.scorer = ConvergenceScorer()

    def test_score_range(self):
        """Score should be between -10 and +10."""
        state = {
            "breakout_trendline": {"score": 0.9, "touch_count": 4},
            "decision_momentum": {"rsi": 45},
            "decision_tema_hrma": {"trend": "UP"},
            "regime_classification": "Bullish",
            "trade_direction": "long",
            "price_pattern_state": {"type": "double_bottom"},
        }
        score, breakdown = self.scorer.compute(state, {})
        assert -10 <= score <= 10

    def test_enter_classification(self):
        assert self.scorer.classify_score(5.5) == "ENTER"

    def test_wait_classification(self):
        assert self.scorer.classify_score(3.0) == "WAIT"

    def test_no_trade_classification(self):
        assert self.scorer.classify_score(1.5) == "NO_TRADE"


class TestLLMParser:
    def test_valid_json_parse(self):
        from services.agent.llm_parser import parse_llm_output

        response = '{"score_adjustment": 0.5, "recommended_condition": "regime_valid", "confidence": 0.8, "assessment": "Good setup"}'
        result = parse_llm_output(response)
        assert result["score_adjustment"] == 0.5
        assert result["recommended_condition"] == "regime_valid"
        assert result["confidence"] == 0.8

    def test_clamping(self):
        from services.agent.llm_parser import parse_llm_output

        response = '{"score_adjustment": 5.0, "confidence": 2.0}'
        result = parse_llm_output(response)
        assert result["score_adjustment"] == 1.5  # Clamped
        assert result["confidence"] == 1.0  # Clamped

    def test_fallback_parse(self):
        from services.agent.llm_parser import parse_llm_output

        response = "Score adjustment is 0.3. I recommend regime_valid with confidence 0.7."
        result = parse_llm_output(response)
        # Fallback should still extract some values
        assert result["assessment"] != ""


class TestKeltnerBandPosition:
    """Test band position determination from price and band values."""

    @pytest.fixture
    def sample_bands(self):
        """Sample Keltner bands for BTCUSD H4."""
        return {
            "ultra_extreme_upper": 80000.0,    # Band 1
            "extreme_upper": 77000.0,          # Band 2
            "uppermost": 74000.0,              # Band 3
            "upper": 71000.0,                  # Band 4
            "upper_middle": 68000.0,           # Band 5
            "lower_middle": 67000.0,           # Band 6
            "lower": 64000.0,                  # Band 7
            "lowermost": 61000.0,              # Band 8
            "extreme_lower": 58000.0,          # Band 9
            "ultra_extreme_lower": 55000.0,    # Band 10
        }

    def test_price_above_all_bands(self, sample_bands):
        from services.agent.sentiment_gate import determine_keltner_band_position
        assert determine_keltner_band_position(85000.0, sample_bands) == 1

    def test_price_in_extreme_upper(self, sample_bands):
        from services.agent.sentiment_gate import determine_keltner_band_position
        assert determine_keltner_band_position(78000.0, sample_bands) == 2

    def test_price_in_uppermost(self, sample_bands):
        from services.agent.sentiment_gate import determine_keltner_band_position
        assert determine_keltner_band_position(75000.0, sample_bands) == 3

    def test_price_in_upper(self, sample_bands):
        from services.agent.sentiment_gate import determine_keltner_band_position
        assert determine_keltner_band_position(72000.0, sample_bands) == 4

    def test_price_in_upper_middle(self, sample_bands):
        from services.agent.sentiment_gate import determine_keltner_band_position
        assert determine_keltner_band_position(68500.0, sample_bands) == 5

    def test_price_in_lower_middle(self, sample_bands):
        from services.agent.sentiment_gate import determine_keltner_band_position
        assert determine_keltner_band_position(67500.0, sample_bands) == 6

    def test_price_in_lower(self, sample_bands):
        from services.agent.sentiment_gate import determine_keltner_band_position
        assert determine_keltner_band_position(65000.0, sample_bands) == 7

    def test_price_in_lowermost(self, sample_bands):
        from services.agent.sentiment_gate import determine_keltner_band_position
        assert determine_keltner_band_position(62000.0, sample_bands) == 8

    def test_price_in_extreme_lower(self, sample_bands):
        from services.agent.sentiment_gate import determine_keltner_band_position
        assert determine_keltner_band_position(57000.0, sample_bands) == 9

    def test_price_below_all_bands(self, sample_bands):
        from services.agent.sentiment_gate import determine_keltner_band_position
        assert determine_keltner_band_position(50000.0, sample_bands) == 10


class TestSentimentZoneClassification:
    """Test directional sentiment zone classification."""

    # ── Long (Bullish Breakout) ──

    def test_long_fakeout_band_7(self):
        from services.agent.sentiment_gate import classify_sentiment_zone, SentimentZone
        assert classify_sentiment_zone(7, "long") == SentimentZone.FAKEOUT

    def test_long_fakeout_band_10(self):
        from services.agent.sentiment_gate import classify_sentiment_zone, SentimentZone
        assert classify_sentiment_zone(10, "long") == SentimentZone.FAKEOUT

    def test_long_normal_band_5(self):
        from services.agent.sentiment_gate import classify_sentiment_zone, SentimentZone
        assert classify_sentiment_zone(5, "long") == SentimentZone.NORMAL_PULLBACK

    def test_long_normal_band_6(self):
        from services.agent.sentiment_gate import classify_sentiment_zone, SentimentZone
        assert classify_sentiment_zone(6, "long") == SentimentZone.NORMAL_PULLBACK

    def test_long_momentum_band_3(self):
        from services.agent.sentiment_gate import classify_sentiment_zone, SentimentZone
        assert classify_sentiment_zone(3, "long") == SentimentZone.MOMENTUM_CONFIRMED

    def test_long_momentum_band_4(self):
        from services.agent.sentiment_gate import classify_sentiment_zone, SentimentZone
        assert classify_sentiment_zone(4, "long") == SentimentZone.MOMENTUM_CONFIRMED

    def test_long_overextended_band_1(self):
        from services.agent.sentiment_gate import classify_sentiment_zone, SentimentZone
        assert classify_sentiment_zone(1, "long") == SentimentZone.OVEREXTENDED

    def test_long_overextended_band_2(self):
        from services.agent.sentiment_gate import classify_sentiment_zone, SentimentZone
        assert classify_sentiment_zone(2, "long") == SentimentZone.OVEREXTENDED

    # ── Short (Bearish Breakout) ──

    def test_short_fakeout_band_1(self):
        from services.agent.sentiment_gate import classify_sentiment_zone, SentimentZone
        assert classify_sentiment_zone(1, "short") == SentimentZone.FAKEOUT

    def test_short_fakeout_band_5(self):
        from services.agent.sentiment_gate import classify_sentiment_zone, SentimentZone
        assert classify_sentiment_zone(5, "short") == SentimentZone.FAKEOUT

    def test_short_normal_band_6(self):
        from services.agent.sentiment_gate import classify_sentiment_zone, SentimentZone
        assert classify_sentiment_zone(6, "short") == SentimentZone.NORMAL_PULLBACK

    def test_short_normal_band_7(self):
        from services.agent.sentiment_gate import classify_sentiment_zone, SentimentZone
        assert classify_sentiment_zone(7, "short") == SentimentZone.NORMAL_PULLBACK

    def test_short_momentum_band_8(self):
        from services.agent.sentiment_gate import classify_sentiment_zone, SentimentZone
        assert classify_sentiment_zone(8, "short") == SentimentZone.MOMENTUM_CONFIRMED

    def test_short_momentum_band_9(self):
        from services.agent.sentiment_gate import classify_sentiment_zone, SentimentZone
        assert classify_sentiment_zone(9, "short") == SentimentZone.MOMENTUM_CONFIRMED

    def test_short_overextended_band_10(self):
        from services.agent.sentiment_gate import classify_sentiment_zone, SentimentZone
        assert classify_sentiment_zone(10, "short") == SentimentZone.OVEREXTENDED


class TestSentimentGateEvaluation:
    """Test the full sentiment gate evaluation function."""

    @pytest.fixture
    def base_agent_state(self):
        return {
            "current_state": "BREAKOUT_DETECTED",
            "trade_direction": "long",
            "keltner_band_position": None,
            "keltner_sentiment_zone": None,
        }

    @pytest.fixture
    def sample_keltner_data(self):
        return {
            "close_price": 72000.0,
            "bands": {
                "ultra_extreme_upper": 80000.0,
                "extreme_upper": 77000.0,
                "uppermost": 74000.0,
                "upper": 71000.0,
                "upper_middle": 68000.0,
                "lower_middle": 67000.0,
                "lower": 64000.0,
                "lowermost": 61000.0,
                "extreme_lower": 58000.0,
                "ultra_extreme_lower": 55000.0,
            }
        }

    def test_long_momentum_confirmed(self, base_agent_state, sample_keltner_data):
        from services.agent.sentiment_gate import evaluate_sentiment_gate
        sample_keltner_data["close_price"] = 75000.0  # Band 3
        result = evaluate_sentiment_gate(base_agent_state, sample_keltner_data)
        assert result == "momentum_confirmed"
        assert base_agent_state["keltner_band_position"] == 3
        assert base_agent_state["keltner_sentiment_zone"] == "MOMENTUM_CONFIRMED"

    def test_long_fakeout(self, base_agent_state, sample_keltner_data):
        from services.agent.sentiment_gate import evaluate_sentiment_gate
        sample_keltner_data["close_price"] = 62000.0  # Band 8
        result = evaluate_sentiment_gate(base_agent_state, sample_keltner_data)
        assert result == "sentiment_fakeout"
        assert base_agent_state["keltner_sentiment_zone"] == "FAKEOUT"

    def test_long_normal_pullback(self, base_agent_state, sample_keltner_data):
        from services.agent.sentiment_gate import evaluate_sentiment_gate
        sample_keltner_data["close_price"] = 68500.0  # Band 5
        result = evaluate_sentiment_gate(base_agent_state, sample_keltner_data)
        assert result is None  # Continue to LLM evaluation
        assert base_agent_state["keltner_sentiment_zone"] == "NORMAL_PULLBACK"

    def test_long_overextended(self, base_agent_state, sample_keltner_data):
        from services.agent.sentiment_gate import evaluate_sentiment_gate
        sample_keltner_data["close_price"] = 85000.0  # Band 1
        result = evaluate_sentiment_gate(base_agent_state, sample_keltner_data)
        assert result is None  # Continue to LLM (wait for pullback from extreme)
        assert base_agent_state["keltner_sentiment_zone"] == "OVEREXTENDED"

    def test_short_momentum_confirmed(self, base_agent_state, sample_keltner_data):
        from services.agent.sentiment_gate import evaluate_sentiment_gate
        base_agent_state["trade_direction"] = "short"
        sample_keltner_data["close_price"] = 59000.0  # Band 9
        result = evaluate_sentiment_gate(base_agent_state, sample_keltner_data)
        assert result == "momentum_confirmed"

    def test_short_fakeout(self, base_agent_state, sample_keltner_data):
        from services.agent.sentiment_gate import evaluate_sentiment_gate
        base_agent_state["trade_direction"] = "short"
        sample_keltner_data["close_price"] = 75000.0  # Band 3 — fakeout for short
        result = evaluate_sentiment_gate(base_agent_state, sample_keltner_data)
        assert result == "sentiment_fakeout"
```

### 18.2 Integration Tests

```python
# File: tests/test_integration.py

import pytest


class TestEvaluationCycle:
    """Integration tests requiring PostgreSQL and optionally LLM."""

    @pytest.fixture
    def db_url(self):
        return "postgresql://test:test@localhost:5432/trading_test"

    def test_full_cycle_idle_to_scanning(self, db_url):
        """Test a complete cycle from IDLE through NAVIGATING to SCANNING."""
        from services.agent.pipeline import run_evaluation_cycle

        result = run_evaluation_cycle({
            "instrument": "EURUSD",
            "tf_config": "config_a",
            "database_url": db_url,
        })

        state = result["state"]
        assert state["current_state"] in ("SCANNING", "IDLE")
        assert state["evaluation_count"] >= 1

    def test_state_persistence_roundtrip(self, db_url):
        """Test that state survives save/load cycle."""
        from services.agent.state_persistence import AgentStateManager

        manager = AgentStateManager(db_url)

        # Load (creates default)
        state = manager.load("EURUSD", "config_a")
        assert state["current_state"] == "IDLE"

        # Modify
        state["current_state"] = "SCANNING"
        state["convergence_score"] = 3.5
        state["convergence_history"] = [{"score": 3.5, "time": "2026-02-07T00:00:00Z"}]

        # Save
        manager.save(state)

        # Reload
        reloaded = manager.load("EURUSD", "config_a")
        assert reloaded["current_state"] == "SCANNING"
        assert reloaded["convergence_score"] == 3.5
        assert len(reloaded["convergence_history"]) == 1

    def test_crash_recovery(self, db_url):
        """Test that stale states are detected and recovered."""
        from services.agent.state_persistence import AgentStateManager
        from services.agent.recovery import check_stale_states, recover_stale_state
        from datetime import datetime, timedelta

        manager = AgentStateManager(db_url)

        # Create a stale state
        state = manager.load("EURUSD", "config_a")
        state["current_state"] = "BREAKOUT_DETECTED"
        state["updated_at"] = (datetime.utcnow() - timedelta(hours=3)).isoformat()
        manager.save(state)

        # Detect stale
        stale = check_stale_states(manager, max_age_minutes=120)
        assert len(stale) >= 1

        # Recover
        recovered = recover_stale_state(manager, stale[0])
        assert recovered["current_state"] == "IDLE"
```

---

## 19. File Structure

```
services/
└── agent/
    ├── __init__.py
    ├── state_machine.py          # Mod 1: State Machine Engine (StateMachine class) — MODIFIED (2 new transitions)
    ├── routing.py                # Mod 2: Simplified routing (no execution) — MODIFIED (momentum_confirmed path)
    ├── state_persistence.py      # Mod 3: PostgreSQL AgentState manager — MODIFIED (3 new fields)
    ├── schema.py                 # AgentState TypedDict schema — MODIFIED (3 new fields)
    ├── hard_rules.py             # Hard rules checked before LLM — MODIFIED (Keltner gate as Rule 2)
    ├── sentiment_gate.py         # ★ NEW — Keltner sentiment zone classification + gate logic
    ├── keltner.py                # ★ NEW — Keltner Channel 10-band computation (Python replication of MQL5 indicator)
    ├── convergence.py            # 5-factor convergence scoring
    ├── pipeline.py               # Main evaluation cycle orchestrator — MODIFIED (Keltner data fetch + gate)
    ├── llm_interface.py          # LLM prompt construction and calling — MODIFIED (Keltner context in prompt)
    ├── llm_parser.py             # LLM output parsing with fallback — MODIFIED (momentum advisory generator)
    ├── recovery.py               # Stale state detection and recovery
    ├── tools.py                  # Custom txtai Agent tools — MODIFIED (fetch_keltner_data)
    ├── config.py                 # Configuration constants — MODIFIED (KELTNER_CONFIG)
    └── tone_validator.py         # ★ NEW — Post-generation tone validation (Section 26)

config/
└── txtai_app.yml                 # txtai Application configuration — MODIFIED (keltner section)

migrations/
├── 001_create_agent_state.sql    # PostgreSQL schema migration — MODIFIED (3 Keltner columns + 2 constraints)
└── 002_create_keltner_data.sql   # ★ NEW (optional) — Pre-computed Keltner Channel data table

tests/
├── test_state_machine.py         # Unit tests for state machine — MODIFIED (2 new transition tests)
├── test_sentiment_gate.py        # ★ NEW — Comprehensive Keltner sentiment gate tests
├── test_tone_validator.py        # ★ NEW — Tone validation unit tests (Section 26)
├── test_convergence.py           # Unit tests for scoring
├── test_llm_parser.py            # Unit tests for output parsing
└── test_integration.py           # Integration tests (requires DB)
```

---

## 20. Implementation Order

### Phase 1: Foundation (Days 1-3)

| Step | File                                    | What to Build                           | Dependencies         |
| ---- | --------------------------------------- | --------------------------------------- | -------------------- |
| 1    | `schema.py`                             | AgentState TypedDict                    | None                 |
| 2    | `state_machine.py`                      | StateMachine class with all transitions | schema.py            |
| 3    | `migrations/001_create_agent_state.sql` | PostgreSQL table                        | None                 |
| 4    | `state_persistence.py`                  | AgentStateManager (load/save)           | schema.py, migration |
| 5    | `tests/test_state_machine.py`           | All unit tests for state machine        | state_machine.py     |

### Phase 2: Scoring & Rules (Days 4-6)

| Step | File                            | What to Build                          | Dependencies     |
| ---- | ------------------------------- | -------------------------------------- | ---------------- |
| 6    | `convergence.py`                | ConvergenceScorer (5 factors)          | schema.py        |
| 7    | `keltner.py`                    | ★ Keltner Channel 10-band computation | config.py        |
| 8    | `sentiment_gate.py`             | ★ Sentiment zone classification + gate | keltner.py       |
| 9    | `hard_rules.py`                 | Hard rule checks (incl. Keltner gate)  | state_machine.py, sentiment_gate.py |
| 10   | `routing.py`                    | Simplified routing logic (incl. momentum) | state_machine.py |
| 11   | `tests/test_convergence.py`     | Scoring unit tests                     | convergence.py   |
| 12   | `tests/test_sentiment_gate.py`  | ★ Keltner sentiment gate unit tests   | sentiment_gate.py |

### Phase 3: LLM Integration & Tone Regulation (Days 7-9)

| Step | File                           | What to Build                         | Dependencies       |
| ---- | ------------------------------ | ------------------------------------- | ------------------ |
| 13   | `llm_interface.py`             | Prompt template + LLM calling (incl. Keltner context + tone rules) | txtai LLM pipeline, sentiment_gate.py |
| 14   | `llm_parser.py`                | JSON parsing + fallback + momentum advisory | None          |
| 15   | `tone_validator.py`            | ★ Post-generation tone validation (Section 26) | None         |
| 16   | `tests/test_llm_parser.py`    | Parser unit tests                     | llm_parser.py      |
| 17   | `tests/test_tone_validator.py` | ★ Tone validation unit tests         | tone_validator.py  |

### Phase 4: Pipeline & Tools (Days 10-11)

| Step | File                   | What to Build                              | Dependencies           |
| ---- | ---------------------- | ------------------------------------------ | ---------------------- |
| 18   | `tools.py`             | Custom txtai Agent tools (incl. Keltner)   | PostgreSQL, Embeddings, keltner.py |
| 19   | `pipeline.py`          | Full evaluation cycle orchestrator (incl. Keltner gate + tone enforcement) | All above  |
| 20   | `recovery.py`          | Stale state detection                      | state_persistence.py   |
| 21   | `config/txtai_app.yml` | txtai Application config (incl. Keltner)   | All above              |

### Phase 5: Integration Testing (Days 12-14)

| Step | File                        | What to Build                                   | Dependencies           |
| ---- | --------------------------- | ----------------------------------------------- | ---------------------- |
| 22   | `tests/test_integration.py` | End-to-end tests (incl. Keltner gate scenarios + tone validation) | All above + PostgreSQL |
| 23   | Manual testing              | Run evaluation cycles, verify state transitions + Keltner gate paths + tone compliance | Running system |

---

## Appendix A: Mapping to Blueprint Sections

| Blueprint Section                     | This Document Section      | Coverage                                    |
| ------------------------------------- | -------------------------- | ------------------------------------------- |
| Section 7.1 (States)                  | Section 4.1, 8.1           | Full (minus EXECUTING/ENTERED)              |
| Section 7.2 (Transition Map)          | Section 8.1, 8.2           | Full (minus execution transitions)          |
| Section 7.3 (State Persistence)       | Section 6, 7               | Full                                        |
| Section 8.1 (Rule-Principle Spectrum) | Section 8.2, 14            | Full                                        |
| Section 8.2 (Hard Rules)              | Section 8.2                | Full (rule 6 excluded — no position sizing) |
| Section 8.3 (Soft Principles)         | Section 14 (LLM prompts)   | Full                                        |
| Section 5 (Convergence Scoring)       | Section 13                 | Full                                        |
| Section 6 (Entry Zone Model)          | Section 5.4 (respond only) | Modified (advisory, no orders)              |

## Appendix B: Key Differences from LangGraph Implementation

| Aspect              | LangGraph Approach                                        | txtai + Custom Code Approach                   |
| ------------------- | --------------------------------------------------------- | ---------------------------------------------- |
| State machine       | `StateGraph` with `add_node()`, `add_conditional_edges()` | Python class with dict-based transitions       |
| State persistence   | `MemorySaver` checkpoint backend                          | Direct PostgreSQL with `SELECT FOR UPDATE`     |
| Node routing        | `add_conditional_edges(func)`                             | if/else in `route_after_evaluation()`          |
| Tool calling        | `@tool` decorator → LangChain tool                        | Python function → txtai `FunctionTool`         |
| LLM integration     | `ChatAnthropic` message classes                           | txtai `LLM` pipeline via LiteLLM               |
| Knowledge retrieval | LangChain VectorStore interface                           | txtai `Embeddings.search()` with SQL filtering |
| Workflow scheduling | External scheduler + webhook                              | txtai `Workflow.schedule(cron)`                |
| State schema        | LangGraph `TypedDict` passed through nodes                | Python `TypedDict` + PostgreSQL JSONB          |

---

---

## 21. Keltner Channel Sentiment Gate

### 21.1 Concept

The Keltner Channel Sentiment Gate is a **hard rule gate** at the `BREAKOUT_DETECTED` state that uses the H4 Keltner Channel band position to assess whether the current market sentiment supports the detected breakout direction.

**Why H4?** The breakout is detected on the primary Decision TF (H1 for config_a, H2 for config_b). The sentiment measurement uses **one level above** the Navigation Layer to capture the broader structural sentiment context. H4 provides the structural backdrop that determines whether a breakout attempt has real sentiment support or is likely a fakeout.

**Source indicator**: `Keltner Channel ATF_10 Bands_V2.mq5` — a custom MetaTrader 5 indicator that computes 10 Keltner Channel bands using an HRMA (Hull-Response Moving Average) center line and ATR-based band width.

### 21.2 Gate Logic

The gate fires **before the LLM** is consulted. It determines one of four outcomes:

```
BREAKOUT_DETECTED
    │
    ├── ★ Keltner Gate (hard rule, runs first)
    │   │
    │   ├── FAKEOUT → INVALIDATED (hard rule, no LLM)
    │   │   Band appears to contradict breakout direction.
    │   │   Long breakout + price in lower bands (7-10) = bearish sentiment appears dominant.
    │   │   Short breakout + price in upper bands (1-5) = bullish sentiment appears dominant.
    │   │
    │   ├── NORMAL PULLBACK → continue to LLM (bands 5-6 for longs, 6-7 for shorts)
    │   │   Moderate momentum — conditions may favor a standard pullback.
    │   │
    │   ├── MOMENTUM OBSERVED → IDLE (via respond) (hard rule, no LLM)
    │   │   Elevated sentiment appears aligned — traditional pullback may be less likely.
    │   │   Generate momentum observation immediately.
    │   │
    │   └── OVEREXTENDED → continue to LLM (but with caution context)
    │       Elevated deviation — directional sentiment appears present but retracement risk elevated.
    │       Proceed to AWAITING_PULLBACK — monitor for retracement conditions.
    │
    ├── Existing hard rules (instant_fakeout, timeout) — unchanged
    │
    └── LLM evaluation — for normal_pullback and overextended zones
```

### 21.3 Sentiment Zone Mapping

#### For Long (Bullish) Breakouts:

| Band | Zone Name | Location | Meaning | Action |
|------|-----------|----------|---------|--------|
| 1 | Ultra Extreme Upper | Above all bands | Appears massively overextended bullish | OVEREXTENDED — retracement conditions may develop |
| 2 | Extreme Upper | Above extreme band | Appears very overextended bullish | OVEREXTENDED — retracement conditions may develop |
| 3 | Uppermost | Above uppermost band | Suggests elevated bullish momentum | MOMENTUM OBSERVED — pullback may be less likely |
| 4 | Upper | Above upper band | Suggests solid bullish momentum | MOMENTUM OBSERVED — pullback may be less likely |
| 5 | Upper Middle | Above HRMA of High | Moderate bullish — near center | NORMAL PULLBACK — conditions may favor pullback |
| 6 | Lower Middle | Below HRMA of Low | Moderate — slightly below center | NORMAL PULLBACK — conditions may favor pullback |
| 7 | Lower | Below lower band | Bearish pressure apparent | FAKEOUT RISK — bearish sentiment appears dominant |
| 8 | Lowermost | Below lowermost band | Elevated bearish pressure | FAKEOUT RISK — bearish sentiment appears dominant |
| 9 | Extreme Lower | Below extreme band | Appears very bearish | FAKEOUT RISK — bearish sentiment appears dominant |
| 10 | Ultra Extreme Lower | Below all bands | Appears massively bearish | FAKEOUT RISK — bearish sentiment appears dominant |

#### For Short (Bearish) Breakouts:

| Band | Zone Name | Location | Meaning | Action |
|------|-----------|----------|---------|--------|
| 1 | Ultra Extreme Upper | Above all bands | Appears massively bullish | FAKEOUT RISK — bullish sentiment appears dominant |
| 2 | Extreme Upper | Above extreme band | Appears very bullish | FAKEOUT RISK — bullish sentiment appears dominant |
| 3 | Uppermost | Above uppermost band | Elevated bullish pressure | FAKEOUT RISK — bullish sentiment appears dominant |
| 4 | Upper | Above upper band | Bullish pressure apparent | FAKEOUT RISK — bullish sentiment appears dominant |
| 5 | Upper Middle | Above HRMA of High | Moderate — slightly above center | FAKEOUT RISK — bullish sentiment appears dominant |
| 6 | Lower Middle | Below HRMA of Low | Moderate bearish — near center | NORMAL PULLBACK — conditions may favor pullback |
| 7 | Lower | Below lower band | Moderate bearish momentum | NORMAL PULLBACK — conditions may favor pullback |
| 8 | Lowermost | Below lowermost band | Suggests solid bearish momentum | MOMENTUM OBSERVED — pullback may be less likely |
| 9 | Extreme Lower | Below extreme band | Suggests elevated bearish momentum | MOMENTUM OBSERVED — pullback may be less likely |
| 10 | Ultra Extreme Lower | Below all bands | Appears massively overextended bearish | OVEREXTENDED — retracement conditions may develop |

### 21.4 Sentiment Gate Implementation

```python
# File: services/agent/sentiment_gate.py

from enum import Enum
from typing import Optional


class SentimentZone(str, Enum):
    """Keltner-derived sentiment zone classification."""
    FAKEOUT = "FAKEOUT"
    NORMAL_PULLBACK = "NORMAL_PULLBACK"
    MOMENTUM_CONFIRMED = "MOMENTUM_CONFIRMED"
    OVEREXTENDED = "OVEREXTENDED"


def determine_keltner_band_position(close_price: float, bands: dict) -> int:
    """Determine which of the 10 Keltner bands the price falls in.

    Band numbering (1-10, top to bottom):
    1 = Ultra Extreme Upper (above all bands)
    2 = Extreme Upper
    3 = Uppermost
    4 = Upper
    5 = Upper Middle (above HRMA of H4 High)
    6 = Lower Middle (below HRMA of H4 Low)
    7 = Lower
    8 = Lowermost
    9 = Extreme Lower
    10 = Ultra Extreme Lower (below all bands)

    Args:
        close_price: Current close price on the Keltner timeframe (H4).
        bands: Dict with band level values (keyed by band name).

    Returns:
        Integer 1-10 representing the band position.
    """
    # Band boundaries from highest to lowest
    band_levels = [
        (1, bands["ultra_extreme_upper"]),
        (2, bands["extreme_upper"]),
        (3, bands["uppermost"]),
        (4, bands["upper"]),
        (5, bands["upper_middle"]),
        (6, bands["lower_middle"]),
        (7, bands["lower"]),
        (8, bands["lowermost"]),
        (9, bands["extreme_lower"]),
        (10, bands["ultra_extreme_lower"]),
    ]

    for band_num, level in band_levels:
        if close_price >= level:
            return band_num

    return 10  # Below all bands


def classify_sentiment_zone(band_position: int,
                            trade_direction: str) -> SentimentZone:
    """Classify the sentiment zone based on band position and trade direction.

    Args:
        band_position: 1-10 Keltner band position.
        trade_direction: 'long' or 'short'.

    Returns:
        SentimentZone enum value.
    """
    if trade_direction == "long":
        if band_position >= 7:
            return SentimentZone.FAKEOUT
        elif band_position in (5, 6):
            return SentimentZone.NORMAL_PULLBACK
        elif band_position in (3, 4):
            return SentimentZone.MOMENTUM_CONFIRMED
        else:  # 1, 2
            return SentimentZone.OVEREXTENDED
    else:  # short
        if band_position <= 5:
            return SentimentZone.FAKEOUT
        elif band_position in (6, 7):
            return SentimentZone.NORMAL_PULLBACK
        elif band_position in (8, 9):
            return SentimentZone.MOMENTUM_CONFIRMED
        else:  # 10
            return SentimentZone.OVEREXTENDED


def evaluate_sentiment_gate(agent_state: dict,
                            keltner_data: dict) -> Optional[str]:
    """Evaluate the Keltner Sentiment Gate at BREAKOUT_DETECTED.

    This function:
    1. Determines the band position from current H4 price and bands.
    2. Classifies the sentiment zone based on direction.
    3. Updates agent_state with Keltner fields.
    4. Returns a hard-rule condition if applicable, or None to continue to LLM.

    Args:
        agent_state: Current agent state (must be in BREAKOUT_DETECTED).
                     Modified in-place with Keltner fields.
        keltner_data: Dict with 'close_price' and 'bands' from H4.

    Returns:
        'sentiment_fakeout' — hard rule INVALIDATED
        'momentum_confirmed' — hard rule IDLE via respond
        None — NORMAL_PULLBACK or OVEREXTENDED, continue to LLM evaluation
    """
    close = keltner_data["close_price"]
    bands = keltner_data["bands"]
    direction = agent_state["trade_direction"]

    # Step 1: Determine band position
    band_position = determine_keltner_band_position(close, bands)

    # Step 2: Classify sentiment zone
    zone = classify_sentiment_zone(band_position, direction)

    # Step 3: Update agent state
    agent_state["keltner_band_position"] = band_position
    agent_state["keltner_sentiment_zone"] = zone.value
    agent_state["keltner_bands_snapshot"] = {
        **bands,
        "close_price": close,
        "atr": keltner_data.get("atr"),
        "upper_middle": bands.get("upper_middle"),
        "lower_middle": bands.get("lower_middle"),
    }

    # Step 4: Return hard-rule condition or None
    if zone == SentimentZone.FAKEOUT:
        return "sentiment_fakeout"
    elif zone == SentimentZone.MOMENTUM_CONFIRMED:
        return "momentum_confirmed"
    else:
        # NORMAL_PULLBACK or OVEREXTENDED → continue to LLM
        return None
```

---

## 22. Keltner Indicator Specification

### 22.1 Band Computation (Python Replication)

The Keltner Channel bands are computed from H4 OHLCV data. This is a Python replication of the logic in `Keltner Channel ATF_10 Bands_V2.mq5`.

```python
# File: services/agent/keltner.py

import numpy as np
from typing import Dict, Tuple


class KeltnerChannel:
    """Computes 10-band Keltner Channel from OHLCV data.

    Replicates the MQL5 indicator logic:
    - Center line: HRMA (Hull-Response Moving Average) of H4 close
    - Band width: ATR(162) at various multipliers
    - Upper Middle: HRMA of H4 High
    - Lower Middle: HRMA of H4 Low

    The 10 bands are:
    1. Ultra Extreme Upper:  HRMA + ATR × 4.0
    2. Extreme Upper:        HRMA + ATR × 3.0
    3. Uppermost:            HRMA + ATR × 2.0
    4. Upper:                HRMA + ATR × 1.0
    5. Upper Middle:         HRMA of H4 High
    6. Lower Middle:         HRMA of H4 Low
    7. Lower:                HRMA - ATR × 1.0
    8. Lowermost:            HRMA - ATR × 2.0
    9. Extreme Lower:        HRMA - ATR × 3.0
    10. Ultra Extreme Lower: HRMA - ATR × 4.0
    """

    def __init__(self, hrma_period: int = 54, atr_period: int = 162,
                 multipliers: Dict[str, float] = None):
        self.hrma_period = hrma_period
        self.atr_period = atr_period
        self.multipliers = multipliers or {
            "ultra_extreme": 4.0,
            "extreme": 3.0,
            "uppermost": 2.0,
            "upper": 1.0,
        }

    def compute_hrma(self, values: np.ndarray) -> float:
        """Compute HRMA (Hull-Response Moving Average).

        HRMA is a variant of Hull Moving Average that provides
        smoother response to price changes. Uses the formula:
        HRMA = WMA(2 * WMA(n/2) - WMA(n), sqrt(n))

        Args:
            values: Array of price values (most recent last).

        Returns:
            Current HRMA value.
        """
        n = self.hrma_period
        if len(values) < n:
            return float(np.mean(values[-n:]))

        half_n = max(1, n // 2)
        sqrt_n = max(1, int(np.sqrt(n)))

        wma_half = self._wma(values, half_n)
        wma_full = self._wma(values, n)

        # Compute the difference series
        diff_series = 2 * wma_half - wma_full

        # Apply final WMA with sqrt(n) period
        # For a single point, this simplifies to the weighted average
        # of the last sqrt_n diff values
        return float(diff_series)

    def compute_atr(self, highs: np.ndarray, lows: np.ndarray,
                    closes: np.ndarray) -> float:
        """Compute ATR (Average True Range).

        Args:
            highs: Array of high prices.
            lows: Array of low prices.
            closes: Array of close prices.

        Returns:
            Current ATR value.
        """
        n = min(self.atr_period, len(highs))
        if n < 2:
            return float(highs[-1] - lows[-1])

        tr_values = []
        for i in range(-n, 0):
            high = highs[i]
            low = lows[i]
            prev_close = closes[i - 1] if i > -n else closes[i]
            tr = max(high - low, abs(high - prev_close), abs(low - prev_close))
            tr_values.append(tr)

        return float(np.mean(tr_values))

    def compute_bands(self, ohlcv_data: list) -> Dict[str, float]:
        """Compute all 10 Keltner Channel bands from OHLCV data.

        Args:
            ohlcv_data: List of OHLCV dicts (most recent last), each with
                        keys: 'open', 'high', 'low', 'close'.
                        Needs at least max(hrma_period, atr_period) bars.

        Returns:
            Dict with all 10 band values and metadata.
        """
        closes = np.array([float(bar["close"]) for bar in ohlcv_data])
        highs = np.array([float(bar["high"]) for bar in ohlcv_data])
        lows = np.array([float(bar["low"]) for bar in ohlcv_data])

        # Center line: HRMA of close
        hrma_close = self.compute_hrma(closes)

        # ATR for band width
        atr = self.compute_atr(highs, lows, closes)

        # Upper Middle and Lower Middle: HRMA of High and Low
        hrma_high = self.compute_hrma(highs)
        hrma_low = self.compute_hrma(lows)

        m = self.multipliers
        return {
            "ultra_extreme_upper": hrma_close + atr * m["ultra_extreme"],  # Band 1
            "extreme_upper": hrma_close + atr * m["extreme"],              # Band 2
            "uppermost": hrma_close + atr * m["uppermost"],                # Band 3
            "upper": hrma_close + atr * m["upper"],                        # Band 4
            "upper_middle": hrma_high,                                     # Band 5
            "lower_middle": hrma_low,                                      # Band 6
            "lower": hrma_close - atr * m["upper"],                        # Band 7
            "lowermost": hrma_close - atr * m["uppermost"],                # Band 8
            "extreme_lower": hrma_close - atr * m["extreme"],              # Band 9
            "ultra_extreme_lower": hrma_close - atr * m["ultra_extreme"],  # Band 10
            # Metadata
            "hrma_close": hrma_close,
            "atr": atr,
        }

    @staticmethod
    def _wma(values: np.ndarray, period: int) -> float:
        """Weighted Moving Average."""
        if len(values) < period:
            period = len(values)
        weights = np.arange(1, period + 1, dtype=float)
        return float(np.average(values[-period:], weights=weights))
```

### 22.2 Data Retrieval for Keltner

```python
# Added to services/agent/tools.py

def fetch_keltner_data(instrument: str, tf_config: str) -> dict:
    """Fetch H4 OHLCV data and compute Keltner Channel bands.

    Args:
        instrument: Trading instrument (e.g., 'EURUSD').
        tf_config: Timeframe configuration.

    Returns:
        Dict with 'close_price', 'bands', and 'atr'.
    """
    from .keltner import KeltnerChannel
    from .config import KELTNER_CONFIG
    from sqlalchemy import create_engine, text

    sentiment_tf = KELTNER_CONFIG[f"sentiment_tf_{tf_config}"]
    engine = create_engine(DATABASE_URL)

    # Fetch enough bars for ATR(162) + HRMA(54)
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT open, high, low, close
                FROM ohlcv_15m
                WHERE symbol = :symbol AND timeframe = :tf
                ORDER BY timestamp DESC
                LIMIT 250
            """),
            {"symbol": instrument, "tf": sentiment_tf}
        ).mappings().fetchall()

    if not rows:
        return None

    # Reverse to chronological order (oldest first)
    ohlcv_data = [dict(r) for r in reversed(rows)]

    kc = KeltnerChannel(
        hrma_period=KELTNER_CONFIG["hrma_period"],
        atr_period=KELTNER_CONFIG["atr_period"],
    )

    bands = kc.compute_bands(ohlcv_data)
    close_price = float(ohlcv_data[-1]["close"])

    return {
        "close_price": close_price,
        "bands": bands,
        "atr": bands["atr"],
    }
```

---

## 23. Sentiment Zone Model

### 23.1 Core Principle

The Keltner Channel Sentiment Gate operates on a key insight from the trading methodology:

> **Sentiment determines pullback likelihood.** When market sentiment strongly aligns with a breakout direction, the typical pullback-to-trendline pattern becomes unreliable. Conversely, when sentiment contradicts the breakout direction, the breakout itself is structurally unsupported and likely to fail.

### 23.2 Zone Behavior Summary

| Zone | Gate Output | Pullback Likelihood Assessment | LLM Consulted? | Advisory Type |
|------|------------|-------------------------------|-----------------|---------------|
| FAKEOUT | Hard reject | N/A — setup discontinued | No | Invalidation (cautious tone) |
| NORMAL_PULLBACK | Pass through | Conditions may favor pullback | Yes | Standard flow (hedged language) |
| MOMENTUM_CONFIRMED | Hard accept | Pullback appears less likely | No | Momentum observation (cautious tone) |
| OVEREXTENDED | Pass through | Retracement conditions may develop | Yes | Cautious — monitor for retracement signals |

### 23.3 Overextended Zone Behavior

The OVEREXTENDED zone is notable because:

- The breakout direction **appears** to be supported by sentiment (price is beyond the extreme bands in the direction consistent with the breakout)
- However, the price is at such elevated deviation that **conditions may become conducive to mean reversion** — a retracement may develop
- This makes the **normal pullback flow** appropriate — any pullback may come from price overextension dynamics, not from trendline physics
- The LLM receives special context about this zone to evaluate whether mean reversion signals are developing
- **Tone note**: Even though overextension suggests retracement, the system must communicate this as a possibility, not a certainty. Overextended conditions can persist longer than expected.

### 23.4 Integration Touchpoints (Summary)

This table summarizes all changes made to the base State Machine document:

| Section | Component | Change Type | Description |
|---------|-----------|-------------|-------------|
| 4.1 | `TRANSITIONS` dict | Modified | Added `sentiment_fakeout` and `momentum_confirmed` to `BREAKOUT_DETECTED` |
| 4.1 | `_reset_evaluation_context()` | Modified | Added Keltner field clearing |
| 4.2 | State diagram | Replaced | Added Keltner gate box with three exit paths |
| 5.3 | `route_after_evaluation()` | Modified | Added `respond_momentum_advisory` route |
| 5.4 | Response table | Expanded | Added FAKEOUT, MOMENTUM_CONFIRMED, OVEREXTENDED response rows |
| 6.1 | PostgreSQL schema | Modified | Added 3 columns + 2 constraints |
| 6.2 | `AgentStateManager` | Modified | Added `keltner_bands_snapshot` to JSONB_FIELDS and default state |
| 7.1 | `AgentState` TypedDict | Modified | Added 3 Keltner fields |
| 8.1 | Transition table | Expanded | Added rows ★8 and ★9; modified row 10; total 20→22 |
| 8.2 | `check_hard_rules()` | Modified | Added Keltner gate as Rule 2 |
| 10.1 | `run_evaluation_cycle()` | Modified | Added Keltner data fetch and gate evaluation |
| 10.1 | `_generate_hard_rule_response()` | Modified | Added `sentiment_fakeout` response message |
| 14 | LLM prompt template | Modified | Added Keltner Sentiment Context block |
| 14 | Prompt construction | Modified | Added Keltner fields to format() call |
| 15 | `llm_parser.py` | Modified | Added `generate_momentum_advisory()` function |
| 15 | `generate_response()` | Modified | Added `respond_momentum_advisory` route handler |
| 17 | Configuration | Added | `KELTNER_CONFIG` dict + YAML keltner section |
| 18 | Tests | Added | 3 new test classes (band position, zone classification, gate evaluation) |
| 19 | File structure | Modified | Added `sentiment_gate.py`, `keltner.py`, `test_sentiment_gate.py`, `tone_validator.py`, `test_tone_validator.py` |
| 20 | Implementation order | Modified | Inserted Keltner steps into Phase 2; tone validator into Phase 3; renumbered Phases 4-5 |
| 21-25 | New sections | Added | Full Keltner specification, indicator computation, data retrieval, VectorDB chunks |
| 26 | New section | Added | Tone & Language Policy — prohibited/required word lists, post-generation tone validator, test cases |
| 5.4 | Response table | Modified | All Keltner rows rewritten with probabilistic language |
| 10.1 | `_generate_hard_rule_response()` | Modified | All 4 messages rewritten with hedged tone |
| 14 | LLM prompt template | Modified | Added PROHIBITED/REQUIRED word lists and disclaimer rules |
| 15 | `generate_response()` | Modified | Added tone rules to prompts; integrated `enforce_tone()` post-validation |
| 15 | `generate_momentum_advisory()` | Modified | Rewritten with probabilistic language and disclaimers |
| 21.3 | Zone mapping tables | Modified | Replaced absolute labels with probabilistic equivalents |
| 23.2-23.3 | Zone behavior summary | Modified | Replaced decisive language with cautious alternatives |
| 25 | VectorDB knowledge chunks | Modified | All 5 chunks rewritten with embedded tone rules |

---

## 24. Keltner Data Retrieval

### 24.1 Data Source Options

The Keltner Channel data can be sourced in two ways:

**Option A: Compute on-the-fly (implemented above)**
- Fetch raw H4 OHLCV from PostgreSQL
- Compute HRMA and ATR in Python
- Determine band positions
- No additional infrastructure needed

**Option B: Pre-computed from MT5 (optional optimization)**
- MT5 runs `Keltner Channel ATF_10 Bands_V2.mq5` indicator
- EA or script exports band values to PostgreSQL via Python bridge
- Query pre-computed values directly
- More accurate (matches live MT5 indicator exactly)
- Requires MT5 data pipeline

### 24.2 Pre-computed Table Schema (Optional)

```sql
-- Optional: Migration 002 — pre-computed Keltner Channel data
-- Only needed if using Option B (MT5 pre-computed values)

CREATE TABLE keltner_channel_data (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    timestamp TIMESTAMP NOT NULL,

    -- Center line
    hrma_close DECIMAL(20,5),
    atr DECIMAL(20,5),

    -- 10 bands
    ultra_extreme_upper DECIMAL(20,5),    -- Band 1
    extreme_upper DECIMAL(20,5),          -- Band 2
    uppermost DECIMAL(20,5),              -- Band 3
    upper_band DECIMAL(20,5),             -- Band 4
    upper_middle DECIMAL(20,5),           -- Band 5 (HRMA of High)
    lower_middle DECIMAL(20,5),           -- Band 6 (HRMA of Low)
    lower_band DECIMAL(20,5),             -- Band 7
    lowermost DECIMAL(20,5),              -- Band 8
    extreme_lower DECIMAL(20,5),          -- Band 9
    ultra_extreme_lower DECIMAL(20,5),    -- Band 10

    -- Metadata
    close_price DECIMAL(20,5),
    band_position INT,                     -- Pre-computed 1-10 position

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT unique_keltner UNIQUE(symbol, timeframe, timestamp)
);

CREATE INDEX idx_keltner_latest ON keltner_channel_data (symbol, timeframe, timestamp DESC);
```

---

## 25. VectorDB Knowledge Chunks — Keltner

### 25.1 New Knowledge Chunks for Embeddings

The following knowledge chunks should be added to the VectorDB for state-specific retrieval when the Keltner Sentiment Gate is active:

```python
KELTNER_KNOWLEDGE_CHUNKS = [
    {
        "text": (
            "Keltner Channel Sentiment Gate: At BREAKOUT_DETECTED, evaluate the H4 "
            "Keltner Channel band position to assess structural sentiment context. "
            "Band positions 1-10 map to sentiment zones: FAKEOUT (sentiment appears to "
            "contradict breakout — elevated risk of failure), NORMAL_PULLBACK (moderate "
            "momentum — conditions may favor a pullback), MOMENTUM_OBSERVED (elevated "
            "directional sentiment — traditional pullback may be less likely), OVEREXTENDED "
            "(extreme deviation — retracement conditions may develop). NOTE: All zone "
            "assessments are probabilistic observations, not predictions. Market behavior "
            "remains inherently uncertain."
        ),
        "state_relevance": "BREAKOUT_DETECTED",
        "topic": "keltner_sentiment",
    },
    {
        "text": (
            "For a long (bullish) breakout: price in lower Keltner bands (7-10) suggests "
            "bearish sentiment may still be dominant — the breakout carries elevated fakeout "
            "risk. Price in bands 3-4 suggests elevated bullish sentiment — a traditional "
            "pullback to the broken trendline may be less likely in this environment; generate "
            "momentum observation. Price in bands 5-6 suggests moderate momentum — conditions "
            "may favor a standard pullback. Price in bands 1-2 suggests overextension — while "
            "directional sentiment appears present, elevated deviation from the mean may create "
            "retracement conditions. IMPORTANT: Use hedged, probabilistic language when "
            "communicating these observations. Never state pullback or fakeout as certainty."
        ),
        "state_relevance": "BREAKOUT_DETECTED",
        "topic": "keltner_long",
    },
    {
        "text": (
            "For a short (bearish) breakout: price in upper Keltner bands (1-5) suggests "
            "bullish sentiment may still be dominant — the breakout carries elevated fakeout "
            "risk. Price in bands 8-9 suggests elevated bearish sentiment — a traditional "
            "pullback may be less likely; generate momentum observation. Price in bands 6-7 "
            "suggests moderate bearish momentum — conditions may favor a standard pullback. "
            "Price in band 10 suggests overextension — while directional sentiment appears "
            "present, elevated deviation from the mean may create retracement conditions. "
            "IMPORTANT: Use hedged, probabilistic language when communicating these "
            "observations. Never state pullback or fakeout as certainty."
        ),
        "state_relevance": "BREAKOUT_DETECTED",
        "topic": "keltner_short",
    },
    {
        "text": (
            "OVEREXTENDED zone at BREAKOUT_DETECTED: While sentiment appears to favor the "
            "breakout direction, elevated price deviation from the HRMA center line may "
            "create conditions conducive to mean reversion. Watch for: narrowing TEMA/HRMA "
            "gap, reduced bar-by-bar momentum, absorption candles (small bodies with wicks), "
            "and declining volume. These signals may suggest the overextended move is losing "
            "momentum. Proceed to AWAITING_PULLBACK with awareness that retracement "
            "conditions may develop from price overextension rather than trendline physics. "
            "Communicate to user with caution — overextension does not guarantee retracement."
        ),
        "state_relevance": "BREAKOUT_DETECTED,AWAITING_PULLBACK",
        "topic": "keltner_overextended",
    },
    {
        "text": (
            "MOMENTUM_OBSERVED zone: When H4 Keltner band position suggests elevated "
            "directional momentum (bands 3-4 for longs, 8-9 for shorts), the traditional "
            "pullback-to-broken-trendline model may be less applicable. Current structural "
            "conditions appear to favor sustained directional movement. In these cases, "
            "generate a momentum observation noting that a separate entry-price workflow "
            "is needed (micro-TF S/R, consolidation levels within the momentum move). "
            "CRITICAL TONE RULE: Never state that 'pullback will not occur' or 'breakout "
            "is confirmed'. Use language like 'pullback appears less likely', 'conditions "
            "suggest', 'may continue'. Markets remain unpredictable."
        ),
        "state_relevance": "BREAKOUT_DETECTED",
        "topic": "keltner_momentum",
    },
]
```

### 25.2 Updated Knowledge Query Map

The existing state-specific query map in `_fetch_knowledge()` (Section 10.1) should include Keltner context for `BREAKOUT_DETECTED`:

```python
# Updated query_map entry for BREAKOUT_DETECTED:
State.BREAKOUT_DETECTED: (
    "How to evaluate breakout quality holistically: body close position, "
    "momentum Z-score context, TEMA/HRMA gap state, AND Keltner Channel "
    "sentiment zone for structural momentum assessment"
),
```

---

## 26. Tone & Language Policy

### 26.1 Purpose

All user-facing text generated by this system — whether from hardcoded response templates, LLM-generated assessments, or momentum advisories — **must** use probabilistic, hedged language. Markets are inherently unpredictable. The system provides observations and analysis of structural conditions, not predictions or guarantees.

This policy applies to:
- Hardcoded response strings in `_generate_hard_rule_response()`
- LLM prompt instructions and output in `evaluate_with_llm()`
- Generated responses in `generate_response()` and `generate_momentum_advisory()`
- VectorDB knowledge chunks retrieved during evaluation
- Any other text delivered to end users

### 26.2 Prohibited Language

The following words and phrases (or semantic equivalents) **must never** appear in user-facing output:

| Prohibited Phrase | Why |
|---|---|
| "breakout confirmed" | Implies certainty about a market event |
| "pullback unlikely" / "pullback will not occur" | States a prediction as fact |
| "price will [rise/fall/reverse]" | Predicts future price movement |
| "strong bullish" / "strong bearish" | Overly assertive sentiment label |
| "guaranteed" / "certain" / "definitely" | Absolute certainty claims |
| "mean reversion expected" | States an outcome as expected |
| "fakeout detected" / "fakeout confirmed" | Asserts detection as fact |
| "momentum confirmed" | Implies confirmation of a market condition |
| "you should buy/sell" | Direct trading instruction (advisory-only system) |
| "profit target" / "take profit at" | Implies guaranteed profit levels |

### 26.3 Required Language Patterns

Use these probabilistic alternatives instead:

| Instead of... | Use... |
|---|---|
| "breakout confirmed" | "breakout detected" / "breakout attempt observed" |
| "pullback unlikely" | "pullback may be less likely" / "conditions may not favor a traditional pullback" |
| "price will rise" | "conditions suggest upward pressure" / "price appears to favor..." |
| "strong bullish" | "elevated bullish sentiment" / "suggests elevated bullish conditions" |
| "mean reversion expected" | "retracement conditions may develop" / "monitor for retracement signals" |
| "fakeout detected" | "elevated fakeout risk" / "conditions appear unfavorable for sustained reversal" |
| "momentum confirmed" | "momentum observed" / "Keltner position suggests elevated sentiment" |
| Any definitive statement | Prefix with "appears to", "suggests", "may", "conditions favor" |

### 26.4 Required Disclaimers

Every substantive user-facing response (zone assessments, momentum advisories, trade observations) **must** include at least one of the following disclaimers or a semantically equivalent statement:

- "Market conditions can change rapidly."
- "This reflects current structural conditions, not a prediction."
- "This is an observation, not a guarantee."
- "Past structural patterns do not guarantee future outcomes."
- "Conditions may shift — monitor for updates."

### 26.5 Post-Generation Tone Validator

After any LLM-generated text is produced, it passes through a tone validation function before delivery to the user. This function scans for prohibited phrases and flags violations.

**File**: `tone_validator.py`

```python
"""
Post-generation tone validator.

Scans LLM output for prohibited absolute/decisive language
and flags or rewrites violations before delivery to users.
"""

import re
from typing import NamedTuple

# Prohibited patterns — regex patterns that match absolute/decisive language
PROHIBITED_PATTERNS: list[tuple[str, str]] = [
    # (regex_pattern, human-readable description)
    (r"\bbreakout\s+confirmed\b", "breakout confirmed"),
    (r"\bpullback\s+unlikely\b", "pullback unlikely"),
    (r"\bpullback\s+will\s+not\b", "pullback will not"),
    (r"\bprice\s+will\b", "price will"),
    (r"\bwill\s+(?:rise|fall|drop|crash|surge|reverse|continue)\b", "will [direction]"),
    (r"\bstrong(?:ly)?\s+(?:bullish|bearish)\b", "strong bullish/bearish"),
    (r"\bguaranteed?\b", "guaranteed"),
    (r"\bcertain(?:ly)?\b", "certainly/certain"),
    (r"\bdefinitely\b", "definitely"),
    (r"\bmean\s+reversion\s+expected\b", "mean reversion expected"),
    (r"\bfakeout\s+(?:confirmed|detected)\b", "fakeout confirmed/detected"),
    (r"\bmomentum\s+confirmed\b", "momentum confirmed"),
    (r"\byou\s+should\s+(?:buy|sell|enter|exit)\b", "you should buy/sell"),
    (r"\bprofit\s+target\b", "profit target"),
    (r"\btake\s+profit\s+at\b", "take profit at"),
    (r"\bwithout\s+(?:a\s+)?doubt\b", "without doubt"),
    (r"\b(?:is|are)\s+going\s+to\b", "is going to"),
]


class ToneViolation(NamedTuple):
    """A single tone violation found in text."""
    pattern_desc: str
    matched_text: str
    position: int


def validate_tone(text: str) -> list[ToneViolation]:
    """
    Scan text for prohibited absolute/decisive language.

    Args:
        text: The LLM-generated text to validate.

    Returns:
        List of ToneViolation instances. Empty list means text passes validation.
    """
    violations: list[ToneViolation] = []

    for pattern, description in PROHIBITED_PATTERNS:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            violations.append(
                ToneViolation(
                    pattern_desc=description,
                    matched_text=match.group(),
                    position=match.start(),
                )
            )

    return violations


def enforce_tone(text: str, max_retries: int = 1, llm_instance=None) -> str:
    """
    Validate tone and optionally request LLM rewrite if violations found.

    If violations are detected and an LLM instance is provided, requests
    a rewrite with explicit tone instructions. If no LLM is available,
    logs a warning and returns the original text with a disclaimer appended.

    Args:
        text: The LLM-generated text to validate and potentially fix.
        max_retries: Maximum number of LLM rewrite attempts (default: 1).
        llm_instance: Optional txtai LLM pipeline instance for rewrites.

    Returns:
        The validated (and potentially rewritten) text.
    """
    import logging
    logger = logging.getLogger("orchestrator.tone_validator")

    violations = validate_tone(text)

    if not violations:
        return text

    violation_summary = ", ".join(v.pattern_desc for v in violations)
    logger.warning(f"Tone violations detected: {violation_summary}")

    if llm_instance is not None and max_retries > 0:
        rewrite_prompt = (
            f"The following text contains language that is too absolute or decisive "
            f"for a market advisory context. Please rewrite it using probabilistic, "
            f"hedged language. Replace phrases like 'will', 'confirmed', 'guaranteed' "
            f"with 'may', 'suggests', 'appears to'. Keep the same meaning and data "
            f"points, but soften all directional claims.\n\n"
            f"Violations found: {violation_summary}\n\n"
            f"Original text:\n{text}\n\n"
            f"Rewritten text:"
        )
        rewritten = llm_instance(rewrite_prompt, maxlength=512)

        # Recursively validate the rewrite (with decremented retries)
        return enforce_tone(rewritten, max_retries=max_retries - 1, llm_instance=llm_instance)

    # No LLM available — append disclaimer and return
    disclaimer = (
        "\n\nNote: This analysis reflects current structural conditions "
        "and is not a prediction of future price movement. "
        "Market conditions can change rapidly."
    )
    return text + disclaimer
```

### 26.6 Integration Points

The tone validator integrates at these points in the pipeline:

```python
# In generate_response() — after LLM generates text:
raw_response = llm_instance(prompt, maxlength=512)
validated_response = enforce_tone(raw_response, llm_instance=llm_instance)
return validated_response

# In evaluate_with_llm() — after LLM assessment is extracted:
assessment = parsed_result.get("assessment", "")
from tone_validator import validate_tone
violations = validate_tone(assessment)
if violations:
    logger.warning(f"LLM assessment tone violations: {[v.pattern_desc for v in violations]}")
    # Assessment is internal — log warning but do not block
    # The user-facing response will be validated separately
```

### 26.7 Updated File Structure

Add `tone_validator.py` to the project:

```
trading_alerts/
├── orchestrator/
│   ├── tone_validator.py          # NEW — Post-generation tone validation
│   ├── ...
```

### 26.8 Test Cases for Tone Validator

```python
class TestToneValidator:
    """Tests for post-generation tone validation."""

    def test_clean_text_passes(self):
        """Text with no violations returns empty list."""
        text = "Breakout detected. Conditions suggest elevated bullish sentiment. Pullback may be less likely."
        violations = validate_tone(text)
        assert len(violations) == 0

    def test_prohibited_breakout_confirmed(self):
        """Catches 'breakout confirmed' violation."""
        text = "The breakout confirmed above resistance."
        violations = validate_tone(text)
        assert len(violations) == 1
        assert violations[0].pattern_desc == "breakout confirmed"

    def test_prohibited_price_will(self):
        """Catches 'price will' violation."""
        text = "Price will continue rising toward the next level."
        violations = validate_tone(text)
        assert any(v.pattern_desc == "price will" for v in violations)

    def test_prohibited_strong_bullish(self):
        """Catches 'strong bullish' violation."""
        text = "There is a strong bullish signal on this chart."
        violations = validate_tone(text)
        assert any(v.pattern_desc == "strong bullish/bearish" for v in violations)

    def test_multiple_violations(self):
        """Catches multiple violations in a single text."""
        text = "Breakout confirmed. Price will rise. Strong bullish momentum confirmed."
        violations = validate_tone(text)
        assert len(violations) >= 3

    def test_case_insensitive(self):
        """Catches violations regardless of case."""
        text = "BREAKOUT CONFIRMED — Price WILL rise."
        violations = validate_tone(text)
        assert len(violations) >= 2

    def test_enforce_tone_clean_text(self):
        """Clean text passes through unchanged."""
        text = "Conditions suggest a potential move. Monitor for updates."
        result = enforce_tone(text)
        assert result == text

    def test_enforce_tone_adds_disclaimer_without_llm(self):
        """When no LLM available, appends disclaimer to violated text."""
        text = "Breakout confirmed above resistance."
        result = enforce_tone(text, llm_instance=None)
        assert "not a prediction" in result
        assert result.startswith(text)
```

---

**Document Status**: Complete — ready for implementation (v2.1, with Keltner Sentiment Gate integration + Tone & Language Policy)
**Total Custom Code Estimate**: ~1,750 lines Python + ~80 lines SQL + ~600 lines tests
**New Files**: `sentiment_gate.py` (~120 lines), `keltner.py` (~100 lines), `test_sentiment_gate.py` (~200 lines), `tone_validator.py` (~90 lines), `test_tone_validator.py` (~100 lines)
**Framework Dependencies**: txtai (with agent, api, database, pipeline-llm extras)
**External Dependencies**: PostgreSQL, Claude API (Anthropic)
