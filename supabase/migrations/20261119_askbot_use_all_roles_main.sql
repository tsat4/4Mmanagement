-- 💬 แชทถามข้อมูล AskBot — เปิดสิทธิ์ askbot:use ให้ทุก role (2026-11-19 · คำสั่ง user "เปิดสิทธิ์ askbot ให้ทุก role")
-- Project: Main ("MAIN" · ewhdfqwfwofivojtsizn)
-- โค้ดคุมด้วย canSeeded('askbot','use') (src/App.jsx) — ยังไม่ seed = admin เท่านั้น · seed แล้ว = ตามตารางนี้
-- ปิดราย role ภายหลังได้ที่ /permissions (แถว "แชทถามข้อมูล" หมวดภาพรวม) ไม่ต้อง deploy
-- 📄 docs/modules/askbot.md §สิทธิ์
-- ย้อน: delete from role_permissions where permission_key = 'askbot:use';
--       delete from permission_catalog where resource = 'askbot' and action = 'use';

insert into permission_catalog (resource, action, label, group_name, sort)
values ('askbot', 'use', 'แชทถามข้อมูล (ปุ่ม 💬 มุมขวาล่าง · ทดลอง)', 'ภาพรวม', 140)
on conflict (resource, action) do update
  set label = excluded.label, group_name = excluded.group_name, sort = excluded.sort;

insert into role_permissions (role, permission_key, allowed)
select r, 'askbot:use', true
from unnest(enum_range(null::user_role)) r
on conflict (role, permission_key) do nothing;

-- ตรวจ: select role, allowed from role_permissions where permission_key = 'askbot:use' order by role;  -- ต้องได้ทุก role
--       select * from v_permission_catalog_sort_drift;   -- ต้องว่าง
