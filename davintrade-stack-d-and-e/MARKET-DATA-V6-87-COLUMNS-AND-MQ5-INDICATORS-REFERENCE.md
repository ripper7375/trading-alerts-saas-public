# DavinTrade Architecture Reference: 87 Columns in `market_data_v6` & MQL5 Indicator Suite

**Document Version:** 1.1.0  
**Document Code:** `MARKET-DATA-V6-79-COLUMNS-AND-MQ5-INDICATORS-REFERENCE.md` _(Upgraded to 87 Columns)_  
**Target Scope:** `XAUUSD` on `M5` and `M15` Timeframes  
**System Layer:** Data Pipeline (Stack C) ➔ PostgreSQL Datastore ➔ Conversational AI Co-Pilot (Stack D & E)  
**Last Updated:** 2026-09-05 _(Reflecting 2026-09-03 `best_fit` isolated-coexistence split into `best_fit_a` & `best_fit_b`)_

---

## 📌 1. Executive Summary & Data Pipeline Architecture

ตาราง `market_data_v6` (ใน PostgreSQL บน Railway และ SQLite บน Contabo VPS) ทำหน้าที่เป็น **Single Source of Truth (SSOT)** สำหรับข้อมูลการวิเคราะห์ทางเทคนิคทั้งหมดของ DavinTrade ตารางนี้ผสานรวมข้อมูลราคาดิบ (OHLCV) ร่วมกับ Indicator ขั้นสูงทางคณิตศาสตร์และสถิติ (SSA Centroid Regression 7 รูปแบบ, Fractal Support/Resistance, Z-Score Candle Volatility, และ ZigZag Market Structure) รวมทั้งสิ้น **87 คอลัมน์** _(อัปเกรดจาก 79 คอลัมน์เดิม หลังจากการทำ Migration แตก Variant `best_fit` ออกเป็น `best_fit_a` และ `best_fit_b`)_

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              END-TO-END DATA GENERATION & STORAGE PIPELINE                             │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. MT5 Terminal (Contabo VPS)                                                                          │
│    • 13 MQL5 Indicators export raw calculations every 5 minutes at second :59                         │
│                                                   │                                                    │
│                                                   ▼                                                    │
│ 2. SQLite Ingestion & Python Calc Stack                                                                 │
│    • Ingests Admin Layer (OHLCV, Crossovers, Fractals, ZigZag Pivots) into SQLite staging              │
│    • Python Calc Modules (`centroid_regression.py`, `fractal_lines.py`, `zscore_candle.py`,           │
│      `zigzag_metrics.py`) calculate derived lines and statistical classifications                      │
│                                                   │                                                    │
│                                                   ▼                                                    │
│ 3. Push Worker ➔ Railway Gateway (NestJS)                                                              │
│    • Idempotent UPSERT on `(symbol, timeframe, timestamp)`                                            │
│                                                   │                                                    │
│                                                   ▼                                                    │
│ 4. PostgreSQL `market_data_v6` (Wide Table: 87 Columns)                                                │
│    • Serves as the quantitative foundation for:                                                        │
│      - Engine 1 (VANNA NL2SQL)                                                                         │
│      - Engine 1.5A (MCD01-MCD10+ Discrete States & FREQ54 Signal Density)                              │
│      - Engine 1.5B (JSONB54 Deduplicated Storyline Narrative)                                          │
│      - Engine 1.5C (WACS54 Weighted Confluence Score)                                                  │
│      - Engine 2 (Multimodal Synthesis & Rules Engine)                                                  │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### รายละเอียดของ 13 MQL5 Indicators (Export Raw Calculations ทุก 5 นาที ณ วินาทีที่ :59)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 MQL5 INDICATOR SUITE ARCHITECTURE OVERVIEW                             │
├────┬─────────────────────────────────────────────────┬──────────────────────────────────────────────────┤
│ #  │ ชื่อไฟล์ MQL5 Indicator                         │ หน้าที่และหลักการคำนวณทางคณิตศาสตร์ / สถิติ      │
├────┼─────────────────────────────────────────────────┼──────────────────────────────────────────────────┤
│ 1  │ `ohlcvexportlightweight_v2_29.mq5`              │ ดึงประวัติ OHLCV 3,000 แท่ง พร้อมจัด Grid เวลา   │
│ 2  │ `2EDTCentroidRegressionBestFitNonMostRecentA...`│ Best-Fit A (Primary): SSA (30,6,3), DBSCAN,      │
│    │                                                 │ WLS (Lambda=0.000, Exclude=0), 2EDT Channels     │
│ 3  │ `2EDTCentroidRegressionBestFitNonMostRecentB...`│ Best-Fit B (Secondary): SSA (30,6,3), DBSCAN,    │
│    │                                                 │ WLS (Lambda=0.000, Exclude=3 ตัดจุดสวิงล่าสุด),  │
│    │                                                 │ รันแบบ Isolated Coexistence บนชาร์ตเดียวกัน      │
│ 4  │ `2EDTCentroidRegressionCherryPickA_v2_29.mq5`   │ Centroid Regression แบบ OLS (Cherry Pick ชุด A)  │
│ 5  │ `2EDTCentroidRegressionCherryPickB_v2_29.mq5`   │ Centroid Regression แบบ OLS (Cherry Pick ชุด B)  │
│ 6  │ `2EDTCentroidRegressionMostRecentLineExt...`    │ Centroid Regression แบบ OLS (N Most Recent)      │
│ 7  │ `2EDTCentroidRegressionNonMostRecentLineExtA...`│ Centroid Regression แบบ OLS (ตัดกลุ่มล่าสุด A)   │
│ 8  │ `2EDTCentroidRegressionNonMostRecentLineExtB...`│ Centroid Regression แบบ OLS (ตัดกลุ่มล่าสุด B)   │
│ 9  │ `2EDTFractalBestFitv5_v2_29.mq5`                │ เส้นแกนกลาง Best Flip Line + Fractal 2EDT        │
│ 10 │ `SingleBestResistanceLinev3_v2_29.mq5`          │ เส้นแนวต้านเดี่ยวที่ดีที่สุดจาก Upper Fractals   │
│ 11 │ `SingleBestSupportLinev3_v2_29.mq5`             │ เส้นแนวรับเดี่ยวที่ดีที่สุดจาก Lower Fractals    │
│ 12 │ `ZigZagExportv43_v2_29.mq5`                     │ ZigZag (12,5,3), โครงสร้างคลื่น HH/HL/LH/LL/EQ,  │
│    │                                                 │ Rolling Z-Score 50 Segments (%Chg, Bar, Speed)   │
│ 13 │ `zscoreohlccandleexport_v2_29.mq5`              │ Z-Score แท่งเทียน (Window 432, Z1=1.5, Z2=2.5)   │
│    │                                                 │ แยกทิศทางและระดับความรุนแรง 0 ถึง 5              │
└────┴─────────────────────────────────────────────────┴──────────────────────────────────────────────────┘
```

---

## 📊 2. High-Level Classification Matrix (12 หมวดหมู่ / รวม 87 Columns)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 MARKET_DATA_V6 87 COLUMNS CLASSIFICATION                               │
├────┬───────────────────────────────────────┬─────────┬──────────────┬──────────────────────────────────┤
│ #  │ หมวดหมู่ (Category)                    │ จำนวน   │ ช่วงคอลัมน์  │ บทบาทและแหล่งที่มา               │
├────┼───────────────────────────────────────┼─────────┼──────────────┼──────────────────────────────────┤
│ 1  │ Base OHLCV & Timeframe Grid           │ 8       │ Cols 1 – 8   │ MQL5 Admin Layer (Price Spine)   │
│ 2  │ Centroid Variant 1: `best_fit_a`      │ 8       │ Cols 9 – 16  │ Primary Best-Fit (Exclude=0)     │
│ 3  │ Centroid Variant 2: `best_fit_b`      │ 8       │ Cols 17 – 24 │ Secondary Best-Fit (Exclude=3)   │
│ 4  │ Centroid Variant 3: `cherry_a`        │ 8       │ Cols 25 – 32 │ OLS บน Centroid คัดเลือกชุด A    │
│ 5  │ Centroid Variant 4: `cherry_b`        │ 8       │ Cols 33 – 40 │ OLS บน Centroid คัดเลือกชุด B    │
│ 6  │ Centroid Variant 5: `most_recent`     │ 8       │ Cols 41 – 48 │ OLS บน N Centroids ล่าสุด        │
│ 7  │ Centroid Variant 6: `non_a`           │ 8       │ Cols 49 – 56 │ OLS ตัด Centroid ล่าสุดชุด A ออก │
│ 8  │ Centroid Variant 7: `non_b`           │ 8       │ Cols 57 – 64 │ OLS ตัด Centroid ล่าสุดชุด B ออก │
│ 9  │ Fractal Lines & Support/Resistance    │ 5       │ Cols 65 – 69 │ Python `fractal_lines.py`        │
│ 10 │ Z-Score Candle Volatility             │ 3       │ Cols 70 – 72 │ Python `zscore_candle.py`        │
│ 11 │ ZigZag Market Structure & Metrics     │ 11      │ Cols 73 – 83 │ MQL5 Pivot + Python `zigzag.py`  │
│ 12 │ Provenance & Pipeline Metadata        │ 4       │ Cols 84 – 87 │ ระบบ Ingestion & Audit Sync      │
├────┴───────────────────────────────────────┴─────────┴──────────────┴──────────────────────────────────┤
│    รวมทั้งสิ้น                               │ 87 Cols │ Cols 1 – 87  │ (เดิม 79 + 8 คอลัมน์ Best-Fit B) │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔍 3. รายละเอียดและคำอธิบาย 87 Columns ในเชิงลึก (Column-by-Column Data Dictionary)

### หมวดที่ 1: Base OHLCV & Timeframe Grid (คอลัมน์ 1 – 8)

_บทบาท: โครงสร้างเวลาและแท่งเทียนหลักที่ผ่านการจัดเข้ากริดเวลา M5 (300 วินาที) หรือ M15 (900 วินาที) เรียบร้อยแล้ว_

| #   | ชื่อคอลัมน์     | Data Type | ที่มา (Origin)   | คำอธิบายและบทบาททางคณิตศาสตร์                                                       |
| :-- | :-------------- | :-------- | :--------------- | :---------------------------------------------------------------------------------- |
| 1   | **`timestamp`** | `INTEGER` | MQL5 (Adjusted)  | เวลาแท่งเทียนในรูปแบบ Unix Timestamp (UTC วินาที) ที่ถูกปัดเศษเข้ากริดเวลา (M5/M15) |
| 2   | **`symbol`**    | `TEXT`    | Static           | สัญลักษณ์สินทรัพย์ ล็อคตายตัวที่ `'XAUUSD'` เท่านั้น                                |
| 3   | **`timeframe`** | `TEXT`    | MQL5             | กรอบเวลา ล็อคเฉพาะ `'M5'` (Micro Execution) หรือ `'M15'` (Macro Structure)          |
| 4   | **`open`**      | `DOUBLE`  | MQL5 `raw_ohlcv` | ราคาเปิดของแท่งเทียน (USD ต่อ Troy Ounce)                                           |
| 5   | **`high`**      | `DOUBLE`  | MQL5 `raw_ohlcv` | ราคาสูงสุดของแท่งเทียน (USD ต่อ Troy Ounce)                                         |
| 6   | **`low`**       | `DOUBLE`  | MQL5 `raw_ohlcv` | ราคาต่ำสุดของแท่งเทียน (USD ต่อ Troy Ounce)                                         |
| 7   | **`close`**     | `DOUBLE`  | MQL5 `raw_ohlcv` | ราคาปิดของแท่งเทียน (USD ต่อ Troy Ounce)                                            |
| 8   | **`volume`**    | `INTEGER` | MQL5 `raw_ohlcv` | ปริมาณ Tick Volume ที่บันทึกได้ในแท่งเทียนนั้น                                      |

---

### หมวดที่ 2 ถึง 8: Centroid Regression 7 Variants (คอลัมน์ 9 – 64)

_หลักการ: แต่ละ Variant ใช้การสกัดข้อมูล Singular Spectrum Analysis (SSA Window=30, Rank=6) และหาสัญญาณ Crossover ของ SSA กับ EMA_SSA (Signal=3) จากนั้นนำจุดตัดมาจัดกลุ่มเป็น Centroid ด้วย Clustering Algorithm แล้วสร้างเส้น Baseline (Base_FL) พร้อมขอบช่องความกว้าง Equidistant Trendlines (UOEDT, LOEDT)_

#### 🔹 Centroid Variant 1: `best_fit_a` (คอลัมน์ 9 – 16)

_(Primary Instance: อดีตคือ `best_fit` เดี่ยวเดิม มีการ Rename Lossless ใน Database; ค่าพารามิเตอร์ `InpRegCentroids=5`, `InpExcludeRecentCentroids=0`, `InpTimeDecayLambda=0.000` โดยนับรวมจุด Centroid ล่าสุดเข้าคำนวณทั้งหมด ไม่ตัดทิ้ง)_

| #   | ชื่อคอลัมน์                     | Data Type | ที่มา (Origin)   | คำอธิบายและบทบาททางคณิตศาสตร์                                             |
| :-- | :------------------------------ | :-------- | :--------------- | :------------------------------------------------------------------------ |
| 9   | **`best_fit_a_horiz_high_map`** | `DOUBLE`  | MQL5 Admin Layer | จุดยอด Fractal บนสุดของรอบ (Upper Fractal Map Symbol 108)                 |
| 10  | **`best_fit_a_horiz_low_map`**  | `DOUBLE`  | MQL5 Admin Layer | จุดยอด Fractal ล่างสุดของรอบ (Lower Fractal Map Symbol 108)               |
| 11  | **`best_fit_a_ssa`**            | `DOUBLE`  | MQL5 Admin Layer | ค่าเส้นแนวโน้ม Singular Spectrum Analysis (SSA) กรอง Noise                |
| 12  | **`best_fit_a_ema_ssa`**        | `DOUBLE`  | MQL5 Admin Layer | ค่าเส้น Exponential Moving Average ของเส้น SSA (Trigger Line)             |
| 13  | **`best_fit_a_crossing`**       | `INTEGER` | MQL5 Admin Layer | สัญญาณการตัดกัน ($1$ = เกิด Crossover บนแท่งนี้, $0$ หรือ `NULL` = ไม่มี) |
| 14  | **`best_fit_a_base_fl`**        | `DOUBLE`  | Python Calc      | เส้นแกนกลาง Baseline (Centroid Flip Line) จาก WLS Regression              |
| 15  | **`best_fit_a_uoedt`**          | `DOUBLE`  | Python Calc      | เส้นกรอบบน Upper Outermost EDT (โซนแนวต้าน Overbought / Target)           |
| 16  | **`best_fit_a_loedt`**          | `DOUBLE`  | Python Calc      | เส้นกรอบล่าง Lower Outermost EDT (โซนแนวรับ Oversold / Reversal)          |

#### 🔹 Centroid Variant 2: `best_fit_b` (คอลัมน์ 17 – 24)

_(Secondary Instance: Preset ใหม่เพิ่มเมื่อ 2026-09-03; ค่าพารามิเตอร์ `InpRegCentroids=5`, `InpExcludeRecentCentroids=3`, `InpTimeDecayLambda=0.000` โดยจงใจ **ตัด Centroid ล่าสุดออก 3 จุด** เพื่อจับแนวโน้มหลักของโครงสร้างคลื่นที่แท้จริง ไม่ให้ถูกสวิงระยะสั้นดึงเส้นให้เอียง)_

| #   | ชื่อคอลัมน์                     | Data Type | ที่มา (Origin)   | คำอธิบายและบทบาททางคณิตศาสตร์                         |
| :-- | :------------------------------ | :-------- | :--------------- | :---------------------------------------------------- |
| 17  | **`best_fit_b_horiz_high_map`** | `DOUBLE`  | MQL5 Admin Layer | จุดยอด Fractal บนสุดของรอบสำหรับชุด Best-Fit B        |
| 18  | **`best_fit_b_horiz_low_map`**  | `DOUBLE`  | MQL5 Admin Layer | จุดยอด Fractal ล่างสุดของรอบสำหรับชุด Best-Fit B      |
| 19  | **`best_fit_b_ssa`**            | `DOUBLE`  | MQL5 Admin Layer | ค่าเส้น SSA สำหรับชุด Best-Fit B                      |
| 20  | **`best_fit_b_ema_ssa`**        | `DOUBLE`  | MQL5 Admin Layer | ค่าเส้น EMA SSA สำหรับชุด Best-Fit B                  |
| 21  | **`best_fit_b_crossing`**       | `INTEGER` | MQL5 Admin Layer | สัญญาณ Crossover สำหรับชุด Best-Fit B                 |
| 22  | **`best_fit_b_base_fl`**        | `DOUBLE`  | Python Calc      | เส้นแกนกลาง Base_FL คำนวณแบบตัด Centroid ล่าสุด 3 จุด |
| 23  | **`best_fit_b_uoedt`**          | `DOUBLE`  | Python Calc      | เส้นกรอบบน UOEDT ของชุด Best-Fit B                    |
| 24  | **`best_fit_b_loedt`**          | `DOUBLE`  | Python Calc      | เส้นกรอบล่าง LOEDT ของชุด Best-Fit B                  |

#### 🔹 Centroid Variant 3: `cherry_a` (คอลัมน์ 25 – 32)

_ใช้ Ordinary Least Squares (OLS) กับกลุ่ม Centroids ที่คัดเลือกแบบ Cherry-Pick กลุ่ม A_

- **25. `cherry_a_horiz_high_map`**, **26. `cherry_a_horiz_low_map`** _(DOUBLE - MQL5)_
- **27. `cherry_a_ssa`**, **28. `cherry_a_ema_ssa`** _(DOUBLE - MQL5)_
- **29. `cherry_a_crossing`** _(INTEGER - MQL5)_
- **30. `cherry_a_base_fl`**, **31. `cherry_a_uoedt`**, **32. `cherry_a_loedt`** _(DOUBLE - Python)_

#### 🔹 Centroid Variant 4: `cherry_b` (คอลัมน์ 33 – 40)

_ใช้ Ordinary Least Squares (OLS) กับกลุ่ม Centroids ที่คัดเลือกแบบ Cherry-Pick กลุ่ม B_

- **33. `cherry_b_horiz_high_map`**, **34. `cherry_b_horiz_low_map`** _(DOUBLE - MQL5)_
- **35. `cherry_b_ssa`**, **36. `cherry_b_ema_ssa`** _(DOUBLE - MQL5)_
- **37. `cherry_b_crossing`** _(INTEGER - MQL5)_
- **38. `cherry_b_base_fl`**, **39. `cherry_b_uoedt`**, **40. `cherry_b_loedt`** _(DOUBLE - Python)_

#### 🔹 Centroid Variant 5: `most_recent` (คอลัมน์ 41 – 48)

_ใช้ OLS Regression บนกลุ่ม Centroid ล่าสุด $N$ จุด เพื่อจับทิศทางโมเมนตัมปัจจุบัน_

- **41. `most_recent_horiz_high_map`**, **42. `most_recent_horiz_low_map`** _(DOUBLE - MQL5)_
- **43. `most_recent_ssa`**, **44. `most_recent_ema_ssa`** _(DOUBLE - MQL5)_
- **45. `most_recent_crossing`** _(INTEGER - MQL5)_
- **46. `most_recent_base_fl`**, **47. `most_recent_uoedt`**, **48. `most_recent_loedt`** _(DOUBLE - Python)_

#### 🔹 Centroid Variant 6: `non_a` (คอลัมน์ 49 – 56)

_ใช้ OLS Regression โดยตัด Centroid ล่าสุดชุด A ออก เพื่อดูโครงสร้างแกนหลักที่แท้จริง_

- **49. `non_a_horiz_high_map`**, **50. `non_a_horiz_low_map`** _(DOUBLE - MQL5)_
- **51. `non_a_ssa`**, **52. `non_a_ema_ssa`** _(DOUBLE - MQL5)_
- **53. `non_a_crossing`** _(INTEGER - MQL5)_
- **54. `non_a_base_fl`**, **55. `non_a_uoedt`**, **56. `non_a_loedt`** _(DOUBLE - Python)_

#### 🔹 Centroid Variant 7: `non_b` (คอลัมน์ 57 – 64)

_ใช้ OLS Regression โดยตัด Centroid ล่าสุดชุด B ออก_

- **57. `non_b_horiz_high_map`**, **58. `non_b_horiz_low_map`** _(DOUBLE - MQL5)_
- **59. `non_b_ssa`**, **60. `non_b_ema_ssa`** _(DOUBLE - MQL5)_
- **61. `non_b_crossing`** _(INTEGER - MQL5)_
- **62. `non_b_base_fl`**, **63. `non_b_uoedt`**, **64. `non_b_loedt`** _(DOUBLE - Python)_

---

### หมวดที่ 9: Fractal Trendlines & Best Support / Resistance (คอลัมน์ 65 – 69)

_บทบาท: คำนวณเส้นแนวโน้มและโซนแนวรับ-แนวต้านที่มีการสัมผัส (Touches) สูงที่สุดตามหลักเรขาคณิต_

| #   | ชื่อคอลัมน์           | Data Type | ที่มา (Origin)            | คำอธิบายและบทบาททางคณิตศาสตร์                                                     |
| :-- | :-------------------- | :-------- | :------------------------ | :-------------------------------------------------------------------------------- |
| 65  | **`fractal_best_fl`** | `DOUBLE`  | Python `fractal_lines.py` | เส้นแกนกลาง Best Flip Line ที่ลากพาดผ่านยอด Fractal ทั้งบนและล่างที่มีคะแนนสูงสุด |
| 66  | **`fractal_uoedt`**   | `DOUBLE`  | Python `fractal_lines.py` | เส้นขอบบนสุด Upper Outermost EDT คู่ขนานกับ Fractal Best FL                       |
| 67  | **`fractal_loedt`**   | `DOUBLE`  | Python `fractal_lines.py` | เส้นขอบล่างสุด Lower Outermost EDT คู่ขนานกับ Fractal Best FL                     |
| 68  | **`best_resistance`** | `DOUBLE`  | Python `fractal_lines.py` | เส้นแนวต้านเดี่ยวที่ดีที่สุด (Single Best Resistance) จาก Upper Fractals          |
| 69  | **`best_support`**    | `DOUBLE`  | Python `fractal_lines.py` | เส้นแนวรับเดี่ยวที่ดีที่สุด (Single Best Support) จาก Lower Fractals              |

---

### หมวดที่ 10: Z-Score Candle Volatility (คอลัมน์ 70 – 72)

_บทบาท: วิเคราะห์ความผิดปกติของขนาดเนื้อแท่งเทียนเทียบกับความผันผวนย้อนหลัง 432 แท่ง_

| #   | ชื่อคอลัมน์               | Data Type | ที่มา (Origin)            | คำอธิบายและบทบาททางคณิตศาสตร์                                                                                                                                                                                                                                                                                                                                      |
| :-- | :------------------------ | :-------- | :------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 70  | **`body_direction`**      | `INTEGER` | Python `zscore_candle.py` | ทิศทางแท่งเทียน: $+1$ (Bullish / เขียว), $-1$ (Bearish / แดง), $0$ (Doji)                                                                                                                                                                                                                                                                                          |
| 71  | **`body_size`**           | `DOUBLE`  | Python `zscore_candle.py` | ขนาดเนื้อเทียนในรูปค่าสัมบูรณ์ Z-score $\|Z\| = \frac{\|C - O\| - \mu}{\sigma}$ เทียบกับรอบ 432 แท่ง                                                                                                                                                                                                                                                               |
| 72  | **`body_classification`** | `INTEGER` | Python `zscore_candle.py` | รหัสระดับความรุนแรงของแท่งเทียน (0 ถึง 5):<br>• `0`: UP_NORMAL ($\|Z\| < 1.5$ เขียว)<br>• `1`: UP_LARGE ($1.5 \le \|Z\| < 2.5$ เขียวใหญ่)<br>• `2`: UP_EXTREME ($\|Z\| \ge 2.5$ เขียวระเบิดความผันผวน)<br>• `3`: DOWN_NORMAL ($\|Z\| < 1.5$ แดง)<br>• `4`: DOWN_LARGE ($1.5 \le \|Z\| < 2.5$ แดงใหญ่)<br>• `5`: DOWN_EXTREME ($\|Z\| \ge 2.5$ แดงระเบิดความผันผวน) |

---

### หมวดที่ 11: ZigZag Market Structure & Metrics (คอลัมน์ 73 – 83)

_บทบาท: บันทึกโครงสร้าง Price Action และ Smart Money Market Structure (ค่าจะมีบนแท่งที่เกิด Pivot Swing เท่านั้น แท่งทั่วไปเป็น `NULL`)_

| #   | ชื่อคอลัมน์                      | Data Type | ที่มา (Origin)             | คำอธิบายและบทบาททางคณิตศาสตร์                                                                                                                                                                                                                                                                                                                                                  |
| :-- | :------------------------------- | :-------- | :------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 73  | **`zigzag_point_type`**          | `TEXT`    | MQL5 `ZigZagExport`        | ประเภทจุดสวิง: `'Peak'` (ยอดคลื่นบน) หรือ `'Bottom'` (ก้นคลื่นล่าง)                                                                                                                                                                                                                                                                                                            |
| 74  | **`zigzag_current_point`**       | `DOUBLE`  | MQL5 `ZigZagExport`        | ระดับราคา ณ จุดสวิงที่ยืนยันแล้ว (USD)                                                                                                                                                                                                                                                                                                                                         |
| 75  | **`zigzag_price_change`**        | `DOUBLE`  | Python `zigzag_metrics.py` | ผลต่างราคาจากจุดสวิงก่อนหน้า ($\Delta P = P_{\text{current}} - P_{\text{previous}}$)                                                                                                                                                                                                                                                                                           |
| 76  | **`zigzag_pct_change`**          | `DOUBLE`  | Python `zigzag_metrics.py` | อัตราการเปลี่ยนแปลงราคาเป็นร้อยละ ($\% \Delta P = \frac{\Delta P}{P_{\text{previous}}} \times 100$)                                                                                                                                                                                                                                                                            |
| 77  | **`zigzag_pct_change_class`**    | `INTEGER` | Python `zigzag_metrics.py` | Z-score Classification ของระยะวิ่งเปอร์เซ็นต์ (0-2 ขาขึ้น, 3-5 ขาลง)                                                                                                                                                                                                                                                                                                           |
| 78  | **`zigzag_bars`**                | `INTEGER` | Python `zigzag_metrics.py` | จำนวนแท่งเทียนที่ใช้ในการวิ่งของคลื่นนี้ (Wave Duration)                                                                                                                                                                                                                                                                                                                       |
| 79  | **`zigzag_bars_class`**          | `INTEGER` | Python `zigzag_metrics.py` | Z-score Classification ของระยะเวลาที่ใช้ในการวิ่ง (0-5)                                                                                                                                                                                                                                                                                                                        |
| 80  | **`zigzag_price_per_bar`**       | `DOUBLE`  | Python `zigzag_metrics.py` | ความเร็วการเคลื่อนที่ของราคาต่อ 1 แท่ง ($\text{Velocity} = \frac{\|\Delta P\|}{\text{Bars}}$)                                                                                                                                                                                                                                                                                  |
| 81  | **`zigzag_price_per_bar_class`** | `INTEGER` | Python `zigzag_metrics.py` | Z-score Classification ของความเร็วราคา (0-5)                                                                                                                                                                                                                                                                                                                                   |
| 82  | **`zigzag_slope`**               | `DOUBLE`  | Python `zigzag_metrics.py` | มุมความชันเชิงเรขาคณิตของคลื่นในหน่วยองศา ($\arctan(\text{PricePerBar}) \times \frac{180}{\pi}$)                                                                                                                                                                                                                                                                               |
| 83  | **`zigzag_category`**            | `TEXT`    | Python `zigzag_metrics.py` | สภาวะโครงสร้างตลาด Smart Money Concept:<br>• `'HH'`: Higher High (ยอดทำจุดสูงสุดใหม่)<br>• `'HL'`: Higher Low (ก้นยกตัวสูงขึ้น = Uptrend)<br>• `'LH'`: Lower High (ยอดต่ำลง = Downtrend/Reversal)<br>• `'LL'`: Lower Low (ก้นทำจุดต่ำสุดใหม่ = Downtrend)<br>• `'EQH'`: Equal High (ทดสอบยอดเดิมไม่ผ่าน $\pm 0.5\%$)<br>• `'EQL'`: Equal Low (ทดสอบก้นเดิมเท่ากัน $\pm 0.5\%$) |

---

### หมวดที่ 12: Data Provenance & Pipeline Metadata (คอลัมน์ 84 – 87)

_บทบาท: ติดตามความถูกต้อง ตรวจสอบความสมบูรณ์ และการ Sync ข้อมูลระหว่าง VPS, Gateway และ Database_

| #   | ชื่อคอลัมน์         | Data Type | ที่มา (Origin)        | คำอธิบายและบทบาททางคณิตศาสตร์                                        |
| :-- | :------------------ | :-------- | :-------------------- | :------------------------------------------------------------------- |
| 84  | **`cycle_id`**      | `INTEGER` | Pipeline Tracking     | ID รอบการดึงข้อมูล อ้างอิงตาราง `collection_cycles` บน Contabo VPS   |
| 85  | **`collected_at`**  | `INTEGER` | Ingestion Worker      | เวลา Unix Timestamp ที่ไฟล์ Export ดิบถูกดึงเข้ามาประมวลผล           |
| 86  | **`calculated_at`** | `INTEGER` | Python Worker         | เวลา Unix Timestamp ที่โมดูล Python คำนวณค่า Derived เสร็จสิ้น       |
| 87  | **`synced_at`**     | `INTEGER` | Push Worker / Gateway | เวลา Unix Timestamp ที่แถวข้อมูลนี้ถูกส่งเข้า Railway Gateway สำเร็จ |

---

## ⚙️ 4. สรุปการทำงานของ MQL5 Indicator Suite ในโฟลเดอร์ `mq5/` (13 Indicators)

ในการส่งข้อมูลเข้าสู่ Pipeline ระบบอาศัย Expert Advisor และ Indicator ทั้งสิ้น **13 ตัว** บน MetaTrader 5 ทำงานคู่ขนานกันทุก 5 นาที ณ วินาทีที่ 59 (`InpExportSecond = 59`):

### 1. `ohlcvexportlightweight_v2_29.mq5`

- **หน้าที่:** ดึงข้อมูลแท่งเทียนดิบ Open, High, Low, Close, Volume ย้อนหลัง 3,000 แท่ง
- **กลไก:** ใช้ `CopyTime`, `CopyOpen`, `CopyHigh`, `CopyLow`, `CopyClose`, `CopyTickVolume` พร้อม Retry Mechanism 5 ครั้ง และส่งออกเป็น Text File รูปแบบ Tab-Delimited

### 2. กลุ่ม Centroid Regression Indicators (7 ตัว)

- **`2EDTCentroidRegressionBestFitNonMostRecentA_v2_29.mq5` (Best-Fit A):**
  - **Primary Instance:** ทำงานบนชาร์ตแบบ Isolated Coexistence (Corner ล่างขวา, ปุ่ม `V394_5LA_ExportButton`)
  - ใช้ SSA (Window=30, Rank=6, Signal=3) + DBSCAN Clustering
  - พารามิเตอร์: `InpRegCentroids=5`, `InpExcludeRecentCentroids=0`, `InpTimeDecayLambda=0.000` (Equal-Weighting ถ่วงน้ำหนักทุกแท่งเท่ากัน 100%), `MinTouches=2`
  - ส่งออกไฟล์: `Centriod_Best_Fit_A_XAUUSD_{TF}.txt` และ `_Statistic.txt`
- **`2EDTCentroidRegressionBestFitNonMostRecentB_v2_29.mq5` (Best-Fit B):**
  - **Secondary Instance:** ทำงานคู่ขนานบนชาร์ตเดียวกัน (Corner ล่างซ้าย, ปุ่ม `V394_5LB_ExportButton`, สี PaleTurquoise/DodgerBlue)
  - พารามิเตอร์: `InpRegCentroids=5`, `InpExcludeRecentCentroids=3` (ตัด Centroid ล่าสุด 3 จุดออกเพื่อดูโครงสร้างหลัก), `InpTimeDecayLambda=0.000`, `MinTouches=2`
  - ส่งออกไฟล์: `Centriod_Best_Fit_B_XAUUSD_{TF}.txt` และ `_Statistic.txt`
- **`2EDTCentroidRegressionCherryPickA_v2_29.mq5` & `CherryPickB`:**
  - ใช้ OLS Regression บน Centroids ที่คัดเลือกตามอัลกอริทึม Cherry-Pick ชุด A และ B
- **`2EDTCentroidRegressionMostRecentLineExtension_v2_29.mq5`:**
  - ใช้ OLS Regression บนกลุ่ม Centroid ล่าสุด $N$ จุดเพื่อดูทิศทางปัจจุบัน
- **`2EDTCentroidRegressionNonMostRecentLineExtensionA_v2_29.mq5` & `NonMostRecentB`:**
  - ใช้ OLS Regression โดยตัด Centroids ในกล่องล่าสุดออก เพื่อตัด Noise ระยะสั้น

### 3. กลุ่ม Fractal Trendlines & Support/Resistance Indicators (3 ตัว)

- **`2EDTFractalBestFitv5_v2_29.mq5`:**
  - หาเส้นแกนกลาง Flip Line ที่พาดผ่านทั้ง Upper และ Lower Fractals 35 แท่งที่มีจำนวนการสัมผัส (Touches) สูงสุด
  - คำนวณระยะ Offset เพื่อสร้างขอบ UOEDT และ LOEDT
- **`SingleBestResistanceLinev3_v2_29.mq5`:**
  - สแกน Upper Fractals เพื่อสร้างเส้นแนวต้านเดี่ยวที่มีคะแนนสัมผัสสูงสุด
- **`SingleBestSupportLinev3_v2_29.mq5`:**
  - สแกน Lower Fractals เพื่อสร้างเส้นแนวรับเดี่ยวที่มีคะแนนสัมผัสสูงสุด

### 4. `ZigZagExportv43_v2_29.mq5`

- **หน้าที่:** ตรวจจับยอด Peak และก้น Bottom ของคลื่น ZigZag (Depth=12, Deviation=5, Backstep=3)
- **กลไก:**
  - เปรียบเทียบจุดสวิงปัจจุบันกับ 2 สวิงก่อนหน้า เพื่อจำแนกประเภทโครงสร้าง (`HH`, `HL`, `LH`, `LL`, `EQH`, `EQL`)
  - คำนวณ Sample Z-Score ย้อนหลัง 50 Segments เพื่อแบ่งระดับความผิดปกติของขนาดคลื่น (% Change), ความยาวแท่ง (Bars), และความเร็วราคา (Price per bar)

### 5. `zscoreohlccandleexport_v2_29.mq5`

- **หน้าที่:** วิเคราะห์ความผิดปกติของขนาดเนื้อแท่งเทียน (Candle Body Size)
- **กลไก:**
  - คำนวณ Sample Mean ($\mu$) และ Sample Standard Deviation ($\sigma$) ของขนาดเนื้อเทียน $|Close - Open|$ ย้อนหลัง 432 แท่ง
  - แปลงเป็น Z-Score: $Z = \frac{|C - O| - \mu}{\sigma}$
  - แยกประเภทตามทิศทางแท่งเทียนและ Threshold: $Z_1 = 1.5$ (Large) และ $Z_2 = 2.5$ (Extreme) เป็น 6 ระดับ (0 ถึง 5)

---

_เอกสารฉบับนี้ได้รับการอัปเดตให้ตรงตามสถานะปัจจุบันของ Database Schema (87 Columns), Data Pipeline Blueprint v2.29 และ Prisma Schema ล่าสุด._
