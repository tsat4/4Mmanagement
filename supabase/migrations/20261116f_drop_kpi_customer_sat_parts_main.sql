-- ══ 🧹 ถอนตาราง `kpi_customer_sat_parts` — MAIN · ewhdfqwfwofivojtsizn · 2026-11-16 ══════════════════
-- ตารางนี้สร้างเช้าวันเดียวกัน (migration `20261116c_kpi_customer_sat_parts_main.sql` ซึ่งถอนออกไปแล้ว)
-- เพื่อเก็บคะแนนรายขา Q/D ของความพึงพอใจ **คีย์ด้วย `kpi_id`**
--
-- เหตุที่ถอน (คำสั่ง user 16/11 "customer satisfaction ต้อง single source of truth และยิ่งค่าของโรงงาน
-- ต้องมีค่าเดียว ดึงไปใช้เอา"): แบบสอบถามลูกค้าเป็น **ใบเดียวของโรงงาน** แต่คีย์ `kpi_id` ทำให้นิยาม
-- 7 แถว (โรงงาน · QA · PD1-4 · Die MTN) ถือคะแนนของตัวเองได้แถวละชุด = **7 ชุดของใบเดียวกัน**
-- ⇒ ตรงข้ามกับ "ค่าเดียว ดึงไปใช้" และยังขัดกับ `kpi_catalog.value_scope='plant'` ที่บังคับให้ทุกหน่วย
--   อ่านค่าจากแถวโรงงานแถวเดียวอยู่แล้ว (ค่ารวมมาจากแถวโรงงาน แต่ขา Q/D มาจากแถวตัวเอง = เลขไม่ตรงกันเงียบๆ)
--
-- ที่ใช้แทน: คะแนนดิบ 4 ช่องเป็น **ตัวแปรฐาน `level:'plant'`** ใน `kpi_base_inputs`
--   (`csat_q_actual` · `csat_q_total` · `csat_d_actual` · `csat_d_total`) กรอกครั้งเดียวที่ขอบเขต ทั้งโรงงาน
--   ผ่านแผงกลาง `KpiBaseInputsPanel` · ค่ารวม/ขาย่อยมาจาก `KPI_FORMULAS` (`csat_qd_pct` + `parts`)
--   = รางเดียวกับ DL&OH ⇒ มีกลไกเดียวในระบบ (migration `20261116e_csat_qd_on_formula_rail_main.sql`)
--
-- ⚠️ ปลอดภัย: ตารางนี้ **ไม่เคยมีแถว** (ตรวจ 16/11 = 0) · โค้ดที่เรียกใช้ไม่เคยเข้า `main`
--    (อยู่แค่บนสายงานที่ถอนออกในคอมมิทเดียวกันนี้) ⇒ ไม่มีจอไหนอ่านตารางนี้แล้ว
-- 🔴 ตรวจก่อนรัน: ถ้า `select count(*)` ไม่เป็น 0 **ห้ามรัน** — มีคนกรอกข้อมูลไว้ ต้องย้ายเข้าตัวแปรฐานก่อน

do $$
declare n bigint;
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'kpi_customer_sat_parts') then
    execute 'select count(*) from public.kpi_customer_sat_parts' into n;
    if n > 0 then
      raise exception 'kpi_customer_sat_parts มี % แถว — ห้ามลบ (ย้ายเข้า kpi_base_inputs csat_* ก่อน)', n;
    end if;
    drop table public.kpi_customer_sat_parts;
  end if;
end $$;

-- ── ตรวจผล (Main "MAIN" · ewhdfqwfwofivojtsizn) ────────────────────────────────────────────
-- select count(*) from pg_tables where schemaname='public' and tablename='kpi_customer_sat_parts';  -- คาด 0
--
-- ── rollback: รัน migration `20261116c_kpi_customer_sat_parts_main.sql` ของเดิมซ้ำ
--    (อยู่ในประวัติ git — แต่ก่อนรื้อกลับ ให้อ่านเหตุผลข้างบนก่อน: มี 2 กลไกทำงานเดียวกัน = เลขขัดกันเงียบ)
