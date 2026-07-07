Advanced Indicator System: 57-column database schema with dynamic filtering ---> CHANGE TO ---> market_data_v6 — the new table, only written to by the Railway Gateway's queue consumer and only read by alert-checker.ts for XAUUSD (see v2_29_data_pipeline_architecture-files-completion.md)

===================================================

Tier System Features: FREE vs PRO

FREE Tier ($0/month):
5 Symbols & 3 Timeframes (15 chart combinations) ---> CHANGE TO ---> XAUUSD Symbol Only (only 1 symbol) with 2 Timeframes (M5 and M15 timeframe)
Limits: 5 alerts, 1 watchlist (5 items) ---> CHANGE TO ---> No alerts and No watchlist because XAUUSD is only a symbol in the App
Access: 24 DB columns (8 system + 16 basic indicators) ---> CHANGE TO ---> Access to all 79 DB columns (as per market_data_v6)

PRO Tier ($29/month, 7-Day Trial): ---> CHANGE TO ---> PRO Tier (configurable price/month, 7-Day Trial)
15 Symbols & 9 Timeframes (135 chart combinations) ---> CHANGE TO ---> XAUUSD Symbol Only (only 1 symbol) with 2 Timeframes (M5 and M15 timeframe)
Limits: 20 alerts, 5 watchlists (50 items) ---> CHANGE TO ---> Limits: 100 alerts, 0 watchlists (No watchlist because only XAUUSD in the App)
Access: Full 57 DB columns (all 8 advanced indicators) ---> CHANGE TO ---> Access to all 79 DB columns (as per market_data_v6)

==================================================

Indicator & Data Architecture

57-Column Database Schema: ---> CHANGE TO ---> 79 DB column Database Schema (as per market_data_v6)

FREE Indicators (16): Fractal Horizontal, Fractal Diagonal ---> CHANGE TO ---> Access to all 79 DB columns (as per market_data_v6)

PRO Indicators (33): Moving Averages, Body Momentum, Heiken Ashi, Keltner Channels, Support/Resistance, ZigZag ---> CHANGE TO ---> Access to all 79 DB columns (as per market_data_v6)

==================================================

Tier Validation & Access Control

Strict Server-Side Validation Functions:

Symbol/Timeframe validation (e.g., canAccessSymbol, validateChartAccess) ---> CHANGE TO ---> Not applicable to the new design as XAUUSD with both M5 and M15 are fully accessed by both FREE Tier and PRO Tier
 
Usage limits enforcement (e.g., canCreateAlert, canCreateWatchlist) ---> I have no idea about this related to new design please recommend me
Indicator/Column gating (e.g., canAccessColumn, canAccessIndicator) ---> I have no idea about this related to new design please recommend me


==================================================

Stacks below are ones that may be affected as consequence of changes to new design :

D:\SaaS Project\trading-alerts-saas-public\docs\files-completion-list\files-inventory\part-05-files-completion.md
D:\SaaS Project\trading-alerts-saas-public\docs\files-completion-list\files-inventory\part-07-files-completion.md
D:\SaaS Project\trading-alerts-saas-public\docs\files-completion-list\files-inventory\part-10-files-completion.md
D:\SaaS Project\trading-alerts-saas-public\docs\files-completion-list\files-inventory\part-11-files-completion.md
D:\SaaS Project\trading-alerts-saas-public\docs\files-completion-list\files-inventory\part-15-files-completion.md
D:\SaaS Project\trading-alerts-saas-public\docs\files-completion-list\files-inventory\part-16-files-completion.md

Please provide recommended details of how to modify/revise/update these stacks to support new design

===================================================

Difference between FREE Tier and PRO Tier under new design

1) Alert system + Notification system (FREE Tier = NONE; PRO Tier = AVAILABLE)
2) v2_29_multi-timeframe-visualisation-files-completion.md (FREE Tier = NONE; PRO Tier = AVAILABLE)
3) drawing-engine-line-alerts-files-completion (FREE Tier = NONE; PRO Tier = AVAILABLE)
