-- ═══ 📅 ใบที่ถูกยกข้ามกะ: จำ "เปิดครั้งแรกเมื่อไหร่" + "ผ่านมากี่กะ"  (DR · 2026-11-17) ═══
-- ที่มา (หัวหน้าแจ้ง): *"แท็กนี้เปิดวันที่เท่าไร และปิดวันที่เท่าไร … ตอนนี้เหมือนบางอันมันค้างนานแล้ว
--   จะได้เคลียร์ก่อน"*
-- ปัญหา: ตอนรับยกยอด `importCarryOrders()` สร้าง **แถวใหม่** ที่ `opened_at` = เวลาเปิดกะใหม่
--   ⇒ การ์ดบนจอเขียน "เปิด 08:00" ทุกกะ **ดูไม่ออกเลยว่าใบนี้วนมากี่วันแล้ว**
--   ไล่ย้อนเองไม่ได้ด้วย เพราะ PROD.NO เป็นการ์ดคัมบังที่ **ใช้ซ้ำ** (0124060820 ใช้มา 57 ครั้งตั้งแต่ ก.ค.)
--   ⇒ ต้องเดินตามโซ่ `carry_over_from_session_id` เท่านั้น ห้ามหา min(opened_at) ของ prod_no
--
-- ⚠️ backward-compatible: คอลัมน์ใหม่ nullable / มี default · โค้ดเดิมไม่อ่านไม่เขียน 2 ช่องนี้
--    rollback = `alter table public.prod_orders drop column first_opened_at, drop column carry_hops;`
-- 🔴 กับดักที่เจอตอน backfill: มีแถวเก่า **ชี้ตัวเอง** (`carry_over_from_session_id = session_id`
--    18 แถว · บั๊กเก่าที่โค้ดปัจจุบันกันไว้แล้ว) ⇒ เดินโซ่วนไม่จบ ต้องตัดทิ้ง + กันวนด้วย path array
-- ═══════════════════════════════════════════════════════════════════════════════════════

alter table public.prod_orders
  add column if not exists first_opened_at timestamptz,
  add column if not exists carry_hops smallint not null default 0;

comment on column public.prod_orders.first_opened_at is
  'เวลาที่งานก้อนนี้ถูกเปิดครั้งแรก ก่อนถูกยกข้ามกะมาเรื่อยๆ · null = ใบนี้เปิดใหม่เอง (ใช้ opened_at)';
comment on column public.prod_orders.carry_hops is
  'ถูกยกข้ามกะมาแล้วกี่ครั้ง · 0 = เปิดใหม่ในกะนี้ · ตั้งโดย importCarryOrders() (src/lib/carryDebtOps.js)';

-- ── backfill: เดินโซ่ย้อนกลับทาง carry_over_from_session_id ───────────────────────────
-- (session_id, prod_no) ไม่ซ้ำกันเลยในฐาน (ตรวจแล้ว 17/11) ⇒ แต่ละก้าวมีพ่อได้ไม่เกิน 1 แถว
with recursive chain as (
  select o.id as root_id, o.prod_no, o.opened_at, o.carry_over_from_session_id, 0 as hops,
         array[o.session_id] as seen
  from public.prod_orders o
  where o.carry_over_from_session_id is not null
    and o.carry_over_from_session_id <> o.session_id     -- แถวชี้ตัวเอง = ข้อมูลเสีย ไม่มีต้นทาง
  union all
  select c.root_id, p.prod_no, p.opened_at, p.carry_over_from_session_id, c.hops + 1,
         c.seen || p.session_id
  from chain c
  join public.prod_orders p
    on p.prod_no = c.prod_no
   and p.session_id = c.carry_over_from_session_id
  where c.hops < 400
    and not (p.session_id = any(c.seen))                 -- กันวนซ้ำกะเดิม
), origin as (
  select distinct on (root_id) root_id, opened_at as first_opened_at, hops
  from chain
  order by root_id, hops desc
)
update public.prod_orders o
   set first_opened_at = origin.first_opened_at,
       carry_hops      = origin.hops
  from origin
 where origin.root_id = o.id
   and (o.first_opened_at is distinct from origin.first_opened_at or o.carry_hops <> origin.hops);

update public.prod_orders
   set first_opened_at = null, carry_hops = 0
 where carry_over_from_session_id = session_id
   and (first_opened_at is not null or carry_hops <> 0);

-- ── ตรวจผล (คาดหวัง 17/11: filled 3,014 · max_hops 11 · selfref 18) ──────────────────
-- select count(*) filter (where first_opened_at is not null) as filled,
--        max(carry_hops) as max_hops,
--        (select count(*) from prod_orders where carry_over_from_session_id = session_id) as selfref
-- from prod_orders;
