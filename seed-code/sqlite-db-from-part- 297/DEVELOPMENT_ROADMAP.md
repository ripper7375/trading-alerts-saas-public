# Project Development Roadmap

## Multi-Indicator Confluence Analysis System

**Version:** 1.0
**Date:** 2025-11-22
**Related:** See [ARCHITECTURE.md](ARCHITECTURE.md) for system design
**Status:** Planning Phase

---

## Table of Contents

1. [Overview](#overview)
2. [Timeline Summary](#timeline-summary)
3. [Phase Breakdown](#phase-breakdown)
4. [Milestone Checklist](#milestone-checklist)
5. [Quick Start MVP](#quick-start-mvp)
6. [Tools & Resources](#tools--resources)
7. [Decision Points](#decision-points)
8. [Next Steps](#next-steps)

---

## Overview

This roadmap provides a **16-week implementation plan** to build the Multi-Indicator Confluence Analysis System from architecture to production. The plan is structured in 7 phases, each with specific deliverables and success criteria.

### Implementation Strategy

- **Incremental delivery:** Each phase produces working components
- **Validation-driven:** Test and validate before moving forward
- **Dependency-aware:** Phases build on previous work
- **Flexible:** Can be adapted based on progress and learnings

### Expected Timeline

- **Minimum Viable Product (MVP):** 2 weeks
- **Core System (Phases 1-4):** 10 weeks
- **Full System (All phases):** 16 weeks

---

## Timeline Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│                    16-WEEK IMPLEMENTATION PLAN                      │
└─────────────────────────────────────────────────────────────────────┘

MONTH 1: FOUNDATION
├─ Week 1:  [Phase 0] Setup & Proof of Concept
├─ Week 2:  [Phase 1] Database Schema Development
├─ Week 3:  [Phase 1] Schema Validation & Testing
└─ Week 4:  [Phase 2] MQL5 Service Foundation

MONTH 2: DATA PIPELINE
├─ Week 5:  [Phase 2] MQL5 Service Development
├─ Week 6:  [Phase 2] MQL5 Testing & Refinement
├─ Week 7:  [Phase 3] Python Processing Engine
└─ Week 8:  [Phase 3] Python Algorithm Development

MONTH 3: INTELLIGENCE & INTEGRATION
├─ Week 9:  [Phase 3] Python Integration Testing
├─ Week 10: [Phase 4] Orchestration & Automation
├─ Week 11: [Phase 5] LLM Integration
└─ Week 12: [Phase 5] LLM Quality Assurance

MONTH 4: PRODUCTION
├─ Week 13: [Phase 6] API Development
├─ Week 14: [Phase 6] API Deployment
├─ Week 15: [Phase 7] Monitoring & Optimization
└─ Week 16: [Phase 7] Documentation & Launch
```

---

## Phase Breakdown

### Phase 0: Preparation & Setup

**Duration:** Week 1
**Goal:** Set up development environment and validate concepts

#### Tasks

**1. Repository Organization**

- Create folder structure matching architecture layers:
  ```
  /mql5-services/        # MQL5 data collection services
  /database/             # Schema files and setup scripts
  /python-processor/     # Python processing engine
  /api/                  # REST API layer
  /docs/                 # Additional documentation
  /tests/                # Test files
  ```
- Set up development branch strategy
- Initialize documentation folder

**2. Environment Setup**

- Install MetaEditor for MQL5 development
- Set up Railway account (or alternative SQLite hosting)
- Configure Python development environment:
  ```bash
  python -m venv venv
  source venv/bin/activate  # or venv\Scripts\activate on Windows
  pip install pandas numpy sqlite3
  ```
- Install development tools:
  - DB Browser for SQLite
  - VS Code or PyCharm
  - Postman for API testing

**3. Proof of Concept**

- Test MQL5 → SQLite connection locally
- Verify Python can read/write to same database
- Test basic transaction performance using Native folder examples
- Benchmark: Measure insert speed with/without transactions

#### Deliverables

- ✅ Working development environment
- ✅ MQL5-Python-SQLite connection verified
- ✅ Repository structure created
- ✅ Development tools installed

#### Success Criteria

```mql5
// MQL5 can write to database
int db = DatabaseOpen("test.db", DATABASE_OPEN_CREATE);
DatabaseExecute(db, "CREATE TABLE test(id INT)");
DatabaseClose(db);

// Python can read same database
import sqlite3
conn = sqlite3.connect("test.db")
cursor = conn.execute("SELECT * FROM test")
# Success: No errors
```

---

### Phase 1: Database Foundation

**Duration:** Weeks 2-3
**Goal:** Implement production-ready database schema

#### Tasks

**1. Schema Development (Week 2)**

- Create `schema-v1.0.sql` file following Part 297 pattern
- Define all 3 layers:
  - **Raw Layer:** symbol, market_data, indicator_values
  - **Intermediate Layer:** timeframe_alignment, indicator_strength
  - **Output Layer:** confluence_score, llm_analysis
- Add indexes for frequently queried columns:
  ```sql
  CREATE INDEX idx_market_data_tstamp ON market_data(tstamp);
  CREATE INDEX idx_indicator_values_tstamp ON indicator_values(tstamp);
  CREATE INDEX idx_confluence_created ON confluence_score(created_at);
  ```
- Document each table's purpose in comments

**2. Initialization Script (Week 2)**

- Create `db-setup.mq5` based on Part 297/db-setup.mq5
- Implement schema file reading:
  ```mql5
  string ReadSchemaFile(const string fname);
  ```
- Execute schema creation with error handling
- Add database version tracking:
  ```sql
  CREATE TABLE schema_version(version TEXT, applied_at INTEGER);
  INSERT INTO schema_version VALUES('1.0', strftime('%s','now'));
  ```

**3. Validation (Week 3)**

- Manually insert test data for each table
- Verify foreign key constraints:
  ```sql
  -- Should fail (no symbol with id 999):
  INSERT INTO market_data(symbol_id, ...) VALUES(999, ...);
  ```
- Test CASCADE deletes:
  ```sql
  DELETE FROM symbol WHERE symbol_id = 1;
  -- Should also delete related market_data and indicator_values
  ```
- Validate CHECK constraints:
  ```sql
  -- Should fail (invalid timeframe):
  INSERT INTO market_data(timeframe, ...) VALUES('M7', ...);
  ```

#### Deliverables

- ✅ `schema-v1.0.sql` with all 7 tables
- ✅ `db-setup.mq5` initialization script
- ✅ Database created and validated locally
- ✅ Schema documentation

#### Success Criteria

```sql
-- All tables should exist:
SELECT name FROM sqlite_master WHERE type='table';
-- Returns: symbol, market_data, indicator_values,
--          timeframe_alignment, indicator_strength,
--          confluence_score, llm_analysis, schema_version

-- Foreign keys should be enabled:
PRAGMA foreign_keys;
-- Returns: 1

-- Should have at least 3 test records:
SELECT COUNT(*) FROM market_data;
-- Returns: >= 3
```

---

### Phase 2: MQL5 Data Collection Service

**Duration:** Weeks 4-6
**Goal:** Build real-time market data and indicator collection

#### Tasks

**1. Indicator Setup (Week 4)**

- Identify your 7 indicators from mql5-indicators folder
- Document each indicator:
  ```
  Indicator 1: [Name]
  - Buffer 0: [Description]
  - Buffer 1: [Description]
  - Signal Logic: [How to classify buy/sell/neutral]
  ```
- Create indicator handles for each timeframe:
  ```mql5
  int handles_indicator1[5];  // One per timeframe
  handles_indicator1[0] = iCustom(_Symbol, PERIOD_M15, "IndicatorName", ...);
  handles_indicator1[1] = iCustom(_Symbol, PERIOD_M30, "IndicatorName", ...);
  // ... for all 5 timeframes
  ```
- Test indicator value retrieval:
  ```mql5
  double buffer[];
  if(CopyBuffer(handle, 0, 0, 1, buffer) == 1)
      Print("Value: ", buffer[0]);
  ```

**2. Service Core Development (Week 5)**

- Create `indicator-collector-service.mq5`
- Implement continuous loop (Part 297 pattern):

  ```mql5
  void OnStart() {
      InitializeDatabase();
      InitializeIndicators();

      do {
          CollectAllData();
          Sleep(1000 * 60);  // 60 seconds
      } while(!IsStopped());

      Cleanup();
  }
  ```

- Add `GetOrInsertSymbol()` function (Part 297 pattern)
- Implement duplicate prevention:
  ```mql5
  bool MarketDataExists(long symbol_id, datetime tstamp, string timeframe);
  ```

**3. Data Writing (Week 5-6)**

- Implement `InsertMarketData()` with transactions:
  ```mql5
  DatabaseTransactionBegin(db);
  for each timeframe:
      InsertMarketData(...);
  DatabaseTransactionCommit(db);
  ```
- Implement `InsertIndicatorValues()` for all 7 indicators
- Add signal classification logic:
  ```mql5
  int ClassifySignal(double main, double signal) {
      if(main > signal) return 1;   // Bullish
      if(main < signal) return -1;  // Bearish
      return 0;                      // Neutral
  }
  ```
- Add signal strength calculation:
  ```mql5
  double CalculateStrength(double value, double threshold) {
      // Return 0-100 based on indicator value
      // Higher value = stronger signal
  }
  ```

**4. Error Handling & Logging (Week 6)**

- Add retry logic (Part 297 pattern):
  ```mql5
  int retries = 0;
  while(retries < 3 && !success) {
      success = InsertData(...);
      if(!success) {
          retries++;
          Sleep(1000);
      }
  }
  ```
- Implement logging to file:
  ```mql5
  void LogMessage(string msg) {
      int handle = FileOpen("collector.log", FILE_WRITE|FILE_TXT|FILE_ANSI);
      FileWrite(handle, TimeToString(TimeCurrent()) + ": " + msg);
      FileClose(handle);
  }
  ```
- Add graceful shutdown:
  ```mql5
  if(IsStopped()) {
      LogMessage("Service stopped by user");
      CleanupIndicators();
      DatabaseClose(db);
      return;
  }
  ```

#### Deliverables

- ✅ Working MQL5 service collecting data every 60 seconds
- ✅ Data flowing to Raw Layer (market_data, indicator_values tables)
- ✅ Transaction performance optimized
- ✅ Error handling and logging implemented
- ✅ Documentation of 7 indicators

#### Success Criteria

```mql5
// After 1 hour of running (60 collection cycles):
SELECT COUNT(*) FROM market_data WHERE tstamp > [1_hour_ago];
// Returns: 5 (one per timeframe)

SELECT COUNT(*) FROM indicator_values WHERE tstamp > [1_hour_ago];
// Returns: 35 (7 indicators × 5 timeframes)

SELECT DISTINCT indicator_name FROM indicator_values;
// Returns: IND1, IND2, IND3, IND4, IND5, IND6, IND7

// All signals should be valid:
SELECT COUNT(*) FROM indicator_values
WHERE signal_direction NOT IN (-1, 0, 1);
// Returns: 0

// Log file should exist and show activity:
// collector.log shows regular "Data collected" entries
```

---

### Phase 3: Python Processing Engine

**Duration:** Weeks 7-9
**Goal:** Transform raw data into confluence scores

#### Tasks

**1. Data Access Layer (Week 7)**

- Create `database.py` module:

  ```python
  class DatabaseManager:
      def __init__(self, db_path: str):
          self.conn = sqlite3.connect(db_path)

      def fetch_latest_indicators(self, symbol_id: int) -> pd.DataFrame:
          # Query indicator_values for latest timestamp
          pass

      def save_timeframe_alignment(self, data: dict) -> int:
          # Insert into timeframe_alignment, return analysis_id
          pass
  ```

- Implement connection pooling for concurrent access
- Add transaction management:
  ```python
  def execute_with_transaction(self, queries: list):
      try:
          self.conn.execute("BEGIN")
          for query in queries:
              self.conn.execute(query)
          self.conn.commit()
      except:
          self.conn.rollback()
          raise
  ```

**2. Processing Modules (Week 7-8)**

**a) Timeframe Analyzer (`timeframe_analyzer.py`)**

```python
class TimeframeAnalyzer:
    def calculate_alignment(self, indicators_df: pd.DataFrame) -> dict:
        """
        Calculate alignment scores per timeframe.
        Returns: {
            'm15_alignment_score': 85.7,  # % of indicators agreeing
            'm30_alignment_score': 71.4,
            ...
            'overall_direction': 1  # -1/0/1
        }
        """
        alignment = {}

        for tf in ['M15', 'M30', 'H1', 'H2', 'H4']:
            tf_data = indicators_df[indicators_df['timeframe'] == tf]

            bullish = (tf_data['signal_direction'] == 1).sum()
            bearish = (tf_data['signal_direction'] == -1).sum()
            total = len(tf_data)

            # Alignment = % agreeing on dominant direction
            alignment[f'{tf.lower()}_alignment_score'] = \
                max(bullish, bearish) / total * 100

        # Overall direction: where majority of timeframes point
        alignment['overall_direction'] = self._determine_consensus(indicators_df)

        return alignment
```

**b) Indicator Analyzer (`indicator_analyzer.py`)**

```python
class IndicatorAnalyzer:
    def calculate_strengths(self, indicators_df: pd.DataFrame,
                          alignment: dict) -> pd.DataFrame:
        """
        Calculate weight and reliability for each indicator.
        Returns DataFrame with columns:
        - indicator_name
        - timeframe
        - weight (calculated importance)
        - reliability_score
        - current_signal
        """
        strengths = []

        for _, row in indicators_df.iterrows():
            weight = self._calculate_weight(
                row['signal_strength'],
                row['timeframe']  # Higher TF = higher weight
            )

            reliability = self._assess_reliability(
                row['indicator_name'],
                row['timeframe']
            )

            strengths.append({
                'indicator_name': row['indicator_name'],
                'timeframe': row['timeframe'],
                'weight': weight,
                'reliability_score': reliability,
                'current_signal': row['signal_direction']
            })

        return pd.DataFrame(strengths)

    def _calculate_weight(self, strength: float, timeframe: str) -> float:
        """
        Weight = signal_strength × timeframe_multiplier
        Higher timeframes get more weight
        """
        tf_multipliers = {
            'M15': 1.0, 'M30': 1.2, 'H1': 1.5, 'H2': 1.8, 'H4': 2.0
        }
        return strength * tf_multipliers.get(timeframe, 1.0)
```

**c) Confluence Calculator (`confluence_calculator.py`)**

```python
class ConfluenceCalculator:
    def calculate_score(self, alignment: dict,
                       strengths: pd.DataFrame) -> dict:
        """
        Master confluence calculation.
        Returns: {
            'total_score': 78.5,  # 0-100
            'bullish_score': 65.0,
            'bearish_score': 35.0,
            'confidence_level': 'HIGH',
            'timeframe_consensus': {...},
            'indicator_breakdown': {...}
        }
        """
        # Weighted average of timeframe alignments
        tf_weights = {'M15': 1.0, 'M30': 1.2, 'H1': 1.5, 'H2': 1.8, 'H4': 2.0}

        weighted_sum = 0
        weight_total = 0

        for tf, weight in tf_weights.items():
            score = alignment.get(f'{tf.lower()}_alignment_score', 0)
            weighted_sum += score * weight
            weight_total += weight

        total_score = weighted_sum / weight_total

        # Calculate directional scores
        bullish_score = self._calculate_directional_score(strengths, 1)
        bearish_score = self._calculate_directional_score(strengths, -1)

        # Classify confidence
        confidence = self._classify_confidence(total_score)

        return {
            'total_score': round(total_score, 2),
            'bullish_score': round(bullish_score, 2),
            'bearish_score': round(bearish_score, 2),
            'confidence_level': confidence,
            'timeframe_consensus': self._build_consensus_json(alignment),
            'indicator_breakdown': self._build_breakdown_json(strengths)
        }

    def _classify_confidence(self, score: float) -> str:
        if score >= 80: return 'VERY_HIGH'
        if score >= 65: return 'HIGH'
        if score >= 50: return 'MEDIUM'
        return 'LOW'
```

**3. ETL Pipeline (Week 8-9)**

**Main Orchestrator (`pipeline.py`)**

```python
class ConfluencePipeline:
    def __init__(self, db_path: str):
        self.db = DatabaseManager(db_path)
        self.tf_analyzer = TimeframeAnalyzer()
        self.ind_analyzer = IndicatorAnalyzer()
        self.conf_calculator = ConfluenceCalculator()

    def process_latest_data(self, symbol_id: int) -> int:
        """
        Main ETL pipeline.
        Returns: confluence_id
        """
        print(f"Processing data for symbol_id={symbol_id}")

        # EXTRACT
        indicators_df = self.db.fetch_latest_indicators(symbol_id)

        if indicators_df.empty:
            print("No data to process")
            return None

        # TRANSFORM
        print("Calculating timeframe alignment...")
        alignment = self.tf_analyzer.calculate_alignment(indicators_df)

        print("Calculating indicator strengths...")
        strengths = self.ind_analyzer.calculate_strengths(
            indicators_df, alignment
        )

        print("Calculating confluence score...")
        confluence = self.conf_calculator.calculate_score(
            alignment, strengths
        )

        # LOAD
        print("Saving results to database...")

        # Save to INTERMEDIATE layer
        analysis_id = self.db.save_timeframe_alignment(
            alignment, symbol_id
        )

        self.db.save_indicator_strengths(
            strengths, analysis_id
        )

        # Save to OUTPUT layer
        confluence_id = self.db.save_confluence_score(
            confluence, analysis_id, symbol_id
        )

        print(f"Complete! confluence_id={confluence_id}")
        return confluence_id
```

**4. Testing (Week 9)**

- Unit tests for each module:

  ```python
  # test_timeframe_analyzer.py
  def test_alignment_calculation():
      # Given: 5 bullish, 2 bearish indicators on M15
      # Expected: 71.4% alignment (5/7 * 100)
      pass

  # test_confluence_calculator.py
  def test_score_range():
      # All scores should be 0-100
      pass
  ```

- Integration test with sample data
- Validate output against manual calculations

#### Deliverables

- ✅ Python processing engine with 4 modules
- ✅ Confluence scores calculated and stored
- ✅ Unit tests with >80% coverage
- ✅ Integration test passing
- ✅ Documentation for each module

#### Success Criteria

```python
# Given latest indicator data for EURUSD:
pipeline = ConfluencePipeline("confluence.db")
confluence_id = pipeline.process_latest_data(symbol_id=1)

# Should produce:
# 1. One record in timeframe_alignment table
# 2. 35 records in indicator_strength table (7 × 5)
# 3. One record in confluence_score table with:
#    - total_score between 0-100
#    - bullish_score + bearish_score ≈ 100
#    - confidence_level in ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']
#    - valid JSON in timeframe_consensus and indicator_breakdown

# Processing time should be <2 seconds
```

---

### Phase 4: Orchestration & Triggers

**Duration:** Week 10
**Goal:** Connect MQL5 service to Python processor automatically

#### Tasks

**1. Event Mechanism Selection**

**Option A: File-based Trigger (Simplest)**

```mql5
// In MQL5 service after data collection:
void NotifyPythonProcessor() {
    int handle = FileOpen("trigger.txt", FILE_WRITE|FILE_TXT);
    FileWrite(handle, IntegerToString(TimeCurrent()));
    FileClose(handle);
}
```

```python
# In Python watcher:
import time
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

class TriggerHandler(FileSystemEventHandler):
    def on_modified(self, event):
        if event.src_path.endswith('trigger.txt'):
            pipeline.process_latest_data(symbol_id=1)
```

**Option B: Database Polling (Most Reliable)**

```python
# Python scheduler checks for new data every 10 seconds
import time

last_processed_timestamp = 0

while True:
    latest_timestamp = db.get_latest_timestamp()

    if latest_timestamp > last_processed_timestamp:
        pipeline.process_latest_data(symbol_id=1)
        last_processed_timestamp = latest_timestamp

    time.sleep(10)
```

**Option C: HTTP Webhook (Most Scalable)**

```mql5
// In MQL5 service (requires external library):
void NotifyWebhook() {
    string url = "http://localhost:8000/api/process";
    string json = StringFormat('{"symbol_id": 1, "timestamp": %d}', TimeCurrent());
    // Send HTTP POST (requires custom implementation)
}
```

```python
# Python API endpoint:
from fastapi import FastAPI
app = FastAPI()

@app.post("/api/process")
async def trigger_processing(data: dict):
    symbol_id = data['symbol_id']
    confluence_id = pipeline.process_latest_data(symbol_id)
    return {"status": "success", "confluence_id": confluence_id}
```

**Recommendation:** Start with Option B (polling) for reliability

**2. Scheduler Setup**

```python
# scheduler.py
import time
import logging

class ProcessingScheduler:
    def __init__(self, db_path: str, interval_seconds: int = 60):
        self.pipeline = ConfluencePipeline(db_path)
        self.interval = interval_seconds
        self.last_processed = 0

        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)

    def run(self):
        self.logger.info("Scheduler started")

        while True:
            try:
                # Get latest data timestamp
                latest_ts = self.pipeline.db.get_latest_timestamp()

                # Process if new data available
                if latest_ts > self.last_processed:
                    self.logger.info(f"New data detected: {latest_ts}")

                    confluence_id = self.pipeline.process_latest_data(
                        symbol_id=1
                    )

                    self.logger.info(f"Processed: confluence_id={confluence_id}")
                    self.last_processed = latest_ts
                else:
                    self.logger.debug("No new data")

            except Exception as e:
                self.logger.error(f"Processing error: {e}")

            time.sleep(self.interval)

if __name__ == "__main__":
    scheduler = ProcessingScheduler("confluence.db", interval_seconds=10)
    scheduler.run()
```

**3. Rate Limiting**

```python
from datetime import datetime, timedelta

class RateLimiter:
    def __init__(self, min_interval_seconds: int = 30):
        self.min_interval = timedelta(seconds=min_interval_seconds)
        self.last_run = None

    def can_run(self) -> bool:
        if self.last_run is None:
            return True

        elapsed = datetime.now() - self.last_run
        return elapsed >= self.min_interval

    def mark_run(self):
        self.last_run = datetime.now()

# Usage in scheduler:
limiter = RateLimiter(min_interval_seconds=30)

if latest_ts > self.last_processed and limiter.can_run():
    process_data()
    limiter.mark_run()
```

**4. End-to-End Testing**

- Run MQL5 service for 1 hour
- Verify Python processes each new data point
- Check database for:
  - Market data entries
  - Indicator values
  - Timeframe alignments
  - Confluence scores
- Measure latency from data collection to confluence score

#### Deliverables

- ✅ Automated data flow from MQL5 → Python
- ✅ No manual intervention needed
- ✅ Processing scheduler running continuously
- ✅ Rate limiting implemented
- ✅ Error handling and logging

#### Success Criteria

```
Test Scenario: Run system for 2 hours

Expected Results:
- MQL5 collects data every 60 seconds = 120 cycles
- Python processes each cycle within 10 seconds
- Database contains:
  * 600 market_data records (120 cycles × 5 TF)
  * 4,200 indicator_values records (120 × 7 × 5)
  * 120 confluence_score records
- Average latency: <10 seconds from collection to confluence score
- Zero failed processing attempts
- Logs show regular "Processed: confluence_id=X" entries
```

---

### Phase 5: LLM Integration

**Duration:** Weeks 11-12
**Goal:** Generate AI-powered technical analysis

#### Tasks

**1. Prompt Engineering (Week 11)**

**Design Prompt Template v1.0:**

```python
# prompts.py
TECHNICAL_ANALYSIS_PROMPT_V1 = """
You are a professional technical analyst with 20 years of experience.

Analyze this multi-timeframe confluence trading setup:

SYMBOL: {symbol}
TIMESTAMP: {timestamp}
CONFLUENCE SCORE: {total_score}/100

DIRECTIONAL BREAKDOWN:
- Bullish Score: {bullish_score}
- Bearish Score: {bearish_score}
- Overall Direction: {direction}
- Confidence Level: {confidence_level}

TIMEFRAME CONSENSUS:
{timeframe_consensus}

INDICATOR BREAKDOWN:
{indicator_breakdown}

CURRENT MARKET DATA:
- Price: {current_price}
- H1 High: {h1_high}, Low: {h1_low}
- H4 High: {h4_high}, Low: {h4_low}

Provide a structured analysis with:

1. TECHNICAL SUMMARY (2-3 sentences)
   - What is the dominant market structure?
   - What are the key support/resistance levels?

2. TRADE SETUP
   - Direction: [BUY/SELL/NO TRADE]
   - Entry: [Specific price level]
   - Stop Loss: [Specific price level with reasoning]
   - Take Profit 1: [Specific price level]
   - Take Profit 2: [Specific price level]
   - Risk/Reward Ratio: [Calculate]

3. RISK ASSESSMENT (1-2 sentences)
   - What could invalidate this setup?
   - What are the main risks?

4. MARKET CONTEXT (1-2 sentences)
   - Is this aligned with higher timeframe trend?
   - Any upcoming events to consider?

Keep response concise and actionable.
"""
```

**Test with Various Scenarios:**

- High confluence (>80) bullish setup
- Low confluence (<50) mixed signals
- Bearish setup
- Neutral/no-trade scenario

**2. LLM Client Implementation (Week 11)**

```python
# llm_client.py
import openai
import time
from typing import Dict

class LLMClient:
    def __init__(self, api_key: str, model: str = "gpt-4"):
        self.api_key = api_key
        self.model = model
        openai.api_key = api_key

    def generate_analysis(self, prompt: str,
                         max_retries: int = 3) -> Dict[str, str]:
        """
        Call LLM API with retry logic.
        Returns parsed response.
        """
        for attempt in range(max_retries):
            try:
                response = openai.ChatCompletion.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": "You are a professional technical analyst."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.7,
                    max_tokens=800
                )

                content = response.choices[0].message.content
                return self._parse_response(content)

            except openai.error.RateLimitError:
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt  # Exponential backoff
                    print(f"Rate limited. Waiting {wait_time}s...")
                    time.sleep(wait_time)
                else:
                    raise

            except Exception as e:
                print(f"LLM API error: {e}")
                if attempt < max_retries - 1:
                    time.sleep(2)
                else:
                    raise

    def _parse_response(self, content: str) -> Dict[str, str]:
        """
        Parse LLM response into structured sections.
        """
        sections = {
            'technical_summary': '',
            'trade_setup': '',
            'risk_assessment': '',
            'market_context': ''
        }

        # Simple parsing logic (can be enhanced)
        current_section = None

        for line in content.split('\n'):
            line = line.strip()

            if 'TECHNICAL SUMMARY' in line.upper():
                current_section = 'technical_summary'
            elif 'TRADE SETUP' in line.upper():
                current_section = 'trade_setup'
            elif 'RISK ASSESSMENT' in line.upper():
                current_section = 'risk_assessment'
            elif 'MARKET CONTEXT' in line.upper():
                current_section = 'market_context'
            elif current_section and line:
                sections[current_section] += line + '\n'

        return sections
```

**3. Analysis Integration (Week 11-12)**

```python
# llm_analyzer.py
import json
from llm_client import LLMClient
from prompts import TECHNICAL_ANALYSIS_PROMPT_V1

class LLMAnalyzer:
    def __init__(self, api_key: str, db_path: str, prompt_version: str = "1.0"):
        self.llm = LLMClient(api_key)
        self.db = DatabaseManager(db_path)
        self.prompt_version = prompt_version

    def analyze_confluence(self, confluence_id: int) -> int:
        """
        Generate LLM analysis for confluence score.
        Returns: llm_id
        """
        # Fetch confluence data
        confluence = self.db.get_confluence_by_id(confluence_id)
        market_data = self.db.get_latest_market_data(confluence['symbol_id'])

        # Build prompt
        prompt = self._build_prompt(confluence, market_data)

        # Call LLM
        print(f"Generating analysis for confluence_id={confluence_id}")
        analysis = self.llm.generate_analysis(prompt)

        # Save to database
        llm_id = self.db.save_llm_analysis(
            confluence_id=confluence_id,
            technical_summary=analysis['technical_summary'],
            trade_setup=analysis['trade_setup'],
            risk_assessment=analysis['risk_assessment'],
            market_context=analysis['market_context'],
            llm_model=self.llm.model,
            prompt_version=self.prompt_version
        )

        print(f"Analysis saved: llm_id={llm_id}")
        return llm_id

    def _build_prompt(self, confluence: dict, market_data: dict) -> str:
        """Build prompt from template with data."""

        # Format timeframe consensus
        tf_consensus = json.loads(confluence['timeframe_consensus'])
        tf_text = "\n".join([
            f"- {tf}: {direction}"
            for tf, direction in tf_consensus.items()
        ])

        # Format indicator breakdown
        ind_breakdown = json.loads(confluence['indicator_breakdown'])
        ind_text = "\n".join([
            f"- {name}: Signal={data['signal']}, Weight={data['weight']}"
            for name, data in ind_breakdown.items()
        ])

        # Fill template
        prompt = TECHNICAL_ANALYSIS_PROMPT_V1.format(
            symbol=market_data['ticker'],
            timestamp=confluence['tstamp'],
            total_score=confluence['total_score'],
            bullish_score=confluence['bullish_score'],
            bearish_score=confluence['bearish_score'],
            direction="BULLISH" if confluence['overall_direction'] == 1 else "BEARISH",
            confidence_level=confluence['confidence_level'],
            timeframe_consensus=tf_text,
            indicator_breakdown=ind_text,
            current_price=market_data['price_close'],
            h1_high=market_data['h1_high'],
            h1_low=market_data['h1_low'],
            h4_high=market_data['h4_high'],
            h4_low=market_data['h4_low']
        )

        return prompt
```

**4. Quality Control (Week 12)**

**Manual Review Process:**

```python
# review_tool.py
def review_analyses(limit: int = 20):
    """
    Print analyses for manual quality review.
    """
    db = DatabaseManager("confluence.db")
    analyses = db.get_recent_analyses(limit)

    for i, analysis in enumerate(analyses, 1):
        print(f"\n{'='*60}")
        print(f"REVIEW #{i}")
        print(f"Confluence Score: {analysis['total_score']}")
        print(f"Direction: {analysis['direction']}")
        print(f"\nTECHNICAL SUMMARY:")
        print(analysis['technical_summary'])
        print(f"\nTRADE SETUP:")
        print(analysis['trade_setup'])
        print(f"\nQuality Rating (1-5): ", end="")
        rating = input()

        # Store rating for prompt improvement
        db.save_analysis_rating(analysis['llm_id'], int(rating))
```

**Prompt Iteration:**

- Review 20+ generated analyses
- Identify common issues:
  - Too verbose?
  - Not specific enough on price levels?
  - Missing context?
- Create prompt v1.1 with improvements
- A/B test v1.0 vs v1.1

#### Deliverables

- ✅ Working LLM integration with retry logic
- ✅ Prompt template v1.0 (and v1.1 if iterated)
- ✅ Technical analysis generated automatically
- ✅ Quality validated manually (20+ samples)
- ✅ Response parsing working correctly
- ✅ Analysis stored in database with metadata

#### Success Criteria

```python
# Each confluence_score should trigger LLM analysis:
SELECT COUNT(*) FROM llm_analysis;
# Should equal:
SELECT COUNT(*) FROM confluence_score;

# Each analysis should have all fields populated:
SELECT * FROM llm_analysis WHERE
    technical_summary IS NULL OR
    trade_setup IS NULL OR
    risk_assessment IS NULL;
# Returns: 0 rows

# Analysis generation time:
# Average: <5 seconds per analysis
# 95th percentile: <10 seconds

# Quality metrics (from manual review):
# Average rating: >=3.5/5
# Useful trade setups: >=70% of cases
```

---

### Phase 6: API Layer

**Duration:** Weeks 13-14
**Goal:** Expose data to external consumers via REST API

#### Tasks

**1. API Framework Setup (Week 13)**

```python
# main.py (FastAPI)
from fastapi import FastAPI, Depends, HTTPException, Security
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from typing import Optional, List
import uvicorn

app = FastAPI(
    title="Confluence Analysis API",
    version="1.0.0",
    description="Multi-indicator confluence analysis system"
)

# Authentication
API_KEY_HEADER = APIKeyHeader(name="X-API-Key")

def verify_api_key(api_key: str = Security(API_KEY_HEADER)):
    """Verify API key."""
    if api_key != "your-secret-api-key":  # In production: use env var + hashing
        raise HTTPException(status_code=403, detail="Invalid API key")
    return api_key

# Database dependency
def get_db():
    db = DatabaseManager("confluence.db")
    try:
        yield db
    finally:
        db.close()
```

**2. Response Schemas (Week 13)**

```python
# schemas.py
from pydantic import BaseModel, Field
from typing import Dict, Optional
from datetime import datetime

class ConfluenceResponse(BaseModel):
    """Response schema for confluence analysis."""

    confluence_id: int
    symbol: str
    timestamp: datetime

    # Scores
    total_score: float = Field(..., ge=0, le=100)
    bullish_score: float = Field(..., ge=0, le=100)
    bearish_score: float = Field(..., ge=0, le=100)
    confidence_level: str

    # Breakdown
    timeframe_consensus: Dict[str, str]
    indicator_breakdown: Dict[str, dict]

    # LLM Analysis
    technical_summary: Optional[str]
    trade_setup: Optional[str]
    risk_assessment: Optional[str]
    market_context: Optional[str]

    class Config:
        schema_extra = {
            "example": {
                "confluence_id": 123,
                "symbol": "EURUSD",
                "timestamp": "2025-11-22T10:30:00",
                "total_score": 78.5,
                "bullish_score": 65.0,
                "bearish_score": 35.0,
                "confidence_level": "HIGH",
                "timeframe_consensus": {
                    "M15": "BULLISH",
                    "M30": "BULLISH",
                    "H1": "BULLISH",
                    "H2": "NEUTRAL",
                    "H4": "BULLISH"
                },
                "indicator_breakdown": {
                    "IND1": {"signal": "BUY", "weight": 15.2},
                    "IND2": {"signal": "BUY", "weight": 12.8}
                },
                "technical_summary": "Strong bullish setup with...",
                "trade_setup": "Entry: 1.0850, SL: 1.0820, TP: 1.0920",
                "risk_assessment": "Main risk is...",
                "market_context": "Aligned with daily uptrend..."
            }
        }

class IndicatorValue(BaseModel):
    """Single indicator value."""
    timestamp: datetime
    timeframe: str
    indicator_name: str
    value_line1: float
    signal_direction: int = Field(..., ge=-1, le=1)
    signal_strength: float = Field(..., ge=0, le=100)

class HistoricalResponse(BaseModel):
    """Historical confluence scores."""
    total: int
    data: List[ConfluenceResponse]
```

**3. API Endpoints (Week 13-14)**

```python
# routes.py
from fastapi import APIRouter, Depends, Query
from schemas import ConfluenceResponse, IndicatorValue, HistoricalResponse
from database import DatabaseManager
from typing import List

router = APIRouter(prefix="/api/v1", tags=["analysis"])

@router.get("/analysis/latest", response_model=ConfluenceResponse)
async def get_latest_analysis(
    symbol: str = Query("EURUSD", description="Trading symbol"),
    db: DatabaseManager = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """
    Get the latest confluence analysis for a symbol.

    Returns complete analysis including:
    - Confluence scores
    - Timeframe consensus
    - Indicator breakdown
    - LLM-generated technical analysis
    """
    analysis = db.get_latest_confluence(symbol)

    if not analysis:
        raise HTTPException(status_code=404, detail="No analysis found")

    return ConfluenceResponse(**analysis)


@router.get("/analysis/{confluence_id}", response_model=ConfluenceResponse)
async def get_analysis_by_id(
    confluence_id: int,
    db: DatabaseManager = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """
    Get specific confluence analysis by ID.
    """
    analysis = db.get_confluence_by_id(confluence_id)

    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    return ConfluenceResponse(**analysis)


@router.get("/history", response_model=HistoricalResponse)
async def get_analysis_history(
    symbol: str = Query("EURUSD"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    min_score: float = Query(None, ge=0, le=100),
    db: DatabaseManager = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """
    Get historical confluence analyses.

    Parameters:
    - symbol: Trading symbol (default: EURUSD)
    - limit: Number of results (1-100)
    - offset: Pagination offset
    - min_score: Filter by minimum confluence score
    """
    analyses = db.get_history(
        symbol=symbol,
        limit=limit,
        offset=offset,
        min_score=min_score
    )

    total = db.get_history_count(symbol, min_score)

    return HistoricalResponse(
        total=total,
        data=[ConfluenceResponse(**a) for a in analyses]
    )


@router.get("/indicators/{symbol}", response_model=List[IndicatorValue])
async def get_raw_indicators(
    symbol: str,
    timeframe: Optional[str] = Query(None, regex="^(M15|M30|H1|H2|H4)$"),
    db: DatabaseManager = Depends(get_db),
    api_key: str = Depends(verify_api_key)
):
    """
    Get raw indicator values for a symbol.

    Optionally filter by timeframe.
    """
    indicators = db.get_indicator_values(symbol, timeframe)

    return [IndicatorValue(**i) for i in indicators]


@router.get("/health")
async def health_check():
    """
    Health check endpoint (no auth required).
    """
    return {
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }
```

**4. Deployment (Week 14)**

**a) Configuration**

```python
# config.py
from pydantic import BaseSettings

class Settings(BaseSettings):
    database_path: str = "confluence.db"
    api_key: str
    llm_api_key: str
    environment: str = "production"
    log_level: str = "INFO"

    class Config:
        env_file = ".env"

settings = Settings()
```

**b) Railway Deployment**

```yaml
# railway.toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "uvicorn main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/api/v1/health"
healthcheckTimeout = 10
restartPolicyType = "ON_FAILURE"
```

**c) Environment Variables**

```bash
# .env (Railway secrets)
DATABASE_PATH=/app/data/confluence.db
API_KEY=your-secure-api-key-here
LLM_API_KEY=your-openai-key-here
ENVIRONMENT=production
LOG_LEVEL=INFO
```

**d) CORS Configuration (if needed for web clients)**

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-frontend-domain.com"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
```

#### Deliverables

- ✅ REST API with 5+ endpoints
- ✅ Authentication with API keys
- ✅ Pydantic response schemas
- ✅ OpenAPI documentation (auto-generated)
- ✅ Deployed to Railway
- ✅ HTTPS enabled
- ✅ Health check endpoint

#### Success Criteria

```bash
# API should be accessible:
curl https://your-api.railway.app/api/v1/health
# Returns: {"status": "healthy", ...}

# Authentication should work:
curl -H "X-API-Key: your-key" \
     https://your-api.railway.app/api/v1/analysis/latest
# Returns: ConfluenceResponse JSON

# Should reject invalid keys:
curl -H "X-API-Key: wrong-key" \
     https://your-api.railway.app/api/v1/analysis/latest
# Returns: 403 Forbidden

# Documentation should be available:
# Visit: https://your-api.railway.app/docs
# Should show interactive Swagger UI

# Response time:
# 95th percentile: <500ms for GET requests
```

---

### Phase 7: Monitoring & Optimization

**Duration:** Weeks 15-16
**Goal:** Production-ready system with monitoring and documentation

#### Tasks

**1. Monitoring Setup (Week 15)**

**a) Application Logging**

```python
# logging_config.py
import logging
from logging.handlers import RotatingFileHandler

def setup_logging(log_level: str = "INFO"):
    """Configure application logging."""

    # Create logger
    logger = logging.getLogger("confluence_system")
    logger.setLevel(log_level)

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    console_handler.setFormatter(console_formatter)

    # File handler (rotating)
    file_handler = RotatingFileHandler(
        'logs/confluence.log',
        maxBytes=10*1024*1024,  # 10MB
        backupCount=5
    )
    file_handler.setLevel(logging.DEBUG)
    file_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'
    )
    file_handler.setFormatter(file_formatter)

    logger.addHandler(console_handler)
    logger.addHandler(file_handler)

    return logger
```

**b) Performance Metrics**

```python
# metrics.py
import time
from functools import wraps
from typing import Callable

class PerformanceMonitor:
    def __init__(self):
        self.metrics = {
            'data_collection_time': [],
            'processing_time': [],
            'llm_generation_time': [],
            'api_response_time': []
        }

    def record(self, metric_name: str, value: float):
        """Record a metric value."""
        if metric_name in self.metrics:
            self.metrics[metric_name].append(value)

    def get_stats(self, metric_name: str) -> dict:
        """Get statistics for a metric."""
        values = self.metrics.get(metric_name, [])

        if not values:
            return {}

        return {
            'count': len(values),
            'avg': sum(values) / len(values),
            'min': min(values),
            'max': max(values),
            'p95': sorted(values)[int(len(values) * 0.95)]
        }

    def summary(self) -> dict:
        """Get summary of all metrics."""
        return {
            metric: self.get_stats(metric)
            for metric in self.metrics.keys()
        }

# Decorator for timing functions
def timed(monitor: PerformanceMonitor, metric_name: str):
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start = time.time()
            result = func(*args, **kwargs)
            elapsed = time.time() - start
            monitor.record(metric_name, elapsed)
            return result
        return wrapper
    return decorator

# Usage:
monitor = PerformanceMonitor()

@timed(monitor, 'processing_time')
def process_data():
    # ... processing logic
    pass
```

**c) Database Monitoring**

```python
# db_monitor.py
def get_database_stats(db_path: str) -> dict:
    """Get database statistics."""
    conn = sqlite3.connect(db_path)

    stats = {}

    # Database size
    stats['size_mb'] = os.path.getsize(db_path) / (1024 * 1024)

    # Record counts
    tables = ['market_data', 'indicator_values', 'confluence_score', 'llm_analysis']
    for table in tables:
        count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        stats[f'{table}_count'] = count

    # Growth rate (records per day)
    day_ago = int((datetime.now() - timedelta(days=1)).timestamp())
    recent_count = conn.execute(
        "SELECT COUNT(*) FROM market_data WHERE tstamp > ?",
        (day_ago,)
    ).fetchone()[0]
    stats['daily_growth_rate'] = recent_count

    conn.close()
    return stats
```

**d) Alert System**

```python
# alerts.py
import smtplib
from email.mime.text import MIMEText

class AlertManager:
    def __init__(self, email_config: dict):
        self.config = email_config

    def send_alert(self, subject: str, message: str):
        """Send email alert."""
        msg = MIMEText(message)
        msg['Subject'] = f"[Confluence System] {subject}"
        msg['From'] = self.config['from_email']
        msg['To'] = self.config['to_email']

        with smtplib.SMTP(self.config['smtp_host'], self.config['smtp_port']) as server:
            server.starttls()
            server.login(self.config['username'], self.config['password'])
            server.send_message(msg)

    def check_and_alert(self, monitor: PerformanceMonitor):
        """Check metrics and send alerts if thresholds exceeded."""
        stats = monitor.get_stats('processing_time')

        if stats.get('p95', 0) > 10:  # >10 seconds
            self.send_alert(
                "Slow Processing Detected",
                f"95th percentile processing time: {stats['p95']:.2f}s"
            )
```

**2. Performance Optimization (Week 15)**

**a) Database Optimization**

```sql
-- Add indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_market_data_symbol_tstamp
    ON market_data(symbol_id, tstamp DESC);

CREATE INDEX IF NOT EXISTS idx_indicator_values_symbol_tstamp
    ON indicator_values(symbol_id, tstamp DESC);

CREATE INDEX IF NOT EXISTS idx_confluence_score_symbol_created
    ON confluence_score(symbol_id, created_at DESC);

-- Analyze query performance
EXPLAIN QUERY PLAN
SELECT * FROM confluence_score
WHERE symbol_id = 1
ORDER BY created_at DESC
LIMIT 10;
```

**b) Query Optimization**

```python
# Inefficient (N+1 query problem):
for confluence in confluences:
    llm = db.get_llm_analysis(confluence.id)  # Separate query each time

# Efficient (JOIN):
query = """
    SELECT c.*, l.technical_summary, l.trade_setup, l.risk_assessment
    FROM confluence_score c
    LEFT JOIN llm_analysis l ON c.confluence_id = l.confluence_id
    WHERE c.symbol_id = ?
    ORDER BY c.created_at DESC
    LIMIT ?
"""
```

**c) Caching**

```python
# cache.py
from functools import lru_cache
from datetime import datetime, timedelta

class SimpleCache:
    def __init__(self, ttl_seconds: int = 60):
        self.cache = {}
        self.ttl = timedelta(seconds=ttl_seconds)

    def get(self, key: str):
        """Get cached value if not expired."""
        if key in self.cache:
            value, timestamp = self.cache[key]
            if datetime.now() - timestamp < self.ttl:
                return value
            else:
                del self.cache[key]
        return None

    def set(self, key: str, value):
        """Cache a value with timestamp."""
        self.cache[key] = (value, datetime.now())

# Usage in API:
cache = SimpleCache(ttl_seconds=30)

@router.get("/analysis/latest")
async def get_latest_analysis(symbol: str, db: DatabaseManager = Depends(get_db)):
    # Check cache first
    cached = cache.get(f"latest_{symbol}")
    if cached:
        return cached

    # Query database
    analysis = db.get_latest_confluence(symbol)

    # Cache result
    cache.set(f"latest_{symbol}", analysis)

    return analysis
```

**3. Backup Strategy (Week 16)**

```bash
# backup.sh
#!/bin/bash

# Configuration
DB_PATH="/app/data/confluence.db"
BACKUP_DIR="/app/backups"
S3_BUCKET="s3://your-bucket/confluence-backups"
RETENTION_DAYS=30

# Create backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/confluence_$TIMESTAMP.db"

echo "Creating backup: $BACKUP_FILE"
sqlite3 $DB_PATH ".backup $BACKUP_FILE"

# Compress
gzip $BACKUP_FILE

# Upload to S3 (optional)
aws s3 cp "$BACKUP_FILE.gz" "$S3_BUCKET/"

# Delete old backups
find $BACKUP_DIR -name "*.db.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup complete"
```

```python
# Automated backup scheduler
import schedule
import subprocess

def run_backup():
    """Run backup script."""
    result = subprocess.run(['bash', 'backup.sh'], capture_output=True)
    if result.returncode == 0:
        logger.info("Backup completed successfully")
    else:
        logger.error(f"Backup failed: {result.stderr}")

# Schedule daily backups at 2 AM
schedule.every().day.at("02:00").do(run_backup)

while True:
    schedule.run_pending()
    time.sleep(60)
```

**4. Documentation (Week 16)**

**a) API Documentation**

- Auto-generated via FastAPI (Swagger UI at `/docs`)
- Add detailed descriptions to each endpoint
- Include example requests/responses
- Document error codes

**b) Deployment Guide**

```markdown
# DEPLOYMENT.md

## Prerequisites

- Railway account
- MetaTrader 5 with data feed
- OpenAI API key

## Step 1: Database Setup

1. Run db-setup.mq5 in MetaTrader
2. Verify tables created
3. Upload database to Railway volume

## Step 2: MQL5 Service

1. Configure inputs in indicator-collector-service.mq5
2. Run as service in MetaTrader
3. Verify data collection in logs

## Step 3: Python Processor

1. Set environment variables in Railway
2. Deploy processing scheduler
3. Monitor logs for processing activity

## Step 4: API Deployment

1. Deploy API to Railway
2. Configure custom domain (optional)
3. Test endpoints with Postman

## Monitoring

- Check logs: `railway logs`
- Database stats: `python db_monitor.py`
- Performance metrics: `python show_metrics.py`
```

**c) Troubleshooting Guide**

```markdown
# TROUBLESHOOTING.md

## Common Issues

### MQL5 Service Not Collecting Data

**Symptoms:** No new records in market_data table
**Checks:**

- Is service running? Check Experts tab
- Are indicators initialized? Check logs
- Database connection working? Try manual insert

**Solution:** Restart service, check indicator handles

### Python Processing Not Running

**Symptoms:** confluence_score table empty
**Checks:**

- Is scheduler running? Check process
- Can Python connect to database? Test connection
- Are there errors in logs? Check logs/confluence.log

**Solution:** Restart scheduler with correct DB path

### LLM API Errors

**Symptoms:** llm_analysis table missing entries
**Checks:**

- Is API key valid? Test with curl
- Rate limit exceeded? Check API usage
- Network connectivity? Test from server

**Solution:** Check API key, implement retry logic

### Slow API Responses

**Symptoms:** Timeout errors, >1s response time
**Checks:**

- Database size? Run VACUUM
- Missing indexes? Check query plans
- Cache working? Check hit rate

**Solution:** Add indexes, enable caching
```

**d) User Manual**

````markdown
# USER_MANUAL.md

## Getting Started

### 1. Obtain API Key

Contact admin for API key

### 2. Make Your First Request

```bash
curl -H "X-API-Key: your-key" \
     https://api.example.com/api/v1/analysis/latest?symbol=EURUSD
```
````

### 3. Interpret Results

- `total_score`: 0-100, higher = stronger confluence
- `confidence_level`: LOW/MEDIUM/HIGH/VERY_HIGH
- `trade_setup`: Entry, SL, TP levels from AI

## API Endpoints

### GET /api/v1/analysis/latest

Get latest confluence analysis for a symbol

**Parameters:**

- `symbol` (string): Trading pair (default: EURUSD)

**Response:**

```json
{
  "confluence_id": 123,
  "total_score": 78.5,
  "confidence_level": "HIGH",
  ...
}
```

[... more endpoints documented ...]

```

#### Deliverables
- ✅ Logging system operational
- ✅ Performance monitoring dashboard
- ✅ Automated daily backups
- ✅ Alert system for failures
- ✅ Complete documentation (API, deployment, troubleshooting, user manual)
- ✅ Database optimized (indexes, vacuum)
- ✅ Caching implemented

#### Success Criteria
```

Monitoring:

- Logs available for last 30 days
- Metrics tracked for all major operations
- Dashboard shows key statistics

Performance:

- API p95 response time: <500ms
- Processing latency: <10 seconds
- Database queries optimized (indexed)

Reliability:

- Backups running daily
- Alerts working (test by triggering threshold)
- System uptime: >99% over 1 week

Documentation:

- All 4 docs complete (API, deployment, troubleshooting, user manual)
- API docs accessible at /docs
- README updated with links

````

---

## Milestone Checklist

### ✅ Milestone 1: Database Ready (End of Week 3)
**Goal:** Solid foundation for data storage

- [ ] Schema created with all 7 tables
- [ ] Foreign keys working correctly
- [ ] CHECK constraints validated
- [ ] Test data inserted successfully
- [ ] Can query all 3 layers (Raw, Intermediate, Output)
- [ ] db-setup.mq5 runs without errors
- [ ] Schema version tracking in place

**Validation:**
```sql
-- Should return 7 tables
SELECT COUNT(*) FROM sqlite_master WHERE type='table';

-- Should return 1 (enabled)
PRAGMA foreign_keys;

-- Should have test data
SELECT COUNT(*) FROM market_data;  -- >= 5
SELECT COUNT(*) FROM indicator_values;  -- >= 35
````

---

### ✅ Milestone 2: Data Flowing (End of Week 6)

**Goal:** Real-time data collection operational

- [ ] MQL5 service running continuously
- [ ] Market data being collected every 60s
- [ ] All 7 indicators collecting data
- [ ] 5 timeframes operational (M15, M30, H1, H2, H4)
- [ ] Transactions optimized (using BEGIN/COMMIT)
- [ ] Duplicate prevention working
- [ ] Error handling and retry logic implemented
- [ ] Logging to file working

**Validation:**

```
Run service for 2 hours, then check:

Database records:
- market_data: 10 records (2 hours × 5 TF)
- indicator_values: 70 records (2 hours × 7 ind × 5 TF)

Logs:
- No critical errors
- Shows "Data collected" every 60 seconds

Performance:
- Collection cycle: <5 seconds
- No failed database writes
```

---

### ✅ Milestone 3: Intelligence Working (End of Week 12)

**Goal:** Complete pipeline from data to AI analysis

- [ ] Python processing engine operational
- [ ] Timeframe alignment calculated
- [ ] Indicator strengths weighted
- [ ] Confluence scores generated (0-100)
- [ ] LLM integration working
- [ ] Technical analysis generated automatically
- [ ] Full pipeline automated (MQL5 → Python → LLM)
- [ ] End-to-end latency <10 seconds

**Validation:**

```
Trigger one complete cycle:

1. MQL5 collects data → Raw layer
2. Python processes → Intermediate layer
3. Confluence calculated → Output layer
4. LLM generates analysis → Output layer

Check results:
- timeframe_alignment: 1 record with 5 TF scores
- indicator_strength: 35 records
- confluence_score: 1 record with total_score 0-100
- llm_analysis: 1 record with 4 fields populated

Timing:
- Total time from data collection to final analysis: <10s
```

---

### ✅ Milestone 4: Production Ready (End of Week 16)

**Goal:** System deployed and accessible to users

- [ ] API deployed to Railway (or similar)
- [ ] HTTPS enabled
- [ ] Authentication working (API keys)
- [ ] All endpoints tested
- [ ] Monitoring in place (logs, metrics, alerts)
- [ ] Backup strategy implemented and tested
- [ ] Documentation complete (4 docs)
- [ ] System running 24/7 without intervention

**Validation:**

```
Production Checklist:

□ API accessible via HTTPS
□ Health check endpoint returns 200
□ Authentication rejects invalid keys
□ Latest analysis endpoint returns data
□ Swagger docs available at /docs
□ Logs being written to file
□ Metrics dashboard shows statistics
□ Daily backup scheduled and tested
□ Alert system tested (send test alert)
□ All documentation published

Performance Test (run for 24 hours):
- Uptime: 100%
- No critical errors
- API p95 response time: <500ms
- Data collection cycles: 1,440 (24h × 60min)
- Confluence analyses generated: 1,440
```

---

## Quick Start MVP

**Goal:** Working proof-of-concept in 2 weeks

### Week 1: Minimal Data Pipeline

**Day 1-2: Database**

```sql
-- Simplified schema (3 tables only)
CREATE TABLE symbol(...);
CREATE TABLE market_data(...);
CREATE TABLE indicator_values(...);
```

**Day 3-4: MQL5 Script (not service)**

```mql5
// Simple script that runs once
void OnStart() {
    // Collect current bar data
    // Insert into database
    // Print "Done"
}
```

**Day 5-7: Validation**

- Run script manually 10 times
- Verify data in database
- Check for errors

**Deliverable:** Database with real market data

---

### Week 2: Minimal Processing

**Day 8-10: Python Script**

```python
# Simple script (no classes)
import sqlite3
import pandas as pd

# Read indicator_values
df = pd.read_sql("SELECT * FROM indicator_values", conn)

# Calculate simple confluence
# Average of signal_direction values
confluence = df['signal_direction'].mean()

print(f"Confluence: {confluence}")
```

**Day 11-12: Integration**

- Run MQL5 script → collect data
- Run Python script → calculate confluence
- Print result to console

**Day 13-14: Documentation**

- Document what was learned
- List what needs to be added for full system
- Plan next steps

**Deliverable:** Proof that end-to-end flow works

---

## Tools & Resources

### Development Tools

**MQL5 Development:**

- MetaEditor (included with MetaTrader 5)
- MetaTrader 5 Terminal (for running services)

**Python Development:**

- Python 3.10+ (recommended: 3.11)
- Virtual environment tool (venv or conda)
- IDE: VS Code or PyCharm
- Libraries:
  ```bash
  pip install pandas numpy sqlite3 fastapi uvicorn pydantic openai
  ```

**Database:**

- DB Browser for SQLite (GUI for database inspection)
- SQLite CLI (command-line tool)

**API Testing:**

- Postman or Insomnia (REST client)
- curl (command-line testing)
- httpie (modern curl alternative)

**Version Control:**

- Git
- GitHub Desktop (optional GUI)

**Monitoring:**

- Railway CLI (for deployment)
- Logs viewer (web or CLI)

---

### Services & Hosting

**Database Hosting:**

- Railway ($5/month) - **Recommended**
- Heroku ($7/month)
- PythonAnywhere (free tier available)
- Local SQLite file (development only)

**API Hosting:**

- Railway ($5/month) - **Recommended** (same as DB)
- Render (free tier available)
- Fly.io ($5/month)

**LLM Provider:**

- OpenAI (GPT-4) - ~$10/month for testing
- Anthropic (Claude) - ~$10/month
- Open-source (Llama, Mistral) - Free but requires GPU

**Backup Storage (Optional):**

- AWS S3 ($1/month for small datasets)
- Google Cloud Storage ($1/month)
- Backblaze B2 (10GB free)

**Total Estimated Cost:** $10-25/month

---

### Knowledge Prerequisites

**Required (Must Have):**

- ✅ SQL basics (you already have this)
- ✅ SQLite understanding (from Part 297 and Native folders)
- ✅ MQL5 basics (script structure, built-in functions)
- ✅ Git basics (commit, push, pull)

**Recommended (Should Learn):**

- 📚 Pandas basics (DataFrames, groupby, filtering)
  - [10 Minutes to Pandas](https://pandas.pydata.org/docs/user_guide/10min.html)
- 📚 NumPy basics (arrays, calculations)
  - [NumPy Quickstart](https://numpy.org/doc/stable/user/quickstart.html)
- 📚 FastAPI basics (routes, Pydantic models)
  - [FastAPI Tutorial](https://fastapi.tiangolo.com/tutorial/)
- 📚 REST API concepts (GET/POST, status codes, JSON)

**Optional (Nice to Have):**

- 📖 Docker (for containerization)
- 📖 pytest (for Python testing)
- 📖 GitHub Actions (for CI/CD)

**Time to Learn:**

- Pandas/NumPy: 1-2 days of tutorials + practice
- FastAPI: 1 day of tutorial
- Total: ~1 week of part-time learning

---

## Decision Points

Before starting implementation, decide on:

### 1. Which 7 Indicators?

**Decision Needed:** Identify your 7 indicators from mql5-indicators folder

**Considerations:**

- Do they work on all 5 timeframes (M15, M30, H1, H2, H4)?
- What are their buffer structures (how many lines)?
- How will you classify signals (buy/sell/neutral)?

**Action:** Create a document listing:

```
Indicator 1: Moving Average Crossover
- Buffer 0: Fast MA
- Buffer 1: Slow MA
- Signal Logic: Buffer[0] > Buffer[1] = BUY

Indicator 2: RSI
- Buffer 0: RSI value
- Signal Logic: >70 = SELL, <30 = BUY, else NEUTRAL
...
```

---

### 2. Deployment Environment?

**Decision Needed:** Where will you host the system?

**Options:**

- **Option A:** Railway (Database + API together) - **Recommended**
  - Pros: Simple, one platform, persistent volumes
  - Cons: $5/month cost

- **Option B:** Local development initially
  - Pros: Free, full control
  - Cons: Not accessible remotely, no backup

- **Option C:** Mix (local MQL5, cloud Python/API)
  - Pros: Flexible, MQL5 stays with broker
  - Cons: More complex networking

**Recommendation:** Start local, move to Railway in Phase 6

---

### 3. Which LLM Provider?

**Decision Needed:** Which AI service for technical analysis?

**Options:**

- **OpenAI GPT-4**
  - Pros: Best quality, well-documented API
  - Cons: $0.03 per 1K tokens (~$10/month for testing)

- **Anthropic Claude**
  - Pros: Good quality, longer context
  - Cons: Similar cost to GPT-4

- **Open-source (Llama 3, Mistral)**
  - Pros: Free, privacy
  - Cons: Requires GPU, more setup

**Recommendation:** Start with OpenAI GPT-4 for ease of use

---

### 4. Development vs Production Database?

**Decision Needed:** Same database or separate for testing?

**Options:**

- **Option A:** One database (development)
  - Pros: Simple
  - Cons: Risk of corrupting production data during testing

- **Option B:** Two databases (dev + prod)
  - Pros: Safe, can test freely
  - Cons: Need to manage two environments

**Recommendation:** Start with one, split into two before Phase 6

---

### 5. Testing Data Source?

**Decision Needed:** Real broker or demo account?

**Options:**

- **Demo account**
  - Pros: No real money risk, can reset
  - Cons: Data might differ from live

- **Live account**
  - Pros: Real data, production-ready
  - Cons: Broker fees, need live connection

**Recommendation:** Start with demo, switch to live in Phase 7

---

## Next Steps

### Immediate Actions (This Week)

**1. Repository Setup**

```bash
cd sqlite-db-for-trading-alerts-saas

# Create folder structure
mkdir -p mql5-services database python-processor api tests docs logs

# Create initial files
touch database/schema-v1.0.sql
touch mql5-services/indicator-collector-service.mq5
touch python-processor/pipeline.py
touch docs/INDICATORS.md

# Commit structure
git add .
git commit -m "Add project structure"
git push
```

**2. Document Your 7 Indicators**
Create `docs/INDICATORS.md`:

```markdown
# Indicator Specifications

## Indicator 1: [Name]

- **File:** path/to/indicator1.mq5
- **Buffers:**
  - Buffer 0: [Description]
  - Buffer 1: [Description]
- **Signal Classification:**
  - BUY: [Condition]
  - SELL: [Condition]
  - NEUTRAL: [Condition]
- **Strength Calculation:** [Formula]

[... repeat for all 7 indicators ...]
```

**3. Create Initial Schema**
Start `database/schema-v1.0.sql`:

```sql
-- Symbol master table
CREATE TABLE symbol(
    symbol_id INTEGER PRIMARY KEY,
    ticker TEXT CHECK(LENGTH(ticker) <= 10) NOT NULL,
    exchange TEXT,
    asset_type TEXT
) STRICT;

-- Market data table
CREATE TABLE market_data(
    tstamp INTEGER,
    timeframe TEXT CHECK(timeframe IN ('M15','M30','H1','H2','H4')),
    -- ... add all OHLCV columns
    PRIMARY KEY(tstamp, timeframe, symbol_id),
    FOREIGN KEY(symbol_id) REFERENCES symbol(symbol_id) ON DELETE CASCADE
) STRICT;

-- ... add remaining tables
```

**4. Test Database Creation**

```mql5
// db-setup.mq5 (simplified for testing)
void OnStart() {
    string schema = ReadSchemaFile("schema-v1.0.sql");
    int db = DatabaseOpen("confluence.db", DATABASE_OPEN_CREATE);

    if(DatabaseExecute(db, schema))
        Print("Schema created successfully");
    else
        Print("Error: ", GetLastError());

    DatabaseClose(db);
}
```

---

### Week 1 Goals

By end of Week 1, you should have:

- [x] Development environment set up
- [x] Repository structure created
- [x] 7 indicators documented
- [x] Initial schema written
- [x] Schema tested (db-setup.mq5 runs successfully)
- [x] First commit pushed to GitHub

**Success Metric:** You can create a database with all tables using db-setup.mq5

---

### How to Get Help

**Stuck on Phase 0-1?**

- Review Part 297 examples (especially db-setup.mq5)
- Check SQLite documentation for syntax
- Test each table creation individually

**Stuck on Phase 2 (MQL5)?**

- Review Native folder examples for Database functions
- Test indicator handles separately before integrating
- Use Print() statements liberally for debugging

**Stuck on Phase 3 (Python)?**

- Start with simple pandas tutorial
- Test each function with sample data first
- Use Jupyter notebook for interactive testing

**Stuck on Phase 5 (LLM)?**

- Test LLM API separately first (curl or Postman)
- Start with simple prompts before complex templates
- Review API documentation for your chosen provider

**Stuck on Phase 6 (API)?**

- Follow FastAPI tutorial step-by-step
- Test endpoints locally before deploying
- Use Swagger UI (/docs) for interactive testing

---

### Questions to Answer

Before starting Phase 1, clarify:

1. **Do you have access to all 7 indicators?**
   - If not, which indicators will you use?
   - Are they custom or built-in?

2. **What symbol will you start with?**
   - EURUSD? GBPUSD? Other?
   - Does your broker provide good data for this symbol?

3. **Where will you develop?**
   - Local machine? VPS? Both?

4. **What's your timeline?**
   - Following 16-week plan? Faster? Slower?
   - Full-time or part-time?

---

## Recommended Starting Point

**My Recommendation:**

1. **Week 1:** Complete Phase 0 + start Phase 1
   - Set up environment (1-2 days)
   - Document indicators (1 day)
   - Create schema (2-3 days)
   - Test database creation (1 day)

2. **Ask for review:** Share your schema and indicator docs
   - Get feedback before building MQL5 service
   - Validate design decisions
   - Adjust if needed

3. **Week 2-3:** Continue Phase 1 + start Phase 2
   - Build db-setup.mq5 (1 day)
   - Start MQL5 service skeleton (2-3 days)
   - Implement one indicator first (2-3 days)
   - Test with one timeframe first

4. **Iterate:** Don't try to build everything at once
   - One indicator → all indicators
   - One timeframe → all timeframes
   - One feature → all features

---

Would you like me to help you with:

- **Option A:** Creating the initial schema-v1.0.sql file
- **Option B:** Documenting your 7 indicators (need your indicator files)
- **Option C:** Building the db-setup.mq5 script
- **Option D:** Something else?

Let me know which option you'd like to tackle first, and we'll get started! 🚀

---

**Document Version:** 1.0
**Last Updated:** 2025-11-22
**Status:** Ready for Implementation
