-- ══ 🤝 แยก Quality / Delivery ของ Customer (Internal) Satisfaction — MAIN · ewhdfqwfwofivojtsizn · 2026-11-16 ══
-- user: "customer sat ถ้าแยก Quality-Delivery ได้ ตอนกดเข้าไป รวมถึงตรงหน้าการกรอกข้อมูล"
--
-- 🔴 ทะเบียนกลางของกลุ่ม (`kpi_standard_items` ปี 2026) มีหัวข้อนี้เป็น **1 แถว 1 คะแนน**
--    `Customer Satisfaction (Q&D)` (10 หน่วยงาน) / `Internal Satisfaction` (หน่วยสนับสนุน)
--    สูตรเดียวกันทุกแถว: `(Actual Score / Total Score) x 100` · **ทะเบียนไม่มีข้อย่อย Q และ D**
--    ⇒ ตารางนี้ไม่ได้สร้าง KPI ใหม่ และ**ไม่แตะคะแนน/น้ำหนัก** — เก็บแค่ "ตัวตั้ง-ตัวหารของสูตรเดิม แยก 2 ขา"
--    ค่าที่ส่งกลุ่มยังอยู่ที่ `kpi_manual_entries.value` ตัวเดิม (ตารางนี้ไม่เคยเขียนทับ)
--    ค่ารวมของเดือนที่คำนวณได้ = (Σactual_score ÷ Σtotal_score) × 100  ← สูตรทางการเป๊ะ
--    🔴 ห้ามเฉลี่ย % ของ 2 ขา (ตัวหารไม่เท่ากัน) · ขาไม่ครบ = null ห้ามเดา 0
--
-- คีย์ = (kpi_id, month, part) เป็น **unique index คอลัมน์ล้วน** (กฎ db-write ข้อ 3: upsert ต้องใช้คีย์แบบนี้)
-- RLS: อ่าน = ทุกคนที่ login · เขียน = has_perm('kpi:manage') (คีย์เดียวกับช่องกรอก KPI บนจอ)
-- GRANT: ครบทุก cmd ที่ client ใช้ (RLS ผ่านแต่ GRANT ขาด = PostgREST ตอบ 401)
-- ⚠️ ยังไม่ apply ก็ใช้งานระบบได้เหมือนเดิม — จอโหลดตารางนี้แบบ tolerant (42P01 = ไม่มีการแยก Q/D เท่านั้น)
-- 📄 docs/modules/obeya-kpi-board.md §แยก Q/D · docs/OBEYA-KPI-SOURCES.md §16

create table if not exists public.kpi_customer_sat_parts (
  id           uuid primary key default gen_random_uuid(),
  kpi_id       uuid not null references public.kpi_definitions(id) on delete cascade,
  month        int  not null check (month between 1 and 12),
  part         text not null check (part in ('quality','delivery')),
  actual_score numeric check (actual_score is null or actual_score >= 0),
  total_score  numeric check (total_score  is null or total_score  >= 0),
  note         text,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- คีย์ของ upsert — คอลัมน์ล้วน ไม่มี expression/partial (42P10 = ไม่เขียนเลยทั้งก้อน)
create unique index if not exists uq_kpi_csat_parts on public.kpi_customer_sat_parts (kpi_id, month, part);
create index if not exists idx_kpi_csat_parts_kpi on public.kpi_customer_sat_parts (kpi_id);

alter table public.kpi_customer_sat_parts enable row level security;
do $$ begin
  create policy kpi_csat_parts_read on public.kpi_customer_sat_parts for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy kpi_csat_parts_write on public.kpi_customer_sat_parts for all
    using (has_perm('kpi:manage')) with check (has_perm('kpi:manage'));
exception when duplicate_object then null; end $$;

grant select, insert, update, delete on public.kpi_customer_sat_parts to authenticated;
grant select, insert, update, delete on public.kpi_customer_sat_parts to anon;

drop trigger if exists trg_kpi_csat_parts_updated on public.kpi_customer_sat_parts;
create trigger trg_kpi_csat_parts_updated before update on public.kpi_customer_sat_parts
  for each row execute function public.fn_set_updated_at();

-- ผูก audit (แก้ไขได้ ⇒ ต้องสืบได้ว่าใครกรอก/ลบ) — กติกาเดียวกับ kpi_month_notes
do $$ begin
  if exists (select 1 from pg_proc where proname='fn_audit') then
    drop trigger if exists trg_audit on public.kpi_customer_sat_parts;
    create trigger trg_audit after insert or update or delete on public.kpi_customer_sat_parts
      for each row execute function public.fn_audit();
  end if;
end $$;

comment on table public.kpi_customer_sat_parts is
  'คะแนนดิบรายขา (Quality / Delivery) ของ KPI Customer/Internal Satisfaction — ตัวตั้ง-ตัวหารของสูตร (Actual/Total)x100 ที่แยก 2 ขา · ค่ารวมที่ส่งกลุ่มยังอยู่ที่ kpi_manual_entries.value';

-- ── ตรวจผล (รันหลัง apply · Main "MAIN" ewhdfqwfwofivojtsizn) ────────────────────────────
-- 1) ตารางเกิดแล้วและคีย์ถูกชนิด:
--    select indexname, indexdef from pg_indexes where tablename='kpi_customer_sat_parts';
--    -- คาด: uq_kpi_csat_parts = UNIQUE (kpi_id, month, part) · idx_kpi_csat_parts_kpi
-- 2) RLS + policy ครบ:
--    select relrowsecurity from pg_class where relname='kpi_customer_sat_parts';          -- คาด true
--    select policyname, cmd from pg_policies where tablename='kpi_customer_sat_parts';    -- คาด read(SELECT) + write(ALL)
-- 3) GRANT ครบทุก cmd (RLS ผ่านแต่ GRANT ขาด = 401):
--    select grantee, string_agg(privilege_type,',' order by privilege_type)
--      from information_schema.role_table_grants
--     where table_schema='public' and table_name='kpi_customer_sat_parts'
--       and grantee in ('anon','authenticated') group by 1;
--    -- คาด: DELETE,INSERT,SELECT,UPDATE ทั้ง 2 role
-- 4) ยังไม่มีแถว (ตารางใหม่ ไม่ backfill อะไรเลย):
--    select count(*) from public.kpi_customer_sat_parts;                                  -- คาด 0
--
-- ── rollback (ปลอดภัย: revert โค้ดก่อนก็ได้ จอ tolerant อยู่แล้ว) ───────────────────────
-- drop table if exists public.kpi_customer_sat_parts;
