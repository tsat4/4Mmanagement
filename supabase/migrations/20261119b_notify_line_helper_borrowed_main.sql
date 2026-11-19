-- ════════════════════════════════════════════════════════════════════════════
-- 🔔 แจ้งหัวหน้าไลน์ต้นสังกัด เมื่อคนของเขาถูกยืมไปช่วยไลน์อื่น (19/11 · คำสั่ง user)
-- Project: Main ("MAIN" · ewhdfqwfwofivojtsizn)
--
-- *"คนยืมข้ามไลน์ให้หัวหน้าไลน์ที่ยืมบันทึกได้ แต่หัวหน้าหลักของพนักงานจะต้องรู้ด้วย"*
-- ตัวยิง = /checkin (`notifyBorrowed` ใน src/pages/Checkin.jsx) ส่ง line_name = **ไลน์ต้นสังกัด**
-- ผู้รับ = หัวหน้าไลน์ (leader) ของไลน์นั้น+ครอบครัวไลน์ · เจาะส่วนงาน + ไลน์ (ห้าม fan-out ทั้งโรงงาน
--   — docs/modules/notify-inapp-audit.md §4) · ปรับผู้รับได้ที่ /notification-config
-- ไม่แตะ RLS/ตาราง · ย้อนได้: delete from public.notification_rules where event_key = 'line_helper_borrowed';
-- ════════════════════════════════════════════════════════════════════════════
insert into public.notification_rules
  (event_key, label, category, is_enabled, sort_order, channel_ids, inapp_roles, inapp_sections, inapp_depts,
   inapp_match_section, inapp_match_line, inapp_scope_strict, inapp_cast, link)
values ('line_helper_borrowed', 'พนักงานของไลน์ถูกยืมไปช่วยไลน์อื่น (แจ้งหัวหน้าไลน์ต้นสังกัด)', 'manpower', true, 60,
        '{}', array['leader'], '{}', '{}', true, true, true, 'always', '/checkin')
on conflict (event_key) do nothing;

-- คิวรีตรวจผล:
-- select event_key, inapp_roles, inapp_match_line from notification_rules where event_key = 'line_helper_borrowed';
-- select count(*) from public.notify_recipients('line_helper_borrowed', '<ส่วนงาน>', null, '<ชื่อไลน์>');
