Here's the complete list of files modified/created in this session for Part 6:
Files Modified
File Path Description
mt5-service/app/utils/constants.py Added PRO indicator configurations, MQL5 names mapping, and buffer mappings
mt5-service/app/services/indicator_reader.py Added fetch_pro_indicators() and 4 indicator-specific fetch functions (momentum_candles, keltner_channels, moving_averages, zigzag)
mt5-service/app/routes/indicators.py Updated to include PRO indicators in response based on user tier (X-User-Tier header)
Here's the complete list of files modified/created in this session for Part 3, 4, 7 and 9:
Files Created (New)
Path Description
lib/api/mt5-transform.ts Transform layer (Flask JSON → TypeScript, null → undefined)
lib/tier/constants.ts Indicator tier constants, metadata, colors
lib/tier/validator.ts Access control functions for tier-gated indicators
lib/tier/index.ts Module re-exports
components/charts/indicator-toggles.tsx UI component for toggling indicators with tier access control
components/charts/pro-indicator-overlay.tsx Chart rendering component for PRO indicators
Files Modified
Path Description
types/indicator.ts Added PRO indicator types (MomentumCandleType, KeltnerChannelData, ZigZagData, ProIndicatorData, etc.)
lib/api/mt5-client.ts Added MT5RawProIndicators interface
app/api/indicators/[symbol]/[timeframe]/route.ts Updated to transform and include PRO indicators in response
**tests**/api/indicators.test.ts Updated tests to expect proIndicatorsTransformed field
