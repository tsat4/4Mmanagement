/* 🧩 ตั้งค่าสถานี AM (2026-11-23 · คำสั่ง user) — แท็บ "สถานี (ใบรวม)" ใน /daily-checker?tab=pm
   สถานี = ชุดอุปกรณ์ที่ติดตั้งคู่กัน (robot + gripper + stationary + nut feeder) ⇒ พนักงานตรวจ AM ในใบเดียว
   กฎทั้งหมดอยู่ `utils/amStations.js` · ไฟล์นี้วาด + เขียน DB
   · ผู้แก้ = `can('pm','setup')` (ชุดเดียวกับแท็บลงทะเบียน) · ไลน์ = ช่องเลือกที่กรองขอบเขตแล้ว (`lines` จากหน้าแม่)
   · อุปกรณ์ที่เลือกได้ = ที่ลงทะเบียน AM รายวันในไลน์นั้นแล้ว (มีใบตรวจ AM อยู่แล้ว — ไม่งั้นใบรวมเปิดมาเจอว่าง)
   · ลบ = ปิดใช้ (is_active=false) + ถอดสมาชิก (ให้อุปกรณ์ไปอยู่สถานีอื่นได้) · ผลตรวจเดิมไม่หาย (อยู่รายอุปกรณ์)
   📄 docs/modules/pm-hub-check-setup.md §🧩 สถานี AM */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabaseDR } from '../supabaseClient'
import { toast } from './Toast'
import LineSelect from './LineSelect'
import { askConfirm } from '../utils/askConfirm'
import { checkWrite, checkWriteRows } from '../utils/dbWrite'
import { buildStationIndex, validateStation } from '../utils/amStations'
import { tr } from '../utils/i18n'

const inputSt = { width: '100%', padding: '7px 10px', borderRadius: 8, fontSize: 13, background: 'var(--bg3)', border: '1px solid var(--border2)', color: 'var(--text)' }

export default function AmStationSetup({ jigs = [], targets = [], lines = [], canManage = false, userId = null, actorName = '' }) {
  const [stations, setStations] = useState([])
  const [members, setMembers] = useState([])
  const [loadErr, setLoadErr] = useState('')
  const [line, setLine] = useState('')
  const [edit, setEdit] = useState(null)        // { id?, name, line_name, jigIds:[] }
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [s, m] = await Promise.all([
      supabaseDR.from('am_stations').select('id, name, line_name, note, is_active, sort_order').eq('is_active', true).order('sort_order').order('name'),
      supabaseDR.from('am_station_members').select('id, station_id, jig_id, sort_order'),
    ])
    if (s.error || m.error) { setLoadErr((s.error || m.error).message); return }   // คงค่าเดิม ห้ามล้างเป็นว่าง
    setLoadErr(''); setStations(s.data || []); setMembers(m.data || [])
  }, [])
  useEffect(() => { let alive = true; (async () => { if (alive) await load() })(); return () => { alive = false } }, [load])

  const ix = useMemo(() => buildStationIndex(stations, members), [stations, members])
  const jigById = useMemo(() => new Map(jigs.map(j => [j.id, j])), [jigs])
  const lineNames = useMemo(() => new Set((lines || []).map(l => l.name)), [lines])
  // อุปกรณ์ที่ลงทะเบียน AM รายวันของไลน์ที่เลือก (ลำดับเดิมของทะเบียน)
  const regJigsOfLine = useMemo(() => {
    if (!line) return []
    const ids = [...new Set(targets.filter(t => t.line_name === line).map(t => t.jig_id))]
    return ids.map(id => jigById.get(id)).filter(Boolean)
  }, [line, targets, jigById])
  const lineStations = useMemo(() => stations.filter(s => s.line_name === line), [stations, line])
  const outScope = useMemo(() => stations.filter(s => !lineNames.has(s.line_name)).length, [stations, lineNames])

  const startNew = () => setEdit({ name: '', line_name: line, jigIds: [] })
  const startEdit = (s) => setEdit({ id: s.id, name: s.name, line_name: s.line_name, jigIds: ix.membersOf(s.id) })
  const toggleJig = (id) => setEdit(e => ({ ...e, jigIds: e.jigIds.includes(id) ? e.jigIds.filter(x => x !== id) : [...e.jigIds, id] }))

  const save = async () => {
    if (!canManage || !edit) return
    const err = validateStation({
      name: edit.name, line_name: edit.line_name, jigIds: edit.jigIds,
      jigLineOf: (id) => jigById.get(id)?.line_name || null, takenBy: (id) => ix.byJig.get(id) || null, selfId: edit.id || null,
    })
    if (err) { toast.error(err); return }
    if (!lineNames.has(edit.line_name)) { toast.error(tr('ไลน์นี้อยู่นอกขอบเขตของคุณ')); return }   // ด่านซ้ำตอนเขียนจริง
    setBusy(true)
    try {
      let sid = edit.id
      if (sid) {
        if (!checkWriteRows(await supabaseDR.from('am_stations').update({ name: edit.name.trim(), updated_by_name: actorName || null }).eq('id', sid).select('id'), 'แก้ชื่อสถานี')) return
        // แทนสมาชิกทั้งชุด: ลบของเดิมก่อน — ลบไม่สำเร็จ = หยุด ห้าม insert ต่อ (กฎเขียน DB ข้อ 1)
        if (!checkWrite(await supabaseDR.from('am_station_members').delete().eq('station_id', sid), 'ล้างสมาชิกเดิม')) return
      } else {
        const res = await supabaseDR.from('am_stations').insert({ name: edit.name.trim(), line_name: edit.line_name, created_by: userId, updated_by_name: actorName || null }).select('id').single()
        if (!checkWrite(res, 'สร้างสถานี')) return
        sid = res.data.id
      }
      const rows = edit.jigIds.map((jig_id, i) => ({ station_id: sid, jig_id, sort_order: i + 1, updated_by_name: actorName || null }))
      const mres = await supabaseDR.from('am_station_members').insert(rows).select('id')
      if (!checkWriteRows(mres, 'บันทึกอุปกรณ์ในสถานี', { min: rows.length })) {
        // สร้างใหม่แล้วใส่สมาชิกไม่ได้ = ปิดสถานีเปล่าทิ้ง (กันสถานีว่างค้างในบอร์ด)
        if (!edit.id) {
          const off = await supabaseDR.from('am_stations').update({ is_active: false }).eq('id', sid).select('id')
          if (off.error || !(off.data || []).length) toast.error(tr('ปิดสถานีเปล่าที่สร้างค้างไม่สำเร็จ — ลบสถานีนี้เองที่รายการด้านล่าง'))
        }
        return
      }
      toast.success(edit.id ? tr('บันทึกสถานีแล้ว') : tr('สร้างสถานีแล้ว'))
      setEdit(null); await load()
    } finally { setBusy(false) }
  }

  const remove = async (s) => {
    if (!canManage) return
    if (!await askConfirm(`${tr('ลบสถานี')} "${s.name}" ?\n\n${tr('อุปกรณ์กลับไปตรวจทีละใบเหมือนเดิม · ผลตรวจที่บันทึกไปแล้วไม่หาย (เก็บรายอุปกรณ์)')}`)) return
    setBusy(true)
    try {
      if (!checkWrite(await supabaseDR.from('am_station_members').delete().eq('station_id', s.id), 'ถอดอุปกรณ์ออกจากสถานี')) return
      if (!checkWriteRows(await supabaseDR.from('am_stations').update({ is_active: false, updated_by_name: actorName || null }).eq('id', s.id).select('id'), 'ลบสถานี')) return
      toast.success(tr('ลบสถานีแล้ว')); if (edit?.id === s.id) setEdit(null); await load()
    } finally { setBusy(false) }
  }

  return (
    <div>
      <div style={{ marginBottom: 12, fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.6 }}>
        {tr('สถานี = ชุดอุปกรณ์ที่ติดตั้งคู่กัน (เช่น Robot + Gripper + Stationary + Nut feeder) — พนักงานตรวจ AM ทั้งชุดในใบเดียว กดบันทึกครั้งเดียว ระบบแยกเก็บผลรายอุปกรณ์ให้เอง · NG ส่งใบซ่อมไปทีมเจ้าของตัวนั้น')}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ minWidth: 220 }}>
          <LineSelect lines={lines} value={line} onChange={v => { setLine(v || ''); setEdit(null) }} placeholder={tr('— เลือกไลน์ —')} />
        </div>
        {canManage && line && !edit && <button type="button" className="tbtn" onClick={startNew} disabled={busy} style={{ fontWeight: 700 }}>+ {tr('สร้างสถานี')}</button>}
        {!canManage && <span style={{ fontSize: 12, color: 'var(--accent2)' }}>{tr('* ดูได้อย่างเดียว — ต้องมีสิทธิ์ตั้งค่า PM')}</span>}
      </div>
      {loadErr && <div style={{ fontSize: 12.5, color: 'var(--amber)', marginBottom: 10 }}>{tr('อ่านรายการสถานีไม่ได้')}: {loadErr}</div>}
      {outScope > 0 && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>{tr('ซ่อน')} {outScope} {tr('สถานีของไลน์นอกขอบเขตของคุณ')}</div>}
      {!line && <div style={{ fontSize: 12.5, color: 'var(--muted)', padding: 20, textAlign: 'center' }}>{tr('เลือกไลน์ก่อน แล้วจะเห็นสถานีของไลน์นั้น')}</div>}

      {edit && (
        <div style={{ background: 'var(--card-surf)', border: '1px solid var(--accent-line, var(--border))', borderRadius: 'var(--r-lg)', padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 8 }}>{edit.id ? tr('แก้สถานี') : tr('สถานีใหม่')} · {edit.line_name}</div>
          <input id="am-station-name" value={edit.name} onChange={e => setEdit(x => ({ ...x, name: e.target.value }))} placeholder={tr('ชื่อสถานี เช่น Robot cell #1')} style={{ ...inputSt, marginBottom: 10 }} />
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{tr('เลือกอุปกรณ์ในสถานี (ลำดับที่ติ๊ก = ลำดับในใบตรวจ)')} · {edit.jigIds.length} {tr('ตัว')}</div>
          {regJigsOfLine.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--amber)' }}>{tr('ไลน์นี้ยังไม่มีอุปกรณ์ที่ลงทะเบียน AM รายวัน — ลงทะเบียนที่แท็บ "ลงทะเบียนเครื่องตรวจ" ก่อน')}</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 6 }}>
              {regJigsOfLine.map(j => {
                const other = ix.byJig.get(j.id)
                const taken = other && other.id !== edit.id
                const on = edit.jigIds.includes(j.id)
                const order = on ? edit.jigIds.indexOf(j.id) + 1 : null
                return (
                  <label key={j.id} title={taken ? `${tr('อยู่สถานี')} "${other.name}" ${tr('แล้ว')}` : j.name} style={{
                    display: 'flex', gap: 8, alignItems: 'flex-start', padding: '7px 9px', borderRadius: 'var(--r-md)',
                    border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent-dim)' : 'var(--bg3)',
                    opacity: taken ? 0.55 : 1, cursor: taken ? 'not-allowed' : 'pointer',
                  }}>
                    <input type="checkbox" checked={on} disabled={taken || busy} onChange={() => toggleJig(j.id)} style={{ marginTop: 2, width: 15, height: 15, flexShrink: 0 }} />
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontSize: 12, fontWeight: 700, wordBreak: 'break-word' }}>{order ? `${order}. ` : ''}{j.name}</span>
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>{taken ? `${tr('อยู่สถานี')} "${other.name}"` : (j.machine_no || j.jig_no || '')}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" className="tbtn" onClick={save} disabled={busy} style={{ fontWeight: 800, color: 'var(--accent)', borderColor: 'var(--accent)' }}>{busy ? tr('กำลังบันทึก…') : tr('บันทึกสถานี')}</button>
            <button type="button" className="tbtn" onClick={() => setEdit(null)} disabled={busy}>{tr('ยกเลิก')}</button>
          </div>
        </div>
      )}

      {line && lineStations.length === 0 && !edit && (
        <div style={{ fontSize: 12.5, color: 'var(--muted)', padding: 16, textAlign: 'center' }}>{tr('ไลน์นี้ยังไม่มีสถานี — อุปกรณ์ทุกตัวตรวจทีละใบตามปกติ')}</div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, alignContent: 'start' }}>
        {lineStations.map(s => (
          <div key={s.id} style={{ background: 'var(--card-surf)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <b style={{ flex: 1, minWidth: 0, fontSize: 13.5 }}>🧩 {s.name}</b>
              {canManage && <button type="button" className="tbtn" onClick={() => startEdit(s)} disabled={busy} style={{ padding: '3px 10px', fontSize: 12 }}>{tr('แก้')}</button>}
              {canManage && <button type="button" className="tbtn" onClick={() => remove(s)} disabled={busy} style={{ padding: '3px 10px', fontSize: 12, color: 'var(--red)' }}>{tr('ลบ')}</button>}
            </div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.7 }}>
              {ix.membersOf(s.id).map(id => <li key={id}>{jigById.get(id)?.name || <span style={{ color: 'var(--amber)' }}>{tr('อุปกรณ์ถูกลบ/หาไม่เจอ')}</span>}</li>)}
            </ol>
          </div>
        ))}
      </div>
    </div>
  )
}
