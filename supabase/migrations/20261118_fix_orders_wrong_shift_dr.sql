-- ═══ 🔁 ไล่แก้ใบผลิตที่ลงกะเก่าที่ลืมปิด (DR · 2026-11-18 · คำสั่ง user "ไล่แก้ 164 ใบ") ═══
-- ที่มา: หัวหน้าแจ้ง "กะ01 ลืมปิดกะ แล้วกะ02 ยิงปิดแท็ก ยอดไปขึ้นกะ01" — ด่านกันของใหม่อยู่ที่
--   `src/utils/sessionHandover.js` (commit 5f827a42) · ไฟล์นี้คือการแก้ **ข้อมูลเก่า**
--
-- ขอบเขต: ใบ `confirmed` ที่ถูก **เปิด** หลังจากไลน์เดียวกันขึ้นกะใหม่ไปแล้ว (ตั้งแต่ 01/10/2026)
--   รวม 164 ใบ · 21,647 ชิ้น ⇒ ย้ายได้ 126 ใบ (15,747 ชิ้น) · ข้าม 38 ใบ (5,900 ชิ้น)
--
-- 🔴 ที่ข้าม 38 ใบ: กะปลายทาง **มีใบเลขเดียวกันที่ผลิตจริงไปแล้ว** (`confirmed` 36 ใบ) หรือใบนั้น
--    ถูกยกต่อไปกะหลังแล้ว (`imported` 2 ใบ) ⇒ ย้ายเข้าไปไม่ได้ (unique (session_id, prod_no))
--    และ "ซ้ำ" แปลว่าอาจเป็นการสแกนซ้ำ/คนละรอบ — **ต้องให้คนตัดสิน ห้ามเดา**
-- 🔴 ใบ placeholder 38 ใบในกะปลายทาง (`carry_over` · qty_ok ว่าง = ไม่เคยผลิต) ถูกลบ เพราะงานจริง
--    คือใบที่ย้ายเข้าไปแทน (เก็บสำเนาไว้ที่ archive.wrongshift_placeholders_20261118)
-- 🔴 trigger ทั้ง 2 ตัวที่แตะสต๊อก (fn_explode_child_demand / fn_post_confirmed_output) **ไม่ทำงาน**
--    กับ update นี้ — ทั้งคู่ `return null` เมื่อ OLD.status = NEW.status = 'confirmed' (ตรวจแล้ว)
-- 🔴 `line_stock_transactions` / `stock_receipts` ไม่แตะ — เป็นบัญชีสต๊อกตามเวลาจริง ไม่ใช่ input ของ OEE
-- 🔴 `defect_logs` ที่ผูกกับใบที่ย้าย = 0 แถว (ตรวจแล้ว) จึงไม่ต้องย้ายตาม
--
-- ⚠️ หลังรันต้อง **ไล่คำนวณ OEE ของ 31 กะที่กระทบใหม่** (actual_qty/%P/%Q) ด้วยสูตรจริง
--    `computeSessionOee` — ดู scripts/restamp-moved-orders.mjs · ค่าเดิม snapshot ไว้ที่
--    archive.wrongshift_sessions_20261118
--
-- ── rollback ─────────────────────────────────────────────────────────────────────────
--   update prod_orders o set session_id = p.old_sid
--     from archive.wrongshift_plan_20261118 p where p.order_id = o.id and p.movable;
--   insert into prod_orders select * from archive.wrongshift_placeholders_20261118;
--   update production_sessions ps set actual_qty = a.actual_qty, oee = a.oee, oee_a = a.oee_a,
--          oee_p = a.oee_p, oee_q = a.oee_q
--     from archive.wrongshift_sessions_20261118 a where a.id = ps.id;
-- ═══════════════════════════════════════════════════════════════════════════════════════

create schema if not exists archive;

create table archive.wrongshift_plan_20261118 as
with s as (
  select id, line_name, ((work_date::text||' '||coalesce(start_time,'08:00'))::timestamp) as start_ts
  from production_sessions where status <> 'void'),
nxt as (select a.id as old_id, min(b.start_ts) as next_start from s a
        join s b on b.line_name=a.line_name and b.start_ts>a.start_ts
        where a.start_ts >= '2026-10-01' group by 1),
bad as (select o.id, o.prod_no, o.qty_ok, o.session_id as old_sid,
               (o.opened_at at time zone 'Asia/Bangkok') as opened_local, s.line_name
        from prod_orders o join nxt on nxt.old_id=o.session_id join s on s.id=o.session_id
        where o.status='confirmed' and o.opened_at is not null
          and (o.opened_at at time zone 'Asia/Bangkok') > nxt.next_start),
tgt as (select b.*, (select t.id from s t where t.line_name=b.line_name and t.start_ts<=b.opened_local
                     order by t.start_ts desc limit 1) as new_sid from bad b)
select t.id as order_id, t.prod_no, t.qty_ok, t.line_name, t.opened_local,
       t.old_sid, t.new_sid, p2.id as block_id, p2.status as block_status,
       (p2.id is null or p2.status = 'carry_over') as movable
from tgt t
left join prod_orders p2 on p2.session_id = t.new_sid and p2.prod_no = t.prod_no;

create table archive.wrongshift_orders_20261118 as
  select o.* from prod_orders o
   where o.id in (select order_id from archive.wrongshift_plan_20261118 where movable);

create table archive.wrongshift_placeholders_20261118 as
  select o.* from prod_orders o
   where o.id in (select block_id from archive.wrongshift_plan_20261118
                   where movable and block_id is not null);

create table archive.wrongshift_sessions_20261118 as
  select ps.id, ps.line_name, ps.work_date, ps.shift, ps.status,
         ps.actual_qty, ps.oee, ps.oee_a, ps.oee_p, ps.oee_q, now() as snapped_at
    from production_sessions ps
   where ps.id in (select old_sid from archive.wrongshift_plan_20261118 where movable)
      or ps.id in (select new_sid from archive.wrongshift_plan_20261118 where movable);

delete from prod_orders
 where id in (select block_id from archive.wrongshift_plan_20261118
               where movable and block_id is not null);

update prod_orders o
   set session_id = p.new_sid
  from archive.wrongshift_plan_20261118 p
 where p.order_id = o.id and p.movable and o.session_id = p.old_sid;

-- ตรวจผล (ที่ได้จริง 18/11: plan 164 · movable 126 · placeholders 38 · sessions 31 · moved 126)
-- select (select count(*) from archive.wrongshift_plan_20261118) plan_rows,
--        (select count(*) from archive.wrongshift_plan_20261118 where movable) movable,
--        (select count(*) from archive.wrongshift_placeholders_20261118) placeholders,
--        (select count(*) from archive.wrongshift_sessions_20261118) sessions;
