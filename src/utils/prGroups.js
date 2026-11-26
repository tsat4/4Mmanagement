/* ══ 🧾 "1 ใบ PR มีหลายรายการ" — จัดกลุ่มแถวขอซื้อตามเลข PR ══════════  2026-11-18
   หน้างานแจ้ง (PDF 18/11 ข้อ 1): *"บาง PR เปิดหลายชิ้น ใน Vendor เจ้าเดียว ·
   สิ่งที่ควรจะเป็น: สามารถเพิ่มรายการใน 1 PR ได้"*

   ── ที่มา (ของจริงในฐาน DR · วัด 18/11) ─────────────────────────────────────────
   ใบ **O-MTN.2026/10-47** มีแถวขอซื้อ **19 แถว ใช้เลข PR เดียวกันหมด `1210104223`**
   (ท่อไฮดรอลิก Abex Hydraulic 19 ขนาด) — คนหน้างาน "เปิดทีละแถว" เพราะระบบให้ 1 แถว = 1 รายการ
   ผลที่ตามมาจริง: 15 แถวได้เลข PO · **2 แถวไม่เคยได้เลข PO** · 1 แถวไม่มี GL · 2 แถว supplier หาย
   ⇒ ใบนี้ไปโผล่ถัง ② "รอสั่ง" ทั้งที่ของสั่งไปแล้ว (แถวที่ตกหล่นลากทั้งใบ)

   ── 🔴 กฎของไฟล์นี้ ───────────────────────────────────────────────────────────
   1. **เลข PR คือตัวจัดกลุ่ม ไม่ใช่ supplier** — เลข PR มาจาก SAP = ของจริงใบเดียว
      (supplier/GL พิมพ์ต่างกันได้ในใบเดียวกัน ตามของจริงข้างบน)
   2. **ยังไม่มีเลข PR = จัดกลุ่มไม่ได้** ⇒ แถวละกลุ่ม (พฤติกรรมเดิมเป๊ะ) **ห้ามเดาว่าใบเดียวกัน**
   3. **จัดกลุ่มเพื่อ "มองเห็น" ไม่ใช่เพื่อสรุปสถานะ** — กลุ่มที่สถานะไม่ตรงกันต้อง**บอกว่าไม่ตรง**
      ห้ามเลือกสถานะเด่นมาแสดงเป็นของทั้งกลุ่ม (นั่นคือสาเหตุที่ 2 แถวหายไปเงียบๆ)
   4. ตัวเทียบเลข = `normalizePrNo()` ชุดเดียวกับที่ใช้ตัดซ้ำบนใบพิมพ์ (ห้ามเทียบสตริงดิบ)         */
import { normalizePrNo, isPrOpen } from './mtnPurchase.js';

const txt = (v) => String(v ?? '').trim();

/**
 * จัดกลุ่มแถวขอซื้อของใบ MO หนึ่งใบ
 * @returns {Array<{ key:string, prNo:string|null, rows:object[], suppliers:string[],
 *                   openRows:object[], noPo:object[], noGl:object[], statuses:string[], warns:string[] }>}
 *   เรียงตามลำดับแถวแรกของกลุ่ม (คงลำดับ `requested_at` ที่ผู้เรียกส่งมา)
 */
export function groupPrs(prs = []) {
  const out = [];
  const byKey = new Map();
  for (const p of prs || []) {
    if (!p) continue;
    const no = normalizePrNo(p.pr_no);
    /* ไม่มีเลข = กลุ่มของตัวเอง (กฎข้อ 2) — ใช้ id กันชนกัน */
    const key = no ? `pr:${no}` : `row:${p.id}`;
    let g = byKey.get(key);
    if (!g) {
      g = { key, prNo: no ? txt(p.pr_no) : null, rows: [], suppliers: [], openRows: [], noPo: [], noGl: [], statuses: [], warns: [] };
      byKey.set(key, g); out.push(g);
    }
    g.rows.push(p);
    const sup = txt(p.supplier);
    if (sup && !g.suppliers.includes(sup)) g.suppliers.push(sup);
    if (!g.statuses.includes(p.status)) g.statuses.push(p.status);
    if (isPrOpen(p)) {
      g.openRows.push(p);
      if (!normalizePrNo(p.po_no)) g.noPo.push(p);
      if (!txt(p.gl_code)) g.noGl.push(p);
    }
  }
  for (const g of out) {
    if (g.rows.length < 2) continue;
    /* 🔴 กฎข้อ 3 — บอกทุกอย่างที่ไม่ตรงกัน ไม่ใช่เลือกค่าเด่นมาแสดง */
    const liveStatuses = [...new Set(g.rows.filter(r => r.status !== 'cancelled').map(r => r.status))];
    if (liveStatuses.length > 1) g.warns.push(`สถานะในใบนี้ไม่ตรงกัน (${liveStatuses.join(' · ')}) — รายการที่ตกหล่นจะลากทั้งใบค้างอยู่ขั้นเดิม`);
    if (g.openRows.length && g.noPo.length && g.noPo.length < g.openRows.length)
      g.warns.push(`${g.noPo.length} จาก ${g.openRows.length} รายการยังไม่มีเลข PO`);
    if (g.noGl.length) g.warns.push(`${g.noGl.length} รายการยังไม่ระบุ GL`);
    if (g.suppliers.length > 1) g.warns.push(`ผู้ขายในใบเดียวกันเขียนไม่ตรงกัน (${g.suppliers.join(' / ')})`);
  }
  return out;
}

/** ค่าที่ควรถูกเติมให้อัตโนมัติเมื่อ "เพิ่มรายการในใบ PR เดิม" — เอาจากแถวที่มีข้อมูลครบที่สุด */
export function prGroupDefaults(group) {
  const rows = (group?.rows || []).filter(r => r && r.status !== 'cancelled');
  const pick = (k) => { for (const r of rows) { const v = txt(r[k]); if (v) return v; } return ''; };
  return {
    pr_no: txt(group?.prNo) || '',
    supplier: pick('supplier'),
    gl_category: pick('gl_category'),
    gl_code: pick('gl_code'),
    unit: '',
  };
}

export default { groupPrs, prGroupDefaults };
