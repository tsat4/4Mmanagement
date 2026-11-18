/* 🧾 1 ใบ PR หลายรายการ (18/11 · หน้างานแจ้ง ข้อ 1) — เคสจริง O-MTN.2026/10-47 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { groupPrs, prGroupDefaults } from '../prGroups.js';

const row = (o) => ({ id: o.id, pr_no: o.pr_no ?? null, po_no: o.po_no ?? null, status: o.status || 'requested',
  supplier: o.supplier ?? null, gl_code: o.gl_code ?? null, gl_category: o.gl_category ?? null, item_name: o.item_name || 'x' });

test('เคสจริง 10-47 — 19 แถวเลข PR เดียวกัน = 1 กลุ่ม และบอกว่าใครตกหล่น', () => {
  const rows = [
    ...Array.from({ length: 15 }, (_, i) => row({ id: `a${i}`, pr_no: '1210104223', po_no: '4210142058', status: 'ordered', supplier: 'Abex Hydraulic', gl_code: '64161010' })),
    row({ id: 'b1', pr_no: '1210104223', po_no: '4210142058', status: 'ordered', gl_code: '64161010' }),
    row({ id: 'b2', pr_no: '1210104223', po_no: '4210142058', status: 'ordered', gl_code: '64169000' }),
    row({ id: 'c1', pr_no: '1210104223', status: 'requested', supplier: 'Abex Hydraulic', gl_code: '64161010' }),
    row({ id: 'c2', pr_no: '1210104223', status: 'requested', supplier: 'Abex Hydraulic' }),
  ];
  const g = groupPrs(rows);
  assert.equal(g.length, 1, '19 แถวเลขเดียวกัน = ใบเดียว');
  assert.equal(g[0].rows.length, 19);
  assert.equal(g[0].prNo, '1210104223');
  assert.equal(g[0].noPo.length, 2, '2 แถวที่ไม่เคยได้เลข PO');
  assert.equal(g[0].noGl.length, 1);
  assert.ok(g[0].warns.some(w => /ยังไม่มีเลข PO/.test(w)), 'ต้องบอกว่ามีแถวตกหล่น');
  assert.ok(g[0].warns.some(w => /สถานะในใบนี้ไม่ตรงกัน/.test(w)));
});

test('🔴 ยังไม่มีเลข PR = แถวละกลุ่ม ห้ามเดาว่าใบเดียวกัน', () => {
  const g = groupPrs([row({ id: '1' }), row({ id: '2' }), row({ id: '3', pr_no: 'PR1' })]);
  assert.equal(g.length, 3);
  assert.deepEqual(g.map(x => x.rows.length), [1, 1, 1]);
  assert.equal(g[0].prNo, null);
});

test('เทียบเลขแบบเดียวกับใบพิมพ์ (เว้นวรรค/ตัวพิมพ์ไม่ทำให้แตกใบ)', () => {
  const g = groupPrs([row({ id: '1', pr_no: '1210 104217' }), row({ id: '2', pr_no: '1210104217' })]);
  assert.equal(g.length, 1);
  assert.equal(g[0].prNo, '1210 104217', 'โชว์ตามที่คนกรอกไว้ครั้งแรก');
});

test('🔴 กลุ่มที่เรียบร้อยไม่ต้องเตือน · ยกเลิกแล้วไม่นับว่าสถานะไม่ตรง', () => {
  const ok = groupPrs([
    row({ id: '1', pr_no: 'P1', po_no: 'PO1', status: 'ordered', gl_code: 'G' }),
    row({ id: '2', pr_no: 'P1', po_no: 'PO1', status: 'ordered', gl_code: 'G' }),
    row({ id: '3', pr_no: 'P1', status: 'cancelled' }),
  ]);
  assert.deepEqual(ok[0].warns, [], 'ใบที่ยกเลิกไปแล้วไม่ใช่ความไม่ตรงกัน');
  assert.equal(ok[0].openRows.length, 2);
});

test('เพิ่มรายการในใบเดิม = เติมเลข PR / ผู้ขาย / GL ให้เอง', () => {
  const g = groupPrs([
    row({ id: '1', pr_no: 'P1', supplier: null, gl_code: null }),
    row({ id: '2', pr_no: 'P1', supplier: 'Abex', gl_code: '64161010', gl_category: 'service' }),
  ]);
  const d = prGroupDefaults(g[0]);
  assert.equal(d.pr_no, 'P1');
  assert.equal(d.supplier, 'Abex', 'แถวแรกไม่มีผู้ขาย ต้องไปเอาจากแถวที่มี');
  assert.equal(d.gl_code, '64161010');
  assert.equal(prGroupDefaults(null).pr_no, '');
});
