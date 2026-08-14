# Part 06: MT5 Python Service - List of Files Completion

**Last Updated:** 2026-08-14
**Status:** ✅ Complete (100% verified)

---

## 📊 Overview

Part 06 provides the Python Flask microservice that interfaces directly with MetaTrader 5 (MT5) terminals, reads real-time indicator data, manages connection pooling, and handles real-time streaming.

---

## 📋 Production Files Inventory (15 Files)

| #   | File Path                                            | Status   | Description                                                                  |
| --- | ---------------------------------------------------- | -------- | ---------------------------------------------------------------------------- |
| 1   | ✅ `mt5-service/run.py`                              | Complete | Flask application entry point and development server script                  |
| 2   | ✅ `mt5-service/app/__init__.py`                     | Complete | Flask app factory initializing routes, WebSocket support, and terminal pools |
| 3   | ✅ `mt5-service/app/websocket.py`                    | Complete | WebSocket support for streaming live MT5 candle data                         |
| 4   | ✅ `mt5-service/app/routes/admin.py`                 | Complete | Admin endpoints for inspecting MT5 terminal status and pool health           |
| 5   | ✅ `mt5-service/app/routes/indicators.py`            | Complete | Indicator calculation and candle extraction endpoints                        |
| 6   | ✅ `mt5-service/app/services/health_monitor.py`      | Complete | Continuous health check and terminal reconnection monitor                    |
| 7   | ✅ `mt5-service/app/services/indicator_reader.py`    | Complete | Direct MT5 terminal buffer reader for custom indicators                      |
| 8   | ✅ `mt5-service/app/services/mt5_connection_pool.py` | Complete | Connection pool manager load-balancing requests across active MT5 terminals  |
| 9   | ✅ `mt5-service/app/services/tier_service.py`        | Complete | Tier authorization service validating indicator request entitlement          |
| 10  | ✅ `mt5-service/app/utils/constants.py`              | Complete | Service constants, timeframe mappings, and error definitions                 |
| 11  | ✅ `mt5-service/app/utils/symbol_resolver.py`        | Complete | Broker symbol mapping and normalization helper                               |
| 12  | ✅ `mt5-service/config/mt5_terminals.json`           | Complete | Configuration defining active MT5 terminal connection parameters             |
| 13  | ✅ `mt5-service/config/mt5_terminals_test.json`      | Complete | Test environment terminal configuration                                      |
| 14  | ✅ `mt5-service/Dockerfile`                          | Complete | Docker container definition for MT5 service deployment                       |
| 15  | ✅ `mt5-service/requirements.txt`                    | Complete | Production Python dependencies (Flask, MetaTrader5, redis, pydantic)         |

---

## 🔗 Related Documentation

- **Railway Gateway:** [`docs/files-completion-list/files-inventory/part-25-files-completion-railway-gateway.md`](file:///d:/SaaS%20Project/trading-alerts-saas-public/docs/files-completion-list/files-inventory/part-25-files-completion-railway-gateway.md)

---

**Part 06 Status:** ✅ Complete and production-ready
