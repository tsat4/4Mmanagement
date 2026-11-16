/* 🏭 OEE รายจิ๊กจากข้อมูลเครื่อง — สูตรของ ESM · ไม่รู้ = null + เหตุผล · idle สั้น = เวลาเดิน · หยุดสั้น fault = เสีย P */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shiftBounds, aggregateStops, aggregateFromRollup, machineShiftOee, jigCt, stateSegments, hourlyBuckets, stopList, stopPareto, pct1,
} from '../machineOee.js';

const bkk = (s) => new Date(`${s}+07:00`).toISOString();
const W = shiftBounds('2026-11-13', 'day');

test('กรอบกะ: เช้า 08–20 · ดึก 20–08 วันถัดไป · ผิดรูป = null', () => {
  assert.equal(W.startMs, Date.parse(bkk('2026-11-13T08:00:00')));
  assert.equal(shiftBounds('2026-11-13', 'night').endMs, Date.parse(bkk('2026-11-14T08:00:00')));
  assert.equal(shiftBounds('x', 'day'), null);
  assert.equal(shiftBounds('2026-11-13', 'evening'), null);
});

test('จำลองจอ Node-RED 13/11 JTSRA03-04: แผน 254 · Alarm 4 · Idle≥2 33 ⇒ A ≈ 85.3% · 311 ชิ้น × 40s ⇒ P ≈ 95.6%', () => {
  const agg = aggregateFromRollup([
    { state: 'no_plan', is_minor: false, sec: 105 * 60, n: 2 },
    { state: 'planned_stop', is_minor: false, sec: 95 * 60, n: 12 },
    { state: 'fault', is_minor: false, sec: 4 * 60, n: 1 },
    { state: 'idle', is_minor: false, sec: 33 * 60, n: 6 },
    { state: 'idle', is_minor: true, sec: 90 * 60, n: 300 },     // จังหวะโหลดงาน = เวลาเดิน
  ]);
  const r = machineShiftOee({ agg, pieces: 311, ngPeople: 0, elapsedSec: 454 * 60, ct: 40 });
  assert.equal(Math.round(r.plannedSec / 60), 254);
  assert.equal(Math.round(r.operatingSec / 60), 217);
  assert.equal(pct1(r.A), 85.4);
  assert.equal(pct1(r.P), 95.5);
  assert.equal(pct1(r.Q), 100);
  assert.equal(r.counts.alarm, 1);
  assert.equal(Math.round(r.mttrMin), 4);
  assert.equal(Math.round(r.mtbfMin), 217);
  assert.equal(Math.round(r.avgCycleSec), 42);
});

test('หยุดสั้นของ Alarm = เสีย P ไม่ใช่ A · น้ำตกเวลาครบทุกก้อน', () => {
  const agg = aggregateFromRollup([{ state: 'fault', is_minor: true, sec: 120, n: 2 }]);
  const r = machineShiftOee({ agg, pieces: 100, ngPeople: 5, ngMachine: 3, elapsedSec: 3600, ct: 30 });
  assert.equal(r.A, 1);
  assert.equal(r.minorSec, 120);
  assert.equal(r.waterfall.netSec, 3000);
  assert.equal(r.waterfall.speedSec, 3600 - 120 - 3000);
  assert.equal(r.waterfall.ngSec, 150);
  assert.equal(r.waterfall.fullySec, 2850);
  assert.equal(r.good, 95);
  assert.equal(r.ngMachine, 3);
});

test('ไม่รู้ = null + เหตุผล (ไม่มี CT / ไม่มีใบ / ไม่มีชิ้น) ห้ามคืน 0', () => {
  const agg = {};
  const a = machineShiftOee({ agg, pieces: 50, ngPeople: null, elapsedSec: 3600, ct: null });
  assert.equal(a.P, null); assert.equal(a.Q, null); assert.equal(a.oee, null);
  assert.ok(a.why.includes('no_ct') && a.why.includes('no_people_q'));
  assert.equal(a.A, 1);
  const b = machineShiftOee({ agg, pieces: null, ngPeople: 0, elapsedSec: 3600, ct: 40 });
  assert.equal(b.P, null); assert.ok(b.why.includes('no_pieces'));
  const c = machineShiftOee({ agg: aggregateFromRollup([{ state: 'no_plan', is_minor: false, sec: 3600, n: 1 }]), pieces: 0, ngPeople: 0, elapsedSec: 3600, ct: 40 });
  assert.equal(c.A, null); assert.ok(c.why.includes('no_planned_time'));
});

test('P เกิน 100% = ตัดที่ 100 แต่ชูธง pOver (ห้ามกลืนเงียบ) · ขาดการสื่อสาร = กันออก+บอก', () => {
  const r = machineShiftOee({ agg: aggregateFromRollup([{ state: 'comm_loss', is_minor: false, sec: 600, n: 1 }]), pieces: 200, ngPeople: 0, elapsedSec: 3600, ct: 30 });
  assert.equal(r.plannedSec, 3000);
  assert.equal(r.P, 1); assert.equal(r.pOver, true);
  assert.ok(r.why.includes('comm_loss'));
});

test('CT ของจิ๊ก: จากใบบนจิ๊ก · ไม่มีใบ/ไม่มี CT = null · หลาย MAT CT ต่างกัน = ถ่วงยอด + mixed', () => {
  assert.deepEqual(jigCt([], {}).why, 'no_order');
  assert.equal(jigCt([{ mat_no: 'A' }], {}).why, 'no_ct');
  assert.equal(jigCt([{ mat_no: 'A' }, { mat_no: 'A' }], { A: 40 }).ct, 40);
  const m = jigCt([{ mat_no: 'A', qty_ok: 30 }, { mat_no: 'B', qty_ok: 10 }], { A: 40, B: 80 });
  assert.equal(m.ct, 50); assert.equal(m.mixed, true);
});

test('aggregateStops ตัดตามกรอบ + นับครั้งเฉพาะที่เริ่มในกรอบ', () => {
  const a = aggregateStops([
    { state: 'fault', started_at: bkk('2026-11-13T07:50:00'), ended_at: bkk('2026-11-13T08:10:00') },
    { state: 'idle', is_minor: true, started_at: bkk('2026-11-13T09:00:00'), duration_sec: 30 },
  ], W);
  assert.equal(a.fault.sec, 600); assert.equal(a.fault.n, 0);
  assert.equal(a.idle.minorSec, 30); assert.equal(a.idle.minorN, 1);
});

test('แถบสถานะ: ช่องว่าง = เดิน · idle สั้น = เดิน · fault สั้น = หยุดสั้น · ครอบทั้งกรอบไม่มีรู', () => {
  const win = { startMs: Date.parse(bkk('2026-11-13T09:00:00')), endMs: Date.parse(bkk('2026-11-13T10:00:00')) };
  const segs = stateSegments([
    { state: 'idle', is_minor: true, started_at: bkk('2026-11-13T09:10:00'), ended_at: bkk('2026-11-13T09:10:30') },
    { state: 'fault', is_minor: true, started_at: bkk('2026-11-13T09:20:00'), ended_at: bkk('2026-11-13T09:21:00'), reason_text: 'x' },
    { state: 'planned_stop', started_at: bkk('2026-11-13T09:50:00'), ended_at: bkk('2026-11-13T10:10:00') },
  ], win);
  assert.deepEqual(segs.map(s => s.kind), ['run', 'minor', 'run', 'planned_stop']);
  assert.equal(segs[0].startMs, win.startMs);
  assert.equal(segs[segs.length - 1].endMs, win.endMs);
  for (let i = 1; i < segs.length; i++) assert.equal(segs[i].startMs, segs[i - 1].endMs);
});

test('รายชั่วโมง: เป้า = เวลาแผน ÷ CT (หักพัก) · ชั่วโมงที่ยังไม่ถึง = future · ไม่มีแถวนับ = null', () => {
  const hourly = [{ hour_at: bkk('2026-11-13T10:00:00'), qty: 60, ng: 0 }];
  const ev = [{ state: 'planned_stop', started_at: bkk('2026-11-13T10:00:00'), ended_at: bkk('2026-11-13T10:10:00') }];
  const b = hourlyBuckets({ hourly, events: ev, ...W, nowMs: Date.parse(bkk('2026-11-13T11:30:00')), ct: 40 });
  assert.equal(b.length, 12);
  const h10 = b.find(x => x.hourMs === Date.parse(bkk('2026-11-13T10:00:00')));
  assert.equal(h10.plannedSec, 3000); assert.equal(h10.target, 75); assert.equal(h10.qty, 60);
  assert.equal(Math.round(h10.oee * 100), 80);
  assert.equal(b[0].qty, null);
  assert.equal(b[11].future, true);
  assert.equal(b[3].plannedSec, 1800);   // 11:00–11:30
});

test('รายการหยุด/พาเรโต: ไม่รวมหยุดสั้น idle และไม่มีแผน · พาเรโตรวมตามสาเหตุ', () => {
  const ev = [
    { state: 'fault', started_at: bkk('2026-11-13T11:51:00'), ended_at: bkk('2026-11-13T11:55:00'), reason_code: 15, reason_text: 'Robot Water Flow Error' },
    { state: 'idle', started_at: bkk('2026-11-13T12:45:00'), ended_at: bkk('2026-11-13T12:51:00') },
    { state: 'idle', is_minor: true, started_at: bkk('2026-11-13T13:00:00'), ended_at: bkk('2026-11-13T13:00:20') },
    { state: 'no_plan', started_at: bkk('2026-11-13T08:00:00'), ended_at: bkk('2026-11-13T09:00:00') },
  ];
  assert.deepEqual(stopList(ev, W).map(s => s.state), ['idle', 'fault']);
  const p = stopPareto(ev, W);
  assert.deepEqual(p.map(x => [x.state, Math.round(x.min)]), [['idle', 6], ['fault', 4]]);
});

test('🍱 พักแบบโควตานาที (ทาง A · ยึด duration): กดพักเกินนโยบาย = เสีย A · กดพักน้อยกว่า = หักโควตาที่เหลือจาก Idle', async () => {
  const { aggregateStops: agS, machineShiftOee: mso, BREAK_PRESS } = await import('../machineOee.js');
  const breakCodes = new Set([2, 3, 4]);
  const W2 = { startMs: Date.parse(bkk('2026-11-13T08:00:00')), endMs: Date.parse(bkk('2026-11-13T16:00:00')) };
  // กดพัก 15 + 55 + 10 = 80 นาที · โควตานโยบาย 70 นาที (10+50+10) ⇒ เกิน 10 นาที
  const ev = [
    { state: 'planned_stop', reason_code: 2, started_at: bkk('2026-11-13T10:05:00'), duration_sec: 15 * 60 },
    { state: 'planned_stop', reason_code: 3, started_at: bkk('2026-11-13T11:55:00'), duration_sec: 55 * 60 },
    { state: 'planned_stop', reason_code: 4, started_at: bkk('2026-11-13T14:59:00'), duration_sec: 10 * 60 },
    { state: 'planned_stop', reason_code: 21, started_at: bkk('2026-11-13T13:00:00'), duration_sec: 60 },     // Tip dressing = หยุดตามแผน ไม่ใช่พัก
  ];
  const agg = agS(ev, W2, breakCodes);
  assert.equal(agg[BREAK_PRESS].sec, 80 * 60);
  assert.equal(agg.planned_stop.sec, 60);
  const r = mso({ agg, pieces: 0, ngPeople: 0, elapsedSec: 480 * 60, ct: 40, policyBreakSec: 70 * 60 });
  assert.equal(r.loss.breakOver, 10 * 60);
  assert.equal(r.plannedSec, (480 - 70 - 1) * 60);
  assert.equal(r.downSec, 10 * 60);
  assert.ok(!r.why.includes('no_break_policy'));

  // ไม่ได้กดพักเลย — เครื่องขึ้น Idle 75 นาที · โควตา 70 ⇒ หัก Idle 70 เหลือเสีย 5
  const agg2 = agS([{ state: 'idle', started_at: bkk('2026-11-13T12:00:00'), duration_sec: 75 * 60 }], W2, breakCodes);
  const r2 = mso({ agg: agg2, pieces: 0, ngPeople: 0, elapsedSec: 480 * 60, ct: 40, policyBreakSec: 70 * 60 });
  assert.equal(r2.loss.idleAbsorbedSec, 70 * 60);
  assert.equal(r2.loss.idle, 5 * 60);
  assert.equal(r2.loss.breakOver, 0);
  assert.equal(r2.operatingSec, (480 - 70 - 5) * 60);
});

test('⏱️ ระยะเวลายึด duration_sec ของต้นทางก่อน ended_at (นาฬิกา PLC คลาด)', async () => {
  const { evSpan } = await import('../machineOee.js');
  const sp = evSpan({ started_at: bkk('2026-11-13T10:00:00'), ended_at: bkk('2026-11-13T10:09:00'), duration_sec: 300 });
  assert.equal((sp[1] - sp[0]) / 1000, 300);
  const sp2 = evSpan({ started_at: bkk('2026-11-13T10:00:00'), ended_at: bkk('2026-11-13T10:09:00') });
  assert.equal((sp2[1] - sp2[0]) / 1000, 540);
  assert.equal(evSpan({ started_at: null, duration_sec: 5 }), null);
});
