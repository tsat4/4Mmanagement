-- ═══ 🏬 แก้ยอดย้อนหลัง "ขา STORE" 3 คลาส (Product DB · DR) ════════════════════════
-- คำสั่ง user 25/11: *"แก้เลยทั้ง 3 คลาส เอาให้จบ เพราะยังไม่ได้คัทออฟกับทั้งโรงงานเรื่องสต็อก"*
--
-- 🔴 **ทั้ง 3 คลาสเป็นบั๊กที่ปิดไปแล้ว** — ไฟล์นี้แก้เฉพาะ "ข้อมูลเก่าที่ค้างอยู่"
--   ① ใบขอเติมไม่หัก STORE        ปิด 19/11 (คำสั่ง user "ตัดเต็มและติดลบ")
--   ② ของซื้อนำเข้าครั้งแรกลงชื่อไลน์  ปิด 01/10 (ตัวนำเข้ารอบหลังลง STORE หมด)
--   ③ ปิดล็อต child ลงชื่อไลน์ผลิต   ปิด 26/10 (`inflowDestOf` + fail-closed)
--
-- 🔴 **ห้ามแก้แถวเดิม** — ledger เป็นบันทึก ⇒ เขียนแถว `adjust` ใหม่ที่อธิบายตัวเองได้
--    (`line_stock_summary`: issue/adjust = +qty · consume/return = −qty · นับเฉพาะ status='approved')
--
-- สำรองก่อนแก้: archive.line_stock_summary_bak_20261125 (ยอดคงเหลือทุกคู่ ก่อนแก้)
-- ย้อนกลับ: ลบแถวที่ created_by in ('system:store-leg-fix','system:store-dest-fix')
--
-- ผลที่วัดได้หลังรัน (25/11):
--   ① 174 ใบ · หัก STORE คืน 116,877.8 ชิ้น (= ยอดที่ขาดเป๊ะ) · เหลือ 0 ใบ
--   ②+③ 27 คู่ (ไลน์,mat) · 54 แถวจับคู่ · สุทธิ 0 · เหลือ 0 คู่
--   STORE 4,632,242 → 6,030,341 (+1,398,099)
--
-- ⚠️ **ผลข้างเคียงที่ตั้งใจ**: ยอดที่ไลน์ติดลบหนักขึ้น (Assy GOR −756,283 · Line 61 −355,753 ฯลฯ)
--    = ไลน์กินของที่ระบบไม่เคยบันทึกว่าจ่ายเข้าไลน์ (ลูปใบขอเติมเพิ่งเริ่มใช้ทีหลัง)
--    **ติดลบที่ซื่อสัตย์ ดีกว่ายอดบวกที่ผิด** · เคลียร์ด้วยการนับของจริงตั้งต้น (ขั้น ② ของแผน min/max)
-- ═══════════════════════════════════════════════════════════════════════════════════

create schema if not exists archive;

create table if not exists archive.line_stock_summary_bak_20261125 as
  select line_name, mat_no, qty_on_hand, now() as backed_up_at from public.line_stock_summary;

-- ① ใบขอเติมที่มีแต่ขาเข้าไลน์ ไม่เคยหัก STORE
with tx as (
  select type, line_name, mat_no, part_name, qty, work_date,
         substring(note from 'ใบ ([0-9a-f]{8})\)') as slip
    from public.line_stock_transactions
   where note ~ 'ใบ [0-9a-f]{8}\)' and status = 'approved'),
s as (select slip from tx where slip is not null group by slip having not bool_or(type = 'consume'))
insert into public.line_stock_transactions
  (line_name, mat_no, part_name, qty, type, status, work_date, note, created_by)
select 'STORE', t.mat_no, t.part_name, -t.qty, 'adjust', 'approved', t.work_date,
       'แก้ย้อนหลัง 25/11: ใบขอเติม ' || t.slip || ' → ' || t.line_name ||
       ' ไม่ได้หัก STORE (บั๊กก่อน 19/11 · STORE ไม่มีแถวสรุป = ข้ามขาออก)',
       'system:store-leg-fix'
  from tx t join s on s.slip = t.slip
 where t.type = 'issue';

-- ②+③ ของที่ note บอก "เข้าสโตร์" แต่ลงชื่อไลน์ — ย้ายเป็นคู่ (ไลน์ −x · STORE +x)
--     หักส่วนที่รอบ `system:lot-dest-fix` (26/10) ย้ายไปแล้ว ห้ามย้ายซ้ำ
with bad as (
  select mat_no, line_name, max(part_name) part_name, sum(qty) misplaced, max(work_date) wd
    from public.line_stock_transactions
   where type = 'issue' and status = 'approved'
     and note ~* 'เข้า\s*(สโตร์|STORE)' and line_name <> 'STORE'
   group by 1, 2),
fixed as (
  select mat_no, line_name, -sum(qty) as moved
    from public.line_stock_transactions
   where created_by = 'system:lot-dest-fix' and type = 'adjust' and qty < 0
   group by 1, 2),
todo as (
  select b.*, b.misplaced - coalesce(f.moved, 0) as still
    from bad b left join fixed f on f.mat_no = b.mat_no and f.line_name = b.line_name
   where b.misplaced - coalesce(f.moved, 0) > 0)
insert into public.line_stock_transactions
  (line_name, mat_no, part_name, qty, type, status, work_date, note, created_by)
select line_name, mat_no, part_name, -still, 'adjust', 'approved', wd,
       'แก้ย้อนหลัง 25/11: ของนี้ note บอก "เข้าสโตร์" แต่ลงชื่อไลน์ — ย้ายยอดไป STORE',
       'system:store-dest-fix'
  from todo
union all
select 'STORE', mat_no, part_name, still, 'adjust', 'approved', wd,
       'แก้ย้อนหลัง 25/11: รับยอดที่ย้ายมาจากไลน์ ' || line_name || ' (ปลายทางเดิมลงชื่อไลน์ผลิต)',
       'system:store-dest-fix'
  from todo;
