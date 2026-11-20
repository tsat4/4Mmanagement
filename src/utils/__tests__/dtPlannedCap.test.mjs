/* ══ 🧾 เพดานของ "หยุดตามแผน" (oee.js §เพดาน · 2026-11-16 · คำสั่ง user) ══════════════════
   "set up machine ควรจะมีเพดานของ planned เกินกว่านี้ ออกไปเป็น unplanned
    เปลี่ยน cap tip มันหมวดเดียวกับ setup ควรมีเพดาน" + "ควรจะเซ็ทได้ ไม่ฮาร์ดโค้ด" */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dtPlannedSplit, computeSessionOee, dtMinBySession } from '../oee.js';

const row = (category, cap) => ({ dr_downtime_types: { category, planned_cap_min: cap } });

test('🔴 ไม่ได้ตั้งเพดาน = พฤติกรรมเดิมเป๊ะ (ห้ามเดาเพดานให้ใคร)', () => {
  for (const cap of [null, undefined]) {
    assert.deepEqual(dtPlannedSplit(row('planned', cap), 60), { planned: 60, unplanned: 0, overMin: 0 });
  }
  // ค่าที่อ่านไม่ออก = ไม่มีเพดาน (fail-safe ฝั่งเดิม ไม่ใช่ตัดเป็น 0)
  assert.equal(dtPlannedSplit(row('planned', 'abc'), 60).planned, 60);
  // ไม่ได้ join ทะเบียนมา = ไม่มีเพดาน (คิวรีที่ลืม select ต้องไม่เปลี่ยนเลขเงียบๆ)
  assert.equal(dtPlannedSplit({ dr_downtime_types: { category: 'planned' } }, 60).planned, 60);
});

test('🔴 เกินเพดาน = ส่วนเกินไหลไปเป็น unplanned', () => {
  assert.deepEqual(dtPlannedSplit(row('planned', 30), 60), { planned: 30, unplanned: 30, overMin: 30 });
  assert.deepEqual(dtPlannedSplit(row('planned', 30), 20), { planned: 20, unplanned: 0, overMin: 0 });
  assert.deepEqual(dtPlannedSplit(row('planned', 0), 15),  { planned: 0, unplanned: 15, overMin: 15 });
});

test('🔴 ใบนอกแผน ไม่ถูกเพดานแตะ', () => {
  assert.deepEqual(dtPlannedSplit(row('unplanned', 30), 60), { planned: 0, unplanned: 60, overMin: 0 });
});

test('🔀 ไลน์ขนาน — เพดานคิดก่อนหารเลน (ไม่งั้นเพดานไม่มีวันทำงาน)', () => {
  const r = dtPlannedSplit(row('planned', 30), 60, 1 / 6);
  assert.equal(r.planned, 5); assert.equal(r.unplanned, 5);
});

/* ── ผลต่อ OEE จริง ─────────────────────────────────────────────────────────── */
const WD = '2026-11-16';
const sess = { work_date: WD, shift: 'day', line_name: 'L', start_time: '08:00:00', end_time: '17:30:00' };
const ord = { id: 'o', mat_no: 'M', status: 'confirmed', qty: 100, qty_ok: 100,
  opened_at: `${WD}T08:00:00`, confirmed_at: `${WD}T17:30:00` };
const P = [{ mat_no: 'M', cycle_time_sec: 60, name: 'X', p_no: 'PN', pair_mat_no: null }];
const dt = (cap) => [{ id: 'd', started_at: `${WD}T09:00:00`, ended_at: `${WD}T11:00:00`, duration_min: 120,
  dr_downtime_types: { category: 'planned', name_th: 'Set up', planned_cap_min: cap } }];
const run = (cap) => computeSessionOee({ session: sess, orders: [ord], downtimes: dt(cap),
  products: P, ngQty: 0, endTime: '17:30:00' });

test('🔴 ตั้งเพดานแล้ว %A ต้องตกตามจริง — และ %P ต้องไม่ขยับ (เวลาเดินเครื่องเท่าเดิม)', () => {
  const before = run(null), after = run(30);
  assert.equal(before.loggedPlannedDT, 120);
  assert.equal(after.loggedPlannedDT, 30);
  assert.equal(after.loggedUnplannedDT, 90);
  assert.equal(after.plannedOverMin, 90);
  assert.ok(after.A < before.A, 'เวลาที่เคยถูกตัดออกจากฐาน ต้องกลับมาหักจาก %A');
  assert.equal(before.A, 1);
  assert.equal(Math.round(after.runMin), Math.round(before.runMin), 'เวลาเดินเครื่องต้องเท่าเดิม');
  assert.equal(after.P, before.P, '%P ต้องไม่เปลี่ยน — ย้ายหมวดไม่ได้ทำให้เครื่องเดินมากขึ้น/น้อยลง');
});

test('🔴 dtMinBySession ก็ต้องใช้เพดานชุดเดียวกัน (ค่าเฉลี่ยถ่วงน้ำหนักต้องตรงกับจอปิดกะ)', () => {
  const s = { id: 's1', ...sess, shift_min: 570 };
  const rows = dt(30).map(d => ({ ...d, session_id: 's1' }));
  const out = dtMinBySession([s], rows, []);
  assert.equal(Math.round(out.s1.planned), 30);
  assert.equal(Math.round(out.s1.unplanned), 90);
});
