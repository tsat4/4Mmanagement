-- 🏭 fn_machine_shift_facts + reason_code (DR "Product DB" · eyhclzkifitbhbljgoav · 2026-11-16)
-- เหตุผล: แยก "กดพักหน้าเครื่อง" (เหตุผลที่ติดป้าย is_break) ออกจากหยุดตามแผนอื่น ต้องรู้รหัสเหตุผล
-- ⏱️ ยึด duration_sec ของต้นทางก่อน ended_at (นาฬิกา PLC คลาด ~3–5 นาที · คำสั่ง user 16/11)
-- เปลี่ยนชนิดผลลัพธ์ ⇒ drop + create · client ตัวเดียวที่เรียก = src/lib/jigOeeData.js (deploy คู่กัน)
-- ย้อน: รัน 20261113b_machine_shift_facts_dr.sql อีกครั้ง (drop ตัวนี้ก่อน)
drop function if exists public.fn_machine_shift_facts(uuid, timestamptz, timestamptz);
create function public.fn_machine_shift_facts(p_source uuid, p_from timestamptz, p_to timestamptz default now())
returns table (machine_tag text, work_date date, shift text, state text, reason_code int, is_minor boolean, sec numeric, n int)
language sql stable
set search_path = public
as $$
  with ev as (
    select e.machine_tag, e.state, e.reason_code, e.is_minor, e.started_at as s,
           case when e.duration_sec is not null and e.duration_sec >= 0
                then e.started_at + make_interval(secs => e.duration_sec)
                else e.ended_at end as e
    from public.machine_state_events e
    where e.source_id = p_source and e.started_at < p_to
      and e.started_at >= p_from - interval '1 day'
  ),
  win as (
    select ev.*, g as ws, g + interval '12 hours' as we
    from ev,
    lateral generate_series(
      (date_trunc('day', (ev.s at time zone 'Asia/Bangkok') - interval '8 hours') + interval '8 hours'
        + case when extract(hour from (ev.s at time zone 'Asia/Bangkok') - interval '8 hours') >= 12 then interval '12 hours' else interval '0' end)
        at time zone 'Asia/Bangkok',
      ev.e, interval '12 hours') g
    where ev.e > ev.s
  )
  select machine_tag,
         ((ws at time zone 'Asia/Bangkok') - interval '8 hours')::date as work_date,
         case when extract(hour from ws at time zone 'Asia/Bangkok') = 8 then 'day' else 'night' end as shift,
         state, reason_code, is_minor,
         round(sum(extract(epoch from least(e, we) - greatest(s, ws)))::numeric, 1) as sec,
         count(*) filter (where s >= ws and s < we)::int as n
  from win
  where least(e, we) > greatest(s, ws) and ws >= p_from - interval '12 hours' and ws < p_to
  group by 1, 2, 3, 4, 5, 6
  order by 2, 3, 1, 4, 5
$$;
revoke all on function public.fn_machine_shift_facts(uuid, timestamptz, timestamptz) from public;
grant execute on function public.fn_machine_shift_facts(uuid, timestamptz, timestamptz) to anon, authenticated;
