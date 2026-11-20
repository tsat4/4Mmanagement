-- MAIN ("MAIN" · ewhdfqwfwofivojtsizn) · 2026-11-18 · คำสั่ง user "ทำปิดงานค้างข้ามกะเป็นหมดเวลา"
-- สถานะใหม่ 'expired' = ข้ามกะแล้วยังไม่ได้ตรวจ (edge qa-fme-scan ตั้งให้) — แยกจาก 'cancelled' เพื่อย้อนดูได้ว่างานไหนไม่ได้ตรวจจริง
-- ขยาย CHECK อย่างเดียว (applied แล้ว) · rollback: update qa_fme_obligations set status='cancelled' where status='expired'; แล้วใส่ชุดเดิม 5 ค่า
alter table public.qa_fme_obligations drop constraint if exists qa_fme_obligations_status_check;
alter table public.qa_fme_obligations add constraint qa_fme_obligations_status_check
  check (status in ('pending','acked','done_ok','done_ng','cancelled','expired'));
