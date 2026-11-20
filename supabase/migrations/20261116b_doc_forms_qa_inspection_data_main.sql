-- ทะเบียนเอกสาร: ใบตรวจ QA = "Inspection Data" FM-QA-112 Rev. 01 (Effective 13/11/2020) + CSV ผลตรวจ (2026-11-16 · คำสั่ง user
-- แนบใบจริง 5 พาร์ท "ทำให้ระบบ display result & export pdf ออกมาแบบนี้ รวมถึง export .csv รูปแบบเดียวกัน")
-- ★ Apply on MAIN ("MAIN" · ewhdfqwfwofivojtsizn) — ค่ามาจากท้ายใบจริง · ตั้งเฉพาะช่องที่ยังว่าง (doc_control แก้ทับได้ที่ /doc-forms)
update doc_forms set
  form_code      = coalesce(form_code, 'FM-QA-112'),
  rev            = coalesce(rev, 'Rev. 01'),
  effective_date = coalesce(effective_date, '13/11/2020'),
  title          = 'Inspection Data',
  sig_blocks     = coalesce(sig_blocks, '["Approved","Checked","Prepared"]'::jsonb),
  orientation    = coalesce(orientation, 'landscape')
where doc_key = 'qa_inspection_sheet';

insert into doc_forms (doc_key, title, form_code) values
  ('csv_qa_inspection_data', 'ผลตรวจ Inspection Data (CSV)', null)
on conflict (doc_key) do nothing;
-- ตรวจผล: select doc_key, form_code, rev, effective_date, sig_blocks from doc_forms where doc_key in ('qa_inspection_sheet','csv_qa_inspection_data');
-- Rollback: update doc_forms set form_code=null, rev=null, effective_date=null, sig_blocks=null, orientation=null,
--             title='ใบตรวจตามมาตรฐาน QA (Inspection Check Sheet)' where doc_key='qa_inspection_sheet';
--           delete from doc_forms where doc_key='csv_qa_inspection_data';
