-- ทะเบียนเอกสาร: CSV ผลตรวจ QA 3 ตัว (feedback ประชุม 2026-11-16 · คำสั่ง user)
-- ★ Apply on MAIN (ชื่อในจอ Supabase "MAIN") — project ewhdfqwfwofivojtsizn — additive ล้วน
--
-- ที่มา: user *"หน้า QA พวกการตรวจสอบและทุกๆการตรวจสอบ export data พวกผลตรวจ เป็น CSV
--        ทั้งดาต้ารายพาร์ทและ SPC"*
--   · ผลตรวจรายพาร์ท  → ปุ่มในแท็บ "ใบตรวจ (Check Sheet)" ของ /qa (components/QaCheckSheet.jsx)
--   · ค่าวัด SPC + สรุป Cpk → ปุ่มในแท็บ "SPC / Cp-Cpk" ของ /qa (pages/QualityControl.jsx · SPCTab)
--   แถวข้อมูลประกอบที่ src/utils/qaCsvRows.js (pure · มีเทส) · ไฟล์ออกทาง src/utils/csvDoc.js
--
-- 🔴 form_code = null โดยตั้งใจ — วันที่ apply **ชื่อไฟล์เหมือนเดิมทุกตัว ไม่มีอะไรเปลี่ยน**
--    เลขฟอร์ม/Rev โผล่เองเมื่อ doc_control ไปตั้งที่ /doc-forms (หลักเดียวกับ withDocFoot ของใบพิมพ์)
-- 🔴 เลขฟอร์มของ CSV อยู่ที่ "ชื่อไฟล์" เท่านั้น ห้ามแทรกบรรทัดในเนื้อไฟล์
--    (Excel/Sheets ยึด "แถวแรก = หัวตาราง" ⇒ แทรกบรรทัด = คอลัมน์เลื่อนทั้งไฟล์ = พัง pivot/สูตรของผู้ใช้)

insert into doc_forms (doc_key, title, form_code) values
  ('csv_qa_inspection_results', 'ผลตรวจตามมาตรฐาน รายพาร์ท (CSV)',        null),
  ('csv_qa_spc_values',         'ค่าวัด SPC รายค่า — ใบตรวจ/จุดควบคุม (CSV)', null),
  ('csv_qa_spc_summary',        'สรุป Cp-Cpk รายจุดวัด (CSV)',             null)
on conflict (doc_key) do nothing;

-- ตรวจผล (ควรได้ 3 แถว · form_code ว่าง):
--   select doc_key, title, form_code, rev from doc_forms
--    where doc_key in ('csv_qa_inspection_results','csv_qa_spc_values','csv_qa_spc_summary')
--    order by doc_key;
-- Rollback:
--   delete from doc_forms where doc_key in
--     ('csv_qa_inspection_results','csv_qa_spc_values','csv_qa_spc_summary');
