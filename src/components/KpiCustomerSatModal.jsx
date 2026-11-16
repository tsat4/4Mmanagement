/* ══ 🤝 แยก Quality / Delivery ของ Customer (Internal) Satisfaction — จอกรอก + จอดูรายละเอียด ══════
   2026-11-16 · user: "customer sat ถ้าแยก Quality-Delivery ได้ ตอนกดเข้าไป รวมถึงตรงหน้าการกรอกข้อมูล"

   🔴 กติกาที่หน้านี้ต้องไม่ละเมิด (ทะเบียนกลาง `kpi_standard_items` — ห้ามคิดเอง):
     · หัวข้อนี้เป็น **1 KPI 1 คะแนน** · สูตร `(Actual Score / Total Score) x 100`
       ⇒ Q/D คือการแยก "ตัวตั้ง-ตัวหาร" ของสูตรเดิม **ไม่ใช่ KPI 2 ตัว ไม่มีคะแนนรายขา**
     · ค่ารวมที่ส่งกลุ่มยังเป็น `kpi_manual_entries.value` — หน้านี้**ไม่เขียนทับเอง**
       มีแค่ปุ่มให้คนกด "ใช้ค่าที่คำนวณได้" ทีละเดือน (กดแล้วเขียนค่ารวมผ่าน saveCell ของหน้าแม่)
     · ขาไม่ครบ = ไม่คิดค่ารวม **เขียนบนจอว่าไม่ครบ ห้ามโชว์ 0**
     · ค่ารวมที่กรอกไว้ ≠ ค่าที่คำนวณได้ ⇒ **ฟ้อง ห้ามแก้ให้เงียบๆ**
   สูตร/สถานะทั้งหมดอยู่ `src/utils/kpiCustomerSat.js` — ห้ามคำนวณซ้ำในไฟล์นี้
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CSAT_LEGS, CSAT_FORMULA, csatMonth, csatCoverage, isQdLabelled, satKindOf } from '../utils/kpiCustomerSat';
import { fmtKpi } from '../utils/kpiSetup';
import { tr } from '../utils/i18n';

const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const pct = (v, d = 2) => (v == null ? '—' : `${Number(v).toFixed(d)}%`);

const th = { padding: '4px 6px', fontSize: 11.5, fontWeight: 700, color: 'var(--text2)', borderBottom: '1px solid var(--border2)', whiteSpace: 'nowrap' };
const td = { padding: '3px 6px', fontSize: 12, textAlign: 'center', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' };

/* ช่องกรอกคะแนนดิบ — commit ตอน blur/Enter (ไม่ยิง DB ทุก keystroke · กติกาเดียวกับ CellInput ของ KpiMonthly) */
function ScoreInput({ value, onCommit, disabled, title }) {
  const [v, setV] = useState(value == null ? '' : String(value));
  useEffect(() => { setV(value == null ? '' : String(value)); }, [value]);
  return (
    <input value={v} disabled={disabled} title={title} inputMode="decimal"
      onChange={e => setV(e.target.value)}
      onBlur={() => onCommit(v.trim())}
      onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
      style={{ width: 52, padding: '2px 4px', fontSize: 12, textAlign: 'right', borderRadius: 'var(--ctl-r)',
        background: disabled ? 'transparent' : 'var(--bg2)', border: disabled ? '1px solid transparent' : '1px solid var(--border)',
        color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }} />
  );
}

/**
 * @param def           แถว kpi_definitions ของ KPI ตัวนั้น
 * @param byMonth       { [month]: { quality: row, delivery: row } } จาก indexCsatParts()
 * @param entries       { [month]: ค่ารวมที่กรอกไว้ }
 * @param canEdit       กรอกได้ไหม (สิทธิ์ + ขอบเขต ตัดสินที่หน้าแม่แล้ว)
 * @param blockText     เหตุที่กรอกไม่ได้ (ต้องเขียนบนจอ ห้ามซ่อนช่องเงียบ)
 * @param tableMissing  ยังไม่ได้ apply migration (42P01)
 * @param onSave        (month, part, { actual_score, total_score }) => Promise
 * @param onApplyTotal  (month, value) => Promise — เขียน "ค่ารวม" ที่ส่งกลุ่ม (คนกดเองเท่านั้น)
 */
export default function KpiCustomerSatModal({
  def, year, scopeText = '', byMonth = {}, entries = {}, canEdit = false, blockText = '',
  tableMissing = false, onSave, onApplyTotal, onClose,
}) {
  const [busy, setBusy] = useState('');
  const cov = csatCoverage(byMonth, entries);
  const qd = isQdLabelled(def);
  const kind = satKindOf(def);

  const commit = async (month, part, field, raw) => {
    const row = byMonth?.[month]?.[part] || null;
    const cur = row ? (field === 'actual_score' ? row.actual_score : row.total_score) : null;
    const next = raw === '' ? null : Number(raw);
    if (raw !== '' && !Number.isFinite(next)) return;
    if ((cur == null ? null : Number(cur)) === next) return;
    const payload = {
      actual_score: field === 'actual_score' ? next : (row?.actual_score ?? null),
      total_score:  field === 'total_score'  ? next : (row?.total_score  ?? null),
    };
    setBusy(`${month}:${part}`);
    try { await onSave?.(month, part, payload); } finally { setBusy(''); }
  };

  return createPortal(
    /* ฟอร์มกรอก → ปิดจาก backdrop ไม่ได้ (กฎ UI: กดพลาดแล้วค่าที่พิมพ์หาย) */
    <div className="modal-scroll" style={{ position: 'fixed', inset: 0, background: 'var(--scrim)', WebkitBackdropFilter: 'var(--scrim-blur)', backdropFilter: 'var(--scrim-blur)', zIndex: 2100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 14, overflow: 'auto' }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border2)', borderRadius: 'var(--r-lg)', padding: '14px 16px', width: 'min(960px, 97vw)', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
          <div>
            <b style={{ fontSize: 14.5, color: 'var(--text)' }}>✂️ {tr('แยกคะแนน Quality / Delivery')}</b>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>
              {def?.name || '—'} · {year + 543}{scopeText ? ` · ${scopeText}` : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--muted)', fontSize: 16, cursor: 'pointer' }}>✕</button>
        </div>

        {/* 🔴 บอกให้ชัดว่าทะเบียนกลางนิยามอะไรไว้ — กันคนเข้าใจว่านี่คือ KPI 2 ตัว */}
        <div className="card" style={{ padding: '8px 10px', marginBottom: 8, fontSize: 11.5, color: 'var(--text2)', borderLeft: '4px solid var(--accent)' }}>
          {tr('ทะเบียนมาตรฐานของกลุ่มมีหัวข้อนี้เป็น')} <b>{tr('1 ข้อ 1 คะแนน')}</b> {tr('สูตร')} <code>{CSAT_FORMULA}</code>
          {' — '}{tr('การแยก Q/D คือการแยกตัวตั้ง-ตัวหารของสูตรเดิม')} <b>{tr('ไม่ใช่ KPI 2 ตัว และไม่มีคะแนนรายขา')}</b>
          <div style={{ marginTop: 3 }}>
            {tr('ค่ารวมของเดือน')} = <b>{tr('(ผลรวม Actual ÷ ผลรวม Total) × 100')}</b>
            {' · '}<span style={{ color: 'var(--amber)' }}>{tr('ห้ามเฉลี่ย % ของ 2 ขา')}</span> {tr('(ตัวหารแต่ละขาไม่เท่ากัน)')}
          </div>
          {!qd && kind && (
            <div style={{ marginTop: 3, color: 'var(--amber)' }}>
              ⚠ {tr('ทะเบียนไม่ได้ติดป้าย (Q&D) กับหัวข้อนี้')}{kind === 'internal' ? tr(' (หน่วยสนับสนุนใช้ชื่อ Internal Satisfaction)') : ''}
              {' — '}{tr('แยกไว้ดูเองได้ แต่ค่าที่ส่งกลุ่มยังเป็นค่ารวมตัวเดียว')}
            </div>
          )}
        </div>

        {tableMissing && (
          <div className="card" style={{ padding: '8px 10px', marginBottom: 8, fontSize: 12, borderLeft: '4px solid var(--amber)', color: 'var(--amber)' }}>
            ⚠ {tr('ยังไม่ได้ apply migration')} <code>20261116c_kpi_customer_sat_parts_main.sql</code> (Main) — {tr('ยังกรอกแยกขาไม่ได้ · แจ้ง admin')}
          </div>
        )}
        {!canEdit && !!blockText && (
          <div className="card" style={{ padding: '8px 10px', marginBottom: 8, fontSize: 12, borderLeft: '4px solid var(--amber)' }}>🔒 {blockText}</div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 720 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left' }}>{tr('เดือน')}</th>
                {CSAT_LEGS.map(l => (
                  <th key={l.key} style={{ ...th, textAlign: 'center' }} colSpan={3} title={l.hint}>{l.icon} {tr(l.label)}</th>
                ))}
                <th style={{ ...th, textAlign: 'center' }} title={tr('(ΣActual ÷ ΣTotal) × 100 — คิดได้เมื่อครบทั้ง 2 ขา')}>{tr('รวมที่คำนวณได้')}</th>
                <th style={{ ...th, textAlign: 'center' }} title={tr('ค่าที่กรอกไว้ในตาราง KPI = ค่าที่ส่งกลุ่ม (ชนะเสมอ)')}>{tr('ค่ารวมที่ใช้จริง')}</th>
                <th style={th} />
              </tr>
              <tr>
                <th style={{ ...th, textAlign: 'left' }} />
                {CSAT_LEGS.map(l => [
                  <th key={`${l.key}a`} style={{ ...th, textAlign: 'center', fontWeight: 600 }}>{tr('ได้')}</th>,
                  <th key={`${l.key}t`} style={{ ...th, textAlign: 'center', fontWeight: 600 }}>{tr('เต็ม')}</th>,
                  <th key={`${l.key}p`} style={{ ...th, textAlign: 'center', fontWeight: 600 }}>%</th>,
                ])}
                <th style={th} /><th style={th} /><th style={th} />
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 12 }, (_, i) => {
                const m = i + 1;
                const st = csatMonth({ entered: entries?.[m] ?? null, parts: byMonth?.[m] || {} });
                const canApply = canEdit && st.computed != null && (st.entered == null || st.mismatch);
                return (
                  <tr key={m} style={st.mismatch ? { background: 'var(--bg2)' } : undefined}>
                    <td style={{ ...td, textAlign: 'left', fontWeight: 700, color: 'var(--text)' }}>{tr(TH_M[i])}</td>
                    {CSAT_LEGS.map((l) => {
                      const row = byMonth?.[m]?.[l.key] || null;
                      const leg = st.split.legs.find(x => x.key === l.key);
                      const over = leg?.actual != null && leg?.total != null && leg.total > 0 && leg.actual > leg.total;
                      return [
                        <td key={`${l.key}a`} style={td}>
                          <ScoreInput value={row?.actual_score ?? null} disabled={!canEdit || busy === `${m}:${l.key}` || tableMissing}
                            title={tr('คะแนนที่ได้')} onCommit={raw => commit(m, l.key, 'actual_score', raw)} />
                        </td>,
                        <td key={`${l.key}t`} style={td}>
                          <ScoreInput value={row?.total_score ?? null} disabled={!canEdit || busy === `${m}:${l.key}` || tableMissing}
                            title={tr('คะแนนเต็ม')} onCommit={raw => commit(m, l.key, 'total_score', raw)} />
                        </td>,
                        <td key={`${l.key}p`} style={{ ...td, color: leg?.pct == null ? 'var(--muted)' : 'var(--text)', fontWeight: 700 }}
                          title={over ? tr('คะแนนที่ได้มากกว่าคะแนนเต็ม — ตรวจตัวเลขอีกครั้ง') : undefined}>
                          {pct(leg?.pct)}{over && <span style={{ color: 'var(--red)' }}> ⚠</span>}
                        </td>,
                      ];
                    })}
                    <td style={{ ...td, fontWeight: 800, color: st.computed == null ? 'var(--muted)' : 'var(--text)' }}
                      title={st.computed == null
                        ? tr('ยังไม่ครบ 2 ขา — ไม่คิดค่ารวม (ไม่ใช่ 0)')
                        : `${st.split.actual} ÷ ${st.split.total} × 100`}>
                      {st.computed == null ? '—' : pct(st.computed)}
                      {st.state === 'partial' && <div style={{ fontSize: 11, color: 'var(--amber)', fontWeight: 600 }}>{tr('ยังไม่ครบ')}</div>}
                    </td>
                    <td style={{ ...td, color: st.entered == null ? 'var(--muted)' : 'var(--text)' }}>
                      {st.entered == null ? '—' : fmtKpi(st.entered, def)}
                      {st.mismatch && (
                        <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 700 }}
                          title={tr('ค่ารวมที่กรอกไว้ไม่เท่ากับที่คำนวณจาก 2 ขา — ระบบไม่แก้ให้เอง')}>
                          ≠ {tr('ต่าง')} {st.diff > 0 ? '+' : ''}{Number(st.diff).toFixed(2)}
                        </div>
                      )}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {canApply && (
                        <button type="button" className="pg-btn" style={{ fontSize: 11, padding: '2px 7px' }}
                          title={tr('เขียนค่าที่คำนวณได้ลงช่องค่ารวมของเดือนนี้ (ค่านี้คือค่าที่ส่งกลุ่ม)')}
                          onClick={async () => { setBusy(`apply:${m}`); try { await onApplyTotal?.(m, Number(st.computed.toFixed(2))); } finally { setBusy(''); } }}
                          disabled={busy === `apply:${m}`}>
                          {st.entered == null ? tr('ใช้ค่านี้') : tr('ใช้ค่านี้แทน')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>
          {tr('แยกครบแล้ว')} <b>{cov.split}</b> {tr('เดือน')}
          {cov.partial > 0 && <> · <span style={{ color: 'var(--amber)' }}>{tr('แยกไม่ครบ')} {cov.partial} {tr('เดือน')}</span></>}
          {cov.enteredOnly > 0 && <> · {tr('มีแต่ค่ารวม')} {cov.enteredOnly} {tr('เดือน')}</>}
          {cov.mismatch > 0 && <> · <span style={{ color: 'var(--red)', fontWeight: 700 }}>{tr('ไม่ตรงกับค่ารวม')} {cov.mismatch} {tr('เดือน')} ({cov.mismatchMonths.map(m => TH_M[m - 1]).join(' · ')})</span></>}
          <div>
            {tr('สรุปทั้งปีของแต่ละขาคิดด้วยวิธีรวมของ KPI ตัวนี้เหมือนค่ารวม (ดูในตารางหลัง ปิดหน้านี้)')}
            {' · '}{tr('คะแนน 1/0.5/0 ยังตัดสินจากค่ารวมตัวเดียวตามเกณฑ์ทางการ')}
          </div>
        </div>
      </div>
    </div>, document.body);
}
