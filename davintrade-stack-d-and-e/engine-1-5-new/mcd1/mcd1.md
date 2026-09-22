# MCD1 Specification: M15 Primary Trend Direction Evaluator

**DavinTrade Architecture:** Stack D — Engine 1.5A Module  
**Asset:** `XAUUSD` | **Timeframe:** `M15`  
**Evaluation Framework:** Dual-Horizon Framework (Macro Structure + Dynamic Micro Regime)  
**Status:** Certified & Production-Ready  
**Last Updated:** 2026-09-20 (Reflecting Upstream Upgraded Market Data V6 & Indicator Statistics Schema)

---

## 1. วัตถุประสงค์และหน้าที่หลัก (Core Mandate)

**MCD1** ทำหน้าที่หาคำตอบเชิงคุณภาพและคณิตศาสตร์ว่า:

> **"ณ ปัจจุบัน แนวโน้มราคาหลัก (Primary Trend) ของ XAUUSD บน Timeframe M15 เป็นเทรนอะไร และพฤติกรรมราคาระยะสั้น (Micro Regime) มีสภาวะอย่างไร สอดคล้องหรือสวนทางกับโครงสร้างหลัก?"**

เพื่อความแม่นยำสูงสุดและสะท้อนความจริงของตลาดทองคำ ระบบใช้ **Dual-Horizon Framework** โดยไม่ยึดติดกับตัวเลขคงที่ 54 แท่งแบบเดิม แต่ประเมิน 2 ระดับอย่างสมดุล:

1. **ระดับ Macro Structure (แนวโน้มและโครงสร้างหลัก):** ประเมินจากช่วงความยาวของช่องสัญญาณจริง **`EDT Time Horizon`** ($T_{\text{EDT}}$ ดึงจาก `containment_n` ใน `indicator_statistics`), อัตราการรองรับ **`containment_rate`** ($\ge 50\%$), และมุมความชัน **`regression_angle`**
2. **ระดับ Micro Regime (พฤติกรรมราคาระยะสั้นล่าสุด):** ประเมินแบบ Dynamic คิดเป็นอย่างน้อย **5.0% ของ EDT Time Horizon** โดยมี **Minimum Floor = 96 แท่ง** (คิดเป็น 24 ชั่วโมง หรือ 1 วันทำการเต็มของ M15) เพื่อกรองสัญญาณหลอก (False Breakout) จากข่าวช่วงสั้น 2–3 ชั่วโมง

---

## 2. ขอบเขต Indicator บน M15 (7 Centroid Variants เท่านั้น)

ตามกฎของระบบ DavinTrade แอดมินผู้คุมระบบสามารถเปิดใช้งาน Centroid Indicator บน Timeframe M15 ได้ **เพียง 1 ตัวจาก 7 ตัวนี้เท่านั้น** (Single Active Indicator Rule):

1. `best_fit_a` (`best_fit_a_ssa`, `best_fit_a_uoedt`, `best_fit_a_loedt`)
2. `best_fit_b` (`best_fit_b_ssa`, `best_fit_b_uoedt`, `best_fit_b_loedt`)
3. `cherry_a` (`cherry_a_ssa`, `cherry_a_uoedt`, `cherry_a_loedt`)
4. `cherry_b` (`cherry_b_ssa`, `cherry_b_uoedt`, `cherry_b_loedt`)
5. `most_recent` (`most_recent_ssa`, `most_recent_uoedt`, `most_recent_loedt`)
6. `non_a` (`non_a_ssa`, `non_a_uoedt`, `non_a_loedt`)
7. `non_b` (`non_b_ssa`, `non_b_uoedt`, `non_b_loedt`)

_(Indicator ตัวอื่นๆ เช่น `fractal_edt`, `resistance`, `support`, `sr_levels` เป็นของ M5 หรือ Single Line / Horizontal Level จะไม่นำมาเป็น Candidate ของ MCD1 เด็ดขาด)_

---

## 3. ระบบการตรวจสอบข้อมูล 4 ชั้น (4-Tier Comprehensive Validation)

ก่อนเริ่มการคำนวณ `mcd1_evaluator.py` จะรันด่านตรวจ Pre-flight ทั้งหมด 4 ชั้น หากพบความผิดปกติจะ Fail ทันที และออกผลลัพธ์เป็น `UNIDENTIFIED`:

- **Tier 1 (Candidate Isolation & Single Active Rule):** สแกน 7 Centroid Variants ต้องมี Active Indicator ที่มีข้อมูล $\ge 96$ แท่ง เพียง 1 ตัวเท่านั้น (ถ้าพบ 0 หรือมากกว่า 1 จะ Fail ทันที)
- **Tier 2 (M15 Continuity & Data Availability):** ตรวจสอบแท่งเทียนในชีต `market_data_v6_M15` ย้อนหลัง $N_{\text{micro}}$ แท่ง ว่า Timestamp เรียงจากอดีตไปปัจจุบัน และค่าตัวเลข `close`, `ssa`, `uoedt`, `loedt` ครบถ้วน ไม่เป็น Null
- **Tier 3 (Channel Sanity Gate):** ตรวจสอบว่า $\text{UOEDT} > \text{LOEDT}$ ในทุกๆ แท่งเทียนที่นำมาประเมิน (ป้องกันปัญหา Channel บิดเบี้ยว)
- **Tier 4 (Statistics Ingestion Verification):** ค้นหาแถวใน `indicator_statistics` ที่ตรงกับ `symbol='XAUUSD'`, `timeframe='M15'`, `source=active_indicator` ที่มี `captured_at` ล่าสุด และตรวจสอบว่า `containment_rate >= 50.0%` (ถ้าต่ำกว่า 50% ถือว่า Channel เสียสภาพ)

---

## 4. สูตรการคำนวณและเกณฑ์การตัดสิน (Formulation & Matrix)

### A. Dynamic Micro Window Formula

$$N_{\text{micro}} = \max(96,\; \text{round}(T_{\text{EDT}} \times 0.05))$$

- ตัวอย่าง: สำหรับ `non_b` ที่มี $T_{\text{EDT}} = 1,808$ แท่ง:
  $$N_{\text{micro}} = \max(96,\; \text{round}(1808 \times 0.05)) = \max(96, 90) = \mathbf{96\text{ bars (1 วันเต็ม)}}$$

### B. Micro Regime Definition (ณ แท่งล่าสุด และเกณฑ์ความต่อเนื่อง Sustained >= 80%)

$$\text{channel\_position} = \frac{\text{close} - \text{LOEDT}}{\text{UOEDT} - \text{LOEDT}}$$

- **เกณฑ์การยืนยัน Breakout (Sustained Threshold $\ge 80.0\%$):**
  - **`UPPER_BREAKOUT`**: $\text{channel\_position} > 1.0$ บนแท่งล่าสุด **และ** มีอัตราการหลุดกรอบบน $\ge 80.0\%$ ตลอด $N_{\text{micro}}$ แท่ง (เช่น $\ge 77$ จาก 96 แท่ง)
  - **`LOWER_BREAKDOWN`**: $\text{channel\_position} < 0.0$ บนแท่งล่าสุด **และ** มีอัตราการหลุดกรอบล่าง $\ge 80.0\%$ ตลอด $N_{\text{micro}}$ แท่ง (เช่น $\ge 77$ จาก 96 แท่ง)
  - **`IN_CORRIDOR`**: ราคาอยู่ในกรอบ ($0.0 \le \text{channel\_position} \le 1.0$) หรือราคาหลุดกรอบแต่ไม่ถึงเกณฑ์ $80\%$ (กรอง False Breakout ชั่วคราวออกไป)

### C. Synthesis Decision Matrix (การสังเคราะห์ผลลัพธ์)

| Macro Trend ($\theta$)                              | Micro Regime ($CP$) | Synthesis `regime_status`        | คำอธิบายและความหมายทางพฤติกรรมตลาด (Description & Dynamics)                                                                                  |
| :-------------------------------------------------- | :------------------ | :------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- |
| **`UPTREND`** ($\theta > +5^\circ$)                 | `IN_CORRIDOR`       | **`TREND_ALIGNED_CONTINUATION`** | Price fluctuates normally inside upward channel bands. Healthy uptrend continuation.                                                         |
| **`DOWNTREND`** ($\theta < -5^\circ$)               | `IN_CORRIDOR`       | **`TREND_ALIGNED_CONTINUATION`** | Price fluctuates normally inside downward channel bands. Healthy downtrend continuation.                                                     |
| **`UPTREND`** ($\theta > +5^\circ$)                 | `UPPER_BREAKOUT`    | **`BREAKOUT_SAME_SLOPE`**        | Price breaking out upward in the same direction of macro slope. Shows massive pump with high probability of soon price reversal.             |
| **`DOWNTREND`** ($\theta < -5^\circ$)               | `LOWER_BREAKDOWN`   | **`BREAKOUT_SAME_SLOPE`**        | Price breaking out downward in the same direction of macro slope. Shows massive dump with high probability of soon price reversal.           |
| **`UPTREND`** ($\theta > +5^\circ$)                 | `LOWER_BREAKDOWN`   | **`COUNTER_TREND_EXPANSION`**    | Price breaking out downward against macro uptrend slope. Sustained counter-trend selling with high probability of structural trend reversal. |
| **`DOWNTREND`** ($\theta < -5^\circ$)               | `UPPER_BREAKOUT`    | **`COUNTER_TREND_EXPANSION`**    | Price breaking out upward against macro downtrend slope. Sustained counter-trend buying with high probability of structural trend reversal.  |
| **`SIDEWAYS`** ($-5^\circ \le \theta \le +5^\circ$) | `IN_CORRIDOR`       | **`CONSOLIDATION`**              | Price moving sideways within normal horizontal corridor.                                                                                     |
| **`SIDEWAYS`** ($-5^\circ \le \theta \le +5^\circ$) | `UPPER_BREAKOUT`    | **`RANGE_EXPANSION`**            | Price breaking out upward from sideways range. Bullish expansion out of consolidation.                                                       |
| **`SIDEWAYS`** ($-5^\circ \le \theta \le +5^\circ$) | `LOWER_BREAKDOWN`   | **`RANGE_EXPANSION`**            | Price breaking out downward from sideways range. Bearish expansion out of consolidation.                                                     |

---

## 5. ผลลัพธ์ที่ได้จากการประเมินชุดข้อมูลจริง (`non_b`)

จากไฟล์ข้อมูลจำลอง `market_data_v6_replicated.xlsx` ล่าสุด:

- **Active Indicator:** `non_b`
- **EDT Time Horizon:** $1,808$ bars
- **Regression Angle:** $-29.72^\circ$ (Macro: `DOWNTREND`)
- **Containment Rate:** $73.95\%$ (ผ่านเกณฑ์ $\ge 50\%$)
- **Dynamic Micro Window:** $96$ bars (1 วันเต็ม)
- **Latest Bar Channel Position:** $1.6447$
- **Micro Breach Rate:** $96/96$ bars ($100.0\% \ge 80.0\%$ threshold)
- **Micro Regime:** `UPPER_BREAKOUT`
- **Synthesis Trend:** `DOWNTREND`
- **Regime Status:** `COUNTER_TREND_EXPANSION`
- **Canonical Commentary:**
  > _"XAUUSD M15 macro slope is DOWNTREND (-29.72°), yet recent micro price action has breached above the UOEDT corridor (channel_position=1.6447 > 1.0) sustained over the past 96 bars (1 day: 96/96 bars = 100.0% >= 80.0% threshold). This demonstrates persistent counter-trend buying expansion with high probability of structural reversal."_
