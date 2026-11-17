-- 📒 ทะเบียน "ค่าที่ stamp ไว้ก่อนถูกไล่คำนวณใหม่" — project: DR ("Product DB" · eyhclzkifitbhbljgoav)
-- เหตุ: ไล่แก้ %A/OEE ของกะที่ปิดแล้ว หลังแก้นิยาม downtime (16/11 · คำสั่ง user)
-- 🔴 เขียนทับค่าที่ stamp ไว้ได้ ต่อเมื่อ log ค่าเดิมสำเร็จก่อนเท่านั้น (ย้อนกลับได้ 100%)
create table if not exists public.oee_restamp_log (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.production_sessions(id) on delete cascade,
  reason        text not null,
  oee_a_before  numeric, oee_before numeric,
  oee_a_after   numeric, oee_after  numeric,
  moved_min     numeric,
  created_at    timestamptz not null default now()
);
create index if not exists oee_restamp_log_session_idx on public.oee_restamp_log(session_id);
create index if not exists oee_restamp_log_reason_idx  on public.oee_restamp_log(reason, created_at desc);

comment on table public.oee_restamp_log is
  '📒 ค่า %A/OEE ก่อนถูกไล่คำนวณใหม่ (scripts/restamp-dt-rule.mjs) · ใช้ย้อนกลับ';

alter table public.oee_restamp_log enable row level security;
drop policy if exists oee_restamp_log_all on public.oee_restamp_log;
create policy oee_restamp_log_all on public.oee_restamp_log for all to public using (true) with check (true);
grant select, insert, update, delete on public.oee_restamp_log to anon, authenticated;

notify pgrst, 'reload schema';
