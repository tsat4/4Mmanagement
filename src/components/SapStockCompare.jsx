import { useState, useEffect, useCallback, useMemo, useContext } from 'react';
import { supabaseDR } from '../supabaseClient';
import { UserContext } from '../App';
import { toast } from './Toast';
import { can } from '../utils/permissions';
import { getActor } from '../utils/actorStamp';
import { askConfirm } from '../utils/askConfirm';
import { checkWriteRows } from '../utils/dbWrite';
import { fetchAllRows } from '../utils/fetchAllRows';
import { parseMb52, parseMb52File, diffOf, summarizeBySloc, hintsOf, ESM_BASIS_LABEL } from '../utils/mb52Import';
import { storeBtn } from '../utils/storeUi';
import FilterBar from './FilterBar';
import SearchInput from './SearchInput';
import MatLabel from './MatLabel';
import { tr } from '../utils/i18n';

/* ═══ 📊 เทียบยอดคงคลัง SAP (MB52) กับระบบ — รายสัปดาห์ (2026-11-20 · คำสั่ง user)
   user: *"หน้างานจริงกับ SAP ไม่ตรงกัน … แต่ละส่วนงานจดสมุดลง Excel เอาไว้เทียบกับ SAP ปลายสัปดาห์/สิ้นเดือน
          อยากให้ระบบแทน manual ได้ และแม่นยำ เพื่อไว้เทียบชนกับ SAP"*
   · อัปโหลด MB52 (TSV UTF-16 .xls / .xlsx) → แกะที่จอ (`utils/mb52Import.js`) → RPC `sap_stock_upload_create` (DR)
     บันทึกรอบ + **ตรึงยอดระบบ ณ เวลาอัปโหลด** (user เลือก) ลง `sap_stock_compare` — ดูย้อนหลังได้ ตัวเลขไม่ขยับ
   · เทียบ **เฉพาะรหัสคลังที่อยู่ในไฟล์** (ไฟล์ทีละคลังได้) · ฝั่งระบบ: P4xx = ไลน์ที่ผูก · STORE/FG = ที่จัดเก็บหลักของพาร์ท
     ไม่ได้ตั้งที่จัดเก็บหลัก = รหัสเทียม STORE? / FG? (ห้ามเดา) · เทียบกับ Unrestr. (QI/Blocked โชว์ข้าง)
   · สิทธิ์อัปโหลด/ลบรอบ = `line_stock:issue` · ดูได้ทุกคนที่เข้าหน้า */
const UP_COLS = 'id, created_at, cutoff_at, report_date, file_name, slocs, sap_rows, uploaded_by';
const CMP_COLS = 'id, sloc, mat_no, part_name, bun, sap_qty, sap_qi, sap_blocked, sap_src_rows, esm_qty, esm_basis, hint_gap, hint_rcpt, hint_po';
const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString(undefined, { maximumFractionDigits: 3 }));
const when = (iso) => (iso ? new Date(iso).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

async function readFile(file) {
  const buf = await file.arrayBuffer();
  const b = new Uint8Array(buf);
  if (b[0] === 0x50 && b[1] === 0x4b) {           // PK = .xlsx จริง (บางคน export เป็น Spreadsheet)
    const XLSX = await import('xlsx');
    const wb = XLSX.read(buf);
    return parseMb52(XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]], { FS: '\t', RS: '\n' }));
  }
  return parseMb52File(buf);                       // TSV UTF-16 แบบที่ SAP คาย (.xls)
}

export default function SapStockCompare() {
  const { role, fullName } = useContext(UserContext);
  const canUpload = can('line_stock', 'issue', role);
  const [uploads, setUploads] = useState([]);
  const [upErr, setUpErr] = useState('');
  const [sel, setSel] = useState(null);
  const [rows, setRows] = useState([]);
  const [rowErr, setRowErr] = useState('');
  const [loadingRows, setLoadingRows] = useState(false);
  const [parsed, setParsed] = useState(null);       // ผลแกะไฟล์ที่รออัปโหลด
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [sloc, setSloc] = useState('');
  const [onlyDiff, setOnlyDiff] = useState(true);
  const [q, setQ] = useState('');

  const loadUploads = useCallback(async () => {
    const { data, error } = await supabaseDR.from('sap_stock_uploads').select(UP_COLS)
      .order('created_at', { ascending: false }).limit(52);
    setUpErr(error ? error.message : '');
    if (!error) {
      setUploads(data || []);
      setSel(cur => cur && (data || []).some(u => u.id === cur) ? cur : (data?.[0]?.id || null));
    }
  }, []);
  useEffect(() => { loadUploads(); }, [loadUploads]);

  useEffect(() => {
    let alive = true;
    if (!sel) { setRows([]); return undefined; }
    setLoadingRows(true);
    fetchAllRows(supabaseDR, 'sap_stock_compare', CMP_COLS, qy => qy.eq('upload_id', sel).order('id')).then(({ data, error }) => {
      if (!alive) return;
      setLoadingRows(false);
      setRowErr(error ? error.message : '');
      setRows(error ? [] : (data || []));
      setSloc('');
    });
    return () => { alive = false; };
  }, [sel]);

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setFileName(f.name);
    try { setParsed(await readFile(f)); }
    catch (err) { setParsed({ ok: false, error: `อ่านไฟล์ไม่ได้: ${err.message}`, rows: [] }); }
  };

  const save = async () => {
    if (!canUpload || !parsed?.ok) return;
    setBusy(true);
    const a = getActor();
    const { data, error } = await supabaseDR.rpc('sap_stock_upload_create', {
      p_meta: { uploaded_by: fullName || a.name || '', uploaded_by_uid: a.uid || null, file_name: fileName,
        report_date: parsed.reportDate, sap_rows: parsed.srcRows },
      p_rows: parsed.rows,
    });
    setBusy(false);
    if (error) { toast.error(`บันทึกไม่สำเร็จ — ${error.message}`); return; }
    toast.success(`✅ บันทึกรอบเทียบแล้ว · ${(data?.slocs || []).join(', ')} · ${data?.compare_rows || 0} แถว (ตรึงยอดระบบ ณ ตอนนี้)`);
    setParsed(null); setFileName('');
    await loadUploads();
    if (data?.id) setSel(data.id);
  };

  const remove = async (u) => {
    if (!canUpload) return;
    if (!await askConfirm(`ลบรอบเทียบ ${u.file_name || ''} (${(u.slocs || []).join(', ')}) ที่อัปโหลด ${when(u.created_at)}?\nใช้เมื่ออัปโหลดไฟล์ผิด — ลบแล้วกู้คืนไม่ได้`)) return;
    const ok = checkWriteRows(await supabaseDR.from('sap_stock_uploads').delete().eq('id', u.id).select('id'), 'ลบรอบเทียบ SAP');
    if (ok) { toast.success('ลบรอบแล้ว'); setSel(null); loadUploads(); }
  };

  const cur = uploads.find(u => u.id === sel) || null;
  const summary = useMemo(() => summarizeBySloc(rows), [rows]);
  const s = q.trim().toLowerCase();
  const shown = useMemo(() => rows
    .filter(r => (!sloc || r.sloc === sloc) && (!onlyDiff || diffOf(r) !== 0)
      && (!s || [r.mat_no, r.part_name].some(v => String(v ?? '').toLowerCase().includes(s))))
    .sort((a, b) => Math.abs(diffOf(b)) - Math.abs(diffOf(a))), [rows, sloc, onlyDiff, s]);
  const unknownPile = rows.filter(r => r.esm_basis === 'pile_unknown').length;

  const card = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 12, boxShadow: 'var(--shadow-sm)' };
  const th = { padding: '6px 8px', fontSize: 12, color: 'var(--muted)', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' };
  const thR = { ...th, textAlign: 'right' };
  const td = { padding: '6px 8px', fontSize: 13, borderBottom: '1px solid var(--border2)', verticalAlign: 'top' };
  const tdR = { ...td, textAlign: 'right', whiteSpace: 'nowrap' };
  const diffColor = (d) => (d === 0 ? 'var(--green)' : 'var(--red)');

  return (
    <div>
      <div style={card}>
        <b style={{ fontSize: 15 }}>📤 {tr('อัปโหลด MB52 จาก SAP')}</b>
        <div style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 8px' }}>
          {tr('ไฟล์ .xls ที่ SAP export (หรือ .xlsx) · ไฟล์ทีละคลังหรือหลายคลังก็ได้ — ระบบเทียบเฉพาะรหัสคลังที่อยู่ในไฟล์ · ยอดฝั่งระบบตัด ณ เวลาที่กดบันทึก')}
          <br />{tr('ต้องมีคอลัมน์ Material · SLoc · Unrestr. (ลำดับคอลัมน์ไม่สำคัญ) · แนะนำบันทึก layout กลางใน SAP ให้ทุกคน export แบบเดียวกัน')}
        </div>
        {!canUpload && <div style={{ color: 'var(--amber)', fontSize: 13 }}>🔒 {tr('ดูอย่างเดียว — อัปโหลด/ลบรอบต้องมีสิทธิ์ line_stock:issue')}</div>}
        {canUpload && <input type="file" accept=".xls,.xlsx,.txt,.tsv" onChange={onFile} />}
        {parsed && (
          <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: parsed.ok ? 'var(--green-dim)' : 'var(--red-dim)', border: `1px solid ${parsed.ok ? 'var(--green-line)' : 'var(--red-line)'}` }}>
            {parsed.ok ? <>
              <div style={{ fontSize: 13 }}>
                📄 <b>{fileName}</b> · {tr('วันที่ในไฟล์')} {parsed.reportDate || tr('ไม่พบ')} · {tr('รหัสคลัง')} <b>{parsed.slocs.join(', ')}</b> ·{' '}
                {parsed.srcRows.toLocaleString()} {tr('บรรทัด')} → {parsed.rows.length.toLocaleString()} MAT · {tr('รวม Unrestr.')} {fmt(parsed.total)}
              </div>
              {parsed.warnings.map(w => <div key={w} style={{ fontSize: 12, color: 'var(--amber)' }}>⚠ {w}</div>)}
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <button type="button" style={storeBtn('primary')} disabled={busy} onClick={save}>{busy ? '…' : `💾 ${tr('บันทึกและเทียบ')}`}</button>
                <button type="button" style={storeBtn('secondary')} disabled={busy} onClick={() => setParsed(null)}>{tr('ยกเลิก')}</button>
              </div>
            </> : <>
              <div style={{ fontSize: 13, color: 'var(--red)' }}>⚠ {parsed.error}</div>
              {parsed.headers?.length > 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{tr('หัวคอลัมน์ที่เจอ')}: {parsed.headers.join(' · ')}</div>}
            </>}
          </div>
        )}
      </div>

      <div style={card}>
        <b style={{ fontSize: 15 }}>🗂️ {tr('รอบเทียบ')}</b>
        {upErr && <div style={{ color: 'var(--red)', fontSize: 13 }}>⚠ {tr('โหลดรายการรอบไม่สำเร็จ')}: {upErr}</div>}
        {!upErr && !uploads.length && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>{tr('ยังไม่มีรอบเทียบ — อัปโหลดไฟล์ MB52 ด้านบน')}</div>}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          {uploads.map(u => (
            <button key={u.id} type="button" onClick={() => setSel(u.id)}
              style={{ ...storeBtn(u.id === sel ? 'primary' : 'secondary'), minHeight: 0, padding: '6px 10px', fontSize: 12, fontWeight: 600 }}>
              {when(u.created_at)} · {(u.slocs || []).join(', ')}
            </button>
          ))}
        </div>
      </div>

      {cur && (
        <div style={card}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <b style={{ fontSize: 15 }}>📊 {cur.file_name || tr('ไม่มีชื่อไฟล์')}</b>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              {tr('วันที่ SAP')} {cur.report_date || '—'} · {tr('ตรึงยอดระบบ')} {when(cur.cutoff_at)} · {tr('โดย')} {cur.uploaded_by || '—'} · {fmt(cur.sap_rows)} {tr('บรรทัดในไฟล์')}
            </span>
            {canUpload && <button type="button" style={{ ...storeBtn('secondary'), minHeight: 0, padding: '4px 10px', fontSize: 12, marginLeft: 'auto', color: 'var(--red)' }} onClick={() => remove(cur)}>🗑 {tr('ลบรอบนี้')}</button>}
          </div>
          {rowErr && <div style={{ color: 'var(--red)', fontSize: 13 }}>⚠ {tr('โหลดผลเทียบไม่สำเร็จ')}: {rowErr}</div>}
          {loadingRows && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{tr('กำลังโหลด…')}</div>}
          {!loadingRows && !rowErr && <>
            <div style={{ overflowX: 'auto', margin: '8px 0' }}>
              <table style={{ borderCollapse: 'collapse', minWidth: 520 }}>
                <thead><tr>
                  <th style={th}>{tr('รหัสคลัง')}</th><th style={thR}>SAP</th><th style={thR}>{tr('ระบบเรา')}</th>
                  <th style={thR}>MAT</th><th style={thR}>{tr('ตรง')}</th><th style={thR}>{tr('ต่าง')}</th><th style={thR}>{tr('ผลรวมส่วนต่าง')}</th>
                </tr></thead>
                <tbody>{summary.map(x => (
                  <tr key={x.sloc} style={{ cursor: 'pointer', background: sloc === x.sloc ? 'var(--accent-dim)' : undefined }} onClick={() => setSloc(sloc === x.sloc ? '' : x.sloc)}>
                    <td style={td}><b>{x.sloc}</b></td><td style={tdR}>{fmt(x.sap)}</td><td style={tdR}>{fmt(x.esm)}</td>
                    <td style={tdR}>{x.mats}</td><td style={{ ...tdR, color: 'var(--green)' }}>{x.match}</td>
                    <td style={{ ...tdR, color: x.diff ? 'var(--red)' : 'var(--muted)' }}>{x.diff}</td><td style={tdR}>{fmt(x.absDiff)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            {unknownPile > 0 && <div style={{ fontSize: 12, color: 'var(--amber)', marginBottom: 6 }}>⚠ {unknownPile} {tr('แถวอยู่ในรหัสเทียม STORE?/FG? — พาร์ทยังไม่ได้ตั้งที่จัดเก็บหลัก ระบบจึงไม่รู้ว่าอยู่รหัสคลังไหนใน SAP (ตั้งที่ Part Master)')}</div>}
            <FilterBar>
              <label style={{ fontSize: 13, display: 'flex', gap: 4, alignItems: 'center' }}>
                <input type="checkbox" checked={onlyDiff} onChange={e => setOnlyDiff(e.target.checked)} /> {tr('เฉพาะที่ต่าง')}
              </label>
              <SearchInput value={q} onChange={setQ} placeholder={tr('ค้นหา MAT / ชื่อพาร์ท')} />
            </FilterBar>
            <div style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0' }}>
              {sloc ? `${tr('รหัสคลัง')} ${sloc} · ` : ''}{tr('แสดง')} {shown.length.toLocaleString()} / {rows.length.toLocaleString()} {tr('แถว')} · {tr('เรียงส่วนต่างมาก→น้อย · ต่าง = ระบบเรา − SAP')}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  <th style={th}>{tr('รหัสคลัง')}</th><th style={th}>{tr('พาร์ท')}</th>
                  <th style={thR}>SAP Unrestr.</th><th style={thR}>{tr('ระบบเรา')}</th><th style={thR}>{tr('ต่าง')}</th><th style={th}>{tr('คำใบ้')}</th>
                </tr></thead>
                <tbody>{shown.map(r => {
                  const d = diffOf(r);
                  const extra = [Number(r.sap_qi) ? `QI ${fmt(r.sap_qi)}` : null, Number(r.sap_blocked) ? `Blocked ${fmt(r.sap_blocked)}` : null].filter(Boolean).join(' · ');
                  return (
                    <tr key={r.id}>
                      <td style={td}>{r.sloc}</td>
                      <td style={td}><MatLabel mat={r.mat_no} name={r.part_name} size={13} /></td>
                      <td style={tdR}>{fmt(r.sap_qty)} {r.bun || ''}{extra && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{extra}</div>}</td>
                      <td style={tdR} title={ESM_BASIS_LABEL[r.esm_basis] || ''}>{fmt(r.esm_qty)}</td>
                      <td style={{ ...tdR, color: diffColor(d), fontWeight: 600 }}>{d > 0 ? '+' : ''}{fmt(d)}</td>
                      <td style={{ ...td, fontSize: 12, color: 'var(--text2)' }}>{hintsOf(r).join(' · ') || '—'}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </>}
        </div>
      )}
    </div>
  );
}
