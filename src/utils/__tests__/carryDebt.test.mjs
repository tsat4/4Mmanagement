/* ของค้างที่ยังไม่มีใครรับ (src/utils/carryDebt.js)
   เทสแต่ละข้อผูกกับ feedback หน้างานจริงที่เคยทำให้ยอดค้างหาย — ห้ามลบข้อไหนออก */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carryOffers, debtPcs, debtAgeDays, debtByPart, carryAgeOf } from '../carryDebt.js';

/** นาฬิกาตรึง — ห้ามพึ่งเวลาเครื่อง (รอบเทส "นาฬิกา +400 วัน") */
const NOW = Date.parse('2026-11-17T10:00:00Z');

const R = (prod_no, status, { rank = 0, qty = 100, qty_actual = 0, mat_no = 'M1', work_date = '2026-10-01' } = {}) =>
  ({ prod_no, status, qty, qty_actual, mat_no, work_date, _rank: rank });
const rankOf = (o) => o._rank;
const call = (rows, extra = {}) => carryOffers({ rows, rankOf, ...extra });

test('ใบที่ยังค้างจริง ถูกเสนอ', () => {
  assert.deepEqual(call([R('A', 'carry_over')]).map(o => o.prod_no), ['A']);
  assert.deepEqual(call([R('A', 'open')]).map(o => o.prod_no), ['A']);
});

test('① ใบล่าสุดจบแล้ว (confirmed/cancelled) ห้ามปลุกใบเก่าขึ้นมาเสนอซ้ำ', () => {
  const rows = [R('A', 'carry_over', { rank: 2 }), R('A', 'confirmed', { rank: 0 })];
  assert.deepEqual(call(rows), []);
  const rows2 = [R('B', 'open', { rank: 3 }), R('B', 'cancelled', { rank: 1 })];
  assert.deepEqual(call(rows2), []);
});

test('② 🔴 imported ห้ามชนะ rank (เคส Assy LWR 09/09 — ไม่งั้นยอดค้างตัวจริงหาย)', () => {
  /* ใบ imported อยู่ในกะที่ "ใหม่กว่า" (rank 0) แต่ตัวจริงที่ยังค้างคือ carry_over ที่ rank 1 */
  const rows = [R('A', 'imported', { rank: 0 }), R('A', 'carry_over', { rank: 1, qty: 35, qty_actual: 25 })];
  const out = call(rows);
  assert.equal(out.length, 1);
  assert.equal(out[0].status, 'carry_over');
  assert.equal(debtPcs(out[0]), 10);          // เหลือ 10 ชิ้นที่ต้องไล่เก็บ
});

test('③ กะต้นทางยังเปิดอยู่ = ห้ามแย่ง', () => {
  const rows = [R('A', 'open')];
  assert.deepEqual(call(rows, { isTakeable: () => false }), []);
});

test('④ prod_no ที่รับเข้ากะนี้แล้ว ไม่เสนอซ้ำ', () => {
  assert.deepEqual(call([R('A', 'carry_over')], { currentProdNos: new Set(['A']) }), []);
});

test('⑤ ผลิตครบเป้าแล้ว ไม่ใช่ยอดค้าง (กัน "ผีค้าง" ทุกกะ)', () => {
  assert.deepEqual(call([R('A', 'carry_over', { qty: 100, qty_actual: 100 })]), []);
  assert.deepEqual(call([R('A', 'carry_over', { qty: 100, qty_actual: 120 })]), []);
});

test('🔴 ของที่ค้างข้ามเดือน ต้องยังถูกเสนอ (ไม่มีหน้าต่าง "8 กะล่าสุด" อีกแล้ว)', () => {
  const old = R('A', 'carry_over', { rank: 99, work_date: '2026-07-15', qty: 35, qty_actual: 29 });
  assert.deepEqual(call([old]).map(o => o.prod_no), ['A']);
  assert.equal(debtAgeDays('2026-07-15', '2026-10-20'), 97);
});

test('อายุค้าง — ไม่รู้วัน = null ห้ามคืน 0 (0 แปลว่า "ของวันนี้")', () => {
  assert.equal(debtAgeDays(null, '2026-10-20'), null);
  assert.equal(debtAgeDays('2026-10-20', null), null);
  assert.equal(debtAgeDays('ไม่ใช่วันที่', '2026-10-20'), null);
  assert.equal(debtAgeDays('2026-10-20', '2026-10-20'), 0);
  assert.equal(debtAgeDays('2026-10-25', '2026-10-20'), 0);   // วันในอนาคต = ไม่ติดลบ
});

test('สรุปหนี้ต่อพาร์ท — รวมชิ้น/ใบ + อายุเก่าสุด เรียงหนี้มากก่อน', () => {
  const offers = [
    R('A', 'carry_over', { mat_no: 'M1', qty: 100, qty_actual: 40, work_date: '2026-10-12' }),
    R('B', 'carry_over', { mat_no: 'M1', qty: 300, qty_actual: 0,  work_date: '2026-09-17' }),
    R('C', 'carry_over', { mat_no: 'M2', qty: 50,  qty_actual: 0,  work_date: '2026-10-19' }),
  ];
  const out = debtByPart(offers, '2026-10-20');
  assert.deepEqual(out.map(x => [x.mat_no, x.pcs, x.cards, x.oldestDays]), [
    ['M1', 360, 2, 33],
    ['M2', 50, 1, 1],
  ]);
});

test('อายุที่คำนวณไม่ได้ ต้องไม่ทำให้ "เก่าสุด" เพี้ยน', () => {
  const out = debtByPart([
    R('A', 'carry_over', { mat_no: 'M1', work_date: null }),
    R('B', 'carry_over', { mat_no: 'M1', work_date: '2026-10-18' }),
  ], '2026-10-20');
  assert.equal(out[0].oldestDays, 2);
});

test('ข้อมูลพัง/ว่าง ต้องไม่ระเบิด', () => {
  assert.deepEqual(carryOffers(), []);
  assert.deepEqual(carryOffers({ rows: [null, {}, { prod_no: '' }] }), []);
  assert.deepEqual(debtByPart(null, null), []);
  assert.equal(debtPcs(null), 0);
});

/* ═══ 📅 อายุของใบที่วนข้ามกะ — carryAgeOf (2026-11-17 · หัวหน้าแจ้ง) ═══════════════════
   "แท็กนี้เปิดวันที่เท่าไร … บางอันมันค้างนานแล้ว จะได้เคลียร์ก่อน"
   🔴 ค่ามาจาก DB (`first_opened_at`/`carry_hops`) ห้ามไล่หาเองจาก prod_no (การ์ดคัมบังใช้เลขซ้ำ) */
test('carryAgeOf — ใบเปิดใหม่ในกะนี้ = null (ไม่ใช่ 0)', () => {
  assert.equal(carryAgeOf({ carry_hops: 0, first_opened_at: null }, NOW), null);
  assert.equal(carryAgeOf(null, NOW), null);
  assert.equal(carryAgeOf({}, NOW), null);
});

test('carryAgeOf — วนมาแล้วนับวันจาก "เปิดครั้งแรก" ไม่ใช่จากกะนี้', () => {
  const a = carryAgeOf({ carry_hops: 3, first_opened_at: '2026-11-14T02:08:00Z' }, NOW);
  assert.equal(a.hops, 3);
  assert.equal(a.days, 3);
  assert.ok(a.firstMs > 0);
});

test('carryAgeOf — รู้ว่าวนมาแต่ไม่รู้วันแรก = days:null ห้ามเดา 0', () => {
  const a = carryAgeOf({ carry_hops: 2, first_opened_at: null }, NOW);
  assert.equal(a.hops, 2);
  assert.equal(a.days, null);
  assert.equal(a.firstMs, null);
  // วันที่อ่านไม่ออกก็ต้องไม่เดา
  assert.equal(carryAgeOf({ carry_hops: 2, first_opened_at: 'ไม่ใช่วันที่' }, NOW).days, null);
});

test('carryAgeOf — เวลาในอนาคต (นาฬิกาเครื่องเพี้ยน) ต้องไม่ติดลบ', () => {
  assert.equal(carryAgeOf({ carry_hops: 1, first_opened_at: '2027-01-01T00:00:00Z' }, NOW).days, 0);
});
