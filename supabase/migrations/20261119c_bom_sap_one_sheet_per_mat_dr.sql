-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- 🌳 BOM แบบ SAP — "1 MAT = 1 ใบ · ในใบมีแค่ลูกตรง" (DR · Product DB · eyhclzkifitbhbljgoav)
--    คำสั่ง user 19/11: "อาทิตนี้ต้องจบ ให้ระบบเราทำงานเหมือน SAP เลย จะเหนือกว่าตรงมีขั้น OP"
--    + "ของที่มีอยู่แล้ว ทำให้ได้โดยไม่ต้องอัพ CS12" + "ลงทะเบียนให้เลย แล้วเริ่มได้เลย"
--    ⇒ กลับทิศจาก 20261105_bom_single_source_child_sheets_dr.sql (ผังอยู่ในใบแม่ใบเดียว)
--
--    หลักฐานว่า SAP เป็นแบบนี้: จอ CS03 ของ 20070036 + 20066630 (Plant 2140) ที่ user ส่งมา 19/11
--    = ใบละชั้นเดียว · ลูกที่เป็น assembly (20058490/91) มีใบของตัวเอง
--
--    ทำอะไร (ข้อมูลล้วน · ไม่แตะฟังก์ชัน/trigger — `fn_bom_kid_rows(mat, null)` อ่านใบของตัวเองก่อนอยู่แล้ว):
--      ① ลงทะเบียน `dr_products` ให้ MAT ที่มีลูกแต่ยังไม่มีแถวสินค้า (ชื่อ/P-No จาก parts_master)
--      ② MAT ที่ลูกถูกนิยามไว้ในใบอื่นแต่ไม่มีในใบของตัวเอง ⇒ copy นิยามนั้นเข้าใบของตัวเอง
--      ③ ปิดแถว "หลาน" ที่นอนอยู่ในใบแม่ (`parent_mat` = MAT ที่ไม่ใช่เจ้าของใบ) — ปิด ไม่ลบ
--    ทำเฉพาะ MAT ที่ทุกใบเขียนตรงกัน (ลายเซ็น ลูก:qty:หน่วย เดียวกัน) · ใบที่เขียนไม่ตรงกัน / มีลูกเป็นขั้น OP
--    / ตัวแม่เป็นของลม = **ไม่แตะ ให้ PE ตัดสิน** (user เลือก "PE ไล่ตัดสินทีละบรรทัด")
--
--    🔴 ด่านในตัว (ไม่ผ่าน = raise · ทั้งก้อน rollback):
--      · ผลตัดจ่าย `fn_bom_direct_demand` ของสินค้า active ทุกตัว ต้องเท่าเดิมทุกบรรทัด (ยกเว้นตัวที่เพิ่งลงทะเบียน = เพิ่มได้อย่างเดียว)
--      · MAT ที่ "ไม่ถูกตัดที่ไหนเลย" (`fn_bom_deduct_gaps`) ต้องไม่เพิ่ม
--
--    สำรอง: archive.bom_items_sap_shape_20261119 (แถวที่ปิด + แถวที่สร้าง) · archive.dr_products_sap_shape_20261119
--    ย้อน:
--      update public.bom_items b set is_active = true  from archive.bom_items_sap_shape_20261119 a where b.id = a.id and a.action = 'closed';
--      update public.bom_items b set is_active = false from archive.bom_items_sap_shape_20261119 a where b.id = a.id and a.action = 'created';
--      update public.bom_items b set is_active = false, qty_per_unit = a.qty_per_unit, uom = a.uom, part_name = a.part_name
--        from archive.bom_items_sap_shape_20261119 a where b.id = a.id and a.action = 'reactivated';
--      update public.dr_products p set is_active = false from archive.dr_products_sap_shape_20261119 a where p.id = a.id;
--    ⛔ ห้ามรันซ้ำ (บล็อกด้วย archive table)
--
--    🟡 สถานะ 19/11: **ยังไม่ apply** — dry-run บนฐานจริงผ่าน (ลงทะเบียน 7 · ลงใบตัวเอง 86 (เปิดคืน 31)
--       · ปิดแถวหลาน 195 · ทำ 76 MAT · ผลตัดจ่ายต่าง 0 · โซ่ขาด 3 ⇒ 2 · ไม่แตะ 12 ตัวให้ PE)
--       รอแก้จอที่อ่าน `bom_items` แบบแบนด้วย product_id ก่อน (OpenOrderDemand / LinePartCall /
--       HeijunkaKanban / VSM / LineStock) — ไม่งั้นพาร์ทหลานหายจากจอเหล่านั้น
-- ═══════════════════════════════════════════════════════════════════════════════════════════

create schema if not exists archive;

do $mig$
declare
  v_dry boolean := false;          -- true = จำลอง: ทำทุกอย่างแล้ว raise รายงาน (rollback ทั้งก้อน)
  v_gaps_before int; v_gaps_after int;
  v_reg int; v_created int; v_closed int; v_diff int; v_diff_txt text;
  v_skip text;
begin
  if to_regclass('archive.bom_items_sap_shape_20261119') is not null then
    raise exception 'migration นี้รันไปแล้ว (มี archive.bom_items_sap_shape_20261119) — ห้ามรันซ้ำ';
  end if;

  create table archive.bom_items_sap_shape_20261119 as
    select b.*, null::text as action from public.bom_items b where false;
  create table archive.dr_products_sap_shape_20261119 (id uuid primary key, mat_no text, name text);

  /* ── ก่อนแตะ: ภาพถ่ายผลตัดจ่าย + โซ่ขาด ── */
  create temp table _before on commit drop as
    select upper(btrim(p.mat_no)) fg, upper(btrim(d.mat_no)) mat, round(sum(d.qty_per_unit), 6) q
      from public.dr_products p cross join lateral public.fn_bom_direct_demand(p.mat_no) d
     where p.is_active group by 1, 2;
  select count(*) into v_gaps_before from public.fn_bom_deduct_gaps();

  /* ── ① ลงทะเบียน MAT ที่มีลูก (ในใบ active) แต่ไม่มีแถวสินค้าเลย ── */
  with parents as (
    select distinct upper(btrim(b.parent_mat)) m
      from public.bom_items b join public.dr_products p on p.id = b.product_id
     where b.is_active and p.is_active and coalesce(btrim(b.parent_mat), '') <> ''
  ), ins as (
    insert into public.dr_products (name, mat_no, p_no, is_active)
    select pm.part_name, btrim(pm.mat_no), nullif(btrim(pm.part_no), ''), true
      from parents x
      join lateral (select * from public.parts_master pm
                     where upper(btrim(pm.mat_no)) = x.m and coalesce(btrim(pm.part_name), '') <> ''
                     order by pm.mat_no limit 1) pm on true
     where not exists (select 1 from public.dr_products d where upper(btrim(d.mat_no)) = x.m)
    returning id, mat_no, name
  )
  insert into archive.dr_products_sap_shape_20261119 select id, mat_no, name from ins;
  get diagnostics v_reg = row_count;

  /* ── จัดกลุ่ม (หลังลงทะเบียน) ── */
  create temp table _r on commit drop as
    select b.id, p.id sheet_id, upper(btrim(p.mat_no)) sheet,
           upper(btrim(coalesce(b.parent_mat, p.mat_no))) parent, upper(btrim(b.mat_no)) mat,
           b.qty_per_unit q, coalesce(b.uom, '') uom
      from public.bom_items b join public.dr_products p on p.id = b.product_id
     where b.is_active and p.is_active;

  create temp table _defs on commit drop as
    select parent, sheet_id, sheet,
           string_agg(mat || ':' || q || ':' || uom, '|' order by mat, q) sig,
           count(*) filter (where id is not null) n
      from _r group by parent, sheet_id, sheet;

  create temp table _target on commit drop as
    select d.parent,
           (select dp.id from public.dr_products dp
             where upper(btrim(dp.mat_no)) = d.parent and dp.is_active) own_id,
           bool_or(d.sheet = d.parent) has_own
      from _defs d
     group by d.parent
    having bool_or(d.sheet <> d.parent)                                      -- มีนิยามนอนอยู่ในใบอื่น
       and count(distinct d.sig) = 1                                         -- ทุกใบเขียนตรงกัน
       and not public.fn_bom_is_phantom(d.parent)                            -- ตัวแม่ไม่ใช่ OP/ของลม
       and not exists (select 1 from _r x join public.dr_products dp         -- ลูกไม่มีขั้น OP
                        on upper(btrim(dp.mat_no)) = x.mat and dp.is_operation
                       where x.parent = d.parent)
       and (select count(*) from public.dr_products dp                       -- มีใบของตัวเอง active ใบเดียว
             where upper(btrim(dp.mat_no)) = d.parent and dp.is_active) = 1;

  /* ── ② copy นิยามเข้าใบของตัวเอง (เฉพาะตัวที่ใบตัวเองยังไม่มีแถว active)
        🔴 ใบของตัวเองหลายใบมีแถว "ปิดแล้ว" ค้างจาก 20261105 · unique index ไม่สนใจ is_active
           ⇒ แถวที่ (ใบ, ชั้น 1, mat) ตรงกัน = เปิดแถวเดิมคืน + ตั้ง qty/หน่วยตามนิยามที่ใช้ตัดอยู่
              (เก็บค่าเดิมไว้ใน archive action='reactivated') · item_no ของแถวเดิมคงไว้
           ⇒ แถวใหม่ที่ item_no ชนแถวใดๆ ในใบ = ใส่ item_no ว่าง (ห้ามให้ทั้งก้อนล้มเพราะเลข ITEM) ── */
  create temp table _src on commit drop as
    select s.own_id, b.*
      from (select distinct on (t.parent) t.parent, t.own_id, d.sheet_id
              from _target t join _defs d on d.parent = t.parent and d.sheet <> t.parent
             where not t.has_own
             order by t.parent,
                      (select count(*) from public.bom_items b where b.product_id = d.sheet_id and b.is_active
                          and upper(btrim(b.parent_mat)) = t.parent and b.item_no is not null) desc,
                      d.sheet) s
      join public.bom_items b
        on b.product_id = s.sheet_id and b.is_active and upper(btrim(b.parent_mat)) = s.parent;

  insert into archive.bom_items_sap_shape_20261119
    select o.*, 'reactivated' from public.bom_items o
      join _src s on o.product_id = s.own_id and o.parent_mat is null and o.mat_no = s.mat_no
     where not o.is_active;
  update public.bom_items o
     set is_active = true, qty_per_unit = s.qty_per_unit, uom = s.uom, part_name = s.part_name, updated_at = now()
    from _src s, archive.bom_items_sap_shape_20261119 a
   where a.id = o.id and a.action = 'reactivated'
     and o.product_id = s.own_id and o.parent_mat is null and o.mat_no = s.mat_no;

  with ins as (
    insert into public.bom_items (product_id, parent_mat, mat_no, part_name, part_no, qty_per_unit, uom,
                                  item_no, op_no, prod_sloc, storage_location, supplier, source_line,
                                  qty_per_pkg, note, is_active)
    select s.own_id, null, s.mat_no, s.part_name, s.part_no, s.qty_per_unit, s.uom,
           case when exists (select 1 from public.bom_items x where x.product_id = s.own_id
                               and x.parent_mat is null and x.item_no = s.item_no) then null else s.item_no end,
           s.op_no, s.prod_sloc, s.storage_location, s.supplier, s.source_line,
           s.qty_per_pkg, s.note, true
      from _src s
     where not exists (select 1 from public.bom_items o where o.product_id = s.own_id
                         and o.parent_mat is null and o.mat_no = s.mat_no)
    returning *
  )
  insert into archive.bom_items_sap_shape_20261119 select ins.*, 'created' from ins;
  get diagnostics v_created = row_count;
  v_created := v_created + (select count(*) from archive.bom_items_sap_shape_20261119 where action = 'reactivated');

  /* ── ③ ปิดแถวหลานที่นอนอยู่ในใบอื่น ── */
  insert into archive.bom_items_sap_shape_20261119
    select b.*, 'closed' from public.bom_items b
      join public.dr_products p on p.id = b.product_id
      join _target t on t.parent = upper(btrim(b.parent_mat))
     where b.is_active and p.is_active and upper(btrim(p.mat_no)) <> t.parent;
  update public.bom_items b set is_active = false, updated_at = now()
    from archive.bom_items_sap_shape_20261119 a where b.id = a.id and a.action = 'closed';
  get diagnostics v_closed = row_count;

  /* ── ด่าน: ผลตัดจ่ายต้องเท่าเดิม ── */
  create temp table _after on commit drop as
    select upper(btrim(p.mat_no)) fg, upper(btrim(d.mat_no)) mat, round(sum(d.qty_per_unit), 6) q
      from public.dr_products p cross join lateral public.fn_bom_direct_demand(p.mat_no) d
     where p.is_active group by 1, 2;
  select count(*), string_agg(coalesce(b.fg, a.fg) || '→' || coalesce(b.mat, a.mat) || ' '
                              || coalesce(b.q::text, '∅') || '⇒' || coalesce(a.q::text, '∅'), ' ; ')
    into v_diff, v_diff_txt
    from _before b full join _after a on a.fg = b.fg and a.mat = b.mat
   where (b.q is distinct from a.q)
     and not (b.fg is null and a.fg in (select upper(btrim(mat_no)) from archive.dr_products_sap_shape_20261119));
  select count(*) into v_gaps_after from public.fn_bom_deduct_gaps();

  select string_agg(parent, ',' order by parent) into v_skip
    from (select parent from _defs group by parent
           having bool_or(sheet <> parent)
              and parent not in (select parent from _target)) s;

  if v_dry or v_diff > 0 or v_gaps_after > v_gaps_before then
    raise exception E'%\nลงทะเบียนสินค้า % · สร้างแถวในใบตัวเอง % · ปิดแถวหลาน % · ตัวที่ทำ % · ผลตัดจ่ายต่าง % [%] · โซ่ขาด % ⇒ % · ไม่แตะ (PE): %',
      case when v_dry then 'DRY-RUN (rollback)' else 'ด่านไม่ผ่าน — rollback ทั้งก้อน' end,
      v_reg, v_created, v_closed, (select count(*) from _target), v_diff, left(coalesce(v_diff_txt, ''), 1500),
      v_gaps_before, v_gaps_after, v_skip;
  end if;
  raise notice 'ลงทะเบียน % · สร้าง % · ปิด % · ผลตัดจ่ายต่าง 0 · โซ่ขาด % ⇒ %', v_reg, v_created, v_closed, v_gaps_before, v_gaps_after;
end
$mig$;
