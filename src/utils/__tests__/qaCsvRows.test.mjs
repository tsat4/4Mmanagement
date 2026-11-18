/* เทส qaCsvRows — ตัวจัดแถวของ CSV "ผลตรวจ QA" (2026-11-16)
   โจทย์ที่ต้องผ่าน:
   1. 🔴 ค่าที่ไม่มี/คิดไม่ได้ = **ช่องว่าง ห้ามเป็น 0** (0 บน CSV อ่านว่า "วัดได้ศูนย์")
   2. 🔴 ค่าว่าง/ไม่ใช่ตัวเลข ไม่ใช่ค่าวัด ⇒ ไม่ลงไฟล์ SPC (ห้ามเดาเป็น 0 = กราฟควบคุมเพี้ยน)
   3. จุดที่กด "ข้าม" (na) ยังอยู่ในไฟล์ผลตรวจรายพาร์ท (ข้อเท็จจริงว่าไม่ได้ตรวจ)
      แต่ค่าของมันไม่ถูกบังคับให้เป็น 0
   4. ความยาวแถว = ความยาวหัวตารางเสมอ (คอลัมน์เลื่อน = พัง pivot ของผู้ใช้)
   5. เรียง วันงาน → กะ (เช้าก่อนดึก) → รอบ → บอลลูน (natural: #2 ก่อน #10)
   6. "หลุด spec" ตอบได้เฉพาะจุดที่มี limit — ไม่มี limit = ว่าง (ห้ามตอบว่าไม่หลุด) */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  QA_RESULT_HEADERS, qaResultCsvRows,
  QA_SPC_VALUE_HEADERS, qaSpcValueRows, spcValuesFrom, outOfSpec,
  QA_SPC_SUMMARY_HEADERS, qaSpcSummaryRows, spcPointVerdict, CPK_OK,
} from '../qaCsvRows.js';

const sheet = (o) => ({
  id: 's1', part_no: 'P-100', part_name: 'BRACKET', line_name: '060', work_date: '2026-11-10',
  shift: 'day', round_no: 1, stage: 'inprocess', status: 'done', result: 'pass',
  inspector_name: 'สมชาย', inspector_code: 'E001', ...o,
});
const res = (o) => ({
  sheet_id: 's1', balloon_no: '1', characteristic: 'ระยะรู', item_type: 'variable',
  spec_text: '5 (4 – 6) mm', judgement: 'ok', values_json: [5.01], qty_checked: 1, qty_ng: 0, ...o,
});

/* ── 1) ผลตรวจรายพาร์ท ───────────────────────────────────────────────── */
test('ความยาวแถวผลตรวจ = ความยาวหัวตาราง', () => {
  const rows = qaResultCsvRows([sheet()], [res()]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].length, QA_RESULT_HEADERS.length);
});

test('🔴 ค่าที่ไม่มี = ช่องว่าง ห้ามเป็น 0 (qty_checked / รอบ / ค่าที่วัด)', () => {
  const [r] = qaResultCsvRows(
    [sheet({ round_no: null })],
    [res({ qty_checked: null, values_json: null, judgement: 'na' })],
  );
  const col = (name) => r[QA_RESULT_HEADERS.indexOf(name)];
  assert.equal(col('จำนวนที่ตรวจ'), '');
  assert.equal(col('รอบที่'), '');
  assert.equal(col('ค่าที่วัด (ทุกชิ้น)'), '');
  assert.equal(col('ผลตัดสิน'), 'ข้าม (ไม่ได้ตรวจ)');   // จุดที่ข้ามยังต้องอยู่ในไฟล์
  // qty_ng เป็น not-null default 0 ฝั่ง DB ⇒ 0 = "นับแล้วได้ศูนย์" เป็นเลขจริง
  assert.equal(col('จำนวน NG'), 0);
});

test('ป้ายกะ/สถานะ/ช่วงตรวจ เป็นไทย · ค่าหลายชิ้นต่อกันด้วย |', () => {
  const [r] = qaResultCsvRows([sheet({ shift: 'night' })], [res({ values_json: [5.0, '', 5.2] })]);
  const col = (name) => r[QA_RESULT_HEADERS.indexOf(name)];
  assert.equal(col('กะ'), 'ดึก');
  assert.equal(col('สถานะใบ'), 'ปิดใบแล้ว');
  assert.equal(col('ช่วงตรวจ'), 'ในกระบวนการ');
  assert.equal(col('ค่าที่วัด (ทุกชิ้น)'), '5 | 5.2');   // ช่องที่ยังไม่กรอกถูกตัด ไม่กลายเป็น 0
});

test('ผลที่หาหัวใบไม่เจอ = ไม่เข้าไฟล์ (ห้ามแถวครึ่งๆ)', () => {
  assert.deepEqual(qaResultCsvRows([sheet()], [res({ sheet_id: 'ไม่มี' })]), []);
});

test('เรียง วันงาน → กะ → รอบ → บอลลูน (natural)', () => {
  const sheets = [
    sheet({ id: 'a', work_date: '2026-11-11', shift: 'day', round_no: 1 }),
    sheet({ id: 'b', work_date: '2026-11-10', shift: 'night', round_no: 1 }),
    sheet({ id: 'c', work_date: '2026-11-10', shift: 'day', round_no: 2 }),
    sheet({ id: 'd', work_date: '2026-11-10', shift: 'day', round_no: 1 }),
  ];
  const results = [
    res({ sheet_id: 'a', balloon_no: '1' }),
    res({ sheet_id: 'b', balloon_no: '1' }),
    res({ sheet_id: 'c', balloon_no: '1' }),
    res({ sheet_id: 'd', balloon_no: '10' }),
    res({ sheet_id: 'd', balloon_no: '2' }),
  ];
  const iD = QA_RESULT_HEADERS.indexOf('วันงาน');
  const iS = QA_RESULT_HEADERS.indexOf('กะ');
  const iR = QA_RESULT_HEADERS.indexOf('รอบที่');
  const iB = QA_RESULT_HEADERS.indexOf('บอลลูน');
  assert.deepEqual(qaResultCsvRows(sheets, results).map(r => [r[iD], r[iS], r[iR], r[iB]]), [
    ['2026-11-10', 'เช้า', 1, '2'],
    ['2026-11-10', 'เช้า', 1, '10'],
    ['2026-11-10', 'เช้า', 2, '1'],
    ['2026-11-10', 'ดึก', 1, '1'],
    ['2026-11-11', 'เช้า', 1, '1'],
  ]);
});

/* ── 2) SPC — ค่าวัดรายค่า ───────────────────────────────────────────── */
test('🔴 spcValuesFrom: ค่าว่าง/ไม่ใช่ตัวเลข ไม่ใช่ค่าวัด (ห้ามเดา 0)', () => {
  const vals = spcValuesFrom([
    { readings: [5.1, '', null, 'abc', 0], work_date: '2026-11-10', shift: 'day', round_no: 3 },
  ]);
  assert.deepEqual(vals.map(v => v.value), [5.1, 0]);          // 0 ที่กรอกเองคือค่าวัดจริง
  assert.deepEqual(vals.map(v => v.piece_no), [1, 5]);         // ชิ้นที่ยึดตำแหน่งเดิมในชุด
});

test('spcValuesFrom รับได้ทั้งค่าจากใบตรวจ (piece_no มาแล้ว) และ subgroup ที่ตั้งเอง', () => {
  const fromSheet = spcValuesFrom([{ readings: [4.9], piece_no: 7, work_date: '2026-11-10' }]);
  assert.equal(fromSheet[0].piece_no, 7);
  const manual = spcValuesFrom([{ readings: [1, 2, 3] }]);
  assert.deepEqual(manual.map(v => v.piece_no), [1, 2, 3]);
});

test('🔴 หลุด spec ตอบได้เฉพาะจุดที่มี limit — ไม่มี limit = null (ห้ามตอบว่าไม่หลุด)', () => {
  assert.equal(outOfSpec(7, { lsl: 4, usl: 6 }), true);
  assert.equal(outOfSpec(5, { lsl: 4, usl: 6 }), false);
  assert.equal(outOfSpec(3, { lsl: 4 }), true);
  assert.equal(outOfSpec(5, {}), null);
  assert.equal(outOfSpec(null, { lsl: 4, usl: 6 }), null);
});

test('แถว SPC: ความยาวตรงหัวตาราง · ลำดับนับในจุดนั้น · ไม่หลุด spec = ว่าง', () => {
  const point = { part_no: 'P-100', part_name: 'BRACKET', line_name: '060', balloon_no: '3',
    characteristic: 'ระยะรู', unit: 'mm', lsl: 4, nominal: 5, usl: 6 };
  const rows = qaSpcValueRows([{ point, values: spcValuesFrom([
    { readings: [5.0], piece_no: 1, work_date: '2026-11-10', shift: 'day', round_no: 1, judgement: 'ok', operator_name: 'สมชาย' },
    { readings: [6.4], piece_no: 1, work_date: '2026-11-10', shift: 'night', round_no: 2, judgement: 'ng', operator_name: 'สมหญิง' },
  ]) }]);
  assert.equal(rows.length, 2);
  rows.forEach(r => assert.equal(r.length, QA_SPC_VALUE_HEADERS.length));
  const col = (r, name) => r[QA_SPC_VALUE_HEADERS.indexOf(name)];
  assert.equal(col(rows[0], 'ลำดับที่ (ในจุดนี้)'), 1);
  assert.equal(col(rows[1], 'ลำดับที่ (ในจุดนี้)'), 2);
  assert.equal(col(rows[0], 'หลุด spec'), '');
  assert.equal(col(rows[1], 'หลุด spec'), 'หลุด');
  assert.equal(col(rows[1], 'กะ'), 'ดึก');
  assert.equal(col(rows[0], 'LSL'), 4);
});

/* ── 3) SPC — สรุปรายจุด ─────────────────────────────────────────────── */
test('🔴 จุดที่ยังไม่มีค่า: n/Mean/Cpk/จำนวนหลุด = ว่าง + สถานะบอกว่ายังไม่มีค่า', () => {
  const [r] = qaSpcSummaryRows([{ point: { part_no: 'P-1', balloon_no: '1' }, n: 0, mean: null, cpk: null, oos: 0, last: null, lastDate: null }]);
  const col = (name) => r[QA_SPC_SUMMARY_HEADERS.indexOf(name)];
  assert.equal(r.length, QA_SPC_SUMMARY_HEADERS.length);
  assert.equal(col('จำนวนค่าที่ใช้คิด (n)'), '');
  assert.equal(col('Mean'), '');
  assert.equal(col('Cpk'), '');
  assert.equal(col('จำนวนค่าหลุด spec'), '');
  assert.equal(col('ค่าล่าสุด'), '');
  assert.equal(col('สถานะ'), 'ยังไม่มีค่าวัด');
});

test('สรุปรายจุด: ปัดทศนิยมแล้วยังเป็น "ตัวเลข" (Excel คิดสูตรต่อได้) · 0 ที่นับได้จริงยังเป็น 0', () => {
  const [r] = qaSpcSummaryRows([{
    point: { part_no: 'P-1', balloon_no: '2', lsl: 4, usl: 6 },
    n: 30, mean: 5.0004999, sigmaWithin: 0.123456789, sigmaOverall: 0.2, cp: 1.23456, cpk: 1.5, pp: 1.1, ppk: 1.0,
    oos: 0, last: 5.02, lastDate: '2026-11-12',
  }]);
  const col = (name) => r[QA_SPC_SUMMARY_HEADERS.indexOf(name)];
  assert.equal(col('Mean'), 5.0005);
  assert.equal(col('σ within'), 0.12346);
  assert.equal(col('Cp'), 1.235);
  assert.equal(col('จำนวนค่าหลุด spec'), 0);
  assert.equal(typeof col('Mean'), 'number');
  assert.equal(col('สถานะ'), 'ปกติ');
});

test('สถานะรายจุด: หลุด spec ชนะ Cpk ต่ำ · คิดไม่ได้ต้องอ่านออกว่าไม่รู้', () => {
  assert.equal(spcPointVerdict({ n: 10, cpk: 2, oos: 1 }), 'มีค่าหลุด spec');
  assert.equal(spcPointVerdict({ n: 10, cpk: 1.0, oos: 0 }), `Cpk < ${CPK_OK}`);
  assert.equal(spcPointVerdict({ n: 10, cpk: null, oos: 0 }).startsWith('คิด Cpk ไม่ได้'), true);
  assert.equal(spcPointVerdict({ n: 0, cpk: null, oos: 0 }), 'ยังไม่มีค่าวัด');
});
