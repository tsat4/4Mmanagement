-- ══ 🧹 ลบของเสียที่เกิดจาก "การทดลองลงข้อมูล" — DR "Product DB" · eyhclzkifitbhbljgoav · 2026-11-18 ══
-- user 18/11: *"ที่แก้ ppm งานทดลองของ PD1 ไม่ได้หมายถึงชิ้นงานทดลอง แต่เป็นการทดลองลงข้อมูลของ
--              ณัฐวุฒิ ทรงดอน และทำให้ PPM เดือน 9 กระโดดแบบนี้ ให้ไปลบข้อมูลออกให้ที"*
--
-- 🔴 คนละเรื่องกับ `is_trial` (ชิ้นงานทดลอง/ลองแม่พิมพ์) ซึ่งเป็นของจริงที่ต้องเก็บไว้ —
--    แถวนี้คือ **ข้อมูลขยะจากการลองกรอก** ไม่ใช่ของเสียที่เกิดขึ้นจริงบนไลน์
--
-- หลักฐานที่ไล่ได้ (วัด 18/11):
--   PD1 ก.ย. 2026 · 23 กะที่ปิดแล้ว · ยอดดีรวม 25,728 ชิ้น
--   ของเสียทั้งเดือน = 5 ชิ้น จาก **แถวเดียว** และเป็นของ ณัฐวุฒิ ทรงดอน ทั้งหมด
--   ⇒ PPM = 5 ÷ 25,728 × 1e6 = 194.3  ← ตรงกับเลข 194 บนบอร์ด KPI เป๊ะ
--   ⇒ ลบแถวนี้แล้ว PD1 ก.ย. ไม่มีของเสียเลย ⇒ PPM = 0
--
-- แถวที่ลบ (เก็บค่าไว้ครบเพื่อให้ย้อนได้):
--   id              06898052-d754-49fb-bd7d-b5a5461cba64
--   session_id      6da92bc6-8aa2-4b37-8dfa-3dd3fcf8f3fa  (24/09/2026 กะเช้า · LINE B ( 600 Ton ))
--   prod_order_id   eed0304d-b6a9-4509-8179-a1701156a7f3
--   defect_type_id  e4d6e2fc-5479-41cc-abda-e69d73699b3c
--   qty_ng 5 · qty_suspect 0 · qty_repair 0 · is_trial false
--   description NULL · defect_img NULL   ← ของจริงคนกรอกคำอธิบายเกือบทุกแถว
--   reported_by_name 'ณัฐวุฒิ ทรงดอน' · reported_by_uid 2b0bca28-bfee-435c-9638-4ce77d0cae8c
--   logged_at 2026-09-24 19:13 (Asia/Bangkok)
--   quality_bin_records ที่อ้างถึงแถวนี้ = 0 แถว ⇒ ลบแล้วไม่มีอะไรกำพร้า
--
-- 🔴 ต้อง restamp `oee_q` ของกะนั้นด้วย — ตอนปิดกะ stamp ไว้ **99.64** ซึ่งคิดจาก 5 ชิ้นนี้
--    ((1370−5)/1370) · ลบของเสียแล้วไม่แก้ = กะค้างเลขเก่า %Q ต่ำกว่าจริงตลอดไป
--    (กฎเดียวกับ `restampSessionQByDefects()` — ของเสียเปลี่ยน Q ของกะต้องคิดใหม่)

delete from public.defect_logs where id = '06898052-d754-49fb-bd7d-b5a5461cba64';

update public.production_sessions s
   set oee_q = round(
         (s.actual_qty - coalesce((select sum(d.qty_ng) from public.defect_logs d where d.session_id = s.id), 0))
         * 100.0 / nullif(s.actual_qty, 0), 2)
 where s.id = '6da92bc6-8aa2-4b37-8dfa-3dd3fcf8f3fa'
   and s.actual_qty > 0;

-- ── ตรวจผล (DR "Product DB" · eyhclzkifitbhbljgoav) ──────────────────────────────────────
-- 1) แถวหายแล้ว (คาด 0):
--    select count(*) from defect_logs where id = '06898052-d754-49fb-bd7d-b5a5461cba64';
-- 2) กะนั้น Q กลับเป็น 100.00 (คาด actual_qty 1370 · oee_q 100.00):
--    select work_date, shift, line_name, actual_qty, oee_q
--      from production_sessions where id = '6da92bc6-8aa2-4b37-8dfa-3dd3fcf8f3fa';
-- 3) PD1 ก.ย. ไม่มีของเสียเหลือแล้ว (คาด good 25728 · ng 0 ⇒ PPM 0):
--    select coalesce(sum(s.actual_qty),0) as good,
--           coalesce((select sum(d.qty_ng) from defect_logs d
--                      join production_sessions s2 on s2.id = d.session_id
--                     where s2.work_date >= '2026-09-01' and s2.work_date < '2026-10-01'
--                       and s2.status = 'closed'
--                       and s2.line_name in ('Finishing - PD1','LINE A ( 800 Ton )','LINE B ( 600 Ton )',
--                                            'LINE C ( 200&250 Ton )','LINE D ( 110&300 Ton )')),0) as ng
--      from production_sessions s
--     where s.work_date >= '2026-09-01' and s.work_date < '2026-10-01' and s.status = 'closed'
--       and s.line_name in ('Finishing - PD1','LINE A ( 800 Ton )','LINE B ( 600 Ton )',
--                           'LINE C ( 200&250 Ton )','LINE D ( 110&300 Ton )');
--
-- ── rollback (ใส่แถวกลับ + คืน oee_q เดิม) ───────────────────────────────────────────────
-- insert into public.defect_logs
--   (id, session_id, prod_order_id, defect_type_id, qty_ng, qty_suspect, qty_repair,
--    description, reported_by_name, reported_by_uid, logged_at, is_trial)
-- values
--   ('06898052-d754-49fb-bd7d-b5a5461cba64', '6da92bc6-8aa2-4b37-8dfa-3dd3fcf8f3fa',
--    'eed0304d-b6a9-4509-8179-a1701156a7f3', 'e4d6e2fc-5479-41cc-abda-e69d73699b3c',
--    5, 0, 0, null, 'ณัฐวุฒิ ทรงดอน', '2b0bca28-bfee-435c-9638-4ce77d0cae8c',
--    '2026-09-24 12:13:00+00', false);
-- update public.production_sessions set oee_q = 99.64
--  where id = '6da92bc6-8aa2-4b37-8dfa-3dd3fcf8f3fa';
