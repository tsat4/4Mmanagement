/* 🔎 insight ของแผ่น KPI (16/11) — เรียบเรียงจากตัวเลขที่ตัดสินแล้ว ไม่คิดเกณฑ์เอง · ไม่มีข้อมูล = ไม่เขียนข้อนั้น */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInsight, formulaDrivers } from '../kpiInsight.js';
import { yearForecast, neededRunRate } from '../kpiSetup.js';

const M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const fmt = (v) => `${Number(v).toFixed(2)} %`;
const series = [0.953, 0.98, 1.1503, 1.2, 0.9301, 1.1, 0.9469, 0.8, 0.7159, 1.1794, null, null].map((v, i) => ({ k: `2026-${String(i + 1).padStart(2, '0')}`, v, notes: i === 9 ? [{ kind: 'remark', text: 'ยอดขายตก' }] : [] }));
const statusOf = (p) => (p.v <= 1.017 ? 'good' : p.v <= 1.0485 ? 'warn' : 'bad');

test('buildInsight: DL+OH ต.ค. เกินเป้า — บอกส่วนต่าง · นับเดือนหลุด · แนวโน้ม · ตัวแปรสูตร+เหตุหลัก · หมายเหตุ · ปลายปี + อัตราที่ต้องทำ', () => {
  const info = { key: 'dloh_pct', inputs: { 9: { dl: 900000, oh: 480000, sale_product: 147816190 }, 10: { dl: 856655, oh: 478507, sale_product: 113207777 } } };
  const actual = series.map(p => p.v);
  const def = { kpi_catalog: { summary_mode: 'average' } };
  const forecast = { ...yearForecast({ actual, plan: [], def, fallback: true }), status: 'good' };
  const needed = neededRunRate({ actual, target: 1.017, def });
  const lines = buildInsight({ series, valueIdx: 9, value: 1.1794, target: 1.017, commit: 1.0485, dir: 'down', targetCompare: '≤',
    monthStatus: statusOf, fmt, monthOf: (i) => M[i], info, forecast, needed });
  const txt = lines.map(l => l.text).join('\n');
  assert.match(txt, /ต\.ค\. 1\.18 % เทียบ Target ≤ 1\.02 % → เกินเป้า 0\.16 %/);
  assert.match(txt, /หลุด Commitment/);
  assert.match(txt, /หลุด 4 \(มี\.ค\. เม\.ย\. มิ\.ย\. ต\.ค\.\)/);
  assert.match(txt, /เทียบ ก\.ย\. 0\.72 % → 1\.18 %.*แย่ลง/);
  assert.match(txt, /ตัวหาร \(ยอดขายจากสินค้า\) ลด 23\.4% แรงกว่าตัวตั้ง/);   // ยอดขายหด = เหตุหลัก ไม่ใช่ DL/OH
  assert.match(txt, /Remark: ยอดขายตก/);
  assert.match(txt, /คาดปลายปี .* \(จริง 10 ด\. · ถ้าเดือนที่เหลือ 2 ด\. ทำได้เท่าค่าเฉลี่ย/);
  assert.match(txt, /เดือนที่เหลือ 2 ด\. ต้องไม่เกินเฉลี่ยเดือนละ/);
});

test('buildInsight: ไม่มีเป้า/ไม่มีค่า = ไม่เขียนข้อเทียบเป้า · ไม่มีสูตร = ไม่มีบรรทัด 🧮 · ว่างได้', () => {
  assert.deepEqual(buildInsight({ series: [], value: null }), []);
  const lines = buildInsight({ series, valueIdx: 9, value: 1.1794, target: null, commit: null, dir: 'down', fmt, monthOf: (i) => M[i] });
  assert.ok(!lines.some(l => /Target/.test(l.text)));
  assert.ok(lines.some(l => l.icon === '📉' || l.icon === '📈'));   // แนวโน้มยังบอกได้โดยไม่ต้องมีเป้า
});

test('formulaDrivers: ตัวตั้งขยับแรงกว่า ⇒ เหตุหลัก = ตัวตั้ง · ตัวแปรขาด = driver null', () => {
  const info = { key: 'rm_pct', inputs: { 1: { raw_material: 100, sale_product: 1000 }, 2: { raw_material: 150, sale_product: 1010 } } };
  const d = formulaDrivers(info, 2, 1);
  assert.equal(d.driver.main, 'num'); assert.match(d.driver.text, /ตัวตั้ง \(ต้นทุนวัตถุดิบ\) เพิ่ม 50\.0%/);
  assert.equal(formulaDrivers({ key: 'rm_pct', inputs: { 1: { raw_material: 100 }, 2: { raw_material: 150, sale_product: 1 } } }, 2, 1).driver, null);
  assert.equal(formulaDrivers(null, 2, 1), null);
});

test('buildInsight: ตัวสะสม (max) — ถึงเป้าแล้ว/ยังต้องเพิ่มอีก · ตัวยิ่งสูงยิ่งดีที่ผ่านแล้ว = "ได้ 0 ก็ยังผ่าน"', () => {
  const cum = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, null, null].map((v, i) => ({ k: `2026-${String(i + 1).padStart(2, '0')}`, v }));
  const defMax = { kpi_catalog: { summary_mode: 'max' } };
  const n1 = neededRunRate({ actual: cum.map(p => p.v), target: 12, def: defMax });
  const l1 = buildInsight({ series: cum, valueIdx: 8, value: 9, target: 12, dir: 'up', fmt: (v) => String(v), monthOf: (i) => M[i], needed: n1 });
  assert.match(l1.map(l => l.text).join('\n'), /ต้องไปให้ถึง 12 ภายใน 3 เดือนที่เหลือ \(เพิ่มอีก 3\)/);
  const defSum = { kpi_catalog: { summary_mode: 'sum' } };
  const n2 = neededRunRate({ actual: cum.map(p => p.v), target: 20, def: defSum });   // Σ = 45 ≥ 20 แล้ว
  const l2 = buildInsight({ series: cum, valueIdx: 8, value: 9, target: 20, dir: 'up', fmt: (v) => String(v), monthOf: (i) => M[i], needed: n2 });
  assert.match(l2.map(l => l.text).join('\n'), /ได้ 0 ก็ยังผ่าน/);
});
