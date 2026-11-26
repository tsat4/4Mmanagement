-- ═══════════════════════════════════════════════════════════════════════════════════════
-- 🦺 ย้ายข้อมูล BBS ต.ค.–พ.ย. 2569 จากตาราง bbs_* เดิม → ตารางกลาง wf_grid_* (ใบงาน bbs_grid)
-- project: MAIN (ewhdfqwfwofivojtsizn · จอ Supabase "MAIN") · 2026-11-26 · คำสั่ง user "ย้าย data ต.ค.–พ.ย. เข้าตารางใหม่เลย"
--
-- ลำดับ:
--   0) สำรองทั้ง 4 ตาราง bbs_* (ทุกเดือน) ไว้ schema `archive` ก่อน (กฎ: สำเนากันพลาดห้ามอยู่ public)
--   1) หัวใบ → wf_grid_sheets (ผู้ตรวจ/รหัส/ลายเซ็นเดิมเก็บใน header เพื่อพิมพ์ใบย้อนหลังได้เหมือนเดิม)
--   2) ช่อง → wf_grid_cells (mark/เลขข้อ/หมายเหตุ/ที่มา/ผู้บันทึก/เวลา คงเดิม) · 3) หมายเหตุท้ายแถว
--   4) ใบรอบเซ็นของ ต.ค.–พ.ย. (ใบงาน bbs_monthly · ยังไม่มีใครเซ็น) ย้ายไปใบงาน bbs_grid (ขั้นเหมือนกันทุกขั้น) — เลขใบเดิม
--   5) ปิดใบงาน bbs_monthly (retired) — ไม่งั้นตัวสแกนจะเปิดรอบ ต.ค. ซ้ำบนตารางเดิม
-- 🔴 ไม่ลบตาราง bbs_* ในไฟล์นี้ (user สั่งลบหลังย้าย — ถามยืนยันก่อนลบ · ส.ค.–ก.ย. ยังอยู่ตารางเดิม)
-- ↩️ ROLLBACK (ย้อนโค้ดก่อน แล้วรันใน SQL Editor MAIN):
--   update wf_defs set status = 'active' where key = 'bbs_monthly';
--   update wf_instances i set def_id = (select id from wf_defs where key='bbs_monthly'),
--          version_id = (select current_version_id from wf_defs where key='bbs_monthly'), subject_kind = 'bbs'
--    where i.def_id = (select id from wf_defs where key='bbs_grid') and i.period_from in ('2026-10-01','2026-11-01');
--   delete from wf_grid_sheets where def_key = 'bbs_grid' and period_from in ('2026-10-01','2026-11-01');   -- cascade ช่อง/หมายเหตุ
-- ═══════════════════════════════════════════════════════════════════════════════════════
begin;

create schema if not exists archive;
create table if not exists archive.bbs_sheets_20261126 as table public.bbs_sheets;
create table if not exists archive.bbs_observations_20261126 as table public.bbs_observations;
create table if not exists archive.bbs_row_notes_20261126 as table public.bbs_row_notes;
create table if not exists archive.bbs_agreements_20261126 as table public.bbs_agreements;

-- 1) หัวใบ
insert into public.wf_grid_sheets (def_key, line_name, section, period_from, period_to, header, updated_by_uid, updated_by_name, created_at, updated_at)
select 'bbs_grid', s.line_name, s.section, (s.month_key || '-01')::date,
       ((s.month_key || '-01')::date + interval '1 month' - interval '1 day')::date,
       jsonb_strip_nulls(jsonb_build_object('legacy_sheet_id', s.id, 'dept', s.dept, 'inspector_name', s.inspector_name,
         'inspector_code', s.inspector_code, 'inspector_sig_url', s.inspector_sig_url, 'inspector_uid', s.inspector_uid, 'note', s.note)),
       s.updated_by_uid, s.updated_by_name, s.created_at, s.updated_at
  from public.bbs_sheets s
 where s.month_key in ('2026-10', '2026-11')
on conflict (def_key, line_name, period_from) do nothing;

-- 2) ช่อง
insert into public.wf_grid_cells (sheet_id, row_key, col, mark, item_seq, note, source, updated_by_uid, updated_by_name, created_at, updated_at)
select g.id, o.employee_id::text, o.day, o.mark, o.agreement_seq, o.note, coalesce(o.source, 'manual'),
       o.updated_by_uid, o.updated_by_name, o.created_at, o.updated_at
  from public.bbs_observations o
  join public.bbs_sheets s on s.id = o.sheet_id
  join public.wf_grid_sheets g on g.def_key = 'bbs_grid' and g.line_name = s.line_name and g.period_from = (s.month_key || '-01')::date
 where s.month_key in ('2026-10', '2026-11')
on conflict (sheet_id, row_key, col) do nothing;

-- 3) หมายเหตุท้ายแถว
insert into public.wf_grid_row_notes (sheet_id, row_key, note, updated_by_uid, updated_by_name, created_at, updated_at)
select g.id, r.employee_id::text, r.note, r.updated_by_uid, r.updated_by_name, r.created_at, r.updated_at
  from public.bbs_row_notes r
  join public.bbs_sheets s on s.id = r.sheet_id
  join public.wf_grid_sheets g on g.def_key = 'bbs_grid' and g.line_name = s.line_name and g.period_from = (s.month_key || '-01')::date
 where s.month_key in ('2026-10', '2026-11')
on conflict (sheet_id, row_key) do nothing;

-- 4) ใบรอบเซ็น ต.ค.–พ.ย. → ใบงาน bbs_grid (ขั้น issue/check/approve เหมือนกัน · ตรวจก่อนย้าย)
do $$
declare g_def uuid; g_ver uuid; m_def uuid; m_steps jsonb; g_steps jsonb;
begin
  select id, current_version_id into g_def, g_ver from wf_defs where key = 'bbs_grid';
  select d.id, v.flow_schema->'steps' into m_def, m_steps from wf_defs d join wf_versions v on v.id = d.current_version_id where d.key = 'bbs_monthly';
  select flow_schema->'steps' into g_steps from wf_versions where id = g_ver;
  if g_def is null or m_def is null then raise exception 'ไม่พบใบงาน bbs_grid/bbs_monthly'; end if;
  if (select jsonb_agg(s->>'key') from jsonb_array_elements(m_steps) s) is distinct from (select jsonb_agg(s->>'key') from jsonb_array_elements(g_steps) s) then
    raise exception 'ขั้นของ 2 ใบงานไม่ตรงกัน — ย้ายใบรอบไม่ได้';
  end if;
  update wf_instances set def_id = g_def, version_id = g_ver, subject_kind = 'grid', updated_at = now()
   where def_id = m_def and period_from in ('2026-10-01', '2026-11-01');
  -- 5) ปิดใบงานเดิม
  update wf_defs set status = 'retired', updated_at = now() where id = m_def;
end $$;

commit;

-- ── ตรวจผล (ต้องตรงทุกแถว) ──
-- select s.month_key, s.line_name, (select count(*) from bbs_observations o where o.sheet_id = s.id) as old_n,
--        (select count(*) from wf_grid_cells c join wf_grid_sheets g on g.id = c.sheet_id
--          where g.def_key = 'bbs_grid' and g.line_name = s.line_name and g.period_from = (s.month_key||'-01')::date) as new_n
--   from bbs_sheets s where s.month_key in ('2026-10','2026-11') order by 1, 2;
