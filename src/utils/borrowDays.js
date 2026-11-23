/* ══ 🤝 borrowDays — "คนของไลน์เราถูกยืมออกไปกี่วัน" (pure · 2026-11-16) ═══════════════════
 *
 * ที่มา (หน้างานบ่น 16/11): *"ยืมตัวพนักงาน ยืมแล้วไม่ยอมคืน เจ้าของจะมองไม่เห็นรึป่าว"*
 *
 * ของเดิมตอบได้แค่ **"วันนี้กะนี้"** — `line_helpers` ผูก `work_date` + `shift` ⇒ หมดกะหลุดเอง
 * (ดู `src/utils/lineHelpers.js`) และจอเช็คชื่อติดป้าย `→ ไปช่วยไลน์ X (กะนี้)` ให้เจ้าของเห็นอยู่แล้ว
 * ⇒ **ไม่มี "การค้างข้ามวัน" เชิงโครงสร้างให้แก้** · สิ่งที่หน้างานเห็นคือ **การยืมซ้ำทุกวันจนเหมือนไม่คืน**
 * วัดจริง 60 วัน (Main · 16/11): 123 แถว · 36 คน — เช่น 9 คนถูกยืมเข้า `LINE APRON ASSY`
 * 5–9 วัน ภายในช่วง 2–5 สัปดาห์ (ธันยบูรณ์ แผนเสือ 9 วัน/ช่วง 32 วัน)
 * ⇒ สิ่งที่ขาดคือ **มุมมองสะสม** ไม่ใช่กลไกคืนของ
 *
 * 🔴 กฎของไฟล์นี้:
 *   1. **"ถูกยืมออก" ตัดสินจากไลน์บ้านของคนคนนั้น ไม่ใช่จากไลน์ที่คนดูจออยู่** — ยืมข้าม
 *      ไลน์แม่↔ไลน์ลูก (ครอบครัวเดียวกัน) **ไม่นับว่าออก** (พื้นที่เดียวกัน · นับว่าออกจะกลายเป็น
 *      ตัวเลขปลอมของทุกไลน์ที่มีลูก) ⇒ ผู้เรียกส่ง `familyOf(lineId)` มาจาก `getLineFamilyIds`
 *   2. **1 วัน = 1 วัน ไม่ว่าถูกยืมกี่กะ** (`days` = จำนวน `work_date` ที่ไม่ซ้ำ) · กะนับแยกใน `shifts`
 *      — "ถูกยืมไป 9 วัน" ต้องหมายถึง 9 วันจริง ไม่ใช่ 9 แถว
 *   3. **ไม่รู้ไลน์บ้าน = ไม่นับ แต่ต้องนับจำนวนขึ้นจอ** (`unknownHome`) — เงียบ = ตัวเลขรวมโกหก
 *   4. **ไม่มีเกณฑ์สี/ธง "ยืมเยอะ" ในไฟล์นี้** — เกณฑ์ที่ไม่มีที่มา = ตัวเลขที่เถียงกันไม่จบ
 *      (จอเรียงมาก→น้อยแล้วให้คนตัดสินเอง · จะมีเกณฑ์ต้องให้ user เคาะก่อน)
 *   5. `now` เป็นพารามิเตอร์เสมอ (กฎ build: `npm test` รันรอบ "นาฬิกา +400 วัน")
 */

import { getWorkDate, addDaysStr } from './workDate.js';

/** ช่วงเริ่มต้นของมุมมองสะสม — 30 วันทำงานย้อนหลัง "นับรวมวันนี้" (จอต้องเขียนช่วงนี้ให้เห็น) */
export const BORROW_WINDOW_DAYS = 30;

/**
 * ช่วงวันของมุมมองสะสม — `to` = **วันทำงาน** วันนี้ (ก่อน 08:00 = วันก่อนหน้า · `getWorkDate`)
 * @param {number} days จำนวนวันรวมวันนี้ (ต่ำสุด 1)
 * @param {Date}   now  เวลาอ้างอิง (เทสตรึงค่าได้)
 * @returns {{ from:string, to:string, days:number }} · แกะวันไม่ออก = `from` เป็น `null` (ห้ามเดา)
 */
export function borrowWindow(days = BORROW_WINDOW_DAYS, now = new Date()) {
  const n = Math.max(1, Math.floor(Number(days) || 0) || 1);
  const to = getWorkDate(now);
  return { from: addDaysStr(to, -(n - 1)), to, days: n };
}

/** จำนวนวันที่คาบ (inclusive) ระหว่าง 2 วันที่ — แกะไม่ออก = `null` */
export function spanDays(from, to) {
  /* UTC ล้วน (หลักเดียวกับ `addDaysStr`) — ห้ามพึ่ง timezone เครื่อง */
  const ms = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').slice(0, 10));
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
  };
  const a = ms(from), b = ms(to);
  if (a == null || b == null) return null;
  return Math.abs(Math.round((b - a) / 86400000)) + 1;
}

const toSet = (v) => (v instanceof Set ? v : new Set(Array.isArray(v) ? v : (v ? [v] : [])));
const sameLine = (a, b) => a != null && b != null && Number(a) === Number(b);

/**
 * สรุป "คนของเราถูกยืมออกไปไลน์อื่นกี่วัน" จากแถว `line_helpers` ของช่วงที่เลือก
 *
 * @param {Array} rows แถว `line_helpers` — ต้องมี `employee_id`, `to_line_id`, `work_date`
 *                     (`shift`, `emp_name`, `to_line_name` ใช้ได้ถ้ามี)
 * @param {Object} opts — **ฉีดเข้ามาทั้งหมดเพื่อให้ไฟล์นี้ pure** (ไม่แตะ DB/ทะเบียน)
 *   - `homeLineOf(employeeId)` → line id บ้านของคนนั้น · `null/undefined` = ไม่รู้ (ไม่นับ)
 *   - `familyOf(lineId)`       → Set|Array ครอบครัวไลน์ (ยืมภายในครอบครัว = ไม่นับว่าออก)
 *   - `nameOf(employeeId)`     → ชื่อคน (ไม่มี = ใช้ `emp_name` ในแถว แล้วค่อย `#id`)
 *   - `lineNameOf(lineId)`     → ชื่อไลน์ปลายทาง (ไม่มี = ใช้ `to_line_name` ในแถว)
 *   - `mine(employeeId)`       → `true` = คนของเรา (ไม่ส่ง = นับทุกคนในแถว)
 * @returns {{ people:Array, totalDays:number, unknownHome:number, insideFamily:number, skipped:number }}
 *   `people` เรียง **วันมาก→น้อย** แล้วค่อยช่วงกว้าง→แคบ · แต่ละคน:
 *   `{ id, name, homeLineId, homeLineName, days, shifts, dates, span, firstDate, lastDate, toLines }`
 */
export function summarizeBorrowOut(rows, opts = {}) {
  const { homeLineOf, familyOf, nameOf, lineNameOf, mine } = opts;
  const by = new Map();
  let unknownHome = 0, insideFamily = 0, skipped = 0;

  for (const r of (Array.isArray(rows) ? rows : [])) {
    const empId = r?.employee_id;
    const day = String(r?.work_date || '').slice(0, 10);
    if (empId == null || !day) { skipped += 1; continue; }
    if (mine && !mine(empId)) { skipped += 1; continue; }

    const home = homeLineOf ? homeLineOf(empId) : null;
    if (home == null || home === '') { unknownHome += 1; continue; }
    if (sameLine(home, r.to_line_id)) { insideFamily += 1; continue; }
    const fam = toSet(familyOf ? familyOf(home) : null);
    if (fam.size && (fam.has(r.to_line_id) || fam.has(Number(r.to_line_id)))) { insideFamily += 1; continue; }

    let p = by.get(empId);
    if (!p) {
      p = {
        id: empId,
        name: (nameOf && nameOf(empId)) || r.emp_name || `#${empId}`,
        homeLineId: home,
        homeLineName: (lineNameOf && lineNameOf(home)) || '',
        dates: new Set(), shifts: 0, toLines: new Map(),
      };
      by.set(empId, p);
    }
    p.dates.add(day);
    p.shifts += 1;
    const lid = r.to_line_id;
    const lname = (lineNameOf && lineNameOf(lid)) || r.to_line_name || 'ไลน์อื่น';
    const t = p.toLines.get(lname) || { id: lid, name: lname, dates: new Set() };
    t.dates.add(day);
    p.toLines.set(lname, t);
  }

  const people = [...by.values()].map(p => {
    const dates = [...p.dates].sort();
    return {
      id: p.id, name: p.name, homeLineId: p.homeLineId, homeLineName: p.homeLineName,
      days: dates.length, shifts: p.shifts, dates,
      firstDate: dates[0] || null, lastDate: dates[dates.length - 1] || null,
      span: spanDays(dates[0], dates[dates.length - 1]),
      toLines: [...p.toLines.values()]
        .map(t => ({ id: t.id, name: t.name, days: t.dates.size }))
        .sort((a, b) => b.days - a.days || String(a.name).localeCompare(String(b.name))),
    };
  }).sort((a, b) => b.days - a.days || (b.span || 0) - (a.span || 0)
    || String(a.name).localeCompare(String(b.name)));

  return {
    people,
    totalDays: people.reduce((s, p) => s + p.days, 0),
    unknownHome, insideFamily, skipped,
  };
}
