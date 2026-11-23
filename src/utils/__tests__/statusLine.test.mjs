import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStatusLine, greetingWord } from '../statusLine.js';

const MORNING = new Date('2026-11-18T09:30:00+07:00');
const AFTERNOON = new Date('2026-11-18T14:00:00+07:00');

test('🗣 statusLine — ทักทายตามชั่วโมงของ now ที่ส่งเข้ามา (ไม่อ่านนาฬิกาเอง)', () => {
  assert.equal(greetingWord(MORNING), 'สวัสดีตอนเช้า');
  assert.equal(greetingWord(AFTERNOON), 'สวัสดีตอนบ่าย');
  assert.equal(greetingWord(new Date('2026-11-18T23:00:00+07:00')), 'สวัสดี');
});

test('🗣 statusLine — เล่าข้อเท็จจริง แล้วชี้ "ต้องดู" ช่อง bad ก่อน warn', () => {
  const r = buildStatusLine([
    { label: 'ไลน์กำลังผลิต', value: 6, unit: 'ไลน์', tone: 'none' },
    { label: '4M รออนุมัติ', value: 3, unit: 'รายการ', tone: 'warn', need: '4M รออนุมัติ 3 รายการ' },
    { label: 'Downtime ค้าง', value: 2, unit: 'จุด', tone: 'bad', need: 'เครื่องหยุดอยู่ 2 จุด' },
  ], { now: AFTERNOON, name: 'สมชาย' });
  assert.match(r.text, /^สวัสดีตอนบ่าย คุณสมชาย — ไลน์กำลังผลิต 6 ไลน์ · 4M รออนุมัติ 3 รายการ · Downtime ค้าง 2 จุด — ⚠ ต้องดู: เครื่องหยุดอยู่ 2 จุด$/);
  assert.equal(r.tone, 'bad'); assert.equal(r.focus, 'เครื่องหยุดอยู่ 2 จุด');
});

test('🗣 statusLine — ค่า null ห้ามเล่าเป็น 0 · นับเป็น "ยังไม่มีข้อมูล N ช่อง" · ทุกช่องไม่รู้ = ไม่พูดว่าปกติ', () => {
  const r = buildStatusLine([
    { label: 'ไลน์กำลังผลิต', value: null, unit: 'ไลน์' },
    { label: 'เช็คชื่อ', value: null, unit: 'คน' },
  ], { now: MORNING });
  assert.equal(r.text, 'สวัสดีตอนเช้า — ยังไม่มีข้อมูล 2 ช่อง');
  assert.equal(r.tone, 'none'); assert.equal(r.unknown, 2);
  assert.doesNotMatch(r.text, /0 /);
});

test('🗣 statusLine — ทุกช่องปกติ = บอกว่ายังไม่มีอะไรต้องรีบดู · ไม่ส่ง now = ไม่ทักทาย', () => {
  const r = buildStatusLine([{ label: 'ผลิตได้', value: 1679, unit: 'ชิ้น', tone: 'good' }]);
  assert.equal(r.text, 'ผลิตได้ 1,679 ชิ้น — ยังไม่มีอะไรต้องรีบดู');
  assert.equal(r.tone, 'ok');
});
