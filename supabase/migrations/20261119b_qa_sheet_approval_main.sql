-- MAIN (ewhdfqwfwofivojtsizn · ชื่อในจอ Supabase "MAIN") · 2026-11-19 · คำสั่ง user
-- "ใบตรวจ QA ต้องมีขั้นอนุมัติ — หัวหน้า QA 1 ขั้น · ไม่บล็อกงานอื่น" (audit มาตรฐานระบบตรวจ QA/PM/AM)
-- 📄 docs/modules/qa-inspection.md §✍️ ขั้นอนุมัติใบตรวจ
--
-- ใบที่ปิดแล้ว (status='done') → approval_status='pending' (แอปเขียนตอนปิดใบ) → หัวหน้า QA อนุมัติ/ตีกลับ
-- · ใบเก่าก่อนมีขั้นนี้ = null = "ไม่อยู่ในสายอนุมัติ" (ห้าม backfill เป็น pending — คิวจะท่วมด้วยใบย้อนหลัง)
-- · ไม่บล็อกอะไร — ใบปิด/ผลิตเดินต่อเหมือนเดิม (user เลือก 19/11)
-- · RLS/GRANT: ใช้ policy update เดิมของตาราง (has_perm('qa:record')) — ผู้อนุมัติ (qa:manage = manager/admin/qa)
--   ถือ qa:record อยู่แล้วทุก role · ด่านระดับตำแหน่ง/ห้ามใบตัวเองอยู่ฝั่งแอป `utils/qaApproval.js` (แบบเดียวกับใบ PM)
-- · audit: trg_audit เดิมของตาราง (20261020_qa_inspection_audit_main.sql) เก็บทุกการเปลี่ยนแล้ว
-- backward-compatible: คอลัมน์ว่างได้ทั้งหมด ไม่มี default ⇒ โค้ดเก่ายังทำงานเหมือนเดิม
-- ↩️ rollback (ย้อนโค้ดก่อน แล้วค่อยรัน):
--   alter table public.qa_inspection_sheets drop constraint if exists qa_inspection_sheets_approval_status_check,
--     drop column if exists approval_status, drop column if exists approved_by_uid,
--     drop column if exists approved_by_name, drop column if exists approved_at, drop column if exists reject_reason;

alter table public.qa_inspection_sheets
  add column if not exists approval_status  text,
  add column if not exists approved_by_uid  uuid,
  add column if not exists approved_by_name text,
  add column if not exists approved_at      timestamptz,
  add column if not exists reject_reason    text;

alter table public.qa_inspection_sheets drop constraint if exists qa_inspection_sheets_approval_status_check;
alter table public.qa_inspection_sheets add constraint qa_inspection_sheets_approval_status_check
  check (approval_status is null or approval_status in ('pending','approved','rejected'));

create index if not exists idx_qa_sheets_approval_pending
  on public.qa_inspection_sheets (work_date desc) where approval_status = 'pending';

comment on column public.qa_inspection_sheets.approval_status is
  'สายอนุมัติใบตรวจ (19/11): null = ใบก่อนมีขั้นอนุมัติ · pending = ปิดใบแล้วรอหัวหน้า QA · approved · rejected (+reject_reason)';

-- ตรวจผล:
-- select column_name, data_type from information_schema.columns
--  where table_schema='public' and table_name='qa_inspection_sheets'
--    and column_name in ('approval_status','approved_by_uid','approved_by_name','approved_at','reject_reason');
