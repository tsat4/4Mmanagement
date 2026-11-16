/* ═══ 🧹 ปิด min/max ของ FG ในทะเบียนไลน์ (DR · Product DB) — 2026-11-15 ═══════════
 *
 * ที่มา: user เคาะ *"ล้างละลุยเลย"* หลังผมรายงานว่าทะเบียน `line_part_levels` มี FG ปน
 *
 * 🔴 กฎที่มีอยู่แล้ว (`src/utils/monitoringSheet.js`): **FG (MAT ขึ้นต้น 1) ห้ามลงเป็น min/max
 *    ที่ไลน์** — `line_part_levels` คือ "ของที่ไลน์ต้องมีติดไลน์" ซึ่งเป็น**ชิ้นส่วน** ไม่ใช่ของสำเร็จรูป
 *    ตัวนำเข้า 23/09 เขียนให้ทุกพาร์ทรวม FG ⇒ ทะเบียนเปื้อนมาตั้งแต่นั้น
 *
 * วัดก่อนล้าง (14/11): 74 แถว · FG **32 แถว = 43%** (ยังเปิดอยู่ 26 · มีคนปิดมือไปแล้ว 6)
 *   ถ้าเปิดฟีเจอร์ "ของถึง min → ส่งความต้องการ" ทั้งที่ยังเปื้อน = **ยิงงานปลอม 29 รายการวันแรก**
 * หลังล้าง: FG เปิดอยู่ **0** · ชิ้นส่วน 42 แถว (มี min 41) = สัญญาณที่เชื่อได้
 *
 * 🔴 **ปิดใช้งาน ไม่ลบ** (`is_active=false`) — เก็บประวัติไว้ · note บอกเหตุผลในแถว
 * ↩️ rollback: update line_part_levels set is_active = true
 *              where mat_no like '1%' and updated_by_name = 'ระบบ · ล้างทะเบียน FG 14/11';
 *
 * 📊 blast radius (ไล่แล้วทุกตัวที่อ่านตารางนี้):
 *   · กรอง `is_active` อยู่แล้ว ⇒ **เปลี่ยน**: StoreWaitCards · PartLevelCoveragePanel · FlowTower
 *     (เลิกเห็นแถว FG ซึ่งไม่ควรมีตั้งแต่แรก = ผลที่ต้องการ)
 *   · **ไม่กรอง** `is_active` ⇒ **ไม่เปลี่ยนเลย**: Monitoring · MonitoringUpload · LinePartCallPanel
 *     (บอร์ด Monitoring ยังทำงานเหมือนเดิมเป๊ะ — ตั้งใจ ไม่แตะของทีมวางแผน)
 * ═══════════════════════════════════════════════════════════════════════════════ */

update public.line_part_levels
   set is_active = false,
       note = nullif(btrim(coalesce(note, '')
              || ' · ปิด 14/11: FG ห้ามมี min/max ที่ไลน์ (ของสำเร็จรูปไม่ใช่ของที่ไลน์ถือ) — เปิดกลับได้ด้วย is_active=true'), ''),
       updated_by_name = 'ระบบ · ล้างทะเบียน FG 14/11',
       updated_at = now()
 where mat_no like '1%' and is_active;

-- ตรวจผล: ต้องได้ FG ยังเปิด = 0
-- select (mat_no like '1%') is_fg, count(*) filter (where is_active) ยังเปิด
--   from line_part_levels group by 1 order by 1;
