/* ══ 🧭 lineAxisFilter — "แกนไลน์อธิบายคนนี้ได้ไหม" (pure · 2026-11-16) ═════════════════════
 *
 * ปัญหาที่ไฟล์นี้แก้ (regression จริง 13/11 → แจ้ง 16/11):
 *   `/checkin` ตั้ง **ค่าตั้งต้น** ของช่องขอบเขตเป็น "ไลน์ตัวเอง" (`defaultLineFilter` ·
 *   sectionScope.js) ⇒ ตัวกรองไลน์ทำงานทันทีที่หัวหน้าไลน์เปิดจอ · ตัวกรองนั้นถามคำถามเดียวว่า
 *   **"อยู่ไลน์ไหน"** ⇒ คนที่ไม่ได้สังกัดไลน์โดยธรรมชาติ **หายทั้งกองอย่างเงียบ ๆ**
 *   หน้างานแจ้ง: *"พนักงานออฟฟิศ บางทีก็โชว์ บางทีก็ไม่โชว์ ตอนนี้ไม่โชว์เลย"*
 *   วัดจริง (Main `ewhdfqwfwofivojtsizn` · 16/11 · is_active):
 *     `support` 64 คน (13 คนยังไม่มี `line_id` · 3 คนไม่มีทั้งไลน์และส่วนงาน) ·
 *     `technician` 22 คน · `shopfloor` ที่ยังไม่ผูกไลน์ 4 คน
 *
 * 🔴 กฎ — **คลาสเดียวกับที่ 05/10 แก้ไว้แล้วสำหรับช่อง "ส่วนงาน"** (docs/modules/org-hierarchy.md
 *    §`line_id` มาจาก "กลุ่ม" ไม่ใช่ "แผนก") รอบนี้คือแกน "ไลน์" ที่ยังไม่ได้แก้:
 *   1. ตัวกรองไลน์ **ซ่อนได้เฉพาะคนที่แกนไลน์อธิบายได้** = คนที่นับเป็นกำลังคนของไลน์ผลิต
 *      (`isShopfloorStaff()` · staffKind.js — **ห้ามพิมพ์ลิสต์ `staff_kind` เองซ้ำ**) **และ** มี `line_id`
 *   2. คนที่แกนไลน์อธิบายไม่ได้ (สายสนับสนุน · ช่าง · คนที่ยังไม่ผูกไลน์) **ห้ามถูกตัวกรองไลน์ซ่อน**
 *      — แต่เขายังผูกกับ **ส่วนงาน** ได้ ⇒ ซ่อนได้เมื่อ *รู้* ว่าอยู่ส่วนงานอื่น (ไม่ใช่เดา)
 *   3. วางเขาบนแกนไหนไม่ได้เลย (ไม่รู้ทั้งส่วนงานของเขาและของไลน์ที่เลือก) = **fail-open แสดง**
 *      หลักเดียวกับ `onlyShopfloorStaff()`: *"นับเกินแล้วเห็น ดีกว่าหายเงียบ"*
 *   4. ผู้เรียก **ต้องเขียนบนจอ** ว่าซ่อนไปกี่คน และแสดงคนที่ไม่สังกัดไลน์กี่คน (กฎจอซื่อสัตย์)
 *
 * ⚠️ **ตัวกรองการดู ไม่ใช่ด่านสิทธิ์** — "ใครเห็นได้บ้าง" ยังตัดสินที่ `lineScope()` /
 *    `empScopeOrFilter()` เหมือนเดิมทุกประการ · ไฟล์นี้ตัดสินแค่ "ในกองที่เห็นได้แล้ว
 *    ช่องเลือกไลน์ซ่อนใครได้" ⇒ **ไม่เคยทำให้เห็นคนนอกขอบเขตบัญชี**
 *
 * ⚠️ ไลน์ปลายทางของคนที่ "ถูกยืมตัว" (`line_helpers`) = ไลน์ที่เขายืนอยู่จริงกะนั้น ⇒ ผู้เรียก
 *    ส่ง `lineId` ที่ resolve มาแล้ว (`_helperToLineId || line_id`) **ห้ามให้ไฟล์นี้รู้จักการยืม**
 */

import { isShopfloorStaff } from './staffKind.js';

/** ผลการตัดสิน 3 แบบ — ผู้เรียกใช้ค่าเหล่านี้เทียบ ห้ามพิมพ์สตริงเอง */
export const AXIS_IN       = 'in';         // อยู่ในครอบครัวไลน์ที่เลือก
export const AXIS_OTHER    = 'other';      // อยู่ไลน์อื่นจริง ⇒ ซ่อนได้ (ต้องนับขึ้นจอ)
export const AXIS_OFF      = 'off_axis';   // แกนไลน์อธิบายไม่ได้ ⇒ **ห้ามซ่อน**

const norm = (s) => String(s ?? '').trim().toLowerCase();
const toSet = (v) => (v instanceof Set ? v : new Set(Array.isArray(v) ? v : (v ? [v] : [])));
/** id ในทะเบียนเป็นตัวเลข แต่ค่าที่มาจากช่องกรองบนจอเป็นสตริง — เทียบทั้ง 2 รูป */
const hasId = (set, id) => set.has(id) || set.has(Number(id)) || set.has(String(id));

/**
 * ส่วนงานของ "ครอบครัวไลน์ที่เลือก" — ใช้ขอบเขตให้คนที่ไม่สังกัดไลน์
 *
 * 🔴 ต้องไล่จาก **ทะเบียนไลน์** ไม่ใช่จาก `employees.section` — ของจริง (วัด 16/11) คนสายสนับสนุน
 *    ผูกกับไลน์ที่เป็นหน่วยสนับสนุน (QA `Inspection` 15 คน · `STORE` 11 · `Office PD4` 6 …)
 *    แล้ว `employees.section` ตรงกับ `production_lines.section` ของไลน์นั้นแทบทุกแถว
 * @param {Array}  lines     ทะเบียนไลน์ (ต้องมี `id`, `section`)
 * @param {Set|Array} familyIds  id ของครอบครัวไลน์ที่เลือก
 * @returns {Set<string>} ชื่อส่วนงาน normalize แล้ว · **ว่าง = ตัดด้วยส่วนงานไม่ได้** (ผู้เรียก fail-open)
 */
export function familySectionsOf(lines, familyIds) {
  const ids = toSet(familyIds);
  const out = new Set();
  if (!ids.size) return out;
  for (const l of (Array.isArray(lines) ? lines : [])) {
    if (!hasId(ids, l?.id)) continue;
    const s = norm(l?.section);
    if (s) out.add(s);
  }
  return out;
}

/**
 * คนหนึ่งคนกับ "ตัวกรองไลน์" ที่เปิดอยู่ — คืน `AXIS_IN` / `AXIS_OTHER` / `AXIS_OFF`
 *
 * @param {Object} emp พนักงาน (ใช้ `staff_kind` + `section` · `line_id` ถ้าไม่ส่ง `lineId`)
 * @param {Object} opts
 *   - `familyIds`      Set|Array id ครอบครัวไลน์ที่เลือก · **ว่าง = ไม่มีตัวกรองไลน์ ⇒ `AXIS_IN` ทุกคน**
 *   - `familySections` Set ชื่อส่วนงานของครอบครัวนั้น (`familySectionsOf`) · ว่าง = ตัดด้วยส่วนงานไม่ได้
 *   - `lineSections`   `{ [lineId]: section }` — ใช้หาส่วนงานของคนที่ `employees.section` ว่าง
 *   - `lineId`         ไลน์ที่ใช้ตัดสิน (ส่ง `_helperToLineId || line_id` มาแล้ว) · ไม่ส่ง = `emp.line_id`
 */
export function lineAxisVerdict(emp, opts = {}) {
  const { familySections, lineSections } = opts;
  const ids = toSet(opts.familyIds);
  if (!ids.size) return AXIS_IN;                       // ไม่มีตัวกรอง = ไม่ซ่อนใคร

  const lineId = opts.lineId === undefined ? emp?.line_id : opts.lineId;
  const hasLine = lineId !== null && lineId !== undefined && lineId !== '';
  if (hasLine && hasId(ids, lineId)) return AXIS_IN;

  // แกนไลน์อธิบายเขาได้ (เป็นกำลังคนของไลน์ผลิต + ผูกไลน์แล้ว) แต่เป็นไลน์อื่น ⇒ ซ่อนได้
  if (hasLine && isShopfloorStaff(emp)) return AXIS_OTHER;

  /* ถึงตรงนี้ = สายสนับสนุน/ช่าง หรือคนที่ยังไม่ผูกไลน์ ⇒ ตัดด้วย "ส่วนงาน" ได้ถ้ารู้ทั้ง 2 ฝั่ง
     ไม่รู้ฝั่งใดฝั่งหนึ่ง = วางเขาบนแกนไหนไม่ได้ ⇒ fail-open แสดง (ห้ามหายเงียบ) */
  const secs = toSet(familySections);
  const sec = norm(emp?.section) || (hasLine ? norm(lineSections?.[lineId]) : '');
  if (!secs.size || !sec) return AXIS_OFF;
  return secs.has(sec) ? AXIS_OFF : AXIS_OTHER;
}

/**
 * แบ่งลิสต์เป็น 3 กอง — ให้จอได้ตัวเลขที่ต้องเขียนบนจอครบในรอบเดียว
 * @returns {{ shown:Array, hidden:Array, offAxis:Array }}
 *   `shown` = ที่ต้องแสดง (`AXIS_IN` + `AXIS_OFF`) · `hidden` = ไลน์อื่น (เขียนว่า "+N คนในไลน์อื่น")
 *   `offAxis` = คนที่แสดงอยู่เพราะแกนไลน์อธิบายไม่ได้ (เขียนว่าแสดงกี่คน · ⊂ `shown`)
 */
export function partitionByLineAxis(rows, opts = {}) {
  const shown = [], hidden = [], offAxis = [];
  for (const r of (Array.isArray(rows) ? rows : [])) {
    const v = lineAxisVerdict(r, { ...opts, lineId: opts.lineIdOf ? opts.lineIdOf(r) : undefined });
    if (v === AXIS_OTHER) { hidden.push(r); continue; }
    shown.push(r);
    if (v === AXIS_OFF) offAxis.push(r);
  }
  return { shown, hidden, offAxis };
}
