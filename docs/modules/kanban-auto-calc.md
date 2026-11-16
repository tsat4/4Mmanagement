# Kanban Auto-Calc — คำนวณ kanban จาก forecast (แท็บ 🎴 คำนวณ Kanban ใน /planner-sales · 2026-07-16..17)

> ย้ายมาจาก `CLAUDE.md` (2026-09-03 — แยกไฟล์เพื่อลด context) · โหลด**เฉพาะเมื่อแตะโมดูลนี้** · แก้ไฟล์นี้แทน CLAUDE.md เมื่อกฎของโมดูลเปลี่ยน


Planner/Sale อัพโหลด forecast ลูกค้า → ระบบคำนวณจำนวน kanban ที่ใช้ในระบบดึงอัตโนมัติ · สูตรถอดจากไฟล์ Excel จริง (verify กับตัวอย่างที่คำนวณมือ) · helper กลาง **`src/utils/kanbanCalc.js`** (pure functions — `calcWithdrawalKanban`/`calcProductionKanban`/`nextMonthKey`, `⌈x⌉` = `Math.ceil(x-1e-9)`) · UI = `KanbanCalcTab` ใน `PlannerSales.jsx`

> ### 🔴🔴 **LOT size ≠ Packing — คนละเรื่อง ห้ามยุบเป็นตัวเดียว/ตัดสินพร้อมกัน** (2026-10-12 · คำสั่ง user)
> ทั้งคู่อยู่ใน `kanban_standards` แถวเดียวกันก็จริง แต่**คุมคนละเรื่อง คนละคนตัดสิน**:
>
> | | คืออะไร | กระทบอะไร |
> |---|---|---|
> | **`lot_size`** (ขนาดล็อตผลิต) | สะสมความต้องการครบเท่าไหร่ถึงออกใบสั่งผลิต | `utils/pullAccumulator.js` (จังหวะเปิดใบ) · `utils/kanbanCalc.js` (`Total = Max + lot`) · ตั้งเล็กเกินจริง = ใบสั่งพุ่งเป็นร้อยใบ |
> | **`qty_per_kanban`** (Packing) | จำนวนชิ้นต่อกล่อง/ต่อบัตร | การบรรจุ/ป้ายบัตร/การส่ง — **ไม่เกี่ยวกับจังหวะเปิดใบผลิต** |
>
> ⇒ **จอเทียบ/จอรายงานต้องแยกกอง แยกตัวนับ** — รวมเป็น "N พาร์ทไม่ตรง" ก้อนเดียว = ตอบไม่ได้ว่า
> ต้องไปคุยกับใครเรื่องอะไร และเรื่องที่ยังตกลงไม่ได้จะไปค้างเรื่องที่ชัดอยู่แล้ว
> · ต้นแบบ: จอเทียบในตัวนำเข้า Monitoring (`MonitoringUpload` → `kbDiff = { lot, pack, noStd }` + `<KbDiffTable>`)
> · **"ยังไม่มีในทะเบียน" เป็นกองที่ 3** — คนละเรื่องกับ "มีแล้วแต่ไม่ตรง"
> · มีด่าน `regressionGuards` (`kanban-lot-vs-packing-split`) กันยุบกลับ

- **2 ชนิด (toggle บนหัวแท็บ):** 🔄 **Withdrawal** (คัมบังเบิกถอน FG) · 🏭 **Production** (คัมบังสั่งผลิต press — Vol/Day, Info/Process/Safety LT, Kanban/Lot, Kanban(sys))
- **⚠️ PI (Production) กับ PW (Withdrawal) ไม่คำนวณพาร์ทร่วมกัน — แยกด้วย `dr_products.process_type` ไม่ใช่เลข MAT (2026-08-03 · คำสั่ง user):** Production kanban สั่งไลน์**ปั๊ม/ผลิตเป็น lot** · Withdrawal เบิกถอน/ป้อนไลน์**ประกอบ** · **ห้ามแยกด้วยเลข MAT SAP** — งานปั๊มที่ขายตรงก็เป็น FG เบอร์ 1 ได้ (เลข MAT บอกไม่ได้ว่าปั๊มหรือประกอบ) · เกณฑ์จริง (`procMatchesTab` ใน KanbanCalcTab): Production = `process_type==='metal_forming'` · Withdrawal = `!== 'metal_forming'` (welding_assembly + พาร์ทที่ยังไม่ตั้ง process ซึ่ง default = welding_assembly) · `'common'` (ทุกกระบวนการ) = แสดงทั้ง 2 แท็บ · banner บนแต่ละแท็บนับ "ซ่อน N พาร์ทที่เป็นอีกกระบวนการ" (โปร่งใส ไม่ปล่อยหายเงียบ) + ชี้ให้ตั้ง process_type ที่ Product Master · **ถ้าพาร์ทปั๊มไม่ขึ้นแท็บ Production = process_type ยังไม่ตั้งเป็น metal_forming (data ไม่ใช่ logic)** — แก้ที่ `/products`
- **เดือน default = เดือนถัดไป** (`nextMonthKey` — planner คำนวณปลายเดือนสำหรับเดือนหน้า) · **วันทำงาน/เดือน ลิงก์ปฏิทินบริษัท** (`countWorkingDays`: จ-ศ − วันหยุด + เสาร์/อาทิตย์ที่มาร์ค `working` · แก้ทับได้) · Production เพิ่มช่อง ชม.ทำงาน/วัน (default 16) คิด available time
- **flow:** แก้ param ในตาราง (edit ชั่วคราว > param บันทึก `kanban_calc_params` > default จาก master) → ค่าคำนวณอัปเดตทันที → **Preview & Apply**
- **⚠️ param ที่เป็น "คุณสมบัติสินค้า" ต้องดึงจาก master ไม่ให้กรอกเองทุกเดือน (2026-08-03 · คำสั่ง user "ไม่ควรต้องมากรอกเอง"):** `paramOf` default chain (ใน `firstPos` = ตัวแรกที่ >0): **PKG (จำนวน/กล่อง)** = `parts_master.qty_per_pkg` → `kanban_standards.qty_per_kanban` · **CAP/ชม.** = `3600 ÷ dr_products.cycle_time_sec` · **LOT** = `kanban_standards.lot_size` → 1
- **⚠️ CAP/ชม. ตั้งต้นเป็น "กำลังทางทฤษฎี" ไม่หัก downtime/ของเสีย (user ทัก 2026-08-21):** ระบบมีโมเดลกำลังจริงอยู่แล้วที่
  **`src/utils/capacityModel.js`** (ProductionPlan ใช้ — median ยอดดีต่อกะ 60 วัน ซึ่ง "บวก OEE/เบรค/NG ไว้ในตัวแล้ว")
  แต่ Kanban Calc ไม่เคยคุยกับมัน = **มี 2 นิยามของ "กำลังผลิต" ในระบบเดียว**
  → แท็บ 🎴 โชว์ **"จริง ~N"** ใต้ช่อง CAP = `(3600 ÷ CT) × OEE ของไลน์นั้น` (กะที่ปิดแล้ว 90 วัน · เฉลี่ยด้วย `wavg`+`wLoad` ตามกฎ OEE)
  ตรงกับสูตร fallback ของ `capacityModel.js` เป๊ะ · **คลิกแล้วเติมค่าให้ แต่ระบบไม่แทนค่าเอง** (จะวางแผนด้วยกำลังทฤษฎี
  หรือกำลังจริง เป็นการตัดสินใจของผู้วางแผน) · ห่างกัน ≥ 20% = ขึ้นแถบส้มนับให้
  **⚠️ CAP เพี้ยนกระทบ 2 ทาง:** withdrawal → `prep` เพี้ยน → Max/จำนวนใบเพี้ยน · production → work-time เพี้ยน → **%load ต่ำเกินจริง คิดว่าไลน์ว่างทั้งที่เต็ม** · ที่เหลือ (เตรียม/ผันผวน/รอบส่ง/safety/process/setup) = นโยบายวางแผน เก็บใน `kanban_calc_params` ตอน Apply → prefill รอบหน้าเอง (ไม่กรอกซ้ำ) · **PKG ยังว่าง = master ไม่มีค่า (data ไม่ใช่ logic)** → กรอก `qty_per_kanban` ที่ Product Master · **⚠️ `qty_per_kanban` อยู่ตาราง `kanban_standards` ไม่ใช่ `dr_products`** (ห้าม select จาก dr_products = 42703 พังทั้ง tab) → เขียน `kanban_standards` (`min_qty`/`max_qty` = ชิ้น, `qty_per_kanban` = pkg, `total_kanban` = ใบ, `lot_size`) — **Store (LineStock) ดึง min/max ตรงนี้ต่อ = จุดเดียวที่ Store↔Planner sync** · param ที่ใช้จำลง `kanban_calc_params` (รอบหน้า prefill) · **export CSV** (Production แนบตารางสรุป capacity ท้ายไฟล์)
- **สรุปภาระการผลิต (Production):** Σ work-time/ไลน์ [(setup+lot×CT)×(order/lot)] เทียบ available (ชม./วัน×วันทำงาน) = **%load** ต่อไลน์ (<85 เขียว · 85–100 เหลือง · >100 แดง=เกิน capacity)
- **⚠️ กุญแจ sync = `mat_no` (เลข SAP ภายใน) เท่านั้น:** ตอนอัพโหลด forecast ระบบ map เลขพาร์ทลูกค้า → SAP ผ่าน **`p_no`** ใน `dr_products`/`kanban_standards` (normalize ตัดขีด/ช่องว่าง · FG ขึ้นต้น 1 ชนะ) · **จับคู่ไม่ได้ = เก็บเลขพาร์ทลูกค้าไว้ใน `mat_no` ไปก่อน** (`PlannerSales.jsx` insert: `mat_no: hit ? hit.mat_no : r.part`) → แถวนั้นคำนวณ kanban ไม่ได้ + Store/Production ที่ใช้เลข SAP จะไม่เห็น · **ปุ่ม 🔗 จับคู่เลข SAP** ในแท็บ (banner เตือน N พาร์ท) เขียน `p_no` ให้ dr_products (auto-map รอบหน้า) + re-point `customer_forecasts.mat_no` เดิม → ต้องเติม p_no ให้ครบ Store/Planner ถึง sync จริง · modal มี **auto-suggest จับคู่ด้วย base part** (`baseOfPart` — ตัด revision token ตัวท้าย ≤2 ตัว แล้วเทียบ p_no ที่มีในระบบ · เช่น forecast `MB3B 16C274 CE` ↔ dr `MB3B-16C274`) ตัวเดียวชัด = เติมให้อัตโนมัติ · กำกวมหลายตัว = โชว์ชิปเขียวให้กดเลือก · พาร์ทที่ไม่มีใน Product Master เลยต้องไปสร้างก่อน
- **⚠️ Order/Month รวม forecast source เดียว กัน double-count (2026-07-21):** `customer_forecasts.period_month` เก็บ 2 grain ปนกัน — EDI 830 = วันราย週 (`period_month = r.date`) · manual = ต้นเดือน (`monthFirst`) · ตอนรวม Order/Month ต่อ mat ถ้าบวกทุก row จะซ้ำเมื่อ mat มีทั้ง 2 source ในเดือนเดียว → **รวมเฉพาะ source เดียว: EDI 830 (official) ก่อน ไม่มีค่อยใช้ manual** (`fBySrc` ใน KanbanCalcTab `load()`) · weekly ที่คาบเกี่ยวขอบเดือนยังนับตามเดือนที่ `period_month` ตก (calendar-month bucket — accept ได้)
- **DB:** `kanban_calc_settings` (working_days/efficiency_pct/**hours_per_day**) · `kanban_calc_params` (per-part param + **calc_type/process_count/lot_qty/setup_time_sec** สำหรับ production) · migration `20260710_kanban_auto_calc.sql` + **`20260716_kanban_production_calc.sql`** (DR, additive) — ⚠️ ถ้ายังไม่ apply migration ตัวหลัง: หน้ายังคำนวณ/Preview/Apply เข้า kanban_standards ได้ปกติ แต่ param เฉพาะ production + hours_per_day จะยังไม่ถูกจำข้ามรอบ (โค้ด best-effort + toast เตือน)

---

---

## 🔔 ของถึง min → ส่งความต้องการไปหาไลน์เจ้าของงาน + ฝ่ายวางแผน (2026-11-16)

user 13/11: *"เมื่อ stock ลดลงถึง min จะแสดงความต้องการไปหาไลน์ผลิตเจ้าของงานนั้นเพื่อให้เตรียมตัว
และไปฝ่ายวางแผนเพื่อเห็นว่ามีงานตัวไหนต้องจัดแผนลง"*

**เจ้าของกฎ = `minAlerts()` / `minAlertSummary()` (`src/utils/replenish.js`) ที่เดียว**
โหลดผ่าน `src/lib/minDemandOps.js` · วาดด้วย `<MinDemandPanel>` — **2 จอต้องตอบเลขเดียวกัน**
· จอวางแผน `/production-plan?tab=lots` (กด **+ เข้าแผน** ได้) · จอผลิต `/daily-report` (**ดูอย่างเดียว**)

### 🔴 กฎที่ห้ามถอด

1. **"ติด min" กับ "ต้องผลิตเท่าไหร่" คนละคำถาม** — ชิ้นส่วน 41 แถว **ไม่มี `max` เลยสักแถว**
   ⇒ `refillPcs = null` · จอเขียน *"ยังไม่ตั้ง max"* **ห้ามโชว์ 0 ห้ามเดา**
2. **ไม่มีบัญชี ≠ ของหมด** — คู่ที่ไม่มีแถวใน ledger = `unknown`
3. 🔴🔴 **ด่านความสดของบัญชี** — เลข 0 บนบัญชีที่ไม่มีใครขยับ **ไม่ได้แปลว่าของหมด**
   วัดจริง 16/11: 41 คู่ที่ตั้ง min → เข้าเกณฑ์ติด min 32 คู่ และ **ทั้ง 32 คู่คงเหลือ 0 เป๊ะ
   ไม่มีสักคู่ที่มีของเหลือบางส่วน** · บัญชีขยับล่าสุด **30/10 (17 วันก่อน)** · 7 คู่ไม่เคยขยับเลย
   · **ไม่มีคู่ไหนขยับใน 3 วัน**
   ⇒ ปล่อยผ่าน = จอขึ้น *"ติด min 32 ตัว"* ที่ **ผิดทั้ง 32 ตัว** แล้วหน้างานเลิกเชื่อทั้งจอ
   ⇒ เกิน `STALE_DAYS` (3 วัน) = `unknown` + บอกว่าค้างกี่วัน · เวลาขยับล่าสุดมาจาก RPC
   `line_part_last_move` (migration `20261116`) — **ห้ามดึงแถวดิบมานับเอง** (พาร์ทเดียวหลักพันแถว)
4. **ไลน์เจ้าของงาน ≠ ไลน์ที่ของกอง** — เจ้าของงาน = `dr_products.line_name` (ช่อง "ไลน์" ใน Product Master)
   ของกอง = `line_part_levels.line_name` · **ส่งงานไปหาไลน์ต้องใช้เจ้าของงาน** ไม่งั้นแจ้งผิดไลน์
   (วัดจริง: ชิ้นส่วนตรงกัน 41/41 · FG ต่าง 5 แถว)
5. **FG ห้ามมีในทะเบียนนี้** — ปิดไปแล้ว 32 แถว (migration `20261115`) · ที่เหลือติดธง `fgNotAllowed`
   **ห้ามกรองทิ้งเงียบ** (ซ่อน = ไม่มีใครรู้ว่าทะเบียนเปื้อน แล้วมันจะเปื้อนต่อ)
6. 🔴 `dr_products` **ไม่มีคอลัมน์ `part_name`** — ชื่อคือ `name` (ด่าน `dr-products-has-no-part-name` จับได้ตอนทำ)

### ⚠️ สถานะวันเปิดใช้ (16/11)

**ทุกแถวตอบว่า "ยังตัดสินไม่ได้"** เพราะบัญชีหน้าไลน์ไม่ถูกใช้มา 17 วัน — **นี่คือผลที่ถูกต้อง**
ฟีเจอร์พร้อมแล้ว แต่**สัญญาณจะใช้ได้ต่อเมื่อ backflush หน้าไลน์ทำงานจริง**
(ปัญหาเดียวกับที่ `src/utils/replenish.js` บันทึกไว้ตั้งแต่ 21/10: issue 5,177,813 : consume 484,043 = ตัดออก 9%)
⇒ **ห้าม "แก้" ด้วยการถอดด่านความสด** — ต้องไปแก้ที่การตัดยอดหน้าไลน์
