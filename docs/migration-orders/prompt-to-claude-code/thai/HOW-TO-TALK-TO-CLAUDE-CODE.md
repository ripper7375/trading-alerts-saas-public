# วิธีการคุยกับ Claude Code — คู่มือการสื่อสารฉบับสมบูรณ์

**สำหรับ:** Davin (ผู้อนุมัติ) ที่ทำงานร่วมกับ Claude Code (ผู้ลงมือทำ) ตลอดช่วงเวลาการย้ายระบบ
**พร้อมก๊อปปี้ไปวาง:** ทุกๆ บล็อกที่อยู่ในเครื่องหมายโควต (>) คือคำสั่ง (prompt) ที่คุณสามารถก๊อปปี้ไปใช้ได้เลยเต็มๆ — ให้เปลี่ยนแค่ข้อความตรงที่มีวงเล็บ `<...>` เท่านั้น
**ควรอ่านคู่กับ:** `SESSION-PROMPT-SCRIPT.md` — เป็นสคริปต์สำหรับแต่ละรอบการทำงาน (รอบไหนต้องใช้คำสั่งไหน ตั้งแต่ 0-1 ไปจนถึง 8-5 พร้อมส่วนเสริมเฉพาะรอบ) คู่มือฉบับนี้ครอบคลุมเรื่อง _"สถานการณ์ต่างๆ"_ ส่วนตัวสคริปต์จะครอบคลุมเรื่อง _"ตารางเวลาการทำงาน"_

---

## 1. กฎเหล็ก 5 ข้อ เบื้องหลังทุกคำสั่ง

1. **เอกสารหลักสำคัญกว่าคำสั่ง (Prompts)** Claude Code จะอ่านไฟล์ `CLAUDE.md` อัตโนมัติ ซึ่งไฟล์นั้นจะชี้ไปที่ `EXECUTOR-PROTOCOL.md` กฎข้อบังคับที่ต้องทำตามเสมอจะอยู่ที่นั่น — อย่าพึ่งพาความจำแล้วพิมพ์สั่งเอาเอง ถ้าคุณพบว่าคุณต้องพิมพ์สั่งเรื่องเดิมๆ ซ้ำๆ ทุกรอบ นั่นแปลว่าเรื่องนั้นควรถูกนำไปใส่ไว้ในเอกสารหลัก ให้บอก Advisor (Claude Cowork) เพื่อเพิ่มเข้าไป
2. **ชี้ไปที่เอกสาร ดีกว่าเอามาสรุปเอง** การสั่งว่า "ทำตามคำสั่งใน session 2-1" ดีกว่าการที่คุณมานั่งพิมพ์สรุปงานให้มันฟัง — การพิมพ์สรุปเองอาจทำให้เนื้อหาคลาดเคลื่อนได้ และไฟล์คู่มือการทำงานนั้นผ่านการตรวจสอบมาแล้ว
3. **1 รอบการทำงาน ต่อ 1 เป้าหมาย** ทันทีที่คุณบอกว่า "อ้อ แล้วก็ช่วยทำ...เพิ่มด้วย" กลางคัน คุณภาพงานจะแย่ลง และผลลัพธ์จะไม่ตรงกับในเอกสารอ้างอิงทันที ไอเดียใหม่ๆ ให้เอาไปใส่ในคิวงาน (Backlog)
4. **ขอดูหลักฐาน ไม่ใช่ถามความมั่นใจ** การสั่งว่า "ขอดูผลลัพธ์จากการเทสต์หน่อย" ดีกว่าไปถามมันว่า "แน่ใจนะ?" — Claude Code มักจะตอบด้วยท่าทีที่ดู _มั่นใจ_ เสมอ หลักฐานเท่านั้น (บันทึกการเทสต์, ไฟล์ที่เปลี่ยน, ชื่อไฟล์) คือคำตอบเดียวที่เชื่อถือได้
5. **คุณคือคนตัดสินใจ ส่วนระบบคือคนทำ** เมื่อระบบถามความเห็นคุณ ให้ตอบแค่สิ่งทีถูกถาม — ให้ตรงประเด็น พยายามอย่าปรับเปลี่ยนแผนงานระหว่างที่ Claude Code กำลังทำงาน การเปลี่ยนแผนควรทำผ่าน Advisor เท่านั้น

---

## 2. คำสั่งมาตรฐาน 2 อย่าง (ใช้เป็นประจำในทุกรอบการทำงาน)

**ตอนเปิดรอบทำงาน (OPEN) ทุกครั้ง:**

> Read CLAUDE.md and docs/migration-orders/EXECUTOR-PROTOCOL.md. Locate the APPROVED order
> for this session, CONFIRM it against the current codebase AND runtime state (wait-clocks,
> shadow diffs, dashboards), and show me: (1) what changed since it was drafted, (2) this
> session's "done when" checks, (3) any entry criterion that fails. Do not execute anything
> until I say go.

**ตอนปิดรอบทำงาน (CLOSE) ทุกครั้ง:**

> Wrap up per EXECUTOR-PROTOCOL §3: run this session's tests and show me the results, fill
> in the Deviations section, update CLAUDE.md / Decision Log / cutover table / file
> inventory as applicable, harvest any lesson (error >30 min, recurred, or reached
> CI/production) into LESSONS-LEARNED.md, then PRE-DRAFT the next session's order and show
> it to me.

การสั่งแบบชัดเจนว่า "do not execute until I say go" (อย่าเพิ่งเริ่มทำงานจนกว่าฉันจะสั่ง go) ในตอนต้น จะช่วยดึงจังหวะให้คุณได้มีเวลาอ่านสิ่งที่ระบบรายงานมา เมื่อคุณอ่านเสร็จและพอใจแล้ว ค่อยพิมพ์ตอบกลับไปว่า "go"

---

## 3. การเริ่มต้นเรื่องต่างๆ

**รอบแรกสุด (รอบ 0-1, การเริ่มต้นระบบ — จะไม่มีการร่างแผนหรือ PRE-DRAFT มาก่อน):**

> Read CLAUDE.md, docs/migration-orders/EXECUTOR-PROTOCOL.md, and the session playbook.
> We are starting Session 0-1. Generate its migration order from TEMPLATE-CONTRACT.md,
> show it to me for approval, and wait.

**เมื่อจะเริ่มเฟสใหม่:**

> Before we start Phase <N>: walk me through its entry criteria from the plan and confirm
> each one with evidence. Any Track CC gate required for this phase — prove it's live.

**เมื่อกลับมาทำงานหลังจากหยุดไปหลายวันหรือสัปดาห์:**

> Read CLAUDE.md. Summarize where the migration stands: current session, waiting-on items,
> open flags needing my decision, and anything time-sensitive (clocks that expired, stability
> windows that completed). Recommend what to do today — but don't start it yet.

---

## 4. ระหว่างการทำงานของระบบ

**ตรวจสอบความคืบหน้า (เช็คได้ตลอดเวลา):**

> Status check: which step of the order are you on, what's done, what's left, any deviations
> so far?

**เมื่อระบบเงียบไปนานผิดปกติในขั้นตอนใดขั้นตอนหนึ่ง:**

> Stop. Show me exactly what you're stuck on, what you've tried, and what you need from me.
> If this step is bigger than the order assumed, say so — we'll split the session.

**ปรับทิศทางเมื่อระบบเริ่มออกนอกลู่นอกทาง:**

> That's not what step <n> of the order says. Re-read it and tell me: are you deviating
> deliberately? If yes, record it in Deviations with the why. If no, get back on the order.

**เมื่อระบบพยายามจะทำงานนอกเหนือคำสั่ง ("ไหนๆ ก็มาตรงนี้แล้ว ขอแก้...ไปด้วยเลยนะ"):**

> Is that inside this session's scope? If not: add it to CLAUDE.md under "Next session
> must" as a backlog note and continue with the order. Do not do it now.

---

## 5. จุดที่มีความเสี่ยง (ให้จำ 3 ข้อนี้ให้ขึ้นใจ)

**ก่อนจะทำขั้นตอนใดๆ ที่มีความเสี่ยง (อัปเดตระบบ, แก้ไขข้อมูล, ปรับตั้งค่าบนระบบจริง):**

> Before you do that: what exactly is the rollback if this fails, and has it been verified
> in staging? Show me, then wait for my go.

**ก่อนจะอัปเดตงานขึ้นระบบจริง (Production deploy):**

> Give me the deploy checklist: what's changing, what was the staging result, what's the
> rollback, what will you watch after it lands. I'll say "deploy" when satisfied.

**เมื่อเป็นเรื่องเกี่ยวกับการเงิน (เช่น รอบ 4A-9/10 และเรื่องระบบจ่ายเงิน):**

> This touches real money. Walk me through it as if I'm auditing you: every write path,
> every idempotency protection, what happens if it runs twice, what happens if it dies
> halfway. Then wait.

---

## 6. การสลับระบบ (Cutovers) และการตรวจสอบโค้ดทำงานเบื้องหลัง (Shadow-runs)

**ตรวจสอบผลการรันทำงานเบื้องหลัง (Shadow-run):**

> Show me the shadow-run diff summary: total requests compared, match rate, and EVERY
> mismatch with your explanation. An unexplained mismatch means no cutover — do we have any?

**อนุมัติการสลับระบบ (ทำหลังจากตรวจสอบข้อบนผ่านแล้วเท่านั้น):**

> Approved. Flip <flag>, monitor for <duration>, and report the error rate. If anything
> degrades, flip back first and tell me second.

**ปฏิเสธการสลับระบบ:**

> Not yet. Log the concerns in the order's Deviations, keep both systems running, and
> PRE-DRAFT an investigation session for the mismatches.

**หลังจากสลับระบบเรียบร้อย ก่อนจะโละโค้ดเก่าทิ้ง:**

> Has this slice been stable long enough per the order's precondition? Show me the dates
> and the error numbers, then list exactly which files the retire step deletes — nothing more.

---

## 7. เรื่องธงต่างๆ (Flags) และการตัดสินใจ

**เมื่อรอบการทำงานนั้นบังคับให้คุณต้องตัดสินใจเคลียร์ Flag:**

> Resolve flag F<N> first: show me the evidence (commands run, docs fetched, options
> considered), your recommendation, and the Decision Log entry you propose — then wait
> for my sign-off before acting on it.

**เมื่อระบบถามคำถามคุณตรงๆ เพื่อเคลียร์ Flag (เช่น URL ที่จะใช้ใน F16, ข้อมูลทดสอบใน F17, เวลา RPO/RTO ใน F18):**

ให้ตอบแบบตรงประเด็นที่สุดและสั่งให้มันบันทึกการตัดสินใจของคุณด้วย:

> Decision: <your answer>. Record it in the Decision Log with today's date and "approved
> by Davin", then continue the order.

**เมื่อคุณไม่เข้าใจว่าระบบกำลังถามอะไร:**

> Explain this decision to me as if I'm not an engineer: what are my options, what does
> each cost me, what do you recommend and why, and what's hard to undo later?

คำถามสุดท้ายที่ว่า — "what's hard to undo? (อะไรที่แก้กลับยาก)" — คือประโยคที่มีประโยชน์ที่สุดที่คนไม่ใช่สายเทคนิคควรจะถามเสมอ การตัดสินใจที่ย้อนกลับได้ง่ายสามารถตัดสินใจได้เร็ว แต่การตัดสินใจที่ย้อนกลับไม่ได้ คุณควรให้เวลาทบทวนมันอย่างระมัดระวัง

---

## 8. การรักษาขอบเขตงานและลิสต์ไฟล์ที่ห้ามแตะ (Frozen list)

**ประโยคสำหรับท้าทายขอบเขตงาน (ใช้ได้บ่อยเท่าที่ต้องการ):**

> Is this change inside the current session's order? Quote me the step that covers it.
> If you can't, it's out of scope — backlog it.

**เมื่อระบบเข้าไปแตะไฟล์ที่ไม่ควรแตะ:**

> Stop. That file is on the do-not-touch list (EXECUTOR-PROTOCOL §5). Revert the change
> and explain why you thought it was needed — if the reason is real, it goes in the
> PRE-DRAFT for a future session.

**เมื่อเจอบั๊กในโค้ดที่ถูกแช่แข็งห้ามแก้ (CC-F):**

> That slice is change-frozen. Apply the fix to BOTH the old and new implementations,
> note it in Deviations, and confirm the shadow-diff stays interpretable.

---

## 9. การตรวจสอบและการรับมือกับข้ออ้างต่างๆ

**อย่ารับคำว่า "เสร็จแล้ว" โดยไม่มีหลักฐานเด็ดขาด:**

> Show me: the test command you ran, its full output, and the commit hashes. "Done" means
> I can see it.

**เมื่อคุณรู้สึกถึงความไม่ชอบมาพากล (ให้เชื่อความรู้สึกตัวเอง):**

> Something seems wrong with <X>. Don't defend it — investigate it. Show me what you find
> even if it proves you were right.

**สุ่มตรวจการทำงาน (ควรทำบ้างเป็นครั้งคราวแม้ทุกอย่างจะดูปกติดีก็ตาม):**

> Pick 3 random items from what you just did and prove each one end-to-end: file exists,
> test covers it, behavior matches the contract.

**เมื่อการเทสต์ไม่ผ่าน:**

> Don't change the test to make it pass. First explain WHY it fails: is the code wrong, the
> test wrong, or the expectation wrong? Evidence for whichever you claim.

---

## 10. เรื่องฉุกเฉิน

**เกิดระบบพังบนโปรดักชั่น:**

> Production incident: <symptom>. First: is a rollback available per the current order or
> runbook? If yes, execute it now and tell me what you did. Diagnosis comes AFTER we're
> stable.

**คุณเพิ่งรู้ตัวว่าสั่งอนุมัติพลาดไป:**

> I'm revoking my approval of <thing>. Flip back / revert to the pre-approval state, verify
> we're stable, and log what happened in Deviations. We'll re-plan through the Advisor.

**การทำงานรอบนั้นรวนไปหมดจนเละเทะ:**

> Abort per the abort rule: leave the codebase green (revert uncommitted work), write the
> blocker into CLAUDE.md, and summarize what a fresh session needs to know. We stop here.

---

## 11. สถานะการรอ (Waiting states)

**เมื่อเข้าสู่โหมดต้องรอคอย (เช่น รอดู shadow-run หรือรอทดสอบความเสถียร):**

> Confirm the clock: what started, when it ends (exact date/time UTC), what should be
> watched during it, and what would count as a failure that ends the wait early. Put all
> four in CLAUDE.md under "Waiting on".

**ระหว่างที่กำลังรอ — ห้ามหลงกลทำสิ่งนี้:** อย่าพยายามไปเปิดเซสชั่นการทำงานเรื่องใหม่ "เพื่อประหยัดเวลา" ถ้างานนั้นมันยังต้องรอผลลัพธ์ของสิ่งที่รออยู่ ให้ถามระบบแบบนี้แทน:

> Is there any session we can safely run during this wait that does NOT depend on its
> outcome? (e.g. Phase 5 work during Phase 4 waits.)

---

## 12. ข้อห้าม — อะไรที่ไม่ควรพูด

| ห้ามพูดว่า                                           | เพราะว่า                                                            | ให้พูดว่า                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------ |
| "Just fix it however you think is best" (บนระบบจริง) | เป็นการยกการตัดสินใจของคุณให้ระบบ และจะทำให้งานบานปลาย              | "Propose 2 options with rollback for each; I'll pick"        |
| "Do sessions 2-1 through 2-4 today"                  | ทำลายกฎข้อบังคับเรื่องความปลอดภัย "1 รอบ ต่อ 1 งานย่อย"             | ให้สั่งงานทีละรอบ และจบทีละรอบตามขั้นตอน                     |
| "Skip the shadow-run, I'm confident"                 | ระยะเวลา 48 ชั่วโมงมีไว้เพื่อดักจับสิ่งที่คุณอาจมั่นใจพลาดไป        | ถ้ามันจิ๊บจ๊อยจริงๆ ให้ไปบอก Advisor ให้ปรับประเภทงานแทน     |
| "While you're at it, also add <feature>"             | เป็นการสอดแทรกงานกลางคัน — เป็นตัวทำลายคุณภาพอันดับ 1               | "Backlog it: note in CLAUDE.md for a future session"         |
| "Why is this taking so long?" (เพื่อเร่งงาน)         | ความกดดันจะทำให้ระบบข้ามขั้นตอนการตรวจสอบงาน                        | "Show me where the time went; should we split this session?" |
| "Are you sure?"                                      | ระบบจะบอกว่ามั่นใจเสมอ มันฟังดูเหมือนคุณแค่ต้องการคำยืนยันให้สบายใจ | "Show me the evidence"                                       |
| "Ignore the protocol just this once"                 | กฎระเบียบเหล่านั้น "คือ" ระบบรักษาความปลอดภัยของคุณ                 | ถ้ากฎมันผิด ให้แก้กฎผ่าน Advisor                             |
| สั่งอนุมัติ DRAFT โดยไม่อ่าน                         | การอนุมัติของคุณเป็นด่านตรวจของมนุษย์ด่านเดียวที่มี                 | ให้อ่านแผนนั้นสัก 1 หน้ากระดาษ มีอะไรไม่เข้าใจให้ถาม         |

---

## 13. โพยสรุปฉบับย่อ (พิมพ์หน้านี้เก็บไว้ได้เลย)

| สถานการณ์                        | สิ่งที่คุณต้องพูด                                                  |
| -------------------------------- | ------------------------------------------------------------------ |
| เริ่มรอบการทำงาน                 | ใช้คำสั่งมาตรฐานตอน OPEN (§2) + "don't execute until I say go"     |
| ปิดรอบการทำงาน                   | ใช้คำสั่งมาตรฐานตอน CLOSE (§2)                                     |
| เมื่อต้องทำอะไรที่เสี่ยง         | "What's the rollback? Show me, then wait."                         |
| สลับระบบ (Cutover)               | "Every mismatch explained? Then: approved, flip, monitor, report." |
| ระบบให้ฉันเป็นคนตัดสินใจ         | เลือกแบบเจาะจง → "record it in the Decision Log"                   |
| ฉันไม่เข้าใจที่มันอธิบาย         | "Explain like I'm not an engineer + what's hard to undo?"          |
| เมื่อระบบพยายามจะทำนอกสั่ง       | "Quote me the order step that covers it — or backlog it."          |
| เมื่อระบบบอกว่าทำงานเสร็จแล้ว    | "Show me: command, output, commit hashes."                         |
| เมื่อฉันรู้สึกทะแม่งๆ            | "Investigate, don't defend."                                       |
| ระบบบนโปรดักชั่นพัง              | "Rollback first, diagnose after."                                  |
| เมื่อกลับมาทำงานหลังจากหยุดไปนาน | "Read CLAUDE.md, summarize, recommend — don't start."              |

---

_ส่วนเสริม: คำสั่งในส่วนของ Advisor จะมีแค่บรรทัดเดียว คือ —
"Here's the PRE-DRAFT from session <N> — produce the DRAFT for session <N+1> per
00-SKELETON-AND-RULES.md." ข้อมูลอื่นๆ ที่ Advisor จำเป็นต้องใช้ทั้งหมด มีอยู่ในโฟลเดอร์ไว้ให้หมดแล้ว_
