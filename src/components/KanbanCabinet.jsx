import { useState, useEffect, useMemo, useCallback, useContext } from 'react';
import QRCode from 'qrcode';
import { supabase, supabaseDR } from '../supabaseClient';
import { UserContext } from '../App';
import { toast } from './Toast';
import NoticeBar from './NoticeBar';
import MatLabel from './MatLabel';
import LineSelect from './LineSelect';
import { can } from '../utils/permissions';
import { checkWriteRows, checkWrite } from '../utils/dbWrite';
import { canWriteLine, writeBlockText } from '../utils/writeScope';
import { loadLinesRes } from '../utils/useProductionLines';
import { sortLineNames } from '../utils/lineHierarchy';
import { buildQrPayload } from '../utils/qrCode';
import { fetchAllPages } from '../utils/fetchByIds';
import { CARD_STATES, nextCardState, canMoveCard, pickWalkOrder, cabinetSummary,
  planCards, suggestFifo, linePartKey } from '../utils/kanbanCard';
/* 🔴 ไฟล์ไหน insert `wip_replenish_requests` ต้องเรียก `isFgMat` ในไฟล์เดียวกัน (มีด่าน)
   — FG (เลข 1xx) เก็บที่คลังสินค้ารอขาย ไม่มีการเบิกเข้าไลน์ */
import { isFgMat, FG_NO_LINE_REQUEST } from '../utils/storeOps';
import useTabParam from '../utils/useTabParam';
import { tr } from '../utils/i18n';
import { askConfirm } from '../utils/askConfirm';

/* ══ 🎴 ตู้ e-Kanban — ใบคัมบังบนจอ แทนใบที่ต้องวนกลับสโตร์ (2026-11-25 · คำสั่ง user) ═══
   user: *"ไม่ต้องมีการส่งใบจริง ใช้การสแกนผ่านจอได้เลย"* · *"อยากลดการเดินของพนักงาน"*

   🔴 แทนเฉพาะ **ใบ PW KANBAN ที่วนกลับสโตร์** — **แท็ก one-way จาก SAP ที่ติดกล่อง ไม่แตะ**
     (บอกว่ากล่องนี้คือพาร์ทอะไร · ไปกับของ ไม่วนกลับ) ⇒ ห้ามทำป้ายติดกล่องชุดที่ 2

   2 มุมมองในแผงเดียว เพราะเป็นคนละงานของคนละคน:
     🏭 **มุมไลน์**  — ใบของไลน์ตัวเอง · กด "ใช้หมดแล้ว" = วางการ์ดขึ้นตู้ (ไม่ต้องเดินไปตู้จริง)
     🏬 **มุมสโตร์** — ใบในตู้ของ *ทุกไลน์* **เรียงตามโซนหยิบ** ⇒ เดินรอบเดียวครบ (ไม่ต้องเดินเก็บการ์ด)

   🔴 ตัวเลข/การตัดสินทุกตัวมาจาก `src/utils/kanbanCard.js` — ห้ามคิดเองในไฟล์นี้
   🔴 สิทธิ์: ไลน์กด = `wip_request:receive` · สโตร์กด = `wip_request:decide` (คีย์เดิม ไม่เพิ่มใหม่)
      + ชั้น ③ `canWriteLine()` **ในฟังก์ชันที่เขียน DB จริง** ไม่ใช่แค่ซ่อนปุ่ม
   📄 docs/modules/kanban-auto-calc.md §e-Kanban
   ══════════════════════════════════════════════════════════════════════════════ */

const card = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 16 };
const btn = (bg, color = '#fff') => ({ padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
  fontSize: 13, fontWeight: 700, background: bg, color, fontFamily: 'var(--font-body)' });
const n0 = (v) => (Number(v) || 0).toLocaleString();

/* ── ใบ e-kanban 1 ใบ — ช่องเดียวกับใบจริง (MAT · PART NO · QTY/PACK · FROM/TO · QR) ── */
/* 🔴🔴 การ์ดในกริด **ห้ามมี QR** (2026-11-26 · user ทัก "กล้องจะเห็นหลาย QR พร้อมกัน แล้วจะยิงถูกมั้ย")
   กล้อง/เครื่องยิงเห็นหลายโค้ดในเฟรมเดียว = **ล็อกอันไหนก็ได้ ทำนายไม่ได้** ⇒ ยิงผิดใบเงียบๆ
   ⇒ QR โผล่ได้เฉพาะ **ใบเดี่ยว** (กดการ์ดแล้วเปิด) ซึ่งมีโค้ดเดียวในจอ
   (ที่ใส่ไว้ทุกใบตอนแรกเพราะเลียนแบบใบกระดาษ โดยไม่ได้ถามว่า "ใครจะยิงมัน") */
function CardFace({ c, onOpen, onAct, acting, actLabel, canAct, suggested }) {
  const meta = CARD_STATES[c.state] || {};
  return (
    <div style={{ border: `2px solid ${meta.color || 'var(--border)'}`, borderRadius: 10, padding: 10,
      background: 'var(--bg2-surf)', display: 'grid', gap: 6, alignContent: 'start' }}>
      <button type="button" onClick={() => onOpen(c)} title={tr('เปิดใบเดี่ยว (มี QR ให้ยิง)')}
        style={{ ...btn('var(--bg3)', 'var(--text)'), fontSize: 11, padding: '4px 8px', justifySelf: 'start' }}>
        🔍 {tr('เปิดใบ + QR')}
      </button>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <b style={{ fontSize: 13 }}>{c.card_no}</b>
        <span style={{ fontSize: 11, fontWeight: 700, color: meta.color || 'var(--muted)' }}>{tr(meta.label || c.state)}</span>
      </div>
      <MatLabel mat={c.mat_no} name={c.part_name} />
      <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
        {tr('ใบที่')} {c.seq}{c.total_cards ? `/${c.total_cards}` : ''} · {n0(c.qty_per_card)} {tr('ชิ้น/กล่อง')}
        <div>{c.from_location || tr('— ยังไม่ตั้งต้นทาง —')} → <b>{c.line_name}</b></div>
      </div>
      {/* 🔴 ระบบเสนอ คนตัดสิน — ข้อเสนอขึ้นเป็นข้อความ ไม่เปลี่ยนสถานะให้เอง */}
      {(suggested || c.suggested_at) && c.state === 'at_line' && (
        <div style={{ fontSize: 11, color: 'var(--amber)', fontWeight: 700 }}>
          🤖 {tr('ระบบเสนอว่าน่าจะหมดแล้ว')}{c.suggest_reason ? ` · ${c.suggest_reason}` : ''}
        </div>
      )}
      {canAct && (
        <button type="button" disabled={acting} onClick={() => onAct(c)}
          style={{ ...btn(meta.color || 'var(--accent)'), opacity: acting ? 0.6 : 1 }}>
          {acting ? tr('กำลังบันทึก…') : actLabel}
        </button>
      )}
    </div>
  );
}

/* ใบเดี่ยว — **QR อันเดียวในจอ** ขนาดใหญ่พอให้ยิงจากระยะปกติ */
function CardSheet({ c, qr, onClose }) {
  const meta = CARD_STATES[c.state] || {};
  return (
    <div onClick={onClose} role="presentation"
      /* 🔴 modal เต็มจอต้อง zIndex 2000 (เท่า .overlay ใน index.css) — ต่ำกว่านั้นกระดิ่งแจ้งเตือน
         มุมขวาบน (App.jsx zIndex 1200) ทับปุ่มปิด ✕ (ด่าน scrim-modal-above-bell · user ทัก 16/11) */
      style={{ position: 'fixed', inset: 0, background: 'var(--scrim)', backdropFilter: 'var(--scrim-blur)',
        display: 'grid', placeItems: 'center', zIndex: 2000, padding: 16 }}>
      <div onClick={e => e.stopPropagation()} role="presentation"
        style={{ background: 'var(--card)', border: `3px solid ${meta.color || 'var(--border)'}`, borderRadius: 12,
          padding: 20, maxWidth: 380, width: '100%', display: 'grid', gap: 10, justifyItems: 'center',
          boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 1 }}>{c.card_no}</div>
        <MatLabel mat={c.mat_no} name={c.part_name} />
        <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.7 }}>
          {tr('ใบที่')} {c.seq}{c.total_cards ? `/${c.total_cards}` : ''} · {n0(c.qty_per_card)} {tr('ชิ้น/กล่อง')}
          <div>{c.from_location || tr('— ยังไม่ตั้งต้นทาง —')} → <b>{c.line_name}</b></div>
          <div style={{ color: meta.color }}>{tr(meta.label || c.state)}</div>
        </div>
        {qr
          ? <img src={qr} alt={`QR ${c.card_no}`} width={220} height={220} />
          : <div style={{ fontSize: 12, color: 'var(--amber)' }}>⚠️ {tr('วาด QR ไม่ได้ — ใช้เลขใบด้านบนแทน')}</div>}
        <button type="button" onClick={onClose} style={btn('var(--bg3)', 'var(--text)')}>{tr('ปิด')}</button>
      </div>
    </div>
  );
}

export default function KanbanCabinet({ role }) {
  const { fullName, section: homeSection, sections: mySections, allUnits, respCostCenters, scopeIdx } = useContext(UserContext);
  const wctx = useMemo(() => ({ role, section: homeSection, sections: mySections, allUnits, respCostCenters, scopeIdx }),
    [role, homeSection, mySections, allUnits, respCostCenters, scopeIdx]);
  const canLine  = can('wip_request', 'receive', role);   // ไลน์: "ใช้หมดแล้ว" · "ถึงไลน์แล้ว"
  const canStore = can('wip_request', 'decide', role);    // สโตร์: รับคิว · ออกเดินส่ง

  /* 🔴 มุมมองย่อยผูก URL — หน้าแม่ถือ `?view=` อยู่แล้ว ⇒ ตัวนี้ใช้ `?kb=` คนละ param
     (UI §6.8 ข้อ 2.4 แท็บซ้อนแท็บต้องคนละ query param) · แชร์ลิงก์ตรงมุมที่ดูอยู่ได้ */
  const [view, setView] = useTabParam(['store', 'line', 'issue'], 'store', 'kb');
  const [cards, setCards] = useState(null);      // null = ยังไม่รู้ (อ่านไม่ได้/ยังไม่โหลด) ห้ามแปลว่าว่าง
  const [lines, setLines] = useState([]);
  const [lineFilter, setLineFilter] = useState('');
  const [loadFail, setLoadFail] = useState('');
  const [qrs, setQrs] = useState({});
  const [acting, setActing] = useState('');
  const [stds, setStds] = useState([]);        // kanban_standards — จำนวนใบ + ชิ้นต่อใบ
  const [levels, setLevels] = useState([]);    // line_part_levels — พาร์ทนี้อยู่ไลน์ไหน
  const [homeSloc, setHomeSloc] = useState({});// mat → parts_master.home_sloc (ที่ของนอนจริงในสโตร์)
  const [usedBy, setUsedBy] = useState({});    // (ไลน์,พาร์ท) → [{ at, qty }] ยอดที่ถูกใช้
  const [issuing, setIssuing] = useState(false);
  const [openCard, setOpenCard] = useState(null);   // ใบเดี่ยวที่กางอยู่ (QR อันเดียวในจอ)

  const load = useCallback(async () => {
    /* ⏱️ ยอดที่ถูกใช้ — ย้อน 30 วันพอ (ใบที่อยู่ที่ไลน์นานกว่านั้น = ไลน์ไม่เดิน ไม่ต้องเสนอ)
       เลือกเฉพาะคอลัมน์ที่ใช้ · egress คิดเป็นไบต์ (db-write-rules ข้อ 11) */
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const [cr, pl, st, lv, pm, cs] = await Promise.all([
      fetchAllPages(() => supabaseDR.from('kanban_cards')
        .select('id, card_no, mat_no, line_name, from_location, qty_per_card, seq, total_cards, state, state_at, suggested_at, suggest_reason')
        .eq('is_active', true), { orderBy: ['line_name', 'mat_no', 'seq'] }),
      loadLinesRes(),
      supabaseDR.from('kanban_standards').select('mat_no, part_name, qty_per_kanban, total_kanban').eq('is_active', true),
      supabaseDR.from('line_part_levels').select('line_name, mat_no, is_active'),
      /* 🔴 "ของนอนอยู่โซนไหนในสโตร์" = `parts_master.home_sloc` เท่านั้น
         ห้ามใช้ `slocCodeOfLine()` (นั่นคือ SLoc ของไลน์ปลายทาง คนละเรื่อง · มีด่าน store-area-via-home-sloc) */
      supabaseDR.from('parts_master').select('mat_no, home_sloc'),
      fetchAllPages(() => supabaseDR.from('line_stock_transactions')
        .select('line_name, mat_no, qty, created_at')
        .eq('type', 'consume').eq('status', 'approved').gte('created_at', since), { orderBy: 'created_at' }),
    ]);
    /* 🔴 ห้ามกลืน error — อ่านไม่ได้แล้วโชว์ "ไม่มีใบ" คือจอโกหก */
    const err = cr.error || pl.error || st.error || lv.error || pm.error || cs.error;
    if (err) { setLoadFail(String(err)); setCards(null); return; }
    setLoadFail(''); setCards(cr.rows); setLines(pl.data || []);
    setStds(st.data || []);
    setLevels((lv.data || []).filter(l => l.is_active !== false));
    setHomeSloc(Object.fromEntries((pm.data || []).map(r => [String(r.mat_no), r.home_sloc || null])));
    const u = {};
    (cs.rows || []).forEach(t => {
      const k = linePartKey(t.line_name, t.mat_no);
      (u[k] = u[k] || []).push({ at: t.created_at, qty: Math.abs(parseFloat(t.qty) || 0) });
    });
    setUsedBy(u);
  }, []);
  useEffect(() => { load(); }, [load]);

  /* QR ของใบ = ESM:K:<uuid> (ไม่ใช่เลขใบ — เลขใบเปลี่ยนได้ตอนทะเบียนปรับจำนวน)
     🔴 วาด **เฉพาะใบที่กางอยู่ใบเดียว** — กริดไม่มี QR เพราะกล้องจะเห็นหลายโค้ดพร้อมกันแล้วยิงผิดใบ */
  useEffect(() => {
    let alive = true;
    const id = openCard?.id;
    if (!id || qrs[id]) return undefined;
    (async () => {
      let url = null;
      try { url = await QRCode.toDataURL(buildQrPayload('card', id), { width: 440, margin: 1 }); } catch { url = null; }
      if (alive && url) setQrs(q => ({ ...q, [id]: url }));
    })();
    return () => { alive = false; };
  }, [openCard, qrs]);

  /* 🔴 ลิสต์ชื่อไลน์ผ่าน `sortLineNames` เท่านั้น — `.sort()` ดิบ = แต่ละหน้าเรียงคนละแบบ (มีด่าน) */
  const lineNames = useMemo(
    () => sortLineNames([...new Set((cards || []).map(c => c.line_name))].filter(Boolean), lines),
    [cards, lines]);
  /* ชื่อที่ไม่อยู่ในทะเบียนไลน์ (คลัง/ชื่อเก่า) ต้องยังเลือกได้ ไม่งั้นใบของมันเปิดไม่ขึ้น */
  const extraNames = useMemo(
    () => lineNames.filter(n => !lines.some(l => l.name === n)),
    [lineNames, lines]);

  /* ② ระบบเสนอ (FIFO) — คิดสดทุกครั้ง ไม่เขียนกลับ DB
     🔴 ยอดที่นับ = consume ที่ไลน์นั้นของพาร์ทนั้น **ตั้งแต่ใบเก่าสุดที่ยังอยู่ที่ไลน์มาถึง**
        (ใบเดียวกันอาจมาถึงคนละเวลา ⇒ นับจากใบเก่าสุด แล้วแปลงเป็น "กี่กล่อง" ใน suggestFifo) */
  const suggestIds = useMemo(() => {
    const out = new Set();
    const byPair = new Map();
    (cards || []).forEach(c => {
      const k = linePartKey(c.line_name, c.mat_no);
      (byPair.get(k) || byPair.set(k, []).get(k)).push(c);
    });
    byPair.forEach((list, k) => {
      const atLine = list.filter(c => c.state === 'at_line');
      if (!atLine.length) return;
      const from = atLine.map(c => c.state_at).filter(Boolean).sort()[0];
      /* ไม่รู้ว่าใบมาถึงเมื่อไหร่ = นับยอดไม่ได้ ⇒ ส่ง null ให้ suggestFifo ตอบ "เสนอไม่ได้" */
      const rows = from ? (usedBy[k] || []).filter(r => r.at > from) : null;
      const used = rows ? rows.reduce((a, r) => a + r.qty, 0) : null;
      suggestFifo({ cards: list, consumedQty: used }).ids.forEach(id => out.add(id));
    });
    return out;
  }, [cards, usedBy]);

  /* เติม "โซนหยิบ" ให้ใบจาก home_sloc ของพาร์ท (ใบเก่าที่ยังไม่มี from_location ก็ได้โซน) */
  const zoneOf = useCallback((c) => c?.from_location || homeSloc[String(c?.mat_no)] || null, [homeSloc]);

  /* 🔴 `kanban_cards` ไม่เก็บ `part_name` โดยตั้งใจ — ชื่อชิ้นงานเปลี่ยนที่ทะเบียนที่เดียว
     ถ้าคัดลอกลงใบ ใบเก่าจะค้างชื่อเดิมตลอดไป ⇒ เติมตอนแสดงผลจาก `kanban_standards` */
  const nameOf = useCallback((mat) => stds.find(r => String(r.mat_no) === String(mat))?.part_name || null, [stds]);
  const withName = useCallback((list) => (list || []).map(c => ({ ...c, part_name: nameOf(c.mat_no) })), [nameOf]);

  const inBox = useMemo(() => (cards || []).filter(c => c.state === 'in_box'), [cards]);
  const walk  = useMemo(() => pickWalkOrder(withName(inBox), zoneOf), [inBox, zoneOf, withName]);

  /* ① ใบที่ยังไม่ได้ออก — ทะเบียน (line_part_levels × kanban_standards) เทียบกับใบที่มีจริง */
  const issuePlan = useMemo(() => {
    const stdOf = new Map(stds.map(r => [String(r.mat_no), r]));
    const byPair = new Map();
    (cards || []).forEach(c => {
      const k = linePartKey(c.line_name, c.mat_no);
      (byPair.get(k) || byPair.set(k, []).get(k)).push(c);
    });
    /* ใบทั้งหมดของพาร์ทนั้น (ทุกไลน์) — ใช้เดินลำดับไม่ให้เลขใบชนกันข้ามไลน์ */
    const byMat = new Map();
    (cards || []).forEach(c => {
      const m = String(c.mat_no);
      (byMat.get(m) || byMat.set(m, []).get(m)).push(c);
    });
    /* พาร์ทนี้ถูกตั้งไว้กี่ไลน์ — มากกว่า 1 = ทะเบียนไม่ได้บอกว่าไลน์ละกี่ใบ ⇒ ออกใบไม่ได้ */
    const linesPerMat = new Map();
    levels.forEach(l => {
      const m = String(l.mat_no ?? '');
      (linesPerMat.get(m) || linesPerMat.set(m, new Set()).get(m)).add(String(l.line_name ?? '').trim());
    });
    const rows = [];
    levels.forEach(l => {
      const mat = String(l.mat_no ?? '');
      const std = stdOf.get(mat);
      const k = linePartKey(l.line_name, mat);
      const r = planCards({ matNo: mat, lineName: l.line_name,
        totalCards: std?.total_kanban ?? null, qtyPerCard: std?.qty_per_kanban ?? null,
        fromLocation: homeSloc[mat] || null, existing: byPair.get(k) || [],
        matCards: byMat.get(mat) || [],
        otherLines: Math.max(0, (linesPerMat.get(mat)?.size || 1) - 1) });
      if (!r.ok) { rows.push({ k, mat, line: l.line_name, part_name: std?.part_name || null, blocked: r.why }); return; }
      if (r.toCreate.length || r.toRetire.length) {
        rows.push({ k, mat, line: l.line_name, part_name: std?.part_name || null,
          create: r.toCreate, retire: r.toRetire, keep: r.keep });
      }
    });
    return rows;
  }, [levels, stds, cards, homeSloc]);
  const lineCards = useMemo(
    () => (lineFilter ? withName((cards || []).filter(c => c.line_name === lineFilter)) : []),
    [cards, lineFilter, withName]);
  const sum = useMemo(() => cabinetSummary(lineFilter ? lineCards : cards), [cards, lineCards, lineFilter]);

  /* ── เดินใบไปขั้นถัดไป ─────────────────────────────────────────────────────── */
  const advance = async (c) => {
    const to = nextCardState(c.state);
    const mv = canMoveCard(c.state, to);
    if (!mv.ok) { toast.error(mv.why); return; }
    /* 🔐 ชั้น ③ — ใบนี้เป็นของไลน์หน่วยงานเราไหม (เช็คตรงที่เขียน DB ไม่ใช่แค่ซ่อนปุ่ม) */
    const w = canWriteLine(wctx, c.line_name, lines);
    if (!w.ok) { toast.error(writeBlockText(w, { what: `${tr('ใบคัมบังของ')} ${c.line_name}` })); return; }
    if (!await askConfirm(`${tr('ย้ายใบ')} ${c.card_no} → ${tr(CARD_STATES[to]?.label || to)}?`
      + `\n${c.mat_no} · ${n0(c.qty_per_card)} ${tr('ชิ้น')} · ${c.line_name}`
      + `\n\n${tr('ในนาม')} ${fullName || '—'}`)) return;

    setActing(c.id);
    /* 🔴 compare-and-swap: ย้ายได้ต่อเมื่อใบยังอยู่สถานะเดิมจริง (คนอื่นอาจกดไปแล้ว)
       นับแถวด้วย — RLS ปฏิเสธ UPDATE = "สำเร็จ 0 แถว ไม่มี error" */
    const moved = checkWriteRows(await supabaseDR.from('kanban_cards')
      .update({ state: to, state_by: fullName || null, updated_by_name: fullName || null,
        ...(to === 'in_box' ? {} : { suggested_at: null, suggest_reason: null }) })
      .eq('id', c.id).eq('state', c.state).select('id'), 'ย้ายใบคัมบัง');
    if (!moved) { setActing(''); load(); return; }

    /* ③ ใบขึ้นตู้ = สัญญาณเบิก ⇒ เปิด "ใบขอเติม" ใบเดิมของระบบด้วย
       🔴 ไม่งั้นสโตร์ต้องดู 2 ที่ · ใบขอเติมอยู่ **Main** (`supabase`) ไม่ใช่ DR
       🔴 FG (เลข 1xx) ไม่มีการเบิกเข้าไลน์ — ข้าม แล้วบอกบนจอ ห้ามเงียบ */
    let slipId = null;
    if (to === 'in_box') {
      if (isFgMat(c.mat_no)) {
        toast.info(`${tr('ใบขึ้นตู้แล้ว แต่ไม่ได้เปิดใบขอเติม')} — ${tr(FG_NO_LINE_REQUEST)}`);
      } else {
        const slip = await supabase.from('wip_replenish_requests').insert({
          line_name: c.line_name, mat_no: c.mat_no, part_name: c.part_name || null,
          request_qty: Number(c.qty_per_card) || null, status: 'pending',
          requested_at: new Date().toISOString(), requested_by: fullName || 'e-kanban',
          source: 'ekanban', storage_location: zoneOf(c) || null,
        }).select('id').maybeSingle();
        if (slip.error) {
          /* 🔴 ใบขึ้นตู้ไปแล้ว (สถานะเปลี่ยนแล้ว) แต่ใบขอเติมไม่เกิด — ต้องบอกให้ไปเปิดมือ ห้ามเงียบ */
          toast.error(`⚠️ ${tr('ใบขึ้นตู้แล้ว แต่เปิดใบขอเติมไม่สำเร็จ')} — ${tr('ให้สโตร์เปิดใบเองที่')} /line-stock · ${slip.error.message || slip.error}`);
        } else slipId = slip.data?.id || null;
      }
    }

    /* ledger — ล้มก็ไม่ย้อนสถานะ แต่ต้องบอก ไม่ใช่เงียบ */
    checkWrite(await supabaseDR.from('kanban_card_events')
      .insert({ card_id: c.id, from_state: c.state, to_state: to, source: 'manual',
        by_name: fullName || null, ref_id: slipId }),
      'บันทึกประวัติใบคัมบัง');
    setActing('');
    toast.success(`✅ ${c.card_no} → ${tr(CARD_STATES[to]?.label || to)}`
      + (slipId ? ` · ${tr('เปิดใบขอเติมให้แล้ว')}` : ''));
    load();
  };

  /* ① ออกใบตามทะเบียน — "ระบบเสนอ คนกดออก" · ใบคือของจริงที่หมุนอยู่ จึงไม่ออกให้เองอัตโนมัติ */
  const issueFor = async (row) => {
    if (!row?.create?.length) return;
    const w = canWriteLine(wctx, row.line, lines);
    if (!w.ok) { toast.error(writeBlockText(w, { what: `${tr('ใบคัมบังของ')} ${row.line}` })); return; }
    if (!await askConfirm(`${tr('ออกใบคัมบัง')} ${row.create.length} ${tr('ใบ')}?`
      + `\n${row.mat} · ${row.line} · ${n0(row.create[0].qty_per_card)} ${tr('ชิ้น/กล่อง')}`
      + `\n${tr('โซนหยิบ')}: ${row.create[0].from_location || tr('— ยังไม่ตั้ง (จะไปท้ายคิวหยิบ) —')}`
      + `\n\n${tr('ในนาม')} ${fullName || '—'}`)) return;
    setIssuing(true);
    const rows = row.create.map(c => ({ ...c, state_by: fullName || null, updated_by_name: fullName || null }));
    const ok = checkWriteRows(await supabaseDR.from('kanban_cards').insert(rows).select('id'), 'ออกใบคัมบัง');
    setIssuing(false);
    if (ok) { toast.success(`✅ ${tr('ออกใบแล้ว')} ${rows.length} ${tr('ใบ')}`); load(); }
  };

  const actOf = (c) => {
    const meta = CARD_STATES[c.state] || {};
    const isStoreStep = c.state === 'in_box' || c.state === 'picking';
    return { label: tr(meta.act || 'ถัดไป'), allowed: isStoreStep ? canStore : canLine };
  };

  /* ── จอ ─────────────────────────────────────────────────────────────────────── */
  if (loadFail) return (
    <div style={card}>
      <NoticeBar tone="bad"><b>{tr('อ่านใบคัมบังไม่ได้')}</b> · {tr('ยังบอกไม่ได้ว่ามีใบค้างกี่ใบ — ลองโหลดหน้าใหม่')}</NoticeBar>
    </div>
  );
  if (cards === null) return <div style={{ ...card, textAlign: 'center', color: 'var(--muted)' }}>{tr('กำลังโหลด…')}</div>;

  return (
    <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
      {openCard && <CardSheet c={openCard} qr={qrs[openCard.id]} onClose={() => setOpenCard(null)} />}
      <div style={card}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>🎴 {tr('ตู้ e-Kanban')}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={() => setView('store')}
              style={btn(view === 'store' ? 'var(--accent)' : 'var(--bg3)', view === 'store' ? '#fff' : 'var(--text)')}>
              🏬 {tr('คิวหยิบของสโตร์')}{walk.rows.length ? ` (${walk.rows.length})` : ''}
            </button>
            <button type="button" onClick={() => setView('line')}
              style={btn(view === 'line' ? 'var(--accent)' : 'var(--bg3)', view === 'line' ? '#fff' : 'var(--text)')}>
              🏭 {tr('ใบของไลน์')}
            </button>
            <button type="button" onClick={() => setView('issue')}
              style={btn(view === 'issue' ? 'var(--accent)' : 'var(--bg3)', view === 'issue' ? '#fff' : 'var(--text)')}>
              🧾 {tr('ออกใบ')}{issuePlan.some(r => r.create?.length) ? ` (${issuePlan.filter(r => r.create?.length).length})` : ''}
            </button>
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, marginTop: 8 }}>
          {tr('ใบนี้แทน')} <b>{tr('ใบคัมบังที่ต้องวนกลับสโตร์')}</b> {tr('เท่านั้น — แท็ก one-way จาก SAP ที่ติดกล่องยังใช้เหมือนเดิม')}
        </div>
        {!cards.length && (
          <NoticeBar tone="info" style={{ marginTop: 10 }}>
            <b>{tr('ยังไม่มีใบคัมบังในระบบ')}</b> · {tr('ต้องออกใบจากทะเบียน kanban_standards ก่อน (จำนวนใบ + ชิ้นต่อใบ)')}
          </NoticeBar>
        )}
      </div>

      {view === 'issue' ? (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>🧾 {tr('ออกใบตามทะเบียน')}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
            {tr('จำนวนใบมาจาก')} <b>kanban_standards</b> ({tr('จำนวนใบ')} × {tr('ชิ้นต่อใบ')}) · {tr('พาร์ทอยู่ไลน์ไหนมาจาก')} <b>line_part_levels</b>
            <div>🔴 {tr('ระบบเสนอ คนกดออก — ใบคือกล่องจริงที่หมุนอยู่ ระบบจึงไม่ออก/ไม่ลบให้เอง')}</div>
          </div>
          {!issuePlan.length ? (
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 10 }}>
              {tr('ไม่มีอะไรต้องออกเพิ่ม — ใบครบตามทะเบียนแล้ว')}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8, marginTop: 12, alignContent: 'start' }}>
              {issuePlan.map(r => (
                <div key={r.k} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
                  justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8,
                  background: 'var(--bg2-surf)', border: '1px solid var(--border)' }}>
                  <div style={{ minWidth: 0 }}>
                    <MatLabel mat={r.mat} name={r.part_name} />
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {r.line}
                      {r.create?.length ? <> · {tr('ยังไม่ได้ออก')} <b style={{ color: 'var(--amber)' }}>{r.create.length}</b> {tr('ใบ')}</> : null}
                      {r.retire?.length ? <> · {tr('ใบเกินทะเบียน')} <b style={{ color: 'var(--red)' }}>{r.retire.length}</b> {tr('ใบ')}</> : null}
                    </div>
                  </div>
                  {r.blocked ? (
                    <span style={{ fontSize: 11, color: 'var(--red)', fontWeight: 700 }}>⛔ {tr(r.blocked)}</span>
                  ) : r.create?.length ? (
                    <button type="button" disabled={issuing || !canStore} onClick={() => issueFor(r)}
                      style={{ ...btn('var(--accent)'), opacity: (issuing || !canStore) ? 0.6 : 1 }}>
                      {issuing ? tr('กำลังออก…') : `${tr('ออกใบ')} ${r.create.length} ${tr('ใบ')}`}
                    </button>
                  ) : (
                    /* 🔴 ใบเกินทะเบียน = เสนอให้คนไปถอนเอง ระบบไม่ลบให้ (ของจริงอาจยังมีกล่องหมุนอยู่) */
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{tr('ให้คนตรวจแล้วถอนใบเกินเอง')}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : view === 'store' ? (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>
            🏬 {tr('คิวหยิบ — เรียงตามโซนเพื่อเดินรอบเดียว')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
            {tr('ใบรอหยิบ')} <b>{walk.rows.length}</b> {tr('ใบ')} · {tr('กระจาย')} <b>{walk.zones}</b> {tr('โซน')}
            {sum?.oldestMin != null && <> · {tr('รอนานสุด')} <b>{n0(sum.oldestMin)}</b> {tr('นาที')}</>}
          </div>
          {walk.unknown > 0 && (
            <NoticeBar tone="warn" style={{ marginTop: 10 }}>
              <b>{walk.unknown} {tr('ใบยังไม่รู้โซนหยิบ')}</b> · {tr('อยู่ท้ายคิว — ตั้งต้นทางให้ใบพวกนี้ถึงจะจัดเส้นทางเดินได้ครบ')}
            </NoticeBar>
          )}
          {!walk.rows.length ? (
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 10 }}>{tr('ไม่มีใบรอหยิบ — ไลน์ยังไม่แจ้งว่าหมด')}</div>
          ) : (
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              marginTop: 12, alignContent: 'start' }}>
              {walk.rows.map(c => {
                const a = actOf(c);
                return <CardFace key={c.id} c={c} onOpen={setOpenCard} onAct={advance} acting={acting === c.id}
                  actLabel={a.label} canAct={a.allowed} suggested={suggestIds.has(c.id)} />;
              })}
            </div>
          )}
        </div>
      ) : (
        <div style={card}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>🏭 {tr('ใบของไลน์')}</div>
            {/* 🔴 ช่องเลือกไลน์ = picker กลาง `<LineSelect>` ห้ามวาด <select> เอง (UI §5.1.2) */}
            <LineSelect
              lines={lines} value={lineFilter} onChange={setLineFilter} role={role}
              placeholder={tr('— เลือกไลน์ —')}
              style={{ width: 260, padding: '6px 8px', borderRadius: 'var(--ctl-r)', border: '1px solid var(--border)',
                background: 'var(--bg2-surf)', color: 'var(--text)', fontSize: 13 }}
              extraGroups={extraNames.length ? [{ label: tr('อื่นๆ'), options: extraNames.map(n => ({ value: n })) }] : []}
            />
          </div>
          {!lineFilter ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>{tr('เลือกไลน์ก่อน แล้วใบของไลน์นั้นจะขึ้นให้ดู')}</div>
          ) : !lineCards.length ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>{tr('ไลน์นี้ยังไม่มีใบคัมบัง')}</div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 10 }}>
                {tr('ทั้งหมด')} <b>{lineCards.length}</b> {tr('ใบ')} · {tr('อยู่ในตู้รอสโตร์')} <b>{sum?.waiting ?? '—'}</b>
                {sum?.suggested ? <> · 🤖 {tr('ระบบเสนอให้ถอด')} <b>{sum.suggested}</b> {tr('ใบ')}</> : null}
              </div>
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', alignContent: 'start' }}>
                {lineCards.map(c => {
                  const a = actOf(c);
                  return <CardFace key={c.id} c={c} onOpen={setOpenCard} onAct={advance} acting={acting === c.id}
                    actLabel={a.label} canAct={a.allowed} suggested={suggestIds.has(c.id)} />;
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
