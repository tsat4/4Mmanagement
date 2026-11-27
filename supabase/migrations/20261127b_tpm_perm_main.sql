-- 🛠️ TPM เฟส 1 — สิทธิ์หน้า /tpm + 2 คีย์การกระทำ
-- Project: Main ("MAIN" · ewhdfqwfwofivojtsizn) · 2026-11-27 · 📄 docs/modules/tpm.md
--
-- ค่าเริ่มต้น "คัดลอกจากสิทธิ์เดิมที่ใกล้ที่สุด" — ไม่เดา role เอง (ปรับต่อได้ที่ /permissions ไม่ต้อง deploy):
--   page:/tpm   ← คนที่เข้า /mtn-repair ได้        (เห็นแท็ก/เกรดเครื่อง = เห็นงานซ่อมอยู่แล้ว)
--   tpm:ftag    ← คนที่แจ้งซ่อม mtn_repair:report ได้ (ติดแท็ก ≈ แจ้งความผิดปกติ · แปลงเป็น MO ต้องมี report ด้วย)
--   tpm:assess  ← คนที่ตั้งค่า PM pm:setup ได้        (ให้คะแนนเกรดเครื่อง + แก้เกณฑ์ = งานวางระบบซ่อมบำรุง)
-- ย้อน:
--   delete from role_permissions where permission_key in ('page:/tpm','tpm:ftag','tpm:assess');
--   delete from permission_catalog where (resource, action) in (('tpm','ftag'),('tpm','assess'));

insert into public.permission_catalog (resource, action, label, group_name, sort) values
  ('tpm', 'ftag',   'TPM: ติด / ปิด / ยกเลิก F-Tag (แท็กแดงแปลงเป็นใบซ่อม MO ต้องมีสิทธิ์แจ้งซ่อมด้วย)', 'การตรวจสอบและซ่อมบำรุง', 639),
  ('tpm', 'assess', 'TPM: ให้คะแนนระดับความสำคัญเครื่อง (A/B/C) + แก้เกณฑ์การให้คะแนน',              'การตรวจสอบและซ่อมบำรุง', 640)
on conflict (resource, action) do update
  set label = excluded.label, group_name = excluded.group_name, sort = excluded.sort;

insert into public.role_permissions (role, permission_key, allowed)
select role, 'page:/tpm', true from public.role_permissions
 where permission_key = 'page:/mtn-repair' and allowed
on conflict (role, permission_key) do nothing;

insert into public.role_permissions (role, permission_key, allowed)
select role, 'tpm:ftag', true from public.role_permissions
 where permission_key = 'mtn_repair:report' and allowed
on conflict (role, permission_key) do nothing;

insert into public.role_permissions (role, permission_key, allowed)
select role, 'tpm:assess', true from public.role_permissions
 where permission_key = 'pm:setup' and allowed
on conflict (role, permission_key) do nothing;

-- ตรวจ:
--   select permission_key, string_agg(role::text, ',' order by role) from role_permissions
--    where permission_key in ('page:/tpm','tpm:ftag','tpm:assess') and allowed group by 1;
--   select * from permission_catalog where resource = 'tpm';
