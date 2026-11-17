/* 📄 ใบ "Inspection Data" (FM-QA-112) — โครงแถว/สเปค/สรุปจุด จากมาตรฐานจุดตรวจ + ผลของ 1 ใบ (pure · มีเทส)
   (2026-11-16 · user แนบใบจริง 5 พาร์ท "ระบบ display result & export pdf ให้ได้แบบนี้ + export .csv รูปแบบเดียวกัน")
   ใช้ร่วม 3 ทาง: ใบพิมพ์/PDF (`lib/qaSheetPrint.js`) · ดูผลบนจอ (iframe ใบเดียวกัน) · CSV (`dataSheetCsvRows`)
   ⇒ **ห้ามจัดแถว/จัดรูปสเปคเองที่ปลายทาง** — 3 ทางต้องออกมาตรงกันทุกตัวอักษร

   รูปใบจริง: No. (บอลลูนฐาน · แถวที่บอลลูนเดียวกันรวมช่อง) · Inspection item · Quality standard ·
   Inspection equipment · Rank M/SC · No.1…No.N · OK · NG — กลุ่มตรวจสภาพ (A*) ขึ้นก่อน ป้าย "Appearance"
   🔴 จุดที่ยังไม่ตรวจ = แถวว่างพร้อมป้าย (ไม่ใช่ OK) · ค่าว่าง ≠ 0 · % P.I.S.T นับเฉพาะจุดที่ OK จริง */

const MAX_PIECES = 10;   // คอลัมน์ No.k บนใบพิมพ์ (A4 แนวนอนพอ 10 · เกินนี้บอกบนใบ + CSV มีครบ)

/** "H14 (T)" / "H14(W)" / "Datum B (T)" → "H14" / "Datum B" — แถวลูก TL/WL รวมใต้บอลลูนเดียวกัน */
export function baseBalloon(b) {
  return String(b ?? '').replace(/\s*\((?:T|W|TL|WL)\)\s*$/i, '').trim();
}

/* ลำดับกลุ่มบนใบ: Appearance (A*) → อื่นๆ ไม่มีเลข → Datum → H → S → T → ที่เหลือ · ในกลุ่มเรียงเลขธรรมชาติ */
const GROUP_ORDER = [/^A\d/i, /^-?$/, /^Datum/i, /^H\d/i, /^\d/, /^S\d/i, /^T\d/i, /^L\d/i];
const groupRank = (b) => { const i = GROUP_ORDER.findIndex(re => re.test(b)); return i < 0 ? GROUP_ORDER.length : i; };
const natCmp = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
export function balloonCompare(a, b) {
  return groupRank(a) - groupRank(b) || natCmp(a, b);
}

const num = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
const dp = (...xs) => Math.max(1, ...xs.filter(x => x != null).map(x => (String(x).split('.')[1] || '').length));
const fx = (v, d) => Number(v).toFixed(d);

/** สเปคแบบใบจริง — "12.0 ± 0.10" · "8.5 (+0.10/-0.20)" · "≥ 1.04" · "≤ 0.40" · แบบนับ/ตาดู = spec_text */
export function fmtStandard(it) {
  const n = num(it?.nominal), lo = num(it?.lsl), hi = num(it?.usl);
  if ((it?.item_type || 'variable') !== 'variable' || (lo == null && hi == null)) {
    return String(it?.spec_text || '').trim() || (n != null ? String(n) : '');
  }
  if (n != null && lo != null && hi != null) {
    const up = hi - n, dn = n - lo, d = dp(it.nominal, it.lsl, it.usl);
    if (Math.abs(up - dn) < 1e-9) return `${fx(n, 1)} ± ${fx(up, Math.max(2, d))}`;
    return `${fx(n, 1)} (+${fx(up, Math.max(2, d))}/-${fx(dn, Math.max(2, d))})`;
  }
  if (lo != null && hi == null) return `≥ ${lo}`;
  if (hi != null && lo == null) return `≤ ${hi}`;
  return `${lo} – ${hi}`;
}

/** ประเภทจุดของกล่องสรุป (Hole / Surface / Trim line / Thickness / Appearance / Other) — ดูจากชื่อจุดก่อน แล้วค่อยบอลลูน */
export function pointType(it) {
  const c = String(it?.characteristic || '').toLowerCase();
  const b = String(it?.balloon_no || '').toUpperCase();
  if (/hole|datum|รู/.test(c) || /^(H\d|DATUM)/.test(b)) return 'Hole';
  if (/trim/.test(c)) return 'Trim line';
  if (/thick|หนา/.test(c)) return 'Thickness';
  if (/surface|ผิว/.test(c) || /^S\d/.test(b)) return 'Surface';
  if (/^A\d/.test(b)) return 'Appearance';
  return 'Other';
}
export const TYPE_ORDER = ['Hole', 'Surface', 'Trim line', 'Thickness', 'Appearance', 'Other'];

/** ค่าของชิ้นในช่อง No.k — แบบวัด = ตัวเลขตามที่กรอก · แบบนับ = OK/NG · ว่าง = '' (ห้าม 0) */
export function pieceText(itemType, v) {
  if (v == null || v === '') return '';
  if (itemType === 'variable') return String(v);
  if (v === 'ok') return 'OK';
  if (v === 'ng') return 'NG';
  if (v === 'na') return '–';
  return String(v);
}

/**
 * @param {{ items: object[], results: object[] }} p  items = มาตรฐานจุดตรวจ (active) · results = ผลของใบนี้
 * @returns {{ groups, pieceCols, summary, totals }}
 *   groups = [{ no, appearance, rows: [{ id, balloon, item, standard, equipment, rank, itemType, values, judgement, checked, retired, note }] }]
 */
export function buildDataSheet({ items = [], results = [], colLabels = null, maxCols = MAX_PIECES } = {}) {
  const resById = new Map((results || []).map(r => [r.item_id, r]));
  const rows = [];
  const seen = new Set();
  for (const it of items || []) {
    seen.add(it.id);
    rows.push(toRow(it, resById.get(it.id) || null, false));
  }
  // ผลของจุดที่ถูกปิดใช้ทีหลัง — ยังต้องอยู่บนใบ (ประวัติจริงของรอบนั้น)
  for (const r of results || []) {
    if (seen.has(r.item_id)) continue;
    rows.push(toRow({ id: r.item_id, balloon_no: r.balloon_no, characteristic: r.characteristic,
      item_type: r.item_type, spec_text: r.spec_text }, r, true));
  }
  // บอลลูนเดียวกัน: ค่าวัด (Datum/Diameter TL→WL) ก่อน แล้วค่อยแบบนับ (Hole Position) — ตามใบจริง
  rows.sort((a, b) => balloonCompare(a.no, b.no)
    || (a.itemType === b.itemType ? 0 : a.itemType === 'attribute' ? 1 : -1)
    || natCmp(a.balloon, b.balloon));

  const groups = [];
  for (const r of rows) {
    const last = groups[groups.length - 1];
    if (last && last.no === r.no) last.rows.push(r);
    else groups.push({ no: r.no, appearance: /^A\d/i.test(r.no), rows: [r] });
  }
  const allCols = colLabels ? colLabels.length : Math.max(0, ...rows.map(r => r.values.length));
  const pieceCols = colLabels
    ? Math.min(maxCols, Math.max(5, colLabels.length))
    : Math.min(maxCols, Math.max(5, ...rows.map(r => Math.max(r.values.length, r.sample || 0))));
  const hiddenCols = Math.max(0, allCols - pieceCols);

  const byType = new Map();
  for (const r of rows) {
    const t = byType.get(r.type) || { type: r.type, ok: 0, ng: 0, total: 0 };
    t.total += 1;
    if (r.judgement === 'ok') t.ok += 1;
    if (r.judgement === 'ng') t.ng += 1;
    byType.set(r.type, t);
  }
  const pist = (t) => (t.total ? Math.round((t.ok / t.total) * 1000) / 10 : null);
  const summary = TYPE_ORDER.filter(k => byType.has(k)).map(k => ({ ...byType.get(k), pist: pist(byType.get(k)) }));
  const tot = summary.reduce((a, t) => ({ ok: a.ok + t.ok, ng: a.ng + t.ng, total: a.total + t.total }), { ok: 0, ng: 0, total: 0 });
  const checked = rows.filter(r => r.checked).length;
  return { groups, rows, pieceCols, hiddenCols, colLabels: colLabels || null, summary, totals: { ...tot, pist: pist(tot), checked, unchecked: tot.total - checked } };
}

function toRow(it, r, retired) {
  const values = Array.isArray(r?.values_json) ? r.values_json : [];
  const judgement = r?.judgement || null;
  return {
    id: it.id, no: baseBalloon(it.balloon_no) || '-', balloon: it.balloon_no || '',
    item: r?.characteristic || it.characteristic || '',
    standard: fmtStandard(r ? { ...it, spec_text: r.spec_text ?? it.spec_text } : it),
    equipment: it.method || '', rank: it.rank || '', itemType: r?.item_type || it.item_type || 'variable',
    sample: Number(it.sample_size) || 0, values, judgement, checked: judgement != null,
    type: pointType(it), unit: it.unit || '', nominal: num(it.nominal), lsl: num(it.lsl), usl: num(it.usl),
    note: r?.note || '', retired,
  };
}

/** แถว CSV — หัวตาราง = แถวแรกเสมอ (เลขฟอร์มไปอยู่ชื่อไฟล์ · csvDoc) · 1 แถว = 1 จุดตรวจ ค่ารายชิ้นแยกคอลัมน์
 *  เพื่อเอาไปคำนวณต่อได้: Nominal/LSL/USL เป็นตัวเลขแยกช่อง นอกจากสเปคที่จัดรูปแล้ว */
export function dataSheetCsvRows({ sheet = {}, part = {}, data }) {
  const n = data.pieceCols;
  const head = ['Part No.', 'Part Name', 'Customer', 'Model', 'Line', 'Inspection Date', 'Shift', 'Round', 'Stage', 'Lot',
    'No.', 'Balloon', 'Inspection item', 'Quality standard', 'Nominal', 'LSL', 'USL', 'Unit', 'Inspection equipment', 'Rank',
    ...Array.from({ length: n }, (_, i) => `No.${i + 1}${data.colLabels?.[i] ? ` (${data.colLabels[i]})` : ''}`), 'Judgement', 'Type', 'Note'];
  const shift = sheet.shift === 'day' ? 'Shift 01' : sheet.shift === 'night' ? 'Shift 02' : (sheet.shift || '');
  const out = [head];
  for (const r of data.rows) {
    out.push([
      sheet.part_no || part.part_no || '', sheet.part_name || part.part_name || '', part.customer || '', part.model || '',
      sheet.line_name || '', sheet.work_date || '', shift, sheet.rounds_label ?? sheet.round_no ?? '', sheet.stage || '', sheet.lot_no || '',
      r.no, r.balloon, r.item, r.standard, r.nominal ?? '', r.lsl ?? '', r.usl ?? '', r.unit, r.equipment, r.rank,
      ...Array.from({ length: n }, (_, i) => pieceText(r.itemType, r.values[i])),
      r.judgement === 'ok' ? 'OK' : r.judgement === 'ng' ? 'NG' : r.judgement === 'na' ? 'N/A' : 'ยังไม่ตรวจ',
      r.type, r.note,
    ]);
  }
  return out;
}

/**
 * 📑 รวมผลทั้งกะเป็นใบเดียว (16/11 · user "รีพอร์ตใบนึงต้องโชว์ของกะนั้น 3 ตัว 5 ตัว แล้วแต่ตรวจกี่ตัว ไม่ใช่ตัวละใบ")
 * ใบตรวจในระบบ = 1 รอบ (มักรอบละ 1 ชิ้น) ⇒ รวมทุกใบของ พาร์ท+วัน+กะ เรียงตามรอบ → คอลัมน์ No.1…No.N = ชิ้นที่ตรวจทั้งกะ
 * @param {object[]} sheets   ใบของกะนั้น (qa_inspection_sheets)
 * @param {object[]} results  ผลของทุกใบ (มี sheet_id)
 * @returns {{ results: object[], colLabels: string[], rounds: number[] }} results = 1 แถวต่อจุด (values ต่อกันตามคอลัมน์)
 *   ตัดสินต่อจุด: มี NG สักชิ้น = ng · มีผลและไม่มี NG = ok · ข้ามทุกชิ้น = na · ไม่มีผลเลย = ยังไม่ตรวจ
 */
export function mergeShiftResults(sheets = [], results = []) {
  const ordered = [...sheets].sort((a, b) => (a.round_no ?? 0) - (b.round_no ?? 0)
    || String(a.created_at || '').localeCompare(String(b.created_at || '')));
  const bySheet = new Map();
  for (const r of results) {
    if (!bySheet.has(r.sheet_id)) bySheet.set(r.sheet_id, []);
    bySheet.get(r.sheet_id).push(r);
  }
  const cols = [];   // [{ sheetId, k, label }]
  for (const sh of ordered) {
    const rs = bySheet.get(sh.id) || [];
    const n = Math.max(0, ...rs.map(r => (Array.isArray(r.values_json) ? r.values_json.length : 0)));
    for (let k = 0; k < n; k++) cols.push({ sheetId: sh.id, k, label: `R${sh.round_no ?? '?'}${n > 1 ? `-${k + 1}` : ''}` });
  }
  const colIdx = new Map(cols.map((c, i) => [`${c.sheetId}|${c.k}`, i]));
  const byItem = new Map();
  for (const sh of ordered) {
    for (const r of bySheet.get(sh.id) || []) {
      const cur = byItem.get(r.item_id) || { ...r, values_json: Array(cols.length).fill(''), _j: [], note: '' };
      (Array.isArray(r.values_json) ? r.values_json : []).forEach((v, k) => {
        const i = colIdx.get(`${sh.id}|${k}`);
        if (i != null) cur.values_json[i] = v;
      });
      if (r.judgement) cur._j.push(r.judgement);
      if (r.note) cur.note = cur.note ? `${cur.note} · R${sh.round_no}: ${r.note}` : `R${sh.round_no}: ${r.note}`;
      byItem.set(r.item_id, cur);
    }
  }
  const merged = [...byItem.values()].map(({ _j, ...r }) => ({
    ...r,
    judgement: _j.includes('ng') ? 'ng' : _j.includes('ok') ? 'ok' : _j.length ? 'na' : null,
  }));
  return { results: merged, colLabels: cols.map(c => c.label), rounds: ordered.map(s => s.round_no) };
}
