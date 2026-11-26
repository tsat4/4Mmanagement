/* 💳 I/O ของใบ MO — ใบจาก Downtime ไม่เคยมีเลข ทั้งที่ทะเบียนเครื่องมี (18/11 · หน้างานแจ้ง ข้อ 4) */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ioNoOf, buildIoIndex } from '../moIoNo.js';

const MC = [
  { machine_no: 'RB-123', io_no: '215031002307' },
  { machine_no: 'SW10',   io_no: '215031009999' },
  { machine_no: 'NOIO-1', io_no: null },
];

test('ใบจาก Downtime (ไม่มีเลขในใบ) อ่านจากทะเบียนเครื่องได้', () => {
  const r = ioNoOf({ io_no: null, machine_no: 'RB-123' }, MC);
  assert.equal(r.value, '215031002307');
  assert.equal(r.source, 'machine');
  assert.equal(r.unknown, false);
});

test('🔴 ค่าที่กรอกในใบชนะทะเบียนเสมอ — คนตั้งใจลงหน่วยอื่น ห้ามทับ', () => {
  const r = ioNoOf({ io_no: '999999999999', machine_no: 'RB-123' }, MC);
  assert.equal(r.value, '999999999999');
  assert.equal(r.source, 'order');
});

test('เลขเครื่องเขียนคนละแบบยังชี้เครื่องเดียวกัน (snap รูปแบบ)', () => {
  assert.equal(ioNoOf({ io_no: null, machine_no: 'sw-10' }, MC).value, '215031009999');
  assert.equal(ioNoOf({ io_no: null, machine_no: ' SW 10 ' }, MC).value, '215031009999');
});

test('🔴 ยังไม่โหลดทะเบียน ≠ เครื่องนี้ไม่มี I/O — ต้องตอบ unknown', () => {
  const r = ioNoOf({ io_no: null, machine_no: 'RB-123' }, null);
  assert.equal(r.value, null);
  assert.equal(r.unknown, true, 'ไม่รู้ ต้องให้จอ/ไฟล์เขียนกำกับ ห้ามปล่อยว่างเหมือนไม่มีเลข');
});

test('🔴 ไม่ได้ select io_no ของใบมา = ไม่รู้ · ทะเบียนบอกว่าไม่มี = รู้แล้วว่าไม่มี', () => {
  assert.equal(ioNoOf({ machine_no: 'NOIO-1' }, MC).unknown, true, 'ใบไม่มีคีย์ io_no = ยังไม่รู้');
  assert.equal(ioNoOf({ io_no: null, machine_no: 'NOIO-1' }, MC).unknown, false, 'ทะเบียนมีเครื่องแต่ไม่มีเลข = ไม่มีจริง');
  assert.equal(ioNoOf({ io_no: null, machine_no: 'ไม่มีในทะเบียน' }, MC).value, null);
});

test('🔴 ทะเบียนเขียนเลขเครื่องซ้ำแล้ว I/O ไม่ตรงกัน = ไม่ตอบ (ห้ามเดา)', () => {
  const dup = [{ machine_no: 'AB-1', io_no: '111' }, { machine_no: 'ab1', io_no: '222' }];
  assert.equal(ioNoOf({ io_no: null, machine_no: 'AB-1' }, dup).value, null);
  /* ซ้ำแต่เลขเดียวกัน = ตอบได้ (ไม่ใช่การเดา) */
  const same = [{ machine_no: 'AB-1', io_no: '111' }, { machine_no: 'ab1', io_no: '111' }];
  assert.equal(ioNoOf({ io_no: null, machine_no: 'AB-1' }, same).value, '111');
});

test('ส่งดัชนีที่สร้างไว้แล้วก็ได้ (ไม่ต้อง build ใหม่ทุกแถว)', () => {
  const idx = buildIoIndex(MC);
  assert.equal(ioNoOf({ io_no: null, machine_no: 'RB-123' }, idx).value, '215031002307');
  assert.equal(buildIoIndex(null), null);
});
