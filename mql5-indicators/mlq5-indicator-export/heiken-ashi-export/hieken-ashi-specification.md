mql5-indicators/Heiken Ashi_Body Size Classification_Doji Detection.mq5

Please modify this indicator by adding data export functionality

Example of Data Export Format (11 Columns)

No TimeStamp Symbol Timeframe Close ha_open ha_high ha_low ha_close ha_classification ha_body_size ha_body_zscore

0 2025.11.06 13:20 USDJPY.i PERIOD_M5 153.719 148.817 148.817 148.797 148.797 3 0.020 0.00000

1 2025.11.06 13:25 USDJPY.i PERIOD_M5 153.707 148.807 148.819 148.796 148.804 3 0.003 0.00000

2 2025.11.06 13:30 USDJPY.i PERIOD_M5 153.646 148.805 148.815 148.801 148.809 0 0.003 0.00325

3 2025.11.06 13:35 USDJPY.i PERIOD_M5 153.619 148.807 148.815 148.730 148.779 3 0.028 0.02812

4 2025.11.06 13:40 USDJPY.i PERIOD_M5 153.603 148.793 148.793 148.726 148.751 3 0.042 0.04181

5 2025.11.06 13:45 USDJPY.i PERIOD_M5 153.665 148.772 148.791 148.728 148.768 3 0.004 0.00441

6 2025.11.06 13:50 USDJPY.i PERIOD_M5 153.674 148.770 148.800 148.769 148.790 0 0.020 0.02005

Here are details of the data export :

Column Description

No Row number (0-based index)

TimeStamp Bar timestamp (YYYY.MM.DD HH:MM)

Symbol Trading symbol

Timeframe Chart timeframe

Close Close price (symbol on chart close price, not Heiken Ashi Close price)

ha_open Heiken Ashi Open price as calculated by the indicator

ha_high Heiken Ashi High price as calculated by the indicator

ha_low Heiken Ashi Low price as calculated by the indicator

ha_close Heiken Ashi Close price as calculated by the indicator

ha_classification Classification 0-5 (see details below)

ha_body_size Heiken Ashi body size

ha_body_zscore Z-Score of body size

Details of ha_classification

Value Classification Description

0 TYPE_UP_NORMAL Bullish HA candle with normal body size (Z-Score < 2.0)

1 TYPE_UP_LARGE Bullish HA candle with large body size (2.0 ≤ Z-Score < 3.0)

2 TYPE_UP_EXTREME Bullish HA candle with extreme body size (Z-Score ≥ 3.0)

3 TYPE_DOWN_NORMAL Bearish HA candle with normal body size (Z-Score < 2.0)

4 TYPE_DOWN_LARGE Bearish HA candle with large body size (2.0 ≤ Z-Score < 3.0)

5 TYPE_DOWN_EXTREME Bearish HA candle with extreme body size (Z-Score ≥ 3.0)

where 2.0 and 3.0 are not hardcoded (they could be configured by user)

InpThresholdZ1_HA = 2.0 (separates NORMAL from LARGE)

InpThresholdZ2_HA = 3.0 (separates LARGE from EXTREME)

Classification Logic

The classification is determined by:

Direction: Whether HA Close ≥ HA Open (bullish) or < HA Open (bearish)

Body Size Z-Score: Compared against two thresholds:

InpThresholdZ1_HA = 2.0 (separates NORMAL from LARGE)

InpThresholdZ2_HA = 3.0 (separates LARGE from EXTREME)

Must have export data button on chart

Export txt file to Files folder in MT5

Name the newly modified mq5 file as Z-Score_Heiken_Ashi_EXPORT.mq5
