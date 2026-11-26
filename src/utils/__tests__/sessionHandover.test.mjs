/* เทส "กะนี้ถูกส่งต่อไปแล้วหรือยัง" — src/utils/sessionHandover.js            (2026-11-17)
   ที่มา (หัวหน้าแจ้ง): "ถ้ากะ01ลืมปิดกะ แล้วกะ02 ยิงปิดแท็ก ยอดจะไปขึ้นของกะ01ที่ลืมปิด"
   ไล่ฐานจริง: 164 ใบ · 21,647 ชิ้น · 18 กะ ถูก **เปิดใบ** ลงกะที่ไลน์ขึ้นกะใหม่ไปแล้ว
   ⚠️ ทุกเทสตรึง `now` เอง — ห้ามพึ่งนาฬิกาเครื่อง (รอบเทส "นาฬิกา +400 วัน") */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  handoverOf, handoverBlockText, sessionStartMs, sessionLabel, HANDOVER_GRACE_MIN,
} from '../sessionHandover.js';

const S = (o) => ({ id: 'x', line_name: 'L1', work_date: '2026-11-10', shift: 'day', start_time: '08:00', status: 'open', ...o });
const day   = S({ id: 'd' });
const night = S({ id: 'n', shift: 'night', start_time: '20:00' });
const at = (iso) => new Date(iso).getTime();

test('ไลน์เดียวกัน กะดึกเริ่มแล้ว ⇒ กะเช้าคือกะที่ถูกส่งต่อ', () => {
  const h = handoverOf(day, [day, night], at('2026-11-10T20:10:00'));
  assert.ok(h);
  assert.equal(h.next.id, 'n');
  assert.equal(h.lateMin, 10);
  assert.equal(h.nextIsLive, true);
  assert.equal(h.unsure, false);
});

test('กะใหม่ยังไม่เริ่ม = ยังไม่ส่งต่อ (null)', () => {
  assert.equal(handoverOf(day, [day, night], at('2026-11-10T19:59:00')), null);
});

test('มองจากกะที่เดินอยู่ = ไม่มีอะไรเตือน', () => {
  assert.equal(handoverOf(night, [day, night], at('2026-11-10T23:00:00')), null);
});

test('ไลน์อื่นเปิดกะ ไม่นับเป็นการส่งต่อ', () => {
  const other = S({ id: 'o', line_name: 'L2', shift: 'night', start_time: '20:00' });
  assert.equal(handoverOf(day, [day, other], at('2026-11-10T21:00:00')), null);
});

test('กะใหม่ปิดไปแล้วก็ยังนับ — ยิ่งแปลว่ากะเก่าค้างแน่', () => {
  const h = handoverOf(day, [day, { ...night, status: 'closed' }], at('2026-11-11T09:00:00'));
  assert.equal(h.next.id, 'n');
  assert.equal(h.nextIsLive, false);
});

test('กะโมฆะไม่นับ (ทั้งตัวที่เลือกและตัวที่เทียบ)', () => {
  assert.equal(handoverOf(day, [day, { ...night, status: 'void' }], at('2026-11-10T21:00:00')), null);
  assert.equal(handoverOf({ ...day, status: 'void' }, [day, night], at('2026-11-10T21:00:00')), null);
});

test('หลายกะ ⇒ เอากะที่เริ่มล่าสุดที่เริ่มไปแล้ว', () => {
  const ot = S({ id: 'ot', shift: 'night', start_time: '22:30' });
  const h = handoverOf(day, [day, night, ot], at('2026-11-10T23:00:00'));
  assert.equal(h.next.id, 'ot');
  // ตอน 21:00 กะ 22:30 ยังไม่เริ่ม ⇒ ต้องได้กะ 20:00
  assert.equal(handoverOf(day, [day, night, ot], at('2026-11-10T21:00:00')).next.id, 'n');
});

test('อ่านเวลาเริ่มกะไม่ได้ = unsure ไม่ใช่ null (จอต้องเขียนว่าเช็คไม่ได้ ห้ามเงียบ)', () => {
  const h = handoverOf(S({ start_time: null, work_date: null }), [night], at('2026-11-10T21:00:00'));
  assert.ok(h);
  assert.equal(h.unsure, true);
  assert.equal(h.next, null);
  assert.equal(sessionStartMs(S({ start_time: null, work_date: null })), null);
});

test('ข้อความด่าน: ภายในผ่อนผัน = ไม่ขัด · เกินแล้ว = ขัด', () => {
  const soon = handoverOf(day, [day, night], at(`2026-11-10T20:${String(HANDOVER_GRACE_MIN - 1).padStart(2, '0')}:00`));
  assert.equal(handoverBlockText(soon, 'ใบ A', day), null);
  const late = handoverOf(day, [day, night], at('2026-11-10T22:00:00'));
  const txt = handoverBlockText(late, 'ใบ A', day);
  assert.ok(txt && txt.includes('กะดึก') && txt.includes('ใบ A'));
  // unsure ห้ามบล็อก (เช็คไม่ได้ ≠ ผิด)
  assert.equal(handoverBlockText({ unsure: true, next: null, lateMin: 0 }, 'ใบ A', day), null);
  assert.equal(handoverBlockText(null, 'ใบ A', day), null);
});

test('ป้ายกะอ่านรู้เรื่อง', () => {
  assert.equal(sessionLabel(night), 'กะดึก 10/11 เริ่ม 20:00');
  assert.equal(sessionLabel(null), '—');
});
