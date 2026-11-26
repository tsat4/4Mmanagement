-- ═══════════════════════════════════════════════════════════════════════════════
-- 🧩 ของเสียระดับ "พาร์ทลูก" (child part) ใน Daily Report — DR / "Product DB" (eyhclzkifitbhbljgoav)
-- 2026-11-16 · คำสั่ง user: *"จาก daily report การลงของเสีย ต้องเลือก child part ได้
--                             บางทีไม่เสียทั้ง FG"*
--
-- เดิมของเสียลงได้แค่ระดับ MAT ที่เปิดใบผลิตไว้ (`prod_order_id` → `prod_orders.mat_no`)
-- ⇒ เสียแค่ชิ้นส่วนลูก 1 ตัว ก็ต้องลงเป็นของ FG ทั้งชุด ⇒ พาเรโต/ใบรายงานของเสีย/มูลค่า
--   ชี้ผิดตัว (ทิ้งทั้ง FG ทั้งที่ของจริงทิ้งแค่ bracket 1 ชิ้น)
--
-- 🔴🔴 กฎเหล็กของ migration นี้ — **3 คอลัมน์นี้ไม่แตะสูตร %Q/%P เลย**
--   `qty_ng` / `qty_suspect` / `qty_repair` ยังมีความหมายเดิมเป๊ะ (= จำนวน "ชิ้น" ที่คนนับได้)
--   และยังถูกนับเข้า %Q/%P ของ **MAT แม่** ตามเดิม 1 ชิ้น = 1 ชิ้น
--   ⇒ ตัวเลข OEE ของทุกกะ (ทั้งที่ปิดแล้วและกะสด) **เท่าเดิมทุกตัว** หลัง apply migration นี้
--   `child_qty_per_fg` เป็น **สแนปช็อตไว้ดูย้อนหลัง** (อัตราต่อ 1 FG ตาม BOM ณ วันที่ลง)
--   🔴 **ห้ามเอาไปคูณ/หารในสูตร %Q/%P** — "ของเสียลูก N ชิ้น = FG เสียกี่ชิ้น" ยังเป็นคำถาม
--      ที่ต้องให้ user เคาะก่อน (มีด่าน `defect-child-qty-not-in-oee` ใน regressionGuards)
--
-- backward-compatible: nullable ทั้ง 3 ช่อง ไม่มี default · ไม่แตะ RLS/GRANT
--   (`defect_logs` ให้สิทธิ์ระดับ **ตาราง** ครบทุก cmd กับ anon/authenticated อยู่แล้ว
--    ⇒ คอลัมน์ใหม่ใช้ได้ทันที ไม่ต้อง GRANT เพิ่ม · ฝั่ง DR วิ่งด้วย role `anon` เสมอ
--    🔴 ห้ามแปลง policy เป็น `TO authenticated` — client ฝั่งนี้ไม่มี JWT)
-- โค้ดทนทั้ง "ยังไม่ apply" และ "apply แล้ว": ฟอร์มบันทึกงานเสียจับ 42703 แล้วเขียนซ้ำ
--   โดยไม่ส่ง 3 ช่องนี้ + ขึ้น toast บอกว่ายังเก็บพาร์ทลูกไม่ได้ (ห้ามล้มเหลวเงียบ)
-- ═══════════════════════════════════════════════════════════════════════════════

alter table public.defect_logs
  add column if not exists child_mat_no     text,
  add column if not exists child_part_name  text,
  add column if not exists child_qty_per_fg numeric;

comment on column public.defect_logs.child_mat_no is
  'พาร์ทลูกที่เสียจริง (mat_no จาก BOM ของ MAT แม่) · null = เสียที่ระดับ MAT แม่เหมือนเดิม. '
  '🔴 ไม่ใช่ตัวแปรของสูตร %Q/%P — ของเสียยังนับเข้า MAT แม่ 1 ชิ้น = 1 ชิ้นตามเดิม '
  '(ใช้สำหรับพาเรโต/ใบรายงานของเสีย/สืบย้อนว่าชิ้นไหนเสีย)';
comment on column public.defect_logs.child_part_name is
  'ชื่อพาร์ทลูก ณ ตอนที่ลง (snapshot จาก bom_items.part_name) — ทะเบียนเปลี่ยนชื่อทีหลังแล้วใบเก่ายังอ่านได้';
comment on column public.defect_logs.child_qty_per_fg is
  'อัตราที่ BOM บอกว่าพาร์ทลูกนี้ใช้กี่หน่วยต่อ 1 FG ณ วันที่ลง (null = ตอบไม่ได้/บรรทัดซ้ำ 2 ชั้น ห้ามเดา). '
  '🔴 เก็บไว้ดูย้อนหลังเท่านั้น — ห้ามเอาไปคูณในสูตร %Q/%P จนกว่า user จะเคาะว่า '
  '"ลูกเสีย N ชิ้น = FG เสียกี่ชิ้น"';

-- พาเรโต "เสียที่พาร์ทลูกตัวไหนบ่อย" กรองด้วยคอลัมน์นี้ (partial = แถวที่ไม่ได้เลือกลูกไม่กินเนื้อที่)
create index if not exists defect_logs_child_mat_idx
  on public.defect_logs (child_mat_no) where child_mat_no is not null;

-- ── คิวรีเช็คผลหลัง apply (รันที่ DR — "Product DB") ─────────────────────────────
-- select column_name, data_type, is_nullable from information_schema.columns
--  where table_schema='public' and table_name='defect_logs'
--    and column_name in ('child_mat_no','child_part_name','child_qty_per_fg');
--   → ต้องได้ 3 แถว · is_nullable = YES ทั้ง 3
-- select count(*) total, count(child_mat_no) with_child from public.defect_logs;
--   → with_child ต้องเป็น 0 ทันทีหลัง apply (ไม่มี backfill · ของเก่าไม่ถูกแตะ)
-- select indexname from pg_indexes where tablename='defect_logs' and indexname='defect_logs_child_mat_idx';
--   → ต้องได้ 1 แถว

-- ── ROLLBACK (ปลอดภัย — คอลัมน์ว่าง ไม่มีสูตรไหนอ่าน) ────────────────────────────
-- 🔴 ลำดับ: revert โค้ดก่อน (ฟอร์มจะหยุดส่ง 3 ช่องนี้) แล้วค่อย drop
-- drop index if exists public.defect_logs_child_mat_idx;
-- alter table public.defect_logs
--   drop column if exists child_mat_no,
--   drop column if exists child_part_name,
--   drop column if exists child_qty_per_fg;
