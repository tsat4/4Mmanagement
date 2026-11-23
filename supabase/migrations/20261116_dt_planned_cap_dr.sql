-- 🧾 เพดานของ "หยุดตามแผน" — project: DR ("Product DB" · eyhclzkifitbhbljgoav)
-- เหตุ (16/11 · คำสั่ง user): นาทีที่ตีเป็น planned ถูกตัดออกจากฐานเวลาทั้ง %A และ %P
--   ⇒ ยิ่งลงหยุดตามแผนเยอะ OEE ยิ่งสูง (incentive กลับทาง)
--   วัดจริง ก.ย.-พ.ย. 69: Set up Machine 733 ใบ p50=p75=p90 = 30 นาทีเป๊ะ แต่ max 345 นาที
-- กติกา: นาทีที่เกินเพดาน "ของใบนั้น" ไหลไปเป็น unplanned (หักจาก %A ตามจริง)
-- 🔴 null = ไม่มีเพดาน = พฤติกรรมเดิมเป๊ะ (ย้อนได้ด้วยการตั้งกลับเป็น null)
-- เจ้าของกฎฝั่งโค้ด: src/utils/oee.js `dtPlannedSplit()` · ตั้งค่าที่จอ /daily-report แท็บข้อมูลหลัก
alter table public.dr_downtime_types
  add column if not exists planned_cap_min integer;

alter table public.dr_downtime_types
  drop constraint if exists dr_downtime_types_planned_cap_min_check;
alter table public.dr_downtime_types
  add constraint dr_downtime_types_planned_cap_min_check
  check (planned_cap_min is null or (planned_cap_min >= 0 and planned_cap_min <= 1440));

comment on column public.dr_downtime_types.planned_cap_min is
  '🧾 เพดานนาทีต่อใบที่ยังถือว่า "หยุดตามแผน" · เกินกว่านี้นับเป็น unplanned (oee.js dtPlannedSplit) · null = ไม่มีเพดาน';

notify pgrst, 'reload schema';
