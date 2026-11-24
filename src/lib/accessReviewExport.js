/* ══ 📋 accessReviewExport — Excel "ใบทบทวนสิทธิ์ผู้ใช้ ESM" (ISO 27001 A.5.18 · 2026-11-24) ══════════════
   ปุ่ม "📋 ใบทบทวนสิทธิ์" ในหน้า /add-user · 1 แถวต่อบัญชี + ธงความเสี่ยง + ช่องให้ผู้ทบทวนกรอก
   (ผล · เหตุผล · ผู้ทบทวน · วันที่) → เซ็นแล้วเก็บไฟล์เป็นหลักฐานรอบทบทวน
   · ธง/ลำดับ/ตัวเลือกผล มาจาก `src/utils/accessReview.js` ที่เดียว — ไฟล์นี้วาดอย่างเดียว ห้ามตัดสินเพิ่ม
   · เลขฟอร์ม/Rev/ช่องลายเซ็น อ่านจากทะเบียน /doc-forms (doc_key `xlsx_access_review`) · fallback ค่าในโค้ด
   · 🔴 ไฟล์นี้มีอีเมล/ชื่อพนักงาน + จุดอ่อนด้านสิทธิ์ — เป็นเอกสารภายใน ส่งเฉพาะผู้ทบทวน
   · ช่องคำนวณ (สถานะ) ล็อกไว้ ปลดได้ที่ Review › Unprotect Sheet (ไม่มีรหัสผ่าน — กันพลาด ไม่ใช่กันคนตั้งใจ)
   ════════════════════════════════════════════════════════════════════════════════════════════════ */
import { getDocForm, fullCode } from '../utils/docForms';
import { xlsxDocName } from '../utils/csvDoc';
import { dateLocale } from '../utils/i18n';   // ไทย = พ.ศ. · EN = ค.ศ. (ห้าม hardcode 'th-TH' · ด่าน date-locale-no-th-TH)
import { ACCESS_REVIEW_FLAGS, REVIEW_DECISIONS, EMP_STATE_TEXT, LV_HIGH, LV_INFO, accessReviewSummary } from '../utils/accessReview';

export const ACCESS_REVIEW_DOC_KEY = 'xlsx_access_review';
const KEEP = REVIEW_DECISIONS[0];

const thin = { style: 'thin', color: { argb: 'FFC9D3DD' } };
const BOX = { top: thin, bottom: thin, left: thin, right: thin };
const FILL = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const HDR = FILL('FF1D4E89'), INP = FILL('FFDCEBFA'), HI = FILL('FFFDE2E0'), MID = FILL('FFFFF4D6');

const bkkDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(d);   // YYYY-MM-DD
const bkkText = (v) => {
  if (v === undefined) return 'อ่านไม่ได้';
  if (v === null) return 'ไม่เคยเข้าใช้';
  const t = new Date(v);
  return Number.isFinite(t.getTime()) ? t.toLocaleString(dateLocale(), { timeZone: 'Asia/Bangkok', dateStyle: 'short', timeStyle: 'short' }) : 'อ่านไม่ได้';
};

/**
 * @param rows        ผลจาก `buildAccessReview()`
 * @param opts.now    Date ที่ export (บังคับ — ห้ามอ่านนาฬิกาในไฟล์นี้)
 * @param opts.exportedBy  ชื่อผู้กดส่งออก
 * @param opts.notes  ข้อความเตือนที่ต้องขึ้นหัวใบ (เช่น อ่านเวลาเข้าใช้/ฐานพนักงานไม่ได้)
 */
export async function buildAccessReviewWorkbook(rows, { now, exportedBy = '', notes = [], ExcelJS: injected } = {}) {
  const df = await getDocForm(ACCESS_REVIEW_DOC_KEY, {
    title: 'ใบทบทวนสิทธิ์ผู้ใช้ ESM (Access Review)',
    sig_blocks: ['ผู้จัดทำ', 'ผู้ทบทวน', 'ผู้อนุมัติ'],
  });
  const sigs = Array.isArray(df.sig_blocks) && df.sig_blocks.length ? df.sig_blocks : ['ผู้จัดทำ', 'ผู้ทบทวน', 'ผู้อนุมัติ'];
  /* exceljs โหลดตอนกด export เท่านั้น (lazy chunk ใช้ร่วมกับตัว export อื่น) — ห้าม import แบบ static */
  const ExcelJS = injected || (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ESM Access Review';
  const sum = accessReviewSummary(rows);

  // ───────────── ชีต 1: ใบทบทวน ─────────────
  const ws = wb.addWorksheet('ใบทบทวนสิทธิ์', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: 'frozen', xSplit: 2, ySplit: 6 }],
  });
  const COLS = [
    ['ลำดับ', 6], ['ชื่อบัญชี', 22], ['อีเมล login', 26], ['ประเภทบัญชี', 12], ['ชุดสิทธิ์ (role)', 16],
    ['ตำแหน่ง', 16], ['Section', 14], ['ไลน์ / Group', 16], ['เห็นข้อมูลกว้างแค่ไหน', 16], ['CC ที่ดูแล', 16],
    ['สถานะพนักงาน', 14], ['เข้าใช้ล่าสุด', 16], ['ธงที่ระบบพบ', 44], ['ต้องตรวจ?', 9], ['ต้องมีเหตุผล?', 10],
    ['ผลการทบทวน ▾', 22], ['เหตุผล / หมายเหตุ', 30], ['ผู้ทบทวน', 18], ['วันที่ทบทวน', 13], ['สถานะ', 18],
  ];
  COLS.forEach(([, w], i) => { ws.getColumn(i + 1).width = w; });
  const L = (n) => ws.getColumn(n).letter;
  const last = COLS.length;

  ws.mergeCells(1, 1, 1, last);
  const t = ws.getCell(1, 1);
  t.value = [df.title || 'ใบทบทวนสิทธิ์ผู้ใช้ ESM (Access Review)', fullCode(df)].filter(Boolean).join('  ·  ');
  t.font = { size: 14, bold: true, color: { argb: 'FF1D4E89' } };
  ws.mergeCells(2, 1, 2, last);
  ws.getCell(2, 1).value = `ส่งออกเมื่อ ${now.toLocaleString(dateLocale(), { timeZone: 'Asia/Bangkok' })}`
    + (exportedBy ? ` · โดย ${exportedBy}` : '')
    + ` · ทั้งหมด ${sum.total} บัญชี · ต้องตรวจ ${sum.attention} · ต้องมีเหตุผล ${sum.reasonRequired}`;
  ws.mergeCells(3, 1, 3, last);
  ws.getCell(3, 1).value = 'วิธีใช้: เลือก "ผลการทบทวน" ทุกแถว (บัญชีที่ไม่มีธงเลือก "คงไว้ตามเดิม" ได้เลย) · '
    + 'แถวที่ "ต้องมีเหตุผล" = ใช่ ต้องเขียนเหตุผลทุกครั้ง · ผู้ทบทวนต้องไม่ใช่เจ้าของบัญชี · '
    + 'ใบนี้บันทึกผลเท่านั้น — การแก้สิทธิ์จริงทำที่หน้า /add-user';
  ws.getCell(3, 1).alignment = { wrapText: true, vertical: 'top' };
  ws.getRow(3).height = 30;
  ws.mergeCells(4, 1, 4, last);
  const warn = ws.getCell(4, 1);
  warn.value = notes.length ? `⚠ ${notes.join(' · ')}` : '';
  warn.font = { bold: true, color: { argb: 'FFB42318' } };

  const H = 6;
  COLS.forEach(([h], i) => {
    const c = ws.getCell(H, i + 1);
    c.value = h; c.fill = HDR; c.border = BOX;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
  });
  ws.getRow(H).height = 32;

  const cD = 16, cR = 17, cRv = 18, cDt = 19, cSt = 20;   // คอลัมน์ที่ผู้ทบทวนกรอก + สถานะ
  rows.forEach((r, i) => {
    const n = H + 1 + i;
    const flagText = r.flags.length
      ? r.flags.map(f => (f.lv === LV_HIGH ? '🔴 ' : f.lv === LV_INFO ? 'ⓘ ' : '🟡 ') + f.text + (f.detail ? ` (${f.detail})` : '')).join('\n')
      : '—';
    const vals = [i + 1, r.name, r.email, r.accountKind, r.roleText || '', r.positionText || '', r.sectionText || '',
      r.lineText || '', r.scopeText || '', r.ccText || '', EMP_STATE_TEXT[r.empState] || '', bkkText(r.lastSignInAt), flagText,
      r.attention ? 'ใช่' : '', r.reasonRequired ? 'ใช่' : ''];
    vals.forEach((v, j) => {
      const c = ws.getCell(n, j + 1);
      c.value = v; c.border = BOX; c.alignment = { wrapText: true, vertical: 'top' };
    });
    if (r.reasonRequired) ws.getCell(n, 13).fill = HI; else if (r.attention) ws.getCell(n, 13).fill = MID;
    for (const col of [cD, cR, cRv, cDt]) {
      const c = ws.getCell(n, col);
      c.fill = INP; c.border = BOX; c.protection = { locked: false }; c.alignment = { wrapText: true, vertical: 'top' };
    }
    ws.getCell(n, cDt).numFmt = 'dd/mm/yyyy';
    const D = `${L(cD)}${n}`, R = `${L(cR)}${n}`, RV = `${L(cRv)}${n}`, NM = `B${n}`, RQ = `O${n}`;
    /* สถานะ: ผลต่างจาก "คงไว้" ⇒ ต้องเขียนว่าปรับอะไร · ธง high ⇒ ต้องเขียนเหตุผลแม้คงไว้ ·
       ผู้ทบทวน = เจ้าของบัญชี ⇒ ขัดหลักแยกหน้าที่ (เทียบชื่อตรงตัว — ช่วยกันพลาด ไม่ใช่ด่านจริง) */
    const st = ws.getCell(n, cSt);
    st.value = { formula: `IF(${D}="","รอตัดสิน",IF(AND(${R}="",OR(${D}<>"${KEEP}",${RQ}="ใช่")),"ต้องใส่เหตุผล",`
      + `IF(${RV}="","ต้องใส่ผู้ทบทวน",IF(TRIM(${RV})=TRIM(${NM}),"ผู้ทบทวนต้องไม่ใช่เจ้าของบัญชี","เสร็จ"))))` };
    st.border = BOX; st.alignment = { horizontal: 'center', vertical: 'top', wrapText: true }; st.font = { bold: true };
  });
  const lastRow = H + rows.length;
  if (rows.length) {
    const rng = `${L(cD)}${H + 1}:${L(cD)}${lastRow}`;
    ws.dataValidations.add(rng, { type: 'list', allowBlank: true, formulae: [`"${REVIEW_DECISIONS.join(',')}"`] });
    const stRng = `${L(cSt)}${H + 1}:${L(cSt)}${lastRow}`;
    const top = `${L(cSt)}${H + 1}`;
    ws.addConditionalFormatting({ ref: stRng, rules: [
      { type: 'expression', priority: 1, formulae: [`${top}="เสร็จ"`], style: { fill: FILL('FFD7F0DF'), font: { color: { argb: 'FF12643A' } } } },
      { type: 'expression', priority: 2, formulae: [`${top}="รอตัดสิน"`], style: { fill: FILL('FFFFF4D6'), font: { color: { argb: 'FF8A5300' } } } },
      { type: 'expression', priority: 3, formulae: [`AND(${top}<>"เสร็จ",${top}<>"รอตัดสิน")`], style: { fill: HI, font: { color: { argb: 'FFB42318' } } } },
    ] });
    ws.autoFilter = { from: { row: H, column: 1 }, to: { row: lastRow, column: last } };
  }
  // ตัวนับความคืบหน้าใต้ตาราง (สูตร — อัปเดตเองตอนกรอก)
  const sr = lastRow + 2;
  const stCol = L(cSt);
  ws.getCell(sr, 2).value = 'ความคืบหน้า';
  ws.getCell(sr, 2).font = { bold: true };
  ws.getCell(sr, 3).value = rows.length
    ? { formula: `"เสร็จ "&COUNTIF(${stCol}${H + 1}:${stCol}${lastRow},"เสร็จ")&" / ${rows.length} บัญชี · ยังค้าง "&(${rows.length}-COUNTIF(${stCol}${H + 1}:${stCol}${lastRow},"เสร็จ"))` }
    : 'ไม่มีบัญชี';
  // ช่องลงนาม (ป้ายจากทะเบียนเอกสาร)
  const sg = sr + 2;
  sigs.slice(0, 3).forEach((lab, i) => {
    const col = 2 + i * 5;
    ws.getCell(sg, col).value = `${lab} ........................................`;
    ws.getCell(sg + 1, col).value = 'วันที่ ........ / ........ / ........';
  });
  await ws.protect('', { selectLockedCells: true, selectUnlockedCells: true, autoFilter: true, sort: true, formatColumns: true, formatRows: true });

  // ───────────── ชีต 2: คำอธิบายธง ─────────────
  const ws2 = wb.addWorksheet('คำอธิบายธง');
  ws2.getColumn(1).width = 10; ws2.getColumn(2).width = 52; ws2.getColumn(3).width = 12;
  ws2.getCell(1, 1).value = 'ธงที่ระบบใช้ติดในใบทบทวน (ระบบติดธงให้ — คนเป็นผู้ตัดสินเสมอ)';
  ws2.getCell(1, 1).font = { bold: true, size: 12, color: { argb: 'FF1D4E89' } };
  ['ระดับ', 'ความหมาย', 'จำนวนบัญชี'].forEach((h, i) => {
    const c = ws2.getCell(3, i + 1); c.value = h; c.fill = HDR; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.border = BOX;
  });
  const LV_TEXT = { high: '🔴 สูง', mid: '🟡 ควรตรวจ', info: 'ⓘ ข้อมูล' };
  ACCESS_REVIEW_FLAGS.forEach((f, i) => {
    const r = 4 + i;
    [LV_TEXT[f.lv], f.text, sum.byFlag[f.key] || 0].forEach((v, j) => { const c = ws2.getCell(r, j + 1); c.value = v; c.border = BOX; });
  });
  const nr = 5 + ACCESS_REVIEW_FLAGS.length;
  [
    '🔴 สูง = ต้องเขียนเหตุผลทุกครั้ง แม้เลือก "คงไว้ตามเดิม"',
    'ⓘ ข้อมูล = ไม่บังคับตรวจ · "อ่านไม่ได้" ไม่ได้แปลว่า "ไม่มี" (เช่น ผู้ส่งออกไม่ใช่ admin จึงอ่านเวลาเข้าใช้ไม่ได้)',
    'ผลการทบทวนในไฟล์นี้ไม่ไปแก้ระบบเอง — เลือก "ปรับสิทธิ์" หรือ "ปิดบัญชี" แล้วต้องไปแก้ที่หน้า /add-user',
    'อ้างอิง: ISO/IEC 27001:2022 A.5.18 (ทบทวนสิทธิ์เป็นรอบ) · A.8.2 (สิทธิ์ระดับสูง)',
  ].forEach((line, i) => { ws2.getCell(nr + i, 1).value = line; });

  return wb;
}

/** สร้าง + ดาวน์โหลด (ชื่อไฟล์ตามทะเบียน /doc-forms) */
export async function exportAccessReviewExcel(rows, opts = {}) {
  const wb = await buildAccessReviewWorkbook(rows, opts);
  const { now } = opts;
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = xlsxDocName(ACCESS_REVIEW_DOC_KEY, `ESM_access_review_${bkkDate(now)}`);
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
