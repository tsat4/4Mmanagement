/* 💬 AskBot — ปุ่มแชทลอย "ถามข้อมูลในระบบ" (ต้นแบบหน้าตา · 2026-11-19 · ยังไม่ต่อข้อมูลจริง)
   ตำแหน่ง: ขวาล่าง ยกเหนือชิปของ DowntimeSiren (bottom 12) · บวก --mnav-h ตามกฎ fixed ชิดล่าง
   จอคอม = กล่องลอย 360px · มือถือ = เต็มจอ
   `demo` = ข้อความตัวอย่างสำหรับภาพจำลองเท่านั้น */
import { useState } from 'react'
import useIsMobile from '../utils/useIsMobile'
import { tr } from '../utils/i18n'

const HINTS = ['oee HDF1 วันนี้', 'downtime สูงสุด สัปดาห์นี้']

export default function AskBot({ demo = null, defaultOpen = false }) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(defaultOpen)
  const [text, setText] = useState('')
  const msgs = demo || []

  const fab = (
    <button onClick={() => setOpen(o => !o)} aria-label={tr('ถามข้อมูลในระบบ')} title={tr('ถามข้อมูลในระบบ')}
      style={{ position: 'fixed', right: 14, bottom: 'calc(56px + var(--mnav-h, 0px))', zIndex: 3990,
        width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer',
        background: 'var(--accent)', color: 'var(--accent-ink)', fontSize: 22,
        boxShadow: 'var(--shadow-float)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {open ? '✕' : '💬'}
    </button>
  )
  if (!open) return fab

  const panel = isMobile
    ? { position: 'fixed', inset: 0, bottom: 'var(--mnav-h, 0px)', zIndex: 4010, borderRadius: 0 }
    : { position: 'fixed', right: 14, bottom: 'calc(118px + var(--mnav-h, 0px))', zIndex: 3995,
        width: 360, height: 480, borderRadius: 'var(--r-lg)', border: '1px solid var(--border2)' }

  return (
    <>
      {!isMobile && fab}
      <div style={{ ...panel, background: 'var(--card)', boxShadow: 'var(--shadow-lg)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', color: 'var(--text)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
          borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
          <span style={{ fontSize: 18 }}>💬</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{tr('ถามข้อมูลในระบบ')}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{tr('ตอบจากข้อมูลจริงในระบบ · ไม่เข้าใจ = ไม่เดา')}</div>
          </div>
          {isMobile && <button onClick={() => setOpen(false)} aria-label={tr('ปิด')}
            style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: 18, cursor: 'pointer' }}>✕</button>}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {msgs.map((m, i) => m.from === 'me' ? (
            <div key={i} style={{ alignSelf: 'flex-end', maxWidth: '80%', background: 'var(--accent)',
              color: 'var(--accent-ink)', padding: '7px 11px', borderRadius: 12, fontSize: 13 }}>{m.text}</div>
          ) : (
            <div key={i} style={{ alignSelf: 'flex-start', maxWidth: '90%', background: 'var(--bg2)',
              border: '1px solid var(--border)', padding: '8px 11px', borderRadius: 12, fontSize: 13 }}>
              {m.source && <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>📎 {m.source}</div>}
              <div style={{ whiteSpace: 'pre-line' }}>{m.text}</div>
              {m.hints && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {m.hints.map(h => <span key={h} style={chip}>{h}</span>)}</div>}
              {m.link && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>{tr('ดูหน้าเต็ม')} → {m.link}</div>}
            </div>
          ))}
        </div>

        <div style={{ padding: '8px 10px 4px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {HINTS.map(h => <span key={h} onClick={() => setText(h)} style={{ ...chip, cursor: 'pointer' }}>{h}</span>)}
        </div>
        <div style={{ display: 'flex', gap: 6, padding: 10, borderTop: '1px solid var(--border)' }}>
          <input value={text} onChange={e => setText(e.target.value)} placeholder={tr('พิมพ์คำถาม เช่น oee HDF1 วันนี้')}
            style={{ flex: 1, background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 'var(--r-md)',
              color: 'var(--text)', padding: '8px 10px', fontSize: 13 }} />
          <button style={{ background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none',
            borderRadius: 'var(--r-md)', padding: '0 14px', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>{tr('ส่ง')}</button>
        </div>
      </div>
    </>
  )
}

const chip = { fontSize: 11.5, padding: '3px 9px', borderRadius: 999, border: '1px solid var(--border2)',
  color: 'var(--text)', background: 'var(--card)' }
