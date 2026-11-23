-- ════════════════════════════════════════════════════════════════════════════
-- Poka-Yoke: ลบอุปกรณ์ต้องไม่ลากผลทดสอบย้อนหลังหายไปด้วย (19/11 · ออดิท check sheet ข้อ 3)
-- Project: Main ("MAIN" · ewhdfqwfwofivojtsizn)
--
-- เดิม pokayoke_checks.device_id → pokayoke_devices(id) ON DELETE CASCADE
--   ⇒ ลบอุปกรณ์ 1 ตัว = ผลทดสอบ error-proofing ย้อนหลังทั้งหมดของมันหายถาวร
-- ใหม่ = ON DELETE RESTRICT ⇒ อุปกรณ์ที่มีประวัติลบไม่ได้ ต้อง "ปิดใช้งาน" (is_active=false) แทน
--   จอ /daily-checker?tab=pokayoke นับประวัติก่อนแล้วเสนอปิดใช้งานเอง — FK นี้คือตาข่ายชั้นสุดท้าย
-- ไม่แตะข้อมูล · ไม่แตะ RLS · ย้อนได้ (ดู ROLLBACK ท้ายไฟล์)
-- ════════════════════════════════════════════════════════════════════════════
alter table public.pokayoke_checks drop constraint if exists pokayoke_checks_device_id_fkey;
alter table public.pokayoke_checks
  add constraint pokayoke_checks_device_id_fkey
  foreign key (device_id) references public.pokayoke_devices(id) on delete restrict;

-- ROLLBACK (Main):
-- alter table public.pokayoke_checks drop constraint if exists pokayoke_checks_device_id_fkey;
-- alter table public.pokayoke_checks add constraint pokayoke_checks_device_id_fkey
--   foreign key (device_id) references public.pokayoke_devices(id) on delete cascade;
