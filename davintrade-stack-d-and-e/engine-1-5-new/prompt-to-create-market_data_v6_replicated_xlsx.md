สวัสดีครับ Antigravity! ผมต้องการให้คุณช่วย Replicate ไฟล์ฐานข้อมูล Excel จำลอง `market_data_v6_replicated.xlsx` ใหม่ทั้งหมด ตาม Prisma Schema ล่าสุด (อัพเกรดเป็น 103 Contract Columns / 106 Prisma Fields) จาก Text Files ของอินดิเคเตอร์ทั้ง 15 ตัวที่เซฟไว้ในโฟลเดอร์ `engine-1-5-new`

กรุณาศึกษาเอกสารอ้างอิงและทรัพยากรหลักดังนี้:

1. เอกสารสถาปัตยกรรม Schema 103 คอลัมน์ฉบับทางการ:
   `d:\SaaS Project\trading-alerts-saas-public\davintrade-stack-d-and-e\MARKET-DATA-V6-103-COLUMNS-AND-MQ5-INDICATORS-REFERENCE-EN.md`
2. โฟลเดอร์เก็บ Raw Text Files ทั้ง 15 อินดิเคเตอร์ (ทั้ง M5 และ M15):
   `d:\SaaS Project\trading-alerts-saas-public\davintrade-stack-d-and-e\engine-1-5-new\`
3. สคริปต์เดิมที่ใช้สร้าง Excel (นำมาอัพเดทให้รองรับ Schema ใหม่):
   `d:\SaaS Project\trading-alerts-saas-public\davintrade-stack-d-and-e\create_market_data_v6_excel.py`
4. Source Code ของอินดิเคเตอร์ MQL5 (อ้างอิงสูตร/โครงสร้างคอลัมน์):
   `d:\SaaS Project\trading-alerts-saas-public\backend-stack-c\1_EA-and-backfill-worker-on-contabo-vps\v2_29_data_pipeline_architecture\mq5\*.mq5`

---

## สาระสำคัญของการอัพเกรด Schema ใหม่ (103 Columns / 106 Prisma Fields):

1. เพิ่มอินดิเคเตอร์ตัวที่ 15: `S-R-AutoCalibration_v2_29.mq5`
   - Export ไฟล์ข้อมูล: `S_R_Levels_XAUUSD_M5.txt` และ `S_R_Levels_XAUUSD_M15.txt`
   - Export ไฟล์สถิติ: `S_R_Levels_XAUUSD_M5_Statistic.txt` และ `S_R_Levels_XAUUSD_M15_Statistic.txt`
2. เพิ่มคอลัมน์ Support & Resistance ชุดที่ 2 อีก 8 คอลัมน์ (`sr_9` ถึง `sr_16`) ต่อจาก `sr_8`:
   - `sr_9`: Support Level 5 (Set 2 Level 1) - แนวรับใกล้สุดต่ำกว่าราคาปิด
   - `sr_10`: Support Level 6 (Set 2 Level 2)
   - `sr_11`: Support Level 7 (Set 2 Level 3)
   - `sr_12`: Support Level 8 (Set 2 Level 4)
   - `sr_13`: Resistance Level 5 (Set 2 Level 1) - แนวต้านใกล้สุดสูงกว่าราคาปิด
   - `sr_14`: Resistance Level 6 (Set 2 Level 2)
   - `sr_15`: Resistance Level 7 (Set 2 Level 3)
   - `sr_16`: Resistance Level 8 (Set 2 Level 4)
3. ในตาราง `indicator_statistics`:
   - ให้ Ingest ข้อมูลจาก `S_R_Levels_XAUUSD_{TF}_Statistic.txt` โดยบันทึกคอลัมน์ `source = 'sr2_levels'`

---

## ภารกิจที่ต้องดำเนินการ (Action Items):

Step 1: ตรวจสอบความพร้อมของ Text Files ทั้งหมดใน `davintrade-stack-d-and-e\engine-1-5-new\`
Step 2: อัพเดทโค้ด `create_market_data_v6_excel.py` ให้ครอบคลุม 106 Prisma Fields:

- เพิ่ม `sr_9`..`sr_16` ในตัวแปร `MARKET_DATA_V6_COLUMNS` ต่อจาก `sr_8` (และก่อนหน้า `body_direction`)
- เพิ่มตรรกะการอ่านไฟล์ `S_R_Levels_XAUUSD_{TF}.txt` แมปเข้าคอลัมน์ `sr_9`..`sr_16`
- เพิ่มตรรกะการอ่านไฟล์ `S_R_Levels_XAUUSD_{TF}_Statistic.txt` เข้าสู่ชีต `indicator_statistics` ด้วย source enum `'sr2_levels'`
- อัพเดทคำอธิบายในชีต Schema Dictionary (`market_data_dictionary` และ `indicator_statistic_dictionary`)
  Step 3: รันสคริปต์ `python create_market_data_v6_excel.py` เพื่อสร้างไฟล์:
- `davintrade-stack-d-and-e\engine-1-5-new\market_data_v6_replicated.xlsx`
- `davintrade-stack-d-and-e\market_data_v6_replicated.xlsx`
  Step 4: ตรวจสอบความถูกต้อง (Validation):
- ชีต `market_data_v6_M15`: มี 106 คอลัมน์ (103 contract + id, terminal_id, timestamps), 3,000 แถว, คอลัมน์ `sr_9`..`sr_16` มีค่าตัวเลขถูกต้อง
- ชีต `market_data_v6_M5`: มี 106 คอลัมน์, 3,000 แถว
- ชีต `indicator_statistics`: มีบันทึกสถิติครบถ้วน รวมทั้ง source `'sr2_levels'`
  Step 5: ทดสอบรัน `mcd1_evaluator.py` และ `test_mcd1_unit_tests.py` บนไฟล์ Excel ใหม่ เพื่อยืนยันว่าโมดูล MCD1 เดิมยังทำงานได้ถูกต้อง 100%

พร้อมแล้วช่วยเริ่มวิเคราะห์และดำเนินการได้เลยครับ!
