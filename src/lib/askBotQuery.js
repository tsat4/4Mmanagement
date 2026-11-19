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
import { supabase, supabaseDR } from '../supabaseClient';
import { loadProductionLines } from '../utils/useProductionLines';
import { loadProductsMaster } from '../utils/useProducts';
import { loadOpInfo } from '../utils/opItems';
import { lineScope } from '../utils/sectionScope';
import { getLineFamily, getAncestorNames } from '../utils/lineHierarchy';
import { fetchAllPages, fetchByIds } from '../utils/fetchByIds';
import { SESSION_STATUSES_LIVE } from '../utils/sessionStatus';
import { loadBreakPolicies } from '../utils/oeeMasters';
import { loadAffectsLanes, affectsLanesLoadFail } from '../utils/affectsLanes';
import { QBIN_EMBED } from '../utils/oee';
import { dtOpenKind } from '../utils/downtimeRules';
import { OPEN_MO_STATUSES } from '../utils/mtnStepPerm';
import {
  INTENTS, parseQuestion, defaultPeriod, matchSubject, oeeSummary, downtimeTop, productionTotals,
  rankLinesByOee, openDowntimeList, moOpenSummary, fourMPendingSummary, defectTop, attendanceSummary,
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
  /* กรองซ้ำฝั่งเบราว์เซอร์ — ขอบเขตคือด่านความเป็นส่วนตัวของข้อมูล ห้ามพึ่งตัวกรองคิวรีชั้นเดียว
     (เจอใน harness: ตัวกรอง .in() หลุด = ไลน์นอกขอบเขตโผล่ในอันดับ OEE ต่ำสุด) */
  if (lineNames) {
    const ok = new Set(lineNames);
    for (const r of [closed, open]) r.rows = r.rows.filter(x => !('line_name' in x) || ok.has(x.line_name));
  }
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
    const { closed, open } = await closedAndOpen(period, names, 'id, line_name');
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

/* ══ รอบ 2 (19/11) ══════════════════════════════════════════════════════ */

/** ชื่อไลน์ที่จะยิง: ระบุไลน์ = ตัวเอง+ลูก ∩ ขอบเขต · ไม่ระบุ = ขอบเขต (null = ทั้งโรงงาน) */
const scopeNames = (all, vis, lineName) => (lineName
  ? selfAndDescendants(all, lineName).filter(n => !vis.names || vis.names.has(n))
  : (vis.names ? [...vis.names] : null));
const whoText = (lineName, vis) => (lineName ? `ไลน์ ${lineName}`
  : vis.names ? `ทุกไลน์ในขอบเขตของคุณ (${vis.names.size} ไลน์)` : 'ทุกไลน์');
const inNames = (names) => (ln) => !names || names.includes(ln);

/* ── ไลน์ไหน OEE ต่ำสุด ── */
async function toolOeeLowest({ lineName, period, all, vis }) {
  const names = scopeNames(all, vis, lineName);
  const { closed, open } = await closedAndOpen(period, names,
    'id, work_date, line_name, shift, status, start_time, oee, oee_a, oee_p, oee_q, shift_min, actual_qty, qty_ng');
  if (closed.error || open.error) return fail('กะผลิต', closed.error || open.error);
  const [dt, breaks, affectsBy] = await Promise.all([
    fetchByIds(closed.rows.map(x => x.id), c => supabaseDR.from('downtime_logs').select(DT_COLS).in('session_id', c)),
    loadBreakPolicies().catch(() => null),
    loadAffectsLanes(),
  ]);
  if (dt.error || dt.truncated) return fail('รายการ downtime', dt.error || 'ข้อมูลเยอะเกินเพดาน — ลองช่วงสั้นลง');
  if (breaks == null) return fail('นโยบายเวลาพัก', 'โหลดไม่ได้ — คิดน้ำหนักกะไม่ได้ (ห้ามถือว่าไม่มีพัก)');
  const r = rankLinesByOee(closed.rows, dt.rows, breaks, { lines: all, affectsBy });
  const source = `OEE ต่ำสุด · ${whoText(lineName, vis)} · ${period.label} · กะที่ปิดแล้ว ${closed.rows.length} กะ`;
  const notes = [openNote(open.rows.length), r.noValue.length ? `ไลน์ที่ยังไม่มีค่า OEE ${r.noValue.length} ไลน์ — ไม่ติดอันดับ` : null].filter(Boolean);
  if (!r.ranked.length) return { source, text: 'ยังไม่มีกะที่ปิดแล้วพร้อมค่า OEE ในช่วงนี้', notes, link: '/oee-analytics' };
  return {
    source,
    text: r.ranked.slice(0, 5).map((e, i) => `${i + 1}. ${e.line} — ${fmtPct(e.oee)} (A ${fmtPct(e.a)} · P ${fmtPct(e.p)} · Q ${fmtPct(e.q)} · ${e.n} กะ)`).join('\n'),
    notes, link: '/oee-analytics',
  };
}

/* ── เครื่องหยุดตอนนี้ (เกณฑ์เดียวกับไซเรน: แถวเปิดค้าง · ตัดสินด้วย dtOpenKind) ── */
async function toolDownNow({ lineName, all, vis, nowMs }) {
  const names = scopeNames(all, vis, lineName);
  const { data, error } = await supabaseDR.from('downtime_logs')
    .select('id, machine_no, started_at, ended_at, duration_min, dr_downtime_types(name_th, category, planned_cap_min), production_sessions(line_name, status)')
    .is('duration_min', null).is('ended_at', null)
    /* cap-ok: แถวเปิดค้างทั้งโรงงานมีหลักหน่วย-สิบ (ไซเรนก็ดึงชุดนี้ทั้งก้อน) */
    .limit(500);
  if (error) return fail('รายการเครื่องหยุด', error);
  const ok = inNames(names);
  const rows = (data || []).filter(d => ok(d.production_sessions?.line_name));
  const r = openDowntimeList(rows, nowMs, d => dtOpenKind(d, d.production_sessions?.status ?? null));
  const source = `เครื่องหยุดตอนนี้ · ${whoText(lineName, vis)}`;
  const notes = [r.forgotten.length ? `⚠️ ไม่ได้ปิดรายการ ${r.forgotten.length} ใบ (กะปิดไปแล้วแต่แถวยังเปิดค้าง) — ไม่นับเป็นเครื่องหยุด ต้องไปตามปิด` : null,
    (data || []).length - rows.length ? `ซ่อน ${(data || []).length - rows.length} รายการที่อยู่ไลน์นอกขอบเขต` : null].filter(Boolean);
  if (!r.open.length) return { source, text: '✅ ตอนนี้ไม่มีเครื่องหยุดค้าง', notes, link: '/dashboard' };
  return {
    source,
    text: `🔴 หยุดอยู่ ${r.open.length} รายการ\n` + r.open.slice(0, 8).map(e => `· ${e.machine} (${e.line}) — ${e.type}${e.planned ? ' · ตามแผน' : ''} · ${e.min == null ? 'ไม่ทราบเวลาเริ่ม' : `${fmtInt(e.min)} นาที`}`).join('\n')
      + (r.open.length > 8 ? `\n· อีก ${r.open.length - 8} รายการ` : ''),
    notes, link: '/dashboard',
  };
}

/* ── ใบแจ้งซ่อม MO ค้าง (ชุดสถานะเปิด = OPEN_MO_STATUSES ที่เดียว) ── */
async function toolMoOpen({ lineName, all, vis, nowMs }) {
  const names = scopeNames(all, vis, lineName);
  const res = await fetchAllPages(() => {
    let q = supabaseDR.from('mtn_orders').select('id, status, line_name, created_at').in('status', OPEN_MO_STATUSES);
    if (lineName) q = q.in('line_name', names || []);
    return q;
  });
  if (res.error || res.truncated) return fail('ใบแจ้งซ่อม', res.error || 'ใบเยอะเกินเพดาน');
  /* ไม่ระบุไลน์ + ขอบเขตจำกัด: ใบไม่มีไลน์/ไลน์นอกขอบเขต = ซ่อน แต่บอกจำนวน */
  const rows = lineName ? res.rows : res.rows.filter(o => inNames(names)(o.line_name));
  const hidden = res.rows.length - rows.length;
  const r = moOpenSummary(rows, nowMs);
  const source = `ใบแจ้งซ่อม MO ที่ยังเปิด · ${whoText(lineName, vis)}`;
  const notes = [hidden ? `ซ่อน ${hidden} ใบที่อยู่ไลน์นอกขอบเขต/ไม่ระบุไลน์` : null,
    r.unknown ? `สถานะที่ระบบไม่รู้จัก ${r.unknown} ใบ — ไม่นับ` : null].filter(Boolean);
  if (!r.total) return { source, text: '✅ ไม่มีใบ MO ค้าง', notes, link: '/mtn-repair' };
  return {
    source,
    text: `ค้างทั้งหมด ${fmtInt(r.total)} ใบ\n` + r.list.map(e => `· ${e.label} — ${e.n} ใบ${e.oldestDays != null ? ` (เก่าสุด ${e.oldestDays} วัน)` : ''}`).join('\n'),
    notes, link: '/mtn-repair',
  };
}

/* ── 4M ค้างอนุมัติ (Main) ── */
async function toolFourM({ lineName, all, vis, today }) {
  const names = scopeNames(all, vis, lineName);
  const res = await fetchAllPages(() => {
    let q = supabase.from('four_m_logs').select('id, work_date, line_name, status, created_by, description').in('status', ['pending', 'pending_qa']);
    if (lineName) q = q.in('line_name', names || []);
    return q;
  });
  if (res.error || res.truncated) return fail('ใบ 4M', res.error || 'ใบเยอะเกินเพดาน');
  /* ใบไม่ระบุไลน์ = ของกลาง ให้เห็น (แบบเดียวกับ /dept-dashboard) */
  const rows = lineName ? res.rows : res.rows.filter(f => !f.line_name || inNames(names)(f.line_name));
  const hidden = res.rows.length - rows.length;
  const r = fourMPendingSummary(rows, today);
  const source = `4M รออนุมัติ · ${whoText(lineName, vis)}`;
  const notes = [hidden ? `ซ่อน ${hidden} ใบที่อยู่ไลน์นอกขอบเขต` : null,
    r.auto ? `ในนี้เป็นใบที่ระบบสร้างเอง ([Auto]) ${r.auto} ใบ` : null].filter(Boolean);
  if (!r.total) return { source, text: '✅ ไม่มี 4M ค้างอนุมัติ', notes, link: '/event-log' };
  return {
    source,
    text: `ค้าง ${r.total} ใบ — รอหัวหน้า ${r.pending} · รอ QA ${r.pending_qa}`
      + (r.oldestDays != null ? `\nเก่าสุด ${r.oldest} (${r.oldestDays} วัน)` : '')
      + (!lineName && r.topLines.length > 1 ? '\n' + r.topLines.map(([ln, n]) => `· ${ln} — ${n} ใบ`).join('\n') : ''),
    notes, link: '/event-log',
  };
}

/* ── ของเสียสูงสุด (กะที่ปิดแล้ว · ต้อง embed QBIN ไม่งั้นบอกของสงสัยรอ QA ไม่ได้) ── */
async function toolDefect({ lineName, period, all, vis }) {
  const names = scopeNames(all, vis, lineName);
  const { closed, open } = await closedAndOpen(period, names, 'id, line_name');
  if (closed.error || open.error) return fail('กะผลิต', closed.error || open.error);
  const df = await fetchByIds(closed.rows.map(s => s.id), c => supabaseDR.from('defect_logs')
    .select(`id, session_id, qty_ng, qty_suspect, is_trial, dr_defect_types(name_th, excl_from_q), ${QBIN_EMBED}`).in('session_id', c));
  if (df.error || df.truncated) return fail('รายการของเสีย', df.error || 'ข้อมูลเยอะเกินเพดาน — ลองช่วงสั้นลง');
  const r = defectTop(df.rows, 5);
  const source = `ของเสีย · ${whoText(lineName, vis)} · ${period.label} · กะที่ปิดแล้ว ${closed.rows.length} กะ`;
  const notes = [openNote(open.rows.length),
    r.vagueQty ? `ชี้เป้าไม่ได้ (อื่นๆ/ไม่ระบุ) ${fmtInt(r.vagueQty)} ชิ้น (${r.total ? Math.round(r.vagueQty / r.total * 100) : 0}%) — ไม่ติดอันดับ` : null,
    r.pending ? `⏳ ของสงสัยรอ QA ตัดสิน ${fmtInt(r.pending)} ชิ้น (รวมในยอดแล้ว · ยังไม่ใช่ของเสียจนกว่าจะตัดสิน)` : null].filter(Boolean);
  if (!r.total) return { source, text: 'ไม่มีของเสียในกะที่ปิดแล้วช่วงนี้', notes, link: '/qa' };
  return {
    source,
    text: (r.top.length ? r.top.map((e, i) => `${i + 1}. ${e.name} — ${fmtInt(e.qty)} ชิ้น`).join('\n') : 'ทุกรายการระบุอาการไม่ได้')
      + `\nรวม ${fmtInt(r.total)} ชิ้น · ${r.groups} อาการ`,
    notes, link: '/qa',
  };
}

/* ── มาทำงานกี่คน (สูตรเดียวกับ /dept-dashboard: พนักงาน active × บันทึกเช็คชื่อของวันนั้น) ── */
async function toolAttendance({ lineName, period, all, vis }) {
  if (period.from !== period.to) return { text: `ถามจำนวนคนได้ทีละวัน — เช่น "มาทำงานกี่คน วันนี้" หรือ "เมื่อวาน"` };
  const names = scopeNames(all, vis, lineName);
  const nameSet = names ? new Set(names) : null;
  const idToName = Object.fromEntries(all.map(l => [l.id, l.name]));
  const [emps, logs] = await Promise.all([
    fetchAllPages(() => supabase.from('employees').select('id, line_id').eq('is_active', true)),
    fetchAllPages(() => supabase.from('daily_production_logs').select('id, employee_id, is_present').eq('work_date', period.to)),
  ]);
  if (emps.error || logs.error || emps.truncated || logs.truncated) return fail('ข้อมูลพนักงาน/เช็คชื่อ', emps.error || logs.error || 'ข้อมูลเยอะเกินเพดาน');
  const r = attendanceSummary(emps.rows, logs.rows, (id) => { const n = idToName[id]; return n && (!nameSet || nameSet.has(n)) ? n : null; });
  const source = `เช็คชื่อ · ${whoText(lineName, vis)} · ${period.label}`;
  if (!r.head) return { source, text: 'ไม่พบพนักงานที่ผูกกับไลน์ในขอบเขตนี้', link: '/checkin' };
  return {
    source,
    text: `พนักงาน ${r.head} คน — มา ${r.in} · แจ้งว่าไม่มา ${r.out} · ยังไม่ได้เช็ค ${r.none}`
      + (!lineName && r.lines.length > 1 ? '\n' + r.lines.slice(0, 6).map(l => `· ${l.line} — มา ${l.in}/${l.head}${l.out ? ` · ไม่มา ${l.out}` : ''}${l.none ? ` · ยังไม่เช็ค ${l.none}` : ''}`).join('\n') : ''),
    notes: ['"ยังไม่ได้เช็ค" ≠ ขาดงาน — อาจเป็นคนกะดึกที่ยังไม่เข้ากะ'],
    link: '/checkin',
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
  const meta = INTENTS.find(i => i.key === q.intent);
  /* คำถาม "สถานะตอนนี้" (เครื่องหยุด/MO/4M) ไม่มีช่วงเวลา — พิมพ์ช่วงมาก็ไม่ใช้ แต่ต้องบอก */
  const timeless = !meta.defaultPeriod;
  const period = timeless ? null : (q.period || defaultPeriod(q.periodDefault, today));
  const periodNote = timeless ? (q.period ? 'คำถามนี้ดูสถานะ ณ ตอนนี้ — ไม่ได้ใช้ช่วงเวลาที่ระบุ' : null)
    : (q.period ? null : `ไม่ได้ระบุช่วงเวลา — ใช้ "${period.label}"`);

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

  if (meta.needSubject && !pick) {
    return { text: `ระบุ${q.intent === 'production' ? 'ไลน์หรือพาร์ท' : 'ไลน์'}ด้วย เช่น "${q.intent === 'oee' ? 'oee HDF1 วันนี้' : 'ยอดผลิต HDF1 เดือนนี้'}"` };
  }
  if (pick?.kind === 'line' && vis.names && !vis.names.has(pick.name)
      && !selfAndDescendants(all, pick.name).some(n => vis.names.has(n))) {
    return { text: `ไลน์ ${pick.name} อยู่นอกขอบเขตที่บัญชีนี้เห็น — ถามได้เฉพาะไลน์ในขอบเขต (ตั้งที่ /add-user)` };
  }

  const lineName = pick?.kind === 'line' ? pick.name : null;
  const nowMs = Date.now();
  let ans;
  try {
    switch (q.intent) {
      case 'oee':           ans = await toolOee({ lineName, period, all, vis }); break;
      case 'oee_lowest':    ans = await toolOeeLowest({ lineName, period, all, vis }); break;
      case 'downtime_top':  ans = await toolDowntime({ lineName, period, all, vis }); break;
      case 'down_now':      ans = await toolDownNow({ lineName, all, vis, nowMs }); break;
      case 'mo_open':       ans = await toolMoOpen({ lineName, all, vis, nowMs }); break;
      case 'fourm_pending': ans = await toolFourM({ lineName, all, vis, today }); break;
      case 'defect_top':    ans = await toolDefect({ lineName, period, all, vis }); break;
      case 'attendance':    ans = await toolAttendance({ lineName, period, all, vis }); break;
      default:              ans = await toolProduction({ pick, period, all, vis, products });
    }
  } catch (e) { return fail('ข้อมูล', e); }
  const notes = [...(ans.notes || []), periodNote,
    vis.unsure ? '⚠️ ระบบตัดขอบเขตไลน์ของบัญชีนี้ได้ไม่ชัด — ตัวเลขอาจรวมไลน์นอกขอบเขต' : null].filter(Boolean);
  return { ...ans, notes };
}
