/* 🔌 สถานะใช้งานของเครื่อง (19/11 · คำสั่ง user "ปุ่มเปิดปิดเครื่อง … 3 สถานะ")
 * 🔴 ของที่คนประกาศชนะของที่ระบบเดา · "ใบยังเปิด" ≠ "เครื่องใช้ไม่ได้" */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MACHINE_USABILITY, machineUsability, usabilityNeedsNote, usabilityPatch, usabilityMeta,
} from '../machineUsability.js';

test('3 สถานะตามที่ user เคาะ — กระพริบเฉพาะแดง · เหลืองนิ่ง', () => {
  assert.deepEqual(MACHINE_USABILITY.map(x => x.key), ['ok', 'temp', 'down']);
  assert.equal(usabilityMeta('down').blink, true);
  assert.equal(usabilityMeta('temp').blink, false, 'Andon: เหลืองต้องนิ่ง');
  assert.equal(usabilityMeta('ok').blink, false);
});

test('🔴 ช่างประกาศแล้ว ชนะใบซ่อมเสมอ — เคส "แก้เบื้องต้น ใช้ได้ระหว่างรอของ"', () => {
  const mc = { usability: 'temp', usability_note: 'เปลี่ยนซีลชั่วคราว รอปั๊มตัวใหม่', usability_by: 'สมชาย' };
  const r = machineUsability(mc, [{ id: 'mo1', repair_done_at: null }]);   // ใบยังซ่อมไม่เสร็จด้วยซ้ำ
  assert.equal(r.state, 'temp');
  assert.equal(r.source, 'declared');
  assert.match(r.text, /รอปั๊มตัวใหม่/);
  assert.match(r.text, /โดย สมชาย/);
});

/* 🔴 บั๊กจริงที่ทำให้ต้องมีไฟล์นี้: CT-03 (จ่าย 13 ไลน์) ซ่อมเสร็จ 13/11 08:44
   แต่ใบยังเปิด ⇒ ผังทาไลน์ปลายทางเป็น "เสี่ยง" 7 วันทั้งที่เครื่องเดินปกติ */
test('🔴 ซ่อมเสร็จแล้วแต่ใบยังไม่ปิด = เครื่องใช้ได้ (ลูปเอกสาร ไม่ใช่เครื่องเสีย)', () => {
  const r = machineUsability({ machine_no: 'CT-03' }, [{ id: 'mo', repair_done_at: '2026-11-13T01:44:00Z' }]);
  assert.equal(r.state, 'ok');
  assert.equal(r.source, 'mo');
  assert.match(r.text, /ใบ MO ยังไม่ปิด/, 'ต้องเขียนบนจอว่าใบยังไม่ปิด ไม่ใช่เงียบ');
});

test('ใบที่ยังซ่อมไม่เสร็จ = แดง (AB-03 ของจริง) · ไม่มีใบเลย = เขียวเงียบ', () => {
  const down = machineUsability({ machine_no: 'AB-03' }, [{ id: 'mo', repair_done_at: null }]);
  assert.equal(down.state, 'down');
  assert.equal(down.source, 'mo');
  assert.match(down.text, /ยังไม่มีใครกดยืนยัน/);

  const clean = machineUsability({ machine_no: 'X' }, []);
  assert.equal(clean.state, 'ok');
  assert.equal(clean.source, 'none');
  assert.equal(clean.text, '', 'ปกติ = ไม่ต้องเขียนอะไร');
});

test('🔴 null ≠ ok — ยังไม่ประกาศต้องถอยไปดูใบซ่อม ไม่ใช่ยืนยันว่าใช้ได้', () => {
  const r = machineUsability({ usability: null }, [{ repair_done_at: null }]);
  assert.equal(r.state, 'down', 'ไม่ประกาศ + ใบยังซ่อมไม่เสร็จ = ต้องเดาว่าเสีย');
  /* ค่าที่ไม่รู้จัก (ของเก่า/พิมพ์มั่ว) ก็ต้องถอยไปชั้น ② ไม่ใช่เชื่อตามนั้น */
  assert.equal(machineUsability({ usability: 'broken?' }, []).source, 'none');
});

test('🔴 เหลือง/แดง ไม่มีเหตุผล = บันทึกไม่ได้ (ปุ่มดับไฟเตือนเปล่าๆ = สวิตช์โกหก)', () => {
  assert.equal(usabilityNeedsNote('temp'), true);
  assert.equal(usabilityNeedsNote('down'), true);
  assert.equal(usabilityNeedsNote('ok'), false);
  assert.equal(usabilityPatch('temp', '', 'สมชาย'), null);
  assert.equal(usabilityPatch('down', '   ', 'สมชาย'), null);
  assert.equal(usabilityPatch('ไม่มีจริง', 'x', 'y'), null);

  const p = usabilityPatch('temp', ' รอซีลใหม่ ', 'สมชาย', Date.UTC(2026, 10, 19, 3, 0));
  assert.equal(p.usability, 'temp');
  assert.equal(p.usability_note, 'รอซีลใหม่', 'ตัดช่องว่างหัวท้าย');
  assert.equal(p.usability_by, 'สมชาย');
  assert.equal(p.usability_at, '2026-11-19T03:00:00.000Z');
  /* กลับมาเขียว = ไม่ต้องมีเหตุผล แต่ยังเก็บว่าใครกด */
  const ok = usabilityPatch('ok', '', 'สมชาย', Date.UTC(2026, 10, 19, 4, 0));
  assert.equal(ok.usability, 'ok');
  assert.equal(ok.usability_note, null);
});

test('ไม่ส่งใบซ่อมมาเลย = ตอบ ok แต่บอกว่าไม่ได้ดูใบ (source none)', () => {
  const r = machineUsability({ machine_no: 'X' });
  assert.equal(r.state, 'ok');
  assert.equal(r.source, 'none');
});
