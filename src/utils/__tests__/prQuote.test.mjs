/* 🧾 ใบเสนอราคาในใบขอซื้อ (18/11 · Case จาก PDF ทีม MTN)
 * user ตัดสิน: "ปิดใบแบบสมบูรณ์ละลบได้เลย" — ลบ "ไฟล์" ไม่ใช่ลบ "ประวัติ" */
import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteState, quoteText, moFullyClosed, quotesToPurge } from '../prQuote.js';

const pr = (o) => ({ order_id: 'mo1', quote_img: null, quote_file_name: null, quote_deleted_at: null, ...o });

test('3 สถานะ — ไม่เคยแนบ / มีไฟล์ / ลบไฟล์แล้ว', () => {
  assert.equal(quoteState(pr({})), 'none');
  assert.equal(quoteState(pr({ quote_img: 'https://x/q.webp', quote_file_name: 'quote-abex.pdf' })), 'has');
  assert.equal(quoteState(pr({ quote_file_name: 'quote-abex.pdf', quote_deleted_at: '2026-11-18T10:00:00Z' })), 'purged');
});

test('🔴 คิวรีไม่ได้ select มา = unknown ห้ามตอบว่า "ไม่มีใบเสนอราคา"', () => {
  assert.equal(quoteState({ order_id: 'mo1', id: 'x' }), 'unknown');
  assert.equal(quoteState(null), 'unknown');
  assert.equal(quoteText({ id: 'x' }), null, 'ไม่รู้ = ไม่เขียนอะไร (แต่ก็ไม่บอกว่าไม่มี)');
});

test('🔴 ลบไฟล์แล้วต้องยังเห็นว่า "เคยมี" — ไม่ใช่เงียบหายเหมือนไม่เคยแนบ', () => {
  assert.equal(quoteText(pr({})), null);
  assert.equal(quoteText(pr({ quote_img: 'u', quote_file_name: 'abex.pdf' })), 'abex.pdf');
  assert.match(quoteText(pr({ quote_file_name: 'abex.pdf', quote_deleted_at: 'x' })), /ลบไฟล์แล้วตอนปิดใบ/);
  /* ลบแล้วแต่ไม่รู้ชื่อไฟล์ ก็ยังต้องบอกว่าเคยมี */
  assert.match(quoteText(pr({ quote_deleted_at: 'x' })), /ใบเสนอราคา/);
});

test('🔴 "ปิดสมบูรณ์" = closed เท่านั้น — ยกเลิก/ตีกลับ/ส่งต่อ ไม่ใช่', () => {
  assert.equal(moFullyClosed({ status: 'closed' }), true);
  for (const st of ['cancelled', 'rejected', 'transferred', 'handover', 'pending', '', null]) {
    assert.equal(moFullyClosed({ status: st }), false, `${st} ต้องไม่นับว่าปิดสมบูรณ์`);
  }
});

test('เลือกแถวที่ลบได้ — เฉพาะใบที่ปิดแล้ว และเฉพาะแถวที่มีไฟล์จริง', () => {
  const order = { id: 'mo1', status: 'closed' };
  const rows = [
    pr({ id: 'a', quote_img: 'https://x/a.webp' }),
    pr({ id: 'b' }),                                              // ไม่เคยแนบ
    pr({ id: 'c', quote_file_name: 'c.pdf', quote_deleted_at: 'x' }), // ลบไปแล้ว
    { ...pr({ id: 'd', quote_img: 'https://x/d.webp' }), order_id: 'mo2' }, // คนละใบ
  ];
  const r = quotesToPurge(order, rows);
  assert.equal(r.ok, true);
  assert.deepEqual(r.rows.map(x => x.id), ['a'], 'ลบเฉพาะแถวที่มีไฟล์ และต้องเป็นใบเดียวกัน');
});

test('🔴 ใบยังไม่ปิด = ไม่ลบ · อ่านสถานะไม่ครบ = ไม่ลบ (fail-closed)', () => {
  const open = quotesToPurge({ id: 'mo1', status: 'handover' }, [pr({ id: 'a', quote_img: 'u' })]);
  assert.equal(open.ok, false);
  assert.match(open.reason, /ยังไม่ปิด/);
  assert.deepEqual(open.rows, []);

  const blind = quotesToPurge({ id: 'mo1', status: 'closed' },
    [pr({ id: 'a', quote_img: 'u' }), { id: 'b', order_id: 'mo1' }]);   // แถว b ไม่ได้ select มา
  assert.equal(blind.ok, false, 'มีแถวที่ไม่รู้สถานะ = ไม่ลบทั้งก้อน');
  assert.deepEqual(blind.rows, []);
});

test('ปิดแล้วแต่ไม่มีไฟล์เลย = ok แต่ไม่มีอะไรให้ลบ (ไม่ใช่ error)', () => {
  const r = quotesToPurge({ id: 'mo1', status: 'closed' }, [pr({ id: 'a' })]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.rows, []);
  assert.match(r.reason, /ไม่มีไฟล์/);
});
