/* 🤝 borrowDays — มุมมองสะสม "คนของไลน์เราถูกยืมออกไปกี่วัน" (2026-11-16)
   เคสจริงที่คุม: หน้างานบ่น "ยืมแล้วไม่ยอมคืน เจ้าของจะมองไม่เห็นรึป่าว"
   `now` ถูกตรึงทุกเทส — `npm test` รันรอบ "นาฬิกา +400 วัน" ด้วย */
import test from 'node:test';
import assert from 'node:assert/strict';
import { borrowWindow, spanDays, summarizeBorrowOut, BORROW_WINDOW_DAYS } from '../borrowDays.js';

/* ไลน์: 1 GOR (แม่) · 2 Assy GOR (ลูก) · 9 LINE APRON ASSY (ไลน์ที่ยืมคนไปจริง) */
const FAMILY = { 1: new Set([1, 2]), 2: new Set([1, 2]), 9: new Set([9]) };
const HOME = { 101: 1, 102: 1, 103: 2, 104: null };
const NAME = { 101: 'ธันยบูรณ์', 102: 'พรนิมิต', 103: 'สุชิน', 104: 'คนไม่มีไลน์' };
const LINE_NAME = { 1: 'GOR', 2: 'Assy GOR', 9: 'LINE APRON ASSY' };
const OPTS = {
  homeLineOf: (id) => HOME[id],
  familyOf:   (id) => FAMILY[id],
  nameOf:     (id) => NAME[id],
  lineNameOf: (id) => LINE_NAME[id],
};
const row = (employee_id, work_date, to_line_id, shift = 'day') =>
  ({ employee_id, work_date, to_line_id, shift });

test('borrowWindow — นับรวมวันนี้ · ก่อน 08:00 = วันทำงานก่อนหน้า (getWorkDate)', () => {
  assert.deepEqual(borrowWindow(30, new Date(2026, 10, 16, 10, 0)),
    { from: '2026-10-18', to: '2026-11-16', days: 30 });
  // 07:30 = ยังเป็นวันงานของเมื่อวาน
  assert.deepEqual(borrowWindow(30, new Date(2026, 10, 16, 7, 30)),
    { from: '2026-10-17', to: '2026-11-15', days: 30 });
  assert.equal(borrowWindow(1, new Date(2026, 10, 16, 10, 0)).from, '2026-11-16');
  assert.equal(borrowWindow(0, new Date(2026, 10, 16, 10, 0)).days, 1);   // ต่ำสุด 1 วัน
  assert.equal(BORROW_WINDOW_DAYS, 30);
});

test('spanDays — คาบวันแบบ inclusive · แกะไม่ออก = null (ห้ามเดา 0)', () => {
  assert.equal(spanDays('2026-11-01', '2026-11-01'), 1);
  assert.equal(spanDays('2026-10-15', '2026-11-15'), 32);   // ธันยบูรณ์: 9 วัน ในช่วง 32 วัน
  assert.equal(spanDays('2026-11-15', '2026-10-15'), 32);   // สลับลำดับก็ได้ค่าเดิม
  assert.equal(spanDays('', '2026-11-01'), null);
  assert.equal(spanDays('ไม่ใช่วันที่', '2026-11-01'), null);
});

test('🔴 1 วัน = 1 วัน ไม่ว่าถูกยืมกี่กะ (days ไม่ใช่จำนวนแถว)', () => {
  const r = summarizeBorrowOut([
    row(101, '2026-11-10', 9, 'day'), row(101, '2026-11-10', 9, 'night'),
    row(101, '2026-11-11', 9, 'day'),
  ], OPTS);
  assert.equal(r.people.length, 1);
  assert.equal(r.people[0].days, 2);
  assert.equal(r.people[0].shifts, 3);
  assert.equal(r.totalDays, 2);
});

test('🔴 ยืมภายในครอบครัวไลน์เดิม (แม่↔ลูก) ไม่นับว่า "ถูกยืมออก"', () => {
  const r = summarizeBorrowOut([
    row(101, '2026-11-10', 1), row(101, '2026-11-11', 2), row(103, '2026-11-11', 1),
  ], OPTS);
  assert.equal(r.people.length, 0);
  assert.equal(r.insideFamily, 3);
  assert.equal(r.totalDays, 0);
});

test('🔴 ไม่รู้ไลน์บ้าน = ไม่นับ แต่ต้องรายงานจำนวน (ห้ามเงียบ)', () => {
  const r = summarizeBorrowOut([row(104, '2026-11-10', 9), row(999, '2026-11-10', 9)], OPTS);
  assert.equal(r.people.length, 0);
  assert.equal(r.unknownHome, 2);
});

test('แถวพิการ (ไม่มีคน/ไม่มีวัน) = skipped ไม่ใช่ครึ่งๆ กลางๆ', () => {
  const r = summarizeBorrowOut([{ to_line_id: 9 }, row(null, '2026-11-10', 9), null], OPTS);
  assert.equal(r.people.length, 0);
  assert.equal(r.skipped, 3);
  assert.deepEqual(summarizeBorrowOut(undefined, OPTS).people, []);
});

test('`mine` กรองเฉพาะคนของเรา (รายชื่อที่จอโหลดมา) · ที่เหลือเข้า skipped', () => {
  const rows = [row(101, '2026-11-10', 9), row(102, '2026-11-10', 9)];
  const r = summarizeBorrowOut(rows, { ...OPTS, mine: (id) => id === 101 });
  assert.deepEqual(r.people.map(p => p.id), [101]);
  assert.equal(r.skipped, 1);
});

test('เรียงวันมาก→น้อย · ปลายทางรวมรายไลน์ · ช่วงกว้างบอกว่า "ยืมซ้ำยาวแค่ไหน"', () => {
  const rows = [
    ...['2026-10-15', '2026-10-20', '2026-10-28', '2026-11-02', '2026-11-05',
        '2026-11-08', '2026-11-11', '2026-11-13', '2026-11-15'].map(d => row(101, d, 9)),
    row(102, '2026-11-01', 9), row(102, '2026-11-02', 9), row(102, '2026-11-03', 1),
    row(103, '2026-11-04', 9),
  ];
  const r = summarizeBorrowOut(rows, OPTS);
  assert.deepEqual(r.people.map(p => [p.name, p.days]), [['ธันยบูรณ์', 9], ['พรนิมิต', 2], ['สุชิน', 1]]);
  const a = r.people[0];
  assert.equal(a.span, 32);
  assert.equal(a.firstDate, '2026-10-15');
  assert.equal(a.lastDate, '2026-11-15');
  assert.equal(a.homeLineName, 'GOR');
  assert.deepEqual(a.toLines, [{ id: 9, name: 'LINE APRON ASSY', days: 9 }]);
  // พรนิมิต: แถวที่ 3 ไปไลน์บ้านตัวเอง (1) ⇒ ไม่นับ
  assert.equal(r.people[1].days, 2);
  assert.equal(r.insideFamily, 1);
  assert.equal(r.totalDays, 12);
});

test('ไม่มี nameOf/lineNameOf = ใช้สำเนาชื่อในแถว (emp_name/to_line_name) แล้วค่อย #id', () => {
  const r = summarizeBorrowOut([
    { employee_id: 101, work_date: '2026-11-10', to_line_id: 9, emp_name: 'ชื่อในแถว', to_line_name: 'ไลน์ในแถว' },
    { employee_id: 102, work_date: '2026-11-10', to_line_id: 9 },
  ], { homeLineOf: (id) => HOME[id], familyOf: (id) => FAMILY[id] });
  assert.equal(r.people.find(p => p.id === 101).name, 'ชื่อในแถว');
  assert.equal(r.people.find(p => p.id === 101).toLines[0].name, 'ไลน์ในแถว');
  assert.equal(r.people.find(p => p.id === 102).name, '#102');
  assert.equal(r.people.find(p => p.id === 102).toLines[0].name, 'ไลน์อื่น');
});
