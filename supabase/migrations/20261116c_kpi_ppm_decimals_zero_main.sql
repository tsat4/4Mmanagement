-- ════════════════════════════════════════════════════════════════════════════
-- PPM ต้องโชว์ "จำนวนเต็ม" ทุกจอ — ตั้งที่ทะเบียน ไม่ hardcode ในหน้า
-- project: MAIN (ชื่อในจอ Supabase "MAIN" · id ewhdfqwfwofivojtsizn)
-- ที่มา: feedback ประชุม 16/11 — *"PPM ต้องโชว์จำนวนเต็ม"*
--
-- ทำไมเป็นงานของ migration ไม่ใช่โค้ด:
--   `decimalsOf()` (src/utils/kpiSetup.js) อ่านทศนิยมจาก `kpi_definitions.decimals`
--   แล้วถอยไป `kpi_catalog.decimals` และ **ถอยสุดท้ายเป็น 2** ⇒ แถว PPM ที่ไม่ได้ตั้ง
--   ทศนิยมเอง จะถูกวาดเป็น "1,431.76" บนบอร์ด Obeya/ใบ KPI
--   (ฐานจริง 16/11: kpi_catalog 'PPM' decimals = 2 · kpi_definitions 5 แถว ตั้งเอง 0 แค่ 2 แถว)
--   PPM = ชิ้นต่อล้าน ⇒ ทศนิยมไม่มีความหมาย · ค่าที่ระบบคำนวณเองเป็นจำนวนเต็มอยู่แล้ว
--   (`ppmOf()` ใน src/utils/oee.js §7.3) แต่ **ค่าที่คนกรอกมือ/เป้า ยังมีทศนิยมได้**
--   ⇒ ต้องปิดที่ทะเบียนซึ่งเป็น single source ของ "ทศนิยมที่จะแสดง"
--
-- ย้อนกลับได้ (rollback): ตั้งค่าเดิมคืน
--   update public.kpi_catalog    set decimals = 2 where unit = 'PPM';
--   update public.kpi_definitions set decimals = null
--    where name = 'Internal defect (PPM)' and decimals = 0;
-- ════════════════════════════════════════════════════════════════════════════

-- 1) ทะเบียนกลาง: KPI ทุกตัวที่หน่วยเป็น PPM แสดงเป็นจำนวนเต็ม
update public.kpi_catalog
   set decimals = 0,
       updated_at = now()
 where unit = 'PPM'
   and coalesce(decimals, -1) <> 0;

-- 2) แถวนิยามที่ "ชื่อบอกว่าเป็น PPM" แต่ไม่ได้ผูกทะเบียน (catalog_id null)
--    ⇒ ไม่มีทะเบียนให้ถอยไป จะตกไปใช้ค่า 2 ของ `decimalsOf()` เสมอ ต้องตั้งที่แถวเอง
--    🔴 แคบไว้ที่ชื่อ + ไม่มีทะเบียน + ยังไม่ได้ตั้งทศนิยม — ห้ามกวาดแถวที่คนตั้งใจตั้งค่าไว้แล้ว
update public.kpi_definitions
   set decimals = 0
 where catalog_id is null
   and decimals is null
   and unit is null
   and name ilike '%(PPM)%';

-- ── คิวรีเช็คผล (รันบน MAIN) ─────────────────────────────────────────────────
-- select 'catalog' src, id::text, name, unit, decimals from public.kpi_catalog where unit = 'PPM'
-- union all
-- select 'definition', id::text, name, coalesce(unit, '(ตามทะเบียน)'), decimals
--   from public.kpi_definitions
--  where unit = 'PPM' or name ilike '%PPM%'
--  order by 1, 3;
-- คาดหวัง: แถว catalog decimals = 0 · แถว definition ที่ยังเป็น null = ตกทอดจากทะเบียน (ก็ได้ 0)
