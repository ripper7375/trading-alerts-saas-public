Here's the complete file list for mt5-service (Part 6 - Flask MT5 Service):

MT5 Service File Structure
mt5-service/
├── .env.example # Environment variables template
├── Dockerfile # Docker container configuration
├── requirements.txt # Production dependencies
├── requirements-dev.txt # Development/test dependencies
├── run.py # Application entry point
│
├── app/
│ ├── **init**.py # Flask app factory (create*app)
│ │
│ ├── routes/
│ │ ├── **init**.py # Routes package init
│ │ ├── admin.py # Admin endpoints (/api/admin/*)
│ │ └── indicators.py # Indicator endpoints (/api/indicators/\_)
│ │
│ ├── services/
│ │ ├── **init**.py # Services package init
│ │ ├── health_monitor.py # Background health monitoring
│ │ ├── indicator_reader.py # MT5 indicator data reading
│ │ ├── mt5_connection_pool.py # Multi-terminal connection pool
│ │ └── tier_service.py # FREE/PRO tier validation
│ │
│ └── utils/
│ ├── **init**.py # Utils package init
│ └── constants.py # Tier symbols/timeframes constants
│
├── config/
│ └── mt5_terminals.json # MT5 terminal configurations
│
├── indicators/
│ └── README.md # Custom indicators documentation
│
└── tests/
├── conftest.py # pytest fixtures
├── test_connection_pool.py # Connection pool & tier tests
└── test_indicators.py # Indicator endpoint tests

File Count Summary
Category Count
Application Code 10
Configuration 4
Tests 3
Documentation 2
Total 19 files
Key Files by Function
Function Files
Entry Point run.py
App Factory app/**init**.py
API Routes routes/admin.py, routes/indicators.py
Core Services services/mt5_connection_pool.py, services/tier_service.py
Data Reading services/indicator_reader.py
Health Checks services/health_monitor.py
Constants utils/constants.py
Tests tests/test_connection_pool.py, tests/test_indicators.py
