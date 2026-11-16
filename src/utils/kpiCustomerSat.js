/* ══ 🤝 Customer / Internal Satisfaction — แยก 2 ขา Quality / Delivery (2026-11-16 · คำสั่ง user) ══════
   user: *"customer sat ถ้าแยก Quality-Delivery ได้ ตอนกดเข้าไป รวมถึงตรงหน้าการกรอกข้อมูล"*

   🔴 สิ่งที่ **ทะเบียนกลางของกลุ่ม** (`kpi_standard_items` ปี 2026 · อ่านสดจาก Main 16/11) เขียนไว้จริง —
      ห้ามคิดโครงเอง (CLAUDE.md §OBEYA "การเลือก KPI ต่อหน่วยงานมีทะเบียน ห้ามคิดเอง"):
        · หัวข้อ `Customer Satisfaction (Q&D)` = **1 แถว 1 คะแนน** (perspective `customer` · requirement `fixed`)
          โผล่ 10 หน่วยงาน: Head of SPG · GM Plant · GM Plant (Tooling) · Production · Engineering · QA
          · Logistic & Sales · Die Maintenance · Tooling · Marketing
        · หน่วยสนับสนุนใช้ชื่อ `Internal Satisfaction` (Maintenance · RDPP · CSC · Accounting · Purchase · QSM)
        · **สูตรเดียวกันทุกแถว: `(Actual Score / Total Score) x 100`**
        · **ทะเบียนไม่มีข้อย่อยของ Q และ D** — `(Q&D)` คือ *ขอบเขตของแบบสอบถาม* (คุณภาพ + การส่งมอบ)
          ไม่ใช่ KPI 2 ตัว ⇒ **ห้ามแตกเป็น 2 แถว KPI / ห้ามให้ 2 คะแนน / ห้ามถ่วงน้ำหนัก 2 ที่**

   ⇒ โครงที่เลือก: **ขา Q/D = "การแยกตัวตั้ง-ตัวหารของสูตรเดิม" ไม่ใช่ KPI ใหม่**
      เก็บคะแนนดิบรายขา (`actual_score` / `total_score`) ที่ตาราง `kpi_customer_sat_parts`
      แล้วค่ารวมของเดือน = **(ΣActual ÷ ΣTotal) × 100** = สูตรทางการเป๊ะ
      🔴 **ห้ามเฉลี่ย % ของ 2 ขา** — ตัวหารแต่ละขาไม่เท่ากัน (Q 8 ข้อ / D 4 ข้อ) เฉลี่ยแล้วได้เลขที่ไม่มีอยู่จริง
      🔴 **ค่าที่ส่งกลุ่มยังเป็น `kpi_manual_entries.value` ตัวเดิม** (คนกรอก/ย้ายมาแล้ว 8 เดือน)
         ขา Q/D เป็น "รายละเอียดของเดือนนั้น" — ตัวนี้ไม่เคยเขียนทับค่ารวมเอง (จอมีปุ่มให้คนกดใช้ค่าที่คำนวณได้)
      🔴 **ขาไม่ครบ = `null` ห้ามเดา 0** (กฎความซื่อสัตย์ของจอ) · กรอกขาเดียว = จอต้องบอกว่า "ยังไม่ครบ"

   pure ล้วน · ห้าม import supabase/DOM · 📄 docs/modules/obeya-kpi-board.md §แยก Q/D
   ════════════════════════════════════════════════════════════════════════════════════════════ */
import { normKpiRowName } from './kpiBoardRows.js';

/** 2 ขาของแบบสอบถาม — คีย์ต้องตรงกับ `kpi_customer_sat_parts.part` (check constraint) เป๊ะ */
export const CSAT_LEGS = [
  { key: 'quality',  label: 'คุณภาพ (Q)',    short: 'Q', icon: '🎯', hint: 'คะแนนด้านคุณภาพงานที่ส่งให้ลูกค้า' },
  { key: 'delivery', label: 'การส่งมอบ (D)', short: 'D', icon: '🚚', hint: 'คะแนนด้านการส่งมอบ (ตรงเวลา/ครบจำนวน)' },
];
export const CSAT_LEG_KEYS = CSAT_LEGS.map(l => l.key);
export const csatLegOf = (k) => CSAT_LEGS.find(l => l.key === k) || null;
export const csatLegLabel = (k) => csatLegOf(k)?.label || k || '';

/** สูตรทางการของทะเบียน — เอาไปขึ้นจอได้ ห้ามพิมพ์สูตรเองในหน้า */
export const CSAT_FORMULA = '(Actual Score / Total Score) x 100';

const num = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/* ชื่อแบบเทียบได้ที่ "ไม่สน (Q&D)" — `normKpiRowName` ตัดช่องว่าง/ขีด/วงเล็บแล้ว แต่ยังเหลือ `&`
   ⇒ `Customer Satisfaction` กับ `Customer Satisfaction (Q&D)` ต้องรู้ว่าเป็นหัวข้อเดียวกัน
   (เหตุการณ์จริง: ระดับโรงงานมี 2 แถว active ซ้อนกันเพราะชื่อต่างกันแค่วงเล็บ — 19/10 vs 14/10) */
export const normSatName = (s) => normKpiRowName(s).replace(/&/g, '').replace(/q(and)?d$/, '');

/**
 * หัวข้อนี้เป็น "ความพึงพอใจ" ตามทะเบียนไหม — คืนตระกูล หรือ `null`
 * @returns 'customer' | 'internal' | 'other' | null
 *   other = มีคำ satisfaction แต่ไม่ใช่ 2 ชื่อหลัก (เช่น `General Affair satisfaction` ของ HRM)
 */
export function satKindOf(def) {
  const n = normSatName(def?.name ?? def?.topic ?? '');
  if (!n.includes('satisfaction')) return null;
  if (n.includes('customersatisfaction')) return 'customer';
  if (n.includes('internalsatisfaction')) return 'internal';
  return 'other';
}

/** ชื่อแถวติดป้าย `(Q&D)` ตามทะเบียนไหม — ไม่ติด = แยกดูเองได้ แต่จอต้องเขียนว่าทะเบียนไม่ได้ติดป้ายไว้ */
export const isQdLabelled = (def) => /q\s*(&|and|\/)\s*d/i.test(String(def?.name ?? def?.topic ?? ''));

/** แถวนี้แยก Q/D ได้ไหม — ทุกแถว satisfaction ใช้สูตร (Actual/Total)×100 เดียวกัน ⇒ แยกได้หมด */
export const canSplitQd = (def) => satKindOf(def) != null;

/** % ของขาเดียว — `total_score` ว่าง/0 = `null` (ห้ามหารศูนย์ ห้ามคืน 0) */
export function legPct(row) {
  const a = num(row?.actual_score);
  const t = num(row?.total_score);
  if (a == null || t == null || t <= 0) return null;
  return (a / t) * 100;
}

/**
 * รวม 2 ขาเป็นค่าของเดือนตามสูตรทางการ — **(ΣActual ÷ ΣTotal) × 100**
 * @param byLeg { quality: {actual_score,total_score}, delivery: {...} } (ขาที่ไม่มี = ไม่ต้องส่ง)
 * @returns { value, legs, filled, missing, complete, actual, total }
 *   value `null` = ขาไม่ครบ (จอต้องเขียนว่ายังไม่ครบ ห้ามโชว์ 0)
 */
export function combineLegs(byLeg = {}) {
  const legs = CSAT_LEGS.map((l) => {
    const r = byLeg?.[l.key] || null;
    const a = num(r?.actual_score);
    const t = num(r?.total_score);
    return { ...l, actual: a, total: t, pct: legPct(r), filled: a != null && t != null && t > 0 };
  });
  const filled = legs.filter(l => l.filled);
  const missing = legs.filter(l => !l.filled).map(l => l.key);
  const complete = missing.length === 0;
  const actual = filled.reduce((s, l) => s + l.actual, 0);
  const total = filled.reduce((s, l) => s + l.total, 0);
  return {
    legs, complete,
    filled: filled.map(l => l.key), missing,
    actual: filled.length ? actual : null,
    total: filled.length ? total : null,
    value: complete && total > 0 ? (actual / total) * 100 : null,
  };
}

/**
 * สถานะของ 1 เดือน — เอาไปเขียนบนจอได้ตรงๆ
 * @param entered ค่าที่กรอกไว้ใน `kpi_manual_entries.value` (= ค่าที่ส่งกลุ่ม · ชนะเสมอ)
 * @param parts   แถว `kpi_customer_sat_parts` ของเดือนนั้น (map ตาม part)
 * @param tol     ความต่างที่ยอมให้ถือว่า "ตรงกัน" (จุดทศนิยมของใบจริงคือ 2 ⇒ 0.01)
 * @returns { entered, computed, split, state, mismatch, diff }
 *   state: 'none' ยังไม่มีอะไร · 'entered' มีแต่ค่ารวม · 'partial' แยกไม่ครบ · 'split' แยกครบแล้ว
 *   🔴 `mismatch` = ค่ารวมที่กรอกไม่เท่ากับที่คำนวณจาก 2 ขา — **จอต้องฟ้อง ห้ามแก้ให้เอง**
 */
export function csatMonth({ entered = null, parts = {}, tol = 0.01 } = {}) {
  const split = combineLegs(parts);
  const e = num(entered);
  const c = split.value;
  const state = split.complete ? 'split' : split.filled.length ? 'partial' : e != null ? 'entered' : 'none';
  const diff = e != null && c != null ? e - c : null;
  return { entered: e, computed: c, split, state, diff, mismatch: diff != null && Math.abs(diff) > tol };
}

/**
 * จัด `kpi_customer_sat_parts` ที่โหลดมาเป็น map ใช้งานง่าย
 * @returns { [kpi_id]: { [month]: { [part]: row } } }
 */
export function indexCsatParts(rows = []) {
  const out = {};
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r?.kpi_id || !r.month || !CSAT_LEG_KEYS.includes(r.part)) continue;
    const byMonth = (out[r.kpi_id] = out[r.kpi_id] || {});
    (byMonth[r.month] = byMonth[r.month] || {})[r.part] = r;
  }
  return out;
}

/** ค่า 12 เดือนของขาหนึ่ง (% · index 0 = ม.ค.) — เดือนที่ขานี้ยังไม่กรอก = `null` */
export function legMonths(byMonth = {}, leg) {
  return Array.from({ length: 12 }, (_, i) => legPct(byMonth?.[i + 1]?.[leg] || null));
}

/** ค่า 12 เดือนที่คำนวณได้จาก 2 ขา (ครบทั้งคู่เท่านั้น) */
export function splitMonths(byMonth = {}) {
  return Array.from({ length: 12 }, (_, i) => combineLegs(byMonth?.[i + 1] || {}).value);
}

/**
 * สรุปว่าแถวนี้แยก Q/D ไปแล้วแค่ไหน — ให้จอเขียน "แยกแล้ว n เดือน · ไม่ครบ m เดือน · ไม่ตรงค่ารวม k เดือน"
 * @param byMonth  map เดือน→ขา ของ KPI ตัวนั้น
 * @param entries  map เดือน→ค่ารวมที่กรอกไว้ ({1: 100, …})
 */
export function csatCoverage(byMonth = {}, entries = {}, { tol = 0.01 } = {}) {
  let split = 0, partial = 0, mismatch = 0, enteredOnly = 0;
  const mismatchMonths = [];
  for (let m = 1; m <= 12; m++) {
    const st = csatMonth({ entered: entries?.[m] ?? null, parts: byMonth?.[m] || {}, tol });
    if (st.state === 'split') split += 1;
    else if (st.state === 'partial') partial += 1;
    else if (st.state === 'entered') enteredOnly += 1;
    if (st.mismatch) { mismatch += 1; mismatchMonths.push(m); }
  }
  return { split, partial, mismatch, mismatchMonths, enteredOnly, any: split + partial > 0 };
}
