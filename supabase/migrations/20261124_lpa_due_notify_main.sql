/* ═══════════════════════════════════════════════════════════════════════════
   🔔 แจ้งเตือน LPA — "ถึงกำหนดตรวจ / เลยกำหนด / ยังไม่มีแผน"      2026-11-24
   project: MAIN (ewhdfqwfwofivojtsizn — ชื่อในจอ Supabase = "MAIN")

   คำสั่ง user 23/11: *"ตอนี้ ต้องไล่แจ้ง / แจ้งเตือนอนุมัติเอกสารพวกนี้ด้วยนะ
                        ตอนนี้เรายังแทบไม่ได้ตรวจ lpa หรือเซ็นอนุมัติอะไรเลย"*

   ── ทำไมเรื่องนี้ (วัดจริงฝั่ง Main ก่อนเขียน 24/11) ──────────────────────────
   แผนเดือน 2026-11 · นับเฉพาะวันทำงานที่ผ่านมาแล้ว:
     ชั้น leader      ตรวจ 203/306  → **ขาด 103**
     ชั้น supervisor  ตรวจ  40/63   → ขาด 23
     ชั้น manager     ตรวจ   0/15   → **ขาด 15 (ยังไม่เคยตรวจเลยทั้งเดือน)**
   และ **ไลน์ราก 8 ไลน์ยังไม่มีแผน LPA เดือนนี้เลย** (PD1 ทั้งส่วนงาน 5 ไลน์ ·
     PD2 2 ไลน์ · PD3 1 ไลน์) ⇒ ไม่มีแผน = ไม่มีอะไรบอกว่าขาดตรวจด้วยซ้ำ
   ทะเบียน `notification_rules` เดิมมีแต่ `lpa_finding` (พบข้อบกพร่อง **หลัง**ตรวจ)
   — **ไม่มีกฎไหนเตือนว่า "ถึงเวลาตรวจ" หรือ "ขาดตรวจ"** ⇒ ของจริงคือเงียบสนิท

   ── 🔴 ทำไมไม่ยิงรายใบ / ไม่ยิงตาม role เฉยๆ (บทเรียน notify-inapp-audit.md) ──
   กระดิ่งทั้งระบบอ่านแค่ 6-7% เพราะ fan-out กว้าง ⇒ ที่นี่ยึด 3 ข้อ:
     1. **1 ไลน์ + 1 กลุ่มชั้น = 1 ข้อความ** (ไม่ใช่ 1 วันที่ขาด = 1 ข้อความ)
     2. **กรองขอบเขตทั้งส่วนงาน + ไลน์** (`inapp_match_section` + `inapp_match_line`)
        วัดผู้รับจริง/ไลน์: leader 2-6 คน · supervisor 0-8 · manager 4 — ไม่ใช่ทั้งโรงงาน
     3. **`inapp_rollup_min = 1440`** ⇒ คนหนึ่งได้ "เรื่องนี้" ไม่เกินวันละ 1 ใบ
   ตัวที่ "เลยกำหนด" + "ยังไม่มีแผน" = **คิวที่รอคนลงมือ ⇒ `can_mute = false`**
   (กฎ CLAUDE.md §Edge Functions) · ตัวเตือนรายวันปิดได้ (`can_mute = true`)

   ── ทำไมเป็น SQL function + pg_cron ไม่ใช่ edge function ใหม่ ────────────────
   ตาราง lpa_* อยู่ Main และ `send-event-notification` ก็อยู่ Main ⇒ ไม่ต้องมีตัวใหม่
   ยิงผ่าน `net.http_post` → `send-event-notification` เหมือน `fn_home_position_scan`
   🔴 **ผู้รับคิดที่ `notify_recipients()` จุดเดียวตามกฎเหล็ก — ไฟล์นี้ไม่กรองผู้รับเอง**
   (ที่เรียก RPC ในไฟล์นี้ = **นับเพื่อรายงานว่าข้อความไหนไม่ถึงใคร** ไม่ได้ใช้ตัดสินผู้รับ)

   ── กติกาที่ล็อกไว้ในฟังก์ชัน ───────────────────────────────────────────────
   · **"วันนี้" = วันทำงาน (`getWorkDate`)** = `(BKK now - 8 ชม.)::date` — กะดึกข้ามวัน
     ⇒ cron 2 รอบ: 14:00 ไทย = กะเช้า · 05:00 ไทย = กะดึกของวันทำงานที่เพิ่งจบ
   · **วันทำงาน** = `company_calendar.day_type='working'` **หรือ** ไม่มีแถว+จ-ศ
     (กฎเดียวกับ kanban/LPA) ⇒ วันหยุด/ot15/ot2/shutdown75 **ไม่นับว่าขาดตรวจ**
   · **ขาดตรวจนับแค่เดือนปัจจุบัน** — ใบ LPA เป็นฟอร์มรายเดือน เดือนที่ปิดแล้วไม่ไล่ย้อน
   · **ไลน์ที่ยังไม่มีแผน นับเฉพาะ "ไลน์ราก"** (`parent_line_name is null`) ที่ยัง active
     และไม่ใช่ support — ไลน์ลูกที่ไม่มีแผนของตัวเอง **ถือว่าแผนของไลน์แม่ครอบแล้ว**
     (ของจริง: D2/D3/D5/D6 · HDF/LASER/BENDING ใต้ HYDROFORM ⇒ ถ้านับไลน์ลูกจะเตือนผิด 11 ไลน์)
   · 🔴 **ห้ามใส่ `exception when others then return null`** — อ่านฐานไม่ได้ต้องให้ cron
     บันทึกว่าล้ม ไม่ใช่เงียบแล้วตอบ ok (กฎ "ห้ามล้มเหลวเงียบ")
   · ตัวเตือนรายสัปดาห์ยิงวันจันทร์ (`isodow = 1`) — `p_force := true` เพื่อทดสอบ/ยิงมือ

   ── ย้อนกลับ (rollback) ─────────────────────────────────────────────────────
     select cron.unschedule('lpa-due-scan-day');
     select cron.unschedule('lpa-due-scan-night');
     drop function if exists public.fn_lpa_due_scan(text, boolean, boolean);
     delete from notification_rules where event_key in
       ('lpa_due_leader','lpa_due_mgmt','lpa_overdue_leader','lpa_overdue_mgmt','lpa_no_plan');
   ═══════════════════════════════════════════════════════════════════════════ */

-- ───────────────────────────── 1) ทะเบียนกฎ 5 แถว ─────────────────────────────
insert into notification_rules
  (event_key, label, category, is_enabled, sort_order,
   inapp_roles, inapp_match_section, inapp_match_line, can_mute, inapp_rollup_min, link)
values
  ('lpa_due_leader',
   '📋 LPA ชั้น Leader ถึงกำหนดตรวจวันนี้ — ยังไม่บันทึกผล',
   'quality', true, 30,
   array['leader']::text[], true, true, true, 1440, '/lpa'),

  ('lpa_due_mgmt',
   '📋 LPA ชั้น SV / ผจก. / GM ถึงกำหนดตรวจวันนี้ — ยังไม่บันทึกผล',
   'quality', true, 31,
   array['supervisor','engineer','manager']::text[], true, true, true, 1440, '/lpa'),

  ('lpa_overdue_leader',
   '🔴 LPA ชั้น Leader เลยกำหนด — เดือนนี้ตรวจไม่ครบ (เตือนทุกจันทร์)',
   'quality', true, 32,
   array['leader','supervisor']::text[], true, true, false, 1440, '/lpa?sub=report'),

  ('lpa_overdue_mgmt',
   '🔴 LPA ชั้น SV / ผจก. / GM เลยกำหนด — เดือนนี้ตรวจไม่ครบ (เตือนทุกจันทร์)',
   'quality', true, 33,
   array['supervisor','engineer','manager']::text[], true, true, false, 1440, '/lpa?sub=report'),

  ('lpa_no_plan',
   '🗓️ ไลน์ที่ยังไม่มีแผน LPA ของเดือนนี้ (เตือนทุกจันทร์)',
   'quality', true, 34,
   array['supervisor','manager']::text[], true, false, false, 1440, '/lpa?sub=plan')
on conflict (event_key) do nothing;

-- ─────────────────────────── 2) ตัวสแกน + ตัวส่ง ───────────────────────────
create or replace function public.fn_lpa_due_scan(
  p_shift text default 'day',
  p_force boolean default false,
  p_dry   boolean default false      -- true = นับอย่างเดียว ไม่ยิงจริง (ใช้ตรวจก่อนเปิด cron)
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  /* 🔴 วันทำงาน (getWorkDate) — ก่อน 08:00 ไทย = วันก่อนหน้า (กะดึกข้ามวัน)
     ห้ามใช้ current_date (= UTC) และห้ามใช้ (now() at time zone 'Asia/Bangkok')::date เปล่าๆ */
  v_wd      date := ((now() at time zone 'Asia/Bangkok') - interval '8 hours')::date;
  v_month   text;
  v_weekly  boolean;
  v_url     text := 'https://ewhdfqwfwofivojtsizn.supabase.co/functions/v1/send-event-notification';
  v_shift   text := case when lower(coalesce(p_shift,'day')) = 'night' then 'night' else 'day' end;
  v_shift_th text;
  r         record;
  v_due     int := 0;
  v_over    int := 0;
  v_noplan  int := 0;
  v_norecv  int := 0;
  v_n       int;
begin
  v_month    := to_char(v_wd, 'YYYY-MM');
  v_weekly   := p_force or extract(isodow from v_wd) = 1;
  v_shift_th := case when v_shift = 'night' then 'กะดึก' else 'กะเช้า' end;

  /* วันที่วางแผนไว้ (เฉพาะกะที่สแกน · เฉพาะวันทำงาน) แตกเป็นรายชั้น
     แล้วหักวันที่มีใบตรวจแล้วออก = "ขาดตรวจ" */
  /* เรียกซ้ำใน transaction เดียว (ทดสอบมือ 2 บรรทัดติดกัน) ต้องไม่ล้มเพราะตารางค้าง */
  drop table if exists _lpa_miss;
  create temp table _lpa_miss on commit drop as
  with d as (
    select p.line_name, p.shift,
           make_date(split_part(p.month_key, '-', 1)::int,
                     split_part(p.month_key, '-', 2)::int, pd.day) as dt,
           pd.plan_leader, pd.plan_supervisor, pd.plan_manager, pd.plan_gm
      from lpa_plans p
      join lpa_plan_days pd on pd.plan_id = p.id
     where p.month_key = v_month
       and p.shift = v_shift
  ), flat as (
    select line_name, shift, dt, layer, planned from (
      select line_name, shift, dt, 'leader'::text     as layer, plan_leader     as planned from d
      union all select line_name, shift, dt, 'supervisor', plan_supervisor from d
      union all select line_name, shift, dt, 'manager',    plan_manager    from d
      union all select line_name, shift, dt, 'gm',         plan_gm         from d
    ) x
   where x.planned is true
  ), workdays as (
    select f.*
      from flat f
      left join company_calendar cc on cc.work_date = f.dt
     where f.dt <= v_wd
       /* 🔴 วันหยุด/ot15/ot2/shutdown75 ไม่นับว่าขาดตรวจ — ไม่มีแถวในปฏิทิน = จ-ศ ทำงาน */
       and (cc.day_type = 'working'
            or (cc.work_date is null and extract(isodow from f.dt) between 1 and 5))
  )
  select w.line_name, w.shift, w.dt, w.layer,
         (w.layer = 'leader') as is_leader
    from workdays w
    left join lpa_audits a
      on  a.line_name  = w.line_name
      and a.shift      = w.shift
      and a.audit_date = w.dt
      and a.layer      = w.layer
   where a.id is null;

  /* ── ① ถึงกำหนดวันนี้ ยังไม่บันทึก — ทุกวัน · 1 ไลน์ + 1 กลุ่มชั้น = 1 ข้อความ ── */
  for r in
    select m.line_name, m.is_leader,
           string_agg(distinct m.layer, ', ' order by m.layer) as layers,
           count(*)::int as n
      from _lpa_miss m
     where m.dt = v_wd
     group by m.line_name, m.is_leader
     order by m.line_name
  loop
    select count(*) into v_n
      from notify_recipients(
             case when r.is_leader then 'lpa_due_leader' else 'lpa_due_mgmt' end,
             (select pl.section from production_lines pl where pl.name = r.line_name),
             null, r.line_name);
    if coalesce(v_n, 0) = 0 then v_norecv := v_norecv + 1; end if;

    if not p_dry then
    perform net.http_post(
      url     := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body    := jsonb_build_object(
        'event',     case when r.is_leader then 'lpa_due_leader' else 'lpa_due_mgmt' end,
        'title',     '📋 LPA ถึงกำหนดตรวจวันนี้ — ' || r.line_name || ' (' || v_shift_th || ')',
        'line_name', r.line_name,
        'type',      'info',
        'ref_table', 'lpa_audits',
        'link',      '/lpa',
        'lines',     to_jsonb(array[
                       'วันทำงาน ' || to_char(v_wd, 'DD/MM/YYYY') || ' · ' || v_shift_th
                         || ' · ชั้น ' || r.layers || ' ยังไม่มีใบตรวจ',
                       '👉 บันทึกที่ Layer Process Audit → แท็บ ✅ บันทึกผลตรวจ'
                     ]),
        'vars',      jsonb_build_object('count', r.n)
      ));
    end if;
    v_due := v_due + 1;
  end loop;

  /* ── ② เลยกำหนด (วันก่อนหน้าในเดือนนี้) — เตือนทุกจันทร์ ── */
  if v_weekly then
    for r in
      select m.line_name, m.is_leader,
             count(*)::int as n,
             min(m.dt) as first_dt,
             string_agg(distinct m.layer, ', ' order by m.layer) as layers,
             string_agg(to_char(m.dt, 'DD/MM'), ', ' order by m.dt) as days
        from _lpa_miss m
       where m.dt < v_wd
       group by m.line_name, m.is_leader
       order by count(*) desc
    loop
      select count(*) into v_n
        from notify_recipients(
               case when r.is_leader then 'lpa_overdue_leader' else 'lpa_overdue_mgmt' end,
               (select pl.section from production_lines pl where pl.name = r.line_name),
               null, r.line_name);
      if coalesce(v_n, 0) = 0 then v_norecv := v_norecv + 1; end if;

      if not p_dry then
      perform net.http_post(
        url     := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body    := jsonb_build_object(
          'event',     case when r.is_leader then 'lpa_overdue_leader' else 'lpa_overdue_mgmt' end,
          'title',     '🔴 LPA เลยกำหนด ' || r.n || ' วัน — ' || r.line_name || ' (' || v_shift_th || ')',
          'line_name', r.line_name,
          'type',      'warning',
          'ref_table', 'lpa_audits',
          'link',      '/lpa?sub=report',
          'lines',     to_jsonb(array_remove(array[
                         'เดือน ' || v_month || ' · ' || v_shift_th || ' · ชั้น ' || r.layers
                           || ' — วางแผนไว้แต่ยังไม่มีใบตรวจ ' || r.n || ' วัน',
                         'ค้างมาตั้งแต่ ' || to_char(r.first_dt, 'DD/MM/YYYY'),
                         case when length(r.days) <= 180 then 'วันที่ขาด: ' || r.days end,
                         '👉 ดูช่องว่างทั้งเดือนที่ Layer Process Audit → แท็บ 📊 รายงาน'
                       ], null)),
          'vars',      jsonb_build_object('count', r.n)
        ));
      end if;
      v_over := v_over + 1;
    end loop;
  end if;

  /* ── ③ ไลน์รากที่ยังไม่มีแผน LPA เดือนนี้ — เตือนทุกจันทร์ · 1 ส่วนงาน = 1 ข้อความ
        (ยิงรอบกะเช้าเท่านั้น — แผนไม่ได้แยกตามกะที่สแกน จะยิง 2 รอบก็ซ้ำเปล่าๆ) ── */
  if v_weekly and v_shift = 'day' then
    for r in
      select pl.section,
             count(*)::int as n,
             string_agg(pl.name, ' · ' order by pl.name) as names
        from production_lines pl
       where coalesce(pl.unit_kind, 'production') <> 'support'
         and pl.is_active
         and pl.parent_line_name is null          -- 🔴 ไลน์ลูก = แผนของไลน์แม่ครอบแล้ว
         and nullif(trim(pl.section), '') is not null
         and not exists (select 1 from lpa_plans p
                          where p.line_name = pl.name and p.month_key = v_month)
       group by pl.section
       order by count(*) desc
    loop
      select count(*) into v_n from notify_recipients('lpa_no_plan', r.section, null, null);
      if coalesce(v_n, 0) = 0 then v_norecv := v_norecv + 1; end if;

      if not p_dry then
      perform net.http_post(
        url     := v_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body    := jsonb_build_object(
          'event',     'lpa_no_plan',
          'title',     '🗓️ ยังไม่มีแผน LPA เดือน ' || v_month || ' — ' || r.section || ' ' || r.n || ' ไลน์',
          'section',   r.section,
          'type',      'warning',
          'ref_table', 'lpa_plans',
          'link',      '/lpa?sub=plan',
          'lines',     to_jsonb(array[
                         'ไม่มีแผนตรวจ = ไม่มีอะไรบอกได้ว่าขาดตรวจกี่วัน',
                         r.names,
                         '👉 วางแผนที่ Layer Process Audit → แท็บ 📅 แผนตรวจ → ⚡ เติมแผนทั้งไตรมาส'
                       ]),
          'vars',      jsonb_build_object('count', r.n)
        ));
      end if;
      v_noplan := v_noplan + 1;
    end loop;
  end if;

  return jsonb_build_object(
    'work_date', v_wd, 'month', v_month, 'shift', v_shift, 'weekly', v_weekly,
    'dry_run', p_dry,
    'due_today_msgs', v_due, 'overdue_msgs', v_over, 'no_plan_msgs', v_noplan,
    /* 🔴 ความซื่อสัตย์: ข้อความที่ส่งแล้วไม่ถึงใคร (ทะเบียนผู้ใช้ไม่มีคนในขอบเขตนั้น)
       ต้องรายงานออกมา ห้ามนับเป็นสำเร็จเงียบๆ */
    'msgs_with_no_recipient', v_norecv);
end $fn$;

comment on function public.fn_lpa_due_scan(text, boolean, boolean) is
  'สแกน LPA: ถึงกำหนดวันนี้ / เลยกำหนด (จันทร์) / ไลน์รากที่ยังไม่มีแผน (จันทร์) แล้วยิง send-event-notification · ผู้รับคิดที่ notify_recipients จุดเดียว';

-- ───────────────────────────── 3) cron 2 รอบ ─────────────────────────────
-- 07:00 UTC = 14:00 ไทย → วันทำงานของกะเช้า (ยังเหลือเวลาไปตรวจก่อนเลิกกะ 17:30)
select cron.schedule('lpa-due-scan-day',   '0 7 * * *',  $$select public.fn_lpa_due_scan('day');$$);
-- 22:00 UTC = 05:00 ไทย → ยังอยู่ในวันทำงานเดิมของกะดึก (ก่อน 08:00 = วันก่อนหน้า)
select cron.schedule('lpa-due-scan-night', '0 22 * * *', $$select public.fn_lpa_due_scan('night');$$);
