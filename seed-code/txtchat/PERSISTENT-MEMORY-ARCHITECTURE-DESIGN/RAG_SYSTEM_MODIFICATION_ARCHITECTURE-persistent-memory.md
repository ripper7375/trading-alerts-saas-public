# Trading SaaS RAG System Modification Architecture

**Document Version**: 1.0  
**Date**: January 31, 2026  
**Purpose**: Comprehensive architecture for enhancing existing RAG system with MT5 Excel upload integration, behavioral analysis, and markdown-based knowledge management

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Target Architecture Overview](#target-architecture-overview)
4. [Database Schema Design](#database-schema-design)
5. [Markdown Knowledge Base Structure](#markdown-knowledge-base-structure)
6. [Upload Portal Design](#upload-portal-design)
7. [Data Processing Pipeline](#data-processing-pipeline)
8. [RAG Enhancement Architecture](#rag-enhancement-architecture)
9. [API Specifications](#api-specifications)
10. [Implementation Phases](#implementation-phases)
11. [Code Examples](#code-examples)
12. [Testing Strategy](#testing-strategy)

---

## Executive Summary

### Objective

Transform the existing conventional RAG system into an intelligent, context-aware trading advisory platform by integrating MT5 trading data through Excel uploads, creating a dual-layer knowledge system (PostgreSQL + Markdown files), and enabling behavioral analysis with market context awareness.

### Key Enhancements

1. **Excel Upload Integration**: Automated parsing and validation of MT5 trading history
2. **Dual-Layer Knowledge System**: PostgreSQL for raw data + Markdown files for LLM context
3. **Behavioral Analysis**: Track trader psychology across market conditions
4. **Market Context Integration**: Enrich trades with volatility regimes and market phases
5. **Real-Time Risk Warnings**: Proactive alerts based on behavioral drift
6. **Historical Performance Tracking**: Longitudinal analysis of behavior → performance correlation

### Expected Benefits

- **85% token cost reduction** vs chat-based data capture
- **100% data accuracy** from real MT5 platform data
- **Instant onboarding** - complete trader profile from single upload
- **Predictive warnings** - catch behavioral drift before losses
- **Personalized advice** - based on trader's proven patterns

---

## Current State Analysis

### Existing Conventional RAG System

#### Architecture Components

```
Current RAG Flow:
User Query → Vector Search → Context Retrieval → LLM Response

Components:
├── VectorDB (embeddings of trading content)
├── PostgreSQL (OHLCV + indicators, 15-min intervals)
├── LLM Chat Interface
└── Web Search Integration
```

#### Current Data Sources

1. **Market Data (PostgreSQL)**
   - 15-minute OHLCV data
   - Technical indicators (ATR, ADX, etc.)
   - Price action metrics
   - JSONB commentary field

2. **Knowledge Base (VectorDB)**
   - Trading strategies documentation
   - Technical analysis concepts
   - Risk management principles
   - Historical market analysis

3. **User Conversations**
   - Chat history for context
   - User preferences (stored in memory system)

#### Current Limitations

1. ❌ **No trader-specific data** - Generic advice only
2. ❌ **No trading history** - Cannot analyze past performance
3. ❌ **No behavioral tracking** - Missing psychological patterns
4. ❌ **No performance attribution** - Can't link behavior → results
5. ❌ **Chat-based data entry** - Unreliable, token-expensive
6. ❌ **No market context** - Advice not calibrated to volatility regime

---

## Target Architecture Overview

### Enhanced RAG System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                            │
│  ┌──────────────────┐              ┌──────────────────┐         │
│  │  Chat Interface  │              │  Upload Portal   │         │
│  └────────┬─────────┘              └────────┬─────────┘         │
│           │                                  │                    │
└───────────┼──────────────────────────────────┼───────────────────┘
            │                                  │
            │                                  │
┌───────────▼──────────────────────────────────▼───────────────────┐
│                    APPLICATION LAYER                              │
│                                                                   │
│  ┌─────────────────┐         ┌──────────────────────────────┐   │
│  │  Chat Handler   │         │  Upload Processor            │   │
│  │  - Load context │         │  - Validate file             │   │
│  │  - Query RAG    │         │  - Parse trades              │   │
│  │  - Risk check   │         │  - Enrich with market data   │   │
│  └────────┬────────┘         │  - Calculate metrics         │   │
│           │                  │  - Generate markdown         │   │
│           │                  └─────────────┬────────────────┘   │
└───────────┼──────────────────────────────────┼───────────────────┘
            │                                  │
            │                                  │
┌───────────▼──────────────────────────────────▼───────────────────┐
│                    DATA PROCESSING LAYER                          │
│                                                                   │
│  ┌──────────────────┐    ┌──────────────────┐    ┌───────────┐  │
│  │  RAG Orchestrator│    │ Behavioral       │    │ Market    │  │
│  │  - Semantic      │    │ Analyzer         │    │ Context   │  │
│  │    search        │    │ - Drift detection│    │ Engine    │  │
│  │  - Ranking       │    │ - Regime analysis│    │           │  │
│  │  - Synthesis     │    │ - Risk warnings  │    │           │  │
│  └──────────────────┘    └──────────────────┘    └───────────┘  │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
            │                         │                    │
            │                         │                    │
┌───────────▼─────────────────────────▼────────────────────▼───────┐
│                    STORAGE LAYER                                  │
│                                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │  VectorDB   │  │  PostgreSQL  │  │  Markdown Files         │ │
│  │  (existing) │  │  (enhanced)  │  │  ~/workspace/users/{id}/│ │
│  │             │  │              │  │  ├── TRADER_PROFILE.md  │ │
│  │  - Strategy │  │  - Trades    │  │  ├── BEHAVIORAL_*.md   │ │
│  │  - Concepts │  │  - Snapshots │  │  ├── RISK_WARNINGS.md  │ │
│  │  - Analysis │  │  - Metrics   │  │  └── ACTIVE_*.md       │ │
│  └─────────────┘  └──────────────┘  └─────────────────────────┘ │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Excel Upload Flow:
Excel File → Validation → PostgreSQL → Market Enrichment →
Behavioral Analysis → Markdown Generation → RAG Context

Chat Query Flow:
User Query → Load Markdown Context → Vector Search (VectorDB) →
PostgreSQL Query (if needed) → LLM Synthesis → Response
```

### Key Design Principles

1. **Hybrid Storage**: PostgreSQL (source of truth) + Markdown (LLM context)
2. **Smart Updates**: Markdown only regenerated on significant changes
3. **Account Isolation**: All data filtered by MT5 account to prevent contamination
4. **Market Context**: Every trade enriched with volatility regime from existing PostgreSQL
5. **Behavioral Focus**: Track psychology, not just performance
6. **Predictive Warnings**: Detect drift before major losses

---

## Database Schema Design

### PostgreSQL Schema Extensions

#### 1. MT5 Account Registry

```sql
CREATE TABLE mt5_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),

    -- MT5 identification
    account_number BIGINT NOT NULL,
    account_name VARCHAR(255),
    broker_name VARCHAR(255),
    account_type VARCHAR(50), -- 'demo', 'real', 'hedge'

    -- Account metadata
    registered_at TIMESTAMP DEFAULT NOW(),
    last_upload_at TIMESTAMP,
    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,

    -- Data quality tracking
    total_uploads INT DEFAULT 0,
    total_trades_recorded INT DEFAULT 0,
    earliest_trade_date DATE,
    latest_trade_date DATE,

    -- Constraints
    CONSTRAINT unique_user_account UNIQUE(user_id, account_number),

    -- Indexes
    INDEX idx_user_accounts (user_id, is_active),
    INDEX idx_account_number (account_number)
);

COMMENT ON TABLE mt5_accounts IS 'Registry of all MT5 trading accounts linked to users';
```

#### 2. Upload History & Validation

```sql
CREATE TABLE upload_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    mt5_account_id UUID NOT NULL REFERENCES mt5_accounts(id),

    -- File metadata
    upload_timestamp TIMESTAMP DEFAULT NOW(),
    file_name VARCHAR(255),
    file_hash VARCHAR(64) NOT NULL, -- SHA-256
    file_size_bytes BIGINT,

    -- Report metadata (extracted from Excel/Image)
    report_date DATE,
    report_account_number BIGINT,
    report_account_name VARCHAR(255),
    report_broker VARCHAR(255),

    -- Data coverage
    trades_in_file INT,
    date_range_start DATE,
    date_range_end DATE,

    -- Processing results
    new_trades_inserted INT DEFAULT 0,
    duplicate_trades_skipped INT DEFAULT 0,
    invalid_trades_rejected INT DEFAULT 0,

    -- Validation
    validation_status VARCHAR(50), -- 'pending', 'passed', 'warnings', 'failed'
    validation_errors JSONB,
    validation_warnings JSONB,

    processing_status VARCHAR(50), -- 'pending', 'processing', 'completed', 'failed'
    processed_at TIMESTAMP,

    -- Data quality flags
    has_overlapping_data BOOLEAN DEFAULT false,
    overlapping_upload_ids UUID[],
    has_inconsistencies BOOLEAN DEFAULT false,
    inconsistency_details JSONB,

    -- User actions
    user_confirmed BOOLEAN DEFAULT false,
    user_notes TEXT,

    -- Constraints
    CONSTRAINT unique_user_file_hash UNIQUE(user_id, file_hash),

    -- Indexes
    INDEX idx_user_upload (user_id, upload_timestamp),
    INDEX idx_account_upload (mt5_account_id, upload_timestamp),
    INDEX idx_processing_status (processing_status, upload_timestamp)
);

COMMENT ON TABLE upload_history IS 'Complete audit trail of all Excel uploads with validation results';
```

#### 3. Trade Executions with Provenance

```sql
CREATE TABLE trade_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    mt5_account_id UUID NOT NULL REFERENCES mt5_accounts(id),

    -- Unique trade identification
    ticket BIGINT NOT NULL,
    magic_number INT,
    open_time TIMESTAMP NOT NULL,

    -- Trade details
    symbol VARCHAR(20) NOT NULL,
    trade_type VARCHAR(10), -- 'buy', 'sell'
    volume DECIMAL(10, 2),

    -- Execution prices
    open_price DECIMAL(18, 5),
    close_time TIMESTAMP,
    close_price DECIMAL(18, 5),

    -- Risk management
    stop_loss DECIMAL(18, 5),
    take_profit DECIMAL(18, 5),

    -- Financial results
    commission DECIMAL(10, 2),
    swap DECIMAL(10, 2),
    profit DECIMAL(10, 2),

    -- Metadata
    comment TEXT,

    -- Data provenance
    first_seen_upload_id UUID REFERENCES upload_history(id),
    first_seen_at TIMESTAMP DEFAULT NOW(),
    seen_in_upload_ids UUID[],
    duplicate_count INT DEFAULT 1,

    -- Data quality
    is_valid BOOLEAN DEFAULT true,
    validation_notes TEXT,

    -- Soft delete
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMP,
    deleted_reason TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_trade UNIQUE(mt5_account_id, ticket, open_time),

    -- Indexes
    INDEX idx_user_trades (user_id, open_time),
    INDEX idx_account_trades (mt5_account_id, open_time),
    INDEX idx_symbol_time (symbol, open_time),
    INDEX idx_ticket (mt5_account_id, ticket),
    INDEX idx_close_time (close_time) WHERE close_time IS NULL
);

COMMENT ON TABLE trade_executions IS 'Complete trade execution history with deduplication tracking';
COMMENT ON COLUMN trade_executions.seen_in_upload_ids IS 'Array of upload_ids that reported this trade';
COMMENT ON COLUMN trade_executions.duplicate_count IS 'Number of times this trade appeared in uploads';
```

#### 4. Trade Market Context (Links to Existing OHLCV)

```sql
CREATE TABLE trade_market_context (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_id UUID NOT NULL REFERENCES trade_executions(id) ON DELETE CASCADE,

    -- Market condition at trade open
    symbol VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    timeframe VARCHAR(10) DEFAULT 'M15',

    -- Volatility metrics (from existing PostgreSQL OHLCV table)
    atr DECIMAL(18, 5),
    atr_percentage DECIMAL(10, 4),
    volatility_regime VARCHAR(20), -- 'low', 'normal', 'elevated', 'extreme'

    -- Trend metrics (from existing indicators)
    adx DECIMAL(5, 2),
    trend_strength VARCHAR(20), -- 'ranging', 'weak_trend', 'strong_trend'

    -- Volume
    volume_ratio DECIMAL(10, 4),

    -- Market phase
    market_phase VARCHAR(20), -- 'accumulation', 'markup', 'distribution', 'markdown'

    -- Commentary (from existing JSONB field)
    market_commentary TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),

    -- Indexes
    INDEX idx_trade_context (trade_id),
    INDEX idx_symbol_time (symbol, timestamp)
);

COMMENT ON TABLE trade_market_context IS 'Market conditions at trade execution time, enriched from existing OHLCV data';
```

#### 5. Performance Snapshots with Reconciliation

```sql
CREATE TABLE performance_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    mt5_account_id UUID NOT NULL REFERENCES mt5_accounts(id),
    upload_id UUID REFERENCES upload_history(id),

    -- Snapshot metadata
    snapshot_date DATE NOT NULL,
    period_start DATE,
    period_end DATE,

    -- Core metrics (from MT5 report)
    total_net_profit DECIMAL(10, 2),
    gross_profit DECIMAL(10, 2),
    gross_loss DECIMAL(10, 2),
    profit_factor DECIMAL(10, 2),
    recovery_factor DECIMAL(10, 2),
    sharpe_ratio DECIMAL(10, 4),
    expected_payoff DECIMAL(10, 2),

    -- Drawdown metrics
    balance_drawdown_absolute DECIMAL(10, 2),
    balance_drawdown_maximal DECIMAL(10, 2),
    balance_drawdown_relative DECIMAL(10, 4),
    balance_drawdown_maximal_percentage DECIMAL(10, 4),

    -- Trade statistics
    total_trades INT,
    short_trades_won_pct DECIMAL(5, 2),
    long_trades_won_pct DECIMAL(5, 2),
    profit_trades_pct DECIMAL(5, 2),
    loss_trades_pct DECIMAL(5, 2),

    largest_profit_trade DECIMAL(10, 2),
    largest_loss_trade DECIMAL(10, 2),
    average_profit_trade DECIMAL(10, 2),
    average_loss_trade DECIMAL(10, 2),

    -- Consecutive metrics
    maximum_consecutive_wins INT,
    maximum_consecutive_wins_amount DECIMAL(10, 2),
    maximum_consecutive_losses INT,
    maximum_consecutive_loss_amount DECIMAL(10, 2),

    maximal_consecutive_profit_count INT,
    maximal_consecutive_loss_count INT,

    average_consecutive_wins INT,
    average_consecutive_losses INT,

    -- Reconciliation with actual trades
    trades_count_reported INT,
    trades_count_actual INT,
    profit_reported DECIMAL(10, 2),
    profit_calculated DECIMAL(10, 2),

    reconciliation_status VARCHAR(50), -- 'matched', 'minor_diff', 'major_diff', 'failed'
    reconciliation_diff_pct DECIMAL(10, 4),
    reconciliation_notes TEXT,

    -- Data quality
    is_valid BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_account_snapshot UNIQUE(mt5_account_id, snapshot_date),

    -- Indexes
    INDEX idx_user_snapshots (user_id, snapshot_date),
    INDEX idx_account_snapshots (mt5_account_id, snapshot_date)
);

COMMENT ON TABLE performance_snapshots IS 'Historical performance metrics with reconciliation to trade data';
```

#### 6. Behavioral Metrics

```sql
CREATE TABLE behavioral_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    snapshot_id UUID REFERENCES performance_snapshots(id),
    upload_id UUID REFERENCES upload_history(id),
    mt5_account_id UUID NOT NULL REFERENCES mt5_accounts(id),

    -- Time period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Position sizing behavior
    avg_position_size DECIMAL(10, 4),
    position_size_std_dev DECIMAL(10, 4),
    max_position_size DECIMAL(10, 4),
    position_size_consistency_score DECIMAL(5, 2), -- 0-10

    -- Risk management behavior
    sl_usage_rate DECIMAL(5, 2), -- % of trades with SL
    tp_usage_rate DECIMAL(5, 2),
    avg_risk_reward_ratio DECIMAL(10, 4),
    avg_sl_distance_pct DECIMAL(5, 2),
    avg_tp_distance_pct DECIMAL(5, 2),

    -- Trading frequency
    trades_per_day DECIMAL(10, 2),
    avg_time_between_trades_hours DECIMAL(10, 2),

    -- Emotional indicators
    revenge_trade_rate DECIMAL(5, 2), -- % opened <15min after loss
    overtrade_after_loss_rate DECIMAL(5, 2),
    position_sizing_after_win_multiplier DECIMAL(5, 2),
    position_sizing_after_loss_multiplier DECIMAL(5, 2),

    -- Symbol preferences
    symbol_concentration_top3_pct DECIMAL(5, 2),
    symbol_diversity_count INT,
    primary_symbols TEXT[], -- Top 3 symbols

    -- Timing patterns
    preferred_trading_hours JSONB, -- {hour: count}
    preferred_trading_days JSONB, -- {day: count}

    -- Discipline scores (0-10)
    overall_discipline_score DECIMAL(5, 2),
    risk_management_score DECIMAL(5, 2),
    consistency_score DECIMAL(5, 2),

    -- Market regime performance
    performance_by_regime JSONB, -- {regime: {winRate, profitFactor, etc}}

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),

    -- Indexes
    INDEX idx_user_behavioral (user_id, period_end),
    INDEX idx_account_behavioral (mt5_account_id, period_end)
);

COMMENT ON TABLE behavioral_metrics IS 'Behavioral analysis metrics calculated from trade patterns';
COMMENT ON COLUMN behavioral_metrics.performance_by_regime IS 'Performance breakdown by volatility regime';
```

#### 7. Performance Trends Analysis

```sql
CREATE TABLE performance_trends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    mt5_account_id UUID NOT NULL REFERENCES mt5_accounts(id),

    -- Time window
    analysis_date DATE NOT NULL,
    lookback_period_days INT, -- 30, 60, 90, 180, 365

    -- Performance trends
    profit_trend VARCHAR(20), -- 'improving', 'stable', 'declining', 'volatile'
    winrate_trend VARCHAR(20),
    consistency_trend VARCHAR(20),
    drawdown_trend VARCHAR(20),

    -- Quantitative metrics
    profit_trend_slope DECIMAL(10, 4),
    winrate_change_pct DECIMAL(5, 2),

    -- Correlation analysis
    behavior_performance_correlation JSONB,

    -- Detected change points
    significant_changes JSONB,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),

    -- Indexes
    INDEX idx_user_trends (user_id, analysis_date),
    INDEX idx_lookback (lookback_period_days, analysis_date)
);

COMMENT ON TABLE performance_trends IS 'Longitudinal trend analysis across multiple time periods';
```

#### 8. Data Quality Audit Log

```sql
CREATE TABLE data_quality_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    upload_id UUID REFERENCES upload_history(id),
    mt5_account_id UUID REFERENCES mt5_accounts(id),

    check_timestamp TIMESTAMP DEFAULT NOW(),
    check_type VARCHAR(50), -- 'duplicate', 'overlap', 'inconsistency', 'reconciliation', 'cross_account'
    severity VARCHAR(20), -- 'info', 'warning', 'error', 'critical'

    issue_description TEXT,
    issue_details JSONB,

    -- Resolution
    resolution_status VARCHAR(50), -- 'pending', 'auto_resolved', 'user_resolved', 'ignored'
    resolution_action VARCHAR(100),
    resolved_at TIMESTAMP,
    resolved_by UUID,

    -- Indexes
    INDEX idx_user_quality (user_id, check_timestamp),
    INDEX idx_severity (severity, resolution_status),
    INDEX idx_check_type (check_type, check_timestamp)
);

COMMENT ON TABLE data_quality_log IS 'Comprehensive audit log for data quality issues and resolutions';
```

#### 9. Behavioral Drift Detection

```sql
CREATE TABLE behavioral_drift (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    mt5_account_id UUID NOT NULL REFERENCES mt5_accounts(id),

    -- Detection metadata
    detected_at TIMESTAMP DEFAULT NOW(),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Drift classification
    drift_type VARCHAR(50), -- 'temporary_anomaly', 'gradual_shift', 'major_change'
    severity VARCHAR(20), -- 'low', 'medium', 'high'

    -- Affected metrics
    affected_metrics TEXT[],

    -- Deviations
    deviations JSONB, -- [{metric, baseline, current, percentageChange, isSignificant}]

    -- Analysis
    possible_causes TEXT[],
    recommendations TEXT[],

    -- User action
    user_acknowledged BOOLEAN DEFAULT false,
    acknowledged_at TIMESTAMP,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),

    -- Indexes
    INDEX idx_user_drift (user_id, detected_at),
    INDEX idx_severity (severity, user_acknowledged)
);

COMMENT ON TABLE behavioral_drift IS 'Detected behavioral drift events with severity and recommendations';
```

#### 10. Baseline Metrics (Established Once)

```sql
CREATE TABLE trader_baseline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    mt5_account_id UUID NOT NULL REFERENCES mt5_accounts(id),

    -- Establishment metadata
    established_date DATE NOT NULL,
    data_points INT NOT NULL, -- Number of trades used
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Core baseline metrics (NEVER MODIFIED)
    baseline_win_rate DECIMAL(5, 2),
    baseline_profit_factor DECIMAL(10, 2),
    baseline_avg_hold_time_hours DECIMAL(10, 2),
    baseline_risk_per_trade_pct DECIMAL(5, 2),

    -- Preferences
    primary_symbols TEXT[],
    preferred_timeframes TEXT[],
    typical_trading_hours INT[],

    -- Risk signature
    avg_position_size DECIMAL(10, 4),
    sl_usage_rate DECIMAL(5, 2),
    avg_risk_reward DECIMAL(10, 4),

    -- Psychological markers
    max_consecutive_losses INT,
    recovery_pattern VARCHAR(50), -- 'aggressive', 'cautious', 'systematic'
    emotional_trading_markers JSONB,

    -- Regime-specific baselines
    baseline_by_regime JSONB, -- {regime: {winRate, profitFactor, disciplineScore}}

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_account_baseline UNIQUE(mt5_account_id),

    -- Indexes
    INDEX idx_user_baseline (user_id),
    INDEX idx_established_date (established_date)
);

COMMENT ON TABLE trader_baseline IS 'Sacred baseline established from first 50+ trades, never modified';
COMMENT ON COLUMN trader_baseline.baseline_by_regime IS 'Performance baselines for each market volatility regime';
```

### Database Functions & Views

#### View: Active Trades with Market Context

```sql
CREATE VIEW v_active_trades_with_context AS
SELECT
    te.*,
    tmc.volatility_regime,
    tmc.trend_strength,
    tmc.atr_percentage,
    tmc.market_phase,
    ma.account_number,
    ma.account_name
FROM trade_executions te
LEFT JOIN trade_market_context tmc ON te.id = tmc.trade_id
LEFT JOIN mt5_accounts ma ON te.mt5_account_id = ma.id
WHERE te.close_time IS NULL
  AND te.is_deleted = false
ORDER BY te.open_time DESC;

COMMENT ON VIEW v_active_trades_with_context IS 'All currently open trades with market context';
```

#### View: Latest Performance Snapshot per Account

```sql
CREATE VIEW v_latest_performance AS
SELECT DISTINCT ON (mt5_account_id)
    ps.*,
    ma.account_number,
    ma.account_name,
    ma.broker_name
FROM performance_snapshots ps
JOIN mt5_accounts ma ON ps.mt5_account_id = ma.id
WHERE ps.is_valid = true
ORDER BY mt5_account_id, snapshot_date DESC;

COMMENT ON VIEW v_latest_performance IS 'Most recent performance snapshot for each account';
```

#### Function: Calculate Market Regime from OHLCV

```sql
CREATE OR REPLACE FUNCTION calculate_volatility_regime(
    p_symbol VARCHAR(20),
    p_timestamp TIMESTAMP
) RETURNS VARCHAR(20) AS $$
DECLARE
    v_current_atr DECIMAL;
    v_avg_atr DECIMAL;
    v_atr_ratio DECIMAL;
BEGIN
    -- Get current ATR from existing OHLCV table
    SELECT atr INTO v_current_atr
    FROM ohlcv_15m  -- Your existing table
    WHERE symbol = p_symbol
      AND timestamp = p_timestamp;

    -- Get 20-period average ATR
    SELECT AVG(atr) INTO v_avg_atr
    FROM (
        SELECT atr
        FROM ohlcv_15m
        WHERE symbol = p_symbol
          AND timestamp <= p_timestamp
        ORDER BY timestamp DESC
        LIMIT 20
    ) sub;

    -- Calculate ratio
    v_atr_ratio := v_current_atr / NULLIF(v_avg_atr, 0);

    -- Classify regime
    IF v_atr_ratio < 0.7 THEN
        RETURN 'low';
    ELSIF v_atr_ratio < 1.3 THEN
        RETURN 'normal';
    ELSIF v_atr_ratio < 2.0 THEN
        RETURN 'elevated';
    ELSE
        RETURN 'extreme';
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_volatility_regime IS 'Determines volatility regime from existing OHLCV data';
```

---

## Markdown Knowledge Base Structure

### File System Organization

```
~/trading-workspace/
└── users/
    └── {user_id}/
        └── {mt5_account_id}/
            ├── static/                           [Updated Infrequently]
            │   ├── TRADER_PROFILE.md             (~3KB, quarterly)
            │   ├── BEHAVIORAL_REGIMES.md         (~2KB, on regime change)
            │   ├── PERFORMANCE_HISTORY.md        (~4KB, monthly)
            │   ├── BASELINE_METRICS.md           (~1KB, once)
            │   └── PREFERENCES.md                (~1KB, monthly)
            │
            ├── realtime/                         [Updated Every Upload]
            │   ├── ACTIVE_POSITIONS.md           (~2KB)
            │   ├── RISK_WARNINGS.md              (~2KB)
            │   ├── MARKET_CONTEXT.md             (~1KB)
            │   └── RECENT_INSIGHTS.md            (~2KB)
            │
            ├── journal/                          [Daily Logs]
            │   ├── 2026-01-31.md
            │   ├── 2026-02-01.md
            │   └── ...
            │
            └── metadata/                         [System Files]
                ├── last_updated.json
                ├── file_versions.json
                └── update_log.txt
```

### File Specifications

#### TRADER_PROFILE.md

**Purpose**: Core trader identity and behavioral characteristics  
**Size**: ~3KB (~750 tokens)  
**Update Frequency**: Quarterly or on major drift detection  
**Update Type**: Append (preserve history) or major revision

**Structure**:

```markdown
# TRADER PROFILE

**Account**: {account_number} ({account_name})  
**Profile Established**: {date}  
**Last Updated**: {date}

---

## Trading Identity

**Primary Symbols**: XAUUSD, EURUSD  
**Trading Style**: Swing trader, position hold 2-4 days  
**Risk Tolerance**: Moderate (1.5-2% per trade)  
**Experience Level**: Intermediate (2 years)

## Historical Baseline (Established {date} - NEVER MODIFIED)

Established from first 50 trades ({date_range}):

- **Win Rate**: 58.2%
- **Profit Factor**: 2.35
- **Avg Hold Time**: 52.3 hours
- **Avg Position Size**: 1.0 lots
- **SL Usage**: 92%
- **Avg Risk/Reward**: 1:1.8

### Baseline Performance by Market Regime

**Low Volatility** (ATR <0.7x):

- Win Rate: 54% | PF: 2.1 | Discipline: 8/10

**Normal Volatility** (ATR 0.7-1.3x):

- Win Rate: 62% | PF: 2.8 | Discipline: 9/10

**Elevated Volatility** (ATR 1.3-2.0x):

- Win Rate: 52% | PF: 1.9 | Discipline: 6/10

**Extreme Volatility** (ATR >2.0x):

- Win Rate: 45% | PF: 1.2 | Discipline: 4/10

## Current Behavioral State

**Discipline Score**: 7.5/10  
**Risk Management Score**: 8/10  
**Consistency Score**: 7/10

### Strengths

- Excellent risk management in normal conditions
- Patient trade entry, waits for confirmation
- Consistent position sizing

### Weaknesses

- Overconfidence after winning streaks (increases size 40%)
- Reduced stop loss usage in elevated volatility (75% vs 92% baseline)
- Revenge trading tendency after 3+ consecutive losses

## Behavioral Observations

### 2026-01-31: Overconfidence Pattern Detected

Recent 4-trade winning streak led to:

- Position sizing +40% (1.0 → 1.4 lots)
- SL usage dropped to 75%
- **Assessment**: Temporary emotional pattern
- **Recommendation**: Return to baseline sizing immediately

---

_This profile is generated from your actual trading data and updated periodically._
```

#### BEHAVIORAL_REGIMES.md

**Purpose**: Performance and behavior across market conditions  
**Size**: ~2KB (~500 tokens)  
**Update Frequency**: On market regime changes or quarterly  
**Update Type**: Update affected regime sections

**Structure**:

```markdown
# BEHAVIORAL REGIMES

Your performance and behavior vary significantly by market volatility. This analysis helps calibrate advice to current conditions.

---

## Low Volatility Performance (ATR <0.7x normal)

**Trade Count**: 127 trades  
**Win Rate**: 54.3% (Below your overall 58%)  
**Profit Factor**: 2.1  
**Avg Position Size**: 1.1 lots (10% above baseline)

### Behavioral Pattern

- Tendency to overtrade due to boredom (+30% trade frequency)
- Position sizing slightly aggressive
- Discipline score: 8/10 (good patience)

### Recommendations for Low Volatility

1. Reduce trade frequency - wait for stronger setups
2. Stick to 1.0 lot sizing (your baseline)
3. Widen stop losses (lower volatility = larger moves needed)
4. Consider wider take profits (1:2.5 R:R minimum)

### Historical Best Practices

Your best low-vol month (July 2025): 68% WR, PF 3.2

- Used 0.9-1.0 lots consistently
- Only 12 trades (selective)
- Average 3.8 days hold time

---

## Normal Volatility Performance (ATR 0.7-1.3x)

**Trade Count**: 285 trades  
**Win Rate**: 62.1% (Above baseline!)  
**Profit Factor**: 2.8  
**Avg Position Size**: 1.0 lots (Perfect consistency)

### Behavioral Pattern

- **This is your sweet spot** - best performance
- Excellent discipline (9/10)
- Consistent risk management
- Optimal trade frequency

### Recommendations for Normal Volatility

- Continue current approach - this is your proven strategy
- Maintain 1.0 lot sizing
- Keep SL usage >90%
- Target 1:1.8 to 1:2.2 R:R

---

## Elevated Volatility Performance (ATR 1.3-2.0x)

**Trade Count**: 89 trades  
**Win Rate**: 52.3% (Decline!)  
**Profit Factor**: 1.9  
**Avg Position Size**: 1.2 lots (20% TOO HIGH)

### Behavioral Pattern

⚠️ **Problem Zone** - Your discipline deteriorates:

- Position sizing increases (overconfidence)
- SL usage drops to 82%
- Trade frequency increases (+45%)
- Revenge trading rate: 18%

### Recommendations for Elevated Volatility

1. 🚨 **REDUCE position size to 0.7 lots maximum**
2. **Mandatory SL on every trade**
3. Widen stops to 1.5x normal distance
4. Reduce trade frequency by 50%
5. Take breaks after losses

### Warning Signs

When you see ATR spike >1.3x:

- Expect your win rate to drop ~10%
- Your emotional control declines
- Higher risk of revenge trading

---

## Extreme Volatility Performance (ATR >2.0x)

**Trade Count**: 34 trades  
**Win Rate**: 45.2% (DANGER ZONE)  
**Profit Factor**: 1.2  
**Avg Position Size**: 1.3 lots (30% TOO HIGH)

### Behavioral Pattern

🚨 **High Risk Zone** - Significant discipline breakdown:

- Discipline score: 4/10
- Overtrading: +85% frequency
- SL usage: 68% (critically low)
- Revenge trading: 28%

### Recommendations for Extreme Volatility

1. 🚨 **Consider sitting out entirely**
2. If trading: 0.5 lots MAXIMUM (50% reduction)
3. Mandatory SL ≥2x ATR away
4. Maximum 1 trade per day
5. No trading within 2 hours of major losses

### Your Worst Periods

Aug 2025 & Oct 2025 drawdowns both occurred in extreme volatility:

- Position sizing >1.5 lots
- Stopped using SLs consistently
- Rapid-fire trading after losses

**Key Insight**: Your historical data shows you should AVOID trading in extreme volatility or drastically reduce size.

---

_Current Market Regime: See MARKET_CONTEXT.md_
```

#### ACTIVE_POSITIONS.md

**Purpose**: Real-time open positions with risk assessment  
**Size**: ~2KB (~500 tokens)  
**Update Frequency**: Every upload (real-time)  
**Update Type**: Complete regeneration

**Structure**:

```markdown
# ACTIVE POSITIONS

**Total Open Positions**: 3  
**Total Exposure**: $4,250.00  
**Total Risk**: 4.2% of account

**Last Updated**: 2026-01-31 14:35:00 UTC

---

## XAUUSD - BUY 1.5 lots

**Entry**: 2,045.30 at 2026-01-30 09:15:00  
**Current P/L**: +$87.50 (+1.2%)  
**Stop Loss**: 2,038.50 (0.33% risk)  
**Take Profit**: 2,058.00 (1:2.0 R:R)

**Market Condition**: Elevated volatility (ATR 1.7x normal)  
**Days Held**: 1.2 days

⚠️ **CAUTION**: Position size 50% above your recommended size for elevated volatility (should be 0.7 lots, you have 1.5 lots)

---

## EURUSD - SELL 1.0 lots

**Entry**: 1.0850 at 2026-01-31 03:20:00  
**Current P/L**: -$15.00 (-0.2%)  
**Stop Loss**: 1.0875 (0.23% risk)  
**Take Profit**: 1.0800 (1:2.2 R:R)

**Market Condition**: Normal volatility  
**Days Held**: 0.5 days

✅ Position sizing appropriate for market conditions

---

## XAUUSD - BUY 1.0 lots

**Entry**: 2,048.75 at 2026-01-31 11:00:00  
**Current P/L**: -$22.50 (-0.3%)  
**Stop Loss**: NONE ⚠️  
**Take Profit**: 2,065.00

**Market Condition**: Elevated volatility  
**Days Held**: 0.1 days

🚨 **CRITICAL WARNING**: This position has NO STOP LOSS in elevated volatility! Your account is at significant risk.

**Immediate Action Required**:

1. Set stop loss at 2,041.00 immediately (0.38% risk)
2. This is your second XAUUSD position - you're overexposed to gold

---

## Risk Assessment Summary

🚨 **HIGH RISK DETECTED**:

- 1 position without stop loss (33% of positions)
- Total exposure 4.2% exceeds your 3% maximum
- 2 positions in same symbol (XAUUSD) = concentration risk
- 1 position oversized for market conditions (+114%)

✅ **Positive**:

- 2 of 3 positions have proper stop losses
- Risk/reward ratios are acceptable (1:2.0+)

**Recommended Actions**:

1. 🚨 **URGENT**: Set stop loss on XAUUSD #2 position immediately
2. Consider closing one XAUUSD position (reduce concentration)
3. Reduce XAUUSD #1 from 1.5 to 0.7 lots or close entirely

---

_This file updates automatically with each Excel upload_
```

#### RISK_WARNINGS.md

**Purpose**: Real-time behavioral and market warnings  
**Size**: ~2KB (~500 tokens)  
**Update Frequency**: Every upload (real-time)  
**Update Type**: Complete regeneration

**Structure**:

```markdown
# RISK WARNINGS

**Active Warnings**: 4  
**Critical**: 2 | **High**: 1 | **Medium**: 1 | **Low**: 0

**Last Updated**: 2026-01-31 14:35:00 UTC

---

## 🚨 CRITICAL WARNINGS

### 1. Excessive Position Sizing in Elevated Volatility

**Severity**: CRITICAL  
**Category**: Behavioral Drift + Market Risk

You are risking 85% more than appropriate for current market conditions.

**Evidence**:

- Current market: XAUUSD in elevated volatility (ATR 1.7x normal)
- Your recent position size: 1.5 lots
- Recommended for elevated markets: 0.7 lots
- Your baseline (normal markets): 1.0 lots
- Historical pattern: When you exceed recommended sizing in elevated volatility, your profit factor drops to 1.2 vs 2.8 normal

**Immediate Actions Required**:

1. 🚨 Reduce XAUUSD position to 0.7 lots or close entirely
2. Set maximum position size to 0.7 lots until volatility normalizes (ATR <1.3x)
3. No new positions until exposure <3% of account
4. Review BEHAVIORAL_REGIMES.md for elevated volatility guidelines

**Historical Context**:
Your last 2 major drawdowns (Aug & Oct 2025) both started with this exact pattern:

- Elevated volatility
- Position sizing >1.3 lots
- Reduced stop loss discipline

---

### 2. Position Without Stop Loss in High Volatility

**Severity**: CRITICAL  
**Category**: Risk Management

XAUUSD position opened at 2,048.75 has NO STOP LOSS while market is in elevated volatility.

**Risk Exposure**:

- Without SL, a 2% adverse move = -$200 loss (-2% of account)
- In elevated volatility, 2% moves can happen in minutes
- Your historical worst single trade: -$137.50 (happened in elevated volatility without SL)

**Immediate Actions Required**:

1. 🚨 Set stop loss at 2,041.00 immediately (0.38% risk, 1.5x ATR distance)
2. Enable mandatory SL rule in your trading platform if possible
3. Review your SL discipline: currently 75% vs 92% baseline

**Your Historical Data**:

- When SL usage drops below 80%, your drawdown risk increases 3-5%
- Your best performing periods: 92-95% SL usage

---

## ⚠️ HIGH PRIORITY WARNINGS

### 3. Overconfidence Pattern After Winning Streak

**Category**: Behavioral Drift

You've just completed a 4-trade winning streak and are showing classic overconfidence signs.

**Evidence**:

- Position sizing increased 40% (1.0 → 1.4 lots average)
- Trade frequency up 65% (5 trades in 2 days vs baseline 1.2 trades/day)
- SL usage dropped from 92% to 75%
- This is your 3rd time exhibiting this pattern (previous: Mar & Aug 2025)

**What Happened Previously**:

- March 2025: 5-win streak → increased sizing → 4 consecutive losses → 8.5% drawdown
- August 2025: 6-win streak → stopped using SLs → 12.8% drawdown

**Recommendations**:

1. Take 48 hours off from trading (your data shows better trades after breaks)
2. Reset to 1.0 lot baseline position sizing
3. Mandatory SL on all trades
4. Limit to 1 trade per day for next week

**Key Insight**: Your best monthly performance (November 2025, PF 2.8) came when discipline was high, not when you were "hot".

---

## ⚡ MEDIUM PRIORITY

### 4. Symbol Concentration Risk

**Category**: Position Risk

66% of your current exposure is in XAUUSD (2 positions). Historical data shows your XAUUSD positions are correlated 85%.

**Recommendations**:

- Close one XAUUSD position
- Maximum 1 position per symbol going forward
- Diversify to EURUSD or other uncorrelated symbols

---

## ✅ ALL CLEAR ZONES

**What's Working**:

- Trade timing is good (consistent with your optimal hours)
- Risk/reward ratios are appropriate (1:2.0+)
- No revenge trading detected (last loss was >4 hours ago)

---

## Historical Warning Effectiveness

When you've heeded critical warnings:

- **Avoided losses**: 7 out of 9 times
- **Average drawdown prevented**: 6.3%

When you've ignored critical warnings:

- **Resulted in significant drawdown**: 4 out of 5 times
- **Average drawdown**: 11.2%

**Message**: These warnings are based on YOUR historical data - they work.

---

_Warnings automatically generated from behavioral analysis and market conditions_
```

#### MARKET_CONTEXT.md

**Purpose**: Current market conditions for all traded symbols  
**Size**: ~1KB (~250 tokens)  
**Update Frequency**: Every upload or market change  
**Update Type**: Complete regeneration

**Structure**:

```markdown
# MARKET CONTEXT

Current market conditions for your symbols based on real-time data from your RAG system's PostgreSQL OHLCV database.

**Last Updated**: 2026-01-31 14:35:00 UTC

---

## XAUUSD (Gold)

**Current State**: ELEVATED VOLATILITY ⚠️

- **Price**: 2,051.25
- **ATR**: 24.50 (1.7x normal)
- **Volatility Regime**: Elevated (20-period ATR avg: 14.35)
- **Trend**: Strong uptrend (ADX: 32)
- **Volume**: 1.4x average

**Your Performance in This Condition**:

- Historical win rate: 52% (vs 62% in normal)
- Recommended position size: 0.7 lots (vs your 1.0 baseline)
- Discipline typically drops to 6/10

**Recent Commentary** (from existing RAG):
"Gold showing strong bullish momentum amid Fed rate speculation. Volatility elevated due to NFP data release. Expect continued high volatility through Friday."

**Recommendation**:
⚠️ Reduce position sizing. This is NOT your optimal trading environment based on historical data.

---

## EURUSD (Euro)

**Current State**: NORMAL VOLATILITY ✅

- **Price**: 1.0835
- **ATR**: 0.0085 (0.9x normal)
- **Volatility Regime**: Normal
- **Trend**: Weak downtrend (ADX: 18)
- **Volume**: 1.0x average

**Your Performance in This Condition**:

- Historical win rate: 62% (your sweet spot!)
- Recommended position size: 1.0 lots (baseline)
- Expected discipline: 9/10

**Recent Commentary**:
"EUR consolidating near support. ECB minutes showed dovish tone. Range-bound price action expected."

**Recommendation**:
✅ Ideal conditions for your trading style. This is where you perform best.

---

## BTCUSD (Bitcoin)

**Current State**: EXTREME VOLATILITY 🚨

- **Price**: 42,850
- **ATR**: 1,250 (2.3x normal)
- **Volatility Regime**: EXTREME
- **Trend**: No clear trend (ADX: 12)
- **Volume**: 2.1x average

**Your Performance in This Condition**:

- Historical win rate: 45% (DANGER ZONE)
- Historical profit factor: 1.2
- Your discipline drops to 4/10 in extreme volatility

**Recommendation**:
🚨 AVOID TRADING. Your historical data strongly suggests sitting out extreme volatility or using 0.5 lot maximum.

---

## Market Regime Summary

| Symbol | Regime   | Your Historical Performance | Recommendation            |
| ------ | -------- | --------------------------- | ------------------------- |
| XAUUSD | Elevated | 52% WR, PF 1.9              | Reduce size (0.7 lots)    |
| EURUSD | Normal   | 62% WR, PF 2.8              | Trade normally (1.0 lots) |
| BTCUSD | Extreme  | 45% WR, PF 1.2              | Avoid or 0.5 lots max     |

**Overall Assessment**: Mixed conditions. Stick to EURUSD (your strength), reduce XAUUSD sizing, avoid BTCUSD.

---

_Market context integrated from your existing RAG system's PostgreSQL OHLCV database_
```

### Update Frequency Matrix

| File                   | Update Frequency   | Trigger                   | Size | Tokens |
| ---------------------- | ------------------ | ------------------------- | ---- | ------ |
| TRADER_PROFILE.md      | Quarterly or drift | ≥90 days or major drift   | 3KB  | ~750   |
| BEHAVIORAL_REGIMES.md  | On regime change   | Market regime shift       | 2KB  | ~500   |
| PERFORMANCE_HISTORY.md | Monthly            | 30 days                   | 4KB  | ~1000  |
| BASELINE_METRICS.md    | Once               | First 50 trades           | 1KB  | ~250   |
| PREFERENCES.md         | Monthly            | 30 days or pattern change | 1KB  | ~250   |
| ACTIVE_POSITIONS.md    | Every upload       | Real-time                 | 2KB  | ~500   |
| RISK_WARNINGS.md       | Every upload       | Real-time                 | 2KB  | ~500   |
| MARKET_CONTEXT.md      | Every upload       | Real-time                 | 1KB  | ~250   |
| RECENT_INSIGHTS.md     | Weekly             | 7 days                    | 2KB  | ~500   |

**Total Context for LLM**: ~18KB = ~4,500 tokens (vs 50,000+ if loading raw database)

---

## Upload Portal Design

### Frontend Component

```typescript
// UploadPortal.tsx

import { useState } from 'react';
import { Upload, AlertCircle, CheckCircle, Info } from 'lucide-react';

interface ValidationResult {
    isValid: boolean;
    errors: Array<{type: string; message: string; severity: string}>;
    warnings: Array<{type: string; message: string; recommendation: string}>;
    accountIssues: Array<{type: string; recommendation: string}>;
    deduplicationSummary: {
        totalTrades: number;
        newTrades: number;
        duplicates: number;
        modified: number;
    };
}

export function UploadPortal() {
    const [file, setFile] = useState<File | null>(null);
    const [reportImage, setReportImage] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [validation, setValidation] = useState<ValidationResult | null>(null);

    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('excel', file);
        if (reportImage) formData.append('report', reportImage);

        try {
            const response = await fetch('/api/upload/mt5-history', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();
            setValidation(result);

            if (result.isValid) {
                // Success - show summary
                alert(`Upload successful! ${result.deduplicationSummary.newTrades} new trades added.`);
                // Trigger knowledge base regeneration
                await fetch('/api/knowledge-base/regenerate', { method: 'POST' });
            }
        } catch (error) {
            console.error('Upload failed:', error);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="upload-portal">
            <h2>Upload MT5 Trading History</h2>

            {/* File upload areas */}
            <div className="upload-section">
                <label>
                    <Upload /> Excel File (Trading History)
                    <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                </label>

                <label>
                    <Upload /> Performance Report (Optional)
                    <input
                        type="file"
                        accept=".png,.jpg,.jpeg"
                        onChange={(e) => setReportImage(e.target.files?.[0] || null)}
                    />
                </label>
            </div>

            {/* Upload button */}
            <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="upload-btn"
            >
                {uploading ? 'Processing...' : 'Upload & Analyze'}
            </button>

            {/* Validation results */}
            {validation && (
                <div className="validation-results">
                    {/* Errors */}
                    {validation.errors.length > 0 && (
                        <div className="errors">
                            <AlertCircle /> Errors
                            {validation.errors.map((err, i) => (
                                <div key={i} className="error-item">
                                    <strong>{err.type}</strong>: {err.message}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Warnings */}
                    {validation.warnings.length > 0 && (
                        <div className="warnings">
                            <Info /> Warnings
                            {validation.warnings.map((warn, i) => (
                                <div key={i} className="warning-item">
                                    <strong>{warn.type}</strong>: {warn.message}
                                    <p className="recommendation">{warn.recommendation}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Summary */}
                    {validation.isValid && (
                        <div className="summary">
                            <CheckCircle /> Upload Successful
                            <p>Total trades: {validation.deduplicationSummary.totalTrades}</p>
                            <p>New trades: {validation.deduplicationSummary.newTrades}</p>
                            <p>Duplicates skipped: {validation.deduplicationSummary.duplicates}</p>
                            <p>Trades updated: {validation.deduplicationSummary.modified}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Instructions */}
            <div className="instructions">
                <h3>How to Download Your Trading History from MT5</h3>
                <ol>
                    <li>Open MetaTrader 5 terminal</li>
                    <li>Go to "View" → "Toolbox" → "History" tab</li>
                    <li>Right-click in the History area → "All history"</li>
                    <li>Right-click again → "Report" → "Open XML"</li>
                    <li>Save the file and upload it here</li>
                </ol>

                <h3>Optional: Performance Report Screenshot</h3>
                <p>You can also upload a screenshot of your MT5 performance report for better validation.</p>
            </div>
        </div>
    );
}
```

### Backend Upload API

```typescript
// API Route: POST /api/upload/mt5-history

import { Request, Response } from 'express';
import multer from 'multer';
import { processUploadWithValidation } from './processors/upload-processor';
import { updateKnowledgeBase } from './generators/knowledge-base-generator';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

export async function handleMT5Upload(req: Request, res: Response) {
  try {
    const userId = req.user.id; // From auth middleware
    const excelFile = req.files['excel']?.[0];
    const reportImage = req.files['report']?.[0];

    if (!excelFile) {
      return res.status(400).json({ error: 'Excel file required' });
    }

    // PHASE 1: Validate and process upload
    const validationResult = await processUploadWithValidation(
      userId,
      excelFile,
      reportImage
    );

    // PHASE 2: If valid, update knowledge base
    if (
      validationResult.isValid &&
      validationResult.deduplicationSummary.newTrades > 0
    ) {
      await updateKnowledgeBase(userId, validationResult.mt5AccountId);
    }

    // PHASE 3: Return validation results
    res.json(validationResult);
  } catch (error) {
    console.error('Upload processing error:', error);
    res.status(500).json({
      error: 'Upload processing failed',
      details: error.message,
    });
  }
}

// Route registration
app.post(
  '/api/upload/mt5-history',
  authenticateUser,
  upload.fields([
    { name: 'excel', maxCount: 1 },
    { name: 'report', maxCount: 1 },
  ]),
  handleMT5Upload
);
```

---

## Data Processing Pipeline

### Complete Upload-to-Knowledge Flow

```typescript
// processors/upload-processor.ts

interface UploadProcessingResult {
  uploadId: string;
  mt5AccountId: string;
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  accountIssues: AccountIssue[];
  deduplicationSummary: DeduplicationSummary;
  performanceSnapshot?: PerformanceSnapshot;
  behavioralMetrics?: BehavioralMetrics;
  warnings: RiskWarning[];
}

export async function processUploadWithValidation(
  userId: string,
  excelFile: File,
  reportImage?: File
): Promise<UploadProcessingResult> {
  // ============================================
  // PHASE 1: PRE-PROCESSING VALIDATION
  // ============================================

  console.log('[PHASE 1] Starting pre-processing validation...');

  // Step 1.1: Check file hash (prevent exact duplicate)
  const fileHash = await calculateSHA256(excelFile);
  const existingUpload = await checkDuplicateUpload(userId, fileHash);

  if (existingUpload) {
    return {
      isValid: false,
      errors: [
        {
          type: 'exact_duplicate',
          message: 'This exact file has already been uploaded',
          severity: 'error',
          details: existingUpload,
        },
      ],
      warnings: [],
      accountIssues: [],
      deduplicationSummary: {
        totalTrades: 0,
        newTrades: 0,
        duplicates: 0,
        modified: 0,
      },
    };
  }

  // Step 1.2: Parse Excel and extract metadata
  const trades = await parseM5History(excelFile);
  const reportMetadata = await extractReportMetadata(excelFile, reportImage);

  if (trades.length === 0) {
    return {
      isValid: false,
      errors: [
        {
          type: 'empty_file',
          message: 'No trades found in uploaded file',
          severity: 'error',
        },
      ],
      warnings: [],
      accountIssues: [],
      deduplicationSummary: {
        totalTrades: 0,
        newTrades: 0,
        duplicates: 0,
        modified: 0,
      },
    };
  }

  console.log(`[PHASE 1] Parsed ${trades.length} trades from Excel`);

  // Step 1.3: Validate account identification
  const accountValidation = await validateAccountIdentification(
    userId,
    reportMetadata,
    trades
  );

  if (!accountValidation.isValid) {
    return {
      isValid: false,
      errors: accountValidation.errors,
      warnings: accountValidation.warnings,
      accountIssues: accountValidation.issues,
      deduplicationSummary: {
        totalTrades: 0,
        newTrades: 0,
        duplicates: 0,
        modified: 0,
      },
    };
  }

  const mt5AccountId = accountValidation.accountId;
  console.log(`[PHASE 1] Validated account: ${mt5AccountId}`);

  // ============================================
  // PHASE 2: CREATE UPLOAD RECORD
  // ============================================

  console.log('[PHASE 2] Creating upload record...');

  const uploadId = await createUploadRecord(
    userId,
    mt5AccountId,
    excelFile,
    reportMetadata,
    trades
  );

  // ============================================
  // PHASE 3: DETECT OVERLAPS & DEDUPLICATE
  // ============================================

  console.log('[PHASE 3] Detecting overlaps and deduplicating trades...');

  const overlappingUploads = await detectTemporalOverlap(mt5AccountId, trades);

  if (overlappingUploads.length > 0) {
    console.log(
      `[PHASE 3] Found ${overlappingUploads.length} overlapping uploads`
    );
  }

  const deduplicationResults = await deduplicateTrades(
    userId,
    mt5AccountId,
    uploadId,
    trades
  );

  console.log(
    `[PHASE 3] Deduplication: ${deduplicationResults.summary.newTrades} new, ${deduplicationResults.summary.duplicates} duplicates`
  );

  // ============================================
  // PHASE 4: ENRICH WITH MARKET CONTEXT
  // ============================================

  console.log('[PHASE 4] Enriching trades with market context...');

  await enrichTradesWithMarketContext(
    userId,
    deduplicationResults.newTrades,
    mt5AccountId
  );

  console.log(
    `[PHASE 4] Enriched ${deduplicationResults.newTrades.length} trades with market context`
  );

  // ============================================
  // PHASE 5: STORE PERFORMANCE SNAPSHOT
  // ============================================

  console.log('[PHASE 5] Storing performance snapshot...');

  const performanceSnapshot = await storePerformanceSnapshot(
    userId,
    mt5AccountId,
    uploadId,
    reportMetadata.performanceMetrics
  );

  // ============================================
  // PHASE 6: CALCULATE BEHAVIORAL METRICS
  // ============================================

  console.log('[PHASE 6] Calculating behavioral metrics...');

  const behavioralMetrics = await calculateBehavioralMetrics(
    userId,
    mt5AccountId,
    uploadId,
    deduplicationResults.newTrades
  );

  // ============================================
  // PHASE 7: DETECT BEHAVIORAL DRIFT
  // ============================================

  console.log('[PHASE 7] Detecting behavioral drift...');

  const drift = await detectBehavioralDrift(
    userId,
    mt5AccountId,
    behavioralMetrics
  );

  if (drift) {
    console.log(
      `[PHASE 7] Drift detected: ${drift.driftType}, severity: ${drift.severity}`
    );
  }

  // ============================================
  // PHASE 8: GENERATE RISK WARNINGS
  // ============================================

  console.log('[PHASE 8] Generating risk warnings...');

  const warnings = await generateRiskWarnings(
    userId,
    mt5AccountId,
    deduplicationResults.newTrades,
    behavioralMetrics,
    drift
  );

  console.log(
    `[PHASE 8] Generated ${warnings.length} warnings (${warnings.filter((w) => w.severity === 'critical').length} critical)`
  );

  // ============================================
  // PHASE 9: UPDATE UPLOAD STATUS
  // ============================================

  await updateUploadStatus(uploadId, 'completed', deduplicationResults.summary);

  console.log('[PHASE 9] Upload processing completed successfully');

  // ============================================
  // RETURN RESULTS
  // ============================================

  return {
    uploadId,
    mt5AccountId,
    isValid: true,
    errors: [],
    warnings:
      overlappingUploads.length > 0
        ? [
            {
              type: 'temporal_overlap',
              message: `This upload overlaps with ${overlappingUploads.length} previous upload(s)`,
              recommendation:
                'Trades from overlapping periods were deduplicated automatically',
            },
          ]
        : [],
    accountIssues: [],
    deduplicationSummary: deduplicationResults.summary,
    performanceSnapshot,
    behavioralMetrics,
    warnings,
  };
}
```

### Market Context Enrichment

```typescript
// processors/market-context-enricher.ts

async function enrichTradesWithMarketContext(
  userId: string,
  trades: MT5Trade[],
  mt5AccountId: string
): Promise<void> {
  for (const trade of trades) {
    // Query existing PostgreSQL OHLCV table for market data
    const marketData = await db.query(
      `
            SELECT 
                atr,
                adx,
                volume,
                close,
                high,
                low
            FROM ohlcv_15m  -- Your existing table
            WHERE symbol = $1
            AND timestamp <= $2
            ORDER BY timestamp DESC
            LIMIT 20
        `,
      [trade.symbol, trade.openTime]
    );

    if (marketData.rows.length === 0) {
      console.warn(
        `No market data found for ${trade.symbol} at ${trade.openTime}`
      );
      continue;
    }

    const currentBar = marketData.rows[0];
    const historicalBars = marketData.rows;

    // Calculate volatility regime
    const avgATR =
      historicalBars.reduce((sum, bar) => sum + bar.atr, 0) /
      historicalBars.length;
    const atrRatio = currentBar.atr / avgATR;

    let volatilityRegime: string;
    if (atrRatio < 0.7) volatilityRegime = 'low';
    else if (atrRatio < 1.3) volatilityRegime = 'normal';
    else if (atrRatio < 2.0) volatilityRegime = 'elevated';
    else volatilityRegime = 'extreme';

    // Calculate trend strength
    let trendStrength: string;
    if (currentBar.adx < 20) trendStrength = 'ranging';
    else if (currentBar.adx < 40) trendStrength = 'weak_trend';
    else trendStrength = 'strong_trend';

    // Calculate volume ratio
    const avgVolume =
      historicalBars.reduce((sum, bar) => sum + bar.volume, 0) /
      historicalBars.length;
    const volumeRatio = currentBar.volume / avgVolume;

    // Determine market phase (simplified)
    const priceChange =
      (currentBar.close - historicalBars[historicalBars.length - 1].close) /
      historicalBars[historicalBars.length - 1].close;
    let marketPhase: string;
    if (currentBar.adx < 20 && Math.abs(priceChange) < 0.01)
      marketPhase = 'accumulation';
    else if (priceChange > 0.02 && currentBar.adx > 25) marketPhase = 'markup';
    else if (currentBar.adx < 20 && currentBar.close > historicalBars[0].close)
      marketPhase = 'distribution';
    else marketPhase = 'markdown';

    // Get commentary from existing JSONB field (if exists)
    const commentary = await db.query(
      `
            SELECT commentary
            FROM ohlcv_15m
            WHERE symbol = $1
            AND timestamp = $2
        `,
      [trade.symbol, trade.openTime]
    );

    // Insert market context
    await db.query(
      `
            INSERT INTO trade_market_context (
                id, trade_id, symbol, timestamp,
                atr, atr_percentage, volatility_regime,
                adx, trend_strength,
                volume_ratio, market_phase,
                market_commentary
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `,
      [
        generateUUID(),
        trade.id,
        trade.symbol,
        trade.openTime,
        currentBar.atr,
        (atrRatio - 1) * 100, // ATR as % of normal
        volatilityRegime,
        currentBar.adx,
        trendStrength,
        volumeRatio,
        marketPhase,
        commentary.rows[0]?.commentary || null,
      ]
    );
  }
}
```

### Behavioral Metrics Calculator

```typescript
// processors/behavioral-calculator.ts

interface BehavioralMetrics {
  overall_discipline_score: number;
  risk_management_score: number;
  consistency_score: number;
  sl_usage_rate: number;
  avg_position_size: number;
  revenge_trade_rate: number;
  performance_by_regime: Record<string, any>;
  // ... other metrics
}

async function calculateBehavioralMetrics(
  userId: string,
  mt5AccountId: string,
  uploadId: string,
  trades: MT5Trade[]
): Promise<BehavioralMetrics> {
  // Get all trades with market context
  const tradesWithContext = await db.query(
    `
        SELECT 
            te.*,
            tmc.volatility_regime,
            tmc.trend_strength
        FROM trade_executions te
        LEFT JOIN trade_market_context tmc ON te.id = tmc.trade_id
        WHERE te.mt5_account_id = $1
        AND te.is_deleted = false
        ORDER BY te.open_time ASC
    `,
    [mt5AccountId]
  );

  const allTrades = tradesWithContext.rows;

  // Calculate position sizing metrics
  const positionSizes = allTrades.map((t) => t.volume);
  const avgPositionSize =
    positionSizes.reduce((a, b) => a + b, 0) / positionSizes.length;
  const positionSizeStdDev = calculateStdDev(positionSizes);

  // Calculate SL usage
  const tradesWithSL = allTrades.filter(
    (t) => t.stop_loss !== null && t.stop_loss !== 0
  );
  const slUsageRate = (tradesWithSL.length / allTrades.length) * 100;

  // Calculate TP usage
  const tradesWithTP = allTrades.filter(
    (t) => t.take_profit !== null && t.take_profit !== 0
  );
  const tpUsageRate = (tradesWithTP.length / allTrades.length) * 100;

  // Calculate risk/reward ratios
  const rrRatios = allTrades
    .filter((t) => t.stop_loss && t.take_profit)
    .map((t) => {
      const risk = Math.abs(t.open_price - t.stop_loss);
      const reward = Math.abs(t.take_profit - t.open_price);
      return reward / risk;
    });
  const avgRiskReward =
    rrRatios.length > 0
      ? rrRatios.reduce((a, b) => a + b, 0) / rrRatios.length
      : 0;

  // Calculate trading frequency
  const tradingDays =
    (allTrades[allTrades.length - 1].open_time - allTrades[0].open_time) /
    (1000 * 60 * 60 * 24);
  const tradesPerDay = allTrades.length / tradingDays;

  // Detect revenge trading
  let revengeTradeCount = 0;
  for (let i = 1; i < allTrades.length; i++) {
    const prevTrade = allTrades[i - 1];
    const currentTrade = allTrades[i];

    const timeDiff =
      (currentTrade.open_time - prevTrade.close_time) / (1000 * 60); // minutes

    if (prevTrade.profit < 0 && timeDiff < 15) {
      revengeTradeCount++;
    }
  }
  const revengeTradeRate = (revengeTradeCount / allTrades.length) * 100;

  // Calculate position sizing after wins/losses
  let sizeAfterWin: number[] = [];
  let sizeAfterLoss: number[] = [];

  for (let i = 1; i < allTrades.length; i++) {
    const prevTrade = allTrades[i - 1];
    const currentTrade = allTrades[i];

    if (prevTrade.profit > 0) {
      sizeAfterWin.push(currentTrade.volume);
    } else if (prevTrade.profit < 0) {
      sizeAfterLoss.push(currentTrade.volume);
    }
  }

  const avgSizeAfterWin =
    sizeAfterWin.length > 0
      ? sizeAfterWin.reduce((a, b) => a + b, 0) / sizeAfterWin.length
      : avgPositionSize;
  const avgSizeAfterLoss =
    sizeAfterLoss.length > 0
      ? sizeAfterLoss.reduce((a, b) => a + b, 0) / sizeAfterLoss.length
      : avgPositionSize;

  // Calculate symbol concentration
  const symbolCounts = allTrades.reduce(
    (acc, t) => {
      acc[t.symbol] = (acc[t.symbol] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const top3Symbols = Object.entries(symbolCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const top3Count = top3Symbols.reduce((sum, [_, count]) => sum + count, 0);
  const symbolConcentration = (top3Count / allTrades.length) * 100;

  // Calculate performance by regime
  const regimeGroups = groupBy(
    allTrades,
    (t) => t.volatility_regime || 'unknown'
  );
  const performanceByRegime: Record<string, any> = {};

  for (const [regime, trades] of Object.entries(regimeGroups)) {
    const winningTrades = trades.filter((t) => t.profit > 0);
    performanceByRegime[regime] = {
      tradeCount: trades.length,
      winRate: (winningTrades.length / trades.length) * 100,
      totalProfit: trades.reduce((sum, t) => sum + t.profit, 0),
      avgPositionSize:
        trades.reduce((sum, t) => sum + t.volume, 0) / trades.length,
      slUsage: (trades.filter((t) => t.stop_loss).length / trades.length) * 100,
    };
  }

  // Calculate discipline scores
  const riskManagementScore = calculateRiskManagementScore({
    slUsageRate,
    tpUsageRate,
    avgRiskReward,
  });

  const consistencyScore = calculateConsistencyScore({
    positionSizeStdDev,
    avgPositionSize,
    tradesPerDay,
  });

  const overallDisciplineScore = (riskManagementScore + consistencyScore) / 2;

  // Store in database
  await db.query(
    `
        INSERT INTO behavioral_metrics (
            id, user_id, mt5_account_id, upload_id,
            period_start, period_end,
            avg_position_size, position_size_std_dev,
            sl_usage_rate, tp_usage_rate, avg_risk_reward_ratio,
            trades_per_day, revenge_trade_rate,
            position_sizing_after_win_multiplier, position_sizing_after_loss_multiplier,
            symbol_concentration_top3_pct, symbol_diversity_count,
            overall_discipline_score, risk_management_score, consistency_score,
            performance_by_regime
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
        )
    `,
    [
      generateUUID(),
      userId,
      mt5AccountId,
      uploadId,
      allTrades[0].open_time,
      allTrades[allTrades.length - 1].close_time ||
        allTrades[allTrades.length - 1].open_time,
      avgPositionSize,
      positionSizeStdDev,
      slUsageRate,
      tpUsageRate,
      avgRiskReward,
      tradesPerDay,
      revengeTradeRate,
      avgSizeAfterWin / avgPositionSize,
      avgSizeAfterLoss / avgPositionSize,
      symbolConcentration,
      Object.keys(symbolCounts).length,
      overallDisciplineScore,
      riskManagementScore,
      consistencyScore,
      JSON.stringify(performanceByRegime),
    ]
  );

  return {
    overall_discipline_score: overallDisciplineScore,
    risk_management_score: riskManagementScore,
    consistency_score: consistencyScore,
    sl_usage_rate: slUsageRate,
    avg_position_size: avgPositionSize,
    revenge_trade_rate: revengeTradeRate,
    performance_by_regime: performanceByRegime,
  };
}

function calculateRiskManagementScore(metrics: {
  slUsageRate: number;
  tpUsageRate: number;
  avgRiskReward: number;
}): number {
  let score = 0;

  // SL usage (40% of score)
  if (metrics.slUsageRate >= 90) score += 4;
  else if (metrics.slUsageRate >= 75) score += 3;
  else if (metrics.slUsageRate >= 60) score += 2;
  else if (metrics.slUsageRate >= 40) score += 1;

  // TP usage (30% of score)
  if (metrics.tpUsageRate >= 80) score += 3;
  else if (metrics.tpUsageRate >= 60) score += 2;
  else if (metrics.tpUsageRate >= 40) score += 1;

  // Risk/Reward ratio (30% of score)
  if (metrics.avgRiskReward >= 2.0) score += 3;
  else if (metrics.avgRiskReward >= 1.5) score += 2;
  else if (metrics.avgRiskReward >= 1.0) score += 1;

  return score;
}

function calculateConsistencyScore(metrics: {
  positionSizeStdDev: number;
  avgPositionSize: number;
  tradesPerDay: number;
}): number {
  let score = 0;

  // Position size consistency (60% of score)
  const coefficientOfVariation =
    (metrics.positionSizeStdDev / metrics.avgPositionSize) * 100;
  if (coefficientOfVariation < 10) score += 6;
  else if (coefficientOfVariation < 20) score += 4;
  else if (coefficientOfVariation < 30) score += 2;

  // Trade frequency consistency (40% of score)
  if (metrics.tradesPerDay >= 0.8 && metrics.tradesPerDay <= 2.0)
    score += 4; // Ideal range
  else if (metrics.tradesPerDay >= 0.5 && metrics.tradesPerDay <= 3.0)
    score += 2;

  return score;
}
```

---

## RAG Enhancement Architecture

### Integration with Existing RAG System

```typescript
// rag/enhanced-orchestrator.ts

interface RAGContext {
  userMarkdown: string[]; // From markdown files
  vectorResults: any[]; // From existing VectorDB
  databaseResults: any[]; // From PostgreSQL queries
  marketContext: any; // Current market conditions
}

async function enhancedRAGQuery(
  userId: string,
  mt5AccountId: string,
  query: string
): Promise<string> {
  // ============================================
  // PHASE 1: LOAD MARKDOWN CONTEXT
  // ============================================

  const workspaceDir = `/home/trading-workspace/users/${userId}/${mt5AccountId}`;

  const markdownFiles = [
    'static/TRADER_PROFILE.md',
    'static/BEHAVIORAL_REGIMES.md',
    'realtime/ACTIVE_POSITIONS.md',
    'realtime/RISK_WARNINGS.md',
    'realtime/MARKET_CONTEXT.md',
  ];

  const markdownContext: string[] = [];
  for (const file of markdownFiles) {
    try {
      const content = await fs.readFile(`${workspaceDir}/${file}`, 'utf-8');
      markdownContext.push(content);
    } catch (e) {
      console.warn(`Markdown file ${file} not found`);
    }
  }

  // ============================================
  // PHASE 2: EXISTING VECTOR SEARCH
  // ============================================

  // Use existing VectorDB for general trading knowledge
  const vectorResults = await existingVectorDB.search(query, {
    topK: 5,
    filters: { category: ['strategy', 'analysis', 'concepts'] },
  });

  // ============================================
  // PHASE 3: CONDITIONAL DATABASE QUERY
  // ============================================

  let databaseResults: any[] = [];

  // Detect if query needs deep data analysis
  if (requiresDeepAnalysis(query)) {
    databaseResults = await queryDatabaseForAnalysis(
      userId,
      mt5AccountId,
      query
    );
  }

  // ============================================
  // PHASE 4: GET CURRENT MARKET CONDITIONS
  // ============================================

  const marketContext = await getCurrentMarketSnapshot();

  // ============================================
  // PHASE 5: ORCHESTRATE LLM CALL
  // ============================================

  const systemPrompt = buildEnhancedSystemPrompt(
    markdownContext,
    vectorResults,
    marketContext
  );

  const userPrompt =
    databaseResults.length > 0
      ? `${query}\n\nAdditional Analysis:\n${JSON.stringify(databaseResults, null, 2)}`
      : query;

  const response = await llm.call({
    model: 'claude-opus-4',
    systemPrompt,
    userPrompt,
    maxTokens: 2000,
  });

  return response.content;
}

function buildEnhancedSystemPrompt(
  markdownContext: string[],
  vectorResults: any[],
  marketContext: any
): string {
  return `You are an expert trading coach with complete knowledge of this trader's history and current state.

## Trader-Specific Knowledge (From Markdown Files)

${markdownContext.join('\n\n---\n\n')}

## General Trading Knowledge (From Vector Database)

${vectorResults.map((r) => r.content).join('\n\n')}

## Current Market Conditions

${JSON.stringify(marketContext, null, 2)}

---

## Your Role

1. **Risk Management First**: If RISK_WARNINGS.md shows critical warnings, address them immediately
2. **Personalized Advice**: Base all recommendations on THIS trader's proven patterns from TRADER_PROFILE.md
3. **Context-Aware**: Adjust advice for current market volatility from MARKET_CONTEXT.md
4. **Regime-Specific**: Reference BEHAVIORAL_REGIMES.md for performance in current conditions
5. **Actionable**: Give specific, concrete recommendations

## Response Guidelines

- Address critical warnings first, always
- Compare current behavior to baseline metrics
- Use "you" and speak directly
- Be concise but substantive
- Reference specific data points from the knowledge base
- Never give generic advice - always personalize

Current time: ${new Date().toISOString()}`;
}

function requiresDeepAnalysis(query: string): boolean {
  const deepAnalysisKeywords = [
    'analyze',
    'show me',
    'calculate',
    'compare',
    'trend',
    'performance',
    'all my trades',
    'history',
    'correlation',
  ];

  const queryLower = query.toLowerCase();
  return deepAnalysisKeywords.some((keyword) => queryLower.includes(keyword));
}

async function queryDatabaseForAnalysis(
  userId: string,
  mt5AccountId: string,
  query: string
): Promise<any[]> {
  // Parse query intent and build SQL
  // This would be more sophisticated in production

  if (query.includes('XAUUSD')) {
    // Query XAUUSD specific performance
    const result = await db.query(
      `
            SELECT 
                COUNT(*) as trade_count,
                AVG(CASE WHEN profit > 0 THEN 1 ELSE 0 END) * 100 as win_rate,
                SUM(profit) as total_profit,
                AVG(volume) as avg_position_size
            FROM trade_executions
            WHERE mt5_account_id = $1
            AND symbol = 'XAUUSD'
            AND is_deleted = false
        `,
      [mt5AccountId]
    );

    return result.rows;
  }

  // Add more query patterns as needed

  return [];
}
```

### Query Classification & Routing

```typescript
// rag/query-router.ts

interface QueryIntent {
  type:
    | 'risk_check'
    | 'performance_analysis'
    | 'advice'
    | 'historical_lookup'
    | 'market_conditions';
  requiresDatabase: boolean;
  requiresVectorSearch: boolean;
  urgency: 'critical' | 'high' | 'normal';
}

function classifyQuery(query: string): QueryIntent {
  const queryLower = query.toLowerCase();

  // Critical risk-related queries
  if (
    queryLower.includes('warning') ||
    queryLower.includes('risk') ||
    queryLower.includes('should i close') ||
    queryLower.includes('danger')
  ) {
    return {
      type: 'risk_check',
      requiresDatabase: false, // Use markdown warnings
      requiresVectorSearch: false,
      urgency: 'critical',
    };
  }

  // Performance analysis queries
  if (
    queryLower.includes('performance') ||
    queryLower.includes('how am i doing') ||
    queryLower.includes('analyze my') ||
    queryLower.includes('my results')
  ) {
    return {
      type: 'performance_analysis',
      requiresDatabase: true, // Need deep data
      requiresVectorSearch: false,
      urgency: 'normal',
    };
  }

  // Historical lookup
  if (
    queryLower.includes('show me') ||
    queryLower.includes('find my') ||
    queryLower.includes('all my trades') ||
    queryLower.includes('when did i')
  ) {
    return {
      type: 'historical_lookup',
      requiresDatabase: true,
      requiresVectorSearch: false,
      urgency: 'normal',
    };
  }

  // Market conditions
  if (
    queryLower.includes('market') ||
    queryLower.includes('volatility') ||
    queryLower.includes('current conditions')
  ) {
    return {
      type: 'market_conditions',
      requiresDatabase: false, // Use markdown + live data
      requiresVectorSearch: false,
      urgency: 'normal',
    };
  }

  // Default: trading advice
  return {
    type: 'advice',
    requiresDatabase: false,
    requiresVectorSearch: true, // General trading knowledge
    urgency: 'normal',
  };
}
```

---

## API Specifications

### Core API Endpoints

```typescript
// API Routes Summary

// ============================================
// UPLOAD & PROCESSING
// ============================================

POST /api/upload/mt5-history
Body: multipart/form-data (excel file, optional report image)
Response: UploadValidationResult
Description: Upload and process MT5 trading history

GET /api/upload/history
Response: UploadHistory[]
Description: Get user's upload history with validation status

DELETE /api/upload/:uploadId
Response: { success: boolean }
Description: Delete an upload and its associated trades

// ============================================
// ACCOUNTS
// ============================================

GET /api/accounts
Response: MT5Account[]
Description: List all user's MT5 accounts

POST /api/accounts/:accountId/set-primary
Response: { success: boolean }
Description: Set an account as primary

GET /api/accounts/:accountId/stats
Response: AccountStats
Description: Get account statistics and data quality info

// ============================================
// KNOWLEDGE BASE
// ============================================

GET /api/knowledge-base/files
Response: { files: string[], lastUpdated: Date }
Description: List available markdown files

GET /api/knowledge-base/file/:fileName
Response: { content: string, metadata: any }
Description: Get specific markdown file content

POST /api/knowledge-base/regenerate
Body: { accountId?: string, files?: string[] }
Response: { regenerated: string[], timestamp: Date }
Description: Manually trigger markdown regeneration

// ============================================
// CHAT & RAG
// ============================================

POST /api/chat
Body: { message: string, accountId?: string }
Response: { response: string, sources: any[] }
Description: Enhanced RAG chat with trader-specific context

POST /api/chat/analyze
Body: { query: string, accountId?: string }
Response: { analysis: any, visualizations?: any }
Description: Deep analysis queries with database access

// ============================================
// PERFORMANCE & METRICS
// ============================================

GET /api/performance/snapshots
Query: { accountId?, limit?, from?, to? }
Response: PerformanceSnapshot[]
Description: Get performance snapshots with filters

GET /api/performance/trends
Query: { accountId?, lookbackDays? }
Response: PerformanceTrends
Description: Get trend analysis for specified period

GET /api/behavioral/metrics
Query: { accountId?, period? }
Response: BehavioralMetrics
Description: Get behavioral analysis metrics

GET /api/behavioral/drift
Query: { accountId? }
Response: BehavioralDrift[]
Description: Get detected behavioral drift events

// ============================================
// RISK & WARNINGS
// ============================================

GET /api/warnings/active
Query: { accountId? }
Response: RiskWarning[]
Description: Get current active warnings

POST /api/warnings/:warningId/acknowledge
Response: { success: boolean }
Description: Acknowledge a warning

GET /api/positions/active
Query: { accountId? }
Response: ActivePosition[]
Description: Get current open positions with context

// ============================================
// DATA QUALITY
// ============================================

GET /api/data-quality/issues
Query: { accountId?, severity?, status? }
Response: DataQualityIssue[]
Description: Get data quality issues and resolutions

POST /api/data-quality/:issueId/resolve
Body: { action: string, notes?: string }
Response: { success: boolean }
Description: Resolve a data quality issue

// ============================================
// ANALYTICS
// ============================================

GET /api/analytics/baseline
Query: { accountId }
Response: TraderBaseline
Description: Get trader baseline metrics

GET /api/analytics/regime-performance
Query: { accountId, regime? }
Response: RegimePerformance[]
Description: Get performance breakdown by market regime

GET /api/analytics/correlation
Query: { accountId, metric1, metric2 }
Response: CorrelationAnalysis
Description: Analyze correlation between behavior and performance
```

### Detailed Endpoint Example

```typescript
// api/endpoints/chat-endpoint.ts

/**
 * POST /api/chat
 *
 * Enhanced RAG chat with full trader context
 */
export async function handleChat(req: Request, res: Response) {
  try {
    const { message, accountId } = req.body;
    const userId = req.user.id;

    // Determine which account to use
    const mt5AccountId = accountId || (await getPrimaryAccount(userId));

    if (!mt5AccountId) {
      return res.status(400).json({
        error: 'No MT5 account found. Please upload trading history first.',
      });
    }

    // Classify query
    const intent = classifyQuery(message);

    // Handle critical risk queries immediately
    if (intent.urgency === 'critical') {
      const warnings = await getActiveWarnings(userId, mt5AccountId);
      const criticalWarnings = warnings.filter(
        (w) => w.severity === 'critical'
      );

      if (criticalWarnings.length > 0) {
        // Prepend critical warnings to response
        const warningText = criticalWarnings
          .map((w) => `🚨 CRITICAL: ${w.title}\n${w.description}`)
          .join('\n\n');

        // Still process query but emphasize warnings
        message = `CRITICAL WARNINGS ACTIVE:\n${warningText}\n\nUser Query: ${message}`;
      }
    }

    // Execute enhanced RAG query
    const response = await enhancedRAGQuery(userId, mt5AccountId, message);

    // Log conversation for future reference
    await logConversation(userId, mt5AccountId, message, response);

    res.json({
      response,
      intent: intent.type,
      accountId: mt5AccountId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Chat processing failed' });
  }
}
```

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

**Goal**: Database schema + basic upload processing

**Tasks**:

1. ✅ Create all PostgreSQL tables
2. ✅ Implement file upload API endpoint
3. ✅ Build Excel parser for MT5 format
4. ✅ Implement basic validation (file hash, account identification)
5. ✅ Create account registry system
6. ✅ Test with sample MT5 data

**Deliverables**:

- Working database schema
- Upload API that accepts Excel files
- Basic account management
- Unit tests for parsers

**Success Criteria**:

- Can upload Excel file without errors
- Trades are stored in database correctly
- Duplicate uploads are detected

---

### Phase 2: Data Quality (Weeks 3-4)

**Goal**: Comprehensive validation + deduplication

**Tasks**:

1. ✅ Implement deduplication logic (composite keys)
2. ✅ Build temporal overlap detection
3. ✅ Create performance reconciliation
4. ✅ Implement cross-account contamination checks
5. ✅ Build data quality logging system
6. ✅ Create user-facing validation reports

**Deliverables**:

- Complete deduplication system
- Data quality dashboard
- Validation report UI component
- Integration tests

**Success Criteria**:

- Duplicate trades are correctly identified
- Overlapping uploads handled properly
- Performance metrics match trade data within 5%

---

### Phase 3: Market Context Integration (Weeks 5-6)

**Goal**: Link trades to existing OHLCV data

**Tasks**:

1. ✅ Create trade_market_context table
2. ✅ Build market regime calculator function
3. ✅ Implement volatility classification
4. ✅ Connect to existing PostgreSQL OHLCV table
5. ✅ Enrich all trades with market data
6. ✅ Test regime detection accuracy

**Deliverables**:

- Market context enrichment pipeline
- Volatility regime classification
- Integration with existing RAG PostgreSQL

**Success Criteria**:

- 95%+ trades have market context
- Regime classification matches manual review
- Can query trades by volatility regime

---

### Phase 4: Behavioral Analysis (Weeks 7-8)

**Goal**: Calculate metrics + detect drift

**Tasks**:

1. ✅ Implement behavioral metrics calculator
2. ✅ Build baseline establishment logic
3. ✅ Create drift detection algorithm
4. ✅ Implement regime-specific analysis
5. ✅ Build performance correlation system
6. ✅ Test with historical data

**Deliverables**:

- Behavioral metrics system
- Drift detection engine
- Baseline metrics (one-time calculation)
- Regime performance analysis

**Success Criteria**:

- Baseline established correctly from first 50 trades
- Drift detection identifies known issues
- Regime-specific metrics calculated accurately

---

### Phase 5: Markdown Generation (Weeks 9-10)

**Goal**: Auto-generate knowledge base files

**Tasks**:

1. ✅ Build markdown file system structure
2. ✅ Create LLM prompts for each file type
3. ✅ Implement markdown generators
4. ✅ Build update decision logic
5. ✅ Create file versioning system
6. ✅ Test markdown quality

**Deliverables**:

- Complete markdown file system
- LLM-based generators for all file types
- Update logic based on triggers
- Version control for markdown

**Success Criteria**:

- Markdown files generated automatically on upload
- Files are human-readable and accurate
- Update logic works correctly (quarterly, real-time, etc.)

---

### Phase 6: RAG Integration (Weeks 11-12)

**Goal**: Integrate with existing RAG system

**Tasks**:

1. ✅ Build enhanced RAG orchestrator
2. ✅ Implement query classification
3. ✅ Create markdown context loader
4. ✅ Integrate with existing VectorDB
5. ✅ Build conditional database queries
6. ✅ Test full RAG pipeline

**Deliverables**:

- Enhanced RAG orchestrator
- Query routing system
- Full integration with existing RAG
- End-to-end chat tests

**Success Criteria**:

- Chat responses include trader-specific context
- Query routing works correctly
- Response quality is personalized
- Token usage is optimized

---

### Phase 7: Risk Warning System (Weeks 13-14)

**Goal**: Real-time warnings + notifications

**Tasks**:

1. ✅ Build warning generation logic
2. ✅ Implement severity classification
3. ✅ Create RISK_WARNINGS.md generator
4. ✅ Build notification system
5. ✅ Create warning acknowledgment flow
6. ✅ Test warning accuracy

**Deliverables**:

- Risk warning engine
- Warning notification system
- User acknowledgment UI
- Historical warning effectiveness tracking

**Success Criteria**:

- Critical warnings detected accurately
- Notifications sent appropriately
- Warning recommendations are actionable

---

### Phase 8: UI & Polish (Weeks 15-16)

**Goal**: Production-ready interface

**Tasks**:

1. ✅ Build upload portal UI
2. ✅ Create account management interface
3. ✅ Build data quality dashboard
4. ✅ Implement performance visualizations
5. ✅ Create warning alerts in chat
6. ✅ User testing + refinement

**Deliverables**:

- Complete upload portal
- Account management dashboard
- Data quality interface
- Performance charts
- Production-ready UI

**Success Criteria**:

- Users can upload and manage data easily
- Warnings are prominently displayed
- Performance data is visualized clearly

---

## Code Examples

### Complete Upload Processing Example

```typescript
// Example: Complete flow from upload to markdown generation

import { processUploadWithValidation } from './processors/upload-processor';
import { updateKnowledgeBase } from './generators/knowledge-base-generator';

async function completeUploadFlow(
  userId: string,
  excelFile: File,
  reportImage?: File
) {
  console.log('=== STARTING UPLOAD PROCESSING ===');

  // PHASE 1: Process and validate upload
  const result = await processUploadWithValidation(
    userId,
    excelFile,
    reportImage
  );

  console.log('Validation result:', {
    isValid: result.isValid,
    newTrades: result.deduplicationSummary.newTrades,
    warnings: result.warnings.length,
  });

  if (!result.isValid) {
    console.error('Upload validation failed:', result.errors);
    return result;
  }

  // PHASE 2: Update knowledge base (if significant new data)
  if (result.deduplicationSummary.newTrades >= 10) {
    console.log('Updating knowledge base...');
    await updateKnowledgeBase(userId, result.mt5AccountId);
  }

  // PHASE 3: Send notifications for critical warnings
  const criticalWarnings = result.warnings.filter(
    (w) => w.severity === 'critical'
  );
  if (criticalWarnings.length > 0) {
    console.log(
      `Sending notification for ${criticalWarnings.length} critical warnings`
    );
    await sendUserNotification(userId, {
      title: '🚨 Critical Risk Warning',
      message: `${criticalWarnings.length} critical issue(s) detected. Review immediately.`,
      link: `/warnings`,
    });
  }

  console.log('=== UPLOAD PROCESSING COMPLETE ===');
  return result;
}

// Usage
const result = await completeUploadFlow(
  'user-123',
  uploadedFile,
  reportScreenshot
);
```

### Markdown Generation Example

```typescript
// Example: Generate TRADER_PROFILE.md

import { callLLM } from './llm-client';

async function generateTraderProfile(
  userId: string,
  mt5AccountId: string
): Promise<void> {
  // Query database for comprehensive data
  const baseline = await getTraderBaseline(mt5AccountId);
  const recentMetrics = await getRecentBehavioralMetrics(mt5AccountId);
  const driftHistory = await getBehavioralDriftHistory(mt5AccountId);

  // Build LLM prompt
  const prompt = `Generate a comprehensive trader profile.

## Baseline Metrics (SACRED - Never Modified)
${JSON.stringify(baseline, null, 2)}

## Recent Behavioral Metrics
${JSON.stringify(recentMetrics, null, 2)}

## Drift History
${driftHistory.map((d) => `- ${d.detected_at}: ${d.drift_type} (${d.severity})`).join('\n')}

Create a markdown file following this structure:

# TRADER PROFILE

## Trading Identity
[Primary symbols, trading style, risk tolerance, experience]

## Historical Baseline (Established {date} - NEVER MODIFIED)
[All baseline metrics - preserve forever]

### Baseline Performance by Market Regime
[Performance in each volatility regime]

## Current Behavioral State
[Current discipline scores and characteristics]

### Strengths
[What's working well]

### Weaknesses
[Areas for improvement]

## Behavioral Observations
[Any drift events or recent patterns]

Keep under 3000 tokens. Write in 2nd person ("You are..."). Be data-driven.`;

  const response = await callLLM({
    model: 'claude-sonnet-4',
    systemPrompt: 'You are a quantitative trading analyst.',
    userPrompt: prompt,
    maxTokens: 3000,
  });

  // Save to file
  const filePath = `/home/trading-workspace/users/${userId}/${mt5AccountId}/static/TRADER_PROFILE.md`;
  await fs.writeFile(filePath, response.content);

  // Update metadata
  await updateFileMetadata(userId, mt5AccountId, 'TRADER_PROFILE.md', {
    lastUpdated: new Date(),
    tokenCount: response.usage.total_tokens,
    version: await getNextVersion('TRADER_PROFILE.md'),
  });

  console.log(
    `Generated TRADER_PROFILE.md (${response.content.length} chars, ${response.usage.total_tokens} tokens)`
  );
}
```

### Enhanced RAG Query Example

```typescript
// Example: Complete RAG query with trader context

async function enhancedRAGQueryExample(userId: string, query: string) {
  // Load markdown context
  const markdownContext = await loadMarkdownContext(userId);

  // Existing vector search
  const vectorResults = await vectorDB.search(query, { topK: 5 });

  // Build enhanced system prompt
  const systemPrompt = `You are a trading coach with complete trader knowledge.

## Trader Profile
${markdownContext.traderProfile}

## Current Warnings
${markdownContext.riskWarnings}

## Active Positions
${markdownContext.activePositions}

## Market Conditions
${markdownContext.marketContext}

Address critical warnings first. Base all advice on THIS trader's proven patterns.`;

  // Call LLM
  const response = await callLLM({
    model: 'claude-opus-4',
    systemPrompt,
    userPrompt: query,
    maxTokens: 2000,
  });

  return response.content;
}

// Usage
const answer = await enhancedRAGQueryExample(
  'user-123',
  'Should I increase my position size on this XAUUSD setup?'
);

// Example response:
// "⚠️ Before we discuss position sizing, I need to address a CRITICAL WARNING:
//
// You currently have XAUUSD in ELEVATED VOLATILITY (ATR 1.7x normal). Your
// historical data shows:
// - Win rate drops to 52% in elevated volatility (vs 62% normal)
// - Your discipline score typically drops to 6/10
// - Recommended size: 0.7 lots (vs your 1.0 baseline)
//
// Your last major drawdown (Aug 2025) started exactly like this - elevated
// volatility + increased position sizing.
//
// Answer: NO, reduce your position size to 0.7 lots or wait for volatility
// to normalize. Your data is clear on this."
```

---

## Testing Strategy

### Unit Tests

```typescript
// tests/deduplication.test.ts

describe('Trade Deduplication', () => {
  test('identifies exact duplicate trades', async () => {
    const trade1 = createMockTrade({
      ticket: 12345,
      openTime: '2026-01-15T10:00:00Z',
    });
    const trade2 = createMockTrade({
      ticket: 12345,
      openTime: '2026-01-15T10:00:00Z',
    });

    await insertTrade(trade1);
    const result = await deduplicateTrades([trade2]);

    expect(result.summary.duplicates).toBe(1);
    expect(result.summary.newTrades).toBe(0);
  });

  test('detects trade updates (open → closed)', async () => {
    const openTrade = createMockTrade({
      ticket: 12345,
      closeTime: null,
      closePrice: null,
    });
    const closedTrade = createMockTrade({
      ticket: 12345,
      closeTime: '2026-01-16T15:00:00Z',
      closePrice: 2050.25,
      profit: 125.5,
    });

    await insertTrade(openTrade);
    const result = await deduplicateTrades([closedTrade]);

    expect(result.summary.modified).toBe(1);
    expect(result.modified[0].changes).toContain('close_time');
  });
});

// tests/market-context.test.ts

describe('Market Context Enrichment', () => {
  test('calculates volatility regime correctly', async () => {
    const mockOHLCV = createMockOHLCVData({
      atr: 18.5,
      avgATR: 14.2,
    });

    await insertOHLCVData(mockOHLCV);

    const regime = await calculateVolatilityRegime(
      'XAUUSD',
      '2026-01-31T10:00:00Z'
    );

    expect(regime).toBe('elevated'); // 18.5 / 14.2 = 1.3x
  });
});

// tests/behavioral-metrics.test.ts

describe('Behavioral Metrics Calculation', () => {
  test('calculates discipline score correctly', async () => {
    const trades = [
      createMockTrade({ stopLoss: 2040, profit: 50 }),
      createMockTrade({ stopLoss: 2045, profit: -20 }),
      createMockTrade({ stopLoss: null, profit: 30 }), // No SL
    ];

    const metrics = await calculateBehavioralMetrics(trades);

    expect(metrics.sl_usage_rate).toBe(66.67); // 2 out of 3
    expect(metrics.risk_management_score).toBeLessThan(7); // Penalized for missing SL
  });
});
```

### Integration Tests

```typescript
// tests/integration/upload-flow.test.ts

describe('Complete Upload Flow', () => {
  test('processes valid upload end-to-end', async () => {
    const testFile = loadTestFile('mt5_history_sample.xlsx');
    const userId = 'test-user-123';

    // Execute full upload flow
    const result = await completeUploadFlow(userId, testFile);

    // Verify database records
    const trades = await db.query(
      'SELECT COUNT(*) FROM trade_executions WHERE user_id = $1',
      [userId]
    );
    expect(trades.rows[0].count).toBeGreaterThan(0);

    // Verify markdown files generated
    const profileExists = await fs.access(
      `/home/trading-workspace/users/${userId}/static/TRADER_PROFILE.md`
    );
    expect(profileExists).toBe(true);

    // Verify warnings generated if needed
    const warnings = await getActiveWarnings(userId);
    expect(warnings).toBeDefined();
  });

  test('handles duplicate upload correctly', async () => {
    const testFile = loadTestFile('mt5_history_sample.xlsx');
    const userId = 'test-user-123';

    // Upload once
    await completeUploadFlow(userId, testFile);

    // Upload same file again
    const result = await completeUploadFlow(userId, testFile);

    expect(result.errors[0].type).toBe('exact_duplicate');
    expect(result.isValid).toBe(false);
  });
});

// tests/integration/rag-query.test.ts

describe('Enhanced RAG Query', () => {
  test('includes trader context in response', async () => {
    const userId = 'test-user-123';
    const query = 'What position size should I use?';

    // Setup: Ensure markdown files exist
    await setupTestMarkdownFiles(userId);

    // Execute query
    const response = await enhancedRAGQuery(userId, query);

    // Verify response mentions trader-specific data
    expect(response).toContain('your baseline'); // References baseline
    expect(response).toContain('1.0 lots'); // Specific size
    expect(response.length).toBeGreaterThan(100);
  });

  test('prioritizes critical warnings', async () => {
    const userId = 'test-user-123';

    // Setup: Create critical warning
    await createTestWarning(userId, { severity: 'critical' });

    const response = await enhancedRAGQuery(userId, 'Should I trade?');

    // Response should address warning first
    expect(response).toMatch(/^(⚠️|🚨)/); // Starts with warning emoji
    expect(response.toLowerCase()).toContain('critical');
  });
});
```

### Performance Tests

```typescript
// tests/performance/token-usage.test.ts

describe('Token Usage Optimization', () => {
  test('markdown context uses <5000 tokens', async () => {
    const userId = 'test-user-123';
    await setupCompleteMarkdownFiles(userId);

    const context = await loadMarkdownContext(userId);
    const allMarkdown = Object.values(context).join('\n\n');

    const tokenCount = estimateTokens(allMarkdown);

    expect(tokenCount).toBeLessThan(5000);
    console.log(`Markdown context: ${tokenCount} tokens`);
  });

  test('database query alternative would use 10x more tokens', async () => {
    const userId = 'test-user-123';

    // Get all trades as JSON (alternative to markdown)
    const trades = await getAllTrades(userId);
    const tradesJSON = JSON.stringify(trades);
    const tradesTokens = estimateTokens(tradesJSON);

    // Get markdown equivalent
    const markdown = await loadMarkdownContext(userId);
    const markdownTokens = estimateTokens(Object.values(markdown).join('\n'));

    const ratio = tradesTokens / markdownTokens;

    expect(ratio).toBeGreaterThan(10);
    console.log(`Token savings: ${ratio.toFixed(1)}x`);
  });
});

// tests/performance/upload-speed.test.ts

describe('Upload Processing Speed', () => {
  test('processes 100 trades in <5 seconds', async () => {
    const testFile = generateLargeTestFile(100); // 100 trades
    const userId = 'test-user-123';

    const startTime = Date.now();
    await completeUploadFlow(userId, testFile);
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(5000); // 5 seconds
    console.log(`Processed 100 trades in ${duration}ms`);
  });
});
```

---

## Migration from Existing System

### Step-by-Step Migration Plan

**Step 1: Database Setup**

```sql
-- Run all schema creation scripts
\i schema/01_accounts.sql
\i schema/02_uploads.sql
\i schema/03_trades.sql
-- ... etc
```

**Step 2: Integrate with Existing Tables**

```sql
-- Verify existing OHLCV table structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ohlcv_15m';

-- Create link between new tables and existing OHLCV
-- (Already done via trade_market_context table)
```

**Step 3: Deploy Upload API**

```bash
# Add new routes to existing Express app
# Update API documentation
# Deploy to staging environment
```

**Step 4: Test with Sample Data**

```typescript
// Use actual MT5 sample file
const sampleFile = await fetchSampleMT5Data();
await testCompleteFlow(sampleFile);
```

**Step 5: Gradual Rollout**

- Phase 1: Internal testing (1 week)
- Phase 2: Beta users (2 weeks)
- Phase 3: Full rollout

---

## Maintenance & Monitoring

### Key Metrics to Track

1. **Upload Success Rate**: % of uploads that complete without errors
2. **Data Quality Score**: Average quality score across all uploads
3. **Deduplication Rate**: % of trades identified as duplicates
4. **Markdown Update Frequency**: How often each file type updates
5. **Warning Effectiveness**: % of warnings that prevent losses
6. **Token Usage**: Average tokens per chat query
7. **Query Response Time**: P50, P95, P99 response times
8. **User Engagement**: Active users, uploads per user, chat volume

### Monitoring Dashboard

```typescript
// Example monitoring queries

// Upload success rate (last 7 days)
SELECT
    COUNT(*) FILTER (WHERE processing_status = 'completed') * 100.0 / COUNT(*) as success_rate
FROM upload_history
WHERE upload_timestamp >= NOW() - INTERVAL '7 days';

// Average data quality score
SELECT
    AVG(
        CASE validation_status
            WHEN 'passed' THEN 100
            WHEN 'warnings' THEN 75
            WHEN 'failed' THEN 0
        END
    ) as avg_quality_score
FROM upload_history
WHERE upload_timestamp >= NOW() - INTERVAL '7 days';

// Warning effectiveness (warnings that prevented losses)
SELECT
    COUNT(*) FILTER (WHERE user_acknowledged = true AND severity = 'critical') as acknowledged,
    COUNT(*) FILTER (WHERE severity = 'critical') as total_critical
FROM behavioral_drift
WHERE detected_at >= NOW() - INTERVAL '30 days';
```

---

## Conclusion

This architecture provides a comprehensive blueprint for integrating MT5 trading data into your existing RAG system. Key features:

✅ **Complete data pipeline**: Excel upload → PostgreSQL → Markdown → RAG  
✅ **Data quality assurance**: Validation, deduplication, reconciliation  
✅ **Behavioral intelligence**: Drift detection, regime analysis, warnings  
✅ **Token optimization**: 93% reduction via markdown caching  
✅ **Market integration**: Links to existing OHLCV database  
✅ **Scalable architecture**: Handles multiple accounts, unlimited trades  
✅ **Production-ready**: Complete testing strategy, monitoring, APIs

The system transforms generic trading advice into personalized, data-driven coaching based on each trader's proven patterns and current market conditions.

---

**Next Steps for Implementation**:

1. Review this document with development team
2. Set up development environment with PostgreSQL extensions
3. Begin Phase 1 implementation (database + basic upload)
4. Iterate through phases with continuous testing
5. Deploy to staging for user testing
6. Roll out to production

**Questions for Claude Code Implementation**:

- Any clarifications needed on database schema?
- Preference for LLM provider (Anthropic, OpenAI, etc.)?
- Existing code structure we should match?
- Deployment environment (AWS, GCP, Azure)?
