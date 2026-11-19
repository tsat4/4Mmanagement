-- 2026-11-19 · Main (ewhdfqwfwofivojtsizn) · คำสั่ง user:
--   "ให้ QA setup frequency กับ sampling rate ของแต่ละ product — ตัวไหนรอบเวลา ตัวไหนตามจำนวนที่คอนเฟิม
--    และจำนวนที่จะตรวจต่อรอบ"
-- ขยายตารางเดิม qa_fme_part_rules (ไม่สร้างตารางใหม่) · backward-compatible: คอลัมน์ใหม่ทั้งหมด nullable
--   mid_mode     null = ใช้ค่ากลาง (qa_fme_config.mid_mode) · 'lot' ตามยอดผลิต · 'min' ตามเวลา · 'off' ไม่ตรวจ Middle
--   mid_every_min  คาบเวลา (นาที) เมื่อ mid_mode='min' — ซ้ำทุก N นาทีที่รุ่นยังวิ่ง
--   sample_n     จำนวนชิ้นขั้นต่ำต่อรอบตรวจ (ทุกสเตจ) · null = 1 (พฤติกรรมเดิม: ชิ้นแรกผ่าน = ยอมรับ)
-- แถวเดิม is_active=false (ปิด Middle) ยังมีความหมายเดิม — ตัวสแกนอ่าน mid_mode ก่อน แล้วถอยไป is_active
alter table qa_fme_part_rules add column if not exists mid_mode text;
alter table qa_fme_part_rules add column if not exists mid_every_min int;
alter table qa_fme_part_rules add column if not exists sample_n int;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'qa_fme_part_rules_mid_mode_chk') then
    alter table qa_fme_part_rules add constraint qa_fme_part_rules_mid_mode_chk
      check (mid_mode is null or mid_mode in ('lot', 'min', 'off'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'qa_fme_part_rules_every_min_chk') then
    alter table qa_fme_part_rules add constraint qa_fme_part_rules_every_min_chk
      check (mid_every_min is null or mid_every_min between 5 and 1440);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'qa_fme_part_rules_sample_n_chk') then
    alter table qa_fme_part_rules add constraint qa_fme_part_rules_sample_n_chk
      check (sample_n is null or sample_n between 1 and 50);
  end if;
end $$;
comment on column qa_fme_part_rules.mid_mode is 'null=ค่ากลาง · lot=ตามยอดผลิตที่คอนเฟิม · min=ตามเวลา · off=ไม่ตรวจ Middle';
comment on column qa_fme_part_rules.mid_every_min is 'คาบเวลา Middle (นาที) เมื่อ mid_mode=min';
comment on column qa_fme_part_rules.sample_n is 'จำนวนชิ้นขั้นต่ำต่อรอบตรวจ (ทุกสเตจ) · null=1';
-- GRANT ตาราง (เดิมมี policy select/all ของ authenticated แล้ว) — ย้ำให้ครบ
grant select, insert, update, delete on qa_fme_part_rules to authenticated;
