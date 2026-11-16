-- DR project ("Product DB" · eyhclzkifitbhbljgoav) · 2026-11-16 · คำสั่ง user "แก้บั๊กปุ่มสร้างบอร์ด FG"
-- 🐞 ปุ่ม "📦 สร้างบอร์ด FG จากออเดอร์" (MonitorFgSync.jsx) เขียน `kind = 'fg'` แต่ CHECK `monitor_boards_kind_chk`
--    ไม่เคยมี 'fg' (migration 06/10 เพิ่มแค่ index ลูกค้า) ⇒ upsert ล้มทุกครั้ง · DR ไม่มีบอร์ด fg สักบอร์ด
-- แก้: เพิ่ม 'fg' ใน CHECK (เพิ่มค่าอย่างเดียว ไม่ตัดค่าเดิม) · ชุดค่าต้องตรงกับ BOARD_KINDS ใน src/utils/monitorBoards.js (มีเทสล็อก)
-- Rollback: ใส่ CHECK ชุดเดิม (ไม่มี 'fg') — ทำได้เมื่อยังไม่มีบอร์ด fg เท่านั้น
alter table public.monitor_boards drop constraint if exists monitor_boards_kind_chk;
alter table public.monitor_boards add constraint monitor_boards_kind_chk check (kind = any (array[
  'line','rack','raw','great','vendor','fg',
  'st_raw','st_semi','st_purchase','st_before','st_after','st_blank']));
