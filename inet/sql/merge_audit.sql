-- ══ รวม audit_log ของ DR เข้าตารางเดียวกับ Main (รันบนฐานใหม่เท่านั้น) ══
-- 📄 docs/modules/inet-migration.md §5.1–5.2
-- เข้ามาตอนนี้: public.audit_log = ของ Main (restore แล้ว) · public.audit_log_dr_import = ของ DR (โครงเดียวกัน)
\set ON_ERROR_STOP on
begin;

-- ① id ของ DR เลื่อนไป +1,000,000,000 ⇒ ไม่ชนของ Main ตลอดไป และดูเลขก็รู้ว่ามาจาก DR
do $$
declare v_main_max bigint; v_dr_n bigint; v_ins bigint;
begin
  select coalesce(max(id),0) into v_main_max from public.audit_log;
  if v_main_max >= 1000000000 then raise exception 'id ของ Main เกินค่าชดเชยแล้ว (%) — ต้องขยับค่าชดเชย', v_main_max; end if;
  select count(*) into v_dr_n from public.audit_log_dr_import;
  insert into public.audit_log (id, table_name, row_pk, action, actor, actor_uid, changed_fields, old_data, new_data, changed_at)
    overriding system value
    select id + 1000000000, table_name, row_pk, action, actor, actor_uid, changed_fields, old_data, new_data, changed_at
      from public.audit_log_dr_import;
  get diagnostics v_ins = row_count;
  if v_ins <> v_dr_n then raise exception 'ย้าย audit DR ไม่ครบ % จาก %', v_ins, v_dr_n; end if;
  raise notice 'audit_log: Main % แถว(max id %) + DR % แถว', (select count(*) from public.audit_log) - v_ins, v_main_max, v_ins;
end $$;

-- ② identity เดินต่อจากค่าสูงสุด (ของใหม่ต่อท้ายทั้งหมด ไม่ชนใคร)
select setval(pg_get_serial_sequence('public.audit_log','id'), (select max(id) from public.audit_log));

-- ③ archive ของ DR (แถวเก่าที่ fn_audit_log_sweep ย้ายไป) ใช้ค่าชดเชยเดียวกัน — ไล่ย้อนกลับได้ตรงกัน
do $$ begin
  if to_regclass('archive.audit_log_aged') is not null then
    update archive.audit_log_aged set id = id + 1000000000 where id < 1000000000;
  end if;
end $$;

drop table public.audit_log_dr_import;

-- ④ สิทธิ์อ่าน: authenticated เห็นทั้งหมด (เหมือน Main เดิม) · anon เห็นเฉพาะ audit ของตาราง DR (เหมือน DR เดิม)
--    🔴 ห้ามเปิด anon ทั้งตาราง — Main มี audit ของพนักงาน/สิทธิ์/4M (anon key อยู่ในเบราว์เซอร์ทุกเครื่อง)
create table public.audit_anon_tables (table_name text primary key);
comment on table public.audit_anon_tables is
  'ตาราง (เดิมฝั่ง DR) ที่ anon อ่าน audit ได้ — ตั้งตอนรวมฐาน INET · ตาราง DR ใหม่ที่จออ่าน audit ผ่าน supabaseDR ต้องเติมที่นี่';
-- เติมจากรายชื่อตารางของ DR dump (20_build_target.sh สร้างไฟล์ insert ให้) — ต้องไม่ว่าง
\i :dr_tables_sql
do $$ begin
  if (select count(*) from public.audit_anon_tables) = 0 then raise exception 'รายชื่อตาราง DR ว่าง'; end if;
  if exists (select 1 from public.audit_anon_tables where table_name in ('profiles','notifications','audit_log')) then
    raise exception 'ชื่อตารางที่ชนกับ Main หลุดเข้ารายชื่อ anon — audit ของ Main จะรั่ว'; end if;
end $$;
alter table public.audit_anon_tables enable row level security;
grant select on public.audit_anon_tables to anon, authenticated;
create policy audit_anon_tables_read on public.audit_anon_tables for select to anon, authenticated using (true);

drop policy if exists audit_log_read on public.audit_log;
create policy audit_log_read on public.audit_log for select to authenticated using (true);
create policy audit_log_read_anon_dr on public.audit_log for select to anon
  using (table_name in (select a.table_name from public.audit_anon_tables a));

commit;
