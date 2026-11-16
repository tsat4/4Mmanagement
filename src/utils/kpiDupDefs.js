/* ══ 👯 KPI ซ้ำในขอบเขตเดียวกัน — ตัวจับคลาสบั๊ก "หัวข้อเดียวแต่มี 2 แถว" (2026-11-16) ══════════
   เคสจริงที่ทำให้ต้องมีไฟล์นี้ (ไล่จากฐาน Main 16/11 · ปี 2026 · ระดับ ทั้งโรงงาน):
     · `Customer Satisfaction (Q&D)` (ผูกทะเบียน 477be2fb · สร้าง 14/10 · กรอกไว้ 10 เดือน)
     · `Customer Satisfaction`        (ไม่ผูกทะเบียน · สร้าง 19/10 · กรอกไว้ 9 เดือน)
   ⇒ 2 แถว `is_active` พร้อมกัน · ชื่อต่างกัน**แค่วงเล็บ** ⇒ `normKpiRowName` มองเป็นคนละหัวข้อ
     ⇒ บอร์ดขึ้น 2 แผ่น · คนกรอกค่าเดียวกัน 2 ที่ (ก.ย. 100 vs 93.75 = ขัดกันแล้ว) · น้ำหนักนับซ้ำ
   🔴 **ตัวนี้เตือนเท่านั้น ห้ามลบ/ปิดแถวให้เอง** — Actual ที่กรอกไว้จะกำพร้า ต้องให้คนตัดสินว่าเก็บตัวไหน
      (หลักเดียวกับ `checkStdSelection` ใน kpiSetup: ใบจริงไม่ตรงกติกาได้ จอมีหน้าที่บอก ไม่ใช่บังคับ)

   pure ล้วน · มีเทส `src/utils/__tests__/kpiDupDefs.test.mjs`
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
import { normKpiRowName } from './kpiBoardRows.js';

/* ── ชื่อหัวข้อ "ความพึงพอใจ" แบบเทียบได้ ─────────────────────────────────────────────────────
   `normKpiRowName` ตัดช่องว่าง/ขีด/วงเล็บแล้ว แต่ยังเหลือ `&` ⇒ `Customer Satisfaction` กับ
   `Customer Satisfaction (Q&D)` ต้องรู้ว่าเป็นหัวข้อเดียวกัน (เคสจริงหัวไฟล์) */
export const normSatName = (s) => normKpiRowName(s).replace(/&/g, '').replace(/q(and)?d$/, '');

/** หัวข้อนี้เป็น "ความพึงพอใจ" ไหม — คืนตระกูล หรือ `null`
 *  @returns 'customer' | 'internal' | 'other' | null
 *    other = มีคำ satisfaction แต่ไม่ใช่ 2 ชื่อหลัก (เช่น `General Affair satisfaction` ของ HRM)
 *  🔴 `customer` กับ `internal` คนละแบบสอบถาม — customer = ใบเดียวของโรงงาน (ค่ากลาง · สูตร
 *     `csat_qd_pct`) · internal = ใบของหน่วยสนับสนุนแต่ละหน่วย (กรอกมือรายหน่วย) ห้ามยุบเป็นตระกูลเดียว */
export function satKindOf(def) {
  const n = normSatName(def?.name ?? def?.topic ?? '');
  if (!n.includes('satisfaction')) return null;
  if (n.includes('customersatisfaction')) return 'customer';
  if (n.includes('internalsatisfaction')) return 'internal';
  return 'other';
}

/* เหตุที่ถือว่าซ้ำ — เรียงจาก "แน่นอนที่สุด" ไป "เป็นข้อสงสัย" (จอเอาป้ายไปขึ้นตรงๆ ได้) */
export const DUP_REASONS = {
  std_item: { label: 'ผูกทะเบียนมาตรฐานข้อเดียวกัน', sure: true,  hint: 'std_item_id ตรงกัน — เป็นข้อเดียวกันของกลุ่มแน่นอน' },
  catalog:  { label: 'ผูกทะเบียนชื่อ KPI ตัวเดียวกัน', sure: true,  hint: 'catalog_id ตรงกัน' },
  name:     { label: 'ชื่อเดียวกัน',                  sure: true,  hint: 'ชื่อตรงกันเมื่อไม่สนตัวพิมพ์/ช่องว่าง/วงเล็บ' },
  family:   { label: 'หัวข้อเดียวกัน (ต่างแค่วงเล็บ)', sure: false, hint: 'เช่น Customer Satisfaction กับ Customer Satisfaction (Q&D)' },
};
export const dupReasonLabel = (k) => DUP_REASONS[k]?.label || k || '';

const defScopeKey = (r) => `${r?.scope_kind || 'plant'}|${r?.scope_value || ''}`;

/** ตระกูลหัวข้อที่ "ต่างแค่วงเล็บ/ตัวห้อย" — ตอนนี้รู้จักเฉพาะชุด satisfaction (มีทะเบียนยืนยันว่าเป็นข้อเดียว)
 *  🔴 ห้ามเติมตระกูลเดาเอง: เดาผิด = ฟ้องว่าซ้ำทั้งที่เป็น KPI คนละตัว (PPM มี 3 ตัวที่ชื่อคล้ายกันจริง) */
export function defFamilyOf(def) {
  const kind = satKindOf(def);
  return kind ? `sat:${kind}:${normSatName(def?.name ?? def?.topic ?? '')}` : null;
}

/**
 * หา KPI ซ้ำ "ในขอบเขตเดียวกัน"
 * @param rows        แถว `kpi_definitions` (ควรกรอง `is_active` มาแล้ว — แถวปิดใช้งานไม่ถือว่าซ้ำ)
 * @param scopeKeyOf  (row) => string — คีย์ขอบเขตที่ canonical แล้ว (ไม่ส่ง = scope_kind|scope_value ดิบ)
 * @param familyOf    (row) => string|null — ไม่ส่ง = `defFamilyOf`
 * @returns [{ key, scopeKey, reason, reasons, rows }] — กลุ่มที่มีตั้งแต่ 2 แถวขึ้นไป
 *   `reason` = เหตุที่แน่นอนที่สุดของกลุ่มนั้น · `rows` เรียงตาม `created_at` (ของเก่าอยู่ก่อน)
 */
export function findDupDefs(rows = [], { scopeKeyOf = null, familyOf = null } = {}) {
  const skOf = typeof scopeKeyOf === 'function' ? scopeKeyOf : defScopeKey;
  const famOf = typeof familyOf === 'function' ? familyOf : defFamilyOf;
  const order = ['std_item', 'catalog', 'name', 'family'];

  const buckets = new Map();   // bucketKey -> { reason, scopeKey, rows: [] }
  const push = (key, reason, scopeKey, row) => {
    const b = buckets.get(key) || { reason, scopeKey, rows: [] };
    if (!b.rows.some(r => r.id === row.id)) b.rows.push(row);
    buckets.set(key, b);
  };
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || !r.id) continue;
    const sk = skOf(r);
    if (r.std_item_id) push(`std|${sk}|${r.std_item_id}`, 'std_item', sk, r);
    const cat = r.catalog_id || r.kpi_catalog?.id || null;
    if (cat) push(`cat|${sk}|${cat}`, 'catalog', sk, r);
    const n = normKpiRowName(r.name ?? r.topic ?? '');
    if (n) push(`name|${sk}|${n}`, 'name', sk, r);
    const fam = famOf(r);
    if (fam) push(`fam|${sk}|${fam}`, 'family', sk, r);
  }

  /* ยุบกลุ่มที่เป็น "ชุดแถวเดียวกัน" ให้เหลือรายการเดียว แล้วเก็บเหตุทั้งหมดไว้
     (แถวคู่หนึ่งเข้าได้หลายเหตุ — ฟ้อง 4 บรรทัดสำหรับเรื่องเดียวคือจอรบกวน) */
  const bySig = new Map();
  for (const b of buckets.values()) {
    if (b.rows.length < 2) continue;
    const rowsSorted = b.rows.slice().sort((a, c) => String(a.created_at || '').localeCompare(String(c.created_at || '')));
    const sig = rowsSorted.map(r => r.id).join('|');
    const cur = bySig.get(sig);
    if (!cur) { bySig.set(sig, { key: sig, scopeKey: b.scopeKey, reason: b.reason, reasons: [b.reason], rows: rowsSorted }); continue; }
    if (!cur.reasons.includes(b.reason)) cur.reasons.push(b.reason);
    if (order.indexOf(b.reason) < order.indexOf(cur.reason)) cur.reason = b.reason;
  }
  return [...bySig.values()].map(g => ({ ...g, reasons: g.reasons.slice().sort((a, b2) => order.indexOf(a) - order.indexOf(b2)) }));
}

/**
 * ข้อมูลประกอบการตัดสินใจของแต่ละแถวในกลุ่มซ้ำ — "แถวไหนมีคนกรอกไว้กี่เดือน"
 * 🔴 ห้ามให้ระบบเลือกแถวที่เก็บเอง — คืนตัวเลขให้คนดูแล้วตัดสิน
 * @param group   1 กลุ่มจาก `findDupDefs`
 * @param entries { [kpi_id]: { [month]: value } }
 */
export function dupGroupFacts(group, entries = {}) {
  return (group?.rows || []).map((r) => {
    const months = Object.entries(entries?.[r.id] || {})
      .filter(([, v]) => v != null && v !== '')
      .map(([m, v]) => ({ month: Number(m), value: Number(v) }))
      .sort((a, b) => a.month - b.month);
    return {
      id: r.id, name: r.name, stdItemId: r.std_item_id || null, createdAt: r.created_at || null,
      weight: r.weight == null ? null : Number(r.weight),
      filled: months.length, months,
    };
  });
}
