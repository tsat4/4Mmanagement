/* ══ 💬 askBotQuery — "เครื่องมือ" ของแชทถามข้อมูล: คำถามที่อ่านแล้ว → ยิงฐาน → คำตอบ (2026-11-19) ══
   ใครใช้: `components/AskBot.jsx` เท่านั้น · ตอนอัปเกรดเป็น AI ให้ AI เรียกฟังก์ชันชุดนี้ต่อได้ตรงๆ

   🔴 กติกาที่ห้ามแหก
   · **รันในเบราว์เซอร์ของผู้ถาม = เห็นเท่าที่จอเห็น** — ตัดขอบเขตด้วย `lineScope()` ตัวเดียวกับทุกจอ
     ไลน์นอกขอบเขต = ไม่ตอบ + บอกว่าไม่อยู่ในขอบเขต (ห้ามเงียบ) · ตัดแถวทิ้ง = บอกจำนวนที่ซ่อน
   · **นับเฉพาะกะที่ปิดแล้ว** (ค่า stamp ตอนปิดกะ = ชุดเดียวกับ /oee-analytics แท็บแนวโน้ม/พาเรโต)
     กะที่ยังเปิด/รออนุมัติปิด **ต้องเขียนว่ามีกี่กะที่ยังไม่นับ** · ใบโมฆะ (void) ไม่นับ
   · อ่านไม่ได้ = บอกว่าอ่านไม่ได้ **ห้ามตอบ 0** (กฎเขียน DB ข้อ 12 "จอโกหก")
   · ทะเบียนไลน์อ่านผ่าน `loadProductionLines()` · ทะเบียนสินค้าผ่าน `loadProductsMaster()` (cache กลาง)
   📄 docs/modules/askbot.md */
import { supabaseDR } from '../supabaseClient';
import { loadProductionLines } from '../utils/useProductionLines';
import { loadProductsMaster } from '../utils/useProducts';
import { loadOpInfo } from '../utils/opItems';
import { lineScope } from '../utils/sectionScope';
import { getLineFamily, getAncestorNames } from '../utils/lineHierarchy';
import { fetchAllPages, fetchByIds } from '../utils/fetchByIds';
import { SESSION_STATUSES_LIVE } from '../utils/sessionStatus';
import { loadBreakPolicies } from '../utils/oeeMasters';
import { loadAffectsLanes, affectsLanesLoadFail } from '../utils/affectsLanes';
import {
  parseQuestion, defaultPeriod, matchSubject, oeeSummary, downtimeTop, productionTotals,
  fmtInt, fmtPct, ASK_HINTS,
} from '../utils/askBot';

const NOT_UNDERSTOOD = (extra = '') => ({
  text: `${extra ? `${extra}\n` : ''}ยังไม่เข้าใจคำถามนี้ — ตอนนี้ถามได้แบบนี้:`,
  hints: ASK_HINTS,
});
const fail = (what, err) => ({ text: `⚠️ อ่าน${what}ไม่สำเร็จ — ยังตอบไม่ได้ (ไม่ใช่ "ไม่มีข้อมูล")\n${String(err?.message || err || '').slice(0, 120)}`.trim() });

/** ตัวไลน์ "ตัวเอง + ไลน์ลูกทั้งหมด" (ไม่เอาไลน์แม่ — ถาม 060 ต้องไม่ลากทั้งส่วนงานมาด้วย) */
function selfAndDescendants(all, name) {
  const up = new Set(getAncestorNames(all, name));
  return getLineFamily(all, name).map(l => l.name).filter(n => !up.has(n));
}

/** ไลน์ที่ผู้ถามเห็นได้ — `null` = ไม่จำกัด */
function visibleSet(ctx, lines) {
  const r = lineScope({ role: ctx.role, lineId: ctx.lineId, sections: ctx.sections || [], lines, scopeIdx: ctx.scopeIdx || null });
  return { names: r.unlimited ? null : new Set(r.names), unsure: !!r.unsure };
}

async function closedAndOpen(period, lineNames, cols) {
  const run = (statusFilter) => fetchAllPages(() => {
    let q = supabaseDR.from('production_sessions').select(cols)
      .gte('work_date', period.from).lte('work_date', period.to);
    q = statusFilter(q);
    if (lineNames) q = q.in('line_name', lineNames);
    return q;
  }, { orderBy: ['work_date', 'id'] });
  const [closed, open] = await Promise.all([
    run(q => q.eq('status', 'closed')),
    run(q => q.in('status', SESSION_STATUSES_LIVE)),
  ]);
  return { closed, open };
}

/* คอลัมน์ downtime ชุดเดียวของแชท — `started_at/ended_at` ให้ตัดช่วงพักได้ · `planned_cap_min` ให้เพดานหยุดตามแผนทำงาน */
const DT_COLS = 'id, session_id, started_at, ended_at, duration_min, machine_no, description, dr_downtime_types(name_th, category, planned_cap_min)';

const openNote = (n) => (n ? `⏳ มีกะที่ยังไม่ปิด ${n} กะในช่วงนี้ — ยังไม่นับ` : null);

/* ── เครื่องมือ 1: OEE ไลน์ ───────────────────────────────────────────── */
async function toolOee({ lineName, period, all, vis }) {
  const names = selfAndDescendants(all, lineName).filter(n => !vis.names || vis.names.has(n));
  const { closed, open } = await closedAndOpen(period, names,
    'id, work_date, line_name, shift, status, start_time, oee, oee_a, oee_p, oee_q, shift_min, actual_qty, qty_ng');
  if (closed.error || open.error) return fail('กะผลิต', closed.error || open.error);
  /* น้ำหนัก wLoad ต้องหักหยุดตามแผนที่ตัดพัก+หารเลนแล้ว (ชุดเดียวกับ /oee-analytics) ⇒ ต้องมีใบ downtime + นโยบายพัก */
  const [dt, breaks, affectsBy] = await Promise.all([
    fetchByIds(closed.rows.map(x => x.id), c => supabaseDR.from('downtime_logs').select(DT_COLS).in('session_id', c)),
    loadBreakPolicies().catch(() => null),
    loadAffectsLanes(),
  ]);
  if (dt.error || dt.truncated) return fail('รายการ downtime', dt.error || 'ข้อมูลเยอะเกินเพดาน — ลองช่วงสั้นลง');
  if (breaks == null) return fail('นโยบายเวลาพัก', 'โหลดไม่ได้ — คิดน้ำหนักกะไม่ได้ (ห้ามถือว่าไม่มีพัก)');
  const s = oeeSummary(closed.rows, dt.rows, breaks, { lines: all, affectsBy });
  const kids = names.length > 1 ? ` (รวมไลน์ลูก ${names.length - 1} ไลน์)` : '';
  const notes = [openNote(open.rows.length),
    s.noStamp ? `กะปิดแล้วแต่ยังไม่มีค่า OEE ${s.noStamp} กะ — ไม่นับ` : null,
    affectsLanesLoadFail() ? '⚠️ อ่านทะเบียน "เครื่องที่หยุดทั้งไลน์" ไม่ได้ — น้ำหนักกะของไลน์เครื่องขนานอาจเพี้ยนเล็กน้อย' : null].filter(Boolean);
  if (!s.n) return { source: `OEE ไลน์ ${lineName}${kids} · ${period.label}`, text: 'ยังไม่มีกะที่ปิดแล้วในช่วงนี้ — ยังคิด OEE ไม่ได้', notes, link: '/oee-analytics' };
  return {
    source: `OEE ไลน์ ${lineName}${kids} · ${period.label} · กะที่ปิดแล้ว ${s.n} กะ`,
    text: `OEE ${fmtPct(s.oee)}\nA ${fmtPct(s.a)} · P ${fmtPct(s.p)} · Q ${fmtPct(s.q)}`,
    notes, link: '/oee-analytics',
  };
}

/* ── เครื่องมือ 2: downtime สูงสุด ─────────────────────────────────────── */
async function toolDowntime({ lineName, period, all, vis }) {
  const names = lineName ? selfAndDescendants(all, lineName).filter(n => !vis.names || vis.names.has(n))
    : (vis.names ? [...vis.names] : null);
  const { closed, open } = await closedAndOpen(period, names, 'id, line_name');
  if (closed.error || open.error) return fail('กะผลิต', closed.error || open.error);
  const dt = await fetchByIds(closed.rows.map(s => s.id), c => supabaseDR.from('downtime_logs')
    .select(DT_COLS).in('session_id', c));
  if (dt.error || dt.truncated) return fail('รายการ downtime', dt.error || 'ข้อมูลเยอะเกินเพดาน — ลองช่วงสั้นลง');
  const r = downtimeTop(dt.rows, 5);
  const who = lineName ? `ไลน์ ${lineName}` : (vis.names ? `ทุกไลน์ในขอบเขตของคุณ (${vis.names.size} ไลน์)` : 'ทุกไลน์');
  const notes = [openNote(open.rows.length),
    r.plannedExcluded ? `ไม่นับหยุดตามแผน ${r.plannedExcluded} ใบ` : null,
    r.overMin ? `หยุดตามแผนที่เกินเพดานของประเภท ${fmtInt(r.overMin)} นาที นับเป็นนอกแผนแล้ว` : null,
    r.trash.vague ? `ประเภทบอกอะไรไม่ได้ (อื่นๆ/ไม่ระบุ) ${r.trash.vague} ใบ (${r.trash.vaguePct.toFixed(0)}%) — แตกตามเครื่องให้แล้ว${r.trash.noMachine ? ` · ชี้เป้าไม่ได้เลย ${r.trash.noMachine} ใบ` : ''}` : null,
  ].filter(Boolean);
  const source = `downtime นอกแผน ${who} · ${period.label} · กะที่ปิดแล้ว ${closed.rows.length} กะ`;
  if (!r.top.length) return { source, text: 'ไม่มี downtime นอกแผนในกะที่ปิดแล้วช่วงนี้', notes, link: '/oee-analytics' };
  return {
    source,
    text: r.top.map((e, i) => `${i + 1}. ${e.name} — ${fmtInt(e.min)} นาที (${e.count} ครั้ง)`).join('\n')
      + `\nรวม ${fmtInt(r.total)} นาที · ${r.groups} หมวด`,
    notes, link: '/oee-analytics',
  };
}

/* ── เครื่องมือ 3: ยอดผลิต (ไลน์ หรือ พาร์ท) ───────────────────────────── */
async function toolProduction({ pick, period, all, vis, products }) {
  const nameOf = Object.fromEntries((products || []).map(p => [p.mat_no, p.name]));
  const opMap = await loadOpInfo();
  if (pick.kind === 'line') {
    const names = selfAndDescendants(all, pick.name).filter(n => !vis.names || vis.names.has(n));
    const { closed, open } = await closedAndOpen(period, names, 'id');
    if (closed.error || open.error) return fail('กะผลิต', closed.error || open.error);
    const od = await fetchByIds(closed.rows.map(s => s.id), c => supabaseDR.from('prod_orders')
      .select('id, session_id, mat_no, status, qty, qty_ok, qty_actual').in('session_id', c));
    if (od.error || od.truncated) return fail('ใบผลิต', od.error || 'ข้อมูลเยอะเกินเพดาน — ลองช่วงสั้นลง');
    const t = productionTotals(od.rows, opMap);
    const kids = names.length > 1 ? ` (รวมไลน์ลูก ${names.length - 1} ไลน์)` : '';
    return {
      source: `ยอดผลิต ไลน์ ${pick.name}${kids} · ${period.label} · กะที่ปิดแล้ว ${closed.rows.length} กะ`,
      text: `รวม ${fmtInt(t.total)} ชิ้น` + (t.rows.length ? '\n' + t.rows.slice(0, 5)
        .map(r => `· ${r.mat_no}${nameOf[r.mat_no] ? ` ${nameOf[r.mat_no]}` : ''} — ${fmtInt(r.produced)} ชิ้น`).join('\n') : '')
        + (t.rows.length > 5 ? `\n· อีก ${t.rows.length - 5} พาร์ท` : ''),
      notes: [openNote(open.rows.length), t.noMat ? `ใบผลิตไม่ระบุ MAT ${fmtInt(t.noMat)} ชิ้น (รวมในยอดแล้ว)` : null,
        'นับเป็น "ชิ้น" — งานคู่ RH/LH นับแยกทั้ง 2 ข้าง'].filter(Boolean),
      link: '/oee-analytics',
    };
  }

  /* พาร์ท: ทุก MAT ของสินค้าเดียวกัน (แกน p_no) · ตัดตามขอบเขตไลน์ที่ผลิต */
  const mats = pick.mats;
  const base = (st) => fetchAllPages(() => {
    let q = supabaseDR.from('prod_orders')
      .select('id, mat_no, status, qty, qty_ok, qty_actual, production_sessions!inner(work_date, status, line_name)')
      .in('mat_no', mats)
      .gte('production_sessions.work_date', period.from).lte('production_sessions.work_date', period.to);
    return st(q);
  });
  const [cl, op] = await Promise.all([
    base(q => q.eq('production_sessions.status', 'closed')),
    base(q => q.in('production_sessions.status', SESSION_STATUSES_LIVE)),
  ]);
  if (cl.error || op.error || cl.truncated) return fail('ใบผลิต', cl.error || op.error || 'ข้อมูลเยอะเกินเพดาน');
  const inScope = (o) => !vis.names || vis.names.has(o.production_sessions?.line_name);
  const rows = cl.rows.filter(inScope);
  const hidden = cl.rows.length - rows.length;
  const byMat = {}; let total = 0;
  rows.forEach(o => { const q = productionTotals([o]).total; byMat[o.mat_no] = (byMat[o.mat_no] || 0) + q; total += q; });
  const lineSet = new Set(rows.map(o => o.production_sessions?.line_name).filter(Boolean));
  const openSess = new Set(op.rows.filter(inScope).map(o => `${o.production_sessions?.line_name}|${o.production_sessions?.work_date}`));
  return {
    source: `ยอดผลิต พาร์ท ${pick.label}${pick.p_no ? ` (${pick.p_no})` : ''} · ${period.label} · ${lineSet.size} ไลน์`,
    text: `รวม ${fmtInt(total)} ชิ้น` + (mats.length > 1 ? '\n' + mats.map(m => `· ${m} — ${fmtInt(byMat[m] || 0)} ชิ้น`).join('\n') : ''),
    notes: [openSess.size ? `⏳ มีใบผลิตของพาร์ทนี้ในกะที่ยังไม่ปิด — ยังไม่นับ` : null,
      hidden ? `ซ่อน ${hidden} ใบผลิตที่อยู่ไลน์นอกขอบเขตของคุณ` : null,
      mats.length > 1 ? `สินค้าเดียวกัน ${mats.length} MAT (คนละลูกค้า) รวมให้แล้ว` : null].filter(Boolean),
    link: '/product-history',
  };
}

/**
 * ตอบคำถาม — คืน `{ text, source?, notes?, hints?, choices?, link? }`
 * @param {string} text  ข้อความที่พิมพ์
 * @param {object} ctx   `UserContext` ของผู้ถาม (role/lineId/sections/scopeIdx)
 * @param {string} today วันทำงาน (`getWorkDate()`) — ส่งเข้ามาเพื่อให้เทสตรึงได้
 * @param {object} [forced] ตัวเลือกที่คนกดเลือกจากรอบก่อน (ไลน์/พาร์ท) — ข้ามขั้นค้นชื่อ
 */
export async function answerQuestion(text, ctx, today, forced = null) {
  const q = parseQuestion(text, today);
  if (!q.intent) return NOT_UNDERSTOOD();
  if (q.error) return { text: q.error };
  const period = q.period || defaultPeriod(q.periodDefault, today);
  const periodNote = q.period ? null : `ไม่ได้ระบุช่วงเวลา — ใช้ "${period.label}"`;

  let all, products = [];
  try { all = await loadProductionLines(); } catch (e) { return fail('ทะเบียนไลน์', e); }
  if (!all?.length) return fail('ทะเบียนไลน์', 'ทะเบียนว่าง');
  const vis = visibleSet(ctx, all);

  let pick = forced;
  if (!pick && q.subject) {
    const kinds = q.intent === 'production' ? ['line', 'part'] : ['line'];
    if (kinds.includes('part')) {
      try { products = await loadProductsMaster(); } catch (e) { return fail('ทะเบียนสินค้า', e); }
    }
    const m = matchSubject(q.subject, { lines: all, products, kinds });
    if (m.choices.length) return { text: `"${q.subject}" ตรงหลายรายการ — เลือกตัวที่หมายถึง:`, choices: m.choices, more: m.more, retext: text };
    if (!m.pick) return NOT_UNDERSTOOD(`ไม่พบ${kinds.includes('part') ? 'ไลน์หรือพาร์ท' : 'ไลน์'}ชื่อ "${q.subject}"`);
    pick = m.pick;
  }
  /* ยอดผลิตต้องมีชื่อพาร์ทกำกับ MAT — กดเลือกจากปุ่ม (forced) จะข้ามขั้นค้นชื่อที่โหลดทะเบียนไว้
     โหลดไม่ได้ = ยังตอบยอดได้ แค่ไม่มีชื่อกำกับ (ยอดมาจากใบผลิต ไม่ได้พึ่งทะเบียนสินค้า) */
  if (q.intent === 'production' && !products.length) {
    try { products = await loadProductsMaster(); } catch { products = []; }
  }

  if (q.intent !== 'downtime_top' && !pick) {
    return { text: `ระบุ${q.intent === 'production' ? 'ไลน์หรือพาร์ท' : 'ไลน์'}ด้วย เช่น "${q.intent === 'oee' ? 'oee HDF1 วันนี้' : 'ยอดผลิต HDF1 เดือนนี้'}"` };
  }
  if (pick?.kind === 'line' && vis.names && !vis.names.has(pick.name)
      && !selfAndDescendants(all, pick.name).some(n => vis.names.has(n))) {
    return { text: `ไลน์ ${pick.name} อยู่นอกขอบเขตที่บัญชีนี้เห็น — ถามได้เฉพาะไลน์ในขอบเขต (ตั้งที่ /add-user)` };
  }

  let ans;
  try {
    if (q.intent === 'oee') ans = await toolOee({ lineName: pick.name, period, all, vis });
    else if (q.intent === 'downtime_top') ans = await toolDowntime({ lineName: pick?.kind === 'line' ? pick.name : null, period, all, vis });
    else ans = await toolProduction({ pick, period, all, vis, products });
  } catch (e) { return fail('ข้อมูล', e); }
  const notes = [...(ans.notes || []), periodNote,
    vis.unsure ? '⚠️ ระบบตัดขอบเขตไลน์ของบัญชีนี้ได้ไม่ชัด — ตัวเลขอาจรวมไลน์นอกขอบเขต' : null].filter(Boolean);
  return { ...ans, notes };
}
