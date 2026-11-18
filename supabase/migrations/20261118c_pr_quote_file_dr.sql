-- ══ 🧾 ใบเสนอราคาแนบในใบขอซื้อ + ลบไฟล์ทิ้งเมื่อปิดใบ  ·  2026-11-18 ══
-- Project: DR (ชื่อในจอ Supabase = "Product DB" · eyhclzkifitbhbljgoav)
--
-- หน้างานแจ้ง (PDF 18/11 · Case ท้ายเอกสาร):
--   *"ที่ไม่ใช่ Spare Part สั่งซื้อเพื่อมาปรับปรุงเพิ่ม Admin จะไม่รู้ว่าต้องซื้ออะไร …
--     ควรมีให้เลือกว่าสั่งซื้อ ① Spare Part ตามรายการที่ใช้ ② ให้คนส่งข้อมูลกรอกรายการอะไหล่
--     ③ ค่าซ่อมหรืออุปกรณ์ที่ซื้อไม่บ่อย สามารถให้แนบใบเสนอราคาได้
--     ****แต่จะทำยังไงให้ใบเสนอราคาไม่ไปเป็นขยะในระบบ"*
--
-- ── คำตัดสินของ user (18/11) ────────────────────────────────────────────────────
-- ถาม: เก็บไฟล์ไว้กี่วันหลังปิดใบถึงลบ (เสนอ 90 วัน / จบเดือนบัญชี)
-- ตอบ: **"ปิดใบแบบสมบูรณ์ละลบได้เลย"** ⇒ ไม่มีช่วงเก็บ · ปิดใบ = ลบไฟล์ทันที
--      (ผมเตือนเรื่องบัญชีอาจขอดูย้อนหลังไปแล้ว — user ยืนยันตามนี้)
--
-- ── 🔴 กฎ ────────────────────────────────────────────────────────────────────────
-- 🔴 **ลบ "ไฟล์" ไม่ใช่ลบ "ประวัติ"** — `quote_file_name` + `quote_deleted_at` อยู่ต่อตลอดไป
--    ⇒ บัญชีถามย้อนกลับยังตอบได้ว่ามีใบเสนอราคาจริง ชื่ออะไร ลบไปเมื่อไหร่
--    (ราคา/ผู้ขายอยู่ใน `unit_price`/`supplier` ของแถวเดิมอยู่แล้ว ไม่ต้องเก็บซ้ำ)
-- 🔴 **"ปิดใบสมบูรณ์" ปลอดภัยอยู่แล้ว** — ด่านปิดใบ (`moCloseGate`) บังคับว่าลูป PR ต้องจบก่อน
--    (รับของเข้าสต็อก หรือ ยกเลิก PR) ⇒ ปิดได้ = ไม่มี PR ค้างแน่นอน
-- 🔴 **บันทึกต้นฉบับ (snapshot) ไม่ได้อ้างไฟล์นี้** — `saveMoSnapshot` เก็บเฉพาะ
--    `mtn_order_parts` / `mtn_order_labor` / คอมเมนต์ **ไม่เก็บ `mtn_purchase_requests`**
--    ⇒ ลบไฟล์แล้วใบพิมพ์ซ้ำไม่พัง (ถ้าวันหลังมีใครเอา PR เข้า snapshot ต้องกลับมาทบทวนกฎนี้)
-- 🔴 ไฟล์อยู่ bucket `mtn-images` ใต้ `quotes/` (นโยบายเดิมใช้ได้เลย ไม่ต้องสร้าง bucket ใหม่)
--
-- ย้อนกลับ:
--   alter table public.mtn_purchase_requests
--     drop column if exists quote_img, drop column if exists quote_file_name,
--     drop column if exists quote_deleted_at;

alter table public.mtn_purchase_requests
  add column if not exists quote_img        text,
  add column if not exists quote_file_name  text,
  add column if not exists quote_deleted_at timestamptz;

comment on column public.mtn_purchase_requests.quote_img is
  'URL ใบเสนอราคา (bucket mtn-images ใต้ quotes/) — null หลังปิดใบเพราะถูกลบตามคำสั่ง user 18/11';
comment on column public.mtn_purchase_requests.quote_file_name is
  'ชื่อไฟล์ใบเสนอราคาที่แนบมา — เก็บไว้ตลอด แม้ไฟล์ถูกลบแล้ว (ประวัติสำหรับบัญชี)';
comment on column public.mtn_purchase_requests.quote_deleted_at is
  'เวลาที่ลบไฟล์ทิ้งหลังปิดใบ MO — มีค่า = เคยมีใบเสนอราคาแต่ไฟล์ไม่อยู่แล้ว (ไม่ใช่ "ไม่เคยแนบ")';
