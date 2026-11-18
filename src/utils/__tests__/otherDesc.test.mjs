/* ══ 🗑️ ด่าน "อื่นๆ ต้องบอกเหตุผลจริง" (utils/unclassified.js · 2026-11-16 · คำสั่ง user) ═══
   *"อื่นๆ ต้องใส่เหตุผล และห้ามใส่อื่นๆ มาในช่องพิมพ์"*
   ที่มา: "อื่นๆ (ในแผน)" = 41.5% ของนาทีหยุดตามแผนทั้งโรงงาน (พ.ย. 69 · 34,639/83,382 นาที)
   ⇒ ก้อนเวลาที่ถูกตัดออกจากฐาน %A/%P ใหญ่สุด แต่ไม่มีใครรู้ว่าคืออะไร */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkOtherDescription, residualText, otherDescMessage, DESC_MIN_CHARS } from '../unclassified.js';

const OTHER = 'อื่นๆ (ในแผน)';

test('🔴 ประเภท "อื่นๆ" + ช่องว่าง = ไม่ผ่าน', () => {
  for (const v of ['', null, undefined, '   ']) {
    const r = checkOtherDescription(OTHER, v);
    assert.equal(r.ok, false); assert.equal(r.reason, 'blank');
  }
});

test('🔴 พิมพ์คำกลวงซ้ำ = ไม่ผ่าน (นี่คือรูที่เดิมหลุด)', () => {
  for (const v of ['อื่นๆ', 'อื่น ๆ', 'อื่นๆ.', '-', '--', 'ไม่ระบุ', 'ไม่ทราบ', 'N/A', 'n/a',
                   'other', 'others', 'etc', 'etc.', 'unknown', 'none', '  อื่นๆ  ', 'ไม่มี']) {
    const r = checkOtherDescription(OTHER, v);
    assert.equal(r.ok, false, `ต้องไม่ผ่าน: ${JSON.stringify(v)}`);
    assert.equal(r.reason, 'hollow');
  }
});

test('🔴 พิมพ์ชื่อประเภทซ้ำ = ไม่ได้บอกอะไรเพิ่ม', () => {
  assert.equal(checkOtherDescription(OTHER, 'อื่นๆ (ในแผน)').ok, false);
  assert.equal(checkOtherDescription(OTHER, 'ในแผน').ok, false);
  assert.equal(checkOtherDescription('อื่นๆ / ยังระบุไม่ได้', 'ยังระบุไม่ได้').ok, false);
});

test('✅ ข้อความที่บอกอาการจริง = ผ่าน (รวมคำสั้นแบบหน้างาน)', () => {
  for (const v of ['ลมตก', 'ไฟดับ', 'โซ่ลำเลียงติด', 'รอพาเลทจากคลัง', 'RB-85 แขนค้าง']) {
    assert.equal(checkOtherDescription(OTHER, v).ok, true, `ต้องผ่าน: ${v}`);
  }
});

test('⚠️ ห้ามเข้มเกิน — ประโยคที่มีคำว่า "อื่นๆ" ปนแต่มีเนื้อ ต้องผ่าน', () => {
  assert.equal(checkOtherDescription(OTHER, 'รอเครื่องอื่นๆ ที่ใช้ร่วมกัน').ok, true);
  assert.equal(checkOtherDescription(OTHER, 'ไม่ระบุเครื่อง แต่ลมในระบบตก').ok, true);
});

test('🔴 ประเภทที่ไม่ใช่ถังขยะ = ไม่บังคับกรอก (ห้ามกวนงานปกติ)', () => {
  for (const t of ['Robot (Alarm/Error)', 'Set up Machine', 'รอ QA ตรวจสอบงาน', '']) {
    assert.equal(checkOtherDescription(t, '').ok, true, t);
  }
});

test('residualText ตัดคำกลวง/เครื่องหมาย/ชื่อหมวด เหลือเฉพาะเนื้อ', () => {
  assert.equal(residualText('อื่นๆ - ลมตก', OTHER), 'ลมตก');
  assert.equal(residualText('   ', OTHER), '');
  assert.ok(residualText('โซ่ลำเลียงติด', OTHER).length >= DESC_MIN_CHARS);
});

test('ข้อความบอกคนกรอกต้องบอก "ต้องทำอะไรต่อ" ไม่ใช่แค่ว่าผิด', () => {
  assert.match(otherDescMessage('blank', 'สาเหตุที่หยุด'), /สาเหตุที่หยุด/);
  assert.match(otherDescMessage('hollow', 'สาเหตุที่หยุด'), /เช่น/);
});
