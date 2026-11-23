-- ══ 🤝 Customer Satisfaction (Q&D) ขึ้น "รางสูตร" — MAIN · ewhdfqwfwofivojtsizn · 2026-11-16 ══════════
-- user 16/11: "customer satisfaction ต้อง single source of truth และยิ่งค่าของโรงงาน ต้องมีค่าเดียว
--              ดึงไปใช้เอา และดูเรื่องการแตกค่าแยกด้วย อย่าง Q-D, DL-OH จะเซ็ทยังไง"
--
-- ที่มีอยู่แล้วและ **ไม่ต้องทำใหม่** (ตรวจฐานจริง 16/11):
--   · `kpi_catalog.value_scope='plant'` ของ `Customer Satisfaction` (9a7e3d90) ⇒ นิยามของทุกหน่วย
--     (โรงงาน · QA · PD1-4 · Die MTN = 7 แถว active) **อ่านค่าจากแถวระดับโรงงานแถวเดียว** อยู่แล้ว
--     (`valueScopeOf`/`sharedValueDef` · `src/utils/kpiSetup.js` §valueScope) = single source of truth เชิงโครงสร้าง
--   · `Internal Satisfaction` (ee707fa4) = `value_scope='own'` ⇒ แบบสอบถามคนละใบรายหน่วย **ห้ามแตะ**
--     (Tooling MTN มีค่าจริงของตัวเอง 7 เดือน)
--
-- ที่ migration นี้ทำ: ให้ **แถวระดับโรงงานแถวเดียวนั้น** คิดค่าจากตัวแปรฐาน แทนการกรอก % สำเร็จรูป
--   ⇒ คะแนนดิบ 4 ช่อง (ได้/เต็ม × Q/D) กรอกที่ `kpi_base_inputs` ขอบเขต ทั้งโรงงาน (`level:'plant'`)
--   ⇒ ค่ารวม = `csat_qd_pct` = (Σคะแนนที่ได้ ÷ Σคะแนนเต็ม) × 100   ← สูตรทางการของทะเบียนเป๊ะ
--   ⇒ ขา Q/D = `parts: ['csat_q_pct','csat_d_pct']` จอ 🔍 วาดคนละกราฟให้เอง (รางเดียวกับ DL&OH)
--   🔴 **ห้ามเฉลี่ย % ของ 2 ขา** (ตัวหารไม่เท่ากัน) · ขาไม่ครบ = `null` ห้ามเดา 0
--
-- ⚠️ ย้อนง่าย + ไม่ทำข้อมูลเดิมหาย: 10 เดือนที่กรอกไว้ยังอยู่ใน `kpi_manual_entries` ครบ และยังโชว์เหมือนเดิม
--    เพราะกฎช่วงเปลี่ยนผ่านใน `applyFormulaEntries()`: เดือนที่สูตรยังคำนวณไม่ได้ = ใช้ค่ากรอกมือ + ติดป้าย ✍️
--    (เดือนที่กรอกคะแนนดิบครบจึงค่อยสลับเป็น 🧮) ⇒ **ไม่ backfill อะไรเลย** (ไม่รู้ว่า 87.50% มาจาก 21/24 หรือ 7/8
--    — เดาแทนคนไม่ได้ · กฎความซื่อสัตย์ของจอ)
-- 📄 docs/modules/obeya-kpi-board.md §ความพึงพอใจ Q/D · src/utils/kpiSetup.js §KPI_FORMULAS

update public.kpi_definitions
   set provider = 'formula',
       provider_config = jsonb_build_object('formula', 'csat_qd_pct')
 where year = 2026
   and scope_kind = 'plant'
   and catalog_id = '9a7e3d90-fce1-4884-a56a-0b8c44be01e4'   -- Customer Satisfaction (value_scope=plant)
   and is_active;

-- ── ตรวจผล (Main "MAIN" · ewhdfqwfwofivojtsizn) ────────────────────────────────────────────
-- 1) แถวโรงงานขึ้นรางสูตรแล้ว (คาด 1 แถว · provider=formula · formula=csat_qd_pct):
--    select id, name, scope_kind, provider, provider_config->>'formula' as formula
--      from kpi_definitions
--     where year=2026 and catalog_id='9a7e3d90-fce1-4884-a56a-0b8c44be01e4' and is_active
--     order by scope_kind desc;
--    -- แถวของหน่วย (QA/PD1-4/Die MTN) ยังเป็น manual ได้ตามเดิม — ไม่ได้ใช้ค่าตัวเอง (value_scope=plant)
-- 2) ค่าที่กรอกไว้ 10 เดือนยังอยู่ครบ (คาด 10):
--    select count(*) from kpi_manual_entries
--     where kpi_id='11300685-150f-4b8b-b0c6-c498f8540655' and value is not null;
-- 3) ยังไม่มีใครกรอกคะแนนดิบ (คาด 0 — จอจะโชว์ค่ากรอกมือเดิมพร้อมป้าย ✍️):
--    select var_key, count(*) from kpi_base_inputs
--     where year=2026 and var_key like 'csat\_%' group by 1;
--
-- ── rollback (ปลอดภัย · ไม่มีข้อมูลหาย) ───────────────────────────────────────────────────
-- update public.kpi_definitions set provider='manual', provider_config=null
--  where year=2026 and scope_kind='plant' and catalog_id='9a7e3d90-fce1-4884-a56a-0b8c44be01e4';
