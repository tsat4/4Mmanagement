-- ══ ↩️ "ใครกดส่งใหม่ใบนี้" — ใบที่ถูกตีกลับแล้วส่งกลับเข้าคิว  ·  2026-11-18 ══
-- Project: DR (ชื่อในจอ Supabase = "Product DB" · eyhclzkifitbhbljgoav)
--
-- ── ที่มา ────────────────────────────────────────────────────────────────────────
-- หน้างานแจ้ง 18/11 15:38: *"ใบ MO ไม่ได้มีคนเปิด แต่เด้งไปหาช่างเองครับ"*
-- ตรวจแล้วพบว่าใบ 4 ใบนั้น **สร้างไว้ 09–14/11** แต่ `report_at` ถูกรีเซ็ตเป็น 18/11 15:16–15:18
-- ลายนิ้วมือตรงกับ `resubmit()` (ตีกลับ → ส่งใหม่): status=pending · current_step=1 ·
-- bounce_count +1 · returned_at/reject_reason ถูกล้าง · report_at = ตอนนี้
-- ⇒ ใบไม่ได้เกิดเอง มีคนกดส่งใหม่ **แต่ระบบไม่เคยเก็บว่าใครกด** จึงตอบคำถามหน้างานไม่ได้
--
-- ── 🔴 กฎ ────────────────────────────────────────────────────────────────────────
-- 🔴 คอลัมน์เพิ่มล้วน nullable ไม่มี default ⇒ **ของเก่าทั้งหมดยังเป็น null = "ไม่รู้ว่าใคร"**
--    ห้าม backfill เดาจาก reported_by (คนแจ้งครั้งแรก ≠ คนกดส่งใหม่)
-- 🔴 ห้ามเอาไปแทน `report_at` — `report_at` ยังเป็นนาฬิกา KPI ของทีมที่เพิ่งถูกส่งให้ (ตามดีไซน์เดิม)
--    ช่องใหม่นี้ตอบแค่ "ใคร/เมื่อไหร่กดส่งใหม่"
--
-- ย้อนกลับ: alter table public.mtn_orders drop column if exists resubmitted_by, drop column if exists resubmitted_at;

alter table public.mtn_orders
  add column if not exists resubmitted_by text,
  add column if not exists resubmitted_at timestamptz;

comment on column public.mtn_orders.resubmitted_by is
  'ชื่อคนที่กด "ส่งใหม่" หลังใบถูกตีกลับ (18/11) — null = ใบเก่าก่อนมีช่องนี้ ห้ามเดา';
comment on column public.mtn_orders.resubmitted_at is
  'เวลาที่กดส่งใหม่ครั้งล่าสุด — คนละตัวกับ report_at ที่เป็นนาฬิกา KPI ของทีมปลายทาง';
