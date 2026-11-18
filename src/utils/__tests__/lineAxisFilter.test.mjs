/* 🧭 lineAxisFilter — ตัวกรองไลน์ซ่อนได้เฉพาะคนที่แกนไลน์อธิบายได้ (2026-11-16)
   เคสจริงที่คุม: จอเช็คชื่อตั้งค่าตั้งต้นเป็น "ไลน์ตัวเอง" (13/11) แล้วพนักงานออฟฟิศหายทั้งกอง */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  lineAxisVerdict, familySectionsOf, partitionByLineAxis,
  AXIS_IN, AXIS_OTHER, AXIS_OFF,
} from '../lineAxisFilter.js';

/* ทะเบียนไลน์ย่อจากของจริง (วัด 16/11): PD4 มีไลน์ผลิต GOR/Assy GOR + หน่วยออฟฟิศ Office PD4
   · QA มีไลน์สนับสนุน Inspection · PD3 มี LINE APRON ASSY */
const LINES = [
  { id: 1, name: 'GOR',        section: 'PD4' },
  { id: 2, name: 'Assy GOR',   section: 'PD4' },
  { id: 3, name: 'Office PD4', section: 'PD4' },
  { id: 4, name: 'LWR BAR',    section: 'PD4' },
  { id: 5, name: 'Inspection', section: 'QA'  },
  { id: 6, name: 'ไลน์ไม่ตั้งส่วนงาน', section: null },
];
const FAM = new Set([1, 2]);                       // เลือกไลน์ GOR → ครอบครัว GOR + Assy GOR
const SECS = familySectionsOf(LINES, FAM);
const LSEC = Object.fromEntries(LINES.map(l => [l.id, l.section]));
const opt = (over = {}) => ({ familyIds: FAM, familySections: SECS, lineSections: LSEC, ...over });

const op = (line_id) => ({ staff_kind: 'shopfloor', section: 'PD4', line_id });
const office = (over = {}) => ({ staff_kind: 'support', section: 'PD4', line_id: 3, ...over });

test('familySectionsOf — ส่วนงานมาจากทะเบียนไลน์ · ครอบครัวว่าง = Set ว่าง', () => {
  assert.deepEqual([...SECS], ['pd4']);
  assert.equal(familySectionsOf(LINES, new Set()).size, 0);
  assert.equal(familySectionsOf(LINES, [6]).size, 0);          // ไลน์ที่ section ว่าง = ตัดไม่ได้
  assert.deepEqual([...familySectionsOf(LINES, [1, 5])].sort(), ['pd4', 'qa']);
});

test('คนหน้างานยังถูกตัวกรองไลน์คุมเข้มเหมือนเดิม (ห้ามหลวมลง)', () => {
  assert.equal(lineAxisVerdict(op(1), opt()), AXIS_IN);
  assert.equal(lineAxisVerdict(op(2), opt()), AXIS_IN);        // ไลน์ลูกในครอบครัว
  assert.equal(lineAxisVerdict(op(4), opt()), AXIS_OTHER);     // LWR BAR = ไลน์อื่น ⇒ ซ่อน
  /* คนหน้างานส่วนงานเดียวกันแต่อยู่ไลน์อื่น **ห้าม** กลายเป็น off_axis
     (ไม่งั้นก็เท่ากับถอด defaultLineFilter ของ 13/11 ทิ้งไปเอง) */
  assert.equal(lineAxisVerdict({ ...op(4), section: 'PD4' }, opt()), AXIS_OTHER);
});

test('🔴 สายสนับสนุน/ช่าง ของส่วนงานเดียวกัน = ห้ามถูกตัวกรองไลน์ซ่อน', () => {
  assert.equal(lineAxisVerdict(office(), opt()), AXIS_OFF);                     // Office PD4 (6 คนจริง)
  assert.equal(lineAxisVerdict(office({ staff_kind: 'technician', line_id: 4 }), opt()), AXIS_OFF);
  assert.equal(lineAxisVerdict(office({ staff_kind: 'indirect' }), opt()), AXIS_OFF);  // ค่าเก่าก่อน 23/09
});

test('สายสนับสนุนของส่วนงานอื่น ยังซ่อนเหมือนเดิม (ไม่ได้เปิดให้เห็นทั้งโรงงาน)', () => {
  assert.equal(lineAxisVerdict({ staff_kind: 'support', section: 'QA', line_id: 5 }, opt()), AXIS_OTHER);
  // section ว่าง แต่ไลน์ของเขาบอกส่วนงานได้ → ตัดด้วยส่วนงานของไลน์
  assert.equal(lineAxisVerdict({ staff_kind: 'support', section: null, line_id: 5 }, opt()), AXIS_OTHER);
});

test('🔴 คนที่ยังไม่ผูกไลน์ — ส่วนงานเดียวกัน = แสดง · ส่วนงานอื่น = ซ่อน', () => {
  assert.equal(lineAxisVerdict({ staff_kind: 'support', section: 'PD4', line_id: null }, opt()), AXIS_OFF);
  assert.equal(lineAxisVerdict({ staff_kind: 'shopfloor', section: 'PD4', line_id: null }, opt()), AXIS_OFF);
  assert.equal(lineAxisVerdict({ staff_kind: 'support', section: 'QA', line_id: null }, opt()), AXIS_OTHER);
});

test('🔴 วางบนแกนไหนไม่ได้เลย = fail-open แสดง (3 คนจริงที่ไม่มีทั้งไลน์และส่วนงาน)', () => {
  assert.equal(lineAxisVerdict({ staff_kind: 'support', section: null, line_id: null }, opt()), AXIS_OFF);
  // ครอบครัวไลน์ที่เลือกไม่มีส่วนงาน ⇒ ตัดด้วยส่วนงานไม่ได้ ⇒ ห้ามซ่อนคนที่ไม่สังกัดไลน์
  const noSec = opt({ familyIds: new Set([6]), familySections: familySectionsOf(LINES, [6]) });
  assert.equal(lineAxisVerdict({ staff_kind: 'support', section: 'QA', line_id: 5 }, noSec), AXIS_OFF);
  assert.equal(lineAxisVerdict(op(4), noSec), AXIS_OTHER);     // คนหน้างานยังซ่อนตามไลน์เหมือนเดิม
});

test('ไม่มีตัวกรองไลน์ = ไม่ซ่อนใครเลย', () => {
  for (const e of [op(4), office(), { staff_kind: 'support', section: 'QA', line_id: 5 }]) {
    assert.equal(lineAxisVerdict(e, opt({ familyIds: null })), AXIS_IN);
    assert.equal(lineAxisVerdict(e, opt({ familyIds: new Set() })), AXIS_IN);
  }
});

test('id สตริง/ตัวเลขต้องเทียบติดทั้งคู่ (ช่องกรองบนจอเก็บเป็นสตริง)', () => {
  assert.equal(lineAxisVerdict(op('1'), opt()), AXIS_IN);
  assert.equal(lineAxisVerdict(op(1), opt({ familyIds: new Set(['1', '2']) })), AXIS_IN);
});

test('คนที่ถูกยืมตัวมา — ตัดสินด้วยไลน์ปลายทางที่ผู้เรียก resolve มาแล้ว', () => {
  const borrowed = { staff_kind: 'shopfloor', section: 'PD4', line_id: 4 };   // บ้าน = LWR BAR
  assert.equal(lineAxisVerdict(borrowed, opt()), AXIS_OTHER);
  assert.equal(lineAxisVerdict(borrowed, opt({ lineId: 1 })), AXIS_IN);       // มาช่วย GOR กะนี้
});

test('partitionByLineAxis — ได้ 3 ตัวเลขที่จอต้องเขียนในรอบเดียว · offAxis ⊂ shown', () => {
  const rows = [op(1), op(2), op(4), office(), { staff_kind: 'support', section: 'QA', line_id: 5 },
    { staff_kind: 'shopfloor', section: 'PD4', line_id: null }];
  const { shown, hidden, offAxis } = partitionByLineAxis(rows, opt());
  assert.equal(shown.length, 4);
  assert.equal(hidden.length, 2);
  assert.equal(offAxis.length, 2);
  assert.ok(offAxis.every(r => shown.includes(r)));
  // lineIdOf = ทางที่จอส่งไลน์ปลายทางของคนยืมเข้ามา
  const p2 = partitionByLineAxis([op(4)], { ...opt(), lineIdOf: () => 1 });
  assert.equal(p2.hidden.length, 0);
  assert.equal(p2.shown.length, 1);
});
