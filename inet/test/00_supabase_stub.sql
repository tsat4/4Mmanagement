-- โครงขั้นต่ำที่เลียน Supabase (ใช้ในเครื่องทดสอบเท่านั้น — ของจริงบน INET มีครบจาก stack)
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text, encrypted_password text, created_at timestamptz default now(),
  email_confirmed_at timestamptz, aud varchar(255), role varchar(255),
  -- GoTrue หา user ด้วย instance_id = 0000… — ของจริงทั้ง 133 คนเป็นค่านี้ (วัด 20/11) · null = login ไม่ได้
  instance_id uuid default '00000000-0000-0000-0000-000000000000',
  updated_at timestamptz default now(), raw_app_meta_data jsonb default '{"provider":"email"}', raw_user_meta_data jsonb default '{}',
  confirmation_token varchar default '', recovery_token varchar default '', email_change varchar default '',
  email_change_token_new varchar default '', email_change_token_current varchar default '', reauthentication_token varchar default '');
-- คอลัมน์ที่ GoTrue จริงบังคับ (not null) ต้องมีครบ — ไม่งั้น restore ลง stack จริงล้ม (เจอตอนซ้อม 20/11)
create table if not exists auth.identities (id uuid primary key default extensions.gen_random_uuid(), provider_id text not null,
  user_id uuid not null references auth.users(id), identity_data jsonb not null default '{}', provider text not null,
  last_sign_in_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now());
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (id uuid primary key default extensions.gen_random_uuid(), bucket_id text, name text, metadata jsonb);
alter table storage.objects enable row level security;
create schema if not exists cron;
create table if not exists cron.job (jobid serial, jobname text, schedule text, command text);
do $$ begin
  if not exists (select 1 from pg_publication where pubname='supabase_realtime') then create publication supabase_realtime; end if;
end $$;
grant usage on schema public to anon, authenticated;
