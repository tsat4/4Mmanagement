import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGrid, valueAt, levelState, RECUR } from '../monitorGrid.js';
import { rowDefs, boardPeriods, isStoreBoard, STORE_BOARD_KINDS, BOARD_TABS } from '../monitorBoards.js';

test('บอร์ดสโตร์: 6 ชนิด · ชุดแถว รับ/จ่าย/คงเหลือ/SAP/Diff', () => {
  assert.deepEqual(STORE_BOARD_KINDS, ['st_raw', 'st_semi', 'st_purchase', 'st_before', 'st_after', 'st_blank']);
  assert.ok(STORE_BOARD_KINDS.every((k) => BOARD_TABS.some((t) => t.key === k)));
  assert.equal(isStoreBoard({ kind: 'st_raw' }), true);
  assert.equal(isStoreBoard({ kind: 'raw' }), false);
  const rows = rowDefs({ kind: 'st_purchase' });
  assert.deepEqual(rows.map((r) => r.key), ['in', 'out', 'balance', 'sap', 'diff']);
  assert.deepEqual(rows.map((r) => r.label), ['รับ', 'จ่าย', 'คงเหลือ', 'SAP', 'Diff (SAP − คงเหลือ)']);
  assert.ok(rows.every((r) => !r.unknownRecur));
});

test('บอร์ดสโตร์ไม่ตั้ง start_date = ย้อน 7 วันจากวันทำงาน (ตรึงเวลา)', () => {
  const now = new Date('2026-11-16T10:00:00Z');   // 17:00 ไทย · 10:00 UTC — หลัง 08:00 ทั้ง 2 เขตเวลา
  const ps = boardPeriods({ kind: 'st_raw', period_kind: 'day', period_count: 22 }, { now });
  assert.equal(ps.length, 22);
  assert.equal(ps[0].key, '2026-11-09');
  assert.equal(ps[7].key, '2026-11-16');
});

test('Diff = SAP − คงเหลือ · ไม่กรอก SAP = null (ไม่ใช่ 0)', () => {
  const rows = rowDefs({ kind: 'st_semi' });
  const periods = [{ key: 'd0' }, { key: 'd1' }, { key: 'd2' }];
  const manual = (pid, rk, pk) => ({ 'sap|d1': 1040, 'sap|d2': '' })[`${rk}|${pk}`];
  const system = (pid, rk, pk) => ({ 'balance|d0': 1000, 'in|d1': 100, 'out|d1': 50, 'in|d2': 0, 'out|d2': 0 })[`${rk}|${pk}`];
  const g = buildGrid({ parts: [{ id: 1 }], periods, rows, manual, system });
  assert.equal(valueAt(g, 1, 'balance', 'd1'), 1050);
  assert.equal(valueAt(g, 1, 'diff', 'd1'), -10);
  assert.equal(valueAt(g, 1, 'diff', 'd2'), null);
  assert.equal(RECUR.sap_diff.calc(null, { sap: 0, balance: 0 }), 0);
});

test('levelState: ต่ำกว่า MIN / เกิน MAX / ในช่วง · ไม่ตั้ง = null', () => {
  assert.equal(levelState(5, { min: 10, max: 100 }), 'low');
  assert.equal(levelState(150, { min: 10, max: 100 }), 'high');
  assert.equal(levelState(50, { min: 10, max: 100 }), 'ok');
  assert.equal(levelState(50, { min: null, max: null }), null);
  assert.equal(levelState(null, { min: 10, max: 100 }), null);
  assert.equal(levelState(5, null), null);
  assert.equal(levelState(500, { min: 10, max: null }), 'ok');
});
