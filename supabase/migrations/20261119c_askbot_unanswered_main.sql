-- 💬 AskBot — เก็บ "คำถามที่แชทตอบไม่ได้" (2026-11-19 · คำสั่ง user ทาง ข)
-- Project: Main ("MAIN" · ewhdfqwfwofivojtsizn)
-- เป้า: เห็นคำที่หน้างานพิมพ์จริง → เพิ่มคำพ้อง/เครื่องมือจากของจริง ไม่ต้องเดา + หลักฐานประกอบขอบงบ AI
-- ใครเขียน: client ของผู้ถามเอง (src/components/AskBot.jsx) — insert อย่างเดียว · ไม่มี update/delete จาก client
-- ใครอ่าน: has_perm('askbot:review') — ไม่ seed role ใด = admin เท่านั้น (has_perm ให้ admin เสมอ)
-- ไม่ผูก audit: ตารางบันทึกแบบเขียนครั้งเดียว ไม่มีการแก้ (กฎ audit ใช้กับตาราง master/แก้ได้)
-- ROLLBACK (ย้อนได้ทั้งก้อน · ไม่มีอะไรอ้างตารางนี้ · โค้ดกลืน error การบันทึกเอง แชทยังตอบได้):
--   drop table if exists public.askbot_unanswered;
--   delete from permission_catalog where resource = 'askbot' and action = 'review';

create table if not exists public.askbot_unanswered (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id    uuid default auth.uid() references public.profiles(id) on delete set null,
  role       text,
  question   text not null check (char_length(question) between 1 and 300),
  reason     text not null check (reason in ('not_understood', 'not_found'))
);
create index if not exists askbot_unanswered_created_idx on public.askbot_unanswered (created_at desc);

alter table public.askbot_unanswered enable row level security;

drop policy if exists askbot_unanswered_insert on public.askbot_unanswered;
create policy askbot_unanswered_insert on public.askbot_unanswered
  for insert to authenticated
  with check (user_id = auth.uid() and public.has_perm('askbot:use'));

drop policy if exists askbot_unanswered_select on public.askbot_unanswered;
create policy askbot_unanswered_select on public.askbot_unanswered
  for select to authenticated
  using (public.has_perm('askbot:review'));

grant select, insert on public.askbot_unanswered to authenticated;

insert into permission_catalog (resource, action, label, group_name, sort)
values ('askbot', 'review', 'แชทถามข้อมูล: ดูคำถามที่แชทตอบไม่ได้', 'ภาพรวม', 141)
on conflict (resource, action) do update
  set label = excluded.label, group_name = excluded.group_name, sort = excluded.sort;

-- ตรวจ:
--   select policyname, cmd from pg_policies where tablename = 'askbot_unanswered';            -- insert + select
--   select privilege_type from information_schema.role_table_grants
--    where table_name = 'askbot_unanswered' and grantee = 'authenticated';                    -- INSERT, SELECT
--   select * from v_permission_catalog_sort_drift;                                            -- ว่าง
-- ดูคำถาม: select created_at at time zone 'Asia/Bangkok' as at, role, reason, question
--          from askbot_unanswered order by created_at desc limit 200;
