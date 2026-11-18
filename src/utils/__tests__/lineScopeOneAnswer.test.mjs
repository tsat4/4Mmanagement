/* 🔭🔭 "บัญชีนี้เห็นไลน์ไหน" ต้องมีคำตอบเดียว — ด่านของการยุบ 29/10
   เดิม scopedLines() กับ scopedLineNames() ตอบคนละอย่างบนบัญชีเดียวกัน
   ⇒ อาการที่หน้างานแจ้งซ้ำทุกสัปดาห์: "เห็นของทุกไลน์ แต่เปิดกะเลือกไลน์ตัวเองไม่ได้"

   29/10 ยุบเหลือแกนเดียว `lineScope()` + **user เคาะให้ใช้ท่าเดียวกันทุกจอ**
   ("ให้เห็นส่วนงานตัวเองทุกจอ") ⇒ ไฟล์นี้บังคับว่า **ทั้ง 2 ทางต้องตอบชุดเดียวกันทุกเคส**
   เหลือยกเว้นจุดเดียวคือ `sections_unmatched` (fail-closed vs fail-open) ที่ตั้งธง unsure ไว้ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineScope, scopedLines, scopedLineNames } from '../sectionScope.js';

const LINES = [
  { id: 1, name: 'LWR BAR',     section: 'PD4', parent_line_name: null },
  { id: 2, name: 'LWR BAR 306', section: 'PD4', parent_line_name: 'LWR BAR' },
  { id: 3, name: '250T',        section: 'PD4', parent_line_name: null },
  { id: 4, name: 'HYDRO',       section: 'PD3', parent_line_name: null },
];
const names = rows => rows.map(l => l.name).sort();

/** ชุดที่ "ชื่อไลน์" ตอบ — แปลง null (ไม่จำกัด) ให้เทียบกับชุดเต็มได้ */
const nameSet = (args) => {
  const n = scopedLineNames(args);
  return (n === null ? LINES.map(l => l.name) : n).slice().sort();
};

const CASES = [
  ['admin',                     { role: 'admin',      lineId: null, sections: [],      lines: LINES }],
  ['supervisor PD4',            { role: 'supervisor', lineId: null, sections: ['PD4'], lines: LINES }],
  ['supervisor ไม่จำกัด',        { role: 'supervisor', lineId: null, sections: [],      lines: LINES }],
  ['leader 306 + PD4',          { role: 'leader',     lineId: 2,    sections: ['PD4'], lines: LINES }],
  ['leader ไลน์แม่ + PD4',       { role: 'leader',     lineId: 1,    sections: ['PD4'], lines: LINES }],
  ['leader 306 ไม่มีส่วนงาน',    { role: 'leader',     lineId: 2,    sections: [],      lines: LINES }],
  ['leader ไลน์หาย + PD4',       { role: 'leader',     lineId: 99,   sections: ['PD4'], lines: LINES }],
  ['ส่วนงานที่ผังไม่รู้จัก',      { role: 'supervisor', lineId: null, sections: ['ไม่มีจริง'], lines: LINES }],
];

for (const [label, args] of CASES) {
  test(`🔭 สองทางต้องตอบเหมือนกัน — ${label}`, () => {
    const viaObjs = names(scopedLines(args));
    const viaName = nameSet(args);
    // 'ส่วนงานที่ผังไม่รู้จัก' = ช่องว่างที่เหลืออยู่จุดเดียว (fail-closed vs fail-open) — ยกเว้นไว้ชัดๆ
    if (label === 'ส่วนงานที่ผังไม่รู้จัก') {
      assert.deepEqual(viaObjs, [], 'ฝั่งตัวไลน์ยัง fail-closed');
      assert.equal(lineScope(args).unsure, true, '🔴 ต้องตั้งธง unsure ให้จอเขียนบนจอ');
      return;
    }
    assert.deepEqual(viaObjs, viaName, `🔴 ${label}: 2 ทางตอบไม่ตรงกัน = บั๊กเรื้อรังกลับมาแล้ว`);
  });
}

test('🔴 หัวหน้ากลุ่ม = ไลน์ตัวเอง ∪ ส่วนงานที่กำกับ — ใช้ทั้ง 2 ทาง (user เคาะ 29/10)', () => {
  const a = { role: 'leader', lineId: 2, sections: ['PD4'], lines: LINES };
  assert.deepEqual(names(scopedLines(a)), ['250T', 'LWR BAR', 'LWR BAR 306']);
  assert.deepEqual(nameSet(a),            ['250T', 'LWR BAR', 'LWR BAR 306']);
  // ข้ามส่วนงานยังห้ามเห็นทั้ง 2 ทาง — ขอบเขตยังเป็นค่าที่ admin ตั้งไว้
  assert.ok(!names(scopedLines(a)).includes('HYDRO'));
  assert.ok(!nameSet(a).includes('HYDRO'));
});

test('🔴 sections ว่าง (scope_depth=all ที่ตั้งผิด) ยังถูกบีบเหลือครอบครัวไลน์ตัวเอง', () => {
  // "ครอบครัว" = ตัวเอง + สายแม่ + ลูก (getLineFamily · ไม่ลากไลน์พี่น้องมา)
  assert.deepEqual(nameSet({ role: 'leader', lineId: 2, sections: [], lines: LINES }), ['LWR BAR', 'LWR BAR 306']);
  assert.deepEqual(nameSet({ role: 'leader', lineId: 1, sections: [], lines: LINES }), ['LWR BAR', 'LWR BAR 306']);
  // ยังไม่หลุดไปเห็นทั้งโรงงาน — 250T อยู่ PD4 เหมือนกันแต่ไม่ใช่ครอบครัว
  const n = nameSet({ role: 'leader', lineId: 2, sections: [], lines: LINES });
  assert.ok(!n.includes('HYDRO') && !n.includes('250T'));
});

test('🔴 ทะเบียนยังไม่โหลด = ไม่จำกัด + unsure (ห้ามคืน [] = จอว่างทั้งระบบ)', () => {
  const r = lineScope({ role: 'leader', lineId: 2, sections: ['PD4'], lines: [] });
  assert.equal(r.unlimited, true);
  assert.equal(r.unsure, true);
  assert.equal(r.reason, 'registry_unloaded');
  assert.deepEqual(scopedLines({ role: 'leader', lineId: 2, sections: ['PD4'], lines: [] }), []);
});

test('🔴 หาไลน์ตัวเองไม่เจอ = unsure ทุกทาง (จอต้องบอก ไม่ใช่โชว์ "ไม่มีรายการ")', () => {
  assert.equal(lineScope({ role: 'leader', lineId: 99, sections: ['PD4'], lines: LINES }).unsure, true);
  assert.equal(lineScope({ role: 'leader', lineId: 99, sections: [],      lines: LINES }).unsure, true);
});

test('lines กับ names เป็นชุดเดียวกันเสมอ (ในท่าเดียวกัน)', () => {
  for (const [, args] of CASES.map(c => c)) {
    const r = lineScope(args);
    assert.deepEqual(r.names.slice().sort(), names(r.lines), 'สองช่องนี้ห้ามไม่ตรงกัน');
  }
});

/* ══ 🏭 ส่วนงานที่เป็น "หน่วยสนับสนุนล้วน" — แกนไลน์ไม่ใช่ขอบเขตของเขา (2026-11-17) ══
   เคสจริงหน้างาน: เสมียน Tooling MTN เปิด /mtn-repair ได้ **0 ใบ จาก 2,072 ใบ**
   ต้นเหตุ: 05/11 เอาหน่วยสนับสนุนเข้าทะเบียนไลน์ ⇒ `scopedBySections` เริ่มหาเจอ
     ⇒ เลิกตกเข้า `sections_unmatched` (ไม่จำกัด) ⇒ ตัดใบทิ้งเงียบๆ ทั้ง 26 บัญชี
     (QA · Planning&Store · Maintenance · JIG/Tooling MTN + จอ TV ของหน่วยพวกนี้)
   🔴 ไม่ใช่การขยายสิทธิ์ — `writeScope.js` ไม่ได้ใช้ `lineScope()` (ขอบเขต "ที่เห็น" ล้วน) */
test('🏭 support_only — ส่วนงานสนับสนุนล้วน ต้องไม่ถูกตัดด้วยแกนไลน์', () => {
  const lines = [
    { id: 1, name: 'Line 61', section: 'PD1' },
    { id: 2, name: 'HYDROFORM', section: 'PD2' },
    { id: 3, name: 'Tooling MTN', section: 'Tooling MTN', unit_kind: 'support' },
    { id: 4, name: 'Die MTN', section: 'Tooling MTN', unit_kind: 'support', parent_line_name: 'Tooling MTN' },
    { id: 5, name: 'Maintenance', section: 'Maintenance', unit_kind: 'support' },
  ];
  const r = lineScope({ role: 'mtn', lineId: null, sections: ['Maintenance', 'Tooling MTN'], lines });
  assert.equal(r.unlimited, true, 'เสมียน MTN ต้องเห็นใบของทุกไลน์ (ช่างทำงานข้ามไลน์เป็นปกติ)');
  assert.equal(r.reason, 'support_only');
  assert.equal(r.unsure, true, 'ต้องติดธงให้จอเขียนว่าขอบเขตไม่ชัด');
  assert.ok(r.names.includes('Line 61'), 'ไลน์ผลิตต้องอยู่ในชุดที่เห็น');

  /* 🔴 ช่องเลือกไลน์ต้องเลือกไลน์ผลิตได้ด้วย (ไม่งั้นเปิดใบแจ้งซ่อมให้ไลน์ไหนไม่ได้เลย) */
  assert.ok(scopedLines({ role: 'mtn', lineId: null, sections: ['Tooling MTN'], lines })
    .some(l => l.name === 'Line 61'), 'ช่องเลือกไลน์ต้องมีไลน์ผลิต');
});

test('🔴 ของเดิมห้ามเปลี่ยน — ส่วนงานผลิต และส่วนงานผสม ยังตัดเหมือนเดิม', () => {
  const lines = [
    { id: 1, name: 'Line 61', section: 'PD1' },
    { id: 2, name: 'HYDROFORM', section: 'PD2' },
    { id: 3, name: 'Tooling MTN', section: 'Tooling MTN', unit_kind: 'support' },
  ];
  const prod = lineScope({ role: 'supervisor', lineId: null, sections: ['PD1'], lines });
  assert.equal(prod.unlimited, false);
  assert.deepEqual(prod.names, ['Line 61'], 'หัวหน้าส่วนงานผลิตต้องยังเห็นแค่ไลน์ของตัวเอง');

  /* ผสม = มีไลน์ผลิตอยู่ด้วย ⇒ แกนไลน์ยังใช้ได้ ห้ามปลดเป็นไม่จำกัด */
  const mix = lineScope({ role: 'supervisor', lineId: null, sections: ['PD1', 'Tooling MTN'], lines });
  assert.equal(mix.unlimited, false, 'มีไลน์ผลิตอยู่ในขอบเขต = ยังตัดตามเดิม');
  assert.ok(mix.names.includes('Line 61') && mix.names.includes('Tooling MTN'));
});
