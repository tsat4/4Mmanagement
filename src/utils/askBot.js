/* ══ 💬 askBot — ตัวอ่านคำถาม + สูตรรวมผลของแชท "ถามข้อมูลในระบบ" (2026-11-19 · คำสั่ง user) ══
   ขั้นแรก **ยังไม่มี AI**: จับคำ (keyword) → เลือก "เครื่องมือ" → เครื่องมือเรียกสูตรกลางชุดเดิม
   ตอนได้งบ = เปลี่ยนเฉพาะ `parseQuestion()` เป็น AI · ชั้นเครื่องมือ (`lib/askBotQuery.js`) ใช้ต่อได้ทั้งหมด

   🔴 กติกาที่ห้ามแหก
   · **ไม่เข้าใจ = ไม่เดา** — คืน `intent: null` ให้จอเสนอรูปแบบที่ถามได้ · ชื่อตรงหลายตัว = ให้คนเลือก
   · **ห้ามมีสูตรชุดที่ 2** — OEE ถ่วงด้วย `wavg`+`wLoad/wRun/wProd` (เหมือนกราฟ 10 วันของ /oee-analytics) ·
     downtime จัดแท่งด้วย `dtBucketName()` · ยอดผลิตต่อใบ = `orderProducedQty()` · ยุบชั้น OP ด้วย `collapseOps()`
   · **ยอดผลิต = "ชิ้น"** ห้ามยุบคู่ RH/LH (กฎ "ชิ้น ≠ shot") — ยุบเฉพาะชั้น OP (ขั้นตอนของชิ้นเดียวกัน)
   · ไฟล์นี้ **pure** (ห้าม import supabase) — เทสด้วย `node --test` ตรงๆ · วันที่รับ `today` จากผู้เรียกเสมอ
   📄 docs/modules/askbot.md */
import { wavg, wLoad, wRun, wProd, orderProducedQty, dtMinBySession, dtPlannedSplit } from './oee.js';
import { addDaysStr } from './workDate.js';
import { dtBucketName, buildDtIndex, dtTrashStats } from './downtimeCategory.js';
import { collapseOps } from './pairTotals.js';
import { partCoreOf } from './partGroup.js';
import { weekMonday } from './timeRange.js';

/* ── 1) ช่วงเวลา ─────────────────────────────────────────────────────────── */
const TH_MONTHS = [
  ['มกราคม', 'ม.ค.', 'มค'], ['กุมภาพันธ์', 'ก.พ.', 'กพ'], ['มีนาคม', 'มี.ค.', 'มีค'],
  ['เมษายน', 'เม.ย.', 'เมย'], ['พฤษภาคม', 'พ.ค.', 'พค'], ['มิถุนายน', 'มิ.ย.', 'มิย'],
  ['กรกฎาคม', 'ก.ค.', 'กค'], ['สิงหาคม', 'ส.ค.', 'สค'], ['กันยายน', 'ก.ย.', 'กย'],
  ['ตุลาคม', 'ต.ค.', 'ตค'], ['พฤศจิกายน', 'พ.ย.', 'พย'], ['ธันวาคม', 'ธ.ค.', 'ธค'],
];
export const MONTH_LABEL = TH_MONTHS.map(m => m[1]);

const pad2 = (n) => String(n).padStart(2, '0');
const lastDayOf = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();   // m = 1..12
const addDay = (s, n) => addDaysStr(s, n);

function monthRange(y, m, today) {
  const from = `${y}-${pad2(m)}-01`;
  const end = `${y}-${pad2(m)}-${pad2(lastDayOf(y, m))}`;
  if (from > today) return { from, to: end, future: true };
  return { from, to: end < today ? end : today };
}

/**
 * อ่านช่วงเวลาจากข้อความ — คืน `{ from, to, label, explicit }` หรือ `{ error }`
 * ไม่พบคำบอกช่วง = `null` (ผู้เรียกใช้ค่าตั้งต้นของคำถามนั้น แล้ว**ต้องเขียนบอก**ว่าใช้ค่าไหน)
 * 🔴 "เดือน 10" ไม่ระบุปี = ปีของ `today` · ยังมาไม่ถึง = `error` (ห้ามเดาว่าหมายถึงปีที่แล้ว)
 */
export function periodFromText(text, today) {
  const t = String(text || '').toLowerCase();
  const y0 = +today.slice(0, 4), m0 = +today.slice(5, 7);
  if (/วันนี้|today/.test(t)) return { from: today, to: today, label: `วันนี้ (${today})`, explicit: true };
  if (/เมื่อวาน|yesterday/.test(t)) { const d = addDay(today, -1); return { from: d, to: d, label: `เมื่อวาน (${d})`, explicit: true }; }
  if (/(สัปดาห์|อาทิตย์)นี้|this ?week/.test(t)) return { from: weekMonday(today), to: today, label: `สัปดาห์นี้ (${weekMonday(today)} – ${today})`, explicit: true };
  if (/(สัปดาห์|อาทิตย์)(ที่แล้ว|ก่อน)|last ?week/.test(t)) {
    const mon = addDay(weekMonday(today), -7);
    return { from: mon, to: addDay(mon, 6), label: `สัปดาห์ที่แล้ว (${mon} – ${addDay(mon, 6)})`, explicit: true };
  }
  if (/เดือนนี้|this ?month/.test(t)) return { ...monthRange(y0, m0, today), label: `เดือนนี้ (${MONTH_LABEL[m0 - 1]} ${y0})`, explicit: true };
  if (/เดือน(ที่แล้ว|ก่อน)|last ?month/.test(t)) {
    const y = m0 === 1 ? y0 - 1 : y0, m = m0 === 1 ? 12 : m0 - 1;
    return { ...monthRange(y, m, today), label: `เดือนที่แล้ว (${MONTH_LABEL[m - 1]} ${y})`, explicit: true };
  }

  /* เดือนระบุ — "เดือน 10" · "เดือน 10/2026" · "ต.ค." · "ตุลาคม 2569" */
  let m = null, yTxt = null;
  const num = t.match(/เดือน\s*(\d{1,2})(?:\s*[/-]\s*(\d{4}))?/);
  if (num) { m = +num[1]; yTxt = num[2] || null; }
  if (m == null) {
    for (let i = 0; i < 12 && m == null; i++) {
      for (const w of TH_MONTHS[i]) {
        const idx = t.indexOf(w);
        if (idx >= 0) { m = i + 1; const after = t.slice(idx + w.length).match(/^\s*(\d{4})/); yTxt = after ? after[1] : null; break; }
      }
    }
  }
  if (m == null) return null;
  if (m < 1 || m > 12) return { error: `ไม่มีเดือนที่ ${m}` };
  let y = yTxt ? +yTxt : y0;
  if (y > 2400) y -= 543;                       // พ.ศ. → ค.ศ.
  const r = monthRange(y, m, today);
  if (r.future) return { error: `${MONTH_LABEL[m - 1]} ${y} ยังมาไม่ถึง — ถ้าหมายถึงปีอื่น พิมพ์ปีต่อท้าย เช่น "เดือน ${m}/${y - 1}"` };
  return { from: r.from, to: r.to, label: `${MONTH_LABEL[m - 1]} ${y}${yTxt ? '' : ' (ไม่ได้ระบุปี = ปีนี้)'}`, explicit: true };
}

/* ── 2) จับเจตนา ─────────────────────────────────────────────────────────── */
/* ลำดับสำคัญ: OEE → downtime → ยอดผลิต ("oee ผลิต" = ถาม OEE ไม่ใช่ยอด) */
export const INTENTS = [
  { key: 'oee', re: /oee|โออีอี/, defaultPeriod: 'today', needSubject: 'line' },
  { key: 'downtime_top', re: /down\s*time|ดาว(น์)?\s*ไทม์|เครื่องหยุด|หยุดเครื่อง/, defaultPeriod: 'week', needSubject: null },
  { key: 'production', re: /ยอดผลิต|ผลิต|กี่ชิ้น|output|production/, defaultPeriod: 'month', needSubject: 'any' },
];

/* คำที่ไม่ใช่ชื่อไลน์/พาร์ท — ตัดทิ้งก่อนเอาส่วนที่เหลือไปค้นชื่อ
   🔴 ภาษาไทยไม่มีเว้นวรรค ("ขอยอดผลิตงาน apron…") ⇒ ฝั่งไทยต้องตัดแบบ "ข้อความย่อย"
      แต่ฝั่งอังกฤษ/ตัวเลขตัดแบบ **ทั้งคำเท่านั้น** — ชื่อไลน์/พาร์ทส่วนใหญ่เป็นอักษรละติน
      ตัดแบบข้อความย่อยฝั่งนั้น = "TOPPER" เหลือ "PER" แล้วค้นผิดตัว */
const THAI_FILLER = /โออีอี|ดาว(น์)?\s*ไทม์|เครื่องหยุด|หยุดเครื่อง|ยอดผลิต|ผลิต|กี่ชิ้น|สูงสุด|มากที่สุด|มากสุด|อันดับ|อะไร|บ้าง|เท่าไหร่|เท่าไร|ไปแล้ว|แล้ว|ได้|ไป|ของ|ขอ|ยอด|ดู|หน่อย|ครับ|ค่ะ|คะ|นะ|ไลน์|งาน|ชิ้น|กี่|ที/g;
const LATIN_FILLER = /\b(oee|down\s*time|downtime|top|line|output|production|today|yesterday|this|last|week|month)\b|[?？!]/g;
const THAI_RUN = /([฀-๿]+)/;
/* 🔴 ห้ามตัดคำกลางพยางค์ — "ที" ใน "ชุดที่" ตามด้วยไม้เอก ⇒ ไม่ใช่คำว่า "ที" (เคสจริงตอนลองถาม 19/11)
   ⇒ ตัดได้เฉพาะเมื่อตัวถัดไป **ไม่ใช่** สระบน/ล่าง/วรรณยุกต์ (อักขระประกอบของพยางค์เดียวกัน) */
const THAI_MARK_AHEAD = /^[ัิ-ฺ็-๎]/;
const stripThaiFiller = (run) => run.replace(THAI_FILLER, (m, ...a) => {
  const off = a[a.length - 2], str = a[a.length - 1];
  return THAI_MARK_AHEAD.test(str.slice(off + m.length)) ? m : ' ';
});

function stripPeriodWords(t) {
  let s = t.replace(/เดือน\s*\d{1,2}(\s*[/-]\s*\d{4})?/g, ' ')
    .replace(/วันนี้|เมื่อวาน|(สัปดาห์|อาทิตย์)(นี้|ที่แล้ว|ก่อน)|เดือน(นี้|ที่แล้ว|ก่อน)/g, ' ');
  for (const names of TH_MONTHS) for (const w of names) s = s.split(w).join(' ');
  return s.replace(/(^|\s)(25|20)\d{2}(?=\s|$)/g, ' ');
}

function subjectOf(t) {
  return stripPeriodWords(t).split(THAI_RUN)
    .map(part => (THAI_RUN.test(part) ? stripThaiFiller(part) : part.replace(LATIN_FILLER, ' ')))
    .join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * @returns {{ intent:string|null, period:object|null, periodDefault:string|null, subject:string, error?:string }}
 */
export function parseQuestion(text, today) {
  const raw = String(text || '').trim();
  const t = raw.toLowerCase();
  const it = INTENTS.find(i => i.re.test(t)) || null;
  const p = periodFromText(t, today);
  const subject = subjectOf(t);
  if (!it) return { intent: null, period: null, periodDefault: null, subject };
  if (p?.error) return { intent: it.key, period: null, periodDefault: null, subject, error: p.error };
  return { intent: it.key, period: p, periodDefault: p ? null : it.defaultPeriod, subject };
}

/** ค่าตั้งต้นของช่วง (เมื่อคำถามไม่ได้บอก) — จอต้องเขียนว่า "ไม่ได้ระบุช่วง ใช้…" */
export function defaultPeriod(key, today) {
  const p = periodFromText(key === 'today' ? 'วันนี้' : key === 'week' ? 'สัปดาห์นี้' : 'เดือนนี้', today);
  return { ...p, explicit: false };
}

/* ── 3) ค้นชื่อไลน์/พาร์ท ─────────────────────────────────────────────────── */
export const normKey = (s) => String(s ?? '').toLowerCase().replace(/[\s\-_/.()[\],]+/g, '');

/**
 * หาไลน์/พาร์ทจากข้อความ — **ตรงตัวเดียวเท่านั้นถึงตอบ** หลายตัว = คืนให้คนเลือก (ห้ามเดา)
 * พาร์ทยุบด้วยแกน `p_no` (`partCoreOf`) = สินค้าเดียวกันคนละลูกค้า นับเป็นตัวเลือกเดียว
 * @param {{ lines?:any[], products?:any[], kinds?:('line'|'part')[] }} reg
 * @returns {{ pick:object|null, choices:object[], more:number }}
 *   pick   = `{ kind:'line', name }` | `{ kind:'part', core, mats:[], label }`
 */
export function matchSubject(subject, { lines = [], products = [], kinds = ['line', 'part'] } = {}) {
  const tokens = String(subject || '').toLowerCase().split(/\s+/).map(normKey).filter(Boolean);
  if (!tokens.length) return { pick: null, choices: [], more: 0 };
  const whole = tokens.join('');
  /* ตัวเลขล้วนต้องตรง "ทั้งตัว" — ถาม "ชุดที่ 1" ห้ามได้ 10–15 มาด้วย · ถาม "060" ห้ามได้ "0601" */
  const hitAll = (hay) => tokens.every(tk => (/^\d+$/.test(tk)
    ? new RegExp(`(^|\\D)${tk}(?!\\d)`).test(hay) : hay.includes(tk)));

  const lineHits = [], lineExact = [];
  if (kinds.includes('line')) for (const l of lines) {
    if (!l?.name) continue;
    const k = normKey(l.name);
    if (k === whole) lineExact.push(l);
    else if (hitAll(k)) lineHits.push(l);
  }
  const partByKey = new Map(), partExact = new Set();
  if (kinds.includes('part')) for (const p of products) {
    if (!p?.mat_no || p.is_operation) continue;          // ชั้น OP ไม่ใช่พาร์ทจริง
    const keys = [normKey(p.name), normKey(p.p_no), normKey(p.mat_no)];
    const exact = keys.includes(whole);
    if (!exact && !keys.some(hitAll)) continue;
    const core = partCoreOf(p.p_no) || `mat:${p.mat_no}`;
    const g = partByKey.get(core) || { kind: 'part', core, mats: [], label: p.name || p.mat_no, p_no: p.p_no || null };
    g.mats.push(p.mat_no);
    partByKey.set(core, g);
    if (exact) partExact.add(core);
  }
  const lineChoice = (l) => ({ kind: 'line', name: l.name, label: l.name });

  /* ตรงเป๊ะชนะ "มีคำนี้อยู่ข้างใน" · ตรงเป๊ะหลายตัว (ไลน์ชื่อเดียวกับพาร์ท) = ยังต้องให้เลือก */
  const exact = [...lineExact.map(lineChoice), ...[...partExact].map(c => partByKey.get(c))];
  const pool = exact.length ? exact : [...lineHits.map(lineChoice), ...partByKey.values()];
  if (pool.length === 1) return { pick: pool[0], choices: [], more: 0 };
  const MAX = 8;
  return { pick: null, choices: pool.slice(0, MAX), more: Math.max(0, pool.length - MAX) };
}

/* ── 4) สูตรรวมผล (เรียกสูตรกลางเท่านั้น) ─────────────────────────────────── */

/**
 * OEE ของกะที่ปิดแล้ว — ค่า stamp ถ่วงน้ำหนักแบบเดียวกับ /oee-analytics และ /vsm
 * (oee/A ด้วย wLoad · P ด้วย wRun · Q ด้วย wProd)
 * 🔴 น้ำหนัก wLoad ต้องหัก "หยุดตามแผน" ที่ตัดช่วงพัก + หารเลนแล้ว ⇒ ผ่าน `dtMinBySession` เท่านั้น
 *    (รวม duration_min เอง = หักนาทีที่ทับพักซ้ำ · กฎเหล็ก §OEE 2026-09-15)
 * @param sessions  กะ (ต้องมี id, work_date, shift, start_time, shift_min, line_name + oee*)
 * @param downtimes ใบ downtime ของกะชุดนี้ (started_at/ended_at/duration_min/machine_no + category/planned_cap_min)
 */
export function oeeSummary(sessions = [], downtimes = [], breakPolicies = [], { lines = null, affectsBy = null } = {}) {
  const eff = dtMinBySession(sessions, downtimes, breakPolicies, { lines, affectsBy });
  const items = sessions.filter(s => s && s.oee != null).map(s => ({ ...s, plannedMin: eff[s.id]?.planned || 0 }));
  return {
    n: items.length,
    oee: wavg(items, i => +i.oee, wLoad),
    a: wavg(items, i => (i.oee_a != null ? +i.oee_a : null), wLoad),
    p: wavg(items, i => (i.oee_p != null ? +i.oee_p : null), wRun),
    q: wavg(items, i => (i.oee_q != null ? +i.oee_q : null), wProd),
    noStamp: sessions.filter(s => s && s.oee == null).length,
  };
}

/**
 * พาเรโต downtime นอกแผน — นาทีเต็ม `duration_min` (คำถาม "เครื่องหยุดกี่นาที" · ไม่ใช่ฐานเวลา OEE)
 * · แยกในแผน/นอกแผนผ่าน `dtPlannedSplit()` — หยุดตามแผนที่เกินเพดานของประเภท = นอกแผน (ทะเบียน · 16/11)
 * · ถังขยะ "อื่นๆ" ถูกแตกตามเครื่องโดย `dtBucketName()` ⇒ ไม่ขึ้นอันดับ 1 เป็นก้อนเดียว
 */
export function downtimeTop(rows = [], n = 5) {
  const parts = rows.map(d => ({ d, sp: dtPlannedSplit(d, Number(d?.duration_min) || 0) }));
  const unplanned = parts.filter(x => x.sp.unplanned > 0);
  const idx = buildDtIndex(unplanned.map(x => x.d));
  const by = new Map();
  let total = 0, overMin = 0;
  for (const { d, sp } of unplanned) {
    total += sp.unplanned; overMin += sp.overMin;
    const k = dtBucketName(d, idx);
    const e = by.get(k) || { name: k, min: 0, count: 0 };
    e.min += sp.unplanned; e.count += 1; by.set(k, e);
  }
  const list = [...by.values()].sort((a, b) => b.min - a.min);
  const trash = dtTrashStats(unplanned.map(x => x.d), { index: idx });
  return { total, top: list.slice(0, n), groups: list.length, trash, overMin,
    plannedExcluded: parts.filter(x => x.sp.planned > 0 && x.sp.unplanned === 0).length };
}

/**
 * ยอดผลิต (ชิ้น) จากใบผลิต — ต่อใบ `orderProducedQty()` · ยุบชั้น OP ด้วย `collapseOps()`
 * 🔴 ไม่ยุบคู่ RH/LH (ยอดผลิตนับชิ้น) · ใบไม่มี MAT = รวมยอดแยก (`noMat`) ห้ามทิ้ง
 */
export function productionTotals(orders = [], opMap = null) {
  const perMat = {}; let noMat = 0;
  for (const o of orders) {
    const q = orderProducedQty(o);
    if (o.mat_no == null || o.mat_no === '') { noMat += q; continue; }
    (perMat[o.mat_no] ||= { mat_no: o.mat_no, target: 0, produced: 0 }).produced += q;
  }
  const rows = collapseOps(Object.values(perMat), opMap || {});
  const total = rows.reduce((a, r) => a + (Number(r.produced) || 0), 0) + noMat;
  return { total, noMat, rows: rows.filter(r => r.produced > 0).sort((a, b) => b.produced - a.produced) };
}

export const fmtInt = (n) => (n == null ? '—' : Math.round(n).toLocaleString('en-US'));
export const fmtPct = (n) => (n == null ? '—' : `${(+n).toFixed(1)}%`);

/** ข้อความแนะนำรูปแบบที่ถามได้ — ใช้ทั้งปุ่มลัดและตอนไม่เข้าใจคำถาม */
export const ASK_HINTS = ['oee HDF1 วันนี้', 'downtime สูงสุด สัปดาห์นี้', 'ยอดผลิต HDF1 เดือนนี้'];
