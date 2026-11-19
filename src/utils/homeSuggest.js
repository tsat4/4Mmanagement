/* ══ 🏠 เสนอตำแหน่งประจำอัตโนมัติ (2026-11-19 · คำสั่ง user) ══════════════════════════════════════
   กฎ (user เคาะ 19/11):
   · ยืนจุดเดียวกัน **20 วันทำงานติดกัน** ⇒ เสนอเป็นตำแหน่งประจำ (ระบบ "เสนอ" — คนกดรับเอง ห้ามเขียนให้อัตโนมัติ)
   · วันหยุด (ไม่มีแถว) · วันที่พนักงานไม่มา (`is_present=false` — คนอื่นยืนแทน) · วันที่มาแต่ไม่ได้ถูกวางจุด
     (ค้าง Pool/งานนอกไลน์ · `assigned_line` ว่าง) = **ข้าม ไม่นับ ไม่ตัดสตรีค**
   · วันที่ยืน "จุดอื่น" = ตัดสตรีค · วันเดียวมีหลายแถวและมีจุดอื่นปน = ตัดสตรีค (ไม่ได้ยืนจุดนี้ทั้งวัน)
   · เสนอเฉพาะคนที่ **ยังไม่มีตำแหน่งประจำเลย** (มีที่จุดอื่นแล้ว = ไม่เสนอย้าย · user เคาะ 19/11)
   ข้อมูล: `daily_production_logs` (Main) — `assigned_line` = id จุดงาน (ไม่ใช่ชื่อไลน์)
   ═══════════════════════════════════════════════════════════════════════════════════════════════ */

export const HOME_SUGGEST_DAYS = 20;

const isStationId = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** สตรีคล่าสุดของพนักงาน 1 คน
 *  @param {Array<{work_date:string, is_present:boolean, assigned_line:string|null}>} rows แถวของคนเดียว (ลำดับใดก็ได้)
 *  @returns {{ stationId: string|null, days: number }} จุดที่ยืนล่าสุด + จำนวนวันทำงานติดกันที่จุดนั้น */
export function homeStreak(rows) {
  const byDate = new Map();
  for (const r of rows || []) {
    if (!r || !r.is_present || !isStationId(r.assigned_line) || !r.work_date) continue;
    const k = String(r.work_date).slice(0, 10);
    if (!byDate.has(k)) byDate.set(k, new Set());
    byDate.get(k).add(r.assigned_line);
  }
  const dates = [...byDate.keys()].sort().reverse();
  if (!dates.length) return { stationId: null, days: 0 };
  const first = byDate.get(dates[0]);
  if (first.size !== 1) return { stationId: null, days: 0 };
  const stationId = [...first][0];
  let days = 0;
  for (const d of dates) {
    const s = byDate.get(d);
    if (s.size === 1 && s.has(stationId)) days += 1; else break;
  }
  return { stationId, days };
}

/** ควรเสนอให้ตั้ง `stationId` เป็นตำแหน่งประจำไหม
 *  @param {Array} rows แถว `daily_production_logs` ของคนเดียว
 *  @param {string} stationId จุดที่กำลังดู
 *  @param {string|undefined|null} currentHome ตำแหน่งประจำปัจจุบันของคนนี้ (ไม่มี = undefined/null)
 *  @returns {{ suggest: boolean, days: number }} */
export function homeSuggestion(rows, stationId, currentHome, threshold = HOME_SUGGEST_DAYS) {
  const s = homeStreak(rows);
  const same = s.stationId != null && String(s.stationId) === String(stationId);
  const days = same ? s.days : 0;
  return { suggest: !currentHome && same && days >= threshold, days };
}
