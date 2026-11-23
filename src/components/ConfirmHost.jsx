import { useCallback, useEffect, useRef, useState } from 'react';
import { registerConfirmHost } from '../utils/askConfirm';
import { tr } from '../utils/i18n';

/* ══ ❓ ConfirmHost — กล่องยืนยันกลางของแอป (วางครั้งเดียวที่ App root คู่กับ <ToastContainer/>) ═══════════════════
   · ม่าน `.overlay` (= --scrim 0.7 + blur · UI §5) + กล่อง `.modal` · ปุ่ม `.pg-btn` ชุดเดียวกับทั้งระบบ
   · Enter = ตกลง · Esc = ยกเลิก · โฟกัสไปที่ปุ่ม "ยกเลิก" ก่อน (กดพลาดคือพลาดเลย — UI §4M ปุ่มยืนยัน) · คลิกม่าน = ยกเลิก
   · มีคำถามซ้อนกัน (ถามใหม่ก่อนตอบอันเก่า) = ต่อคิว ตอบทีละอัน — ไม่ทับกัน
   · `role="alertdialog"` + `aria-modal` · ข้อความ pre-wrap (ข้อความเดิมของระบบใช้ \n จัดบรรทัดอยู่แล้ว)
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
export default function ConfirmHost() {
  const [cur, setCur] = useState(null);          // { opts, resolve }
  const queue = useRef([]);
  const cancelRef = useRef(null);

  const next = useCallback(() => { const n = queue.current.shift(); setCur(n || null); }, []);

  useEffect(() => registerConfirmHost((opts) => new Promise((resolve) => {
    queue.current.push({ opts, resolve });
    setCur(c => c || queue.current.shift());
  })), []);

  const answer = useCallback((v) => { if (!cur) return; cur.resolve(v); next(); }, [cur, next]);

  useEffect(() => {
    if (!cur) return undefined;
    const t = setTimeout(() => cancelRef.current?.focus(), 0);
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); answer(false); }
      else if (e.key === 'Enter' && !(e.target && e.target.tagName === 'BUTTON' && e.target !== cancelRef.current)) { e.preventDefault(); answer(true); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey, true); };
  }, [cur, answer]);

  if (!cur) return null;
  const { title, message, okLabel, cancelLabel, danger } = cur.opts;
  return (
    <div className="overlay" style={{ zIndex: 4000 }} onClick={() => answer(false)} data-confirm-host="1">
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="esm-confirm-title"
        onClick={e => e.stopPropagation()} style={{ width: 'min(440px, 94vw)', padding: '22px 24px 18px' }}>
        <div id="esm-confirm-title" style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', lineHeight: 1.35, whiteSpace: 'pre-wrap' }}>{tr(title)}</div>
        {message && (
          <div style={{ marginTop: 10, fontSize: 13.5, lineHeight: 1.6, color: 'var(--text2)', whiteSpace: 'pre-wrap', maxHeight: '50vh', overflowY: 'auto' }}>{tr(message)}</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button type="button" ref={cancelRef} className="pg-btn" onClick={() => answer(false)}>{tr(cancelLabel)}</button>
          <button type="button" className={`pg-btn ${danger ? 'danger' : 'primary'}`} onClick={() => answer(true)}>{tr(okLabel)}</button>
        </div>
      </div>
    </div>
  );
}
