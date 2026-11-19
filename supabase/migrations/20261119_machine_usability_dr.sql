-- ══ 🔌 สถานะใช้งานของเครื่อง (ปุ่มเปิด-ปิดเครื่อง) ·  2026-11-19 ══
-- Project: DR (ชื่อในจอ Supabase = "Product DB" · eyhclzkifitbhbljgoav)
--
-- คำสั่ง user (18/11): *"ใบแจ้งซ่อมที่แจ้งซ่อมเครื่องที่เป็น supply บางทีเค้าซ่อมไม่ได้
--   แต่แก้ไขเบื้องต้นให้ใช้ได้ระหว่างรอของมาเปลี่ยน · อยากมีปุ่มเปิดปิดเครื่อง
--   เพื่อทำให้สถานะตรงกับหน้างาน"*  → เคาะ 19/11: **เอา 3 สถานะ**
--
-- ── ที่มา (วัดจริง 19/11) ───────────────────────────────────────────────────────
-- ผังโรงงานตัดสิน "ไลน์เสี่ยง" จาก *"เครื่อง supply นี้มีใบ MO เปิดอยู่ไหม"* อย่างเดียว
-- ⇒ **"ใบยังเปิด" = "เครื่องใช้ไม่ได้"** ซึ่งไม่จริง · ของจริงวันนี้:
--   CT-03 (จ่าย 13 ไลน์) ซ่อมเสร็จ 13/11 08:44 · AB-01 13/11 11:38 · AB-02 13/11 11:42
--   — ทั้ง 3 ใบยังเปิดอยู่ (รออะไหล่/รอเซ็น) ⇒ ผังทาไลน์ปลายทางเป็น "เสี่ยง" มา **7 วัน**
--   ทั้งที่เครื่องเดินปกติ · AB-03 ยังไม่ซ่อมเสร็จจริง (อันนี้ควรแดง)
--
-- ── 🔴 กฎ ────────────────────────────────────────────────────────────────────────
-- 🔴 **สถานะเครื่อง ≠ สถานะใบซ่อม** — ใบ MO เดินลูปเอกสารของมันไป เครื่องเดินของมันไป
--    ห้ามเอาการมีใบเปิดมาแปลว่าเครื่องหยุด (นั่นคือบั๊กที่กำลังแก้)
-- 🔴 **`null` = ยังไม่มีใครประกาศ ไม่ใช่ "ใช้ได้"** — ตัวตัดสินจะถอยไปเดาจากใบซ่อมแทน
--    (`src/utils/machineUsability.js` ที่เดียว) ⇒ ห้ามใส่ default 'ok' ที่คอลัมน์นี้
-- 🔴 **เหลือง/แดง ต้องมีเหตุผล** — บังคับฝั่งจอ + CHECK ฝั่งนี้ (ปุ่มที่กดปิดไฟเตือนได้เปล่าๆ
--    = สวิตช์โกหก) · 'ok' ไม่ต้องมีเหตุผล
-- 🔴 ชุดค่าอยู่ใน CHECK — เพิ่มสถานะใหม่ต้องแก้ทั้ง CHECK และ `MACHINE_USABILITY` ฝั่งจอ
--
-- ย้อนกลับ:
--   alter table public.machines
--     drop column if exists usability, drop column if exists usability_note,
--     drop column if exists usability_at, drop column if exists usability_by;

alter table public.machines
  add column if not exists usability      text,
  add column if not exists usability_note text,
  add column if not exists usability_at   timestamptz,
  add column if not exists usability_by   text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'machines_usability_chk') then
    alter table public.machines add constraint machines_usability_chk
      check (usability is null or usability in ('ok', 'temp', 'down'));
  end if;
  -- เหลือง/แดง ต้องมีเหตุผลเสมอ (ปุ่มที่กดดับไฟเตือนเฉยๆ ไม่มีประโยชน์กับใคร)
  if not exists (select 1 from pg_constraint where conname = 'machines_usability_note_chk') then
    alter table public.machines add constraint machines_usability_note_chk
      check (usability not in ('temp', 'down') or nullif(btrim(coalesce(usability_note, '')), '') is not null);
  end if;
end $$;

comment on column public.machines.usability is
  'สถานะใช้งานที่ช่างประกาศ: ok=ใช้ได้ · temp=ใช้ได้ชั่วคราว (แก้เบื้องต้น รอของมาเปลี่ยน) · down=ใช้ไม่ได้ · null=ยังไม่มีใครประกาศ (ห้ามตีเป็น ok)';
comment on column public.machines.usability_note is
  'เหตุผล — บังคับเมื่อ temp/down (แก้อะไรไป / รออะไรอยู่)';
