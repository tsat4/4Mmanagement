-- 🔢 จัดเลขลำดับ permission_catalog 10 แถวที่หลุดช่วงหมวด/ซ้ำกัน (2026-11-19 · คำสั่ง user)
-- Project: Main ("MAIN" · ewhdfqwfwofivojtsizn)
-- cosmetic ล้วน: เปลี่ยนแค่ "ลำดับแถวในหน้า /permissions" — ไม่แตะ role_permissions ไม่มีใครได้/เสียสิทธิ์
-- เลขใหม่ = เลขว่างข้างแถวพี่น้องในหมวดเดียวกัน (ตรวจเลขที่ใช้แล้วจากฐานจริงก่อนเขียน)
-- ย้อน (ค่าเดิม): am.approve 99 · am.monthly_signoff 100 · pm.monthly_approve 101 · pm.monthly_ack 102 ·
--   ct.approve 320 · rfq.assess 760 · permissions.manage 90 · manpower_board.edit 455 · grades.manage 36

update permission_catalog p set sort = v.sort
from (values
  ('am', 'approve', 616),             -- ถัด am.record 615
  ('am', 'monthly_signoff', 617),
  ('pm', 'monthly_approve', 623),     -- ถัด pm.setup 622
  ('pm', 'monthly_ack', 624),
  ('ct', 'approve', 751),             -- ถัด pe.approve 750
  ('rfq', 'assess', 757),             -- เดิมชน npi.approve 760 · ถัด rfq.edit 758
  ('permissions', 'manage', 901),     -- หัวหมวดตั้งค่า (เดิม 90)
  ('manpower_board', 'edit', 222),    -- ถัด management.assign_* 220-221
  ('grades', 'manage', 409)           -- ถัด employees.* 405-408
) as v(resource, action, sort)
where p.resource = v.resource and p.action = v.action;

-- ตรวจ: select * from v_permission_catalog_sort_drift;   -- ต้องว่าง
