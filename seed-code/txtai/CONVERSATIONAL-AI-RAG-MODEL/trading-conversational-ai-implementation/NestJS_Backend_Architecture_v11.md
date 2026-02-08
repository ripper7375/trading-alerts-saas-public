# NestJS v11 Backend Architecture — Agentic Trading AI Service

**Document Type:** Backend Architecture Design
**Version:** 1.0
**Date:** February 8, 2026
**Companion To:** Agentic AI Trading Model Architecture Blueprint v2.1, Frontend Architecture (Next.js v16), Integration Contract
**Purpose:** Define the complete NestJS v11 backend architecture that replaces the Python/txtai/LangGraph agent service, including module structure, service layer, WebSocket gateway, database entities, and agent orchestration
**Target Stack:** NestJS v11 (Railway), PostgreSQL (TypeORM), Socket.IO (WebSocket Gateway), Claude API (Anthropic SDK), ChromaDB/pgvector (Vector Store)
**Replaces:** Sections of Agentic RAG Implementation Architecture v1.0 (Python/LangGraph) and State Machine Modification for txtai Framework v1.0 (Python/txtai)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Module Structure](#2-module-structure)
3. [Database Layer — TypeORM Entities](#3-database-layer--typeorm-entities)
4. [State Machine Service](#4-state-machine-service)
5. [Agent Orchestrator Service](#5-agent-orchestrator-service)
6. [Market Data Service](#6-market-data-service)
7. [Knowledge Retriever Service](#7-knowledge-retriever-service)
8. [Convergence Scoring Service](#8-convergence-scoring-service)
9. [LLM Service — Claude API Integration](#9-llm-service--claude-api-integration)
10. [WebSocket Gateway](#10-websocket-gateway)
11. [Chat Service](#11-chat-service)
12. [Instrument Context Service](#12-instrument-context-service)
13. [Cron Evaluation Service](#13-cron-evaluation-service)
14. [Configuration and Environment](#14-configuration-and-environment)
15. [File Structure](#15-file-structure)
16. [Deployment Architecture](#16-deployment-architecture)

---

## 1. Architecture Overview

### 1.1 Why NestJS v11

The original architecture documents specify Python (txtai/LangGraph) for the backend. This architecture replaces Python with NestJS v11 (TypeScript) for the following reasons:

- **Unified language**: TypeScript across frontend (Next.js) and backend reduces context switching and enables shared types
- **NestJS module system**: Provides clean dependency injection, testability, and separation of concerns that maps well to the agent's modular architecture
- **WebSocket gateway**: First-class Socket.IO support via `@nestjs/websockets` — simpler than bolting WebSocket onto Flask/FastAPI
- **TypeORM integration**: Native PostgreSQL support with decorators, migrations, and repository pattern
- **Cron scheduling**: `@nestjs/schedule` provides cron decorators for bar-close evaluation triggers

### 1.2 Component Map — Python to NestJS Translation

| Python Component (Original Docs) | NestJS Replacement | Module |
|---|---|---|
| `StateMachine` class (state_machine.py) | `StateMachineService` | `AgentModule` |
| `AgentStateManager` class (state_persistence.py) | `AgentStateEntity` + `AgentStateRepository` | `AgentModule` |
| `ConvergenceScorer` class | `ConvergenceScoringService` | `AgentModule` |
| `EvaluationPipeline` class | `AgentOrchestratorService` | `AgentModule` |
| `LLMOutputParser` class | `LlmService` (includes parsing) | `LlmModule` |
| LangGraph `StateGraph` + nodes | `AgentOrchestratorService.runEvaluationCycle()` | `AgentModule` |
| `market_data_retriever` tool | `MarketDataService` | `MarketDataModule` |
| `knowledge_retriever` tool | `KnowledgeRetrieverService` | `KnowledgeModule` |
| Flask MT5 `/api/bars/fetch` | `MarketDataService` (reads pre-computed data from PostgreSQL) | `MarketDataModule` |
| FastAPI WebSocket endpoints | `TradingGateway` (NestJS WebSocket Gateway) | `GatewayModule` |
| txtai Workflow cron | `CronEvaluationService` with `@Cron()` decorator | `SchedulerModule` |

### 1.3 High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                    NestJS v11 Application (Railway)                  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     GatewayModule                             │  │
│  │  TradingGateway (Socket.IO WebSocket)                        │  │
│  │    ├── handleChatMessage()                                   │  │
│  │    ├── handleJoinConversation()                               │  │
│  │    ├── handleRequestChartData()                               │  │
│  │    └── pushToClient() — state_change_alert, agent_response   │  │
│  └──────────────────────────┬───────────────────────────────────┘  │
│                              │                                      │
│  ┌──────────────────────────▼───────────────────────────────────┐  │
│  │                      AgentModule                              │  │
│  │  AgentOrchestratorService                                     │  │
│  │    ├── runEvaluationCycle(instrument, tfConfig)               │  │
│  │    ├── handleUserQuery(conversationId, message)               │  │
│  │    └── processStateTransition()                               │  │
│  │                                                               │  │
│  │  StateMachineService                                          │  │
│  │    ├── validateTransition(currentState, condition)            │  │
│  │    ├── applyTransition(agentState, condition)                 │  │
│  │    └── checkTimeBasedTransitions(agentState)                  │  │
│  │                                                               │  │
│  │  ConvergenceScoringService                                    │  │
│  │    └── computeScore(marketData, agentState): ConvergenceScore│  │
│  └──────────────────────────┬───────────────────────────────────┘  │
│                              │                                      │
│  ┌───────────┐  ┌───────────▼──────┐  ┌────────────────────────┐  │
│  │ MarketData│  │   LlmModule      │  │  KnowledgeModule       │  │
│  │ Module    │  │   LlmService     │  │  KnowledgeRetriever    │  │
│  │           │  │   (Claude API)   │  │  Service               │  │
│  │ Market    │  │                  │  │  (ChromaDB / pgvector) │  │
│  │ Data      │  └──────────────────┘  └────────────────────────┘  │
│  │ Service   │                                                     │
│  └─────┬─────┘                                                     │
│        │                                                            │
│  ┌─────▼──────────────────────────────────────────────────────────┐│
│  │                  DatabaseModule (TypeORM)                       ││
│  │  Entities: AgentState, TrendlineData, MomentumCandle,         ││
│  │            TemaHrmaValue, SRZone, Conversation, AuditLog      ││
│  └────────────────────────────────────────────────────────────────┘│
│                              │                                      │
│  ┌──────────────────────────▼───────────────────────────────────┐  │
│  │                   SchedulerModule                             │  │
│  │  CronEvaluationService                                        │  │
│  │    └── @Cron('0 * * * *') → triggerH1Evaluation()            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
┌──────────────────┐     ┌──────────────────┐
│  PostgreSQL      │     │  Claude API      │
│  (Railway)       │     │  (Anthropic)     │
└──────────────────┘     └──────────────────┘
```

---

## 2. Module Structure

### 2.1 NestJS Module Dependency Graph

```
AppModule
├── DatabaseModule          ← TypeORM configuration, entity registration
├── AgentModule             ← State machine, orchestrator, convergence scoring
│   ├── imports: DatabaseModule, LlmModule, MarketDataModule, KnowledgeModule
│   └── exports: AgentOrchestratorService
├── LlmModule               ← Claude API client, prompt construction, output parsing
├── MarketDataModule         ← PostgreSQL queries for trendlines, momentum, TEMA/HRMA
│   └── imports: DatabaseModule
├── KnowledgeModule          ← VectorDB client for methodology retrieval
├── ChatModule               ← Conversation persistence, message history
│   └── imports: DatabaseModule
├── GatewayModule            ← WebSocket gateway (Socket.IO)
│   └── imports: AgentModule, ChatModule, MarketDataModule, InstrumentContextModule
├── InstrumentContextModule  ← Assembles chart + card data for an instrument
│   └── imports: MarketDataModule
├── SchedulerModule          ← Cron-triggered evaluation cycles
│   └── imports: AgentModule, GatewayModule
└── AuthModule               ← JWT authentication for WebSocket and REST
```

### 2.2 Module Responsibilities

| Module | Responsibility | External Dependencies |
|---|---|---|
| `DatabaseModule` | TypeORM connection, entity registration, migrations | PostgreSQL |
| `AgentModule` | Core business logic: state machine, evaluation pipeline, convergence scoring | None (internal) |
| `LlmModule` | Claude API calls, prompt templates, response parsing | Anthropic API |
| `MarketDataModule` | Read pre-computed indicator data from PostgreSQL | PostgreSQL |
| `KnowledgeModule` | Semantic search over methodology documents | ChromaDB / pgvector |
| `ChatModule` | Conversation CRUD, message persistence | PostgreSQL |
| `GatewayModule` | WebSocket event handling, room management, event emission | Socket.IO |
| `InstrumentContextModule` | Assembles full instrument data packages (chart + cards) for frontend | PostgreSQL |
| `SchedulerModule` | Cron triggers for automated evaluation cycles | NestJS Schedule |
| `AuthModule` | JWT validation for both REST and WebSocket connections | JWT |

---

## 3. Database Layer — TypeORM Entities

### 3.1 Entity: AgentState

Ported from the Python `agent_state` table (doc c, Section 6.1). One row per (instrument, tfConfig) pair.

```typescript
// src/agent/entities/agent-state.entity.ts

@Entity('agent_state')
@Unique(['instrument', 'tfConfig'])
export class AgentStateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Identity
  @Column({ type: 'varchar', length: 20 })
  instrument: string;

  @Column({ type: 'varchar', length: 10, name: 'tf_config' })
  tfConfig: string;

  // State machine
  @Column({ type: 'varchar', length: 30, default: 'IDLE', name: 'current_state' })
  currentState: string;

  @Column({ type: 'varchar', length: 30, nullable: true, name: 'previous_state' })
  previousState: string | null;

  @Column({ type: 'int', default: 0, name: 'bars_in_state' })
  barsInState: number;

  @Column({ type: 'int', default: 0, name: 'cooldown_remaining' })
  cooldownRemaining: number;

  @Column({ type: 'timestamp', nullable: true, name: 'last_transition_time' })
  lastTransitionTime: Date | null;

  // Navigation layer
  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true, name: 'aggregate_slope_score' })
  aggregateSlopeScore: number | null;

  @Column({ type: 'varchar', length: 30, nullable: true, name: 'regime_classification' })
  regimeClassification: string | null;

  @Column({ type: 'boolean', default: false, name: 'counter_trend_flag' })
  counterTrendFlag: boolean;

  @Column({ type: 'decimal', precision: 4, scale: 2, default: 1.0, name: 'counter_trend_modifier' })
  counterTrendModifier: number;

  @Column({ type: 'jsonb', nullable: true, name: 'navigation_trendlines' })
  navigationTrendlines: any | null;

  // Decision layer — market data
  @Column({ type: 'jsonb', nullable: true, name: 'decision_trendlines' })
  decisionTrendlines: any | null;

  @Column({ type: 'jsonb', nullable: true, name: 'decision_momentum' })
  decisionMomentum: any | null;

  @Column({ type: 'jsonb', nullable: true, name: 'decision_tema_hrma' })
  decisionTemaHrma: any | null;

  @Column({ type: 'decimal', precision: 20, scale: 5, nullable: true, name: 'current_price' })
  currentPrice: number | null;

  // Decision layer — zone
  @Column({ type: 'jsonb', nullable: true, name: 'sr_zone' })
  srZone: any | null;

  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true, name: 'zone_density_score' })
  zoneDensityScore: number | null;

  @Column({ type: 'jsonb', nullable: true, name: 'lot_allocations' })
  lotAllocations: any | null;

  // Decision layer — scoring
  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true, name: 'convergence_score' })
  convergenceScore: number | null;

  @Column({ type: 'jsonb', nullable: true, name: 'convergence_breakdown' })
  convergenceBreakdown: any | null;

  @Column({ type: 'jsonb', nullable: true, name: 'convergence_history' })
  convergenceHistory: any | null;

  // Decision layer — price pattern
  @Column({ type: 'jsonb', nullable: true, name: 'price_pattern_state' })
  pricePatternState: any | null;

  @Column({ type: 'jsonb', nullable: true, name: 'broken_levels' })
  brokenLevels: any | null;

  // Breakout context
  @Column({ type: 'int', nullable: true, name: 'breakout_bar_index' })
  breakoutBarIndex: number | null;

  @Column({ type: 'decimal', precision: 20, scale: 5, nullable: true, name: 'breakout_bar_price' })
  breakoutBarPrice: number | null;

  @Column({ type: 'jsonb', nullable: true, name: 'breakout_trendline' })
  breakoutTrendline: any | null;

  @Column({ type: 'varchar', length: 10, nullable: true, name: 'trade_direction' })
  tradeDirection: string | null;

  // LLM outputs
  @Column({ type: 'text', nullable: true, name: 'llm_assessment' })
  llmAssessment: string | null;

  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true, name: 'llm_confidence' })
  llmConfidence: number | null;

  @Column({ type: 'decimal', precision: 4, scale: 2, nullable: true, name: 'llm_score_adjustment' })
  llmScoreAdjustment: number | null;

  @Column({ type: 'boolean', default: false, name: 'llm_override_flag' })
  llmOverrideFlag: boolean;

  @Column({ type: 'text', nullable: true, name: 'llm_override_reason' })
  llmOverrideReason: string | null;

  // Chat
  @Column({ type: 'text', nullable: true, name: 'pending_response' })
  pendingResponse: string | null;

  // Audit
  @Column({ type: 'timestamp', nullable: true, name: 'last_evaluation_time' })
  lastEvaluationTime: Date | null;

  @Column({ type: 'int', default: 0, name: 'evaluation_count' })
  evaluationCount: number;

  // Timestamps
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

### 3.2 Entity: TrendlineData

Pre-computed by the data pipeline (Flask MT5 service or equivalent). Read-only from NestJS perspective.

```typescript
// src/market-data/entities/trendline-data.entity.ts

@Entity('trendline_data')
export class TrendlineDataEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20 })
  instrument: string;

  @Column({ type: 'varchar', length: 10 })
  timeframe: string;

  @Column({ type: 'timestamp', name: 'bar_time' })
  barTime: Date;

  @Column({ type: 'varchar', length: 20, name: 'line_type' })
  lineType: string;        // 'peak' (resistance) or 'bottom' (support)

  @Column({ type: 'float', name: 'slope_degrees' })
  slopeDegrees: number;

  @Column({ type: 'float' })
  intercept: number;

  @Column({ type: 'float', name: 'projected_price' })
  projectedPrice: number;

  @Column({ type: 'float' })
  score: number;

  @Column({ type: 'int', name: 'touch_count' })
  touchCount: number;

  @Column({ type: 'int', nullable: true, name: 'line_length_bars' })
  lineLengthBars: number | null;

  @Column({ type: 'float', nullable: true, name: 'distance_to_price_pct' })
  distanceToPricePct: number | null;

  @Column({ type: 'varchar', length: 20, default: 'intact' })
  status: string;

  @Column({ type: 'int', nullable: true })
  rank: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

### 3.3 Entity: Conversation

```typescript
// src/chat/entities/conversation.entity.ts

@Entity('conversations')
export class ConversationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  instrument: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true, name: 'tf_config' })
  tfConfig: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string | null;

  @Column({ type: 'boolean', default: false, name: 'is_pinned' })
  isPinned: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_archived' })
  isArchived: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => MessageEntity, message => message.conversation)
  messages: MessageEntity[];
}
```

### 3.4 Entity: Message

```typescript
// src/chat/entities/message.entity.ts

@Entity('messages')
export class MessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'conversation_id' })
  conversationId: string;

  @Column({ type: 'varchar', length: 20 })
  role: string;            // 'user' | 'agent' | 'system' | 'alert'

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any | null;   // convergence breakdown, state snapshot, etc.

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => ConversationEntity, conv => conv.messages)
  @JoinColumn({ name: 'conversation_id' })
  conversation: ConversationEntity;
}
```

### 3.5 Entity: AuditLog

```typescript
// src/agent/entities/audit-log.entity.ts

@Entity('audit_log')
export class AuditLogEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20 })
  instrument: string;

  @Column({ type: 'varchar', length: 10, name: 'tf_config' })
  tfConfig: string;

  @Column({ type: 'timestamp', name: 'bar_time' })
  barTime: Date;

  @Column({ type: 'varchar', length: 30, nullable: true, name: 'state_from' })
  stateFrom: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true, name: 'state_to' })
  stateTo: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true, name: 'trigger_type' })
  triggerType: string | null;

  @Column({ type: 'jsonb', nullable: true, name: 'convergence_json' })
  convergenceJson: any | null;

  @Column({ type: 'text', nullable: true, name: 'llm_assessment' })
  llmAssessment: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true, name: 'llm_confidence' })
  llmConfidence: string | null;

  @Column({ type: 'boolean', default: false, name: 'llm_override_flag' })
  llmOverrideFlag: boolean;

  @Column({ type: 'text', nullable: true, name: 'llm_override_reason' })
  llmOverrideReason: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true, name: 'regime_classification' })
  regimeClassification: string | null;

  @Column({ type: 'float', nullable: true, name: 'counter_trend_modifier' })
  counterTrendModifier: number | null;

  @Column({ type: 'float', nullable: true, name: 'zone_density_score' })
  zoneDensityScore: number | null;

  @Column({ type: 'varchar', length: 30, nullable: true, name: 'price_pattern_type' })
  pricePatternType: string | null;

  @Column({ type: 'jsonb', nullable: true, name: 'sr_zone_json' })
  srZoneJson: any | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

---

## 4. State Machine Service

Direct TypeScript port of the Python `StateMachine` class (doc c, Section 4.1).

### 4.1 State Enum and Transitions

```typescript
// src/agent/state-machine/states.ts

export enum AgentState {
  IDLE = 'IDLE',
  NAVIGATING = 'NAVIGATING',
  SCANNING = 'SCANNING',
  BREAKOUT_DETECTED = 'BREAKOUT_DETECTED',
  AWAITING_PULLBACK = 'AWAITING_PULLBACK',
  PULLBACK_TESTING = 'PULLBACK_TESTING',
  MISSED = 'MISSED',
  INVALIDATED = 'INVALIDATED',
}

// Transition map: { fromState: { condition: toState } }
export const TRANSITIONS: Record<AgentState, Record<string, AgentState>> = {
  [AgentState.IDLE]: {
    new_bar: AgentState.NAVIGATING,
    user_trigger: AgentState.NAVIGATING,
  },
  [AgentState.NAVIGATING]: {
    regime_valid: AgentState.SCANNING,
    regime_incompatible: AgentState.IDLE,
  },
  [AgentState.SCANNING]: {
    breakout_found: AgentState.BREAKOUT_DETECTED,
    structure_deteriorated: AgentState.IDLE,
    no_setup: AgentState.IDLE,
  },
  [AgentState.BREAKOUT_DETECTED]: {
    quality_sufficient: AgentState.AWAITING_PULLBACK,
    quality_insufficient: AgentState.INVALIDATED,
    instant_fakeout: AgentState.INVALIDATED,
    timeout: AgentState.INVALIDATED,
  },
  [AgentState.AWAITING_PULLBACK]: {
    pullback_arrived: AgentState.PULLBACK_TESTING,
    window_expired: AgentState.MISSED,
    failed_breakout: AgentState.INVALIDATED,
  },
  [AgentState.PULLBACK_TESTING]: {
    bounce_confirmed: AgentState.IDLE,   // Advisory: respond then IDLE
    level_broken: AgentState.INVALIDATED,
    inconclusive: AgentState.SCANNING,
    timeout: AgentState.INVALIDATED,
  },
  [AgentState.MISSED]: {
    cooldown_expired: AgentState.IDLE,
  },
  [AgentState.INVALIDATED]: {
    cooldown_expired: AgentState.IDLE,
  },
};
```

### 4.2 StateMachineService

```typescript
// src/agent/state-machine/state-machine.service.ts

@Injectable()
export class StateMachineService {
  private readonly config: StateMachineConfig;

  constructor(@Inject('STATE_MACHINE_CONFIG') config?: Partial<StateMachineConfig>) {
    this.config = {
      breakoutConfirmationWindow: 3,
      pullbackTimeWindow: 10,
      pullbackTestingWindow: 5,
      cooldownBars: 4,
      ...config,
    };
  }

  validateTransition(currentState: AgentState, condition: string): AgentState {
    const allowed = TRANSITIONS[currentState] || {};
    const target = allowed[condition];
    if (!target) {
      throw new TransitionError(
        `Invalid transition: ${currentState} --(${condition})--> ???. ` +
        `Allowed: ${Object.keys(allowed).join(', ')}`
      );
    }
    return target;
  }

  applyTransition(state: AgentStateDict, condition: string): AgentStateDict {
    const current = state.currentState as AgentState;
    const target = this.validateTransition(current, condition);

    state.previousState = current;
    state.currentState = target;
    state.lastTransitionTime = new Date();
    state.barsInState = 0;

    if (target === AgentState.IDLE) {
      this.resetEvaluationContext(state);
    }
    if (target === AgentState.MISSED || target === AgentState.INVALIDATED) {
      state.cooldownRemaining = this.config.cooldownBars;
    }
    if (target === AgentState.SCANNING && current === AgentState.PULLBACK_TESTING) {
      this.clearZoneContext(state);
    }

    return state;
  }

  checkTimeBasedTransitions(state: AgentStateDict): string | null {
    const current = state.currentState as AgentState;
    const bars = state.barsInState || 0;

    if (current === AgentState.BREAKOUT_DETECTED && bars >= this.config.breakoutConfirmationWindow) {
      return 'timeout';
    }
    if (current === AgentState.AWAITING_PULLBACK && bars >= this.config.pullbackTimeWindow) {
      return 'window_expired';
    }
    if (current === AgentState.PULLBACK_TESTING && bars >= this.config.pullbackTestingWindow) {
      return 'timeout';
    }
    if ((current === AgentState.MISSED || current === AgentState.INVALIDATED) &&
        (state.cooldownRemaining || 0) <= 0) {
      return 'cooldown_expired';
    }
    return null;
  }

  incrementBar(state: AgentStateDict): AgentStateDict {
    state.barsInState = (state.barsInState || 0) + 1;
    const current = state.currentState as AgentState;
    if (current === AgentState.MISSED || current === AgentState.INVALIDATED) {
      state.cooldownRemaining = Math.max(0, (state.cooldownRemaining || 0) - 1);
    }
    return state;
  }

  getAllowedTransitions(currentState: AgentState): Record<string, string> {
    const allowed = TRANSITIONS[currentState] || {};
    return Object.fromEntries(
      Object.entries(allowed).map(([cond, target]) => [cond, target])
    );
  }

  private resetEvaluationContext(state: AgentStateDict): void {
    state.breakoutBarIndex = null;
    state.breakoutBarPrice = null;
    state.breakoutTrendline = null;
    state.srZone = null;
    state.zoneDensityScore = null;
    state.lotAllocations = null;
    state.pricePatternState = null;
    state.brokenLevels = null;
    state.cooldownRemaining = 0;
  }

  private clearZoneContext(state: AgentStateDict): void {
    state.srZone = null;
    state.zoneDensityScore = null;
    state.lotAllocations = null;
    state.pricePatternState = null;
    state.brokenLevels = null;
  }
}
```

---

## 5. Agent Orchestrator Service

The central service that replaces the LangGraph `StateGraph`. Instead of a graph with nodes and edges, the orchestrator implements the evaluation pipeline as a procedural method with conditional branching.

### 5.1 Design Rationale

LangGraph's value is graph-based state management with persistence. In NestJS, we achieve the same with:
- **TypeORM** for state persistence (replaces `MemorySaver`)
- **Procedural methods** for the evaluation pipeline (replaces graph nodes/edges)
- **`StateMachineService`** for transition validation (replaces `add_conditional_edges`)

The pipeline is simple enough that a graph abstraction adds overhead without proportional benefit. The evaluation cycle is essentially a linear pipeline with one conditional branch point (after evaluation: respond vs. build zone).

### 5.2 Orchestrator Service

```typescript
// src/agent/agent-orchestrator.service.ts

@Injectable()
export class AgentOrchestratorService {
  constructor(
    private readonly stateMachine: StateMachineService,
    private readonly marketData: MarketDataService,
    private readonly knowledge: KnowledgeRetrieverService,
    private readonly convergence: ConvergenceScoringService,
    private readonly llm: LlmService,
    private readonly agentStateRepo: Repository<AgentStateEntity>,
    private readonly auditLogRepo: Repository<AuditLogEntity>,
  ) {}

  /**
   * Run a full evaluation cycle for an instrument.
   * Called by: CronEvaluationService (periodic) or TradingGateway (user query).
   *
   * Maps to the LangGraph pipeline:
   *   TRIGGER → FETCH_DATA → FETCH_KNOWLEDGE → NAVIGATE → EVALUATE
   *     → [build_zone] → RESPOND → LOG_AUDIT
   */
  async runEvaluationCycle(
    instrument: string,
    tfConfig: string,
    trigger: 'new_bar' | 'user_trigger',
  ): Promise<EvaluationResult> {
    // 1. Load state from PostgreSQL
    let state = await this.loadOrCreateState(instrument, tfConfig);

    // 2. Increment bar counter
    state = this.stateMachine.incrementBar(state);

    // 3. Check time-based transitions
    const timeCondition = this.stateMachine.checkTimeBasedTransitions(state);
    if (timeCondition) {
      state = this.stateMachine.applyTransition(state, timeCondition);
      if (state.currentState === AgentState.IDLE) {
        await this.saveState(state);
        return this.generateStatusResponse(state);
      }
    }

    // 4. If IDLE, transition to NAVIGATING
    if (state.currentState === AgentState.IDLE) {
      state = this.stateMachine.applyTransition(state, trigger);
    }

    // 5. FETCH DATA (Market Data Retriever)
    const marketSnapshot = await this.marketData.fetchFullSnapshot(
      instrument, tfConfig
    );
    state = this.applyMarketDataToState(state, marketSnapshot);

    // 6. NAVIGATE — Compute regime
    state = this.computeNavigation(state, marketSnapshot);

    // 7. Check regime compatibility
    if (this.isRegimeIncompatible(state)) {
      state = this.stateMachine.applyTransition(state, 'regime_incompatible');
      await this.saveState(state);
      return this.generateStatusResponse(state);
    }

    if (state.currentState === AgentState.NAVIGATING) {
      state = this.stateMachine.applyTransition(state, 'regime_valid');
    }

    // 8. FETCH KNOWLEDGE (VectorDB Retriever)
    const knowledgeContext = await this.knowledge.retrieve(
      state.currentState, instrument, tfConfig
    );

    // 9. EVALUATE — Compute convergence + LLM judgment
    const convergenceResult = this.convergence.computeScore(state, marketSnapshot);
    state.convergenceScore = convergenceResult.adjustedTotal;
    state.convergenceBreakdown = convergenceResult;

    // 10. LLM evaluation
    const llmResult = await this.llm.evaluate(state, marketSnapshot, knowledgeContext);
    state.llmAssessment = llmResult.assessment;
    state.llmConfidence = llmResult.confidence;
    state.llmScoreAdjustment = llmResult.scoreAdjustment;

    const finalScore = convergenceResult.adjustedTotal + llmResult.scoreAdjustment;

    // 11. Determine state transition from LLM output
    const condition = this.determineTransitionCondition(state, llmResult, finalScore);
    if (condition) {
      state = this.stateMachine.applyTransition(state, condition);
    }

    // 12. Build zone if applicable
    if (this.shouldBuildZone(state)) {
      state = await this.buildEntryZone(state, marketSnapshot);
    }

    // 13. Generate response
    const response = await this.llm.generateResponse(state, finalScore);
    state.pendingResponse = response;

    // 14. Persist state
    await this.saveState(state);

    // 15. Log audit
    await this.logAudit(state, trigger, convergenceResult);

    return {
      instrument,
      tfConfig,
      state: state.currentState,
      previousState: state.previousState,
      message: response,
      convergence: convergenceResult,
      agentState: this.toSnapshot(state),
    };
  }

  /**
   * Handle a user chat message that may or may not trigger evaluation.
   * Extracts instrument from message, determines if full evaluation
   * or conversational response is needed.
   */
  async handleUserQuery(
    conversationId: string,
    message: string,
    currentInstrument: string | null,
    currentTfConfig: string | null,
  ): Promise<UserQueryResult> {
    // Extract instrument and intent from user message
    const parsed = await this.llm.parseUserIntent(message, currentInstrument);

    const instrument = parsed.instrument || currentInstrument;
    const tfConfig = parsed.tfConfig || currentTfConfig || 'A';

    if (!instrument) {
      return {
        message: 'Please specify a trading instrument (e.g., XAUUSD, EURUSD).',
        instrumentChanged: false,
      };
    }

    const instrumentChanged = instrument !== currentInstrument;

    // Determine if this requires a full evaluation cycle
    if (parsed.intent === 'analyze' || parsed.intent === 'evaluate') {
      const result = await this.runEvaluationCycle(instrument, tfConfig, 'user_trigger');
      return {
        ...result,
        instrumentChanged,
        newInstrument: instrumentChanged ? instrument : undefined,
        newTfConfig: instrumentChanged ? tfConfig : undefined,
      };
    }

    // For status queries, read current state without running evaluation
    if (parsed.intent === 'status' || parsed.intent === 'score') {
      const state = await this.loadOrCreateState(instrument, tfConfig);
      const response = await this.llm.generateConversationalResponse(
        message, state, parsed.intent
      );
      return {
        message: response,
        agentState: this.toSnapshot(state),
        instrumentChanged,
        newInstrument: instrumentChanged ? instrument : undefined,
        newTfConfig: instrumentChanged ? tfConfig : undefined,
      };
    }

    // Default: conversational response
    const state = await this.loadOrCreateState(instrument, tfConfig);
    const response = await this.llm.generateConversationalResponse(
      message, state, 'general'
    );
    return {
      message: response,
      instrumentChanged,
      newInstrument: instrumentChanged ? instrument : undefined,
      newTfConfig: instrumentChanged ? tfConfig : undefined,
    };
  }
}
```

---

## 6. Market Data Service

Reads pre-computed indicator data from PostgreSQL. This replaces the Python `market_data_retriever` tool.

```typescript
// src/market-data/market-data.service.ts

@Injectable()
export class MarketDataService {
  constructor(
    @InjectRepository(TrendlineDataEntity)
    private readonly trendlineRepo: Repository<TrendlineDataEntity>,
    // ... other entity repositories
  ) {}

  /**
   * Fetch a complete market data snapshot for all timeframes
   * in the given instrument + tfConfig.
   */
  async fetchFullSnapshot(
    instrument: string,
    tfConfig: string,
  ): Promise<MarketDataSnapshot> {
    const config = TF_CONFIGS[tfConfig];

    const allTimeframes = [
      ...config.navigation,
      ...config.decision,
    ];
    // Deduplicate (H2 appears in both nav and decision for Config A)
    const uniqueTimeframes = [...new Set(allTimeframes)];

    const [trendlines, momentum, temaHrma, currentPrice] = await Promise.all([
      this.fetchTrendlines(instrument, uniqueTimeframes),
      this.fetchMomentumCandles(instrument, config.decision),
      this.fetchTemaHrma(instrument, uniqueTimeframes),
      this.fetchCurrentPrice(instrument, config.decision[1]), // Primary decision TF
    ]);

    return {
      instrument,
      tfConfig,
      trendlines,
      momentum,
      temaHrma,
      currentPrice,
      timestamp: new Date(),
    };
  }

  /**
   * Fetch trendline data for specific timeframes.
   * Returns the latest bar's trendlines, ordered by rank.
   */
  async fetchTrendlines(
    instrument: string,
    timeframes: string[],
  ): Promise<TrendlineData[]> {
    return this.trendlineRepo.find({
      where: {
        instrument,
        timeframe: In(timeframes),
      },
      order: { barTime: 'DESC', rank: 'ASC' },
      // Fetch latest bar's data per timeframe
    });
  }

  /**
   * Fetch chart-ready candle data for a specific timeframe.
   * Used by InstrumentContextService to assemble chart data.
   */
  async fetchCandles(
    instrument: string,
    timeframe: string,
    lookback: number = 300,
  ): Promise<CandleData[]> {
    // Query OHLC + momentum classification from PostgreSQL
    // Returns data formatted for TradingView Lightweight Charts
  }

  /**
   * Fetch card-ready structured data for a specific timeframe.
   * Used by InstrumentContextService to assemble card data.
   */
  async fetchCardData(
    instrument: string,
    timeframe: string,
    lineType: 'resistance' | 'support',
  ): Promise<CardData> {
    // Aggregates trendline, TEMA/HRMA, and momentum data
    // into the card display format
  }
}
```

---

## 7. Knowledge Retriever Service

Replaces the Python `knowledge_retriever` tool. Performs semantic search over the methodology VectorDB.

```typescript
// src/knowledge/knowledge-retriever.service.ts

@Injectable()
export class KnowledgeRetrieverService {
  private vectorStore: ChromaClient; // Or pgvector client

  /**
   * Retrieve relevant methodology chunks based on current agent state.
   *
   * Step 1: Pre-filter by state relevance metadata
   * Step 2: Semantic search with constructed analytical query
   * Step 3: Cross-reference expansion
   * Step 4: Assemble into context string
   */
  async retrieve(
    currentState: string,
    instrument: string,
    tfConfig: string,
  ): Promise<string> {
    const query = this.constructRetrievalQuery(currentState);
    const filter = { state_relevance: { $contains: currentState } };

    const results = await this.vectorStore.query({
      queryTexts: [query],
      nResults: 5,
      where: filter,
    });

    return this.assembleContext(results);
  }

  private constructRetrievalQuery(state: string): string {
    const queries: Record<string, string> = {
      NAVIGATING: 'regime classification trendline slope navigation timeframes',
      SCANNING: 'breakout detection trendline resistance support momentum',
      BREAKOUT_DETECTED: 'breakout quality body close momentum TEMA HRMA navigation alignment',
      AWAITING_PULLBACK: 'pullback retracement trendline zone tolerance window',
      PULLBACK_TESTING: 'pullback confirmation active bounce zone density price pattern convergence',
      MISSED: 'missed entry window expired cooldown',
      INVALIDATED: 'invalidation failed breakout disqualifying conditions',
    };
    return queries[state] || 'trading methodology evaluation';
  }
}
```

---

## 8. Convergence Scoring Service

Direct TypeScript port of the rule-based 5-factor scoring system from Blueprint v2.1, Section 5.3.

```typescript
// src/agent/convergence-scoring.service.ts

@Injectable()
export class ConvergenceScoringService {
  /**
   * Compute the 5-factor convergence score.
   * Deterministic, rule-based — no LLM involvement.
   *
   * Factors: Trendline, Momentum, TEMA/HRMA, Navigation, Price Pattern
   * Each scored -2 to +2. Raw total: -10 to +10.
   * Adjusted total: raw × counter-trend modifier.
   */
  computeScore(
    state: AgentStateDict,
    marketData: MarketDataSnapshot,
  ): ConvergenceScore {
    const direction = state.tradeDirection || 'long';

    const trendline = this.scoreTrendline(state, marketData, direction);
    const momentum = this.scoreMomentum(state, marketData, direction);
    const temaHrma = this.scoreTemaHrma(state, marketData, direction);
    const navigation = this.scoreNavigation(state, direction);
    const pricePattern = this.scorePricePattern(state);

    const rawTotal = trendline + momentum + temaHrma + navigation + pricePattern;
    const modifier = state.counterTrendModifier || 1.0;
    const adjustedTotal = rawTotal * modifier;

    return {
      trendline,
      momentum,
      temaHrma,
      navigation,
      pricePattern,
      rawTotal,
      counterTrendModifier: modifier,
      adjustedTotal,
      llmAdjustment: 0,       // Set later by LlmService
      finalScore: adjustedTotal, // Updated after LLM overlay
    };
  }

  private scoreTrendline(state: AgentStateDict, data: MarketDataSnapshot, direction: string): number {
    // Implementation based on Blueprint Section 5.3 trendline scoring table
    // Returns -2 to +2
  }

  private scoreMomentum(state: AgentStateDict, data: MarketDataSnapshot, direction: string): number {
    // Implementation based on Blueprint Section 5.3 momentum scoring table
  }

  private scoreTemaHrma(state: AgentStateDict, data: MarketDataSnapshot, direction: string): number {
    // Implementation based on Blueprint Section 5.3 TEMA/HRMA scoring table
  }

  private scoreNavigation(state: AgentStateDict, direction: string): number {
    // Implementation based on Blueprint Section 5.3 navigation scoring table
  }

  private scorePricePattern(state: AgentStateDict): number {
    // Implementation based on Blueprint Section 3.3.2 price pattern scoring table
  }
}
```

---

## 9. LLM Service — Claude API Integration

### 9.1 Service Structure

```typescript
// src/llm/llm.service.ts

@Injectable()
export class LlmService {
  private client: Anthropic;

  constructor(private configService: ConfigService) {
    this.client = new Anthropic({
      apiKey: this.configService.get('ANTHROPIC_API_KEY'),
    });
  }

  /**
   * Run LLM evaluation overlay on top of rule-based convergence score.
   * Corresponds to the EVALUATE node in the original LangGraph pipeline.
   */
  async evaluate(
    state: AgentStateDict,
    marketData: MarketDataSnapshot,
    knowledgeContext: string,
  ): Promise<LlmEvaluationResult> {
    const prompt = this.constructEvaluationPrompt(state, marketData, knowledgeContext);
    const response = await this.callClaude(prompt, TRADING_AGENT_SYSTEM_PROMPT);
    return this.parseEvaluationResponse(response);
  }

  /**
   * Generate the conversational response for the user.
   * Corresponds to the RESPOND node in the original LangGraph pipeline.
   */
  async generateResponse(
    state: AgentStateDict,
    finalScore: number,
  ): Promise<string> {
    const prompt = this.constructResponsePrompt(state, finalScore);
    const response = await this.callClaude(prompt, RESPONSE_SYSTEM_PROMPT);
    return response;
  }

  /**
   * Parse a user's chat message to extract instrument, intent, and tfConfig.
   */
  async parseUserIntent(
    message: string,
    currentInstrument: string | null,
  ): Promise<ParsedUserIntent> {
    // Uses a lightweight Claude call to extract structured intent
    // Returns: { instrument, tfConfig, intent: 'analyze'|'status'|'score'|'general' }
  }

  private async callClaude(prompt: string, systemPrompt: string): Promise<string> {
    const response = await this.client.messages.create({
      model: this.configService.get('CLAUDE_MODEL', 'claude-sonnet-4-5-20250929'),
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });
    return response.content[0].type === 'text' ? response.content[0].text : '';
  }

  private constructEvaluationPrompt(
    state: AgentStateDict,
    marketData: MarketDataSnapshot,
    knowledge: string,
  ): string {
    // Builds the evaluation prompt following Blueprint Section 8.5 template
    // Includes: state machine context, navigation output, convergence breakdown,
    // trendline context, S/R zone, momentum, TEMA/HRMA, price pattern,
    // breakout context, knowledge context, convergence history
    return `...`;
  }
}
```

### 9.2 System Prompt (Ported from doc b, Section 6.2)

```typescript
const TRADING_AGENT_SYSTEM_PROMPT = `
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
Current TF config: {tfConfig}
Current state: {currentState}
`;
```

---

## 10. WebSocket Gateway

### 10.1 Gateway Implementation

```typescript
// src/gateway/trading.gateway.ts

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
  namespace: '/trading',
  transports: ['websocket'],
})
export class TradingGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly orchestrator: AgentOrchestratorService,
    private readonly chat: ChatService,
    private readonly instrumentContext: InstrumentContextService,
    private readonly auth: AuthService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.token;
    const user = await this.auth.validateToken(token);
    if (!user) {
      client.disconnect();
      return;
    }
    client.data.userId = user.id;
    client.join(`user:${user.id}`);
  }

  @SubscribeMessage('chat_message')
  async handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChatMessagePayload,
  ): Promise<void> {
    const { conversationId, message, instrument, tfConfig } = payload;

    // Persist user message
    await this.chat.saveMessage(conversationId, 'user', message);

    // Process through agent orchestrator
    const result = await this.orchestrator.handleUserQuery(
      conversationId, message, instrument, tfConfig
    );

    // If instrument changed, send full instrument context
    if (result.instrumentChanged && result.newInstrument) {
      const context = await this.instrumentContext.assembleFullContext(
        result.newInstrument, result.newTfConfig || 'A'
      );
      this.server.to(`conversation:${conversationId}`).emit('instrument_context', context);

      // Update conversation's instrument
      await this.chat.updateConversationInstrument(
        conversationId, result.newInstrument, result.newTfConfig
      );
    }

    // Send agent response
    this.server.to(`conversation:${conversationId}`).emit('agent_response', {
      message: result.message,
      agentState: result.agentState,
      convergence: result.convergence,
    });

    // Persist agent message
    await this.chat.saveMessage(conversationId, 'agent', result.message, {
      agentState: result.agentState,
      convergence: result.convergence,
    });
  }

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ): Promise<void> {
    // Leave all previous conversation rooms
    const rooms = Array.from(client.rooms).filter(r => r.startsWith('conversation:'));
    rooms.forEach(r => client.leave(r));

    // Join new conversation room
    client.join(`conversation:${payload.conversationId}`);

    // Send the conversation's current instrument context
    const conversation = await this.chat.getConversation(payload.conversationId);
    if (conversation?.instrument) {
      const context = await this.instrumentContext.assembleFullContext(
        conversation.instrument, conversation.tfConfig || 'A'
      );
      client.emit('instrument_context', context);
    }
  }

  @SubscribeMessage('leave_conversation')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ): void {
    client.leave(`conversation:${payload.conversationId}`);
  }

  @SubscribeMessage('request_chart_data')
  async handleRequestChartData(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { instrument: string; timeframe: string; lookback: number },
  ): Promise<void> {
    const chartData = await this.instrumentContext.assembleChartData(
      payload.instrument, payload.timeframe, payload.lookback
    );
    client.emit('chart_data_update', chartData);
  }

  @SubscribeMessage('request_card_data')
  async handleRequestCardData(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { instrument: string; tfConfig: string },
  ): Promise<void> {
    const cardData = await this.instrumentContext.assembleCardData(
      payload.instrument, payload.tfConfig
    );
    client.emit('card_data_update', cardData);
  }

  /**
   * Called by CronEvaluationService when an automated evaluation
   * produces a state change that should be pushed to clients.
   */
  pushStateChangeAlert(alert: StateChangeAlertPayload): void {
    // Push to all clients watching this instrument
    this.server.emit('state_change_alert', alert);
  }

  /**
   * Called by CronEvaluationService to push bar-close data
   * to clients with active charts.
   */
  pushBarClose(instrument: string, timeframe: string, candle: CandleData): void {
    this.server.emit('bar_close', { instrument, timeframe, candle });
  }
}
```

---

## 11. Chat Service

```typescript
// src/chat/chat.service.ts

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ConversationEntity)
    private readonly conversationRepo: Repository<ConversationEntity>,
    @InjectRepository(MessageEntity)
    private readonly messageRepo: Repository<MessageEntity>,
  ) {}

  async createConversation(userId: string, instrument?: string, tfConfig?: string): Promise<ConversationEntity> {
    const conversation = this.conversationRepo.create({
      userId,
      instrument,
      tfConfig,
    });
    return this.conversationRepo.save(conversation);
  }

  async getConversation(id: string): Promise<ConversationEntity | null> {
    return this.conversationRepo.findOne({ where: { id } });
  }

  async updateConversationInstrument(
    id: string,
    instrument: string,
    tfConfig?: string,
  ): Promise<void> {
    await this.conversationRepo.update(id, {
      instrument,
      ...(tfConfig && { tfConfig }),
      updatedAt: new Date(),
    });
  }

  async saveMessage(
    conversationId: string,
    role: string,
    content: string,
    metadata?: any,
  ): Promise<MessageEntity> {
    const message = this.messageRepo.create({
      conversationId,
      role,
      content,
      metadata,
    });
    return this.messageRepo.save(message);
  }

  async getMessages(conversationId: string, limit = 50): Promise<MessageEntity[]> {
    return this.messageRepo.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }

  async getRecentConversations(userId: string, limit = 10): Promise<ConversationEntity[]> {
    return this.conversationRepo.find({
      where: { userId, isArchived: false },
      order: { updatedAt: 'DESC' },
      take: limit,
    });
  }

  async getPinnedConversations(userId: string): Promise<ConversationEntity[]> {
    return this.conversationRepo.find({
      where: { userId, isPinned: true, isArchived: false },
      order: { updatedAt: 'DESC' },
    });
  }
}
```

---

## 12. Instrument Context Service

Assembles the full data package (chart + cards) when the frontend needs to switch instruments.

```typescript
// src/instrument-context/instrument-context.service.ts

@Injectable()
export class InstrumentContextService {
  constructor(private readonly marketData: MarketDataService) {}

  /**
   * Assemble a complete instrument context payload.
   * Sent when: conversation loads, instrument changes, reconnect.
   */
  async assembleFullContext(
    instrument: string,
    tfConfig: string,
  ): Promise<InstrumentContextPayload> {
    const config = TF_CONFIGS[tfConfig];
    const primaryDecisionTf = config.decision[1]; // H1 for Config A, H2 for Config B

    const [chart, cards] = await Promise.all([
      this.assembleChartData(instrument, primaryDecisionTf, 300),
      this.assembleCardData(instrument, tfConfig),
    ]);

    return { instrument, tfConfig, chart, cards };
  }

  /**
   * Assemble chart data for a specific timeframe.
   */
  async assembleChartData(
    instrument: string,
    timeframe: string,
    lookback: number,
  ): Promise<ChartData> {
    const [candles, trendlines] = await Promise.all([
      this.marketData.fetchCandles(instrument, timeframe, lookback),
      this.marketData.fetchTrendlines(instrument, [timeframe]),
    ]);

    return {
      instrument,
      timeframe,
      candles,
      trendlines: this.formatTrendlinesForChart(trendlines),
      srZones: [], // Populated from agent state if an active zone exists
    };
  }

  /**
   * Assemble card data for all timeframes in the config.
   */
  async assembleCardData(
    instrument: string,
    tfConfig: string,
  ): Promise<CardPanelData> {
    const config = TF_CONFIGS[tfConfig];

    const [navigation, decisionResistance, decisionSupport, lowerDecision] =
      await Promise.all([
        this.assembleNavigationCard(instrument, config),
        this.marketData.fetchCardData(instrument, config.decision[1], 'resistance'),
        this.marketData.fetchCardData(instrument, config.decision[1], 'support'),
        this.marketData.fetchCardData(instrument, config.decision[2], 'support'),
      ]);

    return { navigation, decisionResistance, decisionSupport, lowerDecision };
  }

  private async assembleNavigationCard(
    instrument: string,
    config: TfConfigMapping,
  ): Promise<NavigationCardData> {
    const upperTf = config.navigation[0]; // H4 for Config A
    const lowerTf = config.navigation[1]; // H2 for Config A

    // Fetch navigation trendline data for the card display
    const trendlines = await this.marketData.fetchTrendlines(instrument, [lowerTf]);
    const resistance = trendlines.find(t => t.lineType === 'peak' && t.rank === 1);
    const support = trendlines.find(t => t.lineType === 'bottom' && t.rank === 1);

    return {
      instrument,
      timeframe: lowerTf,
      price: resistance?.projectedPrice || support?.projectedPrice || 0,
      priceType: resistance ? 'resistance' : 'support',
      upperTfKcZone: 0,    // Fetched from additional indicator data
      upperTfSrZone: 0,
      rTrendlineSlope: resistance?.slopeDegrees || 0,
      sTrendlineSlope: support?.slopeDegrees || 0,
    };
  }
}
```

---

## 13. Cron Evaluation Service

Replaces the txtai Workflow cron scheduling (doc c, Section 3.4).

```typescript
// src/scheduler/cron-evaluation.service.ts

@Injectable()
export class CronEvaluationService {
  constructor(
    private readonly orchestrator: AgentOrchestratorService,
    private readonly gateway: TradingGateway,
    private readonly agentStateRepo: Repository<AgentStateEntity>,
  ) {}

  /**
   * H1 bar close — evaluate all active instruments with Config A.
   * Runs every hour at minute 0.
   */
  @Cron('0 * * * *')
  async triggerH1Evaluation(): Promise<void> {
    const activeStates = await this.agentStateRepo.find({
      where: { currentState: Not('IDLE'), tfConfig: 'config_a' },
    });

    for (const state of activeStates) {
      const result = await this.orchestrator.runEvaluationCycle(
        state.instrument, state.tfConfig, 'new_bar'
      );

      // Push state change alert if state transitioned
      if (result.previousState !== result.state) {
        this.gateway.pushStateChangeAlert({
          type: 'state_change',
          id: crypto.randomUUID(),
          previousState: result.previousState || '',
          newState: result.state,
          instrument: result.instrument,
          message: result.message,
          urgency: this.determineUrgency(result.state),
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  /**
   * H2 bar close — evaluate all active instruments with Config B.
   * Runs every 2 hours at minute 0.
   */
  @Cron('0 */2 * * *')
  async triggerH2Evaluation(): Promise<void> {
    const activeStates = await this.agentStateRepo.find({
      where: { currentState: Not('IDLE'), tfConfig: 'config_b' },
    });

    for (const state of activeStates) {
      const result = await this.orchestrator.runEvaluationCycle(
        state.instrument, state.tfConfig, 'new_bar'
      );

      if (result.previousState !== result.state) {
        this.gateway.pushStateChangeAlert({
          type: 'state_change',
          id: crypto.randomUUID(),
          previousState: result.previousState || '',
          newState: result.state,
          instrument: result.instrument,
          message: result.message,
          urgency: this.determineUrgency(result.state),
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  private determineUrgency(state: string): 'low' | 'medium' | 'high' {
    if (state === 'BREAKOUT_DETECTED' || state === 'PULLBACK_TESTING') return 'high';
    if (state === 'AWAITING_PULLBACK' || state === 'INVALIDATED') return 'medium';
    return 'low';
  }
}
```

---

## 14. Configuration and Environment

### 14.1 Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/davintrade

# Claude API
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-5-20250929

# WebSocket / Frontend
FRONTEND_URL=https://davintrade.com
WS_PORT=3001

# VectorDB
CHROMADB_URL=http://localhost:8000
# Or: PGVECTOR_ENABLED=true (use PostgreSQL extension)

# Auth
JWT_SECRET=...

# State Machine Defaults
SM_BREAKOUT_CONFIRMATION_WINDOW=3
SM_PULLBACK_TIME_WINDOW=10
SM_PULLBACK_TESTING_WINDOW=5
SM_COOLDOWN_BARS=4
```

### 14.2 TF Config Constants

```typescript
// src/common/constants/tf-configs.ts

export interface TfConfigMapping {
  navigation: [string, string];
  decision: [string, string, string];
  execution: [string, string];
}

export const TF_CONFIGS: Record<string, TfConfigMapping> = {
  config_a: {
    navigation: ['H4', 'H2'],
    decision: ['H2', 'H1', 'M30'],
    execution: ['M15', 'M5'],
  },
  config_b: {
    navigation: ['H8', 'H4'],
    decision: ['H4', 'H2', 'H1'],
    execution: ['M30', 'M15'],
  },
};

// Short-form mapping for frontend
export const TF_CONFIGS_SHORT: Record<string, TfConfigMapping> = {
  A: TF_CONFIGS.config_a,
  B: TF_CONFIGS.config_b,
};
```

---

## 15. File Structure

```
src/
├── app.module.ts                           # Root module
│
├── agent/
│   ├── agent.module.ts
│   ├── agent-orchestrator.service.ts       # Core evaluation pipeline
│   ├── state-machine/
│   │   ├── states.ts                       # State enum + transition map
│   │   ├── state-machine.service.ts        # Transition validation + application
│   │   └── state-machine.service.spec.ts
│   ├── convergence-scoring.service.ts      # 5-factor scoring engine
│   ├── convergence-scoring.service.spec.ts
│   ├── entities/
│   │   ├── agent-state.entity.ts
│   │   └── audit-log.entity.ts
│   └── dto/
│       ├── evaluation-result.dto.ts
│       └── agent-state-snapshot.dto.ts
│
├── llm/
│   ├── llm.module.ts
│   ├── llm.service.ts                      # Claude API client + prompt construction
│   ├── prompts/
│   │   ├── evaluation.prompt.ts            # Evaluation prompt template
│   │   ├── response.prompt.ts              # Response generation template
│   │   └── intent-parser.prompt.ts         # User intent extraction template
│   └── parsers/
│       ├── evaluation-parser.ts            # Parse LLM evaluation output
│       └── intent-parser.ts                # Parse user intent output
│
├── market-data/
│   ├── market-data.module.ts
│   ├── market-data.service.ts              # PostgreSQL market data queries
│   └── entities/
│       ├── trendline-data.entity.ts
│       ├── momentum-candle.entity.ts
│       ├── tema-hrma-value.entity.ts
│       └── sr-zone.entity.ts
│
├── knowledge/
│   ├── knowledge.module.ts
│   └── knowledge-retriever.service.ts      # VectorDB semantic search
│
├── chat/
│   ├── chat.module.ts
│   ├── chat.service.ts                     # Conversation + message CRUD
│   └── entities/
│       ├── conversation.entity.ts
│       └── message.entity.ts
│
├── gateway/
│   ├── gateway.module.ts
│   └── trading.gateway.ts                  # Socket.IO WebSocket gateway
│
├── instrument-context/
│   ├── instrument-context.module.ts
│   └── instrument-context.service.ts       # Assembles chart + card data
│
├── scheduler/
│   ├── scheduler.module.ts
│   └── cron-evaluation.service.ts          # Cron-triggered evaluations
│
├── auth/
│   ├── auth.module.ts
│   ├── auth.service.ts
│   └── ws-auth.guard.ts                    # WebSocket JWT guard
│
├── common/
│   ├── constants/
│   │   └── tf-configs.ts                   # Timeframe configuration constants
│   ├── types/
│   │   ├── market-data.types.ts
│   │   ├── chart-data.types.ts
│   │   ├── card-data.types.ts
│   │   └── ws-payloads.types.ts
│   └── errors/
│       └── transition.error.ts
│
└── database/
    ├── database.module.ts                  # TypeORM configuration
    └── migrations/                         # TypeORM migrations
```

---

## 16. Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Vercel (Frontend)                              │
│                    Next.js v16 App                                │
│                    davintrade.com                                 │
└───────────────────────┬─────────────────────────────────────────┘
                        │ HTTPS / WebSocket (wss://)
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Railway (Backend)                              │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  NestJS v11 Application                                   │   │
│  │  api.davintrade.com                                       │   │
│  │                                                           │   │
│  │  Port 3000: REST API (auth, conversations, health)        │   │
│  │  Port 3001: WebSocket Gateway (Socket.IO)                 │   │
│  │  Cron: Automated evaluation cycles                        │   │
│  └──────────┬────────────────────────────────────────────────┘   │
│             │                                                    │
│  ┌──────────▼────────────────────────────────────────────────┐   │
│  │  PostgreSQL (Railway Managed)                              │   │
│  │  - agent_state, trendline_data, momentum_candles          │   │
│  │  - tema_hrma_values, sr_zones                             │   │
│  │  - conversations, messages                                │   │
│  │  - audit_log                                              │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  ChromaDB (Railway Container) or pgvector extension        │   │
│  │  - Blueprint methodology chunks                           │   │
│  │  - Trade example embeddings                               │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                        │
                        ▼
              ┌──────────────────┐
              │  Claude API      │
              │  (Anthropic)     │
              └──────────────────┘
```

### Cost Estimate

| Service | Estimated Monthly Cost | Notes |
|---|---|---|
| Railway (NestJS) | $10-20 | Small-medium instance |
| Railway (PostgreSQL) | Already provisioned | Existing infrastructure |
| Railway (ChromaDB) | $5-10 | Small container, or use pgvector for free |
| Claude API (Sonnet) | $20-50 | ~500-1000 evaluations/month |
| Vercel (Next.js) | $20 | Already provisioned |
| **Total incremental** | **$35-80/month** | |

---

_End of NestJS Backend Architecture — Version 1.0_
