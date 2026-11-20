import test from 'node:test';
import assert from 'node:assert/strict';
import { homeStreak, homeSuggestion, HOME_SUGGEST_DAYS } from '../homeSuggest.js';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const day = (n) => `2026-10-${String(n).padStart(2, '0')}`;
const at = (n, st, present = true) => ({ work_date: day(n), is_present: present, assigned_line: st });

test('เกณฑ์ = 20 วันทำงาน', () => { assert.equal(HOME_SUGGEST_DAYS, 20); });

test('ยืนจุดเดียว 20 วันติด = เสนอ · 19 วัน = ยังไม่เสนอ', () => {
  const rows20 = Array.from({ length: 20 }, (_, i) => at(i + 1, A));
  assert.deepEqual(homeSuggestion(rows20, A, undefined), { suggest: true, days: 20 });
  assert.deepEqual(homeSuggestion(rows20.slice(1), A, undefined), { suggest: false, days: 19 });
});

test('วันหยุด (ไม่มีแถว) · วันไม่มา (คนอื่นแทน) · มาแต่ไม่ได้วางจุด = ข้าม ไม่ตัดสตรีค', () => {
  const rows = [];
  for (let i = 1; i <= 30; i++) {
    if (i % 7 === 0) continue;                       // วันหยุด
    if (i === 5) { rows.push(at(i, null, false)); continue; }   // ลา
    if (i === 9) { rows.push(at(i, A, false)); continue; }      // ไม่มา (แถวค้างจุดเดิม)
    if (i === 12) { rows.push(at(i, null, true)); continue; }   // มาแต่อยู่ Pool
    rows.push(at(i, A));
  }
  const s = homeStreak(rows);
  assert.equal(s.stationId, A);
  assert.equal(s.days, 30 - 4 - 3); // 30 วัน − วันหยุด 4 − (ลา·ไม่มา·Pool) 3
});

test('ยืนจุดอื่นคั่น = ตัดสตรีค · วันเดียวมีจุดอื่นปน = ตัด', () => {
  const rows = [...Array.from({ length: 25 }, (_, i) => at(i + 1, A)), at(26, B), ...Array.from({ length: 3 }, (_, i) => at(27 + i, A))];
  assert.deepEqual(homeStreak(rows), { stationId: A, days: 3 });
  const mixed = [...Array.from({ length: 25 }, (_, i) => at(i + 1, A)), at(26, B), at(26, A), at(27, A)];
  assert.deepEqual(homeStreak(mixed), { stationId: A, days: 1 });
});

test('มีตำแหน่งประจำแล้ว (จุดเดียวกันหรือจุดอื่น) = ไม่เสนอ · ดูจุดที่ไม่ใช่จุดล่าสุด = ไม่เสนอ', () => {
  const rows = Array.from({ length: 22 }, (_, i) => at(i + 1, A));
  assert.equal(homeSuggestion(rows, A, A).suggest, false);
  assert.equal(homeSuggestion(rows, A, B).suggest, false);
  assert.deepEqual(homeSuggestion(rows, B, undefined), { suggest: false, days: 0 });
});

test('ไม่มีข้อมูล = ไม่เสนอ', () => {
  assert.deepEqual(homeStreak([]), { stationId: null, days: 0 });
  assert.deepEqual(homeStreak(null), { stationId: null, days: 0 });
  assert.equal(homeSuggestion([], A, null).suggest, false);
});
