/* ══ 🏠 แจ้งหัวหน้าไลน์: พนักงานที่ยังไม่มีตำแหน่งประจำ (2026-11-19 · คำสั่ง user · project MAIN) ══
   กฎ (user เคาะ 19/11):
   · นับ = พนักงาน active ที่ "ยืนจุดงานจริง" ใน 30 วันล่าสุด (`daily_production_logs` is_present + assigned_line = id จุด)
     แต่ยังไม่มีแถวใน `employee_home_positions`
   · จัดกลุ่มตาม "ไลน์ของจุดที่ยืนล่าสุด" (`workstations.line_name`) — หัวหน้าไลน์นั้นคือคนตั้งตำแหน่งประจำที่ /management
   · ส่ง **สัปดาห์ละครั้ง** (จันทร์เช้า) · 1 ใบ/ไลน์/สัปดาห์ · ไม่มีคนค้าง = ไม่ส่ง
   · ผู้รับ = **leader** ของไลน์นั้น (แกนไลน์ `inapp_match_line` + แกนส่วนงาน + strict) — ในแอปเท่านั้น ไม่มี Telegram
   ส่งผ่าน `send-event-notification` (ผู้รับคิดใน `notify_recipients()` ที่เดียว)
   📄 docs/modules/manpower-board.md §ตำแหน่งประจำ
   ย้อนกลับ: ท้ายไฟล์                                                                                  */

-- 1) ทะเบียนกันส่งซ้ำในสัปดาห์เดียวกัน (เขียนโดยฟังก์ชัน security definer เท่านั้น · client ไม่แตะ)
create table if not exists public.home_position_alerts (
  scope_key  text        not null,
  week_key   text        not null,
  detail     jsonb,
  created_at timestamptz not null default now(),
  primary key (scope_key, week_key)
);
alter table public.home_position_alerts enable row level security;
revoke all on public.home_position_alerts from anon, authenticated;

-- 2) กฎผู้รับ (ในแอป · หัวหน้าไลน์)
insert into public.notification_rules
  (event_key, label, category, is_enabled, sort_order, channel_ids,
   inapp_roles, inapp_match_section, inapp_match_line, inapp_scope_strict,
   inapp_cast, link, can_mute, title_match)
values
  ('home_position_missing', '🏠 พนักงานยังไม่มีตำแหน่งประจำ (สรุปรายสัปดาห์)', 'manpower', true, 335, '{}',
   array['leader'], true, true, true,
   'always', '/management', true, '🏠 ยังไม่มีตำแหน่งประจำ%')
on conflict (event_key) do nothing;

-- 3) ตัวสแกน
create or replace function public.fn_home_position_scan(p_days int default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_week  text := to_char((now() at time zone 'Asia/Bangkok')::date, 'IYYY-"W"IW');
  v_sent  int  := 0;
  v_skip  int  := 0;
  v_noline int := 0;
  r       record;
  v_url   text := 'https://ewhdfqwfwofivojtsizn.supabase.co/functions/v1/send-event-notification';
begin
  -- คนที่ชี้ไลน์ไม่ได้ (จุดไม่มี line_name) = นับไว้รายงาน ห้ามเงียบ
  select count(*) into v_noline
  from (
    select distinct on (d.employee_id) d.employee_id, d.assigned_line
    from daily_production_logs d
    where d.work_date >= v_today - p_days and d.is_present and d.assigned_line ~ '^[0-9a-f-]{36}$'
    order by d.employee_id, d.work_date desc
  ) l
  join employees e on e.id = l.employee_id and e.is_active
  left join workstations w on w.id::text = l.assigned_line
  where w.line_name is null
    and not exists (select 1 from employee_home_positions h where h.employee_id = l.employee_id);

  for r in
    with last_st as (
      select distinct on (d.employee_id) d.employee_id, d.assigned_line, d.work_date
      from daily_production_logs d
      where d.work_date >= v_today - p_days and d.is_present and d.assigned_line ~ '^[0-9a-f-]{36}$'
      order by d.employee_id, d.work_date desc
    ), cand as (
      select l.employee_id, e.name, e.employee_id_code, w.line_name, w.station_name, l.work_date,
             row_number() over (partition by w.line_name order by e.name) as rn
      from last_st l
      join employees e on e.id = l.employee_id and e.is_active
      join workstations w on w.id::text = l.assigned_line
      where w.line_name is not null
        and not exists (select 1 from employee_home_positions h where h.employee_id = l.employee_id)
    )
    select line_name, count(*)::int as n,
           greatest(count(*)::int - 8, 0) as more,
           string_agg(case when rn <= 8 then '• ' || coalesce(name, '-') || ' (' || coalesce(employee_id_code, '-')
                           || ') — ล่าสุด ' || coalesce(station_name, '-') end, chr(10) order by rn) as body
    from cand
    group by line_name
    order by count(*) desc
  loop
    begin
      insert into home_position_alerts (scope_key, week_key, detail)
      values ('line:' || r.line_name, v_week, jsonb_build_object('people', r.n));
    exception when unique_violation then
      v_skip := v_skip + 1;
      continue;
    end;

    perform net.http_post(
      url     := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body    := jsonb_build_object(
        'event',     'home_position_missing',
        'title',     '🏠 ยังไม่มีตำแหน่งประจำ ' || r.n || ' คน — ' || r.line_name,
        'line_name', r.line_name,
        'type',      'info',
        'ref_table', 'employee_home_positions',
        'link',      '/management',
        -- ⚠️ สรุป + สิ่งที่ต้องทำไว้ก่อนลิสต์ (ในแอปตัด body ที่ 300 ตัวอักษร)
        'lines',     to_jsonb(array_remove(array[
                       r.n || ' คน ยืนจุดงานใน ' || p_days || ' วันล่าสุด แต่ยังไม่มีตำแหน่งประจำ',
                       '👉 ตั้งที่ จัดการไลน์ผลิต → กดจุดงาน → บันทึกตำแหน่งประจำ',
                       '',
                       r.body,
                       case when r.more > 0 then '+ อีก ' || r.more || ' คน' end
                     ], null)),
        'vars',      jsonb_build_object('people', r.n)
      )
    );
    v_sent := v_sent + 1;
  end loop;

  return jsonb_build_object('sent', v_sent, 'skipped_same_week', v_skip,
                            'no_line_people', v_noline, 'week', v_week, 'days', p_days);
end $fn$;

revoke execute on function public.fn_home_position_scan(int) from public, anon, authenticated;

-- 4) รอบเวลา: จันทร์ 07:45 เวลาไทย (00:45 UTC)
select cron.unschedule('home-position-missing-scan')
 where exists (select 1 from cron.job where jobname = 'home-position-missing-scan');
select cron.schedule('home-position-missing-scan', '45 0 * * 1', $$ select public.fn_home_position_scan(); $$);

/* ── ย้อนกลับ (MAIN) ──
   select cron.unschedule('home-position-missing-scan');
   drop function if exists public.fn_home_position_scan(int);
   delete from public.notification_rules where event_key = 'home_position_missing';
   drop table if exists public.home_position_alerts;
*/
