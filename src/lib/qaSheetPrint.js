/**
 * qaSheetPrint — ใบ "Inspection Data" (FM-QA-112) ของใบตรวจ QA 1 รอบ · พิมพ์/บันทึก PDF + ดูบนจอ
 * 2026-11-05 สร้าง · **2026-11-16 เปลี่ยนหน้าตาให้ตรงใบจริงของโรงงาน** (user แนบ 5 พาร์ท: MB3B-8C347 · 26111E50 ·
 * N1WB-17B861 · 16C274/16C275 Laser cut — "ระบบ display result & export pdf ให้ได้แบบนี้")
 *
 * หน้าตาใบจริง: หัวใบ (โลโก้ · Inspection Data · Part Name/No/Customer · Dwg/Rev/Model · Part Classification ·
 *   Concern/Prod date/J-D/Lot · Shift 01/02 · Approved/Checked/Prepared · INSPECTION DATE)
 *   → หน้า Product sketch (รูปแบบ + บอลลูน · กล่องสรุป Hole/Surface/Trim OK/Total/P.I.S.T %)
 *   → ตาราง No./Inspection item/Quality standard/Inspection equipment/Rank M-SC/No.1…/OK/NG (หัวซ้ำทุกหน้า)
 *   → ท้ายทุกหน้า: เลขฟอร์ม+Rev ซ้าย · Effective date ขวา
 * แถว/สเปค/สรุป = `utils/qaDataSheet.js` ที่เดียว (CSV ใช้ตัวเดียวกัน) · เลขฟอร์ม/Rev/ช่องเซ็น/โลโก้ = ทะเบียน
 * doc_key 'qa_inspection_sheet' — **ห้าม hardcode**
 *
 * 🔴 ความซื่อสัตย์ของใบ (ห้ามถอด):
 *   · จุดที่ยังไม่ได้ตรวจ ต้องอยู่บนใบด้วย (แถวว่าง + "ยังไม่ตรวจ") · กล่องสรุปนับ OK เฉพาะที่ OK จริง
 *   · ใบที่ยังไม่ปิด (status ≠ 'done') = แถบเตือน "ใบยังไม่ปิด ผลอาจยังเปลี่ยน"
 *   · ผู้ตรวจ = รหัสที่บันทึกไว้ชนะบัญชีที่ login (`inspectorForExport` · ผู้เรียกเตรียมให้) · หาลายเซ็นไม่ได้ = เว้นช่อง + บอกเหตุผล
 *   · แบบที่เป็น PDF แปะลงใบไม่ได้ = เขียนบอกในกรอบ sketch (ห้ามปล่อยกรอบว่างเฉยๆ)
 */
import { getDocForm, fullCode, sigAt } from '../utils/docForms';
import tsLogoUrl from '../assets/TS logo.png';
import { buildDataSheet, pieceText } from '../utils/qaDataSheet.js';
import { buildQaPrintRows, pieceCell } from '../utils/qaPrintRows.js';
export { buildQaPrintRows, pieceCell };

export const QA_SHEET_DOC_KEY = 'qa_inspection_sheet';
const FALLBACK = { title: 'Inspection Data', sig_blocks: ['Approved', 'Checked', 'Prepared'], orientation: 'landscape' };

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const box = (on) => `<span class="cb">${on ? '✓' : ''}</span>`;

async function urlToDataUrl(url) {
  if (!url) return '';
  if (String(url).startsWith('data:')) return url;
  try {
    const res = await fetch(url);
    if (!res.ok) return '';
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => resolve('');
      fr.readAsDataURL(blob);
    });
  } catch { return ''; }
}

const isPdfUrl = (u) => /\.pdf(\?|$)/i.test(String(u || ''));

/** หัวใบ (ใช้ทุกหน้า) */
function headerHtml({ df, logo, sheet, part, shiftOn, sigs, sigImg, inspector }) {
  const rank = part?.part_rank || '', kind = part?.part_kind || '';
  const sigCell = (s, i) => {
    const prepared = i === sigs.length - 1;
    const img = prepared && sigImg ? `<img src="${sigImg}" alt="">` : '';
    const nm = prepared ? (inspector?.name || sheet?.inspector_name || s.name) : s.name;
    return `<td class="sg">${img}<div class="sgn">${esc(nm || '')}</div></td>`;
  };
  return `<table class="hd"><tbody>
  <tr>
    <td colspan="2" rowspan="1" class="logo">${logo ? `<img src="${logo}" alt="">` : ''}<span class="ttl">${esc(df.title || 'Inspection Data')}</span></td>
    <td colspan="2" class="pc-h">Part Classification (Mark with checks for appropriate part)</td>
    <td class="hk">Concern No.: <b>${esc(part?.concern_no || '')}</b></td>
    <td colspan="${sigs.length}" class="shift">${box(shiftOn === 'day')} Shift 01 &nbsp; ${box(shiftOn === 'night')} Shift 02
      <div class="plant">${esc(sheet?.line_name || '')}</div></td>
  </tr>
  <tr>
    <td class="hk">Part Name:</td><td class="hv">${esc(sheet?.part_name || part?.part_name || '')}
      <span class="sub">Dwg. No: <b>${esc(part?.dwg_no || '-')}</b></span></td>
    <td>${box(rank === 'safety')} Safety part</td><td>${box(kind === 'completed')} Completed part</td>
    <td class="hk">Prod. Date: <b>${esc(sheet?.work_date || '')}</b></td>
    ${sigs.map(s => `<td class="sgh">${esc(s.label)}</td>`).join('')}
  </tr>
  <tr>
    <td class="hk">Part No.:</td><td class="hv">${esc(sheet?.part_no || part?.part_no || '')}
      <span class="sub">Revision: <b>${esc(part?.drawing_rev || '-')}</b></span></td>
    <td>${box(rank === 'important' || rank === 'regulation')} Important / Regulation part</td><td>${box(kind === 'component')} Component, Child</td>
    <td class="hk">Lot / J/D No.: <b>${esc(sheet?.lot_no || '')}</b>${sheet?.machine_no ? ` · M/C <b>${esc(sheet.machine_no)}</b>` : ''}</td>
    ${sigs.map(sigCell).join('')}
  </tr>
  <tr>
    <td class="hk">Customer:</td><td class="hv">${esc(part?.customer || '')}<span class="sub">Model: <b>${esc(part?.model || '-')}</b></span></td>
    <td>${box(rank === 'general')} General part</td><td>${box(kind === 'raw')} Raw material</td>
    <td class="hk">Round: <b>${esc(sheet?.rounds_label ?? sheet?.round_no ?? '')}</b>${sheet?.stage ? ` · ${esc(sheet.stage)}` : ''}</td>
    <td colspan="${sigs.length}" class="hk">INSPECTION DATE: <b>${esc(sheet?.work_date || '')}</b></td>
  </tr></tbody></table>`;
}

/** หน้า sketch — รูปแบบ 1 แผ่น + บอลลูน (วง = รู · สี่เหลี่ยม = ผิว/ขอบตัด · สีตามผล) */
function sketchHtml({ dwg, img, items, resById }) {
  if (!img) {
    return `<div class="nosk">แบบ "${esc(dwg?.title || '')}" ${isPdfUrl(dwg?.drawing_url) ? 'เป็นไฟล์ PDF — แปะลงใบพิมพ์ไม่ได้ ดูแบบในระบบ' : 'โหลดรูปไม่สำเร็จ'}</div>`;
  }
  const pins = items.filter(i => i.pos_x != null && i.pos_y != null && (i.drawing_id === dwg.id || (!i.drawing_id && dwg._first)));
  const seen = new Set();
  const marks = pins.filter(i => { const k = `${i.balloon_no}|${i.pos_x}|${i.pos_y}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .map(i => {
      const j = resById.get(i.id)?.judgement;
      const sq = /surface|trim/i.test(i.characteristic || '') || /^[ST]\d/i.test(i.balloon_no || '');
      return `<span class="mk ${sq ? 'sq' : ''} ${j === 'ng' ? 'ng' : j === 'ok' ? 'ok' : ''}" style="left:${Number(i.pos_x)}%;top:${Number(i.pos_y)}%">${esc(i.balloon_no || '')}</span>`;
    }).join('');
  return `<div class="skw"><img src="${img}" alt="">${marks}</div>`;
}

const footHtml = (code, eff) => `<div class="foot"><span>${esc(code)}</span><span>${eff ? `Effective date : ${esc(eff)}` : ''}</span></div>`;

/**
 * HTML ใบเต็ม (sync · pure — ผู้เรียกเตรียมรูปเป็น data URL มาแล้ว) — ใช้ทั้งหน้าต่างพิมพ์และ iframe บนจอ
 */
export function buildQaSheetHtml({ df = FALLBACK, logo = '', sheet = {}, part = {}, items = [], results = [], pieces = [], actions = [],
  drawings = [], dwgImgs = {}, inspector = {}, sigImg = '', stageLabel = '', colLabels = null }) {
  // colLabels = ใบรวมทั้งกะ (mergeShiftResults) — คอลัมน์ No.k = ชิ้นที่ k ของกะ พร้อมป้ายรอบ
  const data = buildDataSheet({ items, results, colLabels });
  const resById = new Map(results.map(r => [r.item_id, r]));
  const sigs = (df.sig_blocks?.length ? df.sig_blocks : FALLBACK.sig_blocks).map((_, i) => sigAt(df, i));
  const hd = headerHtml({ df, logo, sheet, part, shiftOn: sheet?.shift, sigs, sigImg, inspector });
  const n = data.pieceCols;
  const closed = sheet?.status === 'done';   // ใบรวมทั้งกะ: ผู้เรียกตั้ง done เมื่อทุกรอบปิดแล้วเท่านั้น
  const code = fullCode(df);

  const sumRows = data.summary.map(t => `<tr><td rowspan="2">${esc(t.type)}</td><td>OK</td><td>${t.ok}</td><td rowspan="2">${t.pist ?? '-'}${t.pist != null ? '%' : ''}</td></tr>
    <tr><td>Total</td><td>${t.total}</td></tr>`).join('');
  const sumBox = `<table class="sum"><thead><tr><th colspan="2">Type</th><th>Q'ty point</th><th>P.I.S.T %</th></tr></thead><tbody>${sumRows}
    <tr class="tot"><td rowspan="2">Total</td><td>OK</td><td>${data.totals.ok}</td><td rowspan="2">${data.totals.pist ?? '-'}${data.totals.pist != null ? '%' : ''}</td></tr>
    <tr class="tot"><td>Total</td><td>${data.totals.total}</td></tr></tbody></table>
    <div class="sumn">NG ${data.totals.ng} จุด${data.totals.unchecked ? ` · <b class="pend">ยังไม่ตรวจ ${data.totals.unchecked} จุด</b>` : ''}</div>`;

  const dwgs = drawings.map((d, i) => ({ ...d, _first: i === 0 }));
  const sketchPages = (dwgs.length ? dwgs : [null]).map((d, i) => `<section class="page">${hd}
    <div class="skp"><div class="skl">Product sketch :${d?.title ? ` <span class="muted">${esc(d.title)}${d.drawing_rev ? ` · Rev ${esc(d.drawing_rev)}` : ''}</span>` : ''}</div>
      <div class="skb">${d ? sketchHtml({ dwg: d, img: dwgImgs[d.id], items, resById }) : '<div class="nosk">พาร์ทนี้ยังไม่มีแบบ (ตั้งที่ /qa-setup)</div>'}</div>
      ${i === 0 ? `<div class="skr">${sumBox}<div class="lg"><span class="mk lgc"></span> Hole &nbsp; <span class="mk sq lgc"></span> Surface / Trim line</div></div>` : ''}
    </div>
    <div class="dist"><b>Distribution flow:</b> Customer =&gt; ${esc(part?.customer || '-')}</div>
    ${footHtml(code, df.effective_date)}
  </section>`).join('');

  const pc = Array.from({ length: n }, (_, i) => i + 1);
  const body = data.groups.map(g => g.rows.map((r, k) => {
    const noCell = k === 0 ? `<td class="no" rowspan="${g.rows.length}">${esc(g.no)}</td>` : '';
    const vals = pc.map(c => {
      const v = r.values[c - 1];
      const bad = r.itemType === 'variable' && v !== '' && v != null && Number.isFinite(Number(v))
        && ((r.lsl != null && Number(v) < r.lsl) || (r.usl != null && Number(v) > r.usl));
      return `<td class="v ${v === 'ng' || bad ? 'ng' : ''}">${esc(pieceText(r.itemType, v))}</td>`;
    }).join('');
    const ok = r.judgement === 'ok' ? '✓' : '';
    const ng = r.judgement === 'ng' ? '✓' : '';
    const pend = !r.checked ? '<span class="pend">ยังไม่ตรวจ</span>' : r.judgement === 'na' ? '<span class="muted">ข้าม</span>' : '';
    return `<tr class="${r.checked ? '' : 'nc'}">${noCell}<td class="it">${esc(r.item)}${r.retired ? ' <i class="muted">(ปิดใช้แล้ว)</i>' : ''}</td>
      <td class="st">${esc(r.standard)}</td><td class="eq">${esc(r.equipment)}</td>
      <td class="rk">${r.rank === 'M' ? 'M' : ''}</td><td class="rk">${r.rank === 'SC' ? 'SC' : ''}</td>${vals}
      <td class="j">${ok}${pend}</td><td class="j ng">${ng}</td></tr>`;
  }).join('')).join('')
    || `<tr><td colspan="${8 + n}" style="padding:8px">— พาร์ทนี้ยังไม่มีมาตรฐานจุดตรวจ —</td></tr>`;

  const warn = [
    closed ? '' : 'ใบนี้ยังไม่ปิด — ผลตรวจอาจยังเปลี่ยนได้ ใบนี้เป็นภาพ ณ เวลาที่พิมพ์',
    data.totals.unchecked ? `มีจุดที่ยังไม่ได้ตรวจ ${data.totals.unchecked} จุด (แถวสีเทา "ยังไม่ตรวจ")` : '',
    data.hiddenCols ? `กะนี้ตรวจ ${data.pieceCols + data.hiddenCols} ชิ้น — ใบแสดง ${data.pieceCols} ชิ้นแรก · ค่าครบทุกชิ้นอยู่ใน CSV` : '',
    inspector?.note && !sigImg ? `ลายเซ็นผู้ตรวจ: ${inspector.note}` : '',
  ].filter(Boolean).map(t => `<div class="warn">⚠ ${esc(t)}</div>`).join('');

  const pieceSummary = pieces.length
    ? pieces.map(p => `<span class="pcs ${p.result === 'fail' ? 'ng' : ''}">รอบ ${esc(p.round_no ?? '-')} ชิ้นที่ ${esc(p.piece_no)}: ${p.result === 'fail' ? 'NG' : p.result === 'pass' ? 'OK' : esc(p.result || '-')}`
        + `${p.disposition ? ` · ${esc(p.disposition)}` : ''}${p.remark ? ` · ${esc(p.remark)}` : ''}</span>`).join('')
    : '<span class="muted">— ไม่ได้บันทึกแบบทีละชิ้น —</span>';
  const actHtml = actions.length
    ? actions.map(a => `<div>รอบ ${esc(a.round_no)}: ${esc(a.action_text)} <span class="muted">(${esc(a.action_by || a.recorded_by || '')})</span></div>`).join('')
    : '<span class="muted">— ไม่มี —</span>';
  const resultLabel = sheet?.result === 'pass' ? 'ผ่าน (OK)' : sheet?.result === 'fail' ? 'ไม่ผ่าน (NG)' : 'ยังไม่สรุป';

  const tablePage = `<section class="page"><table class="g">
    <thead>
      <tr><td colspan="${8 + n}" class="hdc">${hd}</td></tr>
      <tr><th rowspan="2" class="no">No.</th><th rowspan="2">Inspection item</th><th rowspan="2">Quality standard</th>
        <th rowspan="2">Inspection equipment</th><th colspan="2">Rank</th><th colspan="${n}">MEASUREMENT RESULTS</th><th rowspan="2">OK</th><th rowspan="2">NG</th></tr>
      <tr><th class="rk">M</th><th class="rk">SC</th>${pc.map(c => `<th class="hv">No.${c}</th>`).join('')}</tr>
    </thead>
    <tbody>${body}</tbody>
    <tfoot><tr><td colspan="${8 + n}" class="tf">${footHtml(code, df.effective_date)}</td></tr></tfoot>
  </table>
  <div class="row">
    <div class="bx"><h4>ผลสรุปใบ: <span class="${sheet?.result === 'fail' ? 'ng' : ''}">${esc(resultLabel)}</span>${stageLabel ? ` · ${esc(stageLabel)}` : ''}</h4>${pieceSummary}</div>
    <div class="bx"><h4>การแก้ไขหลังพบผิดปกติ</h4>${actHtml}</div>
  </div></section>`;

  return `<!doctype html><html><head><meta charset="utf-8">
<title>Inspection Data ${esc(sheet?.part_no || '')} ${esc(sheet?.work_date || '')} R${esc(sheet?.round_no || '')}</title>
<style>
  @page { size: ${df.paper_size || 'A4'} landscape; margin: 7mm 7mm 11mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, 'Sarabun', Tahoma, sans-serif; font-size: 9px; color: #111; margin: 0; background: #fff; }
  .page { break-after: page; }
  .page:last-of-type { break-after: auto; }
  table.hd { width: 100%; border-collapse: collapse; }
  table.hd td { border: 1px solid #000; padding: 2px 4px; height: 19px; vertical-align: middle; font-size: 8.6px; }
  table.hd .logo { white-space: nowrap; } table.hd .logo img { height: 24px; vertical-align: middle; }
  table.hd .ttl { font-size: 15px; font-weight: 700; margin-left: 40px; vertical-align: middle; }
  table.hd .pc-h { font-weight: 700; } table.hd .hk { font-weight: 700; } table.hd .hv { font-weight: 700; }
  table.hd .sub { float: right; font-weight: 400; } table.hd .shift { text-align: center; font-weight: 700; }
  table.hd .plant { font-size: 9px; margin-top: 1px; } table.hd .sgh { text-align: center; font-weight: 700; width: 64px; }
  table.hd .sg { text-align: center; height: 30px; width: 64px; } table.hd .sg img { max-height: 20px; max-width: 60px; display: block; margin: 0 auto; }
  table.hd .sgn { font-size: 7.5px; }
  .cb { display: inline-block; width: 9px; height: 9px; border: 1px solid #000; font-size: 8px; line-height: 8px; text-align: center; vertical-align: -1px; margin-right: 2px; }
  .skp { position: relative; display: flex; gap: 8px; border: 1px solid #000; border-top: 0; padding: 4px; height: 148mm; }
  .skl { position: absolute; font-weight: 700; }
  .skb { flex: 1; display: flex; align-items: center; justify-content: center; padding-top: 14px; min-width: 0; }
  .skw { position: relative; display: inline-block; max-width: 100%; }
  .skw img { display: block; max-width: 100%; max-height: 140mm; }
  .mk { position: absolute; transform: translate(-50%, -50%); min-width: 17px; height: 17px; padding: 0 2px; border: 1.2px solid #000;
        border-radius: 50%; background: #fff; font-size: 7.5px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; white-space: nowrap; }
  .mk.sq { border-radius: 2px; } .mk.ok { border-color: #15803d; color: #15803d; } .mk.ng { border-color: #b91c1c; color: #fff; background: #b91c1c; }
  .mk.lgc { position: static; transform: none; width: 12px; min-width: 12px; height: 12px; vertical-align: middle; }
  .skr { width: 210px; display: flex; flex-direction: column; justify-content: flex-end; gap: 6px; }
  table.sum { border-collapse: collapse; width: 100%; } table.sum th, table.sum td { border: 1px solid #000; padding: 2px 4px; text-align: center; }
  table.sum th { background: #f6cfae; } table.sum tr.tot td { font-weight: 700; } .sumn { font-size: 8.5px; } .lg { font-size: 8.5px; }
  .nosk { color: #b45309; font-weight: 700; border: 1px dashed #b45309; padding: 14px; }
  .dist { margin-top: 3px; font-size: 9px; }
  table.g { width: 100%; border-collapse: collapse; }
  table.g thead { display: table-header-group; } table.g tr { break-inside: avoid; }
  table.g td.hdc { padding: 0 0 2px; border: 0; }
  table.g > thead > tr > th, table.g > tbody > tr > td { border: 1px solid #000; padding: 2px 3px; text-align: center; vertical-align: middle; height: 17px; }
  table.g > thead > tr > th { font-size: 8.5px; font-weight: 700; } table.g > * > tr > .no { width: 42px; font-weight: 700; }
  table.g > tbody > tr > td.it { width: 150px; } table.g > tbody > tr > td.st { width: 92px; white-space: nowrap; } table.g > tbody > tr > td.eq { width: 120px; }
  table.g .cl { font-size: 7px; font-weight: 400; color: #555; }
  table.g > * > tr > .rk { width: 16px; font-weight: 700; } table.g > * > tr > .v { width: 48px; } table.g > tbody > tr > td.j { width: 34px; font-weight: 700; }
  .ng { color: #b91c1c; font-weight: 700; } tr.nc td { color: #777; } .pend { color: #b45309; font-weight: 700; font-size: 7.5px; }
  .muted { color: #777; }
  .warn { border: 1px solid #b45309; background: #fffbeb; color: #7c2d12; font-size: 8.5px; padding: 3px 6px; margin: 0 0 3px; }
  .row { display: flex; gap: 8px; margin-top: 5px; } .bx { border: 1px solid #000; padding: 4px 6px; flex: 1; line-height: 1.5; }
  .bx h4 { margin: 0 0 2px; font-size: 9px; } .pcs { display: inline-block; margin-right: 10px; }
  .foot { display: flex; justify-content: space-between; font-family: 'Times New Roman', serif; font-size: 9px; padding: 3px 50px 0; }
  table.g tfoot { display: table-footer-group; } table.g td.tf { border: 0; padding: 0; }
  @media screen { body { padding: 10px; background: #e5e7eb; } .page { background: #fff; padding: 8px; margin: 0 auto 12px; max-width: 1180px; box-shadow: 0 1px 4px rgba(0,0,0,.2); } }
</style></head><body>
${warn}
${sketchPages}
${tablePage}
</body></html>`;
}

/** เตรียมทุกอย่าง (ทะเบียน · โลโก้ · ลายเซ็น · รูปแบบ) แล้วคืน HTML — ใช้ทั้งปุ่มพิมพ์และหน้าดูผลบนจอ */
export async function prepareQaSheetHtml({ sheet, part = {}, items = [], results = [], pieces = [], actions = [], drawings = [], inspector = {}, stageLabel = '', colLabels = null }) {
  const df = await getDocForm(QA_SHEET_DOC_KEY, FALLBACK);
  const [logo, sigImg, ...imgs] = await Promise.all([
    urlToDataUrl(df.logo_url || tsLogoUrl),
    urlToDataUrl(inspector?.signatureUrl),
    ...drawings.map(d => (isPdfUrl(d.drawing_url) ? Promise.resolve('') : urlToDataUrl(d.drawing_url))),
  ]);
  const dwgImgs = Object.fromEntries(drawings.map((d, i) => [d.id, imgs[i]]));
  return buildQaSheetHtml({ df, logo, sheet, part, items, results, pieces, actions, drawings, dwgImgs, inspector, sigImg, stageLabel, colLabels });
}

/**
 * @returns {Promise<boolean>} false = เปิดหน้าต่างพิมพ์ไม่ได้ (popup ถูกบล็อก)
 */
export async function printQaSheet(params) {
  // เปิดหน้าต่างก่อน await — กันเบราว์เซอร์บล็อก pop-up เพราะหลุดจากจังหวะคลิก
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write('<p style="font-family:sans-serif">กำลังเตรียมใบ Inspection Data…</p>');
  const html = await prepareQaSheetHtml(params);
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 500);
  return true;
}
