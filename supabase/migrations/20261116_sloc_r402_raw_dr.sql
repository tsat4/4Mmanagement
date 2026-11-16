-- DR project ("Product DB" · eyhclzkifitbhbljgoav) · 2026-11-16 · สโตร์ระบุ
-- 🏬 ลงทะเบียน SLoc R402 (สโตร์วัตถุดิบ) — สโตร์ส่งแบบหน้า Monitor stock: แท็บ "Raw Mat R401,R402"
--   + ไฟล์ Stock_Store.xlsm มีชีท R402 (79 MAT เหล็ก 5xx) แต่ทะเบียนมีแค่ R401
-- ชื่อใช้ตามคำของสโตร์ ("Raw Mat") · ไม่ผูกไลน์ (เป็นพื้นที่สโตร์ ไม่ใช่พื้นที่ผลิต — แบบเดียวกับ R401)
-- Blast radius: เพิ่ม 1 แถวใน `storage_locations` · ไม่แตะ ledger/ข้อมูลเดิม
-- Rollback: delete from public.storage_locations where code = 'R402' and line_names = '{}';
insert into public.storage_locations (code, name, kind, sort_order, line_names, note, is_active)
values ('R402', 'พื้นที่สโตร์วัตถุดิบ Raw Mat (R402)', 'raw', 55, '{}', 'สโตร์ระบุ 16/11 · แท็บ Raw Mat (R401·R402)', true)
on conflict (code) do nothing;
