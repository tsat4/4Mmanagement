-- 📒 ทะเบียน "ค่าที่ stamp ไว้ก่อนถูกไล่คำนวณใหม่" — project: DR ("Product DB" · eyhclzkifitbhbljgoav)
-- เหตุ: ไล่แก้ค่าของกะที่ปิดแล้ว 2 งาน — (ก) นิยาม downtime ใหม่ 16/11  (ข) ย้ายใบที่ลงกะผิด 18/11
-- 🔴 เขียนทับค่าที่ stamp ไว้ได้ ต่อเมื่อ log ค่าเดิมสำเร็จก่อนเท่านั้น (ย้อนกลับได้ 100%)
create table if not exists public.oee_restamp_log (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.production_sessions(id) on delete cascade,
  reason        text not null,
  oee_a_before  numeric, oee_a_after numeric,
  oee_p_before  numeric, oee_p_after numeric,
  oee_q_before  numeric, oee_q_after numeric,
  oee_before    numeric, oee_after   numeric,
  qty_before    numeric, qty_after   numeric,
  moved_min     numeric,
  note          text,
  created_at    timestamptz not null default now()
);
-- ไฟล์นี้เคยถูกเขียนไว้แบบคอลัมน์น้อยกว่า (ยังไม่เคย apply) — เผื่อฐานไหน apply ไปแล้วให้เติมให้ครบ
alter table public.oee_restamp_log
  add column if not exists oee_p_before numeric, add column if not exists oee_p_after numeric,
  add column if not exists oee_q_before numeric, add column if not exists oee_q_after numeric,
  add column if not exists qty_before   numeric, add column if not exists qty_after   numeric,
  add column if not exists note         text;

create index if not exists oee_restamp_log_session_idx on public.oee_restamp_log(session_id);
create index if not exists oee_restamp_log_reason_idx  on public.oee_restamp_log(reason, created_at desc);

comment on table public.oee_restamp_log is
  '📒 ค่าที่ stamp ไว้ก่อนถูกไล่คำนวณใหม่ (scripts/restamp-*.mjs) · ใช้ย้อนกลับ';

alter table public.oee_restamp_log enable row level security;
drop policy if exists oee_restamp_log_all on public.oee_restamp_log;
create policy oee_restamp_log_all on public.oee_restamp_log for all to public using (true) with check (true);
grant select, insert, update, delete on public.oee_restamp_log to anon, authenticated;

notify pgrst, 'reload schema';
