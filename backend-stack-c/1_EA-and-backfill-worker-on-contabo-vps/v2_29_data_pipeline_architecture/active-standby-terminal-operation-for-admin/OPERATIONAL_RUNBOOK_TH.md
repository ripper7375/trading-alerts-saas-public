# คู่มือปฏิบัติงานผู้ดูแลระบบ: การสลับระบบ MT5 Terminal (Active ↔ Hot-Standby)

## MT5 Terminal Promotion Operational Runbook (Thai Edition)

**เอกสารอ้างอิง:**

- สถาปัตยกรรมระบบ: [`ACTIVE-STANDBY-TERMINAL-ARCHITECTURE.md`](../ACTIVE-STANDBY-TERMINAL-ARCHITECTURE.md)
- รายงานสรุปงาน: [`active-standby-terminal-manifest-work-completion.md`](../active-standby-terminal-manifest-work-completion.md)
- รันบุ๊คหลัก: [`docs/runbooks/mt5-terminal-promote.md`](../../../../docs/runbooks/mt5-terminal-promote.md)
- สคริปต์สลับระบบอัตโนมัติ: [`promote_terminal.bat`](./promote_terminal.bat)

---

## 1. บทนำและหลักการทำงาน

ระบบ MetaTrader 5 (MT5) ของ Pipeline ข้อมูล v6 มีการคำนวณ Indicator ตระกูล EDT ซึ่งต้องมีการปรับแต่งค่าพารามิเตอร์และจุด Anchor ตามสภาพตลาดที่เปลี่ยนไป

เพื่อป้องกันไม่ให้การปรับแต่งค่าไปกระทบหรือเขียนทับข้อมูลประวัติ (~3,000 แท่งเทียน) บน Production โดยที่ผู้ดูแลระบบยังไม่ได้ตรวจสอบความถูกต้อง ระบบจึงถูกออกแบบให้ทำงานแบบ **Active / Hot-Standby** โดยใช้ 3 Terminals:

| Terminal       | หน้าที่                                                                              | พฤติกรรมการสลับ                    | โฟลเดอร์ Export มาตรฐาน |
| :------------- | :----------------------------------------------------------------------------------- | :--------------------------------- | :---------------------- |
| **Terminal A** | 26 EDT Indicators + ปฏิทินข่าวสาร (Economic Calendar)                                | **สลับบทบาท (Active ↔ Standby)**  | `C:\MT5-A\MQL5\Files`   |
| **Terminal B** | 26 EDT Indicators + ปฏิทินข่าวสาร (เหมือน A ทุกประการ)                               | **สลับบทบาท (Active ↔ Standby)**  | `C:\MT5-B\MQL5\Files`   |
| **Terminal S** | 8 × OHLCV Exporters (EURUSD, USDJPY, GBPUSD, AUDUSD, NZDUSD, USDCAD, USDCHF, XAUUSD) | **อยู่นิ่งถาวร (ห้ามสลับเด็ดขาด)** | `C:\MT5-S\MQL5\Files`   |

> **หัวใจสำคัญ:**
>
> - ตัวดูดข้อมูล (`MT5Collector`) จะอ่านข้อมูลจาก **โฟลเดอร์เดียวเท่านั้น** ผ่านพารามิเตอร์ `--export-dir`
> - การ **Promote (สลับระบบ)** คือการสั่งให้ `MT5Collector` สลับไปอ่านโฟลเดอร์ของตัว Standby แทน แล้วรีสตาร์ท Service
> - Service `DavinTradeCurrencyIndexEngine` จะชี้ตรงไปที่ **Terminal S** ตลอดเวลา และ **ไม่ต้องยุ่งเกี่ยวกับการสลับนี้**

---

## 2. กฎเหล็ก 4 ข้อก่อนเริ่มงาน (Preconditions)

ห้ามดำเนินการสลับระบบเด็ดขาด หากยังไม่ได้ตรวจสอบครบทั้ง 4 ข้อนี้:

1. **Terminal ตัว Standby ต้องเปิดทำงานอยู่จริง (Hot Standby):**
   - โปรแกรม MT5 ต้องเปิดอยู่ กราฟกำลังวิ่ง มีการเชื่อมต่อโบรกเกอร์ปกติ ไม่ใช่แค่เปิดโปรแกรมทิ้งไว้เฉยๆ หรือปิดโปรแกรมอยู่
2. **ข้อมูลใน Standby สดใหม่จริง:**
   - ตรวจสอบไฟล์ `.txt` ในโฟลเดอร์ `MQL5\Files` ของตัว Standby ต้องมี Timestamp อัปเดตในรอบแท่งเทียนปัจจุบัน
3. **ตรวจสอบความสวยงามและความถูกต้องด้วยสายตาแล้ว:**
   - แอดมินต้องตรวจดูกราฟและเส้น Indicator บนหน้าจอ MT5 ของตัว Standby จนมั่นใจ 100% ว่าการจูนค่าถูกต้องและพร้อมขึ้น Production
4. **Terminal ตัว Active เดิมยังทำงานปกติสมบูรณ์:**
   - เพราะหลังการสลับ ตัวเดิมจะกลายเป็น **"เบาะรองรับสำหรับย้อนกลับ" (Rollback)** หากตัวเดิมพังอยู่แล้ว แล้วตัวใหม่เกิดมีปัญหา จะไม่เหลือตัวสำรองให้ถอยกลับ

---

## 3. ขั้นตอนการปฏิบัติงาน (Step-by-Step Operation)

### ขั้นตอนที่ 1: Remote Desktop เข้าสู่ Windows VPS

1. เปิดโปรแกรม **Remote Desktop Connection (mstsc)** บนคอมพิวเตอร์ของคุณ
2. ป้อน IP Address, Username และ Password เพื่อเข้าสู่ Windows VPS

---

### ขั้นตอนที่ 2: ปรับแต่ง Indicator บนตัว Standby

1. สลับไปที่หน้าต่าง MT5 ของตัว Standby (เช่น หากปัจจุบัน Active คือ A ให้ไปที่ MT5 ของ **Terminal B**)
2. ทำการปรับพารามิเตอร์ หรือเลื่อนตำแหน่ง Anchor ตามต้องการ
3. ตรวจสอบเส้น Indicator และสถิติบนกราฟจนพอใจ

---

### ขั้นตอนที่ 3: สลับระบบด้วยสคริปต์อัตโนมัติ (แนะนำ)

เพื่อป้องกันความผิดพลาดจากการพิมพ์คำสั่งด้วยมือ ให้ใช้สคริปต์ [`promote_terminal.bat`](./promote_terminal.bat):

1. ไปที่โฟลเดอร์:
   `D:\SaaS Project\trading-alerts-saas-public\backend-stack-c\1_EA-and-backfill-worker-on-contabo-vps\v2_29_data_pipeline_architecture\active-standby-terminal-operation-for-admin\`
   _(หรือ Shortcut บน Desktop หากมีการสร้างไว้)_
2. คลิกขวาที่ไฟล์ **`promote_terminal.bat`** แล้วเลือก **"Run as administrator"**
3. หน้าจอจะแสดงสถานะปัจจุบัน เช่น:

   ```text
   ============================================================================
           MT5 COLLECTOR ACTIVE / HOT-STANDBY PROMOTION TOOL (v2.29)
   ============================================================================

   [สถานะการทำงานปัจจุบัน]
     - สถานะ Active ปัจจุบัน : [ Terminal A ]
     - พาธโฟลเดอร์ที่อ่านอยู่ : C:\MT5-A\MQL5\Files

   ============================================================================
   เลือกการทำงาน:
     [1] สลับระบบไปใช้ Terminal A (C:\MT5-A\MQL5\Files)
     [2] สลับระบบไปใช้ Terminal B (C:\MT5-B\MQL5\Files)
     [3] ดู Log ล่าสุดของ Collector (View Recent Logs)
     [0] ออกจากโปรแกรม (Exit)
   ============================================================================
   * แนะนำ: ปัจจุบันคือ Terminal A --> หากต้องการ Promote ให้เลือก [2]
   ```

4. กด **`2`** แล้วกด **Enter** เพื่อเลือกสลับไป Terminal B
5. ระบบจะทำ **Pre-flight Check** อัตโนมัติ:
   - ตรวจสอบว่ามีโฟลเดอร์อยู่จริงหรือไม่
   - ตรวจสอบความสดของไฟล์ในโฟลเดอร์ว่า MT5 รันอยู่จริงหรือไม่
6. เมื่อระบบขึ้นถามยืนยัน:
   `ต้องการดำเนินการสลับระบบทันทีหรือไม่? (พิมพ์ Y เพื่อยืนยัน / N เพื่อยกเลิก):`
   ให้พิมพ์ **`Y`** แล้วกด **Enter**
7. สคริปต์จะทำการ:
   - ตั้งค่า Argument ของ `MT5Collector` ใหม่ให้ครบทุกพารามิเตอร์
   - สั่ง Restart Service `MT5Collector`
   - กาง Log 25 บรรทัดล่าสุดให้อัตโนมัติ

---

### วิธีสำรอง: สลับระบบด้วย Command Line (Manual Fallback)

ในกรณีที่ไม่ต้องการใช้สคริปต์ สามารถเปิด PowerShell ด้วยสิทธิ์ Administrator แล้วพิมพ์คำสั่งดังนี้:

1. ตรวจสอบคำสั่งเดิม:
   ```powershell
   nssm get MT5Collector AppParameters
   ```
2. สั่งเปลี่ยนพาธ (ต้องพิมพ์พารามิเตอร์ครบทุกตัว ห้ามตัดทอน):
   ```powershell
   nssm set MT5Collector AppParameters "C:\Scripts\collector\export_collector_validator_v2.py --export-dir C:\MT5-B\MQL5\Files --db C:\Scripts\database\xauusd.db --timeframes M5,M15"
   ```
3. สั่ง Restart Service:
   ```powershell
   nssm restart MT5Collector
   ```

> [!CAUTION]
> **ห้ามรันไฟล์ `install_services.bat` เด็ดขาด!** เพราะไฟล์ Batch ดังกล่าวจะเขียนทับ Environment Variables ด้วยค่า Placeholder ซึ่งจะทำลายรหัสผ่านจริง (Credentials) ของ Push Worker และ Renderer บน Production

---

## 4. การตรวจสอบความถูกต้องหลังสลับ (Verification)

หลังจากกดสลับระบบแล้ว ให้สังเกต Log จากหน้าจอของสคริปต์ (หรือสั่ง `Get-Content C:\Scripts\logs\collector.log -Tail 30 -Wait`):

1. **เช็คบรรทัดเปิดตัว Service:**
   ต้องแสดงพาธใหม่ที่สลับไป เช่น:
   ```text
   Export collector v2 (v6 pipeline) — db=... exports=C:\MT5-B\MQL5\Files tfs=M5,M15
   ```
2. **เช็ครอบการทำงาน (ภายใน 5 นาที):**
   จะต้องเห็นสัญลักษณ์บันทึกข้อมูลสำเร็จในรอบถัดไป:
   ```text
   📥 Cycle 2026-09-13 06:40:00 (M5) -> validation clean -> promoted
   ```

### สิ่งที่ผู้ใช้งานปลายทางจะเห็นบนหน้าเว็บ/แอป

- **ไม่มี Downtime:** ระบบไม่หยุดทำงาน ไม่มีหน้าจอขาว
- **การซิงค์ข้อมูลย้อนหลัง (Progressive Repaint):**
  - เนื่องจากค่า Indicator ใหม่จะทำการ recompute ข้อมูลย้อนหลัง ~3,000 แท่งเทียน ข้อมูลจะถูก Push Worker ทยอยส่งขึ้นระบบด้วยความเร็วรอบละ 500 แท่ง / 30 วินาที
  - ข้อมูลจะใช้เวลาประมาณ **5–6 นาที** ในการอัปเดตครบทั้งหมด
  - กราฟบนหน้าจอผู้ใช้จะทยอยเปลี่ยนจาก **ซ้ายไปขวา** (แท่งอดีตจะอัปเดตก่อน และแท่งขวาสุดปัจจุบันจะเปลี่ยนเป็นลำดับสุดท้าย)

---

## 5. กฎเหล็กหลังสลับระบบ (Standby Discipline Rule)

> [!IMPORTANT]
> **ห้ามเข้าไปปรับแต่งหรือปิด Terminal ตัวที่เพิ่งถูกปลดระวางทันที!**

- เมื่อสลับไปใช้ Terminal B แล้ว **Terminal A จะกลายเป็น Standby ตัวใหม่ทันที**
- แอดมินต้องปล่อยให้ Terminal A รันนิ่งๆ ค้างไว้ก่อนอย่างน้อย **15–30 นาที** หรือจนกว่าจะมั่นใจว่า Terminal B ทำงานบน Production ได้อย่างสมบูรณ์ ไร้ข้อผิดพลาด
- เพราะ Terminal A คือ **"ทางรอดเดียวในการ Rollback"** หากคุณเข้าไปแก้ค่าใน A ทันที แล้ว B เกิดมีปัญหา คุณจะไม่เหลือข้อมูลเดิมให้ถอยกลับ

---

## 6. ขั้นตอนการย้อนกลับฉุกเฉิน (Rollback Procedure)

หากพบว่า Terminal ใหม่มีปัญหา (เช่น Indicator คำนวณเพี้ยน หรือเกิดข้อผิดพลาด):

1. เปิดสคริปต์ **`promote_terminal.bat`** (Run as Administrator)
2. สคริปต์จะตรวจพบว่าปัจจุบัน Active คือ Terminal B และแนะนำให้เลือก **[1] สลับไป Terminal A**
3. กด **`1`** และพิมพ์ **`Y`** เพื่อยืนยัน
4. ระบบจะสั่งให้ `MT5Collector` สลับกลับมาอ่าน `C:\MT5-A\MQL5\Files` และรีสตาร์ททันที

_(หมายเหตุ: ข้อมูลย้อนหลังใน Database จะถูกเขียนทับกลับมาเป็นค่าของ Terminal A อีกครั้ง ใช้เวลาทยอยซิงค์กลับประมาณ 5–6 นาที)_

---

## 7. การแก้ไขปัญหาที่พบบ่อย (Troubleshooting & Gotchas)

### ปัญหาที่ 1: Log ขึ้นแจ้งเตือน Stale Export Directory

```text
newest bar <ts> is <n>s behind cycle slot <ts> (max 600s) — stale export directory
⛔ Cycle slot <ts> (M5) gave up after 3 attempts
```

- **สาเหตุ:** Terminal ปลายทางปิดอยู่ (Cold Standby) หรือ Indicator ใน MT5 ไม่ได้ทำงาน ทำให้ไฟล์ `.txt` ไม่อัปเดต
- **วิธีแก้:** สั่ง **Rollback กลับไป Terminal เดิมทันที** จากนั้นค่อยเข้าไปเปิดโปรแกรม MT5 ปลายทาง ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตของ MT5 และตรวจสอบว่า EA/Indicator กำลังทำงานอยู่

### ปัญหาที่ 2: วิดเจ็ต Currency & Gold Index ไม่ขยับ หรือหน้าจอว่างเปล่า

- **สาเหตุ:** มีการไปแก้ไขพาธของ `CGI_EXPORT_DIR` ให้ชี้ไปที่ A หรือ B แทนที่จะเป็น S
- **วิธีแก้:** ตรวจสอบ Service `DavinTradeCurrencyIndexEngine` ต้องชี้ไปที่ Terminal S (`C:\MT5-S\MQL5\Files`) เสมอ

### ปัญหาที่ 3: ปฏิทินข่าวสาร (Economic Calendar) หยุดอัปเดต

- **สาเหตุ:** ลืมแนบสคริปต์ `EconomicCalendarExport_v2_29.mq5` ใน Terminal ตัวใดตัวหนึ่ง
- **วิธีแก้:** ทั้ง Terminal A และ Terminal B ต้องมีไฟล์ปฏิทินข่าวสารแนบอยู่ทั้งคู่ เพราะเป็นไฟล์ที่ไม่มีพารามิเตอร์ให้ปรับจูน ให้เปิดแนบไว้ทั้งสองตัวถาวร
