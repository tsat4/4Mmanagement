-- DR ("Product DB" · eyhclzkifitbhbljgoav) · 2026-11-18 · คำสั่ง user "สร้างระบบ template ให้ user สร้าง template ของงานประจำที่เป็น routine"
-- template ใบเบิก/คืน FM-STO-003 — หัวใบที่ใช้ซ้ำ + รายการ (jsonb) · กดสร้างใบใหม่จาก template = เติมให้ แล้วแก้ต่อได้
-- อยู่ DR คู่กับ material_requests (ตาราง DR = anon ⇒ RLS แบบ public เหมือนตารางแม่ · ห้ามเปลี่ยนเป็น TO authenticated)
-- สิทธิ์คุมที่ UI ด้วยคีย์เดิม scrap:record (สร้าง/ใช้) · scrap:manage (ลบของคนอื่น) — เหมือน material_requests
-- ลบ = is_active false (เก็บประวัติ) · rollback: drop table public.material_request_templates;
create table if not exists public.material_request_templates (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  kind                  text not null default 'withdraw' check (kind in ('withdraw','return')),
  move_code             text,
  requester_dept        text,
  dest_storage_location text,
  order_no              text,
  cost_center           text,
  plant_code            text,
  storage_location      text,
  detail                text,
  line_name             text,
  items                 jsonb not null default '[]'::jsonb,   -- [{mat_no, description, qty, unit}]
  is_active             boolean not null default true,
  created_by_name       text,
  updated_by_name       text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists material_req_tpl_active_idx on public.material_request_templates (is_active, name);
alter table public.material_request_templates enable row level security;
drop policy if exists material_req_tpl_all on public.material_request_templates;
create policy material_req_tpl_all on public.material_request_templates for all using (true) with check (true);
grant select, insert, update, delete on public.material_request_templates to anon, authenticated;
