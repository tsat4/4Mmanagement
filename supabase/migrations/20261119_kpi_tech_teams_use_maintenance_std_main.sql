-- ══ 🔧 KPI: ทีมช่างทุกทีมอิงแบบ `Maintenance` + Customer Satisfaction เป็นค่ากลางโรงงาน ══════
-- Main "MAIN" · ewhdfqwfwofivojtsizn · 2026-11-19
--
-- คำสั่ง user 19/11:
--   1. *"customer sat เป็น single source ทุกแผนกใช้ตัวเดียวกันทั้งโรงงาน"*
--   2. *"ทีมช่างใช้มาตรฐานเดียวกันคือ kpi maintenance เพราะในแบบ kpi die maintenance
--       เหมือนเป็นของโรงงานสร้างแม่พิมพ์ใช้"*
--
-- ── ทำไมข้อ 2 ถึงถูก (วัดจากทะเบียนจริง 19/11) ────────────────────────────────────────────
-- แบบ `Die Maintenance` ใน `kpi_standard_items` มี 13 ข้อ ซึ่งเป็น KPI ของ **ธุรกิจสร้าง-ขายแม่พิมพ์**:
--   Annual Sale Per Head · Customer Satisfaction (Q&D) · Engineering Day ·
--   Manage project to achieve & on time delivery to customer as target ·
--   Keep inventory no more than · Reduce interuption from mold problems ·
--   Reduce part rework from DIE & JIG tooling · Part quality concern from Dies & Jig MTN
-- และ **ไม่มี MTBF / MTTR / MO Closed on target / Machine Break Down เลยสักตัว**
-- ⇒ ทีมช่างที่ซ่อมแม่พิมพ์ในโรงงานปั๊มของเราวัดด้วยแบบนี้ไม่ได้ (ไม่มียอดขาย ไม่มีลูกค้าภายนอก)
--    และตัววัดเนื้องานจริงของช่างหายไปทั้งหมด
-- แบบ `Maintenance` มีครบ: DL&OH · Internal Satisfaction · MO Closed on target · Safety ·
--    Machine Break Down · MTBF · MTTR · Cost Reduction (MTN) · Annual Sale Per Head ·
--    TS Academy · QCC · Engineering Day
--
-- 🔴 ทะเบียน "หน่วยงานจริง → หน่วยงานมาตรฐาน" อยู่ที่ `src/utils/kpiSetup.js`
--    (`KPI_STD_UNIT_ALIASES`) — **ไม่ใช่การเดาจากชื่อ** `guessStdUnit()` ยังตรงเป๊ะเท่านั้นเหมือนเดิม
--
-- ⚠️ ไฟล์นี้บันทึกสิ่งที่ apply ผ่าน MCP ไปแล้ว 19/11 (ไม่ใช่ของค้างรอรัน) — เก็บไว้ให้ย้อนได้

-- ── ข้อ 1: ค่ากลางโรงงานของ Customer Satisfaction ไม่ควรติดป้ายหน่วยช่าง ──────────────────
-- แถวค่ากลาง (scope_kind='plant' · มีข้อมูลจริง 10 เดือน) เคยติด std_unit='Die Maintenance'
-- ซึ่งอ่านแล้วเหมือนเป็น KPI ของทีมช่าง ทั้งที่เป็นค่าของทั้งโรงงานที่ทุกหน่วยดึงไปใช้
-- (กลไก single source อยู่ที่ `kpi_catalog.value_scope='plant'` → `sharedValueDef()` ซึ่งถูกอยู่แล้ว
--  ยืนยัน 19/11: หน่วยที่ดึงไปใช้ 5 หน่วย — PD1-4, QA — มีข้อมูลของตัวเอง **0 แถวทุกหน่วย**)
update public.kpi_definitions
   set std_unit = 'GM Plant', updated_at = now()
 where id = '11300685-150f-4b8b-b0c6-c498f8540655'
   and std_unit = 'Die Maintenance';

-- ── ข้อ 2a: ผูกใบ KPI ของทีมช่างทุกหน่วยเข้ากับแบบ `Maintenance` ───────────────────────────
-- (49 แถว · เดิม: Die MTN='Die Maintenance' · Mechanic='Die Maintenance' ·
--  Tooling MTN='Tooling'+ว่าง · JIG MTN/Maintenance/Electric บางแถว=ว่าง)
update public.kpi_definitions
   set std_unit = 'Maintenance', updated_at = now()
 where year = 2026
   and scope_value in ('Die MTN','JIG MTN','Tooling MTN','Mechanic','Electric','Maintenance')
   and coalesce(std_unit,'') <> 'Maintenance';

-- ── ข้อ 2b: Die MTN — Customer Satisfaction → Internal Satisfaction ───────────────────────
-- แบบ Maintenance ใช้ Internal Satisfaction (ช่างวัดความพึงพอใจของ "ลูกค้าภายใน" = ไลน์ผลิต)
-- สลับ 1:1 — น้ำหนัก 5 · เกณฑ์ ≥95% / 100% · หมวด customer **คงเดิมทั้งหมด**
-- และแถวนี้มีข้อมูลของตัวเอง 0 เดือน ⇒ ไม่มีตัวเลขไหนหาย
update public.kpi_definitions
   set catalog_id   = 'ee707fa4-19dd-41ee-b96b-10d5e5389c6a',   -- kpi_catalog "Internal Satisfaction" (value_scope='own')
       name         = 'Internal Satisfaction',
       std_item_id  = '0a9d5b82-a428-48dd-a1cb-191fa4f930c3',   -- kpi_standard_items · Maintenance seq 2
       formula_text = '(Actual Score/Total Score) x 100',
       updated_at   = now()
 where id = '18c5bcac-5d16-4fff-8927-8d403bc9b029'
   and name = 'Customer Satisfaction (Q&D)';

-- ── ข้อ 2c: ผูกแถวที่มีอยู่แล้วเข้าทะเบียน `Maintenance` (25 แถว) ──────────────────────────
-- 🔴 **ขั้นนี้ต้องมาก่อนการหยิบข้อที่ขาดเสมอ** — ไม่งั้นได้ KPI ซ้ำ 2 แถว
--    `matchStdItems()` จับคู่ด้วย `std_item_id` ก่อน แล้วค่อยเทียบ "ชื่อแบบตรงตัว"
--    ⇒ แถวที่ชื่อเพี้ยนนิดเดียวจะถูกนับว่า "ยังไม่ได้หยิบ" ทั้งที่มีอยู่แล้ว เช่น
--      `DL+OH (Direct Labor + Overhead)`      = `Direct Labour & Overhead Expenses`
--      `Cost Reduction (Tooling MTN)`/`(JIG MTN)` = `Cost Reduction (MTN)`
--      `Mean Time Between Failure (MTBF)`     = `Mean Time Between to Failure (MTBF)`   (ขาดคำว่า to)
--      `Safety (Serious/Absent/Minor/Fire)`   = `Safety`
--      `Annual Sales Per Head`                = `Annual Sale Per Head`                  (เกิน s)
-- · Die MTN 6 แถว + Mechanic·DL&OH เดิมผูกอยู่กับแบบ `Die Maintenance` ⇒ ย้ายมาชี้แบบ Maintenance
-- · Tooling MTN · Internal Satisfaction เดิมผูกผิดไปที่ **Production / Customer Satisfaction (Q&D)**
-- · JIG MTN ผูกกับแบบ Maintenance ครบอยู่แล้วทั้ง 12 แถว — ไม่ต้องแตะ (ใช้เป็นต้นแบบได้)
-- (SQL เต็มดูในประวัติ session 19/11 — เป็น update ... from (values ...) รายคู่ id)

-- ── ข้อ 2d: Electric — **เปิดคืนแถวเดิม ไม่ใช่หยิบใหม่** ──────────────────────────────────
-- 🔴 กับดักที่เกือบพลาด: 4 ข้อที่ดูเหมือน "ขาด" ของ Electric มีอยู่แล้วแต่ถูก **ปิดใช้งาน** ไว้
--    และยังมีข้อมูลจริงค้างอยู่ — `MO Closed on target` 3 เดือน · `QCC` 7 เดือน
--    หยิบใหม่ = ได้แถวซ้ำ + ข้อมูล 10 เดือนกำพร้า (จอ `KpiStandardModal` กัน 23505 ไว้ด้วย
--    `findClosedTwin()` ⇒ SQL ก็ต้องทำแบบเดียวกัน)
update public.kpi_definitions d
   set is_active = true, std_item_id = s.id, updated_at = now()
  from public.kpi_standard_items s
 where d.year = 2026 and d.scope_value = 'Electric' and not d.is_active
   and s.year = 2026 and s.std_unit = 'Maintenance'
   and lower(trim(s.topic)) = lower(trim(d.name));

-- ── ข้อ 2e: หยิบข้อบังคับที่ขาดจริง (19 แถว) ──────────────────────────────────────────────
-- Die MTN 5 · Mechanic 3 · Tooling MTN 2 · Maintenance 9 · (JIG MTN/Electric = 0 ไม่ต้องหยิบ)
-- ⚠️ **ไม่ใส่น้ำหนัก/เป้าโดยตั้งใจ** — เอกสารกลุ่มให้หน่วยงานถ่วงเอง ระบบเดาแทนไม่ได้
--    (payload ชุดเดียวกับปุ่ม "หยิบข้อบังคับที่ขาด" ใน `KpiStandardModal.pickAllFixed()`)
with units(u, kind) as (values ('Die MTN','department'),('Tooling MTN','section'),
                               ('Mechanic','department'),('Maintenance','section')),
std as (select * from public.kpi_standard_items
         where year=2026 and std_unit='Maintenance' and requirement='fixed')
insert into public.kpi_definitions (year, scope_kind, scope_value, category, name, formula_text,
                                    std_item_id, std_unit, is_active)
select 2026, units.kind, units.u, s.perspective, s.topic, s.formula_text, s.id, 'Maintenance', true
  from units cross join std s
 where not exists (
   select 1 from public.kpi_definitions d
    where d.year=2026 and d.scope_value = units.u
      and (d.std_item_id = s.id or lower(trim(d.name)) = lower(trim(s.topic))));

-- 📊 ผลหลังทำครบ (วัด 19/11) — **ข้อบังคับขาด 0 · ซ้ำ 0 ทุกหน่วย** · ข้อมูลเดิมอยู่ครบ:
--    Die MTN 17 แถว (นอกมาตรฐาน 5 · 10 เดือน) · Electric 12 (นอก 1 · 86 เดือน)
--    JIG MTN 13 (นอก 1 · 31) · Maintenance 11 (นอก 0 · 20)
--    Mechanic 11 (นอก 0 · 73) · Tooling MTN 13 (นอก 2 · 103)

-- ── ตรวจผล (Main "MAIN" · ewhdfqwfwofivojtsizn) ──────────────────────────────────────────
-- 1) Customer Satisfaction เหลือค่ากลาง 1 แถว + หน่วยที่ดึงไปใช้ (own_rows ต้องเป็น 0 ทุกหน่วย):
--    select d.scope_kind, coalesce(d.scope_value,'(ทั้งโรงงาน)') as scope, d.std_unit,
--           (select count(*) from kpi_manual_entries e where e.kpi_id=d.id) as own_rows
--      from kpi_definitions d join kpi_catalog c on c.id=d.catalog_id
--     where c.name='Customer Satisfaction' and d.year=2026 and d.is_active
--     order by 1,2;
-- 2) ทีมช่างผูกแบบ Maintenance ครบ (คาด 6 หน่วย · std_unit ต้องเป็น 'Maintenance' ทั้งหมด):
--    select scope_value, coalesce(std_unit,'(ว่าง)'), count(*) from kpi_definitions
--     where year=2026 and scope_value in ('Die MTN','JIG MTN','Tooling MTN','Mechanic','Electric','Maintenance')
--     group by 1,2 order by 1,2;
--
-- ── rollback (คืนค่าเดิมเป๊ะ — ไล่ตาม id ที่ UPDATE คืนมาจริงตอน apply 19/11) ───────────────
-- -- (ก) ค่ากลางโรงงาน Customer Satisfaction กลับไปติดป้าย Die Maintenance
-- update public.kpi_definitions set std_unit='Die Maintenance'
--  where id='11300685-150f-4b8b-b0c6-c498f8540655';
--
-- -- (ข) Die MTN (12 แถว) + Mechanic·DL&OH (1 แถว) เดิมเป็น 'Die Maintenance'
-- update public.kpi_definitions set std_unit='Die Maintenance' where id in (
--     '1d4f87d2-1467-4b50-9697-7cf23787d867',
--     '213f2004-55a5-435b-91a1-db4a6f4e5338',
--     '18c5bcac-5d16-4fff-8927-8d403bc9b029',
--     'a4a9e75d-a9e4-4b08-8eef-142b4ba4c3cd',
--     'd2ba28a0-2138-4281-a7f2-53d4d1756427',
--     '3bcdb9d1-4c69-40ba-9fb4-13092e418a98',
--     '16746847-2fa9-40f1-8e89-7eacfb45d5b0',
--     'f8cd8d5f-016a-4d85-ab1b-cb82d0f3f87d',
--     '3d27ffe0-1ac0-42e1-883a-aac189f25606',
--     '643052af-ca09-42d1-848d-75d9d91efb44',
--     '598f163f-835e-4c4f-a5bc-c6d180204eb4',
--     '6eb3d836-7328-4fe8-ae9c-96d287ca27e8',
--     '4c8efcd9-5ee8-4604-91b4-562c68ccb8ff');
--
-- -- (ค) Tooling MTN · Raw Material Control (ปิดใช้งานอยู่) เดิมเป็น 'Tooling'
-- update public.kpi_definitions set std_unit='Tooling'
--  where id='4b926f49-436f-4b94-8879-fb7c21754255';
--
-- -- (ง) ที่เหลือ 34 แถว เดิมเป็น NULL
-- update public.kpi_definitions set std_unit=null where id in (
--     'b3d4b2c0-487d-44b8-a721-021ab0e91fc7',
--     '6b011416-3f19-4f39-a15d-2ade65bc2791',
--     'b4479725-98ad-49c2-80f6-bca725f9d7c9',
--     '0fbe599d-8073-46ac-b7fd-16988ea0e8fc',
--     'ce9ed550-da9f-4c39-9611-1855606e885e',
--     '48eb26be-3e1c-44e0-aee0-667b5851cb09',
--     'a6336761-8c75-4752-9e96-79be35dbb799',
--     '8edea2d0-7cca-4623-8751-343148a06eb8',
--     '4612a3ca-f0a3-46f3-a3a5-b03632b77442',
--     '7f44164a-b95f-47d1-8d1c-5a7f3fda0a6f',
--     'ee5ef3d1-b88c-4d47-8820-931739833f28',
--     'd6f9488d-1bd2-4686-b7d0-356744204b39',
--     '938541b0-100a-4f9a-bad5-983b887dbc04',
--     '6f1aa716-6797-4a1a-9597-de926d18f8c1',
--     'aa9fe3a9-5587-48c3-885e-1b03ab74c6e1',
--     'e30c8be8-e47e-4f21-ad86-c42a46e2790b',
--     '9931337c-99e8-4f75-9670-391113d626fa',
--     'de7b3321-76ef-4ecb-bfb3-3826b24db120',
--     'baba5ff5-05a2-4c8f-b99a-38f20a4e0a8b',
--     '13c26482-e57b-41bb-8dfd-38deb5bf3181',
--     'ac45bf27-a4de-4624-a2e0-76cdf7f9587e',
--     '6806bcf1-b550-4938-bd50-18dfbb249132',
--     'bc7a9633-dc36-47bb-b91c-69d77a4165ec',
--     '3ef22c80-8132-482c-b212-33b0d55a5453',
--     '6e91806c-9f71-4c61-b3f1-06cf3ca9cd7b',
--     '39d0910d-0166-4298-8dc9-012f81e7e59a',
--     '9cc8b34b-f1d3-42b9-b5b7-0796a110afd8',
--     'b397ab62-b553-4974-b6f3-6855d75b389d',
--     '6b03a73f-e6a6-4d0e-908f-1902a5842188',
--     'c72b0c0d-76c2-4db7-8fee-30ec6b8b7b9e',
--     '150be22f-28dc-422b-b3bc-718c47665aeb',
--     'af3b7ce9-84c1-486a-93b1-b5a07ccb47fc',
--     '7b61ebed-39f7-4e3e-bf8c-ac585123fe8d',
--     '3bc2b8f8-6b31-459a-91a9-e2b4debb640b');
--
-- -- (จ) Die MTN · Internal Satisfaction กลับเป็น Customer Satisfaction (Q&D)
-- update public.kpi_definitions
--    set catalog_id='9a7e3d90-fce1-4884-a56a-0b8c44be01e4', name='Customer Satisfaction (Q&D)',
--        std_item_id='477be2fb-1cad-4be6-9eeb-355e128915cc'
--  where id='18c5bcac-5d16-4fff-8927-8d403bc9b029';
