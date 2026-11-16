/* ล็อกกติกา "แยก Q/D" ของ Customer / Internal Satisfaction ด้วยของจริง
   ที่มา: ทะเบียน `kpi_standard_items` ปี 2026 (อ่านสดจาก Main 16/11) + ใบ KPI_Monitoring P4
   → docs/OBEYA-KPI-SOURCES.md §13.1 ข้อ 3 · §15.2 · docs/modules/obeya-kpi-board.md §แยก Q/D */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CSAT_LEGS, CSAT_LEG_KEYS, CSAT_FORMULA, csatLegOf, csatLegLabel,
  normSatName, satKindOf, isQdLabelled, canSplitQd,
  legPct, combineLegs, csatMonth, indexCsatParts, legMonths, splitMonths, csatCoverage,
} from '../kpiCustomerSat.js';

/* ── ทะเบียนกลางมี 1 หัวข้อ 2 ชื่อ (customer / internal) — ไม่มีข้อย่อย Q, D ────────────── */
test('ขามี 2 ขาเท่านั้น และคีย์ตรงกับ check constraint ของตาราง', () => {
  assert.deepEqual(CSAT_LEG_KEYS, ['quality', 'delivery']);
  assert.equal(CSAT_LEGS.length, 2);
  assert.equal(csatLegOf('quality').short, 'Q');
  assert.equal(csatLegOf('delivery').short, 'D');
  assert.equal(csatLegOf('ไม่มี'), null);
  assert.equal(csatLegLabel('delivery'), 'การส่งมอบ (D)');
  assert.equal(CSAT_FORMULA, '(Actual Score / Total Score) x 100');   // verbatim จากทะเบียน
});

test('🔴 ชื่อที่ต่างกันแค่ (Q&D) = หัวข้อเดียวกัน (ต้นเหตุแถวซ้ำระดับโรงงาน 14/10 vs 19/10)', () => {
  assert.equal(normSatName('Customer Satisfaction (Q&D)'), normSatName('Customer Satisfaction'));
  assert.equal(normSatName('Customer Satisfaction (Q & D)'), normSatName('customer satisfaction'));
  assert.equal(normSatName('Customer Satisfaction (Q/D)'), 'customersatisfaction');
  assert.notEqual(normSatName('Customer Satisfaction'), normSatName('Internal Satisfaction'));
});

test('ตระกูลหัวข้อ — ทะเบียนเขียน 3 แบบ (customer / internal / อื่น)', () => {
  assert.equal(satKindOf({ name: 'Customer Satisfaction (Q&D)' }), 'customer');
  assert.equal(satKindOf({ topic: 'Internal Satisfaction' }), 'internal');
  assert.equal(satKindOf({ topic: 'Internal satisfaction' }), 'internal');        // QSM พิมพ์ s เล็ก
  assert.equal(satKindOf({ topic: 'General Affair satisfaction' }), 'other');     // HRM 2.4
  assert.equal(satKindOf({ name: 'OEE' }), null);
  assert.equal(satKindOf({}), null);
  assert.equal(canSplitQd({ name: 'Customer Satisfaction' }), true);
  assert.equal(canSplitQd({ name: 'Internal Quality Rate' }), false);
  assert.equal(isQdLabelled({ name: 'Customer Satisfaction (Q&D)' }), true);
  assert.equal(isQdLabelled({ name: 'Customer Satisfaction' }), false);
});

/* ── สูตร: (Actual ÷ Total) × 100 ───────────────────────────────────────────────────── */
test('% รายขา — ตัวหารว่าง/0 = null ห้ามคืน 0', () => {
  assert.equal(legPct({ actual_score: 7, total_score: 8 }), 87.5);
  assert.equal(legPct({ actual_score: '11', total_score: '12' }).toFixed(2), '91.67');
  assert.equal(legPct({ actual_score: 0, total_score: 8 }), 0);        // 0 คะแนนจริง ≠ ไม่มีข้อมูล
  assert.equal(legPct({ actual_score: 7, total_score: 0 }), null);
  assert.equal(legPct({ actual_score: 7 }), null);
  assert.equal(legPct({ total_score: 8 }), null);
  assert.equal(legPct(null), null);
});

test('🔴 ค่ารวมของเดือน = (ΣActual ÷ ΣTotal) × 100 — ห้ามเฉลี่ย % 2 ขา', () => {
  /* Q 8 ข้อได้ 8 (100%) · D 4 ข้อได้ 3 (75%) ⇒ ทางการ = 11/12 = 91.67% (เฉลี่ย % จะได้ 87.5 = ผิด) */
  const r = combineLegs({ quality: { actual_score: 8, total_score: 8 }, delivery: { actual_score: 3, total_score: 4 } });
  assert.equal(r.complete, true);
  assert.equal(r.actual, 11);
  assert.equal(r.total, 12);
  assert.equal(r.value.toFixed(2), '91.67');
  assert.notEqual(Number(r.value.toFixed(2)), 87.5);
  assert.deepEqual(r.missing, []);
  assert.deepEqual(r.legs.map(l => l.pct), [100, 75]);
});

test('ขาไม่ครบ = null + บอกว่าขาดขาไหน (ห้ามเดา 0 · ห้ามใช้ขาเดียวเป็นค่ารวม)', () => {
  const only = combineLegs({ quality: { actual_score: 8, total_score: 8 } });
  assert.equal(only.complete, false);
  assert.equal(only.value, null);
  assert.deepEqual(only.missing, ['delivery']);
  assert.deepEqual(only.filled, ['quality']);
  assert.equal(only.actual, 8);              // มีตัวเลขให้ดู แต่ยังไม่ใช่ค่ารวม
  const none = combineLegs({});
  assert.equal(none.value, null);
  assert.equal(none.actual, null);
  assert.deepEqual(none.missing, ['quality', 'delivery']);
});

/* ── สถานะรายเดือน + การฟ้องว่าค่ารวมที่กรอกไม่ตรงกับ 2 ขา ───────────────────────────── */
test('สถานะเดือน 4 แบบ — none / entered / partial / split', () => {
  assert.equal(csatMonth({}).state, 'none');
  assert.equal(csatMonth({ entered: 100 }).state, 'entered');
  assert.equal(csatMonth({ entered: 100, parts: { quality: { actual_score: 8, total_score: 8 } } }).state, 'partial');
  assert.equal(csatMonth({ parts: { quality: { actual_score: 8, total_score: 8 }, delivery: { actual_score: 4, total_score: 4 } } }).state, 'split');
});

test('🔴 ค่ารวมที่กรอกไว้ชนะเสมอ — ต่างจากที่คำนวณได้ = ฟ้อง ไม่ใช่แก้ให้', () => {
  const parts = { quality: { actual_score: 8, total_score: 8 }, delivery: { actual_score: 3, total_score: 4 } };
  const bad = csatMonth({ entered: 87.5, parts });
  assert.equal(bad.entered, 87.5);                       // ค่าที่ส่งกลุ่มไม่ถูกเปลี่ยน
  assert.equal(bad.computed.toFixed(2), '91.67');
  assert.equal(bad.mismatch, true);
  assert.ok(bad.diff < 0);
  const ok = csatMonth({ entered: 91.67, parts, tol: 0.01 });
  assert.equal(ok.mismatch, false);                      // ใบจริงทศนิยม 2 ตำแหน่ง
  assert.equal(csatMonth({ entered: 100, parts: { quality: { actual_score: 8, total_score: 8 } } }).mismatch, false);  // ขาไม่ครบ = ยังไม่ฟ้อง
});

/* ── ตัวช่วยจัดข้อมูลให้จอ ──────────────────────────────────────────────────────────── */
const ROWS = [
  { kpi_id: 'k1', month: 1, part: 'quality',  actual_score: 8, total_score: 8 },
  { kpi_id: 'k1', month: 1, part: 'delivery', actual_score: 4, total_score: 4 },
  { kpi_id: 'k1', month: 2, part: 'quality',  actual_score: 7, total_score: 8 },
  { kpi_id: 'k1', month: 2, part: 'delivery', actual_score: 4, total_score: 4 },
  { kpi_id: 'k1', month: 3, part: 'quality',  actual_score: 6, total_score: 8 },   // ขาเดียว
  { kpi_id: 'k2', month: 5, part: 'delivery', actual_score: 2, total_score: 4 },
  { kpi_id: 'k1', month: 4, part: 'ไม่รู้จัก', actual_score: 1, total_score: 1 },   // part แปลก = ทิ้ง
  null,
];

test('indexCsatParts / legMonths / splitMonths — 12 ช่องเสมอ เดือนที่ไม่มี = null', () => {
  const idx = indexCsatParts(ROWS);
  assert.deepEqual(Object.keys(idx).sort(), ['k1', 'k2']);
  assert.equal(idx.k1[4], undefined);                                  // part แปลกไม่สร้างเดือน
  const q = legMonths(idx.k1, 'quality');
  assert.equal(q.length, 12);
  assert.deepEqual(q.slice(0, 4), [100, 87.5, 75, null]);
  assert.deepEqual(legMonths(idx.k1, 'delivery').slice(0, 4), [100, 100, null, null]);
  const comb = splitMonths(idx.k1);
  assert.equal(comb[0], 100);
  assert.equal(comb[1].toFixed(2), '91.67');
  assert.equal(comb[2], null);                                         // เดือน 3 ขาไม่ครบ
  assert.deepEqual(legMonths({}, 'quality'), Array(12).fill(null));
});

test('csatCoverage — นับว่าแยกครบ/ไม่ครบ/ไม่ตรงค่ารวม กี่เดือน (จอต้องเขียนตัวเลขนี้)', () => {
  const idx = indexCsatParts(ROWS);
  const cov = csatCoverage(idx.k1, { 1: 100, 2: 87.5, 3: 75, 7: 90 });
  assert.equal(cov.split, 2);          // ม.ค. + ก.พ.
  assert.equal(cov.partial, 1);        // มี.ค. (ขาเดียว)
  assert.equal(cov.enteredOnly, 1);    // ก.ค. (มีแต่ค่ารวม)
  assert.equal(cov.mismatch, 1);
  assert.deepEqual(cov.mismatchMonths, [2]);
  assert.equal(cov.any, true);
  assert.equal(csatCoverage({}, {}).any, false);
});
