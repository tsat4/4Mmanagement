/* ═══ ⏱️ line_part_last_move() — "บัญชีของคู่ไลน์+พาร์ทนี้ขยับล่าสุดเมื่อไหร่" (DR) ════
 *
 * ทำไมต้องมี (วัดจริง 16/11 ตอนต่อฟีเจอร์ "ของถึง min → ส่งความต้องการ"):
 *   41 คู่ที่ตั้ง min ไว้ → เข้าเกณฑ์ "ติด min" 32 คู่
 *   🔴 แต่ **ทั้ง 32 คู่คงเหลือ 0 เป๊ะ ไม่มีสักคู่ที่มีของเหลือบางส่วน**
 *   🔴 บัญชีขยับล่าสุด 30/10 (17 วันก่อน) · 7 คู่ **ไม่เคยขยับเลย** · ไม่มีคู่ไหนขยับใน 3 วัน
 *   ⇒ "0" คือ **"ไม่ได้นับ" ไม่ใช่ "ของหมด"** (backflush หน้าไลน์ยังไม่ทำงานจริง)
 *   ปล่อยผ่าน = จอขึ้น "ติด min 32 ตัว" ที่ผิดทั้ง 32 ตัว แล้วหน้างานเลิกเชื่อทั้งจอ
 *
 * ⇒ `minAlerts()` (`src/utils/replenish.js`) ต้องรู้เวลาขยับล่าสุดเพื่อตัดสินว่าเชื่อเลขได้ไหม
 *   **ทำไมเป็น RPC ไม่ใช่คิวรีตรง:** นับเองต้องดึงแถวดิบ ซึ่งพาร์ทเดียวมีหลักพันแถว
 *   (20058498 มี 2,847 แถว) — egress คิดเป็นไบต์ (กฎเหล็ก DB ข้อ 11)
 *
 * · `stable` + อ่านอย่างเดียว · ไม่ใช่ security definer (ฝั่ง DR วิ่งด้วย anon เหมือนทุกตัว)
 * ↩️ rollback: drop function if exists public.line_part_last_move(text[]);
 *    (จอถอยไปไม่ตรวจความสด = พฤติกรรมก่อนหน้า ไม่มีข้อมูลเสียหาย)
 *
 * 📄 docs/modules/kanban-auto-calc.md §ของถึง min
 * ═══════════════════════════════════════════════════════════════════════════════ */

create or replace function public.line_part_last_move(p_mats text[])
returns table (line_name text, mat_no text, last_at timestamptz, moves bigint)
language sql stable as $fn$
  select t.line_name, t.mat_no, max(t.created_at) as last_at, count(*) as moves
    from public.line_stock_transactions t
   where t.mat_no = any(p_mats)
   group by t.line_name, t.mat_no
$fn$;
