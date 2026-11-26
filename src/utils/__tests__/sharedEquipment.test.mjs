import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identityPatch, deleteMode } from '../sharedEquipment.js';

const cur = { name: 'JHYD06-17 - JIG SUB', jig_no: 'JHYD06-17', part_no: 'MB3B-16E061', line_name: 'Line 61', model: null };

test('ไม่ใช้ร่วม = เขียนตามฟอร์ม (พฤติกรรมเดิม)', () => {
  const { patch, changes } = identityPatch({ cur, orig: cur, form: { name: 'x', jig_no: '' }, shared: false });
  assert.deepEqual(patch, { name: 'x', jig_no: null });
  assert.equal(changes.length, 0);
});

test('เหตุการณ์ 19/11: AM "เพิ่มอุปกรณ์" เลือกเครื่องเดิม ฟอร์มว่าง ⇒ ห้ามล้าง jig_no/part_no ของ JIG MTN', () => {
  const { patch } = identityPatch({ cur, orig: null, form: { name: 'JHYD06-17 - JIG SUB', jig_no: '', part_no: 'RB3B-16E061-BA', line_name: 'SUB APRON', model: 'P703' }, shared: true });
  assert.deepEqual(patch, { model: 'P703' });   // เติมแค่ช่องที่ยังว่าง
});

test('ใช้ร่วม + แก้ไข: เขียนเฉพาะช่องที่คนแก้จริง และคืนรายการให้ถามยืนยัน', () => {
  const form = { ...cur, part_no: 'RB3B-16E061-BA' };
  const { patch, changes } = identityPatch({ cur, orig: cur, form, shared: true });
  assert.deepEqual(patch, { part_no: 'RB3B-16E061-BA' });
  assert.deepEqual(changes, [{ field: 'part_no', from: 'MB3B-16E061', to: 'RB3B-16E061-BA' }]);
});

test('ใช้ร่วม + แก้ไข: ฟอร์มค้างค่าเก่า (อีกแผนกแก้ไปแล้ว) ⇒ ไม่ทับกลับ', () => {
  const orig = { ...cur, jig_no: 'OLD' };
  const { patch } = identityPatch({ cur, orig, form: { ...orig }, shared: true });
  assert.deepEqual(patch, {});
});

test('deleteMode: นับไม่ได้ = ห้ามลบ · มีแผนกอื่น = ถอดแค่มุมมอง', () => {
  assert.equal(deleteMode(undefined, null), 'unknown');
  assert.equal(deleteMode(0, { message: 'x' }), 'unknown');
  assert.equal(deleteMode(2, null), 'view');
  assert.equal(deleteMode(0, null), 'equipment');
});
