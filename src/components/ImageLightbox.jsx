/* ══ 🔍 ImageLightbox — "รูปที่แนบไว้ กดขยายดูได้" ของกลางจุดเดียวของทั้งแอป (2026-11-16) ══
 *
 * คำสั่ง user (feedback ประชุม 16/11): *"พวกรูปที่แนบ ต้องกดขยายดูได้ เช่น ใน ใบ MO"*
 *
 * ── ทำไมต้องเป็นของกลาง ────────────────────────────────────────────────────────
 * ก่อนหน้านี้มี 3 วิธีปนกันอยู่ในระบบ แล้วไม่มีวิธีไหนครบ:
 *   1. `<a href={url} target="_blank">` (QualityPhotoField · KpiMonthNoteModal · ObeyaSqdcmBoard
 *      · QAInspectionSetup) — **เด้งออกจากใบที่กรอกค้างอยู่** บทเรียนเดียวกับ `CpImage` ของ PM
 *      (21/08: *"หน้างานใช้มือถือ เปิดแท็บใหม่ = เด้งออกจากใบตรวจที่กรอกค้าง"*)
 *   2. `window.open(url, '_blank')` (Improvements) — เหมือนข้อ 1 + ตัวบล็อกป็อปอัปกินได้เงียบๆ
 *   3. โมดัลดูรูปเขียนเองในหน้า (`Report.jsx` `imageViewModal`) — ของดี แต่อยู่หน้าเดียว
 *      ⇒ หน้าถัดไปที่อยากได้ ต้องก๊อป (= กับดักเดิมของ `mtnImage`/`qualityImage` ทุกครั้ง)
 *   4. ใบ MO เอง (`MtnRepair`) **กดขยายไม่ได้เลย** — รูปก่อน/หลังซ่อมสูง 130px ดูไม่ออกว่าเสียตรงไหน
 *
 * 🔴 **จุดที่โชว์ "รูปแนบ" ใหม่ทุกจุดต้องใช้ `<AttachImage>` / `<ImageLightbox>` เท่านั้น**
 *    ห้ามเขียนโมดัลดูรูปเองในหน้า · ห้ามกลับไปใช้ `target="_blank"` / `window.open`
 *    (มีด่าน `attach-image-zoomable` ใน regressionGuards)
 *
 * ── กติกา UI (UI-CONVENTIONS §6.38) ────────────────────────────────────────────
 *  · fit จอเดียวไม่มี scroll (รูป `max-height:74vh` · `object-fit:contain` ไม่ครอป)
 *  · แตะฉากหลัง / Esc / ปุ่มปิด = ปิด · ← → สลับรูปเมื่อมีหลายรูป
 *  · เงาใช้ token `--shadow-lg` **ห้ามเขียน rgba ดิบ** (ด่าน `card-shadow-via-token`)
 *  · ห้ามใช้ `color-mix()` (เพดาน Chromium 94 ของจอ TV webOS)
 *  · ฟอนต์ ≥ 11px · hover เฉพาะอุปกรณ์ที่มีเมาส์ (คลาส `.tbtn` จาก index.css)
 *  · 📱 ปุ่มบนมือถือ ≥ 44px (จอหน้างานใส่ถุงมือ · UI §6.24) — ของ fixed ชิดล่างบวก `--mnav-h`
 */
import { useCallback, useEffect, useState } from 'react';
import { tr } from '../utils/i18n';

/** รูปเดียว / หลายรูป → ลิสต์เดียวกันเสมอ (ผู้เรียกส่งแบบไหนก็ได้) */
const toItems = (items, url) => {
  const list = (Array.isArray(items) ? items : items ? [items] : url ? [{ url }] : [])
    .filter(it => it && it.url);
  return list;
};

/**
 * ฉากดูรูปเต็มจอ
 * @param items  `{ url, title?, caption?, badge?, badgeColor? }` หรือ array ของสิ่งนั้น
 * @param index  รูปที่เปิดอยู่ (ควบคุมจากข้างนอกได้ด้วย `onIndex`)
 */
export default function ImageLightbox({ items, url, index = 0, onIndex, onClose }) {
  const list = toItems(items, url);
  const [self, setSelf] = useState(index);
  const i = Math.min(Math.max(onIndex ? index : self, 0), Math.max(list.length - 1, 0));
  const go = useCallback((n) => {
    if (list.length < 2) return;
    const next = (n + list.length) % list.length;
    if (onIndex) onIndex(next); else setSelf(next);
  }, [list.length, onIndex]);

  /* ⌨️ Esc ปิด · ← → สลับรูป — ผูกครั้งเดียวที่นี่ ห้ามให้แต่ละหน้าผูกเอง
     (hook ต้องอยู่บนสุดก่อน early return — กฎ react-hooks/rules-of-hooks ในด่าน lint) */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      else if (e.key === 'ArrowLeft') go(i - 1);
      else if (e.key === 'ArrowRight') go(i + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, go, i]);

  if (!list.length) return null;
  const cur = list[i];
  const many = list.length > 1;
  const arrow = {
    width: 44, height: 44, borderRadius: 'var(--r-pill)', border: '1px solid var(--border2)',
    background: 'var(--bg2)', color: 'var(--text)', fontSize: 18, fontWeight: 800,
    cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  return (
    /* ดูอย่างเดียว ไม่มีช่องกรอก → ปิดจาก backdrop ได้ตามกฎ UI-CONVENTIONS §5
       (ขึ้นทะเบียนใน allow ของด่าน `modal-closes-on-backdrop` แล้ว) */
    <div onClick={onClose} className="modal-scroll" role="dialog" aria-modal="true"
      aria-label={cur.title || tr('ดูรูปขยาย')}
      style={{
        position: 'fixed', inset: 0, zIndex: 4000, background: 'var(--scrim)',
        WebkitBackdropFilter: 'var(--scrim-blur)', backdropFilter: 'var(--scrim-blur)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 12, gap: 10,
      }}>
      {/* หัว: ป้าย/ชื่อรูป + ตัวนับ "2 / 3" (คนต้องรู้ว่ากำลังดูรูปไหนของกี่รูป) */}
      {(cur.badge != null && cur.badge !== '') || cur.title || many ? (
        <div onClick={e => e.stopPropagation()}
          style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--scrim-ink)', maxWidth: '100%' }}>
          {cur.badge != null && cur.badge !== '' && (
            <span style={{
              minWidth: 26, height: 26, padding: '0 6px', borderRadius: 'var(--r-pill)',
              background: cur.badgeColor || 'var(--accent)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0,
            }}>{cur.badge}</span>
          )}
          {cur.title && (
            <span style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{cur.title}</span>
          )}
          {many && <span style={{ fontSize: 12, color: 'var(--scrim-ink2)', flexShrink: 0 }}>{i + 1} / {list.length}</span>}
        </div>
      ) : null}

      <div onClick={e => e.stopPropagation()}
        style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: '100%' }}>
        {many && (
          <button type="button" className="tbtn" style={arrow} onClick={() => go(i - 1)}
            title={tr('รูปก่อนหน้า')} aria-label={tr('รูปก่อนหน้า')}>‹</button>
        )}
        <img src={cur.url} alt={cur.title || ''} style={{
          maxWidth: many ? 'calc(100vw - 128px)' : 'calc(100vw - 24px)', maxHeight: '74vh',
          objectFit: 'contain', borderRadius: 10, border: '2px solid var(--border2)',
          boxShadow: 'var(--shadow-lg)', background: 'var(--bg2)', display: 'block',
        }} />
        {many && (
          <button type="button" className="tbtn" style={arrow} onClick={() => go(i + 1)}
            title={tr('รูปถัดไป')} aria-label={tr('รูปถัดไป')}>›</button>
        )}
      </div>

      {cur.caption && (
        <div onClick={e => e.stopPropagation()} style={{
          color: 'var(--scrim-ink2)', fontSize: 12.5, maxWidth: 'min(560px, 94vw)',
          textAlign: 'center', lineHeight: 1.6,
        }}>{cur.caption}</div>
      )}

      <button type="button" onClick={onClose} style={{
        padding: '11px 26px', minHeight: 44, borderRadius: 'var(--r-pill)', border: 'none',
        background: 'var(--accent)', color: 'var(--accent-ink)', fontSize: 14, fontWeight: 800, cursor: 'pointer',
      }}>{tr('ปิด')}</button>
    </div>
  );
}

/**
 * 🖼️ รูปแนบที่ "กดขยายได้" — ใช้แทน `<img>` เปล่าทุกจุดที่โชว์รูปแนบ
 *
 * @param url        URL รูป (ว่าง = ไม่วาดอะไรเลย — ผู้เรียกเป็นคนเขียนว่า "ยังไม่มีรูป")
 * @param items      ส่งมาด้วยได้ถ้าอยากให้เลื่อนดูรูปอื่นในชุดเดียวกัน (เช่น ก่อน/หลัง/QA ของใบ MO)
 * @param index      ตำแหน่งของรูปนี้ใน `items`
 * @param title      ชื่อรูป (โชว์ในฉากขยาย)
 * @param caption    คำอธิบายใต้รูป
 * @param imgStyle   สไตล์ของรูปย่อ (ค่าเริ่มต้น: สูง 130px · ไม่ครอป)
 * @param maxHeight  ความสูงรูปย่อแบบสั้นๆ (ทางเลือกแทน imgStyle)
 */
export function AttachImage({
  url, items = null, index = 0, title = null, caption = null,
  alt = '', maxHeight = 130, imgStyle = null, style = null, hint = null, lazy = true,
}) {
  const [open, setOpen] = useState(false);
  if (!url) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        title={hint || tr('แตะเพื่อดูรูปขยาย')} aria-label={hint || tr('ดูรูปขยาย')}
        style={{
          padding: 0, border: 'none', background: 'none', cursor: 'zoom-in',
          display: 'block', maxWidth: '100%', ...style,
        }}>
        <img src={url} alt={alt || title || ''} loading={lazy ? 'lazy' : undefined} style={{
          display: 'block', maxWidth: '100%', maxHeight, width: 'auto', height: 'auto',
          objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)', ...imgStyle,
        }} />
      </button>
      {open && (
        <ImageLightbox items={items || [{ url, title, caption }]} index={items ? index : 0}
          onClose={() => setOpen(false)} />
      )}
    </>
  );
}
