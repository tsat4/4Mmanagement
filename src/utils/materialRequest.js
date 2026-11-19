/**
 * materialRequest — ใบขอเบิก/คืนสินค้าคงคลัง FM-STO-003 Rev.01
 *
 * ⚠️ นิยามตัวเลือก/สถานะอยู่ที่นี่ที่เดียว — จอ (MaterialRequests.jsx), ใบพิมพ์ (materialRequestPrint.js)
 *    และตัวดึงเข้าใบ scrap (ScrapReport.jsx) อ่านชุดเดียวกัน **ห้ามพิมพ์ซ้ำในไฟล์อื่น**
 *
 * ถอดจากใบกระดาษที่ user ส่งมา 2026-08-24 — ช่องติ๊กบนใบมี 2 บล็อก (เบิก/คืน) คนละชุดตัวเลือก
 * ตัวเลขในวงเล็บคือ movement type ของ SAP ที่พิมพ์อยู่บนใบจริง (311/261/201/907/202/908)
 */
import { linearFlow } from './stepFlow.js';

/** ประเภทของการเบิก (บล็อกบนของใบ) */
export const WITHDRAW_MOVES = [
  { code: 'prod', label: 'เบิกเพื่อการผลิต' },
  { code: '311', label: 'โอนย้ายไปยังพื้นที่การผลิต (311)', needs: 'dest' },
  { code: '261', label: 'จ่ายเข้า Production Order (261)', needs: 'order' },
  { code: '201', label: 'จ่ายเข้าศูนย์ต้นทุน (สำนักงาน-201)', needs: 'cc' },
  { code: '907', label: 'จ่ายเข้าศูนย์ต้นทุน (โรงงาน-907)', needs: 'cc' },
];

/** ประเภทของการคืน (บล็อกล่างของใบ) */
export const RETURN_MOVES = [
  { code: 'prod', label: 'คืนจากการผลิต' },
  { code: '311', label: 'โอนย้ายจากพื้นที่การผลิต (311)', needs: 'dest' },
  { code: '202', label: 'คืนจากศูนย์ต้นทุน (สำนักงาน-202)', needs: 'cc' },
  { code: '908', label: 'คืนจากศูนย์ต้นทุน (โรงงาน-908)', needs: 'cc' },
];

export const movesFor = (kind) => (kind === 'return' ? RETURN_MOVES : WITHDRAW_MOVES);
export const moveLabel = (kind, code) =>
  movesFor(kind).find(m => m.code === code)?.label || '';

/** ช่องข้างช่องติ๊กที่ต้องกรอกเมื่อเลือก move นั้น — ใช้ทั้งฟอร์มและตัว validate */
export const moveNeeds = (kind, code) => movesFor(kind).find(m => m.code === code)?.needs || null;

export const KIND_LABEL = { withdraw: 'เบิก', return: 'คืน' };

/**
 * สถานะใบ — ตามลำดับงานจริงบนใบกระดาษ
 *   draft → submitted (ส่งให้หัวหน้า) → approved (อนุมัติแล้ว) → issued (สโตร์จ่ายของแล้ว)
 * ⚠️ ดึงเข้าใบ scrap ได้ตั้งแต่ approved ขึ้นไป — ใบที่ยังไม่อนุมัติ = ยังไม่ได้ของ
 *    จะเอาไปรายงานว่าทำลายไปแล้วไม่ได้
 */
export const STATUS_META = {
  draft: { label: 'ร่าง', color: '#6b7280' },
  submitted: { label: 'รออนุมัติ', color: '#f59e0b' },
  approved: { label: 'อนุมัติแล้ว', color: '#3b82f6' },
  issued: { label: 'จ่ายของแล้ว', color: '#22c55e' },
  cancelled: { label: 'ยกเลิก', color: '#ef4444' },
};
export const statusMeta = (s) => STATUS_META[s] || { label: s || '—', color: '#6b7280' };

/** ใบที่ถือว่า "ได้ของไปแล้ว" — เกณฑ์เดียวที่ ScrapReport ใช้กรอง ห้ามเขียนซ้ำ */
export const PULLABLE = ['approved', 'issued'];
export const isPullable = (r) => PULLABLE.includes(r?.status);

/**
 * จำนวนที่ใช้เป็น "ของที่ถูกทำลาย" ตอนดึงเข้าใบ scrap
 * ⚠️ ยึด **จำนวนที่จ่ายจริง** ก่อนเสมอ — จำนวนที่ขอเบิกเป็นแค่คำขอ สโตร์อาจจ่ายไม่ครบ
 *    ไม่มีค่าที่จ่ายจริง (สโตร์ยังไม่กรอก) ค่อยถอยไปใช้จำนวนที่ขอ
 */
export const effQty = (it) => {
  const issued = Number(it?.qty_issued);
  if (Number.isFinite(issued) && issued > 0) return issued;
  const req = Number(it?.qty);
  return Number.isFinite(req) && req > 0 ? req : 0;
};

/** prefix เลขที่เอกสารภายในของเดือนนั้น `MR-YYMM-` · วันที่ผิดรูป = '' */
export const reqNoPrefix = (dateStr) => {
  const [y, m] = String(dateStr || '').split('-');
  if (!y || !m || y.length !== 4 || m.length !== 2) return '';
  return `MR-${y.slice(2)}${m}-`;
};

/**
 * เลขสูงสุดของเดือนนั้นจากรายการ doc_no (เฉพาะรูป `MR-YYMM-nnn` · เลข SAP ที่สโตร์ใส่ทับ = ข้าม)
 * ⚠️ ห้ามใช้ `count()+1` (QC 05/10 — เดิมใช้จำนวนแถวที่โชว์บนจอ = ผูกตัวกรองเดือน/สถานะ ⇒ เลขซ้ำ)
 */
export const maxReqSeq = (docNos = [], dateStr) => {
  const pre = reqNoPrefix(dateStr);
  if (!pre) return 0;
  let max = 0;
  for (const d of docNos) {
    const s = String(d || '').trim();
    if (!s.startsWith(pre)) continue;
    const n = /^(\d+)$/.exec(s.slice(pre.length));
    if (n) max = Math.max(max, Number(n[1]));
  }
  return max;
};

/** เลขที่เอกสารภายใน (running รายเดือน) = "เลขสูงสุดของเดือน + 1" — สโตร์อาจใส่เลข SAP จริงทับทีหลังที่ช่อง doc_no
 *  @param maxInMonth เลขสูงสุดที่ออกไปแล้วในเดือนนั้น (จาก maxReqSeq) — ไม่ใช่จำนวนแถว */
export const nextReqNo = (dateStr, maxInMonth) => {
  const pre = reqNoPrefix(dateStr);
  if (!pre) return '';
  return `${pre}${String((maxInMonth || 0) + 1).padStart(3, '0')}`;
};

/* แถบ "ถึงขั้นไหน" ใบ FM-STO-003 (<StepFlow> · UI §6.30 · 12/11) — ผู้ขอ → ผู้อนุมัติ → สโตร์ */
export const matReqFlow = (r) => linearFlow({
  status: r?.status, row: r,
  steps: [
    { label: 'ร่างใบขอ', who: 'ผู้ขอ (หน่วยงาน)', action: 'กรอกรายการแล้วส่งอนุมัติ' },
    { label: 'รออนุมัติ', who: 'ผู้มีสิทธิ์อนุมัติ', action: 'อนุมัติใบ' },
    { label: 'สโตร์จ่าย / รับคืน', who: 'สโตร์', action: r?.kind === 'return' ? 'รับของคืนเข้าคลัง' : 'จ่ายของตามใบ' },
    { label: 'จ่ายของแล้ว' },
  ],
  at: { draft: 0, submitted: 1, approved: 2, issued: 4 },
  exits: { cancelled: { tone: 'none', label: 'ยกเลิก', at: (row) => (row?.approved_by || row?.approved_at ? 2 : row?.submitted_at || row?.submitted_by ? 1 : 0) } },
});

/* ══ 🌳 แตก BOM ตอนเลือกชิ้นงาน + 📋 template งานประจำ (2026-11-18 · คำสั่ง user) ══════════════════
   "งานเบิกทดสอบ เลือกชิ้นงาน ควรแตก BOM ให้เลย และให้ user เลือกรายการ ใช้/ไม่ใช้ · สร้าง template งานประจำได้"
   ลูกมาจาก `useBomChildren` (ใบเดียว · ยุบ mat ซ้ำแล้ว) — ที่นี่แค่จัดแถวให้คนเลือก **ไม่ตัดสินแทนคน**
   🔴 จำนวนที่เสนอ = จำนวนชุด × qtyPerRoot · แถว `flatDupe` (อัตราเชื่อไม่ได้) = เว้นว่างให้คนกรอก **ห้ามเดา** */
const r3 = (n) => Math.round(n * 1000) / 1000;

/** แถวให้เลือก = **ลูกทุกชั้นเท่านั้น** — เลือกแม่เพื่อตัดลูก ไม่ได้เบิกตัวแม่ (19/11 · user "เราจะไม่ตัดแม่สิ")
 *  จำนวนลูก = จำนวนแม่ × qtyPerRoot · ค่าเริ่ม = ใช้ทุกแถว · ไม่มีลูก = [] (จอเขียนบอก) */
export function bomPickRows(root, kids = [], parentQty = 1) {
  const n = Number(parentQty) > 0 ? Number(parentQty) : 1;
  return (kids || []).map(k => {
    const rate = !k.flatDupe && Number(k.qtyPerRoot) > 0 ? Number(k.qtyPerRoot) : null;
    return {
      key: `${k.level}:${k.mat_no}`, level: k.level || 1, mat_no: k.mat_no, description: k.part_name || '',
      unit: k.uom || '', qty: rate != null ? r3(n * rate) : '', use: true, rate, unsure: rate == null,
    };
  });
}

/** จำนวนลูกตามจำนวนแม่ใหม่ — แถวที่คนแก้เองแล้ว (`edited`) ไม่ทับ */
export const rescalePickRows = (rows = [], parentQty = 1) => {
  const n = Number(parentQty) > 0 ? Number(parentQty) : 1;
  return rows.map(r => (r.edited || r.rate == null ? r : { ...r, qty: r3(n * r.rate) }));
};

/**
 * พาร์ทแม่ให้เลือก — กรองตาม "พื้นที่" (SLoc ของใบ) ผ่านไลน์ผลิตของพาร์ท · มี BOM ขึ้นก่อน
 * @param {Array} products  dr_products (mat_no, name, line_name, id, is_active)
 * @param {{ slocOfLine?: (line:string)=>string|null, sloc?: string, bomIds?: Set|null }} o
 * @returns {{ rows: Array, hiddenOtherArea: number, noArea: number }}
 *   🔴 พาร์ทที่ไลน์ยังไม่ผูกพื้นที่ = ไม่รู้ ⇒ **ไม่ซ่อน** (นับใน `noArea` ให้จอเขียนบอก)
 */
export function parentPickList(products = [], { slocOfLine, sloc, bomIds = null } = {}) {
  const want = String(sloc || '').trim().toUpperCase();
  const seen = new Set(); const out = []; let hiddenOtherArea = 0; let noArea = 0;
  for (const p of products || []) {
    if (!p?.mat_no || p.is_active === false || seen.has(p.mat_no)) continue;
    const area = slocOfLine && p.line_name ? slocOfLine(p.line_name) : null;
    if (want && area && area !== want) { hiddenOtherArea += 1; continue; }
    if (want && !area) noArea += 1;
    seen.add(p.mat_no);
    out.push({ ...p, area, hasBom: bomIds ? bomIds.has(p.id) : null });
  }
  out.sort((a, b) => (Number(b.hasBom === true) - Number(a.hasBom === true))
    || String(a.line_name || '').localeCompare(String(b.line_name || ''), 'th', { numeric: true })
    || String(a.mat_no).localeCompare(String(b.mat_no), 'th', { numeric: true }));
  return { rows: out, hiddenOtherArea, noArea };
}

/** แถวที่ติ๊ก "ใช้" → รายการในใบ (ข้ามแถวไม่มี MAT) */
export const pickedToItems = (rows = []) => rows
  .filter(r => r.use && String(r.mat_no || '').trim())
  .map(r => ({ mat_no: r.mat_no, description: r.description, qty: r.qty === '' ? '' : r.qty, unit: r.unit }));

const TPL_FIELDS = ['kind', 'move_code', 'requester_dept', 'dest_storage_location', 'order_no', 'cost_center',
  'plant_code', 'storage_location', 'detail', 'line_name'];

/** ใบที่กำลังแก้ → แถว template (ไม่เก็บเลขที่/วันที่/ลายเซ็น/สถานะ — ของพวกนั้นเป็นของใบแต่ละใบ) */
export function templateFromEditor(req = {}, items = [], name = '') {
  const t = { name: String(name || '').trim() };
  for (const f of TPL_FIELDS) t[f] = req[f] ?? null;
  t.items = (items || [])
    .filter(it => String(it.mat_no || '').trim() || String(it.description || '').trim())
    .map(it => ({ mat_no: it.mat_no || '', description: it.description || '', qty: it.qty ?? '', unit: it.unit || '' }));
  return t;
}

/** template → ค่าที่เติมลงใบใหม่ (หัวใบ + รายการ) · ช่องที่ template ว่าง = ไม่ทับค่าเริ่มของใบใหม่ */
export function editorFromTemplate(t = {}) {
  const req = {};
  for (const f of TPL_FIELDS) if (t[f] != null && t[f] !== '') req[f] = t[f];
  const items = Array.isArray(t.items) ? t.items.map(it => ({ ...it })) : [];
  return { req, items };
}
