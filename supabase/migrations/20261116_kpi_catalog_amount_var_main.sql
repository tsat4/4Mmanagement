-- 💰 ยอดเงินคู่กันของ KPI ที่เป็น % ของยอดขาย (2026-11-16 · user: "ให้ขึ้นยอดเงินคู่กัน")
-- project: MAIN (ewhdfqwfwofivojtsizn) · ย้อนได้: คอลัมน์ใหม่ nullable · โค้ดเก่าไม่อ่านก็ไม่พัง
alter table public.kpi_catalog add column if not exists amount_var text;
comment on column public.kpi_catalog.amount_var is
  'ตัวแปรยอดเงินคู่กัน (คีย์ใน KPI_BASE_VARS หน่วยบาท เช่น cost_100p) — แผ่น Obeya โชว์ยอดเงินเดือน+สะสมคู่กับ % · null = ไม่โชว์ · ตั้งที่ 📘 ทะเบียน KPI';
-- seed: 100P = cost_100p (ใบบัญชีหน้า 100P มีแถว "100P" บาท คู่กับ "%")
update public.kpi_catalog set amount_var = 'cost_100p'
 where name = 'Overall Cost Improvement (100P)' and amount_var is null;
