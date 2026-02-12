#!/usr/bin/env python3
"""
Generate mock market data for MULTIPLE symbols and timeframes
Customizable date range, symbols, and timeframes
Format: 61 columns with | delimiter (Excel-compatible)
Schema: v3.0 — EA v2.27+ (9 system + 16 FREE + 36 PRO = 61 columns)
"""

import random
from datetime import datetime, timedelta

def generate_ohlcv(base_price, volatility=5.0):
    """Generate realistic OHLCV data"""
    open_price = base_price + random.uniform(-volatility, volatility)
    close_price = open_price + random.uniform(-volatility*2, volatility*2)

    high = max(open_price, close_price) + random.uniform(0, volatility)
    low = min(open_price, close_price) - random.uniform(0, volatility)

    volume = random.randint(1000, 10000)

    return round(open_price, 2), round(high, 2), round(low, 2), round(close_price, 2), volume

def generate_indicator_value(base_price, offset_percent=0.5):
    """Generate indicator value near price"""
    offset = base_price * (offset_percent / 100)
    return round(base_price + random.uniform(-offset, offset), 5)

def generate_market_data(symbol, timeframe, start_date, end_date, interval_minutes, base_price):
    """Generate mock market data for given parameters"""

    data = []
    current_time = start_date

    # Column headers matching MQ5 schema (61-column v3.0 — EA v2.27+)
    headers = [
        "timestamp",
        "symbol",
        "open",
        "high",
        "low",
        "close",
        "volume",
        "timeframe",
        "tema",
        "hrma",
        "smma",
        "Z-Score of body size",
        "Candle classification",
        "diag_asc_line_1",
        "diag_asc_line_2",
        "diag_asc_line_3",
        "diag_desc_line_1",
        "diag_desc_line_2",
        "diag_desc_line_3",
        "diag_high_map",
        "diag_low_map",
        "horiz_peak_line_1",
        "horiz_peak_line_2",
        "horiz_peak_line_3",
        "horiz_bottom_line_1",
        "horiz_bottom_line_2",
        "horiz_bottom_line_3",
        "horiz_high_map",
        "horiz_low_map",
        "ha_open",
        "ha_high",
        "ha_low",
        "ha_close",
        "ha_classification",
        "ha_body_size",
        "ha_body_zscore",
        "kc_ultra_extreme_upper",
        "kc_extreme_upper",
        "kc_uppermost",
        "kc_upper",
        "kc_upper_middle",
        "kc_lower_middle",
        "kc_lower",
        "kc_lowermost",
        "kc_extreme_lower",
        "kc_ultra_extreme_lower",
        "sr_support_4",
        "sr_support_3",
        "sr_support_2",
        "sr_support_1",
        "sr_resistance_1",
        "sr_resistance_2",
        "sr_resistance_3",
        "sr_resistance_4",
        "zigzag_high",
        "zigzag_low",
        "ema",
        "dual_tema_high",
        "dual_tema_low",
        "pinbar",
        "collected_at"
    ]

    data.append("|".join(headers))

    # Adjust volatility based on symbol type
    if "USD" in symbol and "XAU" not in symbol and "BTC" not in symbol:
        # Forex pairs (EURUSD, GBPUSD, etc.)
        volatility = 0.0005  # Small pip movements
    elif "XAU" in symbol:
        # Gold
        volatility = 5.0
    elif "BTC" in symbol:
        # Bitcoin
        volatility = 200.0
    else:
        # Default
        volatility = 0.01

    current_base = base_price

    while current_time < end_date:
        # Generate OHLCV
        open_price, high, low, close, volume = generate_ohlcv(current_base, volatility)

        # Update base price with some random walk
        current_base = close + random.uniform(-volatility, volatility)

        # Timestamp (Unix epoch)
        timestamp = int(current_time.timestamp())
        collected_at = int(datetime.now().timestamp())

        # Moving averages (near close price)
        tema = generate_indicator_value(close, 0.3)
        hrma = generate_indicator_value(close, 0.4)
        smma = generate_indicator_value(close, 0.5)

        # Z-Score and classification
        zscore = round(random.uniform(-3, 3), 5)
        classification = random.choice([-2, -1, 0, 1, 2])

        # Diagonal lines (ascending)
        diag_asc_1 = generate_indicator_value(low, 0.2)
        diag_asc_2 = generate_indicator_value(low, 0.4)
        diag_asc_3 = generate_indicator_value(low, 0.6)

        # Diagonal lines (descending)
        diag_desc_1 = generate_indicator_value(high, 0.2)
        diag_desc_2 = generate_indicator_value(high, 0.4)
        diag_desc_3 = generate_indicator_value(high, 0.6)

        # Maps (0.0 for most bars, only set when fractal detected)
        diag_high_map = round(high + random.uniform(0, volatility), 5) if random.random() > 0.8 else 0.0
        diag_low_map = round(low - random.uniform(0, volatility), 5) if random.random() > 0.8 else 0.0

        # Horizontal lines (peaks)
        horiz_peak_1 = generate_indicator_value(high, 0.1)
        horiz_peak_2 = generate_indicator_value(high, 0.2)
        horiz_peak_3 = generate_indicator_value(high, 0.3)

        # Horizontal lines (bottoms)
        horiz_bottom_1 = generate_indicator_value(low, 0.1)
        horiz_bottom_2 = generate_indicator_value(low, 0.2)
        horiz_bottom_3 = generate_indicator_value(low, 0.3)

        # Horizontal maps (0.0 for most bars, only set when fractal detected)
        horiz_high_map = round(high + random.uniform(0, volatility/2), 5) if random.random() > 0.75 else 0.0
        horiz_low_map = round(low - random.uniform(0, volatility/2), 5) if random.random() > 0.75 else 0.0

        # Heiken Ashi
        ha_open = round((open_price + close) / 2, 5)
        ha_close = round((open_price + high + low + close) / 4, 5)
        ha_high = round(max(high, ha_open, ha_close), 5)
        ha_low = round(min(low, ha_open, ha_close), 5)
        ha_classification = 1 if ha_close > ha_open else -1
        ha_body_size = round(abs(ha_close - ha_open), 5)
        ha_body_zscore = round(random.uniform(-2, 2), 5)

        # Keltner Channels
        kc_middle = close
        atr = abs(high - low)
        kc_ultra_extreme_upper = round(kc_middle + atr * 4.0, 5)
        kc_extreme_upper = round(kc_middle + atr * 3.0, 5)
        kc_uppermost = round(kc_middle + atr * 2.0, 5)
        kc_upper = round(kc_middle + atr * 1.0, 5)
        kc_upper_middle = round(kc_middle + atr * 0.5, 5)
        kc_lower_middle = round(kc_middle - atr * 0.5, 5)
        kc_lower = round(kc_middle - atr * 1.0, 5)
        kc_lowermost = round(kc_middle - atr * 2.0, 5)
        kc_extreme_lower = round(kc_middle - atr * 3.0, 5)
        kc_ultra_extreme_lower = round(kc_middle - atr * 4.0, 5)

        # Support/Resistance levels
        sr_support_4 = round(low - atr * 2.0, 5)
        sr_support_3 = round(low - atr * 1.5, 5)
        sr_support_2 = round(low - atr * 1.0, 5)
        sr_support_1 = round(low - atr * 0.5, 5)
        sr_resistance_1 = round(high + atr * 0.5, 5)
        sr_resistance_2 = round(high + atr * 1.0, 5)
        sr_resistance_3 = round(high + atr * 1.5, 5)
        sr_resistance_4 = round(high + atr * 2.0, 5)

        # ZigZag + EMA (3 columns — v3.0: zigzag_high/zigzag_low/ema)
        zigzag_high = round(high + random.uniform(0, volatility*2), 5) if random.random() > 0.7 else 0.0
        zigzag_low = round(low - random.uniform(0, volatility*2), 5) if random.random() > 0.7 else 0.0
        ema = generate_indicator_value(close, 0.6)

        # Dual TEMA (v2.27)
        dual_tema_high = round(high + random.uniform(-volatility/2, volatility/2), 5)
        dual_tema_low = round(low + random.uniform(-volatility/2, volatility/2), 5)

        # Pinbar detection (v2.27)
        pinbar = 1 if random.random() > 0.9 else 0

        # Build row (61 columns: 9 system + 16 FREE + 36 PRO)
        row = [
            str(timestamp),
            symbol,
            str(open_price),
            str(high),
            str(low),
            str(close),
            str(volume),
            timeframe,
            str(tema),
            str(hrma),
            str(smma),
            str(zscore),
            str(classification),
            str(diag_asc_1),
            str(diag_asc_2),
            str(diag_asc_3),
            str(diag_desc_1),
            str(diag_desc_2),
            str(diag_desc_3),
            str(diag_high_map),
            str(diag_low_map),
            str(horiz_peak_1),
            str(horiz_peak_2),
            str(horiz_peak_3),
            str(horiz_bottom_1),
            str(horiz_bottom_2),
            str(horiz_bottom_3),
            str(horiz_high_map),
            str(horiz_low_map),
            str(ha_open),
            str(ha_high),
            str(ha_low),
            str(ha_close),
            str(ha_classification),
            str(ha_body_size),
            str(ha_body_zscore),
            str(kc_ultra_extreme_upper),
            str(kc_extreme_upper),
            str(kc_uppermost),
            str(kc_upper),
            str(kc_upper_middle),
            str(kc_lower_middle),
            str(kc_lower),
            str(kc_lowermost),
            str(kc_extreme_lower),
            str(kc_ultra_extreme_lower),
            str(sr_support_4),
            str(sr_support_3),
            str(sr_support_2),
            str(sr_support_1),
            str(sr_resistance_1),
            str(sr_resistance_2),
            str(sr_resistance_3),
            str(sr_resistance_4),
            str(zigzag_high),
            str(zigzag_low),
            str(ema),
            str(dual_tema_high),
            str(dual_tema_low),
            str(pinbar),
            str(collected_at)
        ]

        data.append("|".join(row))

        # Move to next bar
        current_time += timedelta(minutes=interval_minutes)

    return data

def main():
    """
    ╔══════════════════════════════════════════════════════════╗
    ║  CONFIGURATION SECTION - CUSTOMIZE YOUR DATA GENERATION  ║
    ╚══════════════════════════════════════════════════════════╝
    """

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 1️⃣ DATE RANGE CONFIGURATION
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    start_date = datetime(2026, 2, 9, 0, 0, 0)   # Start: Feb 9, 2026 at midnight
    end_date = datetime(2026, 2, 11, 0, 0, 0)    # End: Feb 11, 2026 at midnight (2 days)

    # Other examples:
    # One week:   datetime(2026, 2, 16, 0, 0, 0)
    # One month:  datetime(2026, 3, 9, 0, 0, 0)
    # Trading day: datetime(2026, 2, 9, 17, 0, 0) for 9 AM - 5 PM

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 2️⃣ SYMBOL CONFIGURATION
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Format: (symbol_code, base_price, display_name)
    symbols = [
        ("XAUUSD", 2650.00, "Gold"),           # Gold vs USD
        ("EURUSD", 1.0850, "EUR/USD"),         # Euro vs USD
        ("GBPUSD", 1.2750, "GBP/USD"),         # British Pound vs USD
        ("USDJPY", 148.50, "USD/JPY"),         # USD vs Japanese Yen
        # Uncomment below to add more symbols:
        # ("BTCUSD", 45000.00, "Bitcoin"),     # Bitcoin
        # ("AUDUSD", 0.6650, "AUD/USD"),       # Australian Dollar
        # ("USDCAD", 1.3450, "USD/CAD"),       # USD vs Canadian Dollar
        # ("USDCHF", 0.8750, "USD/CHF"),       # USD vs Swiss Franc
    ]

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 3️⃣ TIMEFRAME CONFIGURATION
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # Format: (timeframe_code, interval_in_minutes)
    timeframes = [
        ("M5", 5),       # 5-minute bars
        ("M15", 15),     # 15-minute bars
        # Uncomment below to add more timeframes:
        # ("M1", 1),     # 1-minute bars
        # ("M30", 30),   # 30-minute bars
        # ("H1", 60),    # 1-hour bars
        # ("H4", 240),   # 4-hour bars
        # ("D1", 1440),  # Daily bars
    ]

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 4️⃣ GENERATION LOOP
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    print("╔" + "═" * 58 + "╗")
    print("║  MOCK MARKET DATA GENERATOR v3.0                         ║")
    print("║  Schema: EA v2.27+ (61 columns)                          ║")
    print("╚" + "═" * 58 + "╝")
    print()
    print(f"📅 Date Range: {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")
    print(f"📊 Symbols: {len(symbols)}")
    print(f"⏰ Timeframes: {len(timeframes)}")
    print(f"📁 Total Files: {len(symbols) * len(timeframes)}")
    print()

    total_files = 0
    total_rows = 0

    # Generate data for each symbol
    for symbol, base_price, name in symbols:
        print("┌" + "─" * 58 + "┐")
        print(f"│ {name:^56} │")
        print(f"│ Symbol: {symbol:<48} │")
        print("└" + "─" * 58 + "┘")

        # Generate data for each timeframe
        for tf_name, interval in timeframes:
            print(f"  [⏳] Generating {symbol} {tf_name}...", end=" ")

            # Generate the data
            data = generate_market_data(symbol, tf_name, start_date, end_date, interval, base_price)

            # Save to file
            filename = f"{symbol}_{tf_name}_mock_data.txt"
            with open(filename, "w") as f:
                f.write("\n".join(data))

            rows = len(data) - 1  # Exclude header
            total_files += 1
            total_rows += rows

            print(f"✅ {rows:,} rows → {filename}")

        print()

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    # 5️⃣ SUMMARY
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    print("╔" + "═" * 58 + "╗")
    print("║  GENERATION COMPLETE                                     ║")
    print("╚" + "═" * 58 + "╝")
    print()
    print(f"✅ Generated: {total_files} files")
    print(f"📊 Total Rows: {total_rows:,}")
    print(f"📁 Format: Pipe-delimited (|) with 61 columns")
    print()
    print("📖 HOW TO USE:")
    print("   1. Open Excel/Google Sheets")
    print("   2. Import as Text/CSV")
    print("   3. Set delimiter to: | (pipe)")
    print("   4. All 61 columns will be properly separated")
    print()
    print("🎯 NEXT STEPS:")
    print("   - Test data ingestion in your system")
    print("   - Validate all 61 columns are present")
    print("   - Check indicator values are realistic")
    print("   - Verify timestamp ranges match expectations")

if __name__ == "__main__":
    main()
