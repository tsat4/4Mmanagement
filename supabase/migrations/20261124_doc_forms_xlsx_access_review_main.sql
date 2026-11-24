-- ทะเบียนเอกสาร: Excel "ใบทบทวนสิทธิ์ผู้ใช้ ESM" (/add-user · ปุ่ม 📋 ใบทบทวนสิทธิ์ · ISO 27001 A.5.18 · คำสั่ง user 24/11
--   "เริ่มทำรายงานทบทวนสิทธิ์ของ ESM" · user เลือกเก็บผลเป็นไฟล์ Excel ไม่สร้างตารางใหม่)
-- ✅ apply แล้ว 24/11 ผ่าน MCP (ตรวจกลับได้ 1 แถว)
-- ★ Apply on MAIN (ชื่อในจอ Supabase "MAIN") — project ewhdfqwfwofivojtsizn — additive ล้วน (insert 1 แถว)
-- โค้ดทำงานได้ทั้งก่อน/หลัง apply: ก่อน = getDocForm คืน fallback ⇒ ชื่อไฟล์ ESM_access_review_<วันที่>.xlsx (ไม่ล้ม)
-- 🔴 form_code = null โดยตั้งใจ — วันที่ apply ชื่อไฟล์ยังเหมือนเดิม · doc_control ตั้งเลขฟอร์ม/ช่องลายเซ็นที่ /doc-forms ได้เอง

insert into doc_forms (doc_key, title, form_code, used_route) values
  ('xlsx_access_review', 'ใบทบทวนสิทธิ์ผู้ใช้ ESM (Access Review · Excel)', null, '/add-user')
on conflict (doc_key) do nothing;

-- ตรวจผล (ควรได้ 1 แถว · form_code ว่าง):
--   select doc_key, title, form_code, rev, used_route from doc_forms where doc_key = 'xlsx_access_review';
--
-- Rollback:
--   delete from doc_forms where doc_key = 'xlsx_access_review';
