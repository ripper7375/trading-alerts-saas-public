# สคริปต์คำสั่งแต่ละรอบ (Session Prompt Script) — ต้องพิมพ์อะไรบ้าง ในแต่ละรอบการทำงาน

**วิธีใช้:** งานแต่ละรอบในคู่มือ จะต้องใช้คำสั่ง (prompt) จากคุณไม่เกิน 3 คำสั่ง:
**[A]** ส่งให้ Advisor (Claude Cowork) ระหว่างรอเปลี่ยนรอบการทำงาน,
**[B]** ส่งให้ Claude Code ตอนเริ่มรอบการทำงาน (OPEN),
**[C]** ส่งให้ Claude Code ตอนปิดรอบการทำงาน (CLOSE)
รอบการทำงานส่วนใหญ่จะใช้คำสั่งรูปแบบมาตรฐาน (Universal forms) ด้านล่างนี้ — สคริปต์นี้จะบอกคุณว่างานแต่ละรอบต้องใช้รูปแบบไหน และต้องพิมพ์ประโยคพิเศษอะไรเพิ่มเติมไปบ้าง
ให้ก๊อปปี้และแปะได้เลย โดยเปลี่ยนเฉพาะข้อความในวงเล็บ `<...>` เท่านั้น
**ไฟล์ที่ควรอ่านคู่กัน:** `SESSION-WALKTHROUGHS.md` (**เริ่มอ่านจากไฟล์นี้ก่อน** เพราะมีตัวอย่างการสนทนาเต็มๆ ให้ดูหนึ่งรอบต่อหนึ่งรูปแบบ พร้อมตัวอย่างการตอบกลับที่ดีและสัญญาณเตือน) และ `HOW-TO-TALK-TO-CLAUDE-CODE.md` (คำสั่งประยุกต์สำหรับสถานการณ์เฉพาะหน้าระหว่างที่ระบบกำลังทำงาน เช่น ตอนที่มันค้าง, เสี่ยง, ทำผิด, หรือโค้ดพัง)

---

## รูปแบบคำสั่งมาตรฐาน (The universal forms)

**U-A — ส่งให้ Advisor, เพื่อร่างแผนระหว่างรอบการทำงาน (สร้าง DRAFT):**

> Here's the PRE-DRAFT from session <N> — produce the DRAFT for session <N+1> per
> 00-SKELETON-AND-RULES.md. <+ ประโยคพิเศษสำหรับแต่ละรอบตามสคริปต์ด้านล่าง>

**U-B — ส่งให้ Executor, ตอนเปิดรอบการทำงาน (session OPEN):**

> Read CLAUDE.md and docs/migration-orders/EXECUTOR-PROTOCOL.md. CONFIRM the APPROVED order
> for session <P-N> against the current codebase AND runtime state, and show me: what
> changed since drafting, the "done when" checks, and any failing entry criterion. Do not
> execute until I say go. <+ ประโยคพิเศษสำหรับแต่ละรอบตามสคริปต์ด้านล่าง>

**U-C — ส่งให้ Executor, ตอนปิดรอบการทำงาน (session CLOSE):**

> Wrap up per EXECUTOR-PROTOCOL §3: tests + results, fill Deviations, update the artifacts,
> harvest any lesson, then PRE-DRAFT session <next>'s order and show it to me.

**U-CUT — คำสั่งอนุมัติให้สลับระบบ (สำหรับรอบ VERIFY-RETIRE, หลังจากตรวจสอบความแตกต่างแล้ว):**

> Every mismatch explained — approved. Flip <flag>, monitor <duration>, report error rate.
> Anything degrades: flip back first, tell me second.

**U-FAST — คำสั่งอนุมัติแบบรวดเร็ว (คุณเป็นคนสั่งอนุมัติ PRE-DRAFT แบบ VERIFY-RETIRE ด้วยตัวเอง โดยไม่ต้องผ่าน Advisor):**

> Fast-path approved as written — mark it APPROVED and proceed to CONFIRM at next session
> open.

**U-WAIT — ตอนเข้าสู่โหมดรอคอย (รอดูผลทำงานคู่ขนาน 48 ชั่วโมง / หรือรอดูเสถียรภาพ 30 วัน):**

> Confirm the clock: what started, exact end date/time UTC, what to watch, what failure
> ends the wait early. Put all four in CLAUDE.md under "Waiting on".

---

## เฟส 0 — การวางรากฐาน (Foundations)

**0-1 (งานชิ้นแรกสุด — ยังไม่มี PRE-DRAFT ข้ามขั้นตอน [A] ไปได้เลย):**

- [B]: > Read CLAUDE.md, docs/migration-orders/EXECUTOR-PROTOCOL.md, and the session
  playbook. We are starting Session 0-1. Generate its migration order from
  TEMPLATE-CONTRACT.md, show it to me for approval, and wait.
- หลังจากที่คุณอนุมัติ: > Go. · ให้เติมประโยคนี้ต่อท้ายบรรทัด Go: _"Resolve F2 and the F19 npm check first —
  show me each Decision Log entry before writing the reference notes."_
- [C]: U-C.

**0-2 (OpenAPI ล็อตแรก):** [A]: U-A + _"variant: CONTRACT; scope is the operation-domain
route groups only — money routes are 0-3's."_ · [B]: U-B · [C]: U-C.

**0-3 (OpenAPI ล็อตสอง):** [A]: U-A + _"close F1 this session — every route covered or
explicitly marked internal-only."_ · [B]: U-B · [C]: U-C.

**0-4 (จัดการความลับ + โค้ดพื้นฐาน):** [A]: U-A + _"catalog secret NAMES only, never values."_
· [B]: U-B + _"I'll provide dashboard access when you list what you need."_ · [C]: U-C.

**0-5 (ระบบทดสอบ + การพัฒนาบนเครื่องนักพัฒนา):** [A]: U-A + _"include my F17 decision: <synthetic seed —
recommended / your choice>."_ · [B]: U-B · [C]: U-C + _"then walk the Phase 0 exit criteria
one by one with evidence."_

## เฟส 1 — ฐานข้อมูล Railway PostgreSQL

**1-1 (สำรวจ DB + ซ้อมกู้คืนข้อมูล):** [A]: U-A + _"F3 investigation first, destructive
nothing; include my F18 decision: RPO ≤<24h>, RTO ≤<1h>."_ · [B]: U-B + _"database
credentials: <how you'll provide>."_ · [C]: U-C.

**1-2 (เงื่อนไขพิเศษ กรณีย้ายที่ — ทำเฉพาะเมื่อ F3 บอกว่า DB ไม่ได้อยู่บน Railway; ถ้าอยู่แล้วให้ข้ามรอบนี้ไป):**
[A]: U-A + _"include the maintenance-window plan; I approve the window time explicitly."_
· [B]: U-B + _"before the dump: prove the restore rehearsal from 1-1 passed."_ · [C]: U-C.

**1-3 (สิทธิ์การเข้าถึง + PgBouncer):** [A]: U-A · [B]: U-B + _"remember L3: migrations on the DIRECT
url."_ · [C]: U-C.

**1-4 (ทดสอบการถูกโจมตีแบบ denial):** [A]: U-A (หรือ U-FAST ก็ได้ — ตรงนี้เหมือนเป็นแค่การเช็คลิสต์) · [B]: U-B ·
[C]: U-C + _"walk Phase 1 exit criteria; confirm railway-gateway ingest never blipped."_

## เฟส 2 — อัปเกรด Prisma 7.8.0 + แยก Schema

**2-1 (อัปเกรด Prisma, ทดสอบแยกต่างหาก):** [A]: U-A + _"variant: UPGRADE; F19 audit is step 1 —
no code edits before I've seen the hit-list."_ · [B]: U-B · จุดพักตรวจสอบกลางเซสชั่น: > Show me the
F19 hit-list and the official upgrade-guide URLs you read. _(จากนั้น)_ > Proceed. · การนำขึ้นระบบโปรดักชั่นต้องให้คุณสั่งอนุมัติอย่างชัดเจน: > Deploy. · [C]: U-C.

**2-2 (สรุปรายการข้อมูล + การแยกย่อย, F4/F5):** [A]: U-A + _"include F5 recommendation with Prisma-7
evidence."_ · [B]: U-B · [C]: U-C + _"show me the full model census table — every model
assigned, none ambiguous."_

**2-3 (ทดสอบ migration รอบแรก + ตรวจสอบ Foreign Key):** [A]: U-A + _"first migration must be a no-op
baseline — never a create."_ · [B]: U-B · [C]: U-C + _"list every FK dropped, with its
kept column+index."_

**2-4 (แก้ไขการเชื่อมโยงกับระบบหลัก):** [A]: U-A · [B]: U-B · [C]: U-C + _"walk Phase 2 exit criteria;
zero behavior change is the claim — prove it with the baseline diff."_

## เฟส 3 — ระบบเข้าสู่ระบบแบบลูกผสม (Hybrid JWT auth)

**3-1 (การตัดสินใจ + การขึ้นโครงสร้าง + สะพานเชื่อม):** [A]: U-A + _"present F6/F7 options for my decision
before scaffolding."_ · เมื่อคุณทำการตัดสินใจ ให้ตอบไปว่า: > Decision: F6 = <bridge-first>, F7 = <HS256
now, JWKS when second verifier lands>. Record both in the Decision Log, approved by Davin,
then continue. · [B]: U-B · [C]: U-C.

**3-2 (ระบบออก Token):** [A]: U-A + _"reuse lib/auth logic — 2FA and lockout semantics are
invariants."_ · [B]: U-B · [C]: U-C.

**3-3 (ฝั่ง Next.js):** [A]: U-A (variant: UI-BUILD) · [B]: U-B · [C]: U-C + _"demo the
staging walkthrough: login → dashboard SSR → browser call → logout."_

**3-4 (การตั้งค่าความปลอดภัย CORS + flow สำรอง):** [A]: U-A · [B]: U-B + _"CORS origins are security — list
them for my sign-off before applying."_ · [C]: U-C.

**3-5 (การทดสอบ 3 ทาง, ยืนยันการจบเฟส):** [A]: U-A · [B]: U-B · [C]: U-C + _"walk
Phase 3 exit criteria; confirm production NextAuth untouched and regression-free."_

## เฟส 4 — การย้ายระบบหลังบ้าน (รูปแบบหลัก 2 แบบ + ตารางแจกแจงแบบเซสชั่นต่อเซสชั่น)

**P4-BUILD (รูปแบบสำหรับรอบ BUILD ทั้งหมดในตารางด้านล่าง):**

- [A]: U-A + _"variant: PORT, dial LOW; generate the migration order at 4B-2-example depth —
  I approve the order before any porting."_ + ประโยคเฉพาะของแต่ละรอบ
- [B]: U-B + _"re-verify the SOURCE file list and line counts explicitly."_
- [C]: U-C + _"confirm shadow/mirror-run STARTED and the source files are now CC-F frozen —
  state the exact 48h end time."_ จากนั้นค่อยส่งคำสั่ง **U-WAIT**.

**P4-CUTOVER (รูปแบบสำหรับรอบ CUTOVER ทั้งหมดในตารางด้านล่าง — ใช้เส้นทางด่วน fast-path โดยข้าม [A] ได้เลย):**

- เมื่อได้ไฟล์ PRE-DRAFT มาแล้ว: สั่ง **U-FAST**.
- [B]: U-B + _"first: the shadow/replay diff — total compared, match rate, EVERY mismatch
  with your explanation."_
- หากอนุมัติให้สั่ง **U-CUT** (พร้อมใส่ชื่อ flag หรือกลไกตามรอบนั้นๆ). · [C]: U-C.

### เฟส 4A — ระบบจัดการเงิน (money-service), ทั้งหมด 12 เซสชั่น

| เซสชั่น | รายละเอียด                                                            | รูปแบบ                                                  | ประโยคเฉพาะที่ต้องเติมท้ายคำสั่ง                                                                                                                                              |
| ------- | --------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4A-1    | ขึ้นโครงสร้าง + Deploy บน Railway + สร้างตาราง cutover                | ตัดสินใจ + โครงสร้างพื้นฐาน ([A]: ใช้ U-A รูปแบบ INFRA) | _"include my F16 decision: <api.domain/v1 + money.domain/v1> and F15 default (one Redis, op._/money._ namespaces); populate the real cutover-table rows."_                    |
| 4A-2    | BUILD ส่วนที่ 1: ระบบตั้งเวลา cron 8 ตัว                              | P4-BUILD                                                | _"crons keep the identical UTC expressions from vercel.json — that's the invariant."_                                                                                         |
| 4A-3    | CUTOVER ส่วนที่ 1                                                     | P4-CUTOVER                                              | กลไก: เปิดใช้งาน Nest scheduler + เคลียร์ vercel.json crons. วิธีถอยกลับ: นำ vercel.json crons กลับมา.                                                                        |
| 4A-4    | BUILD ส่วนที่ 2: ระบบ RiseWorks + dLocal webhooks                     | P4-BUILD                                                | _"verification is REPLAY tests with recorded signed payloads (raw-body HMAC) — not a 48h shadow."_                                                                            |
| 4A-5    | CUTOVER ส่วนที่ 2                                                     | P4-CUTOVER                                              | ให้เพิ่มข้อความนี้ตอนอนุมัติ: _"I'll update the provider dashboard URLs — walk me through each console click."_ วิธีถอยกลับ: เปลี่ยน URL กลับ.                                |
| 4A-6    | BUILD ส่วนที่ 3: ระบบอ่านข้อมูล (dashboards, reports, admin lists)    | P4-BUILD                                                | — (มาตรฐาน; ทำ shadow 48 ชม.)                                                                                                                                                 |
| 4A-7    | CUTOVER ส่วนที่ 3                                                     | P4-CUTOVER                                              | กลไก: สลับ base-URL ใน env. วิธีถอยกลับ: สลับค่ากลับมาเหมือนเดิม.                                                                                                             |
| 4A-8    | รอบตรวจสอบความปลอดภัย CC-C (idempotency, dedupe, outbox, rate limits) | รอบมาตรฐาน (B)                                          | สำหรับ [A] ให้เติม: _"resolve F14 (recommend outbox) incl. the reconciliation-cron design — slice 4 does not proceed until this session's done-when passes."_                 |
| 4A-9    | BUILD ส่วนที่ 4: ระบบเขียนข้อมูล + Stripe webhook                     | P4-BUILD                                                | _"every write endpoint lists its idempotency key in the order — a write without one is a blocker, not a TODO."_                                                               |
| 4A-10   | CUTOVER ส่วนที่ 4 — **เกี่ยวข้องกับเงินจริง**                         | P4-CUTOVER + แบบฝึกหัด F                                | ก่อนอนุมัติ, ต้องใช้คำสั่งซักไซ้ระบบเรื่องเงินเสมอ (แบบฝึกหัด F) รอบนี้จะมีการสลับ URL ของ Stripe webhook ด้วย.                                                               |
| 4A-11   | BUILD ส่วนที่ 5: เส้นทางเปลี่ยนระดับ tier ผู้ใช้                      | P4-BUILD                                                | _"implements the F14 outbox + nightly reconciliation cron; core-side apply must be idempotent."_                                                                              |
| 4A-12   | CUTOVER ส่วนที่ 5                                                     | P4-CUTOVER                                              | กลไก: ระบบแกนหลักจะเลิกอ่านค่า Subscription ตรงๆ. วิธีถอยกลับ: เปิดให้กลับมาอ่านตรงๆเหมือนเดิม. จากนั้นสั่ง **U-WAIT** — เพื่อเริ่มจับเวลาความเสถียร 30 วันของระบบจัดการเงิน. |

### เฟส 4B — ระบบปฏิบัติการทั่วไป (operation-service), ทั้งหมด 22 เซสชั่น

| เซสชั่น | รายละเอียด                                                                        | รูปแบบ                              | ประโยคเฉพาะที่ต้องเติมท้ายคำสั่ง                                                                                                                                                                  |
| ------- | --------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4B-1    | แพ็กเกจ @trading-alerts/types + การย้ายระบบเรขาคณิต (geometry)                    | รอบมาตรฐาน (B), [A] ใช้รูปแบบ INFRA | _"resolve F9; hoisting the drawing geometry is part of this — see the 4B-2 order's Wrinkle #1. Never fork the math."_                                                                             |
| 4B-2    | BUILD: ระบบประมวลผลการแจ้งเตือน (11 ไฟล์)                                         | P4-BUILD                            | _"the order already exists — re-verify 4B-2-alert-engine.migration-order.md against the live codebase and upgrade it to DRAFT."_ (ระยะเวลารอของขั้นตอนนี้คือการรัน MIRROR แล้วดูแค่ log เท่านั้น) |
| 4B-3    | CUTOVER: ระบบประมวลผลการแจ้งเตือน                                                 | P4-CUTOVER                          | _"one worker dispatching at a time: stop the monolith worker, THEN enable service dispatch — jobId dedupe is the backstop, not the plan."_                                                        |
| 4B-4    | โครงสร้างพื้นฐานร่วม: redis/cache/logger/errors/monitoring + OTel/correlation IDs | รอบมาตรฐาน (B)                      | สำหรับ [A] ให้เติม: _"resolve F13 (tracing backend) here if still open — this is where the OTel SDK lands."_                                                                                      |
| 4B-5    | BUILD: ระบบแจ้งเตือน CRUD (app/api/alerts/\*\*)                                   | P4-BUILD                            | —                                                                                                                                                                                                 |
| 4B-6    | CUTOVER: ระบบแจ้งเตือน CRUD                                                       | P4-CUTOVER                          | เปิดใช้ Flag: MIGRATE_ALERTS.                                                                                                                                                                     |
| 4B-7    | BUILD: ระบบการวาด (drawings) + drawing-alerts                                     | P4-BUILD                            | _"geometry parity is THE invariant — same fixtures in, same level numbers out, chart vs server."_                                                                                                 |
| 4B-8    | CUTOVER: ระบบการวาด                                                               | P4-CUTOVER                          | เปิดใช้ Flag: MIGRATE_DRAWINGS.                                                                                                                                                                   |
| 4B-9    | BUILD: ระบบจัดการการเตือน (notifications)                                         | P4-BUILD                            | _"the alerts:fired consumer contract must stay byte-identical (4B-3 depends on it)."_                                                                                                             |
| 4B-10   | CUTOVER: ระบบจัดการการเตือน                                                       | P4-CUTOVER                          | เปิดใช้ Flag: MIGRATE_NOTIFICATIONS.                                                                                                                                                              |
| 4B-11   | BUILD: ระดับผู้ใช้ (guard + tier-check middleware)                                | P4-BUILD                            | _"tier gating is a paywall — wrong-tier denial tests are mandatory parity proofs, not optional."_                                                                                                 |
| 4B-12   | CUTOVER: ระดับผู้ใช้                                                              | P4-CUTOVER                          | เปิดใช้ Flag: MIGRATE_TIER. ลองสุ่มเทสต์ให้แน่ใจว่า ผู้ใช้ระดับ FREE จะถูกปฏิเสธการเข้าถึงหน้า PRO หลังจากสลับระบบแล้ว.                                                                           |
| 4B-13   | BUILD: ผู้ใช้/โปรไฟล์/2FA/เซสชั่น                                                 | P4-BUILD                            | _"2FA and lockout semantics are invariants; session-listing/revocation behavior byte-compatible."_                                                                                                |
| 4B-14   | CUTOVER: ผู้ใช้/โปรไฟล์/2FA                                                       | P4-CUTOVER                          | เปิดใช้ Flag: MIGRATE_USER. จำลองการทดสอบ 2FA แบบเจาะจงให้เห็นเองกับตาบน staging ก่อนอนุมัติ.                                                                                                     |
| 4B-15   | BUILD: ตัวส่งต่อช่องข้อมูลตลาด (market-data channel proxy)                        | P4-BUILD                            | _"V8 PRO-only gating is a paywall invariant (remember eloquent-hypatia: stripping it silently is the failure mode)."_                                                                             |
| 4B-16   | CUTOVER: ตัวส่งต่อช่องข้อมูลตลาด                                                  | P4-CUTOVER                          | เปิดใช้ Flag: MIGRATE_MARKETDATA.                                                                                                                                                                 |
| 4B-17   | BUILD: ข้อมูลแบบเรียลไทม์ (F8)                                                    | P4-BUILD                            | สำหรับ [A] ให้เติม: _"F8 FIRST — read both realtime spec docs and present socket-architecture options for my decision before any porting."_                                                       |
| 4B-18   | CUTOVER: ข้อมูลแบบเรียลไทม์                                                       | P4-CUTOVER                          | _"drain existing socket connections gracefully; prove one live alert → toast + chart marker end-to-end before I approve."_                                                                        |
| 4B-19   | การพอร์ตหน้าอีเมล (emails/\* + lib/email)                                         | รอบมาตรฐาน (B)                      | _"render every template and show me the outputs for visual check before the send-path switches."_                                                                                                 |
| 4B-20   | BUILD การสลับระบบล็อกอิน auth (ตรวจสอบใน staging)                                 | P4-BUILD + แบบฝึกหัด F              | _"treat like money: what breaks if this goes wrong, how do users get back in, rollback demonstrated in staging?"_                                                                                 |
| 4B-21   | CUTOVER การล็อกอิน auth — นำ NextAuth ออก                                         | P4-CUTOVER + แบบฝึกหัด F            | เป็นช่วงที่เสี่ยงที่สุดในรอบ 4B. วิธีถอยกลับ = เปิด NextAuth route + auth-options ให้ทำงานเหมือนเดิม (เก็บโค้ดส่วนนี้ไว้จนกว่า 4B-22 จะยืนยันความเรียบร้อย).                                      |
| 4B-22   | ทบทวนความเรียบร้อยก่อนจบเฟส 4                                                     | แบบด่วน E (U-FAST)                  | สำหรับ [B] ให้เติม: _"cutover table 100% walk-through, row by row, with evidence per row."_ จากนั้นสั่ง **U-WAIT** — เพื่อเริ่มจับเวลาความเสถียร 30 วันของ operation-service.                     |

**ข้อควรรู้สำหรับการทำคู่ขนาน:** เซสชั่นต่างๆในเฟส 5 (ด้านล่าง) สามารถรันในระหว่างที่คุณกำลัง "รอ" เซสชั่นต่างๆในเฟส 4 ได้เสมอ — เพราะว่ามันแก้ไขไฟล์คนละส่วนกัน

## เฟส 5 — Next.js 16 (อาจทำสลับกับเฟส 4 ไปพร้อมกันได้)

**5-1 (ตรวจสอบ + กำหนด baseline, F10):** [A]: U-A + _"variant: UPGRADE; fetch the official 15→16
guide — hit-list before any edit."_ · [B]: U-B · [C]: U-C.
**5-2 (อัปเกรด + รัน codemods):** [A]: U-A · [B]: U-B · จุดตรวจสอบก่อนนำขึ้นระบบ: > Deploy to preview. · [C]: U-C.
**5-3 (เพิ่มประสิทธิภาพไฟล์หน้าเว็บ):** [A]: U-A + _"bundle ≤ baseline is a hard gate."_ · [B]: U-B · [C]: U-C.
**5-4 (ฟอนต์ + การโหลดแบบสตรีม + จบเฟส):** [A]: U-A · [B]: U-B · [C]: U-C + _"walk Phase 5 exit
criteria with the before/after metrics table."_

## เฟส 6 — รีดีไซน์หน้าเว็บฝั่งผู้ใช้ (Frontend)

**6-1 (ตรวจสอบส่วนที่ขาดหาย, F11 — รอบการทำงานนี้จะเป็นงาน "ของคุณ" มากพอๆ กับของระบบ):** [A]: U-A + _"variant: CONTRACT;
output is the gap matrix for my triage — no building."_ · [B]: U-B · เมื่อคุณทำการแยกหมวดหมู่ ให้ตอบกลับว่า:

> Triage: rows <…> = build, rows <…> = internal-only, rows <…> = out-of-scope. Record in
> the matrix and Decision Log. · [C]: U-C.
> **6-2 (โครงสร้างเนื้อหา + ระบบดีไซน์):** [A]: U-A (variant: UI-BUILD, dial HIGH) · [B]: U-B · [C]: U-C.
> **6-3 (หน้าจอ: alerts + charts, รวมสวิตช์เปิดปิด MTF + หน้าตาแปรผันของ V8):** [A]: U-A + _"variant:
> UI-BUILD; propose design freely — the contract constrains the data. V8 PRO gating stays."_
> · [B]: U-B · การตรวจสอบบนระบบทดสอบ: > Show me the staging URL; I review before the flag flips. · [C]: U-C.

**6-4 (หน้าจอ: notifications UX):** ทำเหมือนกับ 6-3, ให้เติมประโยคนี้ต่อท้าย: _"notifications — live toast,
bell, list; ties to the 4B-17/18 realtime path."_

**6-5 (หน้าจอ: settings + user, รวมขั้นตอน 2FA):** ทำเหมือนกับ 6-3, ให้เติมประโยคนี้ต่อท้าย:
_"settings/user — 2FA flows re-verified end-to-end in the browser."_

**6-6 (หน้าจอ: admin, รวมมุมมองวัฏจักรการเบิกจ่ายดิสเบอร์สเมนต์):** ทำเหมือนกับ 6-3, ให้เติมประโยคนี้ต่อท้าย:
_"admin — batch lifecycle states must mirror the cutover-table vocabulary users of the money
service actually see."_

**6-7 (หน้าจอ: affiliate portal + reports):** ทำเหมือนกับ 6-3, ให้เติมประโยคนี้ต่อท้าย: _"affiliate —
report views for every report endpoint in the gap matrix marked build."_

**6-8 (หน้าจอ: payments/checkout):** ทำเหมือนกับ 6-3 และ **บวกด้วยกฎของเรื่องเงิน** เข้าไป: _"never render
amounts from client math — display what the service returns."_

**6-9 (การเข้าถึงผู้พิการ + จบเฟส):** U-FAST · [B]: U-B · [C]: U-C + \_"final gap-matrix sweep — every row

> closed, internal, or ticketed."\_

## เฟส 7 — ระบบเชื่อมต่อ API Client

**7-1 (ตรวจสอบซ้ำ + สั่งสร้าง API Client):** [A]: U-A + _"first step: re-read the lib/api flag's mismatch
list vs the NEW routes; client is GENERATED from OpenAPI, not hand-written."_ · [B]: U-B · [C]: U-C.
**7-2 (เปลี่ยนระบบอื่นๆ ให้มาใช้ API Client ตัวใหม่):** [A]: U-A + _"ends with the lint rule banning stray fetch() —
show me it failing on a planted violation."_ · [B]: U-B · [C]: U-C.
**7-3 (เทสต์ความเข้ากันได้ + จบเฟส):** [A]: U-A + _"tests against recorded REAL responses — L1
applies."_ · [B]: U-B · [C]: U-C.

## เฟส 8 — การรื้อถอนระบบเก่า

**8-1 (ไล่ลบของที่ไม่ใช้แล้ว):** U-FAST · [B]: U-B + _"list every file to delete BEFORE deleting —
nothing more than the list."_ · [C]: U-C.
**8-2 (รวบระบบทางเข้า gateway):** [A]: U-A + _"the ingest path must never blip — state how each step
avoids it."_ · [B]: U-B · [C]: U-C.
**8-3 (ทดสอบครอบคลุมทั้งระบบ e2e):** [A]: U-A + _"all journeys in plan 8.3; payment flows in TEST MODE
only."_ · [B]: U-B · [C]: U-C + _"produce the signed-off test report."_
**8-4 (ทดสอบรองรับปริมาณผู้ใช้ + สรุปค่าใช้จ่าย):** [A]: U-A · [B]: U-B · [C]: U-C + _"include the capacity/cost
sheet — real numbers, not estimates."_
**8-5 (ปิดงานทั้งหมด):** U-FAST · [B]: U-B · [C]: U-C + _"regenerate migration-stack-analysis.md
via the categorization script, close the Decision Log (all F1–F19 resolved or formally
carried), and give me the migration completion summary."_ จากนั้นหากเวลายังไม่ครบกำหนด 30 วัน ให้สั่ง U-WAIT

---

## หากมีอะไรผิดพลาดระหว่างการทำงานรอบใดๆ (ไม่ว่าจะในเฟสไหนก็ตาม)

- **ถ้าเจอทางตันไปต่อไม่ได้:** > Abort per the abort rule: leave the codebase green, write the blocker into
  CLAUDE.md, summarize for a fresh session. We stop here.
- **ถ้ามีเหตุการณ์แทรกซ้อน (เช่น ต้องกู้คืนระบบหรือซ่อม git กลางคัน):** ให้รันในลักษณะ **เซสชั่นพิเศษเฉพาะกิจ (ad-hoc session)** (อ้างอิงจาก EXECUTOR-PROTOCOL §6) — โดยใช้ธรรมเนียมเปิด/ปิดรอบเหมือนเดิม แต่ติดป้ายในไฟล์ CLAUDE.md ว่า ADHOC-<วันที่> แทน โดยที่เลขเฟสและเซสชั่นหลักจะไม่มีการเปลี่ยนแปลง

**สถานะ:** v1.1 (ครอบคลุมครบทุกๆ เซสชั่นอย่างชัดเจน: ทั้งหมดมีแจกแจงไว้ครบ 12×4A + 22×4B ตามตาราง) — ตรงกับคู่มือเวอร์ชัน v1.1 / protocol §1–§7 / และกฎของโครงสร้างแผน หาก Advisor ขอแยกหรือแทรกเซสชั่นใหม่ จะต้องเสนอให้อัปเดตตารางเวลาการทำงานในไฟล์ **นี้** แนบมาพร้อมใน DRAFT นั้นๆ ด้วยเลย (ใช้กฎการตั้งชื่อห้อยท้าย เช่น 4B-2b, ห้ามรันเลขลำดับใหม่ทั้งหมด)
