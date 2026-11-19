/* 🚩 ติ๊ก NG ต้องมีเหตุผล (19/11 · คำสั่ง user "เกิดการกดผิดและพนักงานไม่รู้ตัว")
 * วัดจริง 90 วัน: NG 43 จุด มีเหตุผลแค่ 8 ⇒ 81% ไม่มีเหตุผลเลย */
import test from 'node:test';
import assert from 'node:assert/strict';
import { carryNgReason, ngReasonCheck, okWhileMoOpen, moUnresolved } from '../ngReason.js';

const prev = { action_text: 'ลูกปืนมีเสียงดัง', inspected_at: '2026-11-12T01:00:00Z' };
const moOpen = { mo_no: 'DIE-CM-001', status: 'assigned', repair_done_at: null };
const moFixed = { mo_no: 'DIE-CM-001', status: 'handover', repair_done_at: '2026-11-13T02:00:00Z' };
const moClosed = { mo_no: 'DIE-CM-001', status: 'closed', repair_done_at: '2026-11-13T02:00:00Z' };

test('🔴 ติ๊ก NG ไม่พิมพ์เหตุผล = บันทึกไม่ได้', () => {
  assert.equal(ngReasonCheck({ attr: 'ng', text: '' }).ok, false);
  assert.equal(ngReasonCheck({ attr: 'ng', text: '   ' }).ok, false);
  assert.match(ngReasonCheck({ attr: 'ng', text: '' }).blockText, /ต้องพิมพ์เหตุผล/);
  assert.equal(ngReasonCheck({ attr: 'ng', text: 'ลูกปืนดัง' }).ok, true);
  /* ติ๊ก OK หรือยังไม่ติ๊ก = ไม่เกี่ยว */
  assert.equal(ngReasonCheck({ attr: 'ok', text: '' }).ok, true);
  assert.equal(ngReasonCheck({ attr: null, text: '' }).ok, true);
});

test('🔴 ของที่ยกมาต้องกดยืนยันก่อน ห้ามนับว่ามีเหตุผลอัตโนมัติ', () => {
  const carry = carryNgReason({ prev, mo: moOpen, machine: {} });
  assert.ok(carry);
  assert.equal(ngReasonCheck({ attr: 'ng', text: '', carry }).ok, false,
    'มีของให้ยกแต่ยังไม่กดยืนยัน = ยังบันทึกไม่ได้ (เติมเงียบ = คนกดผิดได้เหตุผลติดมาเอง)');
  assert.match(ngReasonCheck({ attr: 'ng', text: '', carry }).blockText, /ใช้เหตุผลเดิม/);
  assert.equal(ngReasonCheck({ attr: 'ng', text: '', carry, accepted: true }).ok, true);
});

test('ยกเหตุผลเก่าได้เมื่อ MO ยังซ่อมไม่เสร็จ — และบอกว่ายกมาจากไหน', () => {
  const r = carryNgReason({ prev, mo: moOpen, machine: {} });
  assert.equal(r.text, 'ลูกปืนมีเสียงดัง');
  assert.equal(r.from, 'mo');
  assert.match(r.why, /MO DIE-CM-001 ยังไม่ปิด/);
});

test('🔴 "แก้ไขเบื้องต้นแล้ว" ยกต่อ แต่เปลี่ยนข้อความ (คำสั่ง user 19/11)', () => {
  const r = carryNgReason({ prev, mo: moOpen, machine: { usability: 'temp' } });
  assert.ok(r, 'ของยังไม่มา ปัญหายังอยู่ ⇒ ต้องยกต่อ ไม่งั้นคนต้องพิมพ์เองทุกกะ');
  assert.equal(r.from, 'temp');
  assert.match(r.why, /แก้ไขเบื้องต้นแล้ว รอของมาเปลี่ยน/);
  /* ยกต่อได้แม้ใบจะซ่อมเสร็จ/ปิดแล้ว — เพราะช่างประกาศว่ายังเป็นของชั่วคราว */
  assert.ok(carryNgReason({ prev, mo: moClosed, machine: { usability: 'temp' } }));
});

test('🔴 หยุดยกเมื่องานจบ — ใบปิด/ซ่อมเสร็จ/ช่างประกาศว่าเครื่องใช้ได้', () => {
  assert.equal(carryNgReason({ prev, mo: moClosed, machine: {} }), null, 'ใบปิดแล้ว = ปัญหาใหม่ ต้องอธิบายใหม่');
  assert.equal(carryNgReason({ prev, mo: moFixed, machine: {} }), null, 'ซ่อมเสร็จแล้ว (รอเอกสาร) ก็หยุดยก');
  assert.equal(carryNgReason({ prev, mo: null, machine: {} }), null, 'ไม่มีใบ = ไม่มีอะไรรองรับ');
  assert.equal(carryNgReason({ prev, mo: moOpen, machine: { usability: 'ok' } }), null,
    'ช่างประกาศว่าเครื่องใช้ได้ = งานจบ');
  /* ครั้งก่อนไม่มีเหตุผล = ไม่มีอะไรให้ยก (ของเก่า 35 จุดที่ว่างอยู่) */
  assert.equal(carryNgReason({ prev: { action_text: '' }, mo: moOpen, machine: {} }), null);
});

test('🔴 ติ๊ก OK ทั้งที่ใบซ่อมยังไม่เสร็จ = เตือน ไม่บล็อก', () => {
  const w = okWhileMoOpen({ attr: 'ok', mo: moOpen, machine: {} });
  assert.ok(w);
  assert.match(w, /ยังซ่อมไม่เสร็จ/);
  assert.match(w, /ถ้ายังไม่ได้แก้ควรเป็น NG/);
  /* ไม่เตือนเมื่อ: ติ๊ก NG · ซ่อมเสร็จแล้ว · ช่างประกาศว่าใช้ได้ */
  assert.equal(okWhileMoOpen({ attr: 'ng', mo: moOpen, machine: {} }), null);
  assert.equal(okWhileMoOpen({ attr: 'ok', mo: moFixed, machine: {} }), null);
  assert.equal(okWhileMoOpen({ attr: 'ok', mo: moOpen, machine: { usability: 'ok' } }), null);
  assert.equal(okWhileMoOpen({ attr: 'ok', mo: null, machine: {} }), null);
});

test('moUnresolved — ยังไม่ซ่อมเสร็จจริงเท่านั้น', () => {
  assert.equal(moUnresolved(moOpen), true);
  assert.equal(moUnresolved(moFixed), false);
  assert.equal(moUnresolved(moClosed), false);
  assert.equal(moUnresolved(null), false);
});
