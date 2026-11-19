-- ═══════════════════════════════════════════════════════════════════════════════
-- 20261119c — ปิดช่องโหว่ตัด-จ่ายสต็อก (DR · "Product DB" · eyhclzkifitbhbljgoav) · คำสั่ง user 19/11
--
-- (A) ปิดใบผลิตแล้ววัตถุดิบในระบบไม่พอ → **ตัดเต็ม ยอมติดลบ** ที่ "ไลน์ที่ปิดใบผลิต"
--     เดิม: ตัดเท่าที่มีทั้งพื้นที่ SAP แล้วส่วนที่ขาด "ไม่ตัด" (กลายเป็นยอดสั่งผลิตลูกอย่างเดียว)
--     ⇒ ยอดคงเหลือสูงเกินจริงสะสม · ใหม่: ส่วนขาดลง consume ที่ p_line (ติดลบ) แล้วพอสโตร์/ล็อตเติมเข้า
--       ไลน์นั้น ยอดหักล้างเอง (ledger = ผลรวม) · ยอดสั่งผลิตลูก (fn_child_short) ยังทำงานเหมือนเดิมเป๊ะ
--     fn_take_op_output: ชิ้นขั้น OP ไม่พอ + ไม่มีของที่ขั้นกินให้ตัดแทน (หรือลึกเกิน 5 ชั้น) = ติดลบที่ชิ้นขั้นนั้น
--
-- (D) QA ตัดสินของถังเหลือง "งานดี" / "ซ่อมผ่าน" (รับงานซ่อม) → ออกใบ "รอรับเข้า" ให้สโตร์นับรับ
--     (ของกลับไปไลน์ต้นทาง แล้วไลน์ส่งเข้าสโตร์ — เหมือนงานดีปกติที่โหมดยืนยันรับ)
--     ปลายทาง = กฎรับเข้าของพาร์ท (stock_inflow_rules · ทุกโหมด) · ไม่มีกฎ = ไม่ออกใบ (จอเขียนเตือน)
--     ยกเลิกผล (งานดี → อย่างอื่น / ถอนรับงานซ่อม) ขณะใบยังรอรับ = ยกเลิกใบให้เอง
--
-- ย้อนกลับ: ส่วน ROLLBACK ท้ายไฟล์ (คืน 2 ฟังก์ชันเดิมทั้งตัว + ถอด trigger) · คอลัมน์ใหม่ nullable ทิ้งไว้ได้
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── (A) ตัดเต็ม ยอมติดลบ ────────────────────────────────────────────────────────
create or replace function public.fn_take_raw(p_line text, p_mat text, p_part text, p_need numeric, p_wd date,
  p_note text, p_order uuid, p_session uuid, p_prod_no text, p_source_line text)
returns numeric language plpgsql as $function$
declare v_taken numeric; v_short numeric;
begin
  v_taken := public.fn_area_take(p_line, p_mat, p_part, p_need, p_wd, p_note, p_order, p_session);
  v_short := coalesce(p_need, 0) - v_taken;
  if v_short > 0 then
    -- 19/11 (user): ตัดส่วนที่ขาดที่ไลน์ที่ปิดใบ — ติดลบรอเติมหักล้าง
    insert into public.line_stock_transactions(line_name, mat_no, part_name, qty, type, work_date, note, created_by, ref_order_id, ref_session_id)
    values (p_line, p_mat, p_part, v_short, 'consume', p_wd,
            p_note || ' · ⚠ ในระบบไม่พอ ตัดเกิน ' || round(v_short) || ' (ติดลบ รอเติมหักล้าง)', 'auto', p_order, p_session);
  end if;
  perform public.fn_child_short(p_mat, p_part, v_short, p_line, p_wd, p_prod_no, p_source_line);
  return v_taken;   -- = ส่วนที่ตัดจากยอดบวก (ความหมายเดิม · ผู้เรียกทุกตัวใช้ perform)
end $function$;

create or replace function public.fn_take_op_output(p_line text, p_op text, p_need numeric, p_wd date,
  p_note text, p_order uuid, p_session uuid, p_prod_no text, p_depth integer default 0)
returns numeric language plpgsql as $function$
declare v_taken numeric; v_short numeric; i record; v_has boolean := false;
begin
  v_taken := public.fn_area_take(p_line, p_op, null, p_need, p_wd, p_note, p_order, p_session);
  v_short := coalesce(p_need,0) - v_taken;
  if v_short > 0 and p_depth < 5 then
    for i in select * from public.fn_op_inputs(p_op) loop
      v_has := true;
      if i.is_op_output then
        perform public.fn_take_op_output(p_line, i.mat_no, v_short * i.qty_per_unit, p_wd,
          p_note || ' · ชิ้นขั้น '||p_op||' ไม่พอ '||round(v_short)||' → ตัดแทน', p_order, p_session, p_prod_no, p_depth + 1);
      else
        perform public.fn_take_raw(p_line, i.mat_no, i.part_name, v_short * i.qty_per_unit, p_wd,
          p_note || ' · ชิ้นขั้น '||p_op||' ไม่พอ '||round(v_short)||' → ตัดลูกเดิมแทน', p_order, p_session, p_prod_no, i.source_line);
      end if;
    end loop;
  end if;
  -- 19/11: ไม่มีของที่ขั้นกินให้ตัดแทน (หรือลึกเกิน) = ติดลบที่ชิ้นขั้นนี้ ห้ามหายเงียบ
  if v_short > 0 and not v_has then
    insert into public.line_stock_transactions(line_name, mat_no, part_name, qty, type, work_date, note, created_by, ref_order_id, ref_session_id)
    values (p_line, p_op, null, v_short, 'consume', p_wd,
            p_note || ' · ⚠ ชิ้นขั้น OP ในระบบไม่พอ ตัดเกิน ' || round(v_short) || ' (ติดลบ รอเติมหักล้าง)', 'auto', p_order, p_session);
  end if;
  return v_taken;
end $function$;

-- ── (D) QA งานดี / ซ่อมผ่าน → ใบรอรับเข้า ──────────────────────────────────────
alter table public.stock_receipts add column if not exists quality_bin_id uuid;
alter table public.stock_receipts alter column prod_order_id drop not null;
create unique index if not exists stock_receipts_one_live_per_bin
  on public.stock_receipts (quality_bin_id) where quality_bin_id is not null and status <> 'cancelled';

create or replace function public.fn_qbin_return_receipt()
returns trigger language plpgsql as $function$
declare
  v_qty numeric; v_why text; v_dest text; v_name text; v_on boolean; v_was boolean;
begin
  if NEW.bin is distinct from 'yellow' then return null; end if;
  -- ตอนนี้ "ส่งคืน" ไหม · ก่อนหน้านี้ส่งคืนอยู่แล้วไหม
  v_on  := coalesce(NEW.is_active, true) and (NEW.qa_decision = 'good'
           or (NEW.qa_decision = 'repair' and NEW.repair_accepted_at is not null));
  v_was := TG_OP = 'UPDATE' and coalesce(OLD.is_active, true) and (OLD.qa_decision = 'good'
           or (OLD.qa_decision = 'repair' and OLD.repair_accepted_at is not null));

  if not v_on then
    if v_was then
      update public.stock_receipts set status = 'cancelled', cancelled_at = now(), cancelled_by = 'auto',
             cancel_reason = 'QA เปลี่ยนผลพิจารณาถังเหลือง — ไม่ส่งคืนแล้ว'
       where quality_bin_id = NEW.id and status = 'pending';
    end if;
    return null;
  end if;
  if v_was then return null; end if;   -- ส่งคืนไปแล้ว (แก้ช่องอื่น) ห้ามออกซ้ำ

  if NEW.qa_decision = 'good' then v_qty := NEW.qty; v_why := 'คืนจากถังเหลือง · QA ตัดสินงานดี';
  else v_qty := NEW.qty_ok; v_why := 'คืนจากถังเหลือง · ซ่อมผ่าน'; end if;
  if coalesce(v_qty, 0) <= 0 or NEW.mat_no is null then return null; end if;
  if exists (select 1 from public.stock_receipts where quality_bin_id = NEW.id and status <> 'cancelled') then return null; end if;

  select dest_line_name into v_dest from public.stock_inflow_rules
   where is_active
     and ((match_type = 'mat' and match_value = NEW.mat_no)
       or (match_type = 'prefix' and left(NEW.mat_no, length(match_value)) = match_value))
   order by case when match_type = 'mat' then 0 else 1 end, length(match_value) desc
   limit 1;
  if v_dest is null then return null; end if;   -- ไม่มีกฎ = ไม่ออกใบ (จอถังเหลืองเขียนเตือน)

  select name into v_name from public.dr_products where mat_no = NEW.mat_no and is_active limit 1;
  insert into public.stock_receipts
    (prod_order_id, prod_no, mat_no, part_name, qty_expected, dest_line_name, source_line, work_date, partial_reason, quality_bin_id)
  values (null, 'QA-' || left(NEW.id::text, 8), NEW.mat_no, coalesce(v_name, NEW.part_name), v_qty, v_dest, NEW.line_name,
          coalesce(NEW.work_date, public.work_date_bangkok()), v_why, NEW.id);
  return null;
end $function$;

drop trigger if exists trg_qbin_return_receipt on public.quality_bin_records;
create trigger trg_qbin_return_receipt after insert or update on public.quality_bin_records
  for each row execute function public.fn_qbin_return_receipt();

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (รันทั้งก้อนถ้าต้องถอย — คืนพฤติกรรม 09/11 เป๊ะ)
-- drop trigger if exists trg_qbin_return_receipt on public.quality_bin_records;
-- drop function if exists public.fn_qbin_return_receipt();
-- update public.stock_receipts set status='cancelled', cancelled_at=now(), cancelled_by='rollback',
--        cancel_reason='rollback 20261119c' where quality_bin_id is not null and status='pending';
-- create or replace function public.fn_take_raw(p_line text, p_mat text, p_part text, p_need numeric, p_wd date,
--   p_note text, p_order uuid, p_session uuid, p_prod_no text, p_source_line text)
-- returns numeric language plpgsql as $f$ declare v_taken numeric; begin
--   v_taken := public.fn_area_take(p_line, p_mat, p_part, p_need, p_wd, p_note, p_order, p_session);
--   perform public.fn_child_short(p_mat, p_part, coalesce(p_need,0) - v_taken, p_line, p_wd, p_prod_no, p_source_line);
--   return v_taken; end $f$;
-- (fn_take_op_output เดิม = เวอร์ชันใน 20261109b_op_stage_stock_trigger_dr.sql)
-- ═══════════════════════════════════════════════════════════════════════════════
