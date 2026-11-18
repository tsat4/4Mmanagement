-- 📷 หมายเหตุรายเดือนบนแผ่น KPI แนบรูปได้ (2026-11-16 · user: "add note/remark/action เหมือนยังใส่รูปไม่ได้")
-- project: MAIN (ewhdfqwfwofivojtsizn) · ย้อนได้: คอลัมน์ใหม่ nullable · รูปอยู่ถัง action-images (policy เดิม 20261012) path kpi-note/…
alter table public.kpi_month_notes add column if not exists image_url text;
comment on column public.kpi_month_notes.image_url is 'public URL รูปแนบ (ถัง action-images · path kpi-note/<ปี>-<เดือน>-<ts>) · null = ไม่มีรูป';
