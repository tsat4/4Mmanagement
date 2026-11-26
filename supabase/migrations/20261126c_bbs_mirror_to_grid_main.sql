-- ═══════════════════════════════════════════════════════════════════════════════════════
-- 🔁 สะพานชั่วคราว: เขียน BBS ต.ค.–พ.ย. ลงตารางเดิม (bbs_*) → สะท้อนเข้า wf_grid_* ทันที
-- project: MAIN (ewhdfqwfwofivojtsizn · จอ Supabase "MAIN") · 2026-11-26
-- เหตุ: ย้ายข้อมูลแล้ว (20261126b) แต่โค้ดจอใหม่ขึ้นตามหน้าต่าง deploy (หลังเลิกกะ) — ระหว่างนั้นหน้างานยังเขียนตารางเดิม
--       ไม่มีสะพาน = ของที่กรอกวันนี้หายจากตารางใหม่เงียบๆ
-- ขอบเขต: เฉพาะใบเดือน 2026-10 / 2026-11 · ใบงาน bbs_grid ล็อก (มีคนเซ็น) = trigger ฝั่งตารางใหม่บล็อก → การเขียนตารางเดิมล้มด้วย (สอดคล้องกัน)
-- ⏳ ถอดเมื่อลบตาราง bbs_* (ขั้นถัดไป) — drop table ทิ้ง trigger ไปด้วย
-- ↩️ ROLLBACK: drop trigger trg_bbs_obs_mirror on public.bbs_observations; drop trigger trg_bbs_notes_mirror on public.bbs_row_notes;
--             drop trigger trg_bbs_sheets_mirror on public.bbs_sheets; drop function public.bbs_mirror_to_grid();
-- ═══════════════════════════════════════════════════════════════════════════════════════
create or replace function public.bbs_mirror_to_grid()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare s bbs_sheets%rowtype; gid uuid;
begin
  if tg_table_name = 'bbs_sheets' then
    if tg_op = 'DELETE' or coalesce(new.month_key, '') not in ('2026-10', '2026-11') then return coalesce(new, old); end if;
    insert into wf_grid_sheets (def_key, line_name, section, period_from, period_to, header, updated_by_name)
    values ('bbs_grid', new.line_name, new.section, (new.month_key || '-01')::date,
            ((new.month_key || '-01')::date + interval '1 month' - interval '1 day')::date,
            jsonb_strip_nulls(jsonb_build_object('legacy_sheet_id', new.id, 'dept', new.dept, 'inspector_name', new.inspector_name,
              'inspector_code', new.inspector_code, 'inspector_sig_url', new.inspector_sig_url, 'inspector_uid', new.inspector_uid, 'note', new.note)),
            new.updated_by_name)
    on conflict (def_key, line_name, period_from) do update set header = excluded.header, updated_at = now();
    return new;
  end if;
  select * into s from bbs_sheets where id = coalesce(new.sheet_id, old.sheet_id);
  if not found or s.month_key not in ('2026-10', '2026-11') then return coalesce(new, old); end if;
  select id into gid from wf_grid_sheets where def_key = 'bbs_grid' and line_name = s.line_name and period_from = (s.month_key || '-01')::date;
  if gid is null then
    insert into wf_grid_sheets (def_key, line_name, section, period_from, period_to, updated_by_name)
    values ('bbs_grid', s.line_name, s.section, (s.month_key || '-01')::date, ((s.month_key || '-01')::date + interval '1 month' - interval '1 day')::date, s.updated_by_name)
    returning id into gid;
  end if;
  if tg_table_name = 'bbs_observations' then
    if tg_op = 'DELETE' then
      delete from wf_grid_cells where sheet_id = gid and row_key = old.employee_id::text and col = old.day;
    else
      insert into wf_grid_cells (sheet_id, row_key, col, mark, item_seq, note, source, updated_by_name)
      values (gid, new.employee_id::text, new.day, new.mark, new.agreement_seq, new.note, coalesce(new.source, 'manual'), new.updated_by_name)
      on conflict (sheet_id, row_key, col) do update set mark = excluded.mark, item_seq = excluded.item_seq, note = excluded.note,
        source = excluded.source, updated_by_name = excluded.updated_by_name, updated_at = now();
    end if;
  else  -- bbs_row_notes
    if tg_op = 'DELETE' then
      delete from wf_grid_row_notes where sheet_id = gid and row_key = old.employee_id::text;
    else
      insert into wf_grid_row_notes (sheet_id, row_key, note, updated_by_name)
      values (gid, new.employee_id::text, new.note, new.updated_by_name)
      on conflict (sheet_id, row_key) do update set note = excluded.note, updated_by_name = excluded.updated_by_name, updated_at = now();
    end if;
  end if;
  return coalesce(new, old);
end $$;
revoke all on function public.bbs_mirror_to_grid() from public, anon, authenticated;

drop trigger if exists trg_bbs_sheets_mirror on public.bbs_sheets;
create trigger trg_bbs_sheets_mirror after insert or update on public.bbs_sheets for each row execute function public.bbs_mirror_to_grid();
drop trigger if exists trg_bbs_obs_mirror on public.bbs_observations;
create trigger trg_bbs_obs_mirror after insert or update or delete on public.bbs_observations for each row execute function public.bbs_mirror_to_grid();
drop trigger if exists trg_bbs_notes_mirror on public.bbs_row_notes;
create trigger trg_bbs_notes_mirror after insert or update or delete on public.bbs_row_notes for each row execute function public.bbs_mirror_to_grid();

-- ── ตรวจผล: จำนวนช่องต่อใบ ตารางเดิม = ตารางใหม่ (ต้องได้ 0) ──
-- select count(*) from bbs_sheets s where s.month_key in ('2026-10','2026-11')
--   and (select count(*) from bbs_observations o where o.sheet_id = s.id)
--    <> (select count(*) from wf_grid_cells c join wf_grid_sheets g on g.id = c.sheet_id
--         where g.def_key = 'bbs_grid' and g.line_name = s.line_name and g.period_from = (s.month_key||'-01')::date);
