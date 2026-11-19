// เทสสูตรเงิน/คะแนนของใบ M/O ทีม MTN — src/utils/mtnMoForm.js (pure)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { laborAmount, partAmount, sumLabor, sumParts, grandTotal, satScore, needsPlantManager, needsApprovalFirst, qaAppliesTo, mtnApprovalState, purposeOfPrint, causeText, causeCatLabel } from '../mtnMoForm.js';

test('ค่าแรง: rate × hours · มี amount ที่กรอกเองให้ใช้ค่านั้น', () => {
  assert.equal(laborAmount({ rate_per_hour: 100, hours: 1 }), 100);
  assert.equal(laborAmount({ rate_per_hour: 200, hours: 2.5 }), 500);
  assert.equal(laborAmount({ rate_per_hour: 100, hours: 1, amount: 120 }), 120, 'ใบจริงปัดเลขเองได้');
  assert.equal(laborAmount({ worker_name: 'ก' }), null, 'ยังไม่กรอก = null ห้ามเป็น 0');
});

test('อะไหล่: qty × unit_price', () => {
  assert.equal(partAmount({ qty: 4, unit_price: 110 }), 440);
  assert.equal(partAmount({ qty: 4 }), null, 'ไม่รู้ราคา = null');
});

test('รวมยอดตามใบตัวอย่างจริง (MTN.2026/06-59)', () => {
  const labor = [
    { worker_name: 'เจนณรงค์', rate_per_hour: 100, hours: 1 },
    { worker_name: 'พิพัฒน์',  rate_per_hour: 100, hours: 1 },
    {}, {}, {},                                    // แถวว่างบนฟอร์ม
  ];
  const parts = [
    { part_name: 'เต้ารับ', qty: 4, unit_price: 110 },      // 440
    { part_name: 'ฝาครอบ 3 ช่อง', qty: 4, unit_price: 20 }, //  80
    { part_name: 'บล็อกลอย', qty: 4, unit_price: 15 },      //  60
  ];
  assert.equal(sumLabor(labor), 200);
  assert.equal(sumParts(parts), 580);
  assert.equal(grandTotal(labor, parts), 780);
});

test('ไม่มีใครกรอกเงินเลย = null (ช่องบนใบว่าง ไม่ใช่ 0)', () => {
  assert.equal(sumLabor([{}, {}]), null);
  assert.equal(sumParts([]), null);
  assert.equal(grandTotal([], []), null);
});

test('ยังไม่มีตารางรายคน ให้ถอยไปใช้ยอดรวมเดิมที่พิมพ์มือไว้ (ใบเก่า)', () => {
  assert.equal(grandTotal([], [], 200, 580), 780);
  assert.equal(grandTotal([{ rate_per_hour: 100, hours: 3 }], [], 999, 580), 880, 'ตารางชนะ fallback');
});

test('คะแนนความพึงพอใจ: คิด % จากข้อที่ให้คะแนนมาจริง', () => {
  const keys = ['quality', 'response', 'problem', 'politeness', 'readiness'];
  assert.deepEqual(satScore({ quality: 3, response: 3, problem: 3, politeness: 3, readiness: 3 }, keys),
    { sum: 15, max: 15, pct: 100, n: 5 });
  assert.deepEqual(satScore({ quality: 2, response: 3 }, keys), { sum: 5, max: 6, pct: 83, n: 2 });
  assert.deepEqual(satScore(null, keys), { sum: null, max: null, pct: null, n: 0 });
});

test('งาน "สร้าง" ต้องผ่านผู้จัดการโรงงาน', () => {
  assert.equal(needsPlantManager('build'), true);
  assert.equal(needsPlantManager('repair'), false);
  assert.equal(needsPlantManager(null), false);
});

/* ── ขั้นตอนเฉพาะของใบ MTN (2026-09-15) ───────────────────────────────── */

test('ต้องอนุมัติก่อนเริ่มงาน = ปรับปรุง/สร้างเท่านั้น — ซ่อม/บริการเริ่มได้ทันที (ไลน์ห้ามหยุดรออนุมัติ)', () => {
  assert.equal(needsApprovalFirst({ purpose: 'improve' }), true);
  assert.equal(needsApprovalFirst({ purpose: 'build' }), true);
  assert.equal(needsApprovalFirst({ purpose: 'repair' }), false);
  assert.equal(needsApprovalFirst({ purpose: 'service' }), false);
  assert.equal(needsApprovalFirst({}), false, 'ใบเก่า/ทีมอื่นที่ไม่มี purpose ต้องไม่ถูกบล็อก');
});

test('ต้องผ่าน QA = ซ่อม/บริการ · ใบที่ purpose ว่างหรือค่าแปลก = ต้องผ่าน (fail-safe)', () => {
  assert.equal(qaAppliesTo({ purpose: 'repair' }), true);
  assert.equal(qaAppliesTo({ purpose: 'service' }), true);
  assert.equal(qaAppliesTo({ purpose: 'improve' }), false);
  assert.equal(qaAppliesTo({ purpose: 'build' }), false);
  assert.equal(qaAppliesTo({}), true);
  assert.equal(qaAppliesTo({ purpose: 'อะไรไม่รู้' }), true);
});

test('mtnApprovalState: งานปรับปรุง = บล็อกจนเซ็น · งานซ่อม = แค่ค้างเซ็นรับทราบ', () => {
  const improve = mtnApprovalState({ purpose: 'improve' });
  assert.equal(improve.blocked, true);
  assert.deepEqual(improve.missing, ['dept']);
  assert.equal(improve.needPlant, false);

  const improveSigned = mtnApprovalState({ purpose: 'improve', dept_manager_at: '2026-09-15T02:00:00Z' });
  assert.equal(improveSigned.blocked, false);
  assert.deepEqual(improveSigned.missing, []);

  const repair = mtnApprovalState({ purpose: 'repair' });
  assert.equal(repair.blocked, false, 'งานซ่อมห้ามบล็อกเด็ดขาด');
  assert.equal(repair.ackPending, true, 'แต่ต้องรู้ว่ายังค้างเซ็นรับทราบ');
  assert.equal(mtnApprovalState({ purpose: 'repair', dept_manager_at: 'x' }).ackPending, false);
});

test('งานสร้างต้องครบ 2 ลายเซ็น (ต้นสังกัด + ผจก.โรงงาน)', () => {
  assert.deepEqual(mtnApprovalState({ purpose: 'build' }).missing, ['dept', 'plant']);
  const half = mtnApprovalState({ purpose: 'build', dept_manager_at: 'x' });
  assert.deepEqual(half.missing, ['plant']);
  assert.equal(half.blocked, true, 'เซ็นครึ่งเดียวยังเริ่มงานไม่ได้');
  assert.equal(mtnApprovalState({ purpose: 'build', dept_manager_at: 'x', plant_manager_at: 'y' }).blocked, false);
});

test('ใบเก่าที่ไม่มี purpose: ไม่บล็อก ไม่ค้างเซ็น (ทีม JIG/DIE/PRODUCTION ต้องไม่กระทบ)', () => {
  const legacy = mtnApprovalState({ status: 'pending' });
  assert.equal(legacy.blocked, false);
  assert.equal(legacy.blocking, false);
});

test('ช่องติ๊กจุดประสงค์บนใบพิมพ์เดาจาก repair_type ได้ (คนละตัวกับด่านกั้นงาน)', () => {
  assert.equal(purposeOfPrint({ purpose: 'service' }), 'service');
  assert.equal(purposeOfPrint({ repair_type: 'งานปรับปรุง (IM)' }), 'improve');
  assert.equal(purposeOfPrint({ repair_type: 'BM' }), 'repair');
  assert.equal(needsApprovalFirst({ repair_type: 'งานปรับปรุง (IM)' }), false, 'ด่านกั้นงานต้องไม่เดาจาก repair_type');
});

/* ── สาเหตุเกิดจาก: ป้ายชุดเดียวกับ CAUSE_CATS (18/11 · ใช้ทั้งจอ · ใบพิมพ์ · Excel) */
test('causeText — ป้ายจาก CAUSE_CATS · เติม "อื่นๆ" ที่พิมพ์เอง · รับ 2 รูปคีย์', () => {
  assert.equal(causeText({ cause_category: 'part_life' }), 'อายุอะไหล่');
  assert.equal(causeText({ causeCategory: 'man' }), 'คน', 'loader แปลงเป็น camelCase แล้วต้องยังอ่านได้');
  assert.equal(causeText({ cause_category: 'other', cause_other: 'ไฟตก' }), 'อื่นๆ — ไฟตก');
  assert.equal(causeCatLabel('method'), 'วิธีการทำงาน');
});

test('🔴 คีย์ที่ไม่รู้จัก = คืนคีย์ดิบ ห้ามกลืนหาย · ไม่เลือกหมวดแต่พิมพ์ไว้ = เอาข้อความมาแสดง', () => {
  assert.equal(causeText({ cause_category: 'machine' }), 'machine', 'หมวดที่เพิ่มทีหลังต้องยังเห็นในรายงาน');
  assert.equal(causeText({ cause_category: null, cause_other: 'ของเก่าไม่ได้ติ๊กหมวด' }), 'ของเก่าไม่ได้ติ๊กหมวด');
  assert.equal(causeText({}), '');
  assert.equal(causeText(), '');
  assert.equal(causeCatLabel('ไม่มีจริง'), null, 'ไม่รู้จัก = null ให้ผู้เรียกตัดสิน ห้ามคืนคีย์ดิบเป็นป้าย');
});

/* ── ✍️ ช่องเซ็นที่ 1 ของ FM-JIG-008 = "ฝั่งช่าง" (19/11 · หน้างานแจ้งจากใบจริง)
   *"อันนี้ MO die แต่ไปดึงชื่อช่างมา มันต้องดึงหัวหน้า/วิศวกร ช่างส่วนงานนั้น และลายเซ็น"* */
test('ใบทีมเครื่องมือ (DIE/JIG) — ช่อง 1 ต้องเป็นหัวหน้าแผนกช่างที่ตรวจรับขั้น 4 ไม่ใช่ช่างที่ซ่อม', async () => {
  const { moTechSignBox } = await import('../mtnMoForm.js');
  const die = {
    mtn_dept: 'die_maintenance',
    tech_main: 'อนุพนธ์ เค้าแคน', tech_main_uid: null, repair_done_at: '2026-11-12T08:01:14Z',
    checker_name: 'toolingmaintenance', checker_uid: 'u-head', check_at: '2026-11-18T02:09:41Z',
  };
  const r = moTechSignBox(die, 'DIE', 'JIG APPROVE');
  assert.equal(r.who, 'checker');
  assert.equal(r.name, 'toolingmaintenance');
  assert.equal(r.uid, 'u-head', 'ต้องได้ uid มาด้วย ไม่งั้นลายเซ็นไม่ขึ้น (ใบ DIE 82/82 ใบไม่มีลายเซ็นเพราะ tech_main_uid ว่าง)');
  assert.equal(r.at, '2026-11-18T02:09:41Z');
  assert.equal(r.label, 'DIE APPROVE', '🔴 ใบ DIE ห้ามขึ้นป้าย JIG APPROVE');
});

test('🔴 ใบฝ่ายผลิต (AM) ไม่เปลี่ยน — ยังเป็นช่างที่ซ่อม (ขั้น 4 ของใบผลิต = ฝ่ายที่แจ้ง)', async () => {
  const { moTechSignBox } = await import('../mtnMoForm.js');
  const pro = {
    mtn_dept: 'production',
    tech_main: 'สมชาย', tech_main_uid: 'u-tech', repair_done_at: '2026-11-18T01:00:00Z',
    checker_name: 'หัวหน้าไลน์', checker_uid: 'u-line', check_at: '2026-11-18T02:00:00Z',
  };
  const r = moTechSignBox(pro, 'PRO', 'JIG APPROVE');
  assert.equal(r.who, 'tech');
  assert.equal(r.name, 'สมชาย');
  assert.equal(r.label, 'PRO APPROVE');
});

test('🔴 ไม่รู้รหัสทีม = ใช้ป้ายตั้งต้นจาก /doc-forms ห้าม hardcode ในโค้ดพิมพ์', async () => {
  const { moTechSignBox } = await import('../mtnMoForm.js');
  assert.equal(moTechSignBox({ mtn_dept: 'die_maintenance' }, '', 'JIG APPROVE').label, 'JIG APPROVE');
  assert.equal(moTechSignBox({ mtn_dept: 'die_maintenance' }, 'die', 'x').label, 'DIE APPROVE', 'รหัสเล็กต้องเป็นตัวใหญ่');
  /* ช่องว่างทั้งคู่ = ไม่มีป้าย (ไม่ใช่ "undefined APPROVE") */
  assert.equal(moTechSignBox({}, '', '').label, '');
});
