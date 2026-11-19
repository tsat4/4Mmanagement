import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseQuestion, periodFromText, defaultPeriod, matchSubject, oeeSummary, downtimeTop, productionTotals,
} from '../askBot.js';

/* 💬 แชทถามข้อมูล ขั้นที่ 1 (19/11) — ล็อกตัวอ่านคำถาม + สูตรรวมผล
   ⚠️ ตรึงวันที่เองทุกเคส ห้ามอ้าง new Date() (รอบ "นาฬิกา +400 วัน") */
const T = '2026-11-19';   // วันพฤหัส

test('ประโยคจริงจาก user อ่านได้ครบ: เจตนา + ช่วง + ชื่อ', () => {
  const q = parseQuestion('ขอยอดผลิตงาน apron assy 060 ของเดือน 10 ที', T);
  assert.equal(q.intent, 'production');
  assert.equal(q.period.from, '2026-10-01');
  assert.equal(q.period.to, '2026-10-31');
  assert.equal(q.subject, 'apron assy 060');
  const q2 = parseQuestion('เดือนนี้ ผลิตงาน apron 060 ไปกี่ชิ้นแล้ว', T);
  assert.equal(q2.intent, 'production');
  assert.equal(q2.subject, 'apron 060');
  assert.deepEqual([q2.period.from, q2.period.to], ['2026-11-01', T], 'เดือนนี้ตัดที่วันนี้ ไม่ลากไปอนาคต');
});

test('เจตนา: OEE มาก่อนยอดผลิต · downtime สะกดได้หลายแบบ · ไม่รู้จัก = null (ไม่เดา)', () => {
  assert.equal(parseQuestion('oee HDF1 วันนี้', T).intent, 'oee');
  assert.equal(parseQuestion('oee การผลิต HDF1', T).intent, 'oee');
  for (const s of ['downtime สูงสุด', 'ดาวไทม์อะไรสูงสุด', 'ดาวน์ไทม์', 'เครื่องหยุดอะไรมากสุด'])
    assert.equal(parseQuestion(s, T).intent, 'downtime_top', s);
  assert.equal(parseQuestion('ยอดขายเดือนนี้', T).intent, null);
  assert.equal(parseQuestion('สวัสดี', T).intent, null);
});

test('ไม่ระบุช่วง = null + บอกค่าตั้งต้นของคำถามนั้น (จอต้องเขียนว่าใช้ค่าไหน)', () => {
  const q = parseQuestion('ดาวไทม์อะไรสูงสุด', T);
  assert.equal(q.period, null);
  assert.equal(q.periodDefault, 'week');
  const d = defaultPeriod('week', T);
  assert.deepEqual([d.from, d.to, d.explicit], ['2026-11-16', T, false]);
});

test('ช่วงเวลา: เดือนระบุ · พ.ศ. · ชื่อเดือนไทย · เดือนที่ยังมาไม่ถึง = error (ห้ามเดาเป็นปีที่แล้ว)', () => {
  assert.deepEqual(periodFromText('ต.ค. 2569', T).from, '2026-10-01');
  assert.deepEqual(periodFromText('ตุลาคม', T).to, '2026-10-31');
  assert.equal(periodFromText('เดือน 2/2024', T).to, '2024-02-29', 'ปีอธิกสุรทิน');
  assert.ok(periodFromText('เดือน 12', T).error, 'ธ.ค. ปีนี้ยังมาไม่ถึง');
  assert.ok(periodFromText('เดือน 13', T).error);
  assert.deepEqual([periodFromText('เมื่อวาน', T).from], ['2026-11-18']);
  assert.deepEqual([periodFromText('เดือนที่แล้ว', '2026-01-10').from], ['2025-12-01'], 'ข้ามปี');
  assert.equal(periodFromText('hdf1', T), null);
});

test('ตัดคำฟุ่มเฟือยฝั่งอังกฤษแบบทั้งคำเท่านั้น — ชื่อที่มีคำนั้นอยู่ข้างในต้องไม่ถูกกิน', () => {
  assert.equal(parseQuestion('oee TOPPER line วันนี้', T).subject, 'topper');
  assert.equal(parseQuestion('ยอดผลิต MONTHLY-A', T).subject, 'monthly-a');
});

const LINES = [
  { name: 'HDF1' }, { name: 'HDF2' },
  { name: 'APRON ASSY 060' }, { name: 'APRON ASSY 061' },
];
const PRODUCTS = [
  { mat_no: '10100384', name: 'REINF APRON RH', p_no: 'MB3B-16C274-CF' },
  { mat_no: '10100385', name: 'REINF APRON RH', p_no: 'MB3B-16C274-CF' },   // สินค้าเดียวกัน คนละลูกค้า
  { mat_no: '90031601', name: 'OP HDF', p_no: 'X', is_operation: true },
];

test('ค้นชื่อ: ตรงตัวเดียวตอบเลย · หลายตัว = ให้เลือก (ห้ามเดา) · ตรงเป๊ะชนะ "มีคำนี้ข้างใน"', () => {
  assert.equal(matchSubject('hdf1', { lines: LINES }).pick.name, 'HDF1');
  assert.equal(matchSubject('apron assy 060', { lines: LINES, products: PRODUCTS }).pick.name, 'APRON ASSY 060');
  const many = matchSubject('hdf', { lines: LINES });
  assert.equal(many.pick, null);
  assert.deepEqual(many.choices.map(c => c.name), ['HDF1', 'HDF2']);
  assert.equal(matchSubject('zzz', { lines: LINES }).pick, null);
  assert.equal(matchSubject('zzz', { lines: LINES }).choices.length, 0);
});

test('ค้นพาร์ท: สินค้าเดียวกันหลาย MAT (แกน p_no) = ตัวเลือกเดียว · ชั้น OP ไม่ใช่พาร์ท', () => {
  const m = matchSubject('mb3b-16c274', { lines: LINES, products: PRODUCTS });
  assert.equal(m.pick.kind, 'part');
  assert.deepEqual(m.pick.mats.sort(), ['10100384', '10100385']);
  assert.equal(matchSubject('op hdf', { lines: [], products: PRODUCTS }).pick, null);
  const amb = matchSubject('apron', { lines: LINES, products: PRODUCTS });
  assert.equal(amb.pick, null, 'ชื่อไลน์กับพาร์ทชนกัน = ให้เลือก');
  assert.equal(amb.choices.length, 3);
  assert.equal(matchSubject('hdf1', { lines: LINES, products: PRODUCTS, kinds: ['line'] }).pick.kind, 'line');
});

test('OEE รวม = ถ่วงน้ำหนักตามกะ (ห้ามเฉลี่ย % ตรงๆ) · กะไม่มีค่า stamp ไม่นับแต่ต้องบอกจำนวน', () => {
  const s = oeeSummary([
    { oee: 80, oee_a: 90, oee_p: 90, oee_q: 99, shift_min: 600, actual_qty: 900, qty_ng: 0 },
    { oee: 40, oee_a: 50, oee_p: 90, oee_q: 99, shift_min: 200, actual_qty: 100, qty_ng: 0 },
    { oee: null, shift_min: 600 },
  ]);
  assert.equal(s.n, 2);
  assert.equal(s.oee, 70, '(80×600 + 40×200)/800');
  assert.equal(s.noStamp, 1);
  assert.equal(oeeSummary([]).oee, null, 'ไม่มีกะ = null ไม่ใช่ 0');
});

test('downtime สูงสุด: ไม่นับหยุดตามแผน · "อื่นๆ" แตกตามเครื่อง ไม่ขึ้นอันดับ 1 เป็นก้อนเดียว', () => {
  const T1 = { name_th: 'แม่พิมพ์เสีย', category: 'unplanned' };
  const OTHER = { name_th: 'อื่นๆ', category: 'unplanned' };
  const r = downtimeTop([
    { duration_min: 30, dr_downtime_types: T1 },
    { duration_min: 50, dr_downtime_types: OTHER, machine_no: 'SW10' },
    { duration_min: 50, dr_downtime_types: OTHER, machine_no: 'SW11' },
    { duration_min: 500, dr_downtime_types: { name_th: 'ประชุม', category: 'planned' } },
  ]);
  assert.equal(r.total, 130);
  assert.equal(r.plannedExcluded, 1);
  assert.equal(r.top.length, 3, 'อื่นๆ 2 เครื่อง = 2 แท่ง');
  assert.ok(!r.top.some(e => e.name === 'อื่นๆ'), 'ห้ามมีแท่ง "อื่นๆ" ก้อนเดียว');
  assert.equal(r.trash.vague, 2);
});

test('ยอดผลิต = ชิ้น: งานคู่ RH/LH นับแยก · ชั้น OP ยุบเข้าพาร์ทจริง · ใบไม่มี MAT ยังนับ', () => {
  const conf = (mat_no, qty) => ({ mat_no, status: 'confirmed', qty, qty_ok: qty });
  const t = productionTotals([
    conf('RH', 100), conf('LH', 100),                   // คู่ — ห้ามยุบเหลือ 100
    conf('OP1', 50), conf('OP2', 50),                   // 2 ขั้นของชิ้นเดียวกัน (พาร์ทจริงไม่อยู่ในชุด) = 50
    { mat_no: null, status: 'open', qty_actual: 7 },
  ], { OP1: { parent: 'FG' }, OP2: { parent: 'FG' } });
  assert.equal(t.total, 100 + 100 + 50 + 7);
  assert.equal(t.noMat, 7);
  assert.equal(productionTotals([]).total, 0);
});

test('OEE รวม: หยุดตามแผนลดน้ำหนักกะผ่าน dtMinBySession (ไม่ใช่รวมนาทีเอง)', () => {
  const S = (id, oee) => ({ id, oee, oee_a: oee, oee_p: 100, oee_q: 100, shift_min: 600, work_date: '2026-11-10', shift: 'day', start_time: '2026-11-10T01:00:00Z', actual_qty: 1 });
  const dts = [{ session_id: 'a', duration_min: 300, started_at: '2026-11-10T02:00:00Z', ended_at: '2026-11-10T07:00:00Z',
    dr_downtime_types: { name_th: 'PM', category: 'planned', planned_cap_min: null } }];
  const s = oeeSummary([S('a', 90), S('b', 60)], dts, []);
  assert.equal(s.oee, 70, 'กะ a น้ำหนัก 300 · กะ b 600 ⇒ (90×300+60×600)/900');
});

test('downtime สูงสุด: หยุดตามแผนเกินเพดานของประเภท = ส่วนเกินนับเป็นนอกแผน', () => {
  const r = downtimeTop([{ duration_min: 50, dr_downtime_types: { name_th: 'Set up Machine', category: 'planned', planned_cap_min: 30 } }]);
  assert.equal(r.total, 20);
  assert.equal(r.overMin, 20);
  assert.equal(r.plannedExcluded, 0);
});

test('ชื่อไทยต้องไม่ถูกตัดกลางพยางค์ · ตัวเลขต้องตรงทั้งตัว (เคสจริงตอนลองถาม 19/11)', () => {
  assert.equal(parseQuestion('oee ชุดที่ 1 เดือนนี้', T).subject, 'ชุดที่ 1');
  const L = [{ name: 'APRON ชุดที่ 1' }, { name: 'APRON ชุดที่ 10' }, { name: 'APRON ชุดที่ 12' }];
  assert.equal(matchSubject('ชุดที่ 1', { lines: L }).pick.name, 'APRON ชุดที่ 1');
  assert.equal(matchSubject('060', { lines: [{ name: 'APRON 060' }, { name: 'APRON 0601' }] }).pick.name, 'APRON 060');
});
