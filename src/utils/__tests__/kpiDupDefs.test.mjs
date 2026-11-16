/* ล็อกตัวจับ "KPI ซ้ำในขอบเขตเดียวกัน" ด้วยเคสจริง 2 แถวระดับ ทั้งโรงงาน ปี 2026
   (อ่านสดจาก Main 16/11 — 11300685… "Customer Satisfaction (Q&D)" 14/10 · 5c5a7e3d… "Customer Satisfaction" 19/10)
   → docs/modules/obeya-kpi-board.md §KPI ซ้ำในขอบเขตเดียวกัน */
import test from 'node:test';
import assert from 'node:assert/strict';
import { findDupDefs, dupGroupFacts, defFamilyOf, DUP_REASONS, dupReasonLabel } from '../kpiDupDefs.js';

const PLANT_REAL = [
  { id: '11300685', scope_kind: 'plant', scope_value: null, name: 'Customer Satisfaction (Q&D)',
    std_item_id: '477be2fb', created_at: '2026-10-14 09:54:42+00', weight: null },
  { id: '5c5a7e3d', scope_kind: 'plant', scope_value: null, name: 'Customer Satisfaction',
    std_item_id: null, catalog_id: '9a7e3d90', created_at: '2026-10-19 09:15:47+00', weight: 5 },
];

test('🔴 เคสจริง: 2 แถว active ระดับโรงงาน ชื่อต่างแค่ (Q&D) ⇒ ต้องฟ้องว่าซ้ำ', () => {
  const dups = findDupDefs(PLANT_REAL);
  assert.equal(dups.length, 1, 'ต้องได้ 1 กลุ่ม ไม่ใช่ 4 บรรทัดจาก 4 เหตุ');
  const g = dups[0];
  assert.equal(g.reason, 'family');                                 // ชื่อ/ทะเบียนไม่ตรง — จับได้ที่ตระกูลหัวข้อ
  assert.deepEqual(g.rows.map(r => r.id), ['11300685', '5c5a7e3d']); // ของเก่าอยู่ก่อน (created_at)
  assert.equal(g.scopeKey, 'plant|');
  assert.ok(DUP_REASONS[g.reason]);
  assert.equal(dupReasonLabel('family'), 'หัวข้อเดียวกัน (ต่างแค่วงเล็บ)');
  assert.equal(DUP_REASONS.family.sure, false);                     // เป็นข้อสงสัย ⇒ จอต้องให้คนตัดสิน
});

test('ซ้ำเพราะผูกทะเบียนมาตรฐานข้อเดียวกัน = เหตุที่แน่นอนกว่าชื่อ', () => {
  const rows = [
    { id: 'a', scope_kind: 'section', scope_value: 'PD3', name: 'Customer Satisfaction', std_item_id: 'X', created_at: '2026-01-01' },
    { id: 'b', scope_kind: 'section', scope_value: 'PD3', name: 'ความพึงพอใจลูกค้า',      std_item_id: 'X', created_at: '2026-02-01' },
  ];
  const g = findDupDefs(rows)[0];
  assert.equal(g.reason, 'std_item');
  assert.equal(DUP_REASONS.std_item.sure, true);
  assert.equal(g.rows.length, 2);
});

test('ขอบเขตต่างกัน = ไม่ซ้ำ (KPI ชื่อเดียวกันทุกส่วนงานเป็นเรื่องปกติ)', () => {
  const rows = [
    { id: 'a', scope_kind: 'section', scope_value: 'PD3', name: 'Customer Satisfaction', std_item_id: 'X', created_at: '2026-01-01' },
    { id: 'b', scope_kind: 'section', scope_value: 'PD4', name: 'Customer Satisfaction', std_item_id: 'X', created_at: '2026-01-01' },
    { id: 'c', scope_kind: 'plant',   scope_value: null,  name: 'Customer Satisfaction', std_item_id: 'X', created_at: '2026-01-01' },
  ];
  assert.deepEqual(findDupDefs(rows), []);
});

test('ขอบเขตที่ canonical แล้วชนกัน (CC ↔ หน่วยเจ้าของ) = ซ้ำ — ผ่าน scopeKeyOf ที่หน้าส่งเข้ามา', () => {
  const rows = [
    { id: 'a', scope_kind: 'section',     scope_value: 'PD1',        name: 'Customer Satisfaction', created_at: '2026-01-01' },
    { id: 'b', scope_kind: 'cost_center', scope_value: '2140461000', name: 'Customer Satisfaction', created_at: '2026-02-01' },
  ];
  assert.deepEqual(findDupDefs(rows), []);                             // คีย์ดิบ = คนละขอบเขต
  const own = { '2140461000': 'PD1' };
  const dups = findDupDefs(rows, { scopeKeyOf: r => `u|${own[r.scope_value] || r.scope_value || ''}` });
  assert.equal(dups.length, 1);
  assert.equal(dups[0].reason, 'name');
});

test('KPI ชื่อคล้ายแต่คนละตัวจริง = ห้ามฟ้อง (PPM 3 ตัวตามทะเบียน QA/ผลิต)', () => {
  const rows = [
    { id: 'a', scope_kind: 'section', scope_value: 'QA', name: 'Internal Quality Rate',  created_at: '2026-01-01' },
    { id: 'b', scope_kind: 'section', scope_value: 'QA', name: 'Incoming Quality Rate',  created_at: '2026-01-01' },
    { id: 'c', scope_kind: 'section', scope_value: 'QA', name: 'Customer Claim',         created_at: '2026-01-01' },
  ];
  assert.deepEqual(findDupDefs(rows), []);
  assert.equal(defFamilyOf({ name: 'Internal Quality Rate' }), null);
  assert.ok(defFamilyOf({ name: 'Customer Satisfaction (Q&D)' }));
});

test('Internal Satisfaction ไม่ถูกจับคู่กับ Customer Satisfaction (คนละหัวข้อในทะเบียน)', () => {
  const rows = [
    { id: 'a', scope_kind: 'section', scope_value: 'Tooling MTN', name: 'Internal Satisfaction',       created_at: '2026-01-01' },
    { id: 'b', scope_kind: 'section', scope_value: 'Tooling MTN', name: 'Customer Satisfaction (Q&D)', created_at: '2026-02-01' },
  ];
  assert.deepEqual(findDupDefs(rows), []);
});

test('🔴 ข้อมูลประกอบการตัดสินใจ: แต่ละแถวมีคนกรอกไว้กี่เดือน (ระบบห้ามเลือกให้)', () => {
  const entries = {
    11300685: { 1: 100, 2: 91.67, 9: 100, 10: 87.5 },
    '5c5a7e3d': { 1: 100, 2: 91.67, 9: 93.75, 10: null },
  };
  const facts = dupGroupFacts(findDupDefs(PLANT_REAL)[0], entries);
  assert.deepEqual(facts.map(f => f.filled), [4, 3]);            // null ไม่นับว่ากรอก
  assert.equal(facts[0].stdItemId, '477be2fb');
  assert.equal(facts[1].weight, 5);
  assert.deepEqual(facts[1].months.map(m => m.month), [1, 2, 9]);
  assert.deepEqual(dupGroupFacts(null, {}), []);
});

test('แถวเดียว / ข้อมูลพิการ = ไม่ฟ้อง ไม่ throw', () => {
  assert.deepEqual(findDupDefs([]), []);
  assert.deepEqual(findDupDefs(null), []);
  assert.deepEqual(findDupDefs([{ id: 'a', name: 'X' }, { name: 'X' }, null]), []);   // แถวไม่มี id = ข้าม
});
