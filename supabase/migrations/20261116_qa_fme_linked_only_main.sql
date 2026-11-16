-- MAIN (ewhdfqwfwofivojtsizn · "MAIN") · 2026-11-16 · คำสั่ง user "เฉพาะพาร์ทที่ตั้งจุดตรวจไว้แล้วก่อน"
-- qa_fme_config.linked_only = true ⇒ ตัวสแกน qa-fme-scan สร้างงานเรียก QA เฉพาะรุ่นที่ผูกพาร์ทในระบบตรวจได้
--   (ผูกไม่ได้ = QA กดเปิดใบตรวจจากคิวไม่ได้อยู่แล้ว) · ตัวที่ข้ามรายงานใน dry-run `skipped_unlinked`
-- ย้อนกลับ: alter table public.qa_fme_config drop column if exists linked_only;  (edge อ่านไม่เจอ = ถือว่า true)
alter table public.qa_fme_config add column if not exists linked_only boolean not null default true;
