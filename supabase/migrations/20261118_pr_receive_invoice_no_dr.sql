-- ══ 🧾 รับของเข้า ต้องมีเลข Invoice  ·  2026-11-18 ══
-- Project: DR (ชื่อในจอ Supabase = "Product DB" · eyhclzkifitbhbljgoav)
-- หน้างานแจ้ง (PDF 18/11 ข้อ 2): *"ตอนรับของ ที่กดของเข้า ให้บังคับกรอก เลข Invoice"*
--
-- ── ทำไมต้องมีช่องนี้ ────────────────────────────────────────────────────────────
-- ทะเบียน PR เดิมจบที่ `received_at` + `received_qty` ⇒ ตอบไม่ได้ว่า "ของล็อตนี้มากับใบไหน"
-- เวลาบัญชีถามย้อนกลับ (ของเข้าแล้วแต่ยังไม่ตั้งเบิก / ตั้งเบิกซ้ำ) ต้องไปรื้อกระดาษ
--
-- ── 🔴 กฎที่ห้ามแตะ ──────────────────────────────────────────────────────────────
-- 🔴 **ดรอป 3 อาร์กเดิมทิ้ง แล้วสร้างตัวเดียวที่มี `p_invoice_no` default null**
--    ห้ามสร้างเป็น overload คู่กับของเดิม — เรียกแบบ named arg 3 ตัวจะ "function is not unique"
--    (42725) ⇒ แท็บที่เปิดค้างบนบันเดิลเก่ากดรับของไม่ได้ทั้งโรงงาน
--    มี default ⇒ บันเดิลเก่าที่ส่ง 3 อาร์กยังเรียกได้ปกติ (invoice = null) = ย้อนได้จริง
-- 🔴 **"บังคับ" อยู่ฝั่งจอ ไม่ใช่ฝั่ง DB** — ใส่ `raise` ที่นี่ = แท็บเก่าพังทันทีตอน deploy
--    (ฝั่งจอ: MtnPurchase.jsx ไม่ให้กดจนกว่าจะกรอก)
-- 🔴 **GRANT หาย**เมื่อ drop function — ต้อง grant ใหม่ให้ครบ (ฝั่ง DR วิ่งด้วย `anon` เสมอ)
--    ไม่ grant = PostgREST ตอบ 401/404 ⇒ ปุ่มรับของตายเงียบ
-- 🔴 ไม่ backfill ของเก่า — 4 ใบที่รับไปแล้วไม่มีเลขจริงให้ใส่ (เดา = ข้อมูลปลอมในสายบัญชี)
--
-- ย้อนกลับ (ปลอดภัย · ทำได้โดยไม่ต้องแตะโค้ด):
--   drop function if exists public.mtn_pr_receive(uuid, numeric, text, text);
--   แล้วรันนิยาม 3 อาร์กเดิมคืน (เก็บไว้ท้ายไฟล์นี้)  ·  คอลัมน์ invoice_no ทิ้งไว้ได้ (nullable)

alter table public.mtn_purchase_requests
  add column if not exists invoice_no text;

comment on column public.mtn_purchase_requests.invoice_no is
  'เลขใบกำกับ/Invoice ที่มากับของตอนรับเข้า (หน้างานแจ้ง 18/11) — เก็บตามที่คนกรอก ไม่มีรูปแบบบังคับ';

drop function if exists public.mtn_pr_receive(uuid, numeric, text);

create or replace function public.mtn_pr_receive(
  p_id uuid, p_qty numeric, p_by_name text default null, p_invoice_no text default null
)
returns numeric
language plpgsql
security definer
set search_path to 'public'
as $function$
declare r public.mtn_purchase_requests%rowtype; v_bal numeric; v_inv text;
begin
  if p_qty is null or p_qty <= 0 then raise exception 'จำนวนรับต้องมากกว่า 0'; end if;
  v_inv := nullif(btrim(coalesce(p_invoice_no, '')), '');
  select * into r from public.mtn_purchase_requests where id = p_id for update;
  if not found then raise exception 'ไม่พบใบขอซื้อ'; end if;
  if r.status not in ('requested', 'ordered') then
    raise exception 'ใบนี้อยู่สถานะ % — รับเข้าไม่ได้ (อาจมีคนกดรับไปแล้ว)', r.status;
  end if;
  update public.mtn_purchase_requests
     set status = 'received', received_at = now(), received_by = p_by_name,
         received_qty = p_qty,
         -- ส่งมาว่าง (บันเดิลเก่า) = คงค่าเดิม ห้ามล้างเลขที่เคยกรอกไว้
         invoice_no = coalesce(v_inv, invoice_no),
         updated_at = now()
   where id = p_id;
  if r.part_id is not null then
    v_bal := public.mtn_stock_move(
      r.part_id, 'in', p_qty,
      'รับเข้าจาก PR ' || coalesce(r.pr_no, '(ยังไม่มีเลข)')
        || coalesce(' · PO ' || r.po_no, '')
        || coalesce(' · Inv ' || v_inv, ''),
      p_by_name, r.order_id);
  end if;
  return v_bal;
end $function$;

grant execute on function public.mtn_pr_receive(uuid, numeric, text, text)
  to anon, authenticated, service_role;

-- ── นิยามเดิม 3 อาร์ก (เก็บไว้สำหรับ rollback เท่านั้น ห้ามรันคู่กับตัวใหม่) ────────────
-- create or replace function public.mtn_pr_receive(p_id uuid, p_qty numeric, p_by_name text default null)
-- returns numeric language plpgsql security definer set search_path to 'public' as $$
-- declare r public.mtn_purchase_requests%rowtype; v_bal numeric;
-- begin
--   if p_qty is null or p_qty <= 0 then raise exception 'จำนวนรับต้องมากกว่า 0'; end if;
--   select * into r from public.mtn_purchase_requests where id = p_id for update;
--   if not found then raise exception 'ไม่พบใบขอซื้อ'; end if;
--   if r.status not in ('requested','ordered') then
--     raise exception 'ใบนี้อยู่สถานะ % — รับเข้าไม่ได้ (อาจมีคนกดรับไปแล้ว)', r.status; end if;
--   update public.mtn_purchase_requests set status='received', received_at=now(), received_by=p_by_name,
--          received_qty=p_qty, updated_at=now() where id=p_id;
--   if r.part_id is not null then
--     v_bal := public.mtn_stock_move(r.part_id,'in',p_qty,
--       'รับเข้าจาก PR ' || coalesce(r.pr_no,'(ยังไม่มีเลข)') || coalesce(' · PO '||r.po_no,''), p_by_name, r.order_id);
--   end if;
--   return v_bal;
-- end $$;
