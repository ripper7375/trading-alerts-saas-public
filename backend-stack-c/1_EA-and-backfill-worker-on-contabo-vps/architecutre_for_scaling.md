I plan to use above architecutre for scaling. Does it is right approach ?

===============================

Data Sources (MT5, APIs, Webhooks)
↓
BullMQ Queue
↓
Workers
↓
PgBouncer (Primary Pool) ← manages WRITE connections
↓
PostgreSQL PRIMARY (Read + Write)
↓
Streaming Replication
↓
PostgreSQL REPLICAS (Read only)
↓
PgBouncer (Replica Pool) ← manages READ connections
↓
Multiple Concurrent Services
