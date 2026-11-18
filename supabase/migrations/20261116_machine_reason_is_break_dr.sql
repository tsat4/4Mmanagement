-- 🍱 ติดป้าย "เหตุผลนี้ = เวลาพัก (ESM คิดจากนโยบายพักเอง)" ให้เหตุผลหยุดของต้นทาง (DR "Product DB" · eyhclzkifitbhbljgoav · 2026-11-16)
-- 📄 docs/modules/integration-hub.md §เวลาพัก · คำสั่ง user 16/11: "พักเบรคระบบเก่าต้องลงเอง แต่ ESM คิดให้เองเมื่อผ่านช่วงเวลา" → เลือกทาง A
-- กฎ: เวลาพัก = นโยบาย ESM (breakIntervalsIn) เท่านั้น · กดพักหน้าเครื่องนอกเวลานโยบาย = เสีย A ("พักไม่ตรงเวลานโยบาย")
-- additive · default false = พฤติกรรมเดิม · ย้อน: ท้ายไฟล์
alter table public.machine_reason_map add column if not exists is_break boolean not null default false;
comment on column public.machine_reason_map.is_break is 'true = เหตุผลนี้คือการกดพักหน้าเครื่อง — เวลาพักใช้นโยบาย ESM · ส่วนที่เกินนโยบาย = เสีย A';
-- ตรวจ: select reason_kind, reason_code, reason_text, is_break from machine_reason_map;
-- ย้อน: alter table public.machine_reason_map drop column if exists is_break;
