-- ต้นทางจำลอง "DR" — ลำดับคอลัมน์ audit_log ต่างจาก Main + id ชนกัน (เหมือนของจริง · ข้อมูลปลอม)
create extension if not exists pg_trgm with schema public;
create extension if not exists pgstattuple with schema public;
create schema if not exists archive;
create table public.audit_log (id bigint generated always as identity primary key, table_name text, row_pk text, action text,
  actor text, changed_fields text[], old_data jsonb, new_data jsonb, changed_at timestamptz default now(), actor_uid uuid);
create index idx_audit_log_changed_at on public.audit_log(changed_at);
create index idx_audit_log_table_row on public.audit_log(table_name, row_pk);
create index idx_audit_log_actor_uid on public.audit_log(actor_uid);
alter table public.audit_log enable row level security;
create policy audit_log_read on public.audit_log for select to anon, authenticated using (true);
grant select, insert on public.audit_log to anon, authenticated;
create table public.audit_log_retention (table_name text primary key, keep_days int, mode text);
create table archive.audit_log_aged (id bigint primary key, table_name text, row_pk text, action text, actor text,
  changed_fields text[], old_data jsonb, new_data jsonb, changed_at timestamptz, actor_uid uuid);

-- 4 ตัวเนื้อตรงกับ Main เป๊ะ
create function public.fn_set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
create function public.norm_person_name(s text) returns text language sql immutable as $$ select lower(btrim(s)) $$;
create function public.esm_schema_overview() returns int language sql as $$ select 1 $$;
create function public.esm_schema_table(p_table text) returns text language sql as $$ select p_table $$;
-- fn_audit ของ DR: ชื่อคนจากคอลัมน์ในแถว (DR ไม่มี login)
create function public.fn_audit() returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_row jsonb; begin
  if nullif(current_setting('app.audit', true), '') = 'off' then return NEW; end if;
  v_row := to_jsonb(NEW);
  insert into public.audit_log(table_name,row_pk,action,actor,new_data)
  values (TG_TABLE_NAME, v_row->>'id', TG_OP, coalesce(v_row->>'updated_by_name','dr-floor'), v_row);
  return NEW; end $$;

create table public.profiles (id uuid primary key references auth.users(id), full_name text, org_level int, departments text[]);
create function public.current_user_is_admin() returns boolean language sql stable as $$ select exists(select 1 from public.profiles where id = auth.uid() and org_level >= 9) $$;
create function public.current_user_has_department(d text) returns boolean language sql stable as $$ select exists(select 1 from public.profiles where id = auth.uid() and d = any(departments)) $$;
alter table public.profiles enable row level security;
create policy profiles_select_admin on public.profiles for select using (public.current_user_is_admin());
create policy profiles_update_admin on public.profiles for update using (public.current_user_has_department('x'));
create function public.handle_new_user() returns trigger language plpgsql security definer as $$ begin insert into public.profiles(id) values (new.id); return new; end $$;
create table public.notifications (id uuid primary key default extensions.gen_random_uuid(), user_id uuid references auth.users(id), title text);
create index notifications_user_id_idx on public.notifications(user_id);

create table public.machines (id serial primary key, machine_no text, updated_by_name text, updated_at timestamptz);
create index machines_no_trgm on public.machines using gin (machine_no gin_trgm_ops);
create trigger trg_machines_upd before update on public.machines for each row execute function public.fn_set_updated_at();
create trigger trg_machines_audit after insert or update on public.machines for each row execute function public.fn_audit();
create table public.dr_products (id serial primary key, mat_no text, updated_by_name text);
create trigger trg_drp_audit after insert or update on public.dr_products for each row execute function public.fn_audit();
create table public.user_signatures (user_id uuid references auth.users(id), url text);
alter table public.machines enable row level security;
create policy machines_anon on public.machines for all to anon, authenticated using (true) with check (true);
grant all on public.machines, public.dr_products to anon, authenticated;
create view public.v_ct_history as select table_name, row_pk, changed_at from public.audit_log where table_name = 'dr_products';

-- ข้อมูล: DR มี auth แค่ 3 คน (ของเก่า ไม่ยก) · audit id ไปไกลกว่า Main (ชนแน่นอน)
insert into auth.users(id,email,encrypted_password) values
 ('d6fcc522-dcef-47dd-8450-d551edf8469f','old1@x.test','h1'),('355a2eec-2cf1-4e73-ba4a-f683fcf4e047','old2@x.test','h2'),('6cdd144d-5f14-462d-92a4-d04c2c86724c','old3@x.test','h3');
insert into public.profiles(id,full_name,org_level) select id,'old',1 from auth.users;
insert into public.machines(machine_no, updated_by_name) select 'SW-'||g, 'ช่าง '||(g%5) from generate_series(1,800) g;
update public.machines set machine_no = machine_no||'A', updated_by_name='หัวหน้า' where id % 3 = 0;
insert into public.dr_products(mat_no, updated_by_name) select 'MAT'||g, 'PE' from generate_series(1,300) g;
insert into public.audit_log_retention values ('machines',30,'archive');
insert into archive.audit_log_aged(id,table_name,row_pk,action,actor,changed_at) select g,'machines',g::text,'UPDATE','เก่า', now()-interval '200 days' from generate_series(5000,5050) g;
insert into storage.buckets values ('jig-images','jig-images',true,null,null);
create policy "public_read_jig_images" on storage.objects for select to public using (bucket_id = 'jig-images');
insert into storage.objects(bucket_id,name,metadata) values ('jig-images','j1.jpg','{"size":456,"mimetype":"image/jpeg"}');
alter publication supabase_realtime add table public.machines, public.notifications;
insert into cron.job(jobname,schedule,command) values ('purge-audit-log','30 17 * * *','delete from public.audit_log where changed_at < now() - interval ''6 months''');
