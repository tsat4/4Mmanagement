/* เทสสูตร PPM ของเสียภายใน — `ppmOf` / `ppmFromDefects` / `trialState` / `fmtPpm` (oee.js §7.3)

   ที่มา: feedback ประชุม 16/11 (นาย ณัฐวุฒิ ทรงดอน)
     1. *"แก้ PPM ไลน์ปั๊มที่มีการเทสแล้วทำให้ PPM กระโดดไปเกิน 100 สูงผิดปกติ"*
        (เป้า PPM ในทะเบียน = 50 / 75 / 300 ⇒ "เกิน 100" = ทะลุเป้า)
     2. *"PPM ต้องโชว์จำนวนเต็ม"*

   สองคลาสบั๊กที่เทสนี้ล็อกไว้ (ทั้งคู่ดัน PPM **ขึ้น**):
     (ก) ตัวเศษกับตัวหารคนละฐาน — ของเสียงานทดลองเข้าตัวเศษ แต่ตัวหารเป็นยอดผลิตปกติ
     (ข) ตัวหารเป็น "shot" (ยุบงานคู่ RH/LH) แต่ตัวเศษเป็น "ชิ้น" ⇒ เฟ้อ ~2 เท่าบนไลน์แม่พิมพ์คู่

   🔴 ห้ามแก้เทสนี้ให้ผ่านด้วยการ clamp ค่า — PPM เกิน 100/1,000 ได้ตามธรรมชาติ (ชิ้นต่อล้าน)
      สิ่งที่ห้ามคือ "เศษกับส่วนคนละฐาน" ไม่ใช่ "ค่าสูง"
   ฟังก์ชันทั้งหมดเป็น pure ไม่กินเวลาปัจจุบัน ⇒ ปลอดรอบ "นาฬิกา +400 วัน" ของ npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ppmOf, ppmFromDefects, trialState, fmtPpm } from '../oee.js';

/* ── 1) ppmOf — สูตรแกน ───────────────────────────────────────────────────── */
test('ppmOf — ของเสีย ÷ (ดี + เสีย) × 1e6 และคืน "จำนวนเต็ม" เสมอ', () => {
  assert.equal(ppmOf(1, 999_999), 1);
  assert.equal(ppmOf(5, 95), 50_000);
  // 3 / (1800+3) = 1663.89… ⇒ ต้องปัดเป็นจำนวนเต็ม (PPM = ชิ้นต่อล้าน ทศนิยมไม่มีความหมาย)
  const v = ppmOf(3, 1800);
  assert.equal(v, 1664);
  assert.equal(Number.isInteger(v), true, 'PPM ต้องเป็นจำนวนเต็ม — feedback 16/11');
  assert.equal(ppmOf(0, 10_000), 0, 'ไม่มีของเสียเลย = 0 (ถูกต้อง ไม่ใช่ null)');
});

test('ppmOf — ยอดผลิตยังไม่ถูกบันทึกแต่มีของเสีย = null ห้ามเป็น 0 / 1,000,000', () => {
  assert.equal(ppmOf(91, 0), null, 'ผลิต 0 · NG 91 ≠ "เสียล้านชิ้นในล้าน" (UX audit 05/10)');
  assert.equal(ppmOf(0, 0), null, 'ไม่มีอะไรเลย = ตอบไม่ได้ ไม่ใช่ 0');
  assert.equal(ppmOf(5, null), null);
  assert.equal(ppmOf(5, -10), null, 'ยอดผลิตติดลบ = ข้อมูลเพี้ยน ⇒ ตอบไม่ได้');
});

/* ── 2) งานทดลอง — ตัวเศษกับตัวหารต้องฐานเดียวกัน ──────────────────────────── */
test('trialState — ตอบ trial/line/unknown ตามข้อมูลที่คิวรีถามมา (ห้ามเดา)', () => {
  assert.equal(trialState({ is_trial: true }), 'trial');
  assert.equal(trialState({ is_trial: false, dr_defect_types: { excl_from_q: true } }), 'trial',
    'ประเภทที่ตั้ง excl_from_q = งานทดลองทั้งประเภท (oee.js §7)');
  assert.equal(trialState({ is_trial: false, dr_defect_types: { excl_from_q: false } }), 'line');
  assert.equal(trialState({ is_trial: false, dr_defect_types: null }), 'line',
    'embed มาแล้วแต่ไม่มีประเภทผูกไว้ = ตอบได้ว่าไม่ใช่งานทดลอง');
  assert.equal(trialState({ is_trial: false }), 'unknown',
    '🔴 ไม่ได้ embed dr_defect_types(excl_from_q) = ตอบไม่ได้ ห้ามเดาว่าเป็นงานผลิต');
  assert.equal(trialState({ excl_from_q: true }), 'trial', 'แถว rollup แบบแบน (ไม่มี embed)');
  assert.equal(trialState(null), 'unknown');
});

test('ppmFromDefects — ของเสียงานทดลองออกจากตัวเศษ และรายงานแยกว่ากี่ชิ้น', () => {
  /* เคสจริง LINE A (800 Ton) 2026-10-03: ผลิตดี 1,800 · ของเสีย 3 ชิ้น **ทั้งก้อนเป็นงานทดลอง**
     ของจริง PPM ของไลน์ = 0 · แต่สูตรที่บวก qty_ng ดิบให้ 1,664 (วัดฐาน DR 16/11) */
  const press = ppmFromDefects([
    { qty_ng: 3, qty_suspect: 0, is_trial: true, dr_defect_types: { excl_from_q: false } },
  ], 1800);
  assert.equal(press.ppm, 0, 'ของเสียทุกชิ้นเป็นงานทดลอง ⇒ ไลน์ผลิตไม่ถูกลงโทษ');
  assert.equal(press.ngQty, 0);
  assert.equal(press.trialQty, 3, 'ต้องคืนจำนวนงานทดลองให้จอเขียนบอก — ห้ามหายเงียบ');

  /* ปนกัน: ของเสียไลน์ 2 + งานทดลอง 120 (คลาสเดียวกับ Laser GOR/Laser LWR ที่วัดได้ 6.8–9.9 เท่า) */
  const mixed = ppmFromDefects([
    { qty_ng: 2, qty_suspect: 0, is_trial: false, dr_defect_types: { excl_from_q: false } },
    { qty_ng: 120, qty_suspect: 0, is_trial: true, dr_defect_types: { excl_from_q: false } },
  ], 60_000);
  assert.equal(mixed.ngQty, 2);
  assert.equal(mixed.trialQty, 120);
  assert.equal(mixed.ppm, ppmOf(2, 60_000));
  assert.ok(mixed.ppm < ppmOf(122, 60_000), 'งานทดลองต้องไม่ดัน PPM ของไลน์ขึ้น');
});

test('ppmFromDefects — ของสงสัยที่ QA ยังไม่ตัดสิน ยังไม่เข้า PPM แต่ต้องรายงาน', () => {
  const r = ppmFromDefects([
    { qty_ng: 0, qty_suspect: 40, is_trial: false, dr_defect_types: { excl_from_q: false },
      quality_bin_records: [] },                              // embed ทะเบียนถังแล้ว · ยังไม่มีผล = รอ
  ], 10_000);
  assert.equal(r.ngQty, 0, 'ของสงสัยยังไม่ใช่ของเสีย จนกว่า QA จะตัดสิน (§7.1)');
  assert.equal(r.pendingQty, 40, 'จอต้องเขียนว่ารอพิจารณากี่ชิ้น ⇒ PPM เป็นค่าชั่วคราว');
  assert.equal(r.ppm, 0);
});

test('ppmFromDefects — แยกงานทดลองไม่ออก = คงพฤติกรรมเดิม (เข้าตัวเศษ) + ชูธง unsureQty', () => {
  const r = ppmFromDefects([{ qty_ng: 7, qty_suspect: 0 }], 10_000);   // ไม่ได้ embed ทะเบียนประเภท
  assert.equal(r.ngQty, 7, 'ห้ามทิ้งของเสียเงียบๆ เพราะคิวรีถามไม่ครบ');
  assert.equal(r.unsureQty, 7, '🔴 ต้องคืนจำนวนที่ "ชี้ไม่ได้" ให้จอเขียนบอก (กฎจอซื่อสัตย์)');
  assert.equal(r.trialQty, 0);
});

/* ── 3) "ชิ้น ≠ shot" — ตัวหารต้องเป็นชิ้น ไม่ใช่ยอดที่ยุบงานคู่ ──────────────── */
test('ppmOf — ตัวหารที่ยุบงานคู่ RH/LH (shot) ทำให้ PPM เฟ้อ ~1.8 เท่า (บั๊กเด็ค Monthly Review)', () => {
  /* ฐานจริง HDF1 16/11: ชิ้นจริง 115,171 · ยุบคู่แล้ว 63,713 · ของเสียไลน์ 224 ชิ้น */
  const pieces = ppmOf(224, 115_171);
  const shots = ppmOf(224, 63_713);
  assert.equal(pieces, 1941);
  assert.equal(shots, 3503);
  assert.ok(shots > pieces * 1.7, 'ตัวหารเป็น shot = PPM เฟ้อเกือบ 2 เท่าบนไลน์แม่พิมพ์คู่');
});

/* ── 4) การแสดงผล ─────────────────────────────────────────────────────────── */
test('fmtPpm — จำนวนเต็มพร้อมตัวคั่นหลักพัน · null = ขีด (ห้ามเป็น 0)', () => {
  assert.equal(fmtPpm(1663.89), (1664).toLocaleString());
  assert.equal(fmtPpm(0), '0', 'ของเสีย 0 ชิ้นจากยอดผลิตจริง = 0 ที่มีความหมาย ห้ามเป็นขีด');
  assert.equal(fmtPpm(null), '—');
  assert.equal(fmtPpm(undefined), '—');
  assert.equal(fmtPpm(NaN), '—');
  assert.equal(fmtPpm(null, '–'), '–', 'ขีดของแต่ละจอตั้งเองได้');
  assert.equal(/\./.test(fmtPpm(1234.56)), false, 'ห้ามมีทศนิยมหลุดออกจอ — feedback 16/11');
});
