PostgreSQL (A) - Market Data (Time-Series)

Purpose: Market data storage & processing
Technology: PostgreSQL + TimescaleDB extension
Data Type: Time-series (OHLCV, indicators)
Write Pattern: High-volume, continuous writes (every 30s)
Read Pattern: Time-range queries, analytics
Size: Large (grows continuously)
Optimization: Compression, partitioning, continuous aggregates

Stores:

OHLCV data (15 symbols × 9 timeframes × 30s = 4,050 writes/hour)
Indicator values (fractals, trendlines, momentum, etc.)
Precomputed confluence scores
Historical market data (months to years)

Connected to:

Python Sync Script (writes)
Nest.js Backend (reads)
Redis (hot tier cache)

PostgreSQL (B) - User Data (Transactional)

Purpose: User management & application data
Technology: Standard PostgreSQL
Data Type: Relational (users, settings, alerts)
Write Pattern: Low-volume, transactional (user actions)
Read Pattern: CRUD operations, relational joins
Size: Small to medium (grows with users)
Optimization: Indexes, foreign keys, ACID transactions

Stores:

User accounts & authentication
Watchlists & preferences
Confluence thresholds & settings
Alert history & notifications
User sessions & permissions

Connected to:

Nest.js Backend (via Prisma ORM)
Next.js Frontend (indirect, through API)
